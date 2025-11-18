import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IoSettingsOutline } from "react-icons/io5";

interface ToggleSwitchProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  enabled,
  onToggle,
  disabled = false,
  isLoading = false,
}) => {
  const toggleContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    opacity: disabled || isLoading ? 0.6 : 1,
    cursor: disabled || isLoading ? "not-allowed" : "pointer",
  };

  const labelTextStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
  };

  const switchStyle: React.CSSProperties = {
    position: "relative",
    width: "40px",
    height: "22px",
    backgroundColor: enabled ? "#00B1F2" : "#bdc3c7",
    borderRadius: "11px",
    transition: "background-color 0.2s ease-in-out",
  };

  const knobStyle: React.CSSProperties = {
    position: "absolute",
    top: "2px",
    left: enabled ? "20px" : "2px",
    width: "18px",
    height: "18px",
    backgroundColor: "white",
    borderRadius: "50%",
    transition: "left 0.2s ease-in-out",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  };

  return (
    <label style={toggleContainerStyle} onClick={disabled || isLoading ? undefined : onToggle}>
      <span style={labelTextStyle}>{label}</span>
      <div style={switchStyle}>
        <div style={knobStyle}></div>
      </div>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        disabled={disabled || isLoading}
        style={{ display: "none" }}
      />
    </label>
  );
};

export const Popup = () => {
  const [currentOrigin, setCurrentOrigin] = useState<string>();
  const [activeTabId, setActiveTabId] = useState<number>();
  const [isDisabled, setIsDisabled] = useState<boolean | null>(null);
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];

      if (!tab || !tab.url) {
        setCurrentOrigin(undefined);
        setActiveTabId(undefined);
        setIsDisabled(null);
        setIsAutoReplyEnabled(null);
        return;
      }

      setActiveTabId(tab.id);

      try {
        const url = new URL(tab.url);
        const origin = url.origin;
        setCurrentOrigin(origin);

        chrome.storage.sync.get(["disabledSites", "autoReplySites"], (items) => {
          const disabledSites: string[] = items.disabledSites || [];
          setIsDisabled(disabledSites.includes(origin));

          const autoReplySites: string[] = items.autoReplySites || [];
          setIsAutoReplyEnabled(autoReplySites.includes(origin));
        });
      } catch (error) {
        console.error("Unable to parse tab URL:", error);
        setCurrentOrigin(undefined);
        setIsDisabled(null);
        setIsAutoReplyEnabled(null);
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

  const handleToggleAutoReply = () => {
    if (!currentOrigin || activeTabId === undefined || isAutoReplyEnabled === null) {
      return;
    }

    const nextAutoReplyEnabled = !isAutoReplyEnabled;

    chrome.storage.sync.get(["autoReplySites"], (items) => {
      const autoReplySites = new Set<string>(items.autoReplySites || []);

      if (nextAutoReplyEnabled) {
        autoReplySites.add(currentOrigin);
      } else {
        autoReplySites.delete(currentOrigin);
      }

      chrome.storage.sync.set(
        { autoReplySites: Array.from(autoReplySites) },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Failed to update auto reply sites:",
              chrome.runtime.lastError
            );
            return;
          }

          setIsAutoReplyEnabled(nextAutoReplyEnabled);
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
    padding: "16px",
    minWidth: "300px",
    backgroundColor: "#f9f9f9",
    color: "#333",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "22px",
    fontWeight: 700,
    color: "#00B1F2",
    margin: 0,
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: "13px",
    marginBottom: "16px",
    lineHeight: "1.5",
    color: "#555",
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>AINPUT</h1>
        <button
          onClick={openOptionsPage}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          title="Settings"
        >
          <IoSettingsOutline color="#00B1F2" size={24} />
        </button>
      </header>
      <p style={descriptionStyle}>
        Control settings for <strong>{currentOrigin || "this page"}</strong>.
      </p>
      
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '4px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <ToggleSwitch
          label={isDisabled ? "Extension Disabled" : "Extension Enabled"}
          enabled={!isDisabled}
          onToggle={handleToggleExtension}
          isLoading={isLoading}
        />
        <div style={{ height: '1px', backgroundColor: '#eee', margin: '2px 0' }}></div>
        <ToggleSwitch
          label={isAutoReplyEnabled ? "Auto Reply Enabled" : "Auto Reply Disabled"}
          enabled={isAutoReplyEnabled || false}
          onToggle={handleToggleAutoReply}
          disabled={isDisabled || false}
          isLoading={isLoading}
        />
      </div>
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
