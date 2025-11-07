import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [count, setCount] = useState(0);
  const [currentURL, setCurrentURL] = useState<string>();
  const [currentHostname, setCurrentHostname] = useState<string>();
  const [isDisabled, setIsDisabled] = useState(false);

  useEffect(() => {
    chrome.action.setBadgeText({ text: count.toString() });
  }, [count]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const url = tabs[0].url;
      setCurrentURL(url);
      
      if (url) {
        try {
          const hostname = new URL(url).hostname;
          setCurrentHostname(hostname);
          
          // Check if extension is disabled for this site
          chrome.storage.sync.get(['disabledSites'], (result) => {
            const disabledSites = result.disabledSites || [];
            setIsDisabled(disabledSites.includes(hostname));
          });
        } catch (e) {
          // Invalid URL (like chrome:// pages)
          setCurrentHostname(undefined);
        }
      }
    });
  }, []);

  const changeBackground = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (tab.id) {
        chrome.tabs.sendMessage(
          tab.id,
          {
            color: "#555555",
          },
          (msg) => {
            console.log("result message:", msg);
          }
        );
      }
    });
  };

  const toggleExtensionForSite = () => {
    if (!currentHostname) return;
    
    chrome.storage.sync.get(['disabledSites'], (result) => {
      const disabledSites = result.disabledSites || [];
      let updatedSites;
      
      if (isDisabled) {
        // Remove from disabled list
        updatedSites = disabledSites.filter((site: string) => site !== currentHostname);
      } else {
        // Add to disabled list
        updatedSites = [...disabledSites, currentHostname];
      }
      
      chrome.storage.sync.set({ disabledSites: updatedSites }, () => {
        setIsDisabled(!isDisabled);
        
        // Reload the current tab to apply changes
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0].id) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    });
  };

  return (
    <>
      <div style={{ minWidth: "300px", padding: "16px" }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600" }}>
          AI Text Enhancer
        </h2>
        
        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
            <strong>Current site:</strong> {currentHostname || "N/A"}
          </p>
          
          {currentHostname && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "12px",
              padding: "12px",
              backgroundColor: "#f5f5f5",
              borderRadius: "6px"
            }}>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                cursor: "pointer",
                fontSize: "14px",
                flex: 1
              }}>
                <input
                  type="checkbox"
                  checked={!isDisabled}
                  onChange={toggleExtensionForSite}
                  style={{ 
                    marginRight: "8px",
                    cursor: "pointer",
                    width: "16px",
                    height: "16px"
                  }}
                />
                <span>
                  {isDisabled ? "Extension disabled" : "Extension enabled"}
                </span>
              </label>
              <span style={{
                fontSize: "20px",
                color: isDisabled ? "#f44336" : "#4CAF50"
              }}>
                {isDisabled ? "✕" : "✓"}
              </span>
            </div>
          )}
          
          {!currentHostname && (
            <p style={{ 
              fontSize: "13px", 
              color: "#999",
              fontStyle: "italic"
            }}>
              Extension controls not available on this page
            </p>
          )}
        </div>
        
        <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "16px 0" }} />
        
        <div style={{ fontSize: "13px", color: "#666" }}>
          <p style={{ margin: "0 0 8px 0" }}>
            This extension adds AI-powered buttons to text inputs for:
          </p>
          <ul style={{ margin: "0", paddingLeft: "20px" }}>
            <li>Grammar and spelling correction</li>
            <li>Text translation</li>
          </ul>
        </div>
      </div>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
