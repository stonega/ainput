import React from "react";
import { createRoot, Root } from "react-dom/client";

const DISABLED_SITES_KEY = "disabledSites";
const CURRENT_ORIGIN = window.location.origin;

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
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        marginTop: "4px",
        marginBottom: "4px",
      }}
    >
      <button
        onClick={onFixGrammar}
        disabled={loading}
        style={{
          padding: "6px 12px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "12px",
          fontWeight: "500",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Processing..." : "Fix Grammar"}
      </button>
      <button
        onClick={onTranslate}
        disabled={loading}
        style={{
          padding: "6px 12px",
          backgroundColor: "#2196F3",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "12px",
          fontWeight: "500",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Processing..." : "Translate"}
      </button>
    </div>
  );
};

let isEnabled = false;
let processedInputs = new WeakSet<HTMLElement>();
let observer: MutationObserver | null = null;
const containerRoots = new WeakMap<HTMLElement, Root>();

function removeButtonContainers() {
  document
    .querySelectorAll<HTMLElement>(".ai-text-enhancer-buttons")
    .forEach((node) => {
      const root = containerRoots.get(node);
      root?.unmount();
      containerRoots.delete(node);
      node.remove();
    });
}

function ensureObserver() {
  if (observer) {
    return;
  }

  if (!document.body) {
    window.addEventListener(
      "DOMContentLoaded",
      () => {
        if (!observer && isEnabled) {
          ensureObserver();
          processTextInputs();
        }
      },
      { once: true }
    );
    return;
  }

  observer = new MutationObserver(() => {
    if (!isEnabled) {
      return;
    }
    processTextInputs();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function setExtensionEnabled(enabled: boolean) {
  if (isEnabled === enabled) {
    if (enabled) {
      ensureObserver();
      processTextInputs();
    }
    return;
  }

  isEnabled = enabled;

  if (enabled) {
    processedInputs = new WeakSet();
    ensureObserver();
    processTextInputs();
  } else {
    observer?.disconnect();
    observer = null;
    removeButtonContainers();
    processedInputs = new WeakSet();
  }
}

function initializeExtensionState() {
  chrome.storage.sync.get([DISABLED_SITES_KEY], (items) => {
    const disabledSites: string[] = items[DISABLED_SITES_KEY] || [];
    const shouldEnable = !disabledSites.includes(CURRENT_ORIGIN);
    setExtensionEnabled(shouldEnable);
  });
}

function createButtonContainer(inputElement: HTMLInputElement | HTMLTextAreaElement) {
  if (!isEnabled || processedInputs.has(inputElement)) {
    return;
  }
  processedInputs.add(inputElement);

  const container = document.createElement("div");
  container.className = "ai-text-enhancer-buttons";
  container.style.cssText = "margin: 0; padding: 0;";

  // Insert after the input element
  inputElement.parentNode?.insertBefore(container, inputElement.nextSibling);

  let loading = false;

  const root = createRoot(container);
  containerRoots.set(container, root);

  const updateUI = () => {
    if (!isEnabled) {
      return;
    }
    root.render(
      <ButtonContainer
        onFixGrammar={() => handleFixGrammar(inputElement)}
        onTranslate={() => handleTranslate(inputElement)}
        loading={loading}
      />
    );
  };

  updateUI();

  async function handleFixGrammar(element: HTMLInputElement | HTMLTextAreaElement) {
    const text = element.value;
    if (!text.trim()) {
      alert("Please enter some text first.");
      return;
    }

    loading = true;
    updateUI();

    try {
      const response = (await chrome.runtime.sendMessage({
        action: "fixGrammar",
        text: text,
      })) as unknown as MessageResponse;

      if (response && response.success) {
        element.value = response.result || text;
        // Trigger input event so the page knows the value changed
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        alert("Error: " + (response?.error || "Failed to fix grammar"));
      }
    } catch (error) {
      alert("Error: " + error);
    } finally {
      loading = false;
      updateUI();
    }
  }

  async function handleTranslate(element: HTMLInputElement | HTMLTextAreaElement) {
    const text = element.value;
    if (!text.trim()) {
      alert("Please enter some text first.");
      return;
    }

    loading = true;
    updateUI();

    try {
      const response = (await chrome.runtime.sendMessage({
        action: "translate",
        text: text,
      })) as unknown as MessageResponse;

      if (response && response.success) {
        element.value = response.result || text;
        // Trigger input event so the page knows the value changed
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        alert("Error: " + (response?.error || "Failed to translate"));
      }
    } catch (error) {
      alert("Error: " + error);
    } finally {
      loading = false;
      updateUI();
    }
  }
}

function processTextInputs() {
  if (!isEnabled) {
    return;
  }

  const inputs =
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[type="text"], input:not([type]), textarea'
    );

  inputs.forEach((input) => {
    if (processedInputs.has(input)) return;

    const style = window.getComputedStyle(input);
    if (style.display === "none" || style.visibility === "hidden") return;

    createButtonContainer(input);
  });
}

initializeExtensionState();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "setExtensionEnabled") {
    setExtensionEnabled(Boolean(message.enabled));
    sendResponse({ success: true });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[DISABLED_SITES_KEY]) {
    return;
  }

  const newValue: string[] = changes[DISABLED_SITES_KEY].newValue || [];
  const shouldEnable = !newValue.includes(CURRENT_ORIGIN);
  setExtensionEnabled(shouldEnable);
});
