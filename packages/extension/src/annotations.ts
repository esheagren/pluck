// Pluckk - Page Annotations Module
// Injects margin annotations showing cards created from the current page

import { SUPABASE_URL, SUPABASE_KEY } from '@pluckk/shared/constants';

interface CardAnnotation {
  id: string;
  question: string;
  answer: string;
  source_selector: string;
  source_text_offset: number;
}

const ANNOTATION_CONTAINER_ID = 'pluckk-annotations';
const ANNOTATION_CLASS = 'pluckk-annotation';

/**
 * Fetch cards for the current page URL
 */
async function fetchCardsForPage(url: string): Promise<CardAnnotation[]> {
  try {
    // Normalize URL (remove hash and query params for matching)
    const normalizedUrl = new URL(url);
    normalizedUrl.hash = '';
    normalizedUrl.search = '';
    const baseUrl = normalizedUrl.toString();

    // Query Supabase for cards with this source URL that have selectors
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/cards?source_url=like.${encodeURIComponent(baseUrl)}*&source_selector=not.is.null&select=id,question,answer,source_selector,source_text_offset`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch cards for page:', response.statusText);
      return [];
    }

    return await response.json() as CardAnnotation[];
  } catch (error) {
    console.error('Error fetching cards for page:', error);
    return [];
  }
}

/**
 * Create the annotation container if it doesn't exist
 */
function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById(ANNOTATION_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = ANNOTATION_CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Find the DOM element for a card's selector and position
 */
function findTargetElement(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Create an annotation element for a card
 */
function createAnnotationElement(card: CardAnnotation, targetElement: Element): HTMLElement {
  const annotation = document.createElement('div');
  annotation.className = ANNOTATION_CLASS;
  annotation.dataset.cardId = card.id;

  // Collapsed state - just show an indicator
  const indicator = document.createElement('div');
  indicator.className = 'pluckk-annotation-indicator';
  indicator.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="9" y1="9" x2="15" y2="15"></line>
      <line x1="15" y1="9" x2="9" y2="15"></line>
    </svg>
  `;

  // Expanded state - show question preview
  const content = document.createElement('div');
  content.className = 'pluckk-annotation-content';
  content.innerHTML = `
    <div class="pluckk-annotation-question">${escapeHtml(truncate(card.question, 80))}</div>
  `;

  annotation.appendChild(indicator);
  annotation.appendChild(content);

  // Position the annotation relative to the target element
  const rect = targetElement.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  annotation.style.top = `${rect.top + scrollTop}px`;

  // Toggle expanded state on click
  annotation.addEventListener('click', (e) => {
    e.stopPropagation();
    annotation.classList.toggle('expanded');
  });

  return annotation;
}

/**
 * Truncate text to a maximum length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Inject CSS styles for annotations
 */
function injectStyles(): void {
  if (document.getElementById('pluckk-annotation-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'pluckk-annotation-styles';
  styles.textContent = `
    #${ANNOTATION_CONTAINER_ID} {
      position: absolute;
      top: 0;
      right: 16px;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 999999;
    }

    .${ANNOTATION_CLASS} {
      position: absolute;
      right: 0;
      width: 32px;
      height: 32px;
      background: #f8f4ef;
      border: 1px solid #e8e4df;
      border-radius: 6px;
      cursor: pointer;
      pointer-events: auto;
      transition: all 0.2s ease;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .${ANNOTATION_CLASS}:hover,
    .${ANNOTATION_CLASS}.expanded {
      width: 240px;
      height: auto;
      min-height: 32px;
    }

    .${ANNOTATION_CLASS}.expanded {
      width: 280px;
    }

    .pluckk-annotation-indicator {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8b7355;
      flex-shrink: 0;
    }

    .pluckk-annotation-content {
      display: none;
      padding: 8px 12px 8px 0;
    }

    .${ANNOTATION_CLASS}:hover .pluckk-annotation-content,
    .${ANNOTATION_CLASS}.expanded .pluckk-annotation-content {
      display: block;
    }

    .${ANNOTATION_CLASS}:hover .pluckk-annotation-indicator,
    .${ANNOTATION_CLASS}.expanded .pluckk-annotation-indicator {
      display: none;
    }

    .pluckk-annotation-question {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #3d3d3d;
    }

    @media (prefers-color-scheme: dark) {
      .${ANNOTATION_CLASS} {
        background: #2a2520;
        border-color: #3a3530;
      }

      .pluckk-annotation-indicator {
        color: #a89070;
      }

      .pluckk-annotation-question {
        color: #e0e0e0;
      }
    }
  `;
  document.head.appendChild(styles);
}

/**
 * Remove all annotations from the page
 */
export function removeAnnotations(): void {
  const container = document.getElementById(ANNOTATION_CONTAINER_ID);
  if (container) {
    container.remove();
  }
}

/**
 * Inject annotations for the current page
 */
export async function injectAnnotations(): Promise<void> {
  // Check if setting is enabled
  const result = await chrome.storage.sync.get(['showPageAnnotations']);
  if (!result.showPageAnnotations) {
    removeAnnotations();
    return;
  }

  const cards = await fetchCardsForPage(window.location.href);
  if (cards.length === 0) {
    return;
  }

  injectStyles();
  const container = getOrCreateContainer();

  // Clear existing annotations
  container.innerHTML = '';

  // Create annotations for each card
  for (const card of cards) {
    if (!card.source_selector) continue;

    const targetElement = findTargetElement(card.source_selector);
    if (!targetElement) continue;

    const annotation = createAnnotationElement(card, targetElement);
    container.appendChild(annotation);
  }
}

/**
 * Update annotations when settings change
 */
export function listenForSettingChanges(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.showPageAnnotations) {
      if (changes.showPageAnnotations.newValue) {
        injectAnnotations();
      } else {
        removeAnnotations();
      }
    }
  });
}

/**
 * Handle deep-link to a specific card's source location
 * URL format: ?pluckk_card=<cardId>
 */
export async function handleDeepLink(): Promise<void> {
  const urlParams = new URLSearchParams(window.location.search);
  const cardId = urlParams.get('pluckk_card');

  if (!cardId) return;

  try {
    // Fetch the specific card
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/cards?id=eq.${encodeURIComponent(cardId)}&select=source_selector,source_text_offset,source_selection`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch card for deep link:', response.statusText);
      return;
    }

    const cards = await response.json() as Array<{
      source_selector: string | null;
      source_text_offset: number | null;
      source_selection: string | null;
    }>;

    const card = cards[0];
    if (!card || !card.source_selector) {
      return;
    }

    const targetElement = findTargetElement(card.source_selector);

    if (!targetElement) {
      // Selector no longer matches - just scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Scroll to the element
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight the source text briefly
    highlightSourceText(targetElement, card.source_selection, card.source_text_offset);
  } catch (error) {
    console.error('Error handling deep link:', error);
  }
}

/**
 * Temporarily highlight the source text in the target element
 */
function highlightSourceText(
  element: Element,
  sourceSelection: string | null,
  textOffset: number | null
): void {
  if (!sourceSelection || textOffset === null) {
    // Fallback: highlight the entire element
    highlightElement(element);
    return;
  }

  // Try to find and highlight the specific text
  const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let node: Text | null = null;

  while ((node = treeWalker.nextNode() as Text | null)) {
    const nodeLength = node.textContent?.length || 0;

    if (currentOffset + nodeLength > textOffset) {
      // Found the node containing the start of our selection
      const localOffset = textOffset - currentOffset;
      const range = document.createRange();

      try {
        range.setStart(node, localOffset);

        // Find the end of the selection
        let remaining = sourceSelection.length;
        let endNode: Text | null = node;
        let endOffset = localOffset;

        while (endNode && remaining > 0) {
          const availableLength = (endNode.textContent?.length || 0) - endOffset;

          if (availableLength >= remaining) {
            range.setEnd(endNode, endOffset + remaining);
            remaining = 0;
          } else {
            remaining -= availableLength;
            endNode = treeWalker.nextNode() as Text | null;
            endOffset = 0;
          }
        }

        // Create highlight span
        const highlight = document.createElement('span');
        highlight.className = 'pluckk-source-highlight';
        highlight.style.cssText = `
          background: linear-gradient(120deg, #fef08a 0%, #fde047 100%);
          padding: 2px 0;
          border-radius: 2px;
          transition: background 0.5s ease;
        `;

        range.surroundContents(highlight);

        // Fade out the highlight after a delay
        setTimeout(() => {
          highlight.style.background = 'transparent';
          setTimeout(() => {
            // Unwrap the highlight span
            const parent = highlight.parentNode;
            if (parent) {
              while (highlight.firstChild) {
                parent.insertBefore(highlight.firstChild, highlight);
              }
              parent.removeChild(highlight);
            }
          }, 500);
        }, 2000);

        return;
      } catch {
        // Range manipulation failed, fall back to element highlight
        break;
      }
    }

    currentOffset += nodeLength;
  }

  // Fallback: highlight the entire element
  highlightElement(element);
}

/**
 * Highlight an entire element temporarily
 */
function highlightElement(element: Element): void {
  const htmlElement = element as HTMLElement;
  const originalBackground = htmlElement.style.background;

  htmlElement.style.background = 'linear-gradient(120deg, #fef08a 0%, #fde047 100%)';
  htmlElement.style.transition = 'background 0.5s ease';

  setTimeout(() => {
    htmlElement.style.background = originalBackground;
  }, 2000);
}
