import React from "react";
import { createRoot } from "react-dom/client";

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

// Track processed inputs to avoid duplicate button containers
const processedInputs = new WeakSet<HTMLElement>();

function createButtonContainer(inputElement: HTMLInputElement | HTMLTextAreaElement) {
  if (processedInputs.has(inputElement)) {
    return;
  }
  processedInputs.add(inputElement);

  const container = document.createElement("div");
  container.className = "ai-text-enhancer-buttons";
  container.style.cssText = "margin: 0; padding: 0;";

  // Insert after the input element
  inputElement.parentNode?.insertBefore(container, inputElement.nextSibling);

  let loading = false;

  const updateUI = () => {
    root.render(
      <ButtonContainer
        onFixGrammar={() => handleFixGrammar(inputElement)}
        onTranslate={() => handleTranslate(inputElement)}
        loading={loading}
      />
    );
  };

  const root = createRoot(container);
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
      const response = await chrome.runtime.sendMessage({
        action: "fixGrammar",
        text: text,
      }) as unknown as MessageResponse;

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
      const response = await chrome.runtime.sendMessage({
        action: "translate",
        text: text,
      }) as unknown as MessageResponse;

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

// Function to process all text inputs and textareas
function processTextInputs() {
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[type="text"], input:not([type]), textarea'
  );
  
  inputs.forEach((input) => {
    // Skip if already processed or if it's too small or hidden
    if (processedInputs.has(input)) return;
    
    const style = window.getComputedStyle(input);
    if (style.display === "none" || style.visibility === "hidden") return;
    
    createButtonContainer(input);
  });
}

// Initial processing
processTextInputs();

// Watch for dynamically added inputs
const observer = new MutationObserver((mutations) => {
  processTextInputs();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
