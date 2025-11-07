import React from "react";
import { createRoot } from "react-dom/client";
import { MdTranslate } from "react-icons/md";
import { MdAutoFixHigh } from "react-icons/md";

interface ButtonContainerProps {
  onFixGrammar: () => void;
  onTranslate: () => void;
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
  loading,
}) => {
  const [hoverFix, setHoverFix] = React.useState(false);
  const [hoverTranslate, setHoverTranslate] = React.useState(false);

  const buttonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 6px",
    backgroundColor: "transparent",
    color: "#333",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "400",
    textAlign: "left",
    transition: "background-color 0.2s",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "2px",
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
        <MdAutoFixHigh size={16} />
        <span style={{ whiteSpace: "nowrap" }}>{loading ? "Processing..." : "Fix Grammar"}</span>
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
        <MdTranslate size={16} />
        <span>{loading ? "Processing..." : "Translate"}</span>
      </button>
    </div>
  );
};

let activeInput: HTMLInputElement | HTMLTextAreaElement | null = null;
let accessoryContainer: HTMLDivElement | null = null;

const InputAccessory: React.FC<{
  inputElement: HTMLInputElement | HTMLTextAreaElement;
}> = ({ inputElement }) => {
  const [popoverVisible, setPopoverVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const accessoryRef = React.useRef<HTMLDivElement>(null);

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

  const handleAction = async (
    action: "fixGrammar" | "translate",
    element: HTMLInputElement | HTMLTextAreaElement
  ) => {
    const text = element.value;
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

      if (response && response.success) {
        element.value = response.result || text;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        alert("Error: " + (response?.error || `Failed to ${action}`));
      }
    } catch (error) {
      alert("Error: " + error);
    } finally {
      setLoading(false);
    }
  };

  const onFixGrammar = () => handleAction("fixGrammar", inputElement);
  const onTranslate = () => handleAction("translate", inputElement);

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
          backgroundColor: "#2196F3",
          borderRadius: "50%",
          cursor: "pointer",
          animation: loading ? "ainput-pulse 1.5s infinite" : "none",
        }}
      />
      {popoverVisible && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "0px",
            zIndex: 10000,
            background: "white",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            padding: "4px",
          }}
        >
          <ButtonContainer
            onFixGrammar={onFixGrammar}
            onTranslate={onTranslate}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};

function getCaretCoordinates(element: HTMLInputElement | HTMLTextAreaElement, position: number) {
  const isInput = element.tagName.toLowerCase() === "input";
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

  properties.forEach(prop => {
    style[prop as any] = computed[prop as any];
  });

  if (debug) {
    style.backgroundColor = "#aaa";
    style.position = 'absolute';
    style.top = `${element.offsetTop}px`;
    style.left = `${element.offsetLeft}px`;
  } else {
    style.position = "absolute";
    style.visibility = "hidden";
  }

  div.textContent = element.value.substring(0, position);

  if (isInput) {
    div.textContent = div.textContent.replace(/\s/g, "\u00a0");
  }

  const span = document.createElement("span");
  span.textContent = element.value.substring(position) || ".";
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth),
    height: span.offsetHeight
  };

  document.body.removeChild(div);

  return coordinates;
}


function positionAccessory(
  inputElement: HTMLInputElement | HTMLTextAreaElement,
  container: HTMLElement
) {
  const rect = inputElement.getBoundingClientRect();
  const caretPos = inputElement.selectionStart || 0;
  const coords = getCaretCoordinates(inputElement, caretPos);

  const top = window.scrollY + rect.top + coords.top - inputElement.scrollTop;
  const left = window.scrollX + rect.left + coords.left - inputElement.scrollLeft;

  container.style.position = "absolute";
  container.style.top = `${top}px`;
  container.style.left = `${left + 4}px`; // Add some offset to not overlap with cursor
  container.style.zIndex = "9999";
}

function showAccessoryFor(element: HTMLInputElement | HTMLTextAreaElement) {
  if (activeInput === element) return;

  hideAccessory();

  activeInput = element;
  accessoryContainer = document.createElement("div");
  document.body.appendChild(accessoryContainer);

  const root = createRoot(accessoryContainer);
  root.render(<InputAccessory inputElement={element} />);

  positionAccessory(element, accessoryContainer);

  const updatePosition = () => positionAccessory(element, accessoryContainer!);

  element.addEventListener("input", updatePosition);
  element.addEventListener("keyup", updatePosition);
  element.addEventListener("mousedown", updatePosition);
  element.addEventListener("scroll", updatePosition);
  window.addEventListener("resize", updatePosition);
}

function hideAccessory() {
  if (accessoryContainer) {
    document.body.removeChild(accessoryContainer);
    accessoryContainer = null;
  }
  activeInput = null;
}

document.addEventListener(
  "focusin",
  (event) => {
    const target = event.target as HTMLElement;
    if (
      target.tagName.toLowerCase() === "input" ||
      target.tagName.toLowerCase() === "textarea"
    ) {
      showAccessoryFor(target as HTMLInputElement | HTMLTextAreaElement);
    }
  },
  true
);

document.addEventListener(
  "focusout",
  (event) => {
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (
      !accessoryContainer ||
      !accessoryContainer.contains(relatedTarget)
    ) {
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
`;
document.head.appendChild(style);
