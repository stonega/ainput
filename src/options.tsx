import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Options = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [targetLanguage, setTargetLanguage] = useState<string>("Spanish");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    // Restore settings from chrome.storage
    chrome.storage.sync.get(
      {
        apiKey: "",
        targetLanguage: "Spanish",
      },
      (items) => {
        setApiKey(items.apiKey);
        setTargetLanguage(items.targetLanguage);
      }
    );
  }, []);

  const saveOptions = () => {
    // Validate API key
    if (!apiKey.trim()) {
      setStatus("Please enter a valid API key.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    // Save options to chrome.storage.sync
    chrome.storage.sync.set(
      {
        apiKey: apiKey.trim(),
        targetLanguage: targetLanguage,
      },
      () => {
        setStatus("Settings saved successfully!");
        setTimeout(() => setStatus(""), 3000);
      }
    );
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "600px" }}>
      <h1 style={{ color: "#333", marginBottom: "20px" }}>AI Text Enhancer Settings</h1>
      
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Gemini API Key:
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Enter your Gemini API key"
          style={{
            width: "100%",
            padding: "8px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxSizing: "border-box",
          }}
        />
        <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
          Get your API key from{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2196F3" }}
          >
            Google AI Studio
          </a>
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Target Language for Translation:
        </label>
        <select
          value={targetLanguage}
          onChange={(event) => setTargetLanguage(event.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxSizing: "border-box",
          }}
        >
          <option value="Spanish">Spanish</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Italian">Italian</option>
          <option value="Portuguese">Portuguese</option>
          <option value="Russian">Russian</option>
          <option value="Japanese">Japanese</option>
          <option value="Korean">Korean</option>
          <option value="Chinese (Simplified)">Chinese (Simplified)</option>
          <option value="Chinese (Traditional)">Chinese (Traditional)</option>
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

      <button
        onClick={saveOptions}
        style={{
          padding: "10px 20px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "bold",
        }}
      >
        Save Settings
      </button>

      {status && (
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: status.includes("success") ? "#d4edda" : "#f8d7da",
            color: status.includes("success") ? "#155724" : "#721c24",
            border: `1px solid ${status.includes("success") ? "#c3e6cb" : "#f5c6cb"}`,
            borderRadius: "4px",
          }}
        >
          {status}
        </div>
      )}

      <div style={{ marginTop: "30px", padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
        <h3 style={{ marginTop: 0, color: "#333" }}>How to use:</h3>
        <ol style={{ lineHeight: "1.8", color: "#555" }}>
          <li>Get your Gemini API key from Google AI Studio</li>
          <li>Enter your API key above and select your preferred translation language</li>
          <li>Click "Save Settings"</li>
          <li>Visit any webpage with text inputs or textareas</li>
          <li>You'll see "Fix Grammar" and "Translate" buttons below each text field</li>
          <li>Type your text and click the buttons to enhance it with AI</li>
        </ol>
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
