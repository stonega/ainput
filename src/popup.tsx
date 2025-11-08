import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IoSettingsOutline } from "react-icons/io5";

export const Popup = () => {
  const [currentOrigin, setCurrentOrigin] = useState<string>();
  const [activeTabId, setActiveTabId] = useState<number>();
  const [isDisabled, setIsDisabled] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];

      if (!tab || !tab.url) {
        setCurrentOrigin(undefined);
        setActiveTabId(undefined);
        setIsDisabled(null);
        return;
      }

      setActiveTabId(tab.id);

      try {
        const url = new URL(tab.url);
        const origin = url.origin;
        setCurrentOrigin(origin);

        chrome.storage.sync.get(["disabledSites"], (items) => {
          const disabledSites: string[] = items.disabledSites || [];
          setIsDisabled(disabledSites.includes(origin));
        });
      } catch (error) {
        console.error("Unable to parse tab URL:", error);
        setCurrentOrigin(undefined);
        setIsDisabled(null);
      }
    });
  }, []);

  const handleToggleExtension = () => {
    if (!currentOrigin || activeTabId === undefined || isDisabled === null) {
      return;
    }

    const nextDisabled = !isDisabled;

    chrome.storage.sync.get(["disabledSites"], (items) => {
      const disabledSites = new Set<string>(items.disabledSites || []);

      if (nextDisabled) {
        disabledSites.add(currentOrigin);
      } else {
        disabledSites.delete(currentOrigin);
      }

      chrome.storage.sync.set(
        { disabledSites: Array.from(disabledSites) },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to update disabled sites:",
              chrome.runtime.lastError
            );
            return;
          }

          setIsDisabled(nextDisabled);

          chrome.tabs.sendMessage(
            activeTabId,
            {
              action: "setExtensionEnabled",
              enabled: !nextDisabled,
            },
            () => {
              const error = chrome.runtime.lastError;
              if (error) {
                console.warn("Could not notify content script:", error.message);
              }
            }
          );
        }
      );
    });
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  const isLoading =
    isDisabled === null || !currentOrigin || activeTabId === undefined;

  const containerStyle: React.CSSProperties = {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    padding: "0px 10px",
    minWidth: "280px",
    textAlign: "center",
    backgroundColor: "#ffffff",
    color: "#333",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "20px",
    fontWeight: 600,
    color: "#00B1F2",
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: "14px",
    marginBottom: "20px",
    lineHeight: "1.5",
    color: "#555",
  };

  const labelStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    cursor: isLoading ? "not-allowed" : "pointer",
    opacity: isLoading ? 0.6 : 1,
  };

  const toggleSwitchStyle: React.CSSProperties = {
    position: "relative",
    width: "44px",
    height: "24px",
    backgroundColor: isDisabled ? "#bdc3c7" : "#2196F3",
    borderRadius: "12px",
    transition: "background-color 0.2s ease-in-out",
  };

  const toggleKnobStyle: React.CSSProperties = {
    position: "absolute",
    top: "2px",
    left: isDisabled ? "2px" : "22px",
    width: "20px",
    height: "20px",
    backgroundColor: "white",
    borderRadius: "50%",
    transition: "left 0.2s ease-in-out",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  };

  const statusTextStyle: React.CSSProperties = {
    marginLeft: "12px",
    userSelect: "none",
    fontSize: "14px",
    fontWeight: 500,
    color: isDisabled ? "#7f8c8d" : "#2c3e50",
  };

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <h1 style={titleStyle}>AINPUT</h1>
        <button
          onClick={openOptionsPage}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          title="Settings"
        >
          <IoSettingsOutline color="#00B1F2" size={20} />
        </button>
      </div>
      <p style={descriptionStyle}>
        Control whether the extension is active on{" "}
        <strong>{currentOrigin || "this page"}</strong>.
      </p>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={!isDisabled}
          onChange={handleToggleExtension}
          disabled={isLoading}
          style={{ display: "none" }}
        />
        <span style={toggleSwitchStyle}>
          <span style={toggleKnobStyle}></span>
        </span>
        {/* <span style={statusTextStyle}>
          {isLoading ? "Loading..." : isDisabled ? "Disabled" : "Enabled"}
        </span> */}
      </label>
    </div>
  );
};

if (typeof document !== "undefined") {
  const container = document.getElementById("root");
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <Popup />
      </React.StrictMode>
    );
  }
}
