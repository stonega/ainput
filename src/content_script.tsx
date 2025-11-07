export {};

type AssistantMode = "grammar" | "translate";

type AssistantSettings = {
  targetLanguage: string;
};

const CONTROL_CLASS = "writing-assistant-controls";
const BUTTON_CLASS = "writing-assistant-button";
const STATUS_CLASS = "writing-assistant-status";
const DATA_ATTR = "data-writing-assistant-initialized";

const DEFAULT_SETTINGS: AssistantSettings = {
  targetLanguage: "Spanish",
};

let cachedSettings: AssistantSettings = { ...DEFAULT_SETTINGS };

const loadSettings = () =>
  new Promise<AssistantSettings>((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      const settings: AssistantSettings = {
        targetLanguage: items.targetLanguage || DEFAULT_SETTINGS.targetLanguage,
      };
      cachedSettings = settings;
      resolve(settings);
    });
  });

const watchSettingsChanges = () => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
      return;
    }
    if (changes.targetLanguage) {
      const newLanguage = changes.targetLanguage.newValue;
      if (typeof newLanguage === "string" && newLanguage.trim().length > 0) {
        cachedSettings.targetLanguage = newLanguage.trim();
      }
    }
  });
};

const createButton = (label: string, onClick: () => void) => {
  const button = document.createElement("button");
  button.className = BUTTON_CLASS;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
};

const createStatusElement = () => {
  const status = document.createElement("span");
  status.className = STATUS_CLASS;
  status.style.marginLeft = "0.5rem";
  status.style.fontSize = "0.85rem";
  status.style.color = "#555";
  return status;
};

const setStatus = (statusElement: HTMLElement, message: string, isError = false) => {
  statusElement.textContent = message;
  statusElement.style.color = isError ? "#b00020" : "#555";
};

const sendProcessingRequest = (mode: AssistantMode, text: string, targetLanguage: string) =>
  new Promise<string>((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "process-text",
        mode,
        text,
        targetLanguage,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || response.error) {
          reject(new Error(response?.error ?? "Unknown error"));
          return;
        }
        resolve(response.text);
      }
    );
  });

const enhanceInput = (input: HTMLTextAreaElement | HTMLInputElement) => {
  if (input.getAttribute(DATA_ATTR) === "true") {
    return;
  }

  input.setAttribute(DATA_ATTR, "true");

  const wrapper = document.createElement("div");
  wrapper.className = CONTROL_CLASS;
  wrapper.style.display = "flex";
  wrapper.style.flexWrap = "wrap";
  wrapper.style.gap = "0.5rem";
  wrapper.style.alignItems = "center";
  wrapper.style.marginTop = "0.5rem";

  const statusElement = createStatusElement();

  const disableControls = (buttons: HTMLButtonElement[], disabled: boolean) => {
    buttons.forEach((button) => {
      button.disabled = disabled;
      button.style.opacity = disabled ? "0.6" : "1";
      button.style.cursor = disabled ? "not-allowed" : "pointer";
    });
  };

  const buttons: HTMLButtonElement[] = [];

  const handleMode = async (mode: AssistantMode) => {
    const value = input.value.trim();
    if (!value) {
      setStatus(statusElement, "Enter some text first.", true);
      return;
    }

    const buttonLabel = mode === "grammar" ? "Fixing…" : "Translating…";
    const originalLabels = buttons.map((button) => button.textContent ?? "");
    buttons.forEach((button, index) => {
      if (
        (mode === "grammar" && button.textContent === "Fix Grammar") ||
        (mode === "translate" && button.textContent === "Translate")
      ) {
        button.textContent = buttonLabel;
      }
    });

    disableControls(buttons, true);
    setStatus(statusElement, "Contacting Gemini…");
    try {
      const result = await sendProcessingRequest(
        mode,
        input.value,
        cachedSettings.targetLanguage
      );
      if (mode === "translate") {
        input.value = result;
      } else {
        input.value = result;
      }
      setStatus(statusElement, "Done!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to process text.";
      setStatus(statusElement, message, true);
    } finally {
      disableControls(buttons, false);
      buttons.forEach((button, index) => {
        button.textContent = originalLabels[index];
      });
    }
  };

  const grammarButton = createButton("Fix Grammar", () => handleMode("grammar"));
  const translateButton = createButton("Translate", () => handleMode("translate"));

  buttons.push(grammarButton, translateButton);

  [grammarButton, translateButton].forEach((button) => {
    button.style.padding = "0.4rem 0.75rem";
    button.style.borderRadius = "6px";
    button.style.border = "1px solid #1a73e8";
    button.style.backgroundColor = "#1a73e8";
    button.style.color = "#fff";
    button.style.fontSize = "0.9rem";
    button.style.fontFamily = "inherit";
  });

  wrapper.appendChild(grammarButton);
  wrapper.appendChild(translateButton);
  wrapper.appendChild(statusElement);

  input.insertAdjacentElement("afterend", wrapper);
};

const isEnhanceableInput = (element: Element): element is HTMLInputElement | HTMLTextAreaElement => {
  if (element instanceof HTMLTextAreaElement) {
    return true;
  }
  if (element instanceof HTMLInputElement) {
    const type = element.type?.toLowerCase();
    return type === "text" || type === "search" || type === "email";
  }
  return false;
};

const scanForInputs = (root: ParentNode = document) => {
  const inputs = Array.from(
    root.querySelectorAll("textarea, input[type='text'], input[type='search'], input[type='email']")
  );
  inputs.forEach((element) => {
    if (isEnhanceableInput(element)) {
      enhanceInput(element);
    }
  });
};

const initialize = async () => {
  await loadSettings();
  watchSettingsChanges();
  scanForInputs();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (isEnhanceableInput(node)) {
            enhanceInput(node);
          } else {
            scanForInputs(node);
          }
        }
      });
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
          scanForInputs();
        }
      },
      { once: true }
    );
  }
};

initialize().catch((error) => {
  console.error("Failed to initialize writing assistant:", error);
});
