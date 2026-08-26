import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  FaArrowLeft,
  FaArrowRight,
  FaGithub,
  FaTrash,
  FaPlus,
  FaRobot,
  FaCog,
  FaChartBar,
  FaCheckCircle,
  FaEdit,
  FaDownload,
  FaExclamationCircle,
  FaMicrochip,
  FaSave,
  FaTimes,
  FaStar,
  FaBolt,
  FaSyncAlt,
} from "react-icons/fa";
import { getTokenUsage } from "./db";
import { theme, GlobalStyles } from "./theme";
import {
  ChromeAIAvailability,
  getChromeAIAvailability,
  setupChromeAI,
} from "./chrome-ai";
import {
  CustomAction,
  CustomActionInputSource,
  CUSTOM_ACTION_INPUT_TOKEN,
  MAX_CUSTOM_ACTIONS,
  normalizeCustomActions,
  validateCustomActions,
} from "./custom-actions";
import {
  FALLBACK_OPENROUTER_FREE_MODEL,
  fetchOpenRouterFreeModel,
  LEGACY_OPENROUTER_FREE_MODEL_IDS,
  OPENROUTER_FREE_MODEL_ID,
  OpenRouterFreeModelMetadata,
} from "./openrouter-models";

// --- Types ---

const FREE_OPENROUTER_API_KEY = process.env.FREE_OPENROUTER_API_KEY || "";

type ConfigurableModelType =
  | "gemini"
  | "openai"
  | "openrouter"
  | "deepseek"
  | "custom";
type ModelType = ConfigurableModelType | "chrome";

interface Model {
  id: string;
  name: string;
  apiKey: string;
  type: ModelType;
  baseUrl?: string;
  model?: string;
}

interface TokenUsage {
  id?: number;
  date: string;
  model: string;
  kind: string;
  tokens: number;
}

type CustomActionDraft = Pick<CustomAction, "name" | "prompt" | "inputSource">;

const createEmptyCustomActionDraft = (): CustomActionDraft => ({
  name: "",
  prompt: "",
  inputSource: "input",
});

const CHROME_AI_MODEL_ID = "chrome-built-in-ai";
const CHROME_AI_MODEL: Model = {
  id: CHROME_AI_MODEL_ID,
  name: "Chrome Built-in AI",
  apiKey: "",
  type: "chrome",
  model: "gemini-nano",
};

const createOpenRouterFreeModel = (
  metadata: OpenRouterFreeModelMetadata = FALLBACK_OPENROUTER_FREE_MODEL
): Model => ({
  id: OPENROUTER_FREE_MODEL_ID,
  name: metadata.name,
  apiKey: FREE_OPENROUTER_API_KEY,
  type: "openrouter",
  baseUrl: "https://openrouter.ai/api",
  model: metadata.model,
});

const isManagedOpenRouterFreeModel = (modelId: string): boolean =>
  modelId === OPENROUTER_FREE_MODEL_ID ||
  LEGACY_OPENROUTER_FREE_MODEL_IDS.has(modelId);

const reconcileOpenRouterFreeModel = (
  models: Model[],
  activeModelId: string | null,
  refreshedMetadata: OpenRouterFreeModelMetadata | null
): {
  models: Model[];
  activeModelId: string | null;
  changed: boolean;
} => {
  const firstManagedIndex = models.findIndex((model) =>
    isManagedOpenRouterFreeModel(model.id)
  );
  if (firstManagedIndex === -1) {
    return { models, activeModelId, changed: false };
  }

  const existingManagedModel = models.find(
    (model) => model.id === OPENROUTER_FREE_MODEL_ID
  );
  const managedModel = refreshedMetadata
    ? createOpenRouterFreeModel(refreshedMetadata)
    : existingManagedModel || createOpenRouterFreeModel();
  const reconciledModels = models.filter(
    (model) => !isManagedOpenRouterFreeModel(model.id)
  );
  reconciledModels.splice(firstManagedIndex, 0, managedModel);

  const reconciledActiveModelId =
    activeModelId && isManagedOpenRouterFreeModel(activeModelId)
      ? OPENROUTER_FREE_MODEL_ID
      : activeModelId;

  return {
    models: reconciledModels,
    activeModelId: reconciledActiveModelId,
    changed:
      JSON.stringify(reconciledModels) !== JSON.stringify(models) ||
      reconciledActiveModelId !== activeModelId,
  };
};

const MODEL_PROVIDERS: Array<{
  value: ConfigurableModelType;
  label: string;
}> = [
  { value: "gemini", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "custom", label: "Custom (OpenAI Compatible)" },
];

const getBaseUrlForProvider = (
  type: ModelType,
  currentBaseUrl = ""
): string | undefined => {
  if (type === "openai") return "https://api.openai.com";
  if (type === "openrouter") return "https://openrouter.ai/api";
  if (type === "deepseek") return "https://api.deepseek.com";
  if (type === "custom") {
    const isKnownProviderUrl =
      currentBaseUrl === "https://api.openai.com" ||
      currentBaseUrl === "https://openrouter.ai/api" ||
      currentBaseUrl === "https://api.deepseek.com";
    return isKnownProviderUrl ? "" : currentBaseUrl;
  }
  return undefined;
};

const normalizeModel = (model: Model): Model => ({
  ...model,
  name: model.name.trim(),
  apiKey: model.type === "chrome" ? "" : model.apiKey.trim(),
  baseUrl: getBaseUrlForProvider(model.type, model.baseUrl?.trim()),
  model:
    model.type === "chrome"
      ? "gemini-nano"
      : model.model?.trim() ||
        (model.type === "gemini"
          ? "gemini-2.5-flash"
          : model.type === "deepseek"
          ? "deepseek-v4-pro"
          : ""),
});

const validateModel = (model: Model): string | null => {
  if (!model.name) return "Model name is required.";
  if (model.type === "chrome") return null;
  if (!model.apiKey) return "API key is required.";
  if (!model.model) return "Model ID is required.";

  if (model.type === "custom") {
    if (!model.baseUrl) return "Base URL is required for custom models.";

    try {
      const url = new URL(model.baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "Base URL must use HTTP or HTTPS.";
      }
    } catch {
      return "Enter a valid Base URL.";
    }
  }

  return null;
};

const setSyncStorage = (items: Record<string, unknown>): Promise<void> =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(
            chrome.runtime.lastError.message || "Unable to save settings."
          )
        );
        return;
      }
      resolve();
    });
  });

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="input-focus transition-all"
    style={{
      width: "100%",
      padding: "10px 12px",
      fontSize: "14px",
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      ...props.style,
    }}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className="input-focus transition-all"
    style={{
      width: "100%",
      padding: "10px 12px",
      fontSize: "14px",
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      ...props.style,
    }}
  >
    {props.children}
  </select>
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className="input-focus transition-all"
    style={{
      width: "100%",
      minHeight: "132px",
      resize: "vertical",
      padding: "10px 12px",
      fontFamily: "inherit",
      fontSize: "14px",
      lineHeight: 1.5,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      ...props.style,
    }}
  />
);

const Button = ({
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger";
}) => (
  <button
    {...props}
    className={`transition-all btn-${variant}`}
    style={{
      padding: "10px 20px",
      backgroundColor:
        variant === "primary" ? theme.colors.primary : "transparent",
      color: variant === "primary" ? "#fff" : theme.colors.danger,
      border:
        variant === "danger" ? `1px solid ${theme.colors.danger}` : "none",
      borderRadius: theme.borderRadius.md,
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 600,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      opacity: props.disabled ? 0.6 : 1,
      ...props.style,
    }}
  />
);

export const Options = () => {
  // --- State ---
  const [models, setModels] = useState<Model[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"models" | "settings" | "usage">(
    "models"
  );

  const [newModelType, setNewModelType] =
    useState<ConfigurableModelType>("gemini");
  const [newModelName, setNewModelName] = useState<string>("");
  const [newModelApiKey, setNewModelApiKey] = useState<string>("");
  const [newModelBaseUrl, setNewModelBaseUrl] = useState<string>("");
  const [newModelString, setNewModelString] = useState<string>("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [refreshingOpenRouterFreeModel, setRefreshingOpenRouterFreeModel] =
    useState(false);
  const [chromeAIAvailability, setChromeAIAvailability] = useState<
    ChromeAIAvailability | "checking"
  >("checking");
  const [chromeAISetupInProgress, setChromeAISetupInProgress] = useState(false);
  const [chromeAIDownloadProgress, setChromeAIDownloadProgress] = useState<
    number | null
  >(null);

  const [targetLanguage, setTargetLanguage] = useState<string>("English");
  const [settingsStatus, setSettingsStatus] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [disabledSites, setDisabledSites] = useState<string[]>([]);
  const [customActions, setCustomActions] = useState<CustomAction[]>([]);
  const [customActionDraft, setCustomActionDraft] = useState<CustomActionDraft>(
    createEmptyCustomActionDraft
  );
  const [editingCustomActionId, setEditingCustomActionId] = useState<
    string | null
  >(null);

  const [usageData, setUsageData] = useState<TokenUsage[]>([]);
  const [usagePage, setUsagePage] = useState<number>(1);
  const [usageTotal, setUsageTotal] = useState<number>(0);
  const usagePageSize = 10;

  // --- Effects ---
  useEffect(() => {
    let cancelled = false;

    chrome.storage.sync.get(
      {
        apiKey: "", // For migration
        models: [],
        activeModelId: null,
        modelsInitialized: false,
        targetLanguage: "English",
        disabledSites: [],
        customActions: [],
      },
      async (items) => {
        const originalStoredModels = Array.isArray(items.models)
          ? (items.models as Model[])
          : [];
        const shouldRefreshOpenRouterFreeModel =
          (!items.modelsInitialized && originalStoredModels.length === 0) ||
          originalStoredModels.some((model) =>
            isManagedOpenRouterFreeModel(model.id)
          );
        const [availability, refreshedFreeModelMetadata] = await Promise.all([
          getChromeAIAvailability().catch(
            (): ChromeAIAvailability => "unsupported"
          ),
          shouldRefreshOpenRouterFreeModel
            ? fetchOpenRouterFreeModel()
            : Promise.resolve(null),
        ]);

        if (cancelled) return;
        setChromeAIAvailability(availability);

        if (originalStoredModels.length > 0) {
          const reconciled = reconcileOpenRouterFreeModel(
            originalStoredModels,
            typeof items.activeModelId === "string"
              ? items.activeModelId
              : null,
            refreshedFreeModelMetadata
          );
          const storedModels = reconciled.models;
          const storedActiveModelExists = storedModels.some(
            (model) => model.id === reconciled.activeModelId
          );
          const storedActiveModel = storedModels.find(
            (model) => model.id === reconciled.activeModelId
          );
          const chromeAINotReady =
            storedActiveModel?.type === "chrome" &&
            availability !== "available";
          const fallbackModel = storedModels.find(
            (model) => model.type !== "chrome"
          );
          const nextActiveModelId = chromeAINotReady
            ? fallbackModel?.id || null
            : storedActiveModelExists
            ? reconciled.activeModelId
            : storedModels[0].id;

          setModels(storedModels);
          setActiveModelId(nextActiveModelId);

          if (
            reconciled.changed ||
            !items.modelsInitialized ||
            !storedActiveModelExists ||
            chromeAINotReady
          ) {
            const storageUpdates: Record<string, unknown> = {
              modelsInitialized: true,
              activeModelId: nextActiveModelId,
            };
            if (reconciled.changed) {
              storageUpdates.models = storedModels;
            }
            chrome.storage.sync.set(storageUpdates);
          }
        } else if (!items.modelsInitialized) {
          const freeModel = createOpenRouterFreeModel(
            refreshedFreeModelMetadata || FALLBACK_OPENROUTER_FREE_MODEL
          );
          const canOfferChromeAI =
            availability !== "unsupported" && availability !== "unavailable";
          const initialModels = canOfferChromeAI
            ? [{ ...CHROME_AI_MODEL }, freeModel]
            : [freeModel];
          const initialActiveId =
            availability === "available" ? CHROME_AI_MODEL_ID : freeModel.id;

          setModels(initialModels);
          setActiveModelId(initialActiveId);
          chrome.storage.sync.set({
            models: initialModels,
            activeModelId: initialActiveId,
            modelsInitialized: true,
            apiKey: "",
          });
        } else {
          setModels([]);
          setActiveModelId(null);
        }

        setTargetLanguage(items.targetLanguage);
        setDisabledSites(items.disabledSites);
        setCustomActions(normalizeCustomActions(items.customActions));
        setModelsLoaded(true);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab === "usage") {
      loadUsageData();
    }
  }, [activeTab, usagePage]);

  // --- Actions ---

  const showStatus = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setSettingsStatus({ message, type });
    setTimeout(() => setSettingsStatus(null), 3000);
  };

  const loadUsageData = async () => {
    const { data, total } = await getTokenUsage(usagePage, usagePageSize);
    setUsageData(data);
    setUsageTotal(total);
  };

  const saveGeneralSettings = () => {
    chrome.storage.sync.set({ targetLanguage }, () => {
      showStatus("Settings saved successfully!");
    });
  };

  const addModel = () => {
    const newModel = normalizeModel({
      id: `model-${Date.now()}`,
      name: newModelName,
      apiKey: newModelApiKey,
      type: newModelType,
      baseUrl: newModelBaseUrl,
      model: newModelString,
    });

    const validationError = validateModel(newModel);
    if (validationError) {
      showStatus(validationError, "error");
      return;
    }

    const updatedModels = [...models, newModel];
    setModels(updatedModels);

    if (models.length === 0) {
      setActiveModelId(newModel.id);
      chrome.storage.sync.set({
        models: updatedModels,
        activeModelId: newModel.id,
        modelsInitialized: true,
      });
    } else {
      chrome.storage.sync.set({
        models: updatedModels,
        modelsInitialized: true,
      });
    }

    setNewModelName("");
    setNewModelApiKey("");
    setNewModelBaseUrl("");
    setNewModelString("");
    showStatus("Model added successfully!");
  };

  const startEditingModel = (model: Model) => {
    if (model.id === OPENROUTER_FREE_MODEL_ID) return;

    setEditingModelId(model.id);
    setEditingModel({ ...model });
  };

  const cancelEditingModel = () => {
    setEditingModelId(null);
    setEditingModel(null);
  };

  const updateEditingModel = (updates: Partial<Model>) => {
    setEditingModel((currentModel) =>
      currentModel ? { ...currentModel, ...updates } : currentModel
    );
  };

  const saveEditedModel = () => {
    if (!editingModel || editingModel.id === OPENROUTER_FREE_MODEL_ID) return;

    const normalizedModel = normalizeModel(editingModel);
    const validationError = validateModel(normalizedModel);
    if (validationError) {
      showStatus(validationError, "error");
      return;
    }

    const updatedModels = models.map((model) =>
      model.id === normalizedModel.id ? normalizedModel : model
    );

    chrome.storage.sync.set(
      { models: updatedModels, modelsInitialized: true },
      () => {
        if (chrome.runtime.lastError) {
          showStatus(
            chrome.runtime.lastError.message || "Unable to save the model.",
            "error"
          );
          return;
        }

        setModels(updatedModels);
        cancelEditingModel();
        showStatus("Model updated successfully!");
      }
    );
  };

  const refreshOpenRouterFreeModel = async () => {
    if (refreshingOpenRouterFreeModel) return;

    setRefreshingOpenRouterFreeModel(true);
    try {
      const refreshedMetadata = await fetchOpenRouterFreeModel();
      if (!refreshedMetadata) {
        showStatus(
          "Unable to refresh OpenRouter Free. Try again later.",
          "error"
        );
        return;
      }

      const refreshedModel = createOpenRouterFreeModel(refreshedMetadata);
      const updatedModels = models.map((model) =>
        model.id === OPENROUTER_FREE_MODEL_ID ? refreshedModel : model
      );

      await setSyncStorage({
        models: updatedModels,
        modelsInitialized: true,
      });
      setModels(updatedModels);
      cancelEditingModel();
      showStatus("OpenRouter Free refreshed successfully!");
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Unable to refresh OpenRouter Free.",
        "error"
      );
    } finally {
      setRefreshingOpenRouterFreeModel(false);
    }
  };

  const enableChromeAI = async () => {
    if (chromeAISetupInProgress) return;

    setChromeAISetupInProgress(true);
    setChromeAIDownloadProgress(null);

    try {
      await setupChromeAI((progress) => {
        setChromeAIDownloadProgress(Math.max(0, Math.min(1, progress)));
      });

      const chromeModelConfigured = models.some(
        (model) => model.id === CHROME_AI_MODEL_ID
      );
      const updatedModels = chromeModelConfigured
        ? models
        : [{ ...CHROME_AI_MODEL }, ...models];

      await setSyncStorage({
        models: updatedModels,
        activeModelId: CHROME_AI_MODEL_ID,
        modelsInitialized: true,
      });

      setModels(updatedModels);
      setActiveModelId(CHROME_AI_MODEL_ID);
      setChromeAIAvailability("available");
      setChromeAIDownloadProgress(1);
      showStatus("Chrome Built-in AI is ready to use!");
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Unable to set up Chrome Built-in AI.",
        "error"
      );
    } finally {
      setChromeAISetupInProgress(false);
    }
  };

  const deleteModel = (id: string) => {
    const updatedModels = models.filter((model) => model.id !== id);
    setModels(updatedModels);

    let newActiveModelId = activeModelId;
    if (activeModelId === id) {
      newActiveModelId = updatedModels.length > 0 ? updatedModels[0].id : null;
      setActiveModelId(newActiveModelId);
    }

    if (editingModelId === id) {
      cancelEditingModel();
    }

    chrome.storage.sync.set({
      models: updatedModels,
      activeModelId: newActiveModelId,
      modelsInitialized: true,
    });
    showStatus("Model deleted successfully!");
  };

  const handleSetActiveModel = (id: string) => {
    const selectedModel = models.find((model) => model.id === id);
    if (
      selectedModel?.type === "chrome" &&
      chromeAIAvailability !== "available"
    ) {
      void enableChromeAI();
      return;
    }

    setActiveModelId(id);
    chrome.storage.sync.set({ activeModelId: id });
  };

  const removeSite = (siteToRemove: string) => {
    const updatedSites = disabledSites.filter((site) => site !== siteToRemove);
    chrome.storage.sync.set({ disabledSites: updatedSites }, () => {
      setDisabledSites(updatedSites);
      showStatus(`Removed ${siteToRemove} from disabled list.`);
    });
  };

  const resetCustomActionEditor = () => {
    setEditingCustomActionId(null);
    setCustomActionDraft(createEmptyCustomActionDraft());
  };

  const saveCustomAction = async () => {
    const action: CustomAction = {
      id:
        editingCustomActionId ||
        `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: customActionDraft.name.trim(),
      prompt: customActionDraft.prompt.trim(),
      inputSource: customActionDraft.inputSource,
    };
    const updatedActions = editingCustomActionId
      ? customActions.map((currentAction) =>
          currentAction.id === editingCustomActionId ? action : currentAction
        )
      : [...customActions, action];
    const validationError = validateCustomActions(updatedActions);

    if (validationError) {
      showStatus(validationError, "error");
      return;
    }

    try {
      await setSyncStorage({ customActions: updatedActions });
      setCustomActions(updatedActions);
      resetCustomActionEditor();
      showStatus(
        editingCustomActionId
          ? "Custom action updated!"
          : "Custom action added!"
      );
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Unable to save the custom action.",
        "error"
      );
    }
  };

  const editCustomAction = (action: CustomAction) => {
    setEditingCustomActionId(action.id);
    setCustomActionDraft({
      name: action.name,
      prompt: action.prompt,
      inputSource: action.inputSource,
    });
  };

  const deleteCustomAction = async (id: string) => {
    const updatedActions = customActions.filter((action) => action.id !== id);

    try {
      await setSyncStorage({ customActions: updatedActions });
      setCustomActions(updatedActions);
      if (editingCustomActionId === id) resetCustomActionEditor();
      showStatus("Custom action deleted.");
    } catch (error) {
      showStatus(
        error instanceof Error
          ? error.message
          : "Unable to delete the custom action.",
        "error"
      );
    }
  };

  // --- Components ---

  const tabs = ["models", "settings", "usage"] as const;
  const activeIndex = tabs.indexOf(activeTab);
  const chromeModelConfigured = models.some(
    (model) => model.id === CHROME_AI_MODEL_ID
  );
  const chromeAIUnavailable =
    chromeAIAvailability === "unsupported" ||
    chromeAIAvailability === "unavailable";
  const showChromeAISetup =
    modelsLoaded &&
    ((chromeAIAvailability === "available" && !chromeModelConfigured) ||
      chromeAIAvailability === "downloadable" ||
      chromeAIAvailability === "downloading" ||
      (chromeAIUnavailable && chromeModelConfigured));

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: typeof activeTab;
    label: string;
    icon: any;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className="transition-all"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        border: "none",
        background: "transparent",
        color:
          activeTab === id ? theme.colors.primary : theme.colors.textSecondary,
        fontWeight: activeTab === id ? 600 : 500,
        cursor: "pointer",
        borderRadius: theme.borderRadius.md,
        boxShadow: "none",
        gap: "8px",
        fontSize: "14px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  // --- Render ---

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <GlobalStyles />

      <div style={{ width: "100%", maxWidth: "800px" }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              color: theme.colors.text,
              margin: "0 0 8px 0",
            }}
          >
            AINPUT
          </h1>
          <p
            style={{
              fontSize: "16px",
              color: theme.colors.textSecondary,
              margin: 0,
            }}
          >
            Make every input on the webpage more intelligent
          </p>
        </header>

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            padding: "4px",
            backgroundColor: "#e2e8f0",
            borderRadius: theme.borderRadius.lg,
            marginBottom: "32px",
            position: "relative",
          }}
        >
          <div
            className="transition-all"
            style={{
              position: "absolute",
              top: "4px",
              bottom: "4px",
              left: "4px",
              width: "calc((100% - 8px) / 3)",
              transform: `translateX(${activeIndex * 100}%)`,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borderRadius.md,
              boxShadow: theme.shadows.sm,
              zIndex: 0,
            }}
          />
          <TabButton id="models" label="AI Models" icon={FaRobot} />
          <TabButton id="settings" label="Settings" icon={FaCog} />
          <TabButton id="usage" label="Token Usage" icon={FaChartBar} />
        </div>

        {/* Content Area */}
        <main>
          {/* Status Message */}
          {settingsStatus && (
            <div
              className="transition-all"
              style={{
                padding: "12px 16px",
                marginBottom: "24px",
                borderRadius: theme.borderRadius.md,
                backgroundColor:
                  settingsStatus.type === "success" ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${
                  settingsStatus.type === "success" ? "#bbf7d0" : "#fecaca"
                }`,
                color:
                  settingsStatus.type === "success" ? "#15803d" : "#b91c1c",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              {settingsStatus.type === "success" ? (
                <FaCheckCircle />
              ) : (
                <FaExclamationCircle />
              )}
              {settingsStatus.message}
            </div>
          )}

          {/* Models Tab */}
          {activeTab === "models" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {showChromeAISetup && (
                <section
                  aria-labelledby="chrome-ai-setup-title"
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    backgroundColor: chromeAIUnavailable
                      ? "#fffbeb"
                      : "#f8fcff",
                    borderRadius: theme.borderRadius.lg,
                    padding: "24px",
                    boxShadow: theme.shadows.sm,
                    border: `1px solid ${
                      chromeAIUnavailable ? "#fde68a" : "#bae6fd"
                    }`,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: "5px",
                      background: chromeAIUnavailable
                        ? "#f59e0b"
                        : "linear-gradient(180deg, #00B1F2 0%, #62109F 100%)",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "24px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "14px",
                        flex: "1 1 360px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: theme.borderRadius.md,
                          background: chromeAIUnavailable
                            ? "#fef3c7"
                            : "linear-gradient(145deg, #e0f2fe, #ede9fe)",
                          color: chromeAIUnavailable ? "#92400e" : "#075985",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "0 0 auto",
                        }}
                      >
                        <FaMicrochip size={20} />
                      </div>
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            marginBottom: "6px",
                          }}
                        >
                          <h2
                            id="chrome-ai-setup-title"
                            style={{
                              margin: 0,
                              fontSize: "18px",
                              fontWeight: 700,
                            }}
                          >
                            Chrome Built-in AI
                          </h2>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: theme.borderRadius.full,
                              backgroundColor: chromeAIUnavailable
                                ? "#fef3c7"
                                : "#dcfce7",
                              color: chromeAIUnavailable
                                ? "#92400e"
                                : "#166534",
                              fontSize: "11px",
                              fontWeight: 700,
                              letterSpacing: "0.02em",
                            }}
                          >
                            {chromeAIUnavailable
                              ? "UNAVAILABLE HERE"
                              : "RUNS ON THIS DEVICE"}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            color: theme.colors.textSecondary,
                            fontSize: "14px",
                            lineHeight: 1.55,
                            maxWidth: "540px",
                          }}
                        >
                          {chromeAIUnavailable
                            ? "This device doesn't meet Chrome's built-in AI requirements. Select another configured model to keep using AInput."
                            : chromeAIAvailability === "available"
                            ? "Gemini Nano is ready in Chrome. Use AInput without an API key or sending text to a server."
                            : "Download Gemini Nano once, then use AInput privately and locally. Chrome manages the model and its updates."}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => void enableChromeAI()}
                      disabled={chromeAISetupInProgress || chromeAIUnavailable}
                      aria-busy={chromeAISetupInProgress}
                      style={{ flex: "0 0 auto" }}
                    >
                      {chromeAIUnavailable ? (
                        <FaExclamationCircle size={14} />
                      ) : chromeAIAvailability === "available" ? (
                        <FaCheckCircle size={14} />
                      ) : (
                        <FaDownload size={14} />
                      )}
                      {chromeAIUnavailable
                        ? "Unavailable"
                        : chromeAISetupInProgress
                        ? "Setting up…"
                        : chromeAIAvailability === "available"
                        ? "Use Built-in AI"
                        : "Download & Use"}
                    </Button>
                  </div>

                  {chromeAISetupInProgress && (
                    <div style={{ marginTop: "18px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "7px",
                          color: theme.colors.textSecondary,
                          fontSize: "12px",
                        }}
                      >
                        <span>
                          {chromeAIDownloadProgress === 1
                            ? "Preparing model…"
                            : "Downloading model…"}
                        </span>
                        {chromeAIDownloadProgress !== null &&
                          chromeAIDownloadProgress < 1 && (
                            <span>
                              {Math.round(chromeAIDownloadProgress * 100)}%
                            </span>
                          )}
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Chrome AI model download"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                          chromeAIDownloadProgress === null
                            ? undefined
                            : Math.round(chromeAIDownloadProgress * 100)
                        }
                        style={{
                          height: "6px",
                          overflow: "hidden",
                          borderRadius: theme.borderRadius.full,
                          backgroundColor: "#dbeafe",
                        }}
                      >
                        <div
                          className="transition-all"
                          style={{
                            height: "100%",
                            width:
                              chromeAIDownloadProgress === null
                                ? "20%"
                                : `${Math.max(
                                    4,
                                    chromeAIDownloadProgress * 100
                                  )}%`,
                            borderRadius: theme.borderRadius.full,
                            background:
                              "linear-gradient(90deg, #00B1F2, #62109F)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </section>
              )}

              <div
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.borderRadius.lg,
                  padding: "24px",
                  boxShadow: theme.shadows.sm,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
                    Active Models
                  </h2>
                  <span
                    style={{
                      fontSize: "12px",
                      color: theme.colors.textSecondary,
                      backgroundColor: "#f1f5f9",
                      padding: "4px 8px",
                      borderRadius: "12px",
                    }}
                  >
                    {models.length} configured
                  </span>
                </div>

                {!modelsLoaded ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 0",
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Checking available models…
                  </div>
                ) : models.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 0",
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <FaRobot
                      size={48}
                      style={{ opacity: 0.2, marginBottom: "16px" }}
                    />
                    <p style={{ marginBottom: 0 }}>
                      {chromeAIAvailability === "unsupported" ||
                      chromeAIAvailability === "unavailable"
                        ? "Built-in AI isn't available on this device. Add a model below to get started."
                        : "No models configured yet. Set up Chrome Built-in AI above or add a model below."}
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="transition-all"
                        style={{
                          borderRadius: theme.borderRadius.md,
                          border:
                            activeModelId === model.id
                              ? `1px solid ${theme.colors.primary}`
                              : `1px solid ${theme.colors.border}`,
                          backgroundColor:
                            activeModelId === model.id ? "#eff6ff" : "white",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "16px",
                            padding: "16px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "16px",
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                position: "relative",
                                width: "20px",
                                height: "20px",
                                flex: "0 0 auto",
                              }}
                            >
                              <input
                                type="radio"
                                id={`model-${model.id}`}
                                name="activeModel"
                                checked={activeModelId === model.id}
                                onChange={() => handleSetActiveModel(model.id)}
                                disabled={
                                  model.type === "chrome" && chromeAIUnavailable
                                }
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  cursor:
                                    model.type === "chrome" &&
                                    chromeAIUnavailable
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity: 0,
                                  position: "absolute",
                                  zIndex: 1,
                                }}
                              />
                              <div
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  border: `2px solid ${
                                    activeModelId === model.id
                                      ? theme.colors.primary
                                      : theme.colors.textSecondary
                                  }`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {activeModelId === model.id && (
                                  <div
                                    style={{
                                      width: "10px",
                                      height: "10px",
                                      borderRadius: "50%",
                                      backgroundColor: theme.colors.primary,
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <label
                                htmlFor={`model-${model.id}`}
                                style={{
                                  display: "block",
                                  fontWeight: 600,
                                  cursor:
                                    model.type === "chrome" &&
                                    chromeAIUnavailable
                                      ? "not-allowed"
                                      : "pointer",
                                  color: theme.colors.text,
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {model.name}
                              </label>
                              <span
                                style={{
                                  display: "block",
                                  fontSize: "12px",
                                  color: theme.colors.textSecondary,
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {model.type === "chrome"
                                  ? "CHROME • Gemini Nano • On-device"
                                  : `${model.type.toUpperCase()} • ${
                                      model.model || "Default"
                                    }`}
                              </span>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              flex: "0 0 auto",
                            }}
                          >
                            {model.id === OPENROUTER_FREE_MODEL_ID ? (
                              <button
                                type="button"
                                className="btn-icon transition-all"
                                onClick={refreshOpenRouterFreeModel}
                                disabled={refreshingOpenRouterFreeModel}
                                title="Refresh OpenRouter Free"
                                aria-label="Refresh OpenRouter Free"
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: refreshingOpenRouterFreeModel
                                    ? theme.colors.primary
                                    : theme.colors.textSecondary,
                                  cursor: refreshingOpenRouterFreeModel
                                    ? "wait"
                                    : "pointer",
                                  opacity: refreshingOpenRouterFreeModel
                                    ? 0.65
                                    : 1,
                                  padding: "8px",
                                  borderRadius: "50%",
                                  display: "flex",
                                }}
                              >
                                <FaSyncAlt />
                              </button>
                            ) : model.type !== "chrome" ? (
                              <button
                                type="button"
                                className="btn-icon transition-all"
                                onClick={() => startEditingModel(model)}
                                title="Edit Model"
                                aria-label={`Edit ${model.name}`}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color:
                                    editingModelId === model.id
                                      ? theme.colors.primary
                                      : theme.colors.textSecondary,
                                  cursor: "pointer",
                                  padding: "8px",
                                  borderRadius: "50%",
                                  display: "flex",
                                }}
                              >
                                <FaEdit />
                              </button>
                            ) : null}
                            <button
                              className="btn-danger transition-all"
                              onClick={() => deleteModel(model.id)}
                              title="Delete Model"
                              aria-label={`Delete ${model.name}`}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: theme.colors.textSecondary,
                                cursor: "pointer",
                                padding: "8px",
                                borderRadius: "50%",
                                display: "flex",
                              }}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>

                        {model.type !== "chrome" &&
                          model.id !== OPENROUTER_FREE_MODEL_ID &&
                          editingModelId === model.id &&
                          editingModel && (
                            <form
                              aria-label={`Edit ${model.name} settings`}
                              onSubmit={(event) => {
                                event.preventDefault();
                                saveEditedModel();
                              }}
                              style={{
                                padding: "20px",
                                borderTop: `1px solid ${theme.colors.border}`,
                                backgroundColor: theme.colors.surface,
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(220px, 1fr))",
                                  gap: "16px",
                                }}
                              >
                                <div>
                                  <label
                                    htmlFor={`edit-provider-${model.id}`}
                                    style={{
                                      display: "block",
                                      marginBottom: "8px",
                                      fontWeight: 500,
                                      fontSize: "14px",
                                    }}
                                  >
                                    Provider
                                  </label>
                                  <Select
                                    id={`edit-provider-${model.id}`}
                                    value={editingModel.type}
                                    onChange={(event) => {
                                      const type = event.target
                                        .value as ConfigurableModelType;
                                      updateEditingModel({
                                        type,
                                        baseUrl: getBaseUrlForProvider(
                                          type,
                                          editingModel.baseUrl
                                        ),
                                        model:
                                          type === "deepseek"
                                            ? "deepseek-v4-pro"
                                            : editingModel.type ===
                                                "deepseek" &&
                                              editingModel.model ===
                                                "deepseek-v4-pro"
                                            ? ""
                                            : editingModel.model,
                                      });
                                    }}
                                  >
                                    {MODEL_PROVIDERS.map((provider) => (
                                      <option
                                        key={provider.value}
                                        value={provider.value}
                                      >
                                        {provider.label}
                                      </option>
                                    ))}
                                  </Select>
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-name-${model.id}`}
                                    style={{
                                      display: "block",
                                      marginBottom: "8px",
                                      fontWeight: 500,
                                      fontSize: "14px",
                                    }}
                                  >
                                    Name
                                  </label>
                                  <Input
                                    id={`edit-name-${model.id}`}
                                    type="text"
                                    value={editingModel.name}
                                    onChange={(event) =>
                                      updateEditingModel({
                                        name: event.target.value,
                                      })
                                    }
                                    autoFocus
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-api-key-${model.id}`}
                                    style={{
                                      display: "block",
                                      marginBottom: "8px",
                                      fontWeight: 500,
                                      fontSize: "14px",
                                    }}
                                  >
                                    API Key
                                  </label>
                                  <Input
                                    id={`edit-api-key-${model.id}`}
                                    type="password"
                                    value={editingModel.apiKey}
                                    onChange={(event) =>
                                      updateEditingModel({
                                        apiKey: event.target.value,
                                      })
                                    }
                                    autoComplete="off"
                                  />
                                </div>

                                <div>
                                  <label
                                    htmlFor={`edit-model-id-${model.id}`}
                                    style={{
                                      display: "block",
                                      marginBottom: "8px",
                                      fontWeight: 500,
                                      fontSize: "14px",
                                    }}
                                  >
                                    Model ID
                                  </label>
                                  <Input
                                    id={`edit-model-id-${model.id}`}
                                    type="text"
                                    value={editingModel.model || ""}
                                    onChange={(event) =>
                                      updateEditingModel({
                                        model: event.target.value,
                                      })
                                    }
                                    placeholder={
                                      editingModel.type === "openai"
                                        ? "gpt-4.1-mini"
                                        : editingModel.type === "openrouter"
                                        ? "anthropic/claude-sonnet-4"
                                        : editingModel.type === "deepseek"
                                        ? "deepseek-v4-pro"
                                        : editingModel.type === "gemini"
                                        ? "gemini-2.5-flash"
                                        : "provider/model-name"
                                    }
                                  />
                                </div>

                                {editingModel.type === "custom" && (
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <label
                                      htmlFor={`edit-base-url-${model.id}`}
                                      style={{
                                        display: "block",
                                        marginBottom: "8px",
                                        fontWeight: 500,
                                        fontSize: "14px",
                                      }}
                                    >
                                      Base URL
                                    </label>
                                    <Input
                                      id={`edit-base-url-${model.id}`}
                                      type="url"
                                      value={editingModel.baseUrl || ""}
                                      onChange={(event) =>
                                        updateEditingModel({
                                          baseUrl: event.target.value,
                                        })
                                      }
                                      placeholder="https://api.example.com"
                                    />
                                  </div>
                                )}
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: "12px",
                                  marginTop: "20px",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={cancelEditingModel}
                                  className="hover-bg transition-all"
                                  style={{
                                    padding: "10px 16px",
                                    border: `1px solid ${theme.colors.border}`,
                                    borderRadius: theme.borderRadius.md,
                                    backgroundColor: theme.colors.surface,
                                    color: theme.colors.textSecondary,
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <FaTimes size={12} /> Cancel
                                </button>
                                <Button type="submit">
                                  <FaSave size={12} /> Save Changes
                                </Button>
                              </div>
                            </form>
                          )}
                      </div>
                    ))}

                    {!models.some(
                      (m) =>
                        m.type === "chrome" ||
                        m.apiKey !== FREE_OPENROUTER_API_KEY
                    ) && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px 16px",
                          backgroundColor: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          borderRadius: theme.borderRadius.md,
                          color: "#0369a1",
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <FaExclamationCircle size={16} />
                        <span>
                          <strong>Tip:</strong> The free models are great for
                          testing, but for the best experience (faster speed &
                          higher limits), we recommend adding your own API key
                          below.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.borderRadius.lg,
                  padding: "24px",
                  boxShadow: theme.shadows.sm,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 20px 0",
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  Add New Model
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "20px",
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: 500,
                        fontSize: "14px",
                      }}
                    >
                      Provider
                    </label>
                    <Select
                      value={newModelType}
                      onChange={(e) => {
                        const type = e.target.value as ConfigurableModelType;
                        setNewModelType(type);
                        if (type === "deepseek") {
                          setNewModelString("deepseek-v4-pro");
                        } else if (
                          newModelType === "deepseek" &&
                          newModelString === "deepseek-v4-pro"
                        ) {
                          setNewModelString("");
                        }
                      }}
                    >
                      {MODEL_PROVIDERS.map((provider) => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: 500,
                        fontSize: "14px",
                      }}
                    >
                      Name
                    </label>
                    <Input
                      type="text"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      placeholder="e.g., Work Assistant"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: 500,
                        fontSize: "14px",
                      }}
                    >
                      API Key
                    </label>
                    <Input
                      type="password"
                      value={newModelApiKey}
                      onChange={(e) => setNewModelApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                  </div>

                  {newModelType === "custom" && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: 500,
                          fontSize: "14px",
                        }}
                      >
                        Base URL
                      </label>
                      <Input
                        type="text"
                        value={newModelBaseUrl}
                        onChange={(e) => setNewModelBaseUrl(e.target.value)}
                        placeholder="https://api.example.com"
                      />
                    </div>
                  )}

                  {(newModelType === "openai" ||
                    newModelType === "openrouter" ||
                    newModelType === "deepseek" ||
                    newModelType === "custom" ||
                    newModelType === "gemini") && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: 500,
                          fontSize: "14px",
                        }}
                      >
                        Model ID
                      </label>
                      <Input
                        type="text"
                        value={newModelString}
                        onChange={(e) => setNewModelString(e.target.value)}
                        placeholder={
                          newModelType === "openai"
                            ? "gpt-4-turbo"
                            : newModelType === "openrouter"
                            ? "anthropic/claude-3-opus"
                            : newModelType === "deepseek"
                            ? "deepseek-v4-pro"
                            : newModelType === "gemini"
                            ? "gemini-2.5-flash"
                            : "llama-2-70b"
                        }
                      />
                    </div>
                  )}
                </div>
                <div
                  style={{
                    marginTop: "24px",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button onClick={addModel} variant="primary">
                    <FaPlus size={12} /> Add Model
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              <div
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.borderRadius.lg,
                  padding: "24px",
                  boxShadow: theme.shadows.sm,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 20px 0",
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  Preferences
                </h2>

                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: 500,
                      fontSize: "14px",
                    }}
                  >
                    Target Language for Translation
                  </label>
                  <Select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                  >
                    {[
                      "English",
                      "Spanish",
                      "French",
                      "German",
                      "Italian",
                      "Portuguese",
                      "Russian",
                      "Japanese",
                      "Korean",
                      "Chinese (Simplified)",
                      "Chinese (Traditional)",
                      "Arabic",
                      "Hindi",
                      "Dutch",
                      "Polish",
                      "Turkish",
                      "Vietnamese",
                      "Thai",
                      "Indonesian",
                    ].map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </Select>
                  <p
                    style={{
                      fontSize: "12px",
                      color: theme.colors.textSecondary,
                      marginTop: "8px",
                    }}
                  >
                    This is the default language AINPUT will translate text into
                    when you use the translation feature.
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button onClick={saveGeneralSettings}>Save Settings</Button>
                </div>
              </div>

              <section
                aria-labelledby="custom-actions-title"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.borderRadius.lg,
                  padding: "24px",
                  boxShadow: theme.shadows.sm,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <div>
                    <h2
                      id="custom-actions-title"
                      style={{ margin: "0 0 6px 0", fontSize: "18px" }}
                    >
                      Custom Actions
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        color: theme.colors.textSecondary,
                        fontSize: "14px",
                        lineHeight: 1.5,
                      }}
                    >
                      Add your own commands to the AINPUT menu. Each command
                      opens a review modal before it runs.
                    </p>
                  </div>
                  <span
                    style={{
                      flex: "0 0 auto",
                      padding: "4px 9px",
                      borderRadius: theme.borderRadius.full,
                      backgroundColor: "#f3e8ff",
                      color: "#6b21a8",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {customActions.length}/{MAX_CUSTOM_ACTIONS}
                  </span>
                </div>

                {customActions.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      marginBottom: "24px",
                    }}
                  >
                    {customActions.map((action) => (
                      <div
                        key={action.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "16px",
                          padding: "14px 14px 14px 16px",
                          borderRadius: theme.borderRadius.md,
                          border: `1px solid ${
                            editingCustomActionId === action.id
                              ? "#c4b5fd"
                              : theme.colors.border
                          }`,
                          borderLeft: "4px solid #7c3aed",
                          backgroundColor:
                            editingCustomActionId === action.id
                              ? "#faf5ff"
                              : "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            minWidth: 0,
                          }}
                        >
                          <div
                            aria-hidden="true"
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: theme.borderRadius.md,
                              backgroundColor: "#f3e8ff",
                              color: "#7c3aed",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: "0 0 auto",
                            }}
                          >
                            <FaBolt size={14} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 700,
                                color: theme.colors.text,
                                overflowWrap: "anywhere",
                              }}
                            >
                              {action.name}
                            </div>
                            <div
                              style={{
                                marginTop: "3px",
                                color: theme.colors.textSecondary,
                                fontSize: "12px",
                              }}
                            >
                              {action.inputSource === "input"
                                ? "Uses the focused input"
                                : "Uses page context"}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            flex: "0 0 auto",
                          }}
                        >
                          <button
                            type="button"
                            aria-label={`Edit ${action.name}`}
                            title={`Edit ${action.name}`}
                            onClick={() => editCustomAction(action)}
                            className="hover-bg transition-all"
                            style={{
                              width: "32px",
                              height: "32px",
                              border: "none",
                              borderRadius: theme.borderRadius.md,
                              backgroundColor: "transparent",
                              color: theme.colors.textSecondary,
                              cursor: "pointer",
                            }}
                          >
                            <FaEdit size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${action.name}`}
                            title={`Delete ${action.name}`}
                            onClick={() => void deleteCustomAction(action.id)}
                            className="btn-danger transition-all"
                            style={{
                              width: "32px",
                              height: "32px",
                              border: "none",
                              borderRadius: theme.borderRadius.md,
                              backgroundColor: "transparent",
                              color: theme.colors.danger,
                              cursor: "pointer",
                            }}
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveCustomAction();
                  }}
                  style={{
                    padding: "20px",
                    borderRadius: theme.borderRadius.md,
                    backgroundColor: "#f8fafc",
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "18px",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "15px" }}>
                      {editingCustomActionId
                        ? "Edit custom action"
                        : "Add custom action"}
                    </h3>
                    {editingCustomActionId && (
                      <button
                        type="button"
                        onClick={resetCustomActionEditor}
                        style={{
                          border: "none",
                          backgroundColor: "transparent",
                          color: theme.colors.textSecondary,
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        Cancel editing
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "18px",
                    }}
                  >
                    <div>
                      <label
                        htmlFor="custom-action-name"
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        Menu label
                      </label>
                      <Input
                        id="custom-action-name"
                        value={customActionDraft.name}
                        onChange={(event) =>
                          setCustomActionDraft((draft) => ({
                            ...draft,
                            name: event.target.value,
                          }))
                        }
                        placeholder="e.g., Make concise"
                        maxLength={40}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="custom-action-source"
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        Input source
                      </label>
                      <Select
                        id="custom-action-source"
                        value={customActionDraft.inputSource}
                        onChange={(event) =>
                          setCustomActionDraft((draft) => ({
                            ...draft,
                            inputSource: event.target
                              .value as CustomActionInputSource,
                          }))
                        }
                      >
                        <option value="input">Focused input text</option>
                        <option value="pageContext">
                          Page context (like Auto Reply)
                        </option>
                      </Select>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label
                        htmlFor="custom-action-prompt"
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        Custom prompt
                      </label>
                      <Textarea
                        id="custom-action-prompt"
                        value={customActionDraft.prompt}
                        onChange={(event) =>
                          setCustomActionDraft((draft) => ({
                            ...draft,
                            prompt: event.target.value,
                          }))
                        }
                        placeholder={`Rewrite ${CUSTOM_ACTION_INPUT_TOKEN} as a concise, friendly response. Return only the response.`}
                        maxLength={3000}
                      />
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: theme.colors.textSecondary,
                          fontSize: "12px",
                          lineHeight: 1.45,
                        }}
                      >
                        Place <code>{CUSTOM_ACTION_INPUT_TOKEN}</code> where the
                        selected input should appear. If omitted, AINPUT adds it
                        after your prompt.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: "18px",
                    }}
                  >
                    <Button
                      type="submit"
                      disabled={
                        !editingCustomActionId &&
                        customActions.length >= MAX_CUSTOM_ACTIONS
                      }
                    >
                      {editingCustomActionId ? (
                        <FaSave size={12} />
                      ) : (
                        <FaPlus size={12} />
                      )}
                      {editingCustomActionId ? "Save Action" : "Add Action"}
                    </Button>
                  </div>
                </form>
              </section>

              {disabledSites.length > 0 && (
                <div
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.borderRadius.lg,
                    padding: "24px",
                    boxShadow: theme.shadows.sm,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <h2
                    style={{
                      margin: "0 0 20px 0",
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    Disabled Sites
                  </h2>
                  <p
                    style={{
                      fontSize: "14px",
                      color: theme.colors.textSecondary,
                      marginBottom: "16px",
                    }}
                  >
                    AINPUT is disabled on these domains:
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {disabledSites.map((site) => (
                      <div
                        key={site}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px",
                          backgroundColor: "#f8fafc",
                          borderRadius: theme.borderRadius.md,
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{site}</span>
                        <button
                          onClick={() => removeSite(site)}
                          className="btn-danger"
                          title="Enable AINPUT on this site"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: theme.colors.danger,
                            cursor: "pointer",
                            padding: "4px",
                          }}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Usage Tab */}
          {activeTab === "usage" && (
            <div
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.lg,
                padding: "24px",
                boxShadow: theme.shadows.sm,
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <h2
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "18px",
                  fontWeight: 700,
                }}
              >
                Token Usage History
              </h2>

              <div style={{ overflowX: "auto" }}>
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Model</th>
                      <th>Action</th>
                      <th>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            textAlign: "center",
                            padding: "32px",
                            color: theme.colors.textSecondary,
                          }}
                        >
                          No usage data available yet.
                        </td>
                      </tr>
                    ) : (
                      usageData.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.date).toLocaleString()}</td>
                          <td>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor: "#e0f2fe",
                                color: "#0369a1",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              {item.model}
                            </span>
                          </td>
                          <td>{item.kind}</td>
                          <td style={{ fontFamily: "monospace" }}>
                            {item.tokens}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  marginTop: "24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => setUsagePage(usagePage - 1)}
                  disabled={usagePage === 1}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    background: "white",
                    padding: "8px 12px",
                    borderRadius: theme.borderRadius.md,
                    cursor: usagePage === 1 ? "not-allowed" : "pointer",
                    opacity: usagePage === 1 ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FaArrowLeft /> Previous
                </button>
                <span
                  style={{
                    fontSize: "14px",
                    color: theme.colors.textSecondary,
                  }}
                >
                  Page {usagePage} of{" "}
                  {Math.max(1, Math.ceil(usageTotal / usagePageSize))}
                </span>
                <button
                  onClick={() => setUsagePage(usagePage + 1)}
                  disabled={usagePage * usagePageSize >= usageTotal}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    background: "white",
                    padding: "8px 12px",
                    borderRadius: theme.borderRadius.md,
                    cursor:
                      usagePage * usagePageSize >= usageTotal
                        ? "not-allowed"
                        : "pointer",
                    opacity: usagePage * usagePageSize >= usageTotal ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Next <FaArrowRight />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            marginTop: "60px",
            paddingBottom: "20px",
            display: "flex",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          <a
            href="https://chromewebstore.google.com/detail/ainput/paleeakmljeofbpnnbnkllpbigccecnh"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: theme.colors.textSecondary,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = theme.colors.primary)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = theme.colors.textSecondary)
            }
          >
            <FaStar size={18} />
            Rate us on Chrome Store
          </a>
          <a
            href="https://github.com/stonega/ainput"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: theme.colors.textSecondary,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = theme.colors.primary)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = theme.colors.textSecondary)
            }
          >
            <FaGithub size={18} />
            Submit an issue on GitHub
          </a>
        </footer>
      </div>
    </div>
  );
};

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  );
}
