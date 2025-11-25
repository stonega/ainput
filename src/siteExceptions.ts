/**
 * Site Exception Handlers
 *
 * This module provides site-specific handling for websites with custom
 * rich text editors that require special treatment for getting/setting values.
 *
 * Currently supported sites:
 * - X.com (Twitter) - Custom tweet text editor
 * - Reddit - Lexical rich text editor
 */

export type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

/**
 * Site handler interface for implementing site-specific logic
 */
interface SiteHandler {
  /** Check if this handler applies to the current site */
  isApplicable: () => boolean;
  /** Get the editor root element from a given element */
  getEditorRoot: (element: Element) => HTMLElement | null;
  /** Get text value from the editor */
  getValue: (editorRoot: HTMLElement) => string;
  /** Set text value in the editor */
  setValue: (editorRoot: HTMLElement, value: string) => void;
}

// ============================================================================
// X.com (Twitter) Handler
// ============================================================================

const xHandler: SiteHandler = {
  isApplicable: () => {
    const hostname = window.location.hostname;
    return hostname === "x.com" || hostname === "twitter.com";
  },

  getEditorRoot: (element: Element): HTMLElement | null => {
    if (!xHandler.isApplicable()) {
      return null;
    }

    const editorRoot = element.closest<HTMLElement>('[contenteditable="true"]');
    if (!editorRoot) {
      return null;
    }

    // Check for tweet textarea data-testid
    const testId = editorRoot.getAttribute("data-testid");
    if (testId && testId.startsWith("tweetTextarea")) {
      return editorRoot;
    }

    // Check for aria-label indicating post/tweet text
    const ariaLabel = editorRoot.getAttribute("aria-label");
    if (
      ariaLabel &&
      (ariaLabel.toLowerCase().includes("post text") ||
        ariaLabel.toLowerCase().includes("tweet text"))
    ) {
      return editorRoot;
    }

    return null;
  },

  getValue: (editorRoot: HTMLElement): string => {
    const textHolder = editorRoot.querySelector('[data-text="true"]');
    if (textHolder && textHolder.tagName.toUpperCase() !== "BR") {
      return textHolder.textContent || "";
    }
    return ""; // Empty if it's a BR or not found
  },

  setValue: (editorRoot: HTMLElement, value: string): void => {
    const textHolder = editorRoot.querySelector('[data-text="true"]');
    if (textHolder) {
      // It's safer to just update textContent on the existing element
      textHolder.textContent = value;
    } else {
      // Fallback for empty or unexpected structure
      editorRoot.textContent = value;
    }
    editorRoot.dispatchEvent(new Event("input", { bubbles: true }));
  },
};

// ============================================================================
// Reddit Handler (Lexical Editor)
// ============================================================================

const redditHandler: SiteHandler = {
  isApplicable: () => {
    return window.location.hostname.includes("reddit.com");
  },

  getEditorRoot: (element: Element): HTMLElement | null => {
    if (!redditHandler.isApplicable()) {
      return null;
    }
    // Reddit uses the Lexical editor framework, marked by this attribute
    return element.closest<HTMLElement>('[data-lexical-editor="true"]');
  },

  getValue: (editorRoot: HTMLElement): string => {
    // For the Lexical editor, textContent gives us the full text
    return editorRoot.textContent || "";
  },

  setValue: (editorRoot: HTMLElement, value: string): void => {
    // For rich text editors like Reddit's, we need to simulate events
    // more closely to ensure the editor's internal state is updated
    editorRoot.focus();

    // 1. Select all existing content
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(editorRoot);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // 2. Fire a "beforeinput" event - crucial for many modern editors
    const beforeInputEvent = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: "insertText",
      data: value,
    });
    editorRoot.dispatchEvent(beforeInputEvent);

    // 3. If the event wasn't cancelled, insert the text
    if (!beforeInputEvent.defaultPrevented) {
      document.execCommand("insertText", false, value);
    }

    // 4. Dispatch input event for completeness
    editorRoot.dispatchEvent(
      new Event("input", { bubbles: true, cancelable: true })
    );
  },
};

// ============================================================================
// Site Handler Registry
// ============================================================================

/**
 * List of all registered site handlers.
 * Add new handlers here when supporting additional sites.
 */
const siteHandlers: SiteHandler[] = [xHandler, redditHandler];

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the X.com (Twitter) editor root element if applicable
 */
export const getXEditorRoot = (element: Element): HTMLElement | null => {
  return xHandler.getEditorRoot(element);
};

/**
 * Get the Reddit editor root element if applicable
 */
export const getRedditEditorRoot = (element: Element): HTMLElement | null => {
  return redditHandler.getEditorRoot(element);
};

/**
 * Get the value from an editable element, handling site-specific editors
 */
export const getElementValue = (element: EditableElement): string => {
  // Handle standard input/textarea elements
  if ("value" in element) {
    return (element as HTMLInputElement).value;
  }

  // Check each site handler
  for (const handler of siteHandlers) {
    const editorRoot = handler.getEditorRoot(element);
    if (editorRoot) {
      return handler.getValue(editorRoot);
    }
  }

  // Default: use textContent for contenteditable elements
  return element.textContent || "";
};

/**
 * Set the value for an editable element, handling site-specific editors
 */
export const setElementValue = (element: EditableElement, value: string): void => {
  // Handle standard input/textarea elements
  if ("value" in element) {
    (element as HTMLInputElement).value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  // Check each site handler
  for (const handler of siteHandlers) {
    const editorRoot = handler.getEditorRoot(element);
    if (editorRoot) {
      handler.setValue(editorRoot, value);
      return;
    }
  }

  // Default: use textContent for contenteditable elements
  element.textContent = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

/**
 * Check if the element is within a site-specific editor
 */
export const isInSiteSpecificEditor = (element: Element): boolean => {
  for (const handler of siteHandlers) {
    if (handler.getEditorRoot(element)) {
      return true;
    }
  }
  return false;
};
