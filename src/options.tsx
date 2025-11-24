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
  FaExclamationCircle,
  FaTimes
} from "react-icons/fa";
import { getTokenUsage } from "./db";
import { theme, GlobalStyles } from "./theme";

// --- Types ---

const FREE_OPENROUTER_API_KEY = "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";

interface Model {
  id: string;
  name: string;
  apiKey: string;
  type: "gemini" | "openai" | "openrouter" | "custom";
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

const Button = ({ variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "danger" }) => (
  <button
    {...props}
    className={`transition-all btn-${variant}`}
    style={{
      padding: "10px 20px",
      backgroundColor: variant === "primary" ? theme.colors.primary : "transparent",
      color: variant === "primary" ? "#fff" : theme.colors.danger,
      border: variant === "danger" ? `1px solid ${theme.colors.danger}` : "none",
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

const Options = () => {
  // --- State ---
  const [models, setModels] = useState<Model[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"models" | "settings" | "usage">("models");

  const [newModelType, setNewModelType] = useState<"gemini" | "openai" | "openrouter" | "custom">("gemini");
  const [newModelName, setNewModelName] = useState<string>("");
  const [newModelApiKey, setNewModelApiKey] = useState<string>("");
  const [newModelBaseUrl, setNewModelBaseUrl] = useState<string>("");
  const [newModelString, setNewModelString] = useState<string>("");

  const [targetLanguage, setTargetLanguage] = useState<string>("English");
  const [settingsStatus, setSettingsStatus] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [disabledSites, setDisabledSites] = useState<string[]>([]);

  const [usageData, setUsageData] = useState<TokenUsage[]>([]);
  const [usagePage, setUsagePage] = useState<number>(1);
  const [usageTotal, setUsageTotal] = useState<number>(0);
  const usagePageSize = 10;

  // --- Effects ---
  useEffect(() => {
    chrome.storage.sync.get(
      {
        apiKey: "", // For migration
        models: [],
        activeModelId: null,
        targetLanguage: "English",
        disabledSites: [],
      },
      (items) => {
        if (items.models && items.models.length > 0) {
          setModels(items.models);
          setActiveModelId(items.activeModelId);
        } else {
          // Migration or Fresh Install
          const freeModels: Model[] = [
            {
              id: "grok-free",
              name: "Grok 4.1 Fast (Free)",
              apiKey: FREE_OPENROUTER_API_KEY,
              type: "openrouter",
              baseUrl: "https://openrouter.ai/api",
              model: "x-ai/grok-4.1-fast:free",
            },
            {
              id: "gpt-oss-free",
              name: "GPT OSS 20B (Free)",
              apiKey: FREE_OPENROUTER_API_KEY,
              type: "openrouter",
              baseUrl: "https://openrouter.ai/api",
              model: "openai/gpt-oss-20b:free",
            },
            {
              id: "deepseek-r1-free",
              name: "DeepSeek R1 (Free)",
              apiKey: FREE_OPENROUTER_API_KEY,
              type: "openrouter",
              baseUrl: "https://openrouter.ai/api",
              model: "deepseek/deepseek-r1-0528:free",
            },
          ];

          const initialModels = [...freeModels];

          setModels(initialModels);
          const initialActiveId = freeModels[0].id;
          setActiveModelId(initialActiveId);
          
          chrome.storage.sync.set({
            models: initialModels,
            activeModelId: initialActiveId,
            apiKey: "",
          });
        }
        setTargetLanguage(items.targetLanguage);
        setDisabledSites(items.disabledSites);
      }
    );
  }, []);

  useEffect(() => {
    if (activeTab === "usage") {
      loadUsageData();
    }
  }, [activeTab, usagePage]);

  // --- Actions ---

  const showStatus = (message: string, type: 'success' | 'error' = 'success') => {
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
    if (!newModelName.trim() || !newModelApiKey.trim()) {
      showStatus("Model Name and API Key are required.", 'error');
      return;
    }

    let modelString = newModelString.trim();
    if (newModelType === "gemini" && !modelString) {
      modelString = "gemini-2.5-flash";
    }

    if (newModelType === "openai") {
      if (!newModelBaseUrl.trim() || !modelString) {
        showStatus("Base URL and Model String are required for OpenAI models.", 'error');
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
          : newModelType === "openrouter"
          ? "https://openrouter.ai/api"
          : newModelBaseUrl.trim(),
      model: modelString,
    };

    const updatedModels = [...models, newModel];
    setModels(updatedModels);

    if (models.length === 0) {
      setActiveModelId(newModel.id);
      chrome.storage.sync.set({
        models: updatedModels,
        activeModelId: newModel.id,
      });
    } else {
      chrome.storage.sync.set({ models: updatedModels });
    }

    setNewModelName("");
    setNewModelApiKey("");
    setNewModelBaseUrl("");
    setNewModelString("");
    showStatus("Model added successfully!");
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
    showStatus("Model deleted successfully!");
  };

  const handleSetActiveModel = (id: string) => {
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

  // --- Components ---

  const tabs = ["models", "settings", "usage"] as const;
  const activeIndex = tabs.indexOf(activeTab);

  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab; label: string; icon: any }) => (
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
        color: activeTab === id ? theme.colors.primary : theme.colors.textSecondary,
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
    <div style={{ minHeight: "100vh", padding: "40px 20px", display: "flex", justifyContent: "center" }}>
      <GlobalStyles />
      
      <div style={{ width: "100%", maxWidth: "800px" }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: theme.colors.text, margin: "0 0 8px 0" }}>
            AINPUT
          </h1>
          <p style={{ fontSize: "16px", color: theme.colors.textSecondary, margin: 0 }}>
            Make every input on the webpage more intelligent
          </p>
        </header>

        {/* Navigation */}
        <div style={{ 
          display: "flex", 
          padding: "4px", 
          backgroundColor: "#e2e8f0", 
          borderRadius: theme.borderRadius.lg, 
          marginBottom: "32px",
          position: "relative",
        }}>
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
            <div className="transition-all" style={{
              padding: "12px 16px",
              marginBottom: "24px",
              borderRadius: theme.borderRadius.md,
              backgroundColor: settingsStatus.type === 'success' ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${settingsStatus.type === 'success' ? "#bbf7d0" : "#fecaca"}`,
              color: settingsStatus.type === 'success' ? "#15803d" : "#b91c1c",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "14px",
              fontWeight: 500
            }}>
              {settingsStatus.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />}
              {settingsStatus.message}
            </div>
          )}

          {/* Models Tab */}
          {activeTab === "models" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ 
                backgroundColor: theme.colors.surface, 
                borderRadius: theme.borderRadius.lg, 
                padding: "24px",
                boxShadow: theme.shadows.sm,
                border: `1px solid ${theme.colors.border}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Active Models</h2>
                  <span style={{ fontSize: "12px", color: theme.colors.textSecondary, backgroundColor: "#f1f5f9", padding: "4px 8px", borderRadius: "12px" }}>
                    {models.length} configured
                  </span>
                </div>
                
                {models.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: theme.colors.textSecondary }}>
                    <FaRobot size={48} style={{ opacity: 0.2, marginBottom: "16px" }} />
                    <p>No models configured yet. Add one below to get started.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="transition-all"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "16px",
                          borderRadius: theme.borderRadius.md,
                          border: activeModelId === model.id 
                            ? `1px solid ${theme.colors.primary}` 
                            : `1px solid ${theme.colors.border}`,
                          backgroundColor: activeModelId === model.id ? "#eff6ff" : "white",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ position: "relative", width: "20px", height: "20px" }}>
                            <input
                              type="radio"
                              id={`model-${model.id}`}
                              name="activeModel"
                              checked={activeModelId === model.id}
                              onChange={() => handleSetActiveModel(model.id)}
                              style={{ 
                                width: "100%", height: "100%", cursor: "pointer",
                                opacity: 0, position: "absolute", zIndex: 1
                              }}
                            />
                            <div style={{
                              width: "20px", height: "20px", borderRadius: "50%",
                              border: `2px solid ${activeModelId === model.id ? theme.colors.primary : theme.colors.textSecondary}`,
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                              {activeModelId === model.id && (
                                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: theme.colors.primary }} />
                              )}
                            </div>
                          </div>
                          <div>
                            <label 
                              htmlFor={`model-${model.id}`} 
                              style={{ display: "block", fontWeight: 600, cursor: "pointer", color: theme.colors.text }}
                            >
                              {model.name}
                            </label>
                            <span style={{ fontSize: "12px", color: theme.colors.textSecondary }}>
                              {model.type.toUpperCase()} • {model.model || "Default"}
                            </span>
                          </div>
                        </div>
                        <button
                          className="btn-danger transition-all"
                          onClick={() => deleteModel(model.id)}
                          title="Delete Model"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: theme.colors.textSecondary,
                            cursor: "pointer",
                            padding: "8px",
                            borderRadius: "50%",
                            display: "flex"
                          }}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                    
                    {!models.some(m => m.apiKey !== FREE_OPENROUTER_API_KEY) && (
                       <div style={{
                         marginTop: "12px",
                         padding: "12px 16px",
                         backgroundColor: "#f0f9ff",
                         border: "1px solid #bae6fd",
                         borderRadius: theme.borderRadius.md,
                         color: "#0369a1",
                         fontSize: "14px",
                         display: "flex",
                         alignItems: "center",
                         gap: "12px"
                       }}>
                         <FaExclamationCircle size={16} />
                         <span>
                           <strong>Tip:</strong> The free models are great for testing, but for the best experience (faster speed & higher limits), we recommend adding your own API key below.
                         </span>
                       </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ 
                backgroundColor: theme.colors.surface, 
                borderRadius: theme.borderRadius.lg, 
                padding: "24px",
                boxShadow: theme.shadows.sm,
                border: `1px solid ${theme.colors.border}`
              }}>
                <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: 700 }}>Add New Model</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Provider</label>
                    <Select
                      value={newModelType}
                      onChange={(e) => setNewModelType(e.target.value as any)}
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="custom">Custom (OpenAI Compatible)</option>
                    </Select>
                  </div>
                  
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Name</label>
                    <Input
                      type="text"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      placeholder="e.g., Work Assistant"
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>API Key</label>
                    <Input
                      type="password"
                      value={newModelApiKey}
                      onChange={(e) => setNewModelApiKey(e.target.value)}
                      placeholder="sk-..."
                    />
                  </div>

                  {newModelType === "custom" && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Base URL</label>
                      <Input
                        type="text"
                        value={newModelBaseUrl}
                        onChange={(e) => setNewModelBaseUrl(e.target.value)}
                        placeholder="https://api.example.com/v1"
                      />
                    </div>
                  )}

                  {(newModelType === "openai" || newModelType === "openrouter" || newModelType === "custom" || newModelType === "gemini") && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>Model ID</label>
                      <Input
                        type="text"
                        value={newModelString}
                        onChange={(e) => setNewModelString(e.target.value)}
                        placeholder={
                          newModelType === "openai" ? "gpt-4-turbo" : 
                          newModelType === "openrouter" ? "anthropic/claude-3-opus" : 
                          newModelType === "gemini" ? "gemini-2.5-flash" : "llama-2-70b"
                        }
                      />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                  <Button onClick={addModel} variant="primary">
                    <FaPlus size={12} /> Add Model
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ 
                backgroundColor: theme.colors.surface, 
                borderRadius: theme.borderRadius.lg, 
                padding: "24px",
                boxShadow: theme.shadows.sm,
                border: `1px solid ${theme.colors.border}`
              }}>
                <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: 700 }}>Preferences</h2>
                
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "14px" }}>
                    Target Language for Translation
                  </label>
                  <Select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                  >
                    {[
                      "English", "Spanish", "French", "German", "Italian", "Portuguese", 
                      "Russian", "Japanese", "Korean", "Chinese (Simplified)", 
                      "Chinese (Traditional)", "Arabic", "Hindi", "Dutch", "Polish", 
                      "Turkish", "Vietnamese", "Thai", "Indonesian"
                    ].map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </Select>
                  <p style={{ fontSize: "12px", color: theme.colors.textSecondary, marginTop: "8px" }}>
                    This is the default language AINPUT will translate text into when you use the translation feature.
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button onClick={saveGeneralSettings}>Save Settings</Button>
                </div>
              </div>

              {disabledSites.length > 0 && (
                <div style={{ 
                  backgroundColor: theme.colors.surface, 
                  borderRadius: theme.borderRadius.lg, 
                  padding: "24px",
                  boxShadow: theme.shadows.sm,
                  border: `1px solid ${theme.colors.border}`
                }}>
                  <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: 700 }}>Disabled Sites</h2>
                  <p style={{ fontSize: "14px", color: theme.colors.textSecondary, marginBottom: "16px" }}>
                    AINPUT is disabled on these domains:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {disabledSites.map((site) => (
                      <div key={site} style={{ 
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px", backgroundColor: "#f8fafc", borderRadius: theme.borderRadius.md,
                        border: `1px solid ${theme.colors.border}`
                      }}>
                        <span style={{ fontWeight: 500 }}>{site}</span>
                        <button
                          onClick={() => removeSite(site)}
                          className="btn-danger"
                          title="Enable AINPUT on this site"
                          style={{
                            background: "transparent", border: "none", 
                            color: theme.colors.danger, cursor: "pointer",
                            padding: "4px"
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
            <div style={{ 
              backgroundColor: theme.colors.surface, 
              borderRadius: theme.borderRadius.lg, 
              padding: "24px",
              boxShadow: theme.shadows.sm,
              border: `1px solid ${theme.colors.border}`
            }}>
              <h2 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: 700 }}>Token Usage History</h2>
              
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
                        <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: theme.colors.textSecondary }}>
                          No usage data available yet.
                        </td>
                      </tr>
                    ) : (
                      usageData.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.date).toLocaleString()}</td>
                          <td>
                            <span style={{ 
                              padding: "2px 8px", borderRadius: "12px", 
                              backgroundColor: "#e0f2fe", color: "#0369a1",
                              fontSize: "12px", fontWeight: 600
                            }}>
                              {item.model}
                            </span>
                          </td>
                          <td>{item.kind}</td>
                          <td style={{ fontFamily: "monospace" }}>{item.tokens}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                    display: "flex", alignItems: "center", gap: "8px"
                  }}
                >
                  <FaArrowLeft /> Previous
                </button>
                <span style={{ fontSize: "14px", color: theme.colors.textSecondary }}>
                  Page {usagePage} of {Math.max(1, Math.ceil(usageTotal / usagePageSize))}
                </span>
                <button
                  onClick={() => setUsagePage(usagePage + 1)}
                  disabled={usagePage * usagePageSize >= usageTotal}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    background: "white",
                    padding: "8px 12px",
                    borderRadius: theme.borderRadius.md,
                    cursor: usagePage * usagePageSize >= usageTotal ? "not-allowed" : "pointer",
                    opacity: usagePage * usagePageSize >= usageTotal ? 0.5 : 1,
                    display: "flex", alignItems: "center", gap: "8px"
                  }}
                >
                  Next <FaArrowRight />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer style={{ textAlign: "center", marginTop: "60px", paddingBottom: "20px" }}>
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
              transition: "color 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.primary}
            onMouseLeave={(e) => e.currentTarget.style.color = theme.colors.textSecondary}
          >
            <FaGithub size={18} />
            View Source on GitHub
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
