import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FaGithub, FaTrash } from "react-icons/fa";

interface Model {
  id: string;
  name: string;
  apiKey: string;
  type: "gemini" | "openai" | "anthropic" | "openrouter" | "custom";
  baseUrl?: string;
  model?: string;
}

const Options = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const [newModelType, setNewModelType] = useState<
    "gemini" | "openai" | "anthropic" | "openrouter" | "custom"
  >("gemini");
  const [newModelName, setNewModelName] = useState<string>("");
  const [newModelApiKey, setNewModelApiKey] = useState<string>("");
  const [newModelBaseUrl, setNewModelBaseUrl] = useState<string>("");
  const [newModelString, setNewModelString] = useState<string>("");

  const [targetLanguage, setTargetLanguage] = useState<string>("English");
  const [settingsStatus, setSettingsStatus] = useState<string>("");
  const [disabledListStatus, setDisabledListStatus] = useState<string>("");
  const [disabledSites, setDisabledSites] = useState<string[]>([]);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(false);

  useEffect(() => {
    chrome.storage.sync.get(
      {
        apiKey: "", // For migration
        models: [],
        activeModelId: null,
        targetLanguage: "English",
        disabledSites: [],
        autoReplyEnabled: false,
      },
      (items) => {
        if (items.models && items.models.length > 0) {
          setModels(items.models);
          setActiveModelId(items.activeModelId);
        } else if (items.apiKey) {
          // Migration from old version
          const defaultGeminiModel: Model = {
            id: "gemini-default",
            name: "Gemini (Default)",
            apiKey: items.apiKey,
            type: "gemini",
          };
          setModels([defaultGeminiModel]);
          setActiveModelId(defaultGeminiModel.id);
          chrome.storage.sync.set({
            models: [defaultGeminiModel],
            activeModelId: defaultGeminiModel.id,
            apiKey: "", // Clear old key
          });
        }
        setTargetLanguage(items.targetLanguage);
        setDisabledSites(items.disabledSites);
        setAutoReplyEnabled(items.autoReplyEnabled);
      }
    );
  }, []);

  const saveGeneralSettings = () => {
    chrome.storage.sync.set(
      {
        targetLanguage: targetLanguage,
      },
      () => {
        setSettingsStatus("Settings saved successfully!");
        setTimeout(() => setSettingsStatus(""), 3000);
      }
    );
  };

  const addModel = () => {
    if (!newModelName.trim() || !newModelApiKey.trim()) {
      setSettingsStatus("Model Name and API Key are required.");
      setTimeout(() => setSettingsStatus(""), 3000);
      return;
    }

    if (newModelType === "openai") {
      if (!newModelBaseUrl.trim() || !newModelString.trim()) {
        setSettingsStatus(
          "Base URL and Model String are required for OpenAI models."
        );
        setTimeout(() => setSettingsStatus(""), 3000);
        return;
      }
    }

    const newModel: Model = {
      id: `model-${Date.now()}`,
      name: newModelName.trim(),
      apiKey: newModelApiKey.trim(),
      type: newModelType,
      baseUrl:
        newModelType === "openai"
          ? "https://api.openai.com"
          : newModelType === "anthropic"
          ? "https://api.anthropic.com"
          : newModelType === "openrouter"
          ? "https://openrouter.ai/api"
          : newModelBaseUrl.trim(),
      model: newModelString.trim(),
    };

    const updatedModels = [...models, newModel];
    setModels(updatedModels);

    // If it's the first model, set it as active
    if (models.length === 0) {
      setActiveModelId(newModel.id);
      chrome.storage.sync.set({
        models: updatedModels,
        activeModelId: newModel.id,
      });
    } else {
      chrome.storage.sync.set({ models: updatedModels });
    }

    // Reset form
    setNewModelName("");
    setNewModelApiKey("");
    setNewModelBaseUrl("");
    setNewModelString("");
    setSettingsStatus("Model added successfully!");
    setTimeout(() => setSettingsStatus(""), 3000);
  };

  const deleteModel = (id: string) => {
    const updatedModels = models.filter((model) => model.id !== id);
    setModels(updatedModels);

    let newActiveModelId = activeModelId;
    if (activeModelId === id) {
      newActiveModelId = updatedModels.length > 0 ? updatedModels[0].id : null;
      setActiveModelId(newActiveModelId);
    }

    chrome.storage.sync.set({
      models: updatedModels,
      activeModelId: newActiveModelId,
    });
    setSettingsStatus("Model deleted successfully!");
    setTimeout(() => setSettingsStatus(""), 3000);
  };

  const handleSetActiveModel = (id: string) => {
    setActiveModelId(id);
    chrome.storage.sync.set({ activeModelId: id });
  };

  const handleAutoReplyChange = (enabled: boolean) => {
    setAutoReplyEnabled(enabled);
    chrome.storage.sync.set({ autoReplyEnabled: enabled });
  };

  const removeSite = (siteToRemove: string) => {
    const updatedSites = disabledSites.filter((site) => site !== siteToRemove);
    chrome.storage.sync.set({ disabledSites: updatedSites }, () => {
      setDisabledSites(updatedSites);
      setDisabledListStatus(
        `Successfully removed ${siteToRemove} from the disabled list.`
      );
      setTimeout(() => setDisabledListStatus(""), 3000);
    });
  };

  const pageStyle: React.CSSProperties = {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    backgroundColor: "#f4f7f9",
    minHeight: "100vh",
    padding: "40px 20px",
    display: "flex",
    justifyContent: "center",
    boxSizing: "border-box",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "600px",
    width: "100%",
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: "40px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "32px",
    fontWeight: 700,
    color: "#00B1F2",
    margin: "0 0 5px 0",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "16px",
    color: "#555",
    margin: 0,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  };

  const disabledListStyle: React.CSSProperties = {
    listStyle: "none",
    padding: 0,
  };

  const disabledListItemStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #eee",
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: "20px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "8px",
    fontWeight: 500,
    color: "#333",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const linkStyle: React.CSSProperties = {
    color: "#00B1F2",
    textDecoration: "none",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#666",
    marginTop: "8px",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "12px 24px",
    backgroundColor: "#00B1F2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: 600,
    transition: "background-color 0.2s",
  };

  const removeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#dc3545",
    padding: "5px 10px",
    fontSize: "12px",
  };

  const statusMessageStyle: React.CSSProperties = {
    marginTop: "15px",
    padding: "12px",
    borderRadius: "6px",
    fontSize: "14px",
  };

  const successStatusStyle: React.CSSProperties = {
    ...statusMessageStyle,
    backgroundColor: "#d4edda",
    color: "#155724",
    border: "1px solid #c3e6cb",
  };

  const errorStatusStyle: React.CSSProperties = {
    ...statusMessageStyle,
    backgroundColor: "#f8d7da",
    color: "#721c24",
    border: "1px solid #f5c6cb",
  };

  const howToUseTitleStyle: React.CSSProperties = {
    marginTop: 0,
    color: "#333",
    fontSize: "18px",
    borderBottom: "1px solid #eee",
    paddingBottom: "10px",
    marginBottom: "15px",
  };

  const howToUseListStyle: React.CSSProperties = {
    lineHeight: "1.8",
    color: "#555",
    paddingLeft: "20px",
  };

  const footerStyle: React.CSSProperties = {
    textAlign: "center",
    marginTop: "40px",
    color: "#888",
    fontSize: "14px",
  };

  const iconStyle: React.CSSProperties = {
    verticalAlign: "middle",
    marginRight: "8px",
  };

  const deleteButtonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "#dc3545",
    cursor: "pointer",
    fontSize: "16px",
  };

  const shortcutListStyle: React.CSSProperties = {
    lineHeight: "1.8",
    color: "#555",
    paddingLeft: "0",
    listStyle: "none",
  };

  const toggleSwitchStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    width: "44px",
    height: "24px",
  };

  const toggleSwitchInputStyle: React.CSSProperties = {
    opacity: 0,
    width: 0,
    height: 0,
  };

  const sliderStyle: React.CSSProperties = {
    position: "absolute",
    cursor: "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ccc",
    transition: ".4s",
    borderRadius: "24px",
  };

  const sliderBeforeStyle: React.CSSProperties = {
    position: "absolute",
    content: '""',
    height: "16px",
    width: "16px",
    left: "4px",
    bottom: "4px",
    backgroundColor: "white",
    transition: ".4s",
    borderRadius: "50%",
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>AINPUT</h1>
        </header>

        <div style={cardStyle}>
          <h3 style={howToUseTitleStyle}>AI Models</h3>
          {models.map((model) => (
            <div
              key={model.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="radio"
                  id={`model-${model.id}`}
                  name="activeModel"
                  checked={activeModelId === model.id}
                  onChange={() => handleSetActiveModel(model.id)}
                  style={{ marginRight: "10px" }}
                />
                <label htmlFor={`model-${model.id}`}>{model.name}</label>
              </div>
              <button
                onClick={() => deleteModel(model.id)}
                style={deleteButtonStyle}
                title="Delete Model"
              >
                <FaTrash />
              </button>
            </div>
          ))}

          <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid #eee" }}>
            <h4 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>
              Add New Model
            </h4>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Model Type:</label>
              <select
                value={newModelType}
                onChange={(e) =>
                  setNewModelType(
                    e.target.value as
                      | "gemini"
                      | "openai"
                      | "anthropic"
                      | "openrouter"
                      | "custom"
                  )
                }
                style={inputStyle}
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">Custom (OpenAI Comp)</option>
              </select>
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>Model Name:</label>
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="e.g., My Personal GPT"
                style={inputStyle}
              />
            </div>
            <div style={formGroupStyle}>
              <label style={labelStyle}>API Key:</label>
              <input
                type="password"
                value={newModelApiKey}
                onChange={(e) => setNewModelApiKey(e.target.value)}
                placeholder="Enter your API key"
                style={inputStyle}
              />
            </div>
            {newModelType === "custom" && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>Base URL:</label>
                <input
                  type="text"
                  value={newModelBaseUrl}
                  onChange={(e) => setNewModelBaseUrl(e.target.value)}
                  placeholder="https://api.custom.dev"
                  style={inputStyle}
                />
              </div>
            )}
            {(newModelType === "openai" ||
              newModelType === "anthropic" ||
              newModelType === "openrouter" ||
              newModelType === "custom") && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>Model String:</label>
                <input
                  type="text"
                  value={newModelString}
                  onChange={(e) => setNewModelString(e.target.value)}
                  placeholder={
                    newModelType === "openai"
                      ? "gpt-4"
                      : newModelType === "anthropic"
                      ? "claude-3-opus-20240229"
                      : newModelType === "openrouter"
                      ? "google/gemini-pro-2.5"
                      : "custom-model"
                  }
                  style={inputStyle}
                />
              </div>
            )}
            <button onClick={addModel} style={buttonStyle}>
              Add Model
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={howToUseTitleStyle}>General Settings</h3>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Target Language for Translation:</label>
            <select
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              style={inputStyle}
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Italian">Italian</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Russian">Russian</option>
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
              <option value="Chinese (Simplified)">Chinese (Simplified)</option>
              <option value="Chinese (Traditional)">
                Chinese (Traditional)
              </option>
              <option value="Arabic">Arabic</option>
              <option value="Hindi">Hindi</option>
              <option value="Dutch">Dutch</option>
              <option value="Polish">Polish</option>
              <option value="Turkish">Turkish</option>
              <option value="Vietnamese">Vietnamese</option>
              <option value="Thai">Thai</option>
              <option value="Indonesian">Indonesian</option>
            </select>
          </div>

          <div style={formGroupStyle}>
            <label style={labelStyle}>Auto Reply:</label>
            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={toggleSwitchStyle}>
                <input
                  type="checkbox"
                  checked={autoReplyEnabled}
                  onChange={(e) => handleAutoReplyChange(e.target.checked)}
                  style={toggleSwitchInputStyle}
                />
                <span
                  style={{
                    ...sliderStyle,
                    backgroundColor: autoReplyEnabled ? "#00B1F2" : "#ccc",
                  }}
                >
                  <span
                    style={{
                      ...sliderBeforeStyle,
                      transform: autoReplyEnabled
                        ? "translateX(20px)"
                        : "translateX(0)",
                    }}
                  />
                </span>
              </label>
              <span style={{ marginLeft: "12px", color: "#555" }}>
                {autoReplyEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p style={hintStyle}>
              Automatically suggest a reply when you focus on an empty input
              field.
            </p>
          </div>

          <button onClick={saveGeneralSettings} style={buttonStyle}>
            Save Settings
          </button>

          {settingsStatus && (
            <div
              style={
                settingsStatus.includes("success")
                  ? successStatusStyle
                  : errorStatusStyle
              }
            >
              {settingsStatus}
            </div>
          )}
        </div>

        {disabledSites.length > 0 && (
          <div style={cardStyle}>
            <h3 style={howToUseTitleStyle}>Disabled Sites</h3>
            <ul style={disabledListStyle}>
              {disabledSites.map((site) => (
                <li key={site} style={disabledListItemStyle}>
                  <span>{site}</span>
                  <button
                    onClick={() => removeSite(site)}
                    style={removeButtonStyle}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {disabledListStatus && (
              <div
                style={
                  disabledListStatus.includes("success")
                    ? successStatusStyle
                    : errorStatusStyle
                }
              >
                {disabledListStatus}
              </div>
            )}
          </div>
        )}

        {/* <div style={cardStyle}>
          <h3 style={howToUseTitleStyle}>Keyboard Shortcuts</h3>
          <p style={{ ...hintStyle, marginTop: 0, marginBottom: "15px" }}>
            Select text in any editable field and use the following shortcuts:
          </p>
          <ul style={shortcutListStyle}>
            <li style={{ marginBottom: "10px" }}>
              <strong>Fix Grammar:</strong> <code>Ctrl+Shift+F</code> (or{" "}
              <code>Cmd+Shift+F</code> on Mac)
            </li>
            <li>
              <strong>Translate:</strong> <code>Ctrl+Shift+T</code> (or{" "}
              <code>Cmd+Shift+T</code> on Mac)
            </li>
          </ul>
        </div> */}

        <footer style={footerStyle}>
          <a
            href="https://github.com/stonega/ainput"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            <FaGithub style={iconStyle} />
            Open Source
          </a>
        </footer>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
