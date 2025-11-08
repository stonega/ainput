import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Options = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [targetLanguage, setTargetLanguage] = useState<string>("English");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    // Restore settings from chrome.storage
    chrome.storage.sync.get(
      {
        apiKey: "",
        targetLanguage: "English",
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

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>AINPUT</h1>
          <p style={subtitleStyle}>Extension Settings</p>
        </header>

        <div style={cardStyle}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Gemini API Key:</label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Enter your Gemini API key"
              style={inputStyle}
            />
            <p style={hintStyle}>
              Get your API key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Google AI Studio
              </a>
            </p>
          </div>

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

          <button onClick={saveOptions} style={buttonStyle}>
            Save Settings
          </button>

          {status && (
            <div
              style={
                status.includes("success")
                  ? successStatusStyle
                  : errorStatusStyle
              }
            >
              {status}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={howToUseTitleStyle}>How to use:</h3>
          <ol style={howToUseListStyle}>
            <li>Get your Gemini API key from Google AI Studio</li>
            <li>
              Enter your API key above and select your preferred translation
              language
            </li>
            <li>Click "Save Settings"</li>
            <li>Visit any webpage with text inputs or textareas</li>
            <li>
              You'll see "Fix Grammar" and "Translate" buttons below each text
              field
            </li>
            <li>Type your text and click the buttons to enhance it with AI</li>
          </ol>
        </div>
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
