// Pluckk - Content Script
// Captures selected text and surrounding context from any webpage

import type { ExtensionMessage, SelectionResponse, PingResponse } from './types';

(function(): void {
  'use strict';

  const CONTEXT_CHARS = 500;

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
   * Main handler for selection capture requests
   */
  function captureSelection(): SelectionResponse {
    const selection = getSelection();
    const context = getSurroundingContext();
    const metadata = getPageMetadata();

    return {
      selection: selection,
      context: context,
      url: metadata.url,
      title: metadata.title
    };
  }

  // Listen for messages from the background script or popup
  chrome.runtime.onMessage.addListener(
    (
      request: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: SelectionResponse | PingResponse) => void
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
      return true; // Keep the message channel open for async response
    }
  );

})();
