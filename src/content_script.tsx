import React from "react";
import { createRoot } from "react-dom/client";
import {
  MdTranslate,
  MdAutoFixHigh,
  MdHourglassEmpty,
  MdAutoAwesome,
  MdReply,
  MdDynamicForm,
} from "react-icons/md";
import { Readability } from "@mozilla/readability";
import {
  EditableElement,
  getXEditorRoot,
  getRedditEditorRoot,
  getElementValue,
  setElementValue,
} from "./siteExceptions";

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
  onAutoFillForm: () => void;
  loading: boolean;
}

interface MessageResponse {
  success: boolean;
  result?: string;
  error?: string;
}

// Streaming message types from background
interface StreamMessage {
  type: "chunk" | "done" | "error";
  chunk?: string;
  error?: string;
}

// Helper function to make streaming requests via port
function streamRequest(
  action: string,
  data: { text?: string; pageContent?: string },
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): () => void {
  const port = chrome.runtime.connect({ name: "ainput-stream" });

  port.onMessage.addListener((message: StreamMessage) => {
    switch (message.type) {
      case "chunk":
        if (message.chunk) {
          onChunk(message.chunk);
        }
        break;
      case "done":
        onDone();
        port.disconnect();
        break;
      case "error":
        onError(message.error || "Unknown error");
        port.disconnect();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      onError(chrome.runtime.lastError.message || "Connection lost");
    }
  });

  port.postMessage({ action, ...data });

  // Return cleanup function
  return () => {
    try {
      port.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  };
}

const ButtonContainer: React.FC<ButtonContainerProps> = ({
  onFixGrammar,
  onTranslate,
  onEnhancePrompt,
  onAutoReply,
  onAutoFillForm,
  loading,
}) => {
  const [hoverFix, setHoverFix] = React.useState(false);
  const [hoverTranslate, setHoverTranslate] = React.useState(false);
  const [hoverEnhance, setHoverEnhance] = React.useState(false);
  const [hoverAutoReply, setHoverAutoReply] = React.useState(false);
  const [hoverAutoFill, setHoverAutoFill] = React.useState(false);

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
      <button
        onClick={onAutoFillForm}
        disabled={loading}
        onMouseEnter={() => setHoverAutoFill(true)}
        onMouseLeave={() => setHoverAutoFill(false)}
        style={{
          ...buttonStyle,
          backgroundColor: hoverAutoFill ? "#f0f0f0" : "transparent",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <MdDynamicForm size={16} color="#9333EA" />
        <span style={{ whiteSpace: "nowrap" }}>Auto Fill Form</span>
      </button>
    </div>
  );
};

/**
 * Form field detection and auto-fill logic
 */

interface FormFieldInfo {
  id: string;
  name: string;
  type: string;
  label: string;
  placeholder: string;
  autocomplete: string;
}

interface FormFillResponse {
  success: boolean;
  result?: Record<string, string>;
  error?: string;
}

const detectFormFieldType = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string => {
  const name = (element.name || "").toLowerCase();
  const id = (element.id || "").toLowerCase();
  const type = element.type?.toLowerCase() || "";
  const placeholder = ('placeholder' in element ? element.placeholder : "") || "";
  const autocomplete = element.autocomplete?.toLowerCase() || "";
  
  // Check autocomplete attribute first (most reliable)
  if (autocomplete) {
    if (autocomplete.includes("given-name") || autocomplete.includes("first-name")) return "firstName";
    if (autocomplete.includes("family-name") || autocomplete.includes("last-name")) return "lastName";
    if (autocomplete.includes("name")) return "fullName";
    if (autocomplete.includes("email")) return "email";
    if (autocomplete.includes("tel")) return "phone";
    if (autocomplete.includes("street-address") || autocomplete.includes("address-line")) return "address";
    if (autocomplete.includes("postal-code") || autocomplete.includes("zip")) return "zipCode";
    if (autocomplete.includes("address-level2") || autocomplete.includes("city")) return "city";
    if (autocomplete.includes("address-level1") || autocomplete.includes("state")) return "state";
    if (autocomplete.includes("country")) return "country";
    if (autocomplete.includes("organization") || autocomplete.includes("company")) return "company";
    if (autocomplete.includes("username")) return "username";
    if (autocomplete.includes("bday")) return "birthdate";
    if (autocomplete.includes("url") || autocomplete.includes("website")) return "website";
  }
  
  // Check input type
  if (type === "email") return "email";
  if (type === "tel") return "phone";
  if (type === "url") return "website";
  if (type === "date") return "date";
  if (type === "number") return "number";
  
  // Check name/id/placeholder patterns
  const combined = `${name} ${id} ${placeholder}`;
  
  if (/first.?name|fname|given.?name/i.test(combined)) return "firstName";
  if (/last.?name|lname|surname|family.?name/i.test(combined)) return "lastName";
  if (/full.?name|name/i.test(combined) && !/user/i.test(combined)) return "fullName";
  if (/e.?mail/i.test(combined)) return "email";
  if (/phone|tel|mobile|cell/i.test(combined)) return "phone";
  if (/address|street/i.test(combined) && !/email/i.test(combined)) return "address";
  if (/city|town/i.test(combined)) return "city";
  if (/state|province|region/i.test(combined)) return "state";
  if (/zip|postal|postcode/i.test(combined)) return "zipCode";
  if (/country/i.test(combined)) return "country";
  if (/company|organization|org|employer/i.test(combined)) return "company";
  if (/job|title|position|role/i.test(combined)) return "jobTitle";
  if (/user.?name|login/i.test(combined)) return "username";
  if (/birth|dob|birthday/i.test(combined)) return "birthdate";
  if (/website|url|homepage/i.test(combined)) return "website";
  if (/bio|about|description|summary/i.test(combined)) return "bio";
  if (/message|comment|note|feedback/i.test(combined)) return "message";
  
  return "text";
};

const getFormFieldLabel = (element: HTMLElement): string => {
  // Try to find associated label
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() || "";
  }
  
  // Check for parent label
  const parentLabel = element.closest("label");
  if (parentLabel) {
    // Get text content but exclude the input itself
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll("input, textarea, select");
    inputs.forEach((input) => input.remove());
    return clone.textContent?.trim() || "";
  }
  
  // Check for nearby label-like elements
  const parent = element.parentElement;
  if (parent) {
    const label = parent.querySelector("label, .label, [class*='label']");
    if (label && label !== element) return label.textContent?.trim() || "";
  }
  
  return "";
};

const getFormFields = (element: HTMLElement): FormFieldInfo[] => {
  // Find the form that contains this element, or use the document
  const form = element.closest("form") || document;
  
  const formFields: FormFieldInfo[] = [];
  const inputs = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="password"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select'
  );
  
  inputs.forEach((input, index) => {
    // Skip if already filled
    if (input.value && input.value.trim()) return;
    
    // Skip if disabled or readonly
    if (input.disabled || ('readOnly' in input && input.readOnly)) return;
    
    const fieldInfo: FormFieldInfo = {
      id: input.id || `field_${index}`,
      name: input.name || input.id || `field_${index}`,
      type: detectFormFieldType(input),
      label: getFormFieldLabel(input),
      placeholder: ('placeholder' in input ? input.placeholder : "") || "",
      autocomplete: input.autocomplete || "",
    };
    
    formFields.push(fieldInfo);
  });
  
  return formFields;
};

const fillFormFields = (fields: FormFieldInfo[], values: Record<string, string>) => {
  fields.forEach((field) => {
    const value = values[field.name] || values[field.id];
    if (!value) return;
    
    // Find the element
    let element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
    
    if (field.id && field.id !== `field_${fields.indexOf(field)}`) {
      element = document.getElementById(field.id) as any;
    }
    
    if (!element && field.name) {
      element = document.querySelector(`[name="${field.name}"]`) as any;
    }
    
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
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

  const handleAction = (
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
    
    // Clear the element and prepare for streaming
    setElementValue(element, "");
    let streamedText = "";

    streamRequest(
      action,
      { text },
      // onChunk - append chunk to element
      (chunk) => {
        streamedText += chunk;
        setElementValue(element, streamedText);
      },
      // onDone
      () => {
        setLoading(false);
      },
      // onError
      (errorMessage) => {
        // Restore original text on error
        setElementValue(element, text);
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
    );
  };

  const onFixGrammar = () => handleAction("fixGrammar", inputElement);
  const onTranslate = () => handleAction("translate", inputElement);
  const onEnhancePrompt = () => handleAction("enhancePrompt", inputElement);

  const onAutoReply = () => {
    setPopoverVisible(false);
    setLoading(true);

    const documentClone = document.cloneNode(true) as Document;
    const article = new Readability(documentClone).parse();
    const pageContent = article?.textContent?.slice(0, 4000) || "";

    // Clear the element and prepare for streaming
    setElementValue(inputElement, "");
    let streamedText = "";

    streamRequest(
      "autoReply",
      { pageContent },
      // onChunk - append chunk to element
      (chunk) => {
        streamedText += chunk;
        setElementValue(inputElement, streamedText);
      },
      // onDone
      () => {
        setLoading(false);
      },
      // onError
      (errorMessage) => {
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
    );
  };

  const onAutoFillForm = async () => {
    setPopoverVisible(false);
    setLoading(true);

    try {
      const formFields = getFormFields(inputElement);
      
      if (formFields.length === 0) {
        alert("No empty form fields found to fill.");
        setLoading(false);
        return;
      }

      const response = (await chrome.runtime.sendMessage({
        action: "autoFillForm",
        fields: formFields,
      })) as unknown as FormFillResponse;

      if (response && response.success && response.result) {
        fillFormFields(formFields, response.result);
      } else {
        const errorMessage = response?.error || "Failed to auto fill form";
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
      setLoading(false);
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
            onAutoFillForm={onAutoFillForm}
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
          
          // Use streaming for auto-reply on focus
          let streamedText = "";
          streamRequest(
            "autoReply",
            { pageContent },
            // onChunk
            (chunk) => {
              streamedText += chunk;
              setElementValue(target, streamedText);
            },
            // onDone
            () => {
              target.dispatchEvent(new Event("ainput-loading-end"));
            },
            // onError
            (errorMessage) => {
              console.error("AInput Auto Reply Error:", errorMessage);
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

const handleShortcut = (action: "fixGrammar" | "translate") => {
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
  
  // Store original values for potential restoration and streaming replacement
  const originalValue = isInputElement ? element.value : "";
  let streamedText = "";

  streamRequest(
    action,
    { text: textToProcess },
    // onChunk - replace selected text with streamed content
    (chunk) => {
      streamedText += chunk;
      if (isInputElement && selectionStart !== null && selectionEnd !== null) {
        element.value =
          originalValue.slice(0, selectionStart) +
          streamedText +
          originalValue.slice(selectionEnd);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (element.isContentEditable) {
        // For contentEditable, we update the full content incrementally
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(streamedText));
          // Collapse selection to end
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    // onDone
    () => {
      element.dispatchEvent(new Event("ainput-loading-end"));
    },
    // onError
    (errorMessage) => {
      // Restore original text on error
      if (isInputElement) {
        element.value = originalValue;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
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
      element.dispatchEvent(new Event("ainput-loading-end"));
    }
  );
};

const handleAutoFillFormShortcut = async () => {
  const element = activeInput || document.activeElement;
  if (!element || !(element instanceof HTMLElement)) return;

  const formFields = getFormFields(element);
  
  if (formFields.length === 0) {
    alert("No empty form fields found to fill.");
    return;
  }

  // Dispatch loading event if we have an active input
  if (activeInput) {
    activeInput.dispatchEvent(new Event("ainput-loading-start"));
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      action: "autoFillForm",
      fields: formFields,
    })) as unknown as FormFillResponse;

    if (response && response.success && response.result) {
      fillFormFields(formFields, response.result);
    } else {
      const errorMessage = response?.error || "Failed to auto fill form";
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
    if (activeInput) {
      activeInput.dispatchEvent(new Event("ainput-loading-end"));
    }
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
  } else if (message.action === "autoFillFormShortcut") {
    handleAutoFillFormShortcut();
  }
});
