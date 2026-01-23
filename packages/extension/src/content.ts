// Pluckk - Content Script
// Captures selected text and surrounding context from any webpage

import type { ExtensionMessage, SelectionResponse, PingResponse, DOMContextResponse } from './types';

(function(): void {
  'use strict';

  const CONTEXT_CHARS = 500;
  const VISIBLE_TEXT_CHARS = 1500;

  /**
   * Generate a unique CSS selector for an element
   * Uses a combination of tag, id, classes, and nth-child for uniqueness
   */
  function getDomSelector(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      // Prefer ID if available and unique
      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        parts.unshift(selector);
        break; // ID should be unique, no need to go further
      }

      // Add classes that help identify the element (skip utility classes)
      const meaningfulClasses = Array.from(current.classList)
        .filter(c => !c.match(/^(w-|h-|p-|m-|text-|bg-|flex|grid|block|inline)/))
        .slice(0, 2);
      if (meaningfulClasses.length > 0) {
        selector += '.' + meaningfulClasses.map(c => CSS.escape(c)).join('.');
      }

      // Add nth-of-type for disambiguation among same-tag siblings
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  /**
   * Get the text offset of the selection start within a container element
   */
  function getTextOffset(container: Element, selection: Selection): number {
    const range = selection.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
  }

  /**
   * Get the selected text from the page
   */
  function getSelection(): string {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  }

  /**
   * Get surrounding context from the selection
   * Strategy: Walk up DOM to find meaningful container, extract text around selection
   */
  function getSurroundingContext(): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return '';
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      return '';
    }

    // Find a meaningful container element
    let container: Node | null = range.commonAncestorContainer;

    // If it's a text node, get the parent element
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    // Walk up to find a block-level container (article, section, div, p, etc.)
    const blockElements = ['ARTICLE', 'SECTION', 'DIV', 'MAIN', 'BODY', 'P', 'LI', 'TD', 'BLOCKQUOTE'];
    let attempts = 0;
    const maxAttempts = 10;

    while (container && attempts < maxAttempts) {
      if (container instanceof HTMLElement && blockElements.includes(container.tagName)) {
        // Check if container has enough text
        const containerText = container.textContent || '';
        if (containerText.length > selectedText.length + 100) {
          break;
        }
      }
      container = (container as Element).parentElement;
      attempts++;
    }

    if (!container) {
      container = document.body;
    }

    // Get the full text of the container
    const fullText = container.textContent || '';

    // Find the position of the selected text
    const selectionIndex = fullText.indexOf(selectedText);

    if (selectionIndex === -1) {
      // Fallback: just return some text from the container
      return fullText.substring(0, CONTEXT_CHARS * 2);
    }

    // Extract context before and after
    const beforeStart = Math.max(0, selectionIndex - CONTEXT_CHARS);
    const afterEnd = Math.min(fullText.length, selectionIndex + selectedText.length + CONTEXT_CHARS);

    let before = fullText.substring(beforeStart, selectionIndex);
    let after = fullText.substring(selectionIndex + selectedText.length, afterEnd);

    // Clean up: try to start/end at word boundaries
    if (beforeStart > 0) {
      const spaceIndex = before.indexOf(' ');
      if (spaceIndex !== -1 && spaceIndex < 50) {
        before = before.substring(spaceIndex + 1);
      }
    }

    if (afterEnd < fullText.length) {
      const lastSpaceIndex = after.lastIndexOf(' ');
      if (lastSpaceIndex !== -1 && lastSpaceIndex > after.length - 50) {
        after = after.substring(0, lastSpaceIndex);
      }
    }

    // Clean up whitespace
    before = before.replace(/\s+/g, ' ').trim();
    after = after.replace(/\s+/g, ' ').trim();

    // Format with clear markers
    return `${before} [[SELECTED]] ${selectedText} [[/SELECTED]] ${after}`;
  }

  /**
   * Get page metadata
   */
  interface PageMetadata {
    url: string;
    title: string;
  }

  function getPageMetadata(): PageMetadata {
    return {
      url: window.location.href,
      title: document.title
    };
  }

  /**
   * Check if an element is visible in the viewport
   */
  function isElementInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }

  /**
   * Get visible DOM context for image-based card generation
   * Extracts headings and visible text from the current viewport
   */
  function getVisibleDOMContext(): DOMContextResponse {
    const metadata = getPageMetadata();

    // Collect visible headings (H1-H3)
    const headings: string[] = [];
    const headingElements = document.querySelectorAll('h1, h2, h3');
    headingElements.forEach(el => {
      if (isElementInViewport(el)) {
        const text = el.textContent?.trim();
        if (text) {
          headings.push(text);
        }
      }
    });

    // Collect visible body text from paragraphs and text-heavy elements
    const textElements = document.querySelectorAll('p, li, td, th, span, div, article, section');
    let visibleText = '';
    const seenText = new Set<string>();

    for (const el of textElements) {
      if (visibleText.length >= VISIBLE_TEXT_CHARS) break;
      if (!isElementInViewport(el)) continue;

      // Skip if element has many children (container, not text element)
      if (el.children.length > 3) continue;

      // Get direct text content (not from nested elements)
      let text = '';
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      }
      text = text.trim();

      // Skip empty, short, or duplicate text
      if (!text || text.length < 20 || seenText.has(text)) continue;
      seenText.add(text);

      visibleText += text + ' ';
    }

    // Clean up and truncate
    visibleText = visibleText.replace(/\s+/g, ' ').trim();
    if (visibleText.length > VISIBLE_TEXT_CHARS) {
      // Truncate at word boundary
      visibleText = visibleText.substring(0, VISIBLE_TEXT_CHARS);
      const lastSpace = visibleText.lastIndexOf(' ');
      if (lastSpace > VISIBLE_TEXT_CHARS - 100) {
        visibleText = visibleText.substring(0, lastSpace);
      }
    }

    return {
      headings,
      visibleText,
      url: metadata.url,
      title: metadata.title
    };
  }

  /**
   * Main handler for selection capture requests
   */
  function captureSelection(): SelectionResponse {
    const selectionText = getSelection();
    const context = getSurroundingContext();
    const metadata = getPageMetadata();

    // Capture DOM location for deep-linking
    let selector: string | undefined;
    let textOffset: number | undefined;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let container: Node | null = range.commonAncestorContainer;

      // If it's a text node, get the parent element
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }

      if (container instanceof Element) {
        selector = getDomSelector(container);
        textOffset = getTextOffset(container, selection);
      }
    }

    return {
      selection: selectionText,
      context: context,
      url: metadata.url,
      title: metadata.title,
      selector,
      textOffset
    };
  }

  // Listen for messages from the background script or popup
  chrome.runtime.onMessage.addListener(
    (
      request: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: SelectionResponse | PingResponse | DOMContextResponse) => void
    ): boolean => {
      if (request.action === 'ping') {
        // Used to check if content script is already injected
        sendResponse({ pong: true });
        return false;
      }

      if (request.action === 'getSelection') {
        const data = captureSelection();
        sendResponse(data);
      }

      if (request.action === 'getDOMContext') {
        const data = getVisibleDOMContext();
        sendResponse(data);
      }
      return true; // Keep the message channel open for async response
    }
  );

})();
