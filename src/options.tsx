import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

type StoredSettings = {
  geminiApiKey: string;
  targetLanguage: string;
};

const DEFAULT_SETTINGS: StoredSettings = {
  geminiApiKey: "",
  targetLanguage: "Spanish",
};

const Options = () => {
  const [apiKey, setApiKey] = useState<string>(DEFAULT_SETTINGS.geminiApiKey);
  const [targetLanguage, setTargetLanguage] = useState<string>(
    DEFAULT_SETTINGS.targetLanguage
  );
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      setApiKey(items.geminiApiKey.trim());
      setTargetLanguage(items.targetLanguage.trim());
    });
  }, []);

  const saveOptions = () => {
    const trimmedKey = apiKey.trim();
    const trimmedLanguage = targetLanguage.trim();

    chrome.storage.sync.set(
      {
        geminiApiKey: trimmedKey,
        targetLanguage: trimmedLanguage || DEFAULT_SETTINGS.targetLanguage,
      },
      () => {
        setStatus("Settings saved.");
        const timeout = window.setTimeout(() => {
          setStatus("");
        }, 2000);
        return () => window.clearTimeout(timeout);
      }
    );
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      <h1>Writing Assistant Settings</h1>
      <p>
        Provide your Gemini API key and the language you would like translated
        results to use.
      </p>
      <label style={{ display: "block", marginBottom: "1rem" }}>
        <span style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
          Gemini API Key
        </span>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
          placeholder="AI Studio API key"
          autoComplete="off"
        />
      </label>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        <span style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
          Translation Language
        </span>
        <input
          type="text"
          value={targetLanguage}
          onChange={(event) => setTargetLanguage(event.target.value)}
          style={{ width: "100%", padding: "0.5rem" }}
          placeholder="e.g. Spanish"
        />
      </label>

      <button onClick={saveOptions} style={{ padding: "0.5rem 1rem" }}>
        Save Settings
      </button>
      <div role="status" style={{ marginTop: "0.75rem", minHeight: "1.5rem" }}>
        {status}
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
