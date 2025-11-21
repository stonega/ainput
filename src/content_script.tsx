import React from "react";
import { createRoot } from "react-dom/client";
import {
  MdTranslate,
  MdAutoFixHigh,
  MdHourglassEmpty,
  MdAutoAwesome,
  MdReply,
} from "react-icons/md";
import { Readability } from "@mozilla/readability";

declare global {
  interface Window {
    hasShownAuthError?: boolean;
  }
}

interface ButtonContainerProps {
  onFixGrammar: () => void;
  onTranslate: () => void;
  onEnhancePrompt: () => void;
  onAutoReply: () => void;
  loading: boolean;
}

interface MessageResponse {
  success: boolean;
  result?: string;
  error?: string;
}

const ButtonContainer: React.FC<ButtonContainerProps> = ({
  onFixGrammar,
  onTranslate,
  onEnhancePrompt,
  onAutoReply,
  loading,
}) => {
  const [hoverFix, setHoverFix] = React.useState(false);
  const [hoverTranslate, setHoverTranslate] = React.useState(false);
  const [hoverEnhance, setHoverEnhance] = React.useState(false);
  const [hoverAutoReply, setHoverAutoReply] = React.useState(false);

  const buttonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "8px 12px",
    border: 'none',
    backgroundColor: "transparent",
    color: "#333",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "400",
    textAlign: "left",
    transition: "background-color 0.2s",
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "8px 6px",
          color: "#333",
          fontSize: "12px",
          whiteSpace: "nowrap",
        }}
      >
        <MdHourglassEmpty size={16} color="#62109F" />
        <span className="ainput-thinking-gradient">Thinking...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "4px",
        animation: "ainput-fade-in 0.2s ease-out forwards",
      }}
    >
      <button
        onClick={onFixGrammar}
        disabled={loading}
        onMouseEnter={() => setHoverFix(true)}
        onMouseLeave={() => setHoverFix(false)}
        style={{
          ...buttonStyle,
          backgroundColor: hoverFix ? "#f0f0f0" : "transparent",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <MdAutoFixHigh size={16} color="#62109F" />
        <span style={{ whiteSpace: "nowrap" }}>Fix Grammar</span>
      </button>
      <button
        onClick={onTranslate}
        disabled={loading}
        onMouseEnter={() => setHoverTranslate(true)}
        onMouseLeave={() => setHoverTranslate(false)}
        style={{
          ...buttonStyle,
          backgroundColor: hoverTranslate ? "#f0f0f0" : "transparent",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <MdTranslate size={16} color="#41A67E" />
        <span>Translate</span>
      </button>
      <button
        onClick={onAutoReply}
        disabled={loading}
        onMouseEnter={() => setHoverAutoReply(true)}
        onMouseLeave={() => setHoverAutoReply(false)}
        style={{
          ...buttonStyle,
          backgroundColor: hoverAutoReply ? "#f0f0f0" : "transparent",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <MdReply size={16} color="#007BFF" />
        <span style={{ whiteSpace: "nowrap" }}>Auto Reply</span>
      </button>
      <button
        onClick={onEnhancePrompt}
        disabled={loading}
        onMouseEnter={() => setHoverEnhance(true)}
        onMouseLeave={() => setHoverEnhance(false)}
        style={{
          ...buttonStyle,
          backgroundColor: hoverEnhance ? "#f0f0f0" : "transparent",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <MdAutoAwesome size={16} color="#D4AF37" />
        <span style={{ whiteSpace: "nowrap" }}>Enhance Prompt</span>
      </button>
    </div>
  );
};

type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

/**
 * Helper functions to get and set values for editable elements.
 * Specially handles X.com (Twitter) input fields where the text content
 * is nested deep within a span inside the editable div.
 */

const getXEditorRoot = (element: Element): HTMLElement | null => {
  if (
    window.location.hostname !== "x.com" &&
    window.location.hostname !== "twitter.com"
  ) {
    return null;
  }

  const editorRoot = element.closest<HTMLElement>('[contenteditable="true"]');
  if (!editorRoot) {
    return null;
  }

  const testId = editorRoot.getAttribute("data-testid");
  if (testId && testId.startsWith("tweetTextarea")) {
    return editorRoot;
  }

  const ariaLabel = editorRoot.getAttribute("aria-label");
  if (
    ariaLabel &&
    (ariaLabel.toLowerCase().includes("post text") ||
      ariaLabel.toLowerCase().includes("tweet text"))
  ) {
    return editorRoot;
  }

  return null;
};

const getRedditEditorRoot = (element: Element): HTMLElement | null => {
  if (!window.location.hostname.includes("reddit.com")) {
    return null;
  }
  // Reddit uses the Lexical editor framework, which is marked by this attribute.
  // This is more reliable than class names or other attributes that might change.
  return element.closest<HTMLElement>('[data-lexical-editor="true"]');
};

const getElementValue = (element: EditableElement): string => {
  if ("value" in element) {
    return (element as HTMLInputElement).value;
  }

  const xEditorRoot = getXEditorRoot(element);
  if (xEditorRoot) {
    const textHolder = xEditorRoot.querySelector('[data-text="true"]');
    if (textHolder && textHolder.tagName.toUpperCase() !== "BR") {
      return textHolder.textContent || "";
    }
    return ""; // Empty if it's a BR or not found
  }

  const redditEditorRoot = getRedditEditorRoot(element);
  if (redditEditorRoot) {
    // For the lexical editor, textContent should give us the full text.
    return redditEditorRoot.textContent || "";
  }

  return element.textContent || "";
};

const setElementValue = (element: EditableElement, value: string) => {
  if ("value" in element) {
    (element as HTMLInputElement).value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const xEditorRoot = getXEditorRoot(element);
  if (xEditorRoot) {
    const textHolder = xEditorRoot.querySelector('[data-text="true"]');
    if (textHolder) {
      // It's safer to just update textContent on the existing element
      textHolder.textContent = value;
    } else {
      // Fallback for empty or unexpected structure. This is risky.
      xEditorRoot.textContent = value;
    }
    xEditorRoot.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const redditEditorRoot = getRedditEditorRoot(element);
  if (redditEditorRoot) {
    // For rich text editors like Reddit's, we need to simulate events
    // more closely to ensure the editor's internal state is updated.
    redditEditorRoot.focus();

    // 1. Select all existing content
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(redditEditorRoot);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // 2. Fire a "beforeinput" event. This is crucial for many modern editors.
    const beforeInputEvent = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: "insertText",
      data: value,
    });
    redditEditorRoot.dispatchEvent(beforeInputEvent);

    // 3. If the event wasn't cancelled, insert the text.
    if (!beforeInputEvent.defaultPrevented) {
      document.execCommand("insertText", false, value);
    }

    // 4. An "input" event might also be needed.
    redditEditorRoot.dispatchEvent(
      new Event("input", { bubbles: true, cancelable: true })
    );

    return;
  }

  element.textContent = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

let activeInput: EditableElement | null = null;
let accessoryContainer: HTMLDivElement | null = null;
let removeListeners: (() => void) | null = null;

const InputAccessory: React.FC<{
  inputElement: EditableElement;
}> = ({ inputElement }) => {
  const [popoverVisible, setPopoverVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [textToAnimate, setTextToAnimate] = React.useState<string | null>(null);
  const accessoryRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [popoverTop, setPopoverTop] = React.useState("16px");

  React.useEffect(() => {
    const handleLoadingStart = () => setLoading(true);
    const handleLoadingEnd = () => {
      setLoading(false);
      setPopoverVisible(false);
    };

    inputElement.addEventListener(
      "ainput-loading-start",
      handleLoadingStart as EventListener
    );
    inputElement.addEventListener(
      "ainput-loading-end",
      handleLoadingEnd as EventListener
    );

    return () => {
      inputElement.removeEventListener(
        "ainput-loading-start",
        handleLoadingStart as EventListener
      );
      inputElement.removeEventListener(
        "ainput-loading-end",
        handleLoadingEnd as EventListener
      );
    };
  }, [inputElement]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accessoryRef.current &&
        !accessoryRef.current.contains(event.target as Node)
      ) {
        setPopoverVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const adjustPopoverPosition = React.useCallback(() => {
    if (accessoryRef.current && popoverRef.current) {
      const accessoryRect = accessoryRef.current.getBoundingClientRect();
      const popoverHeight = popoverRef.current.offsetHeight;
      const viewportHeight = window.innerHeight;

      // Check if there's enough space below
      const popoverBottom = accessoryRect.top + 16 + popoverHeight;
      const hasSpaceBelow = popoverBottom < viewportHeight;

      // Check if there's enough space above
      const hasSpaceAbove = accessoryRect.top > popoverHeight + 4;

      let newTop = "16px"; // Default position is below
      if (!hasSpaceBelow && hasSpaceAbove) {
        // Not enough space below, but enough above, so move to top
        newTop = `${-popoverHeight - 4}px`;
      }

      setPopoverTop((currentTop) =>
        currentTop === newTop ? currentTop : newTop
      );
    }
  }, []);

  React.useLayoutEffect(() => {
    if (popoverVisible) {
      adjustPopoverPosition();

      window.addEventListener("scroll", adjustPopoverPosition, true);
      window.addEventListener("resize", adjustPopoverPosition);

      return () => {
        window.removeEventListener("scroll", adjustPopoverPosition, true);
        window.removeEventListener("resize", adjustPopoverPosition);
      };
    }
  }, [popoverVisible, adjustPopoverPosition]);

  React.useEffect(() => {
    if (!textToAnimate) {
      return;
    }

    const words = textToAnimate.split(/(\s+)/);
    let currentText = "";
    let wordIndex = 0;

    const intervalId = setInterval(() => {
      if (wordIndex >= words.length) {
        clearInterval(intervalId);
        setLoading(false);
        setTextToAnimate(null);
        return;
      }

      currentText += words[wordIndex];
      setElementValue(inputElement, currentText);

      wordIndex++;
    }, 50);

    return () => {
      clearInterval(intervalId);
    };
  }, [textToAnimate, inputElement, setLoading]);

  const handleAction = async (
    action: "fixGrammar" | "translate" | "enhancePrompt",
    element: EditableElement
  ) => {
    const text = getElementValue(element);
    if (!text.trim()) {
      alert("Please enter some text first.");
      return;
    }

    setPopoverVisible(false);
    setLoading(true);

    try {
      const response = (await chrome.runtime.sendMessage({
        action,
        text,
      })) as unknown as MessageResponse;

      if (response && response.success && response.result) {
        if (getXEditorRoot(element) || getRedditEditorRoot(element)) {
          setElementValue(element, response.result);
          setLoading(false);
        } else {
          setElementValue(element, "");
          setTextToAnimate(response.result);
        }
      } else {
        const errorMessage = response?.error || `Failed to ${action}`;
        if (
          errorMessage.includes("model") ||
          errorMessage.includes("API key") ||
          errorMessage.includes("options")
        ) {
          if (confirm(errorMessage + " Click OK to open settings.")) {
            chrome.runtime.sendMessage({ action: "openOptionsPage" });
          }
        } else {
          alert("Error: " + errorMessage);
        }
        setLoading(false);
      }
    } catch (error) {
      const errorMessage = String(error);
      if (
        errorMessage.includes("model") ||
        errorMessage.includes("API key") ||
        errorMessage.includes("options")
      ) {
        if (confirm(errorMessage + " Click OK to open settings.")) {
          chrome.runtime.sendMessage({ action: "openOptionsPage" });
        }
      } else {
        alert("Error: " + errorMessage);
      }
      setLoading(false);
    }
  };

  const onFixGrammar = () => handleAction("fixGrammar", inputElement);
  const onTranslate = () => handleAction("translate", inputElement);
  const onEnhancePrompt = () => handleAction("enhancePrompt", inputElement);

  const onAutoReply = async () => {
    setPopoverVisible(false);
    setLoading(true);

    try {
      const documentClone = document.cloneNode(true) as Document;
      const article = new Readability(documentClone).parse();
      const pageContent = article?.textContent?.slice(0, 4000) || "";

      const response = (await chrome.runtime.sendMessage({
        action: "autoReply",
        pageContent,
      })) as unknown as MessageResponse;

      if (response && response.success && response.result) {
        if (getXEditorRoot(inputElement) || getRedditEditorRoot(inputElement)) {
          setElementValue(inputElement, response.result);
          setLoading(false);
        } else {
          setElementValue(inputElement, "");
          setTextToAnimate(response.result);
        }
      } else {
        const errorMessage = response?.error || `Failed to auto reply`;
        if (
          errorMessage.includes("model") ||
          errorMessage.includes("API key") ||
          errorMessage.includes("options")
        ) {
          if (confirm(errorMessage + " Click OK to open settings.")) {
            chrome.runtime.sendMessage({ action: "openOptionsPage" });
          }
        } else {
          alert("Error: " + errorMessage);
        }
        setLoading(false);
      }
    } catch (error) {
      const errorMessage = String(error);
      if (
        errorMessage.includes("model") ||
        errorMessage.includes("API key") ||
        errorMessage.includes("options")
      ) {
        if (confirm(errorMessage + " Click OK to open settings.")) {
          chrome.runtime.sendMessage({ action: "openOptionsPage" });
        }
      } else {
        alert("Error: " + errorMessage);
      }
      setLoading(false);
    }
  };

  return (
    <div
      ref={accessoryRef}
      style={{ position: "relative" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        onClick={() => setPopoverVisible(!popoverVisible)}
        style={{
          width: "12px",
          height: "12px",
          backgroundColor: "#00B1F2",
          borderRadius: "50%",
          cursor: "pointer",
          animation: loading ? "ainput-pulse 1.5s infinite" : "none",
        }}
      />
      {popoverVisible && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute",
            top: popoverTop,
            left: "0px",
            zIndex: 10000,
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 2px 14px rgba(0,0,0,0.2)",
            border: "1px solid #f9f9f9",
            padding: "4px",
          }}
        >
          <ButtonContainer
            onFixGrammar={onFixGrammar}
            onTranslate={onTranslate}
            onEnhancePrompt={onEnhancePrompt}
            onAutoReply={onAutoReply}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};

function getCaretCoordinates(element: EditableElement, position: number) {
  const isInput = element.tagName.toLowerCase() === "input";
  const isDiv = element.tagName.toLowerCase() === "div";
  const debug = false;
  const div = document.createElement("div");
  document.body.appendChild(div);

  const style = div.style;
  const computed = getComputedStyle(element);

  style.whiteSpace = "pre-wrap";
  if (!isInput) {
    style.wordWrap = "break-word";
  }

  // Copy crucial styles
  const properties = [
    "direction",
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderStyle",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
  ];

  properties.forEach((prop) => {
    style[prop as any] = computed[prop as any];
  });

  if (debug) {
    style.backgroundColor = "#aaa";
    style.position = "absolute";
    style.top = `${element.offsetTop}px`;
    style.left = `${element.offsetLeft}px`;
  } else {
    style.position = "absolute";
    style.visibility = "hidden";
  }

  div.textContent = getElementValue(element).substring(0, position);

  if (isInput) {
    div.textContent = div.textContent.replace(/\s/g, " ");
  }

  const span = document.createElement("span");
  span.textContent =
    getElementValue(element).substring(
      position
    ) || ".";
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth),
    height: span.offsetHeight,
  };

  document.body.removeChild(div);

  return coordinates;
}

function positionAccessory(
  inputElement: EditableElement,
  container: HTMLElement
) {
  const rect = inputElement.getBoundingClientRect();
  let caretPos = 0;
  if (
    inputElement instanceof HTMLInputElement ||
    inputElement instanceof HTMLTextAreaElement
  ) {
    caretPos = inputElement.selectionStart || 0;
  } else if (inputElement.isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(inputElement);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretPos = preCaretRange.toString().length;
    }
  }

  const coords = getCaretCoordinates(inputElement, caretPos);

  const top =
    window.scrollY +
    rect.top +
    coords.top -
    (inputElement as HTMLElement).scrollTop;
  const left =
    window.scrollX +
    rect.left +
    coords.left -
    (inputElement as HTMLElement).scrollLeft;

  container.style.position = "absolute";
  container.style.top = `${top}px`;
  container.style.left = `${left + 4}px`; // Add some offset to not overlap with cursor
  container.style.zIndex = "9999";
}

function showAccessoryFor(element: EditableElement) {
  if (activeInput === element) return;

  hideAccessory();

  activeInput = element;
  accessoryContainer = document.createElement("div");
  document.body.appendChild(accessoryContainer);

  const root = createRoot(accessoryContainer);
  root.render(<InputAccessory inputElement={element} />);

  positionAccessory(element, accessoryContainer);

  const updatePosition = () => {
    if (accessoryContainer) {
      positionAccessory(element, accessoryContainer);
    }
  };

  element.addEventListener("input", updatePosition);
  element.addEventListener("keyup", updatePosition);
  element.addEventListener("mousedown", updatePosition);
  element.addEventListener("scroll", updatePosition);
  window.addEventListener("resize", updatePosition);

  removeListeners = () => {
    element.removeEventListener("input", updatePosition);
    element.removeEventListener("keyup", updatePosition);
    element.removeEventListener("mousedown", updatePosition);
    element.removeEventListener("scroll", updatePosition);
    window.removeEventListener("resize", updatePosition);
  };
}

function hideAccessory() {
  if (removeListeners) {
    removeListeners();
    removeListeners = null;
  }
  if (accessoryContainer) {
    if (document.body.contains(accessoryContainer)) {
      document.body.removeChild(accessoryContainer);
    }
    accessoryContainer = null;
  }
  activeInput = null;
}

let isExtensionEnabled = true;
let isAutoReplyEnabledForSite = false;

function checkIsEnabled() {
  const currentOrigin = window.location.origin;
  chrome.storage.sync.get(["disabledSites", "autoReplySites"], (data) => {
    const disabledSites = data.disabledSites || [];
    isExtensionEnabled = !disabledSites.includes(currentOrigin);
    if (!isExtensionEnabled) {
      hideAccessory();
    }
    const autoReplySites = data.autoReplySites || [];
    isAutoReplyEnabledForSite = autoReplySites.includes(currentOrigin);
  });
}

checkIsEnabled();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    if (changes.disabledSites || changes.autoReplySites) {
      checkIsEnabled();
    }
  }
});

document.addEventListener(
  "focusin",
  (event) => {
    if (!isExtensionEnabled) return;

    const target = event.target as HTMLElement;

    if (isAutoReplyEnabledForSite) {
      const isEditable =
        target.tagName.toLowerCase() === "textarea" ||
        (target instanceof HTMLInputElement &&
          [
            "text",
            "email",
            "search",
            "tel",
            "url",
          ].includes(target.type)) ||
        (target.isContentEditable &&
          target.tagName.toLowerCase().includes("div"));

      if (isEditable) {
        const text = getElementValue(target);
        if (!text.trim()) {
          const documentClone = document.cloneNode(true) as Document;
          const article = new Readability(documentClone).parse();
          const pageContent = article?.textContent?.slice(0, 4000) || "";
          target.dispatchEvent(new Event("ainput-loading-start"));
          chrome.runtime.sendMessage(
            {
              action: "autoReply",
              pageContent,
            },
            (response: MessageResponse) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "AInput Auto Reply Error:",
                  chrome.runtime.lastError.message
                );
                target.dispatchEvent(new Event("ainput-loading-end"));
                return;
              }

              if (response && response.success && response.result) {
                setElementValue(target, "");
                // Not using the animated text for now for auto-reply
                setElementValue(target, response.result);
              } else {
                // Don't alert on auto-reply failure, just log it.
                const errorMessage = response?.error || "Failed to get auto-reply";
                console.error(
                  "AInput Auto Reply Error:",
                  errorMessage
                );
                 if (
                  errorMessage.includes("model") ||
                  errorMessage.includes("API key") ||
                  errorMessage.includes("options")
                ) {
                   // Only ask once per session/page load to avoid spamming
                   if (!window.hasShownAuthError) {
                      window.hasShownAuthError = true;
                      if (confirm(errorMessage + " Click OK to open settings.")) {
                        chrome.runtime.sendMessage({ action: "openOptionsPage" });
                      }
                   }
                }
              }
              target.dispatchEvent(new Event("ainput-loading-end"));
            }
          );
        }
      }
    }

    if (target.tagName.toLowerCase() === "textarea") {
      showAccessoryFor(target as HTMLTextAreaElement);
      return;
    }

    if (target instanceof HTMLInputElement) {
      const INPUT_TYPES = ["text", "email", "search", "tel", "url"];
      if (INPUT_TYPES.includes(target.type)) {
        showAccessoryFor(target);
      }
      return;
    }

    if (
      target.isContentEditable &&
      target.tagName.toLowerCase().includes("div")
    ) {
      showAccessoryFor(target);
    }
  },
  true
);

document.addEventListener(
  "focusout",
  (event) => {
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (!accessoryContainer || !accessoryContainer.contains(relatedTarget)) {
      hideAccessory();
    }
  },
  true
);

const style = document.createElement("style");
style.textContent = `
  @keyframes ainput-pulse {
    0% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(16, 97, 127, 0.77);
    }
    70% {
      transform: scale(1);
      box-shadow: 0 0 0 10px rgba(33, 150, 243, 0);
    }
    100% {
      transform: scale(0.95);
      box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
    }
  }
  @keyframes ainput-fade-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .ainput-thinking-gradient {
    background: linear-gradient(90deg, #62109F, #41A67E);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: bold;
  }
`;
document.head.appendChild(style);

const handleShortcut = async (action: "fixGrammar" | "translate") => {
  const element = activeInput;
  if (!element) return;

  let textToProcess = "";
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;

  const isInputElement =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement;

  if (isInputElement) {
    selectionStart = element.selectionStart;
    selectionEnd = element.selectionEnd;
    if (
      selectionStart !== null &&
      selectionEnd !== null &&
      selectionStart !== selectionEnd
    ) {
      textToProcess = element.value.substring(selectionStart, selectionEnd);
    }
  } else if (element.isContentEditable) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      textToProcess = selection.toString();
    }
  }

  if (!textToProcess.trim()) {
    // No text selected, do nothing.
    return;
  }

  element.dispatchEvent(new Event("ainput-loading-start"));

  try {
    const response = (await chrome.runtime.sendMessage({
      action,
      text: textToProcess,
    })) as unknown as MessageResponse;

    if (response && response.success && response.result) {
      if (isInputElement && selectionStart !== null && selectionEnd !== null) {
        const { value } = element;
        element.value =
          value.slice(0, selectionStart) +
          response.result +
          value.slice(selectionEnd);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (element.isContentEditable) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(response.result));
          element.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    } else {
      const errorMessage = response?.error || `Failed to ${action}`;
      if (
        errorMessage.includes("model") ||
        errorMessage.includes("API key") ||
        errorMessage.includes("options")
      ) {
        if (confirm(errorMessage + " Click OK to open settings.")) {
          chrome.runtime.sendMessage({ action: "openOptionsPage" });
        }
      } else {
        alert("Error: " + errorMessage);
      }
    }
  } catch (error) {
    const errorMessage = String(error);
    if (
      errorMessage.includes("model") ||
      errorMessage.includes("API key") ||
      errorMessage.includes("options")
    ) {
      if (confirm(errorMessage + " Click OK to open settings.")) {
        chrome.runtime.sendMessage({ action: "openOptionsPage" });
      }
    } else {
      alert("Error: " + errorMessage);
    }
  } finally {
    element.dispatchEvent(new Event("ainput-loading-end"));
  }
};

chrome.runtime.onMessage.addListener((message) => {
  if (
    message.action === "fixGrammarShortcut" ||
    message.action === "translateShortcut"
  ) {
    const action =
      message.action === "fixGrammarShortcut" ? "fixGrammar" : "translate";
    handleShortcut(action);
  }
});
