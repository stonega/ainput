import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IoSettingsOutline } from "react-icons/io5";
import { FaPowerOff, FaRobot, FaExternalLinkAlt, FaExclamationCircle } from "react-icons/fa";
import { theme, GlobalStyles } from "./theme";
import {
  isSiteDisabled,
  addDisabledSite,
  removeDisabledSite,
  isAutoReplyEnabledForSite,
  addAutoReplySite,
  removeAutoReplySite
} from "./site_exclusions";

// --- Components ---

interface ToggleSwitchProps {
  label: string;
  sublabel?: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  sublabel,
  enabled,
  onToggle,
  disabled = false,
  icon
}) => {
  return (
    <div 
      className="hover-bg"
      onClick={disabled ? undefined : onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        borderRadius: theme.borderRadius.md,
        transition: "background-color 0.2s",
        marginBottom: "8px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {icon && (
          <div style={{ 
            color: enabled ? theme.colors.primary : theme.colors.textSecondary,
            fontSize: "18px",
            display: "flex"
          }}>
            {icon}
          </div>
        )}
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: theme.colors.text }}>{label}</div>
          {sublabel && (
            <div style={{ fontSize: "11px", color: theme.colors.textSecondary, marginTop: "2px" }}>
              {sublabel}
            </div>
          )}
        </div>
      </div>
      
      <div style={{
        position: "relative",
        width: "44px",
        height: "24px",
        backgroundColor: enabled ? theme.colors.primary : "#cbd5e1",
        borderRadius: "99px",
        transition: "background-color 0.2s ease-in-out",
        flexShrink: 0
      }}>
        <div style={{
          position: "absolute",
          top: "2px",
          left: enabled ? "22px" : "2px",
          width: "20px",
          height: "20px",
          backgroundColor: "white",
          borderRadius: "50%",
          transition: "left 0.2s ease-in-out",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }} />
      </div>
    </div>
  );
};

export const Popup = () => {
  const [currentOrigin, setCurrentOrigin] = useState<string>();
  const [currentUrl, setCurrentUrl] = useState<string>();
  const [activeTabId, setActiveTabId] = useState<number>();
  const [isDisabled, setIsDisabled] = useState<boolean | null>(null);
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        setCurrentOrigin(undefined);
        setCurrentUrl(undefined);
        setActiveTabId(undefined);
        setIsDisabled(null);
        setIsAutoReplyEnabled(null);
        return;
      }
      setActiveTabId(tab.id);
      setCurrentUrl(tab.url);
      try {
        const url = new URL(tab.url);
        const origin = url.origin;
        setCurrentOrigin(origin);
        Promise.all([
          isSiteDisabled(origin),
          isAutoReplyEnabledForSite(origin)
        ]).then(([disabled, autoReply]) => {
          setIsDisabled(disabled);
          setIsAutoReplyEnabled(autoReply);
        });
      } catch (error) {
        console.error("Unable to parse tab URL:", error);
        setCurrentOrigin(undefined);
        setCurrentUrl(undefined);
        setIsDisabled(null);
        setIsAutoReplyEnabled(null);
      }
    });
  }, []);

  const handleToggleExtension = async () => {
    if (!currentOrigin || activeTabId === undefined || isDisabled === null) return;
    const nextDisabled = !isDisabled;
    
    try {
      if (nextDisabled) {
        await addDisabledSite(currentOrigin);
      } else {
        await removeDisabledSite(currentOrigin);
      }
      
      setIsDisabled(nextDisabled);
      chrome.tabs.sendMessage(activeTabId, {
        action: "setExtensionEnabled",
        enabled: !nextDisabled,
      });
    } catch (error) {
      console.error("Failed to toggle extension:", error);
    }
  };

  const handleToggleAutoReply = async () => {
    if (!currentOrigin || activeTabId === undefined || isAutoReplyEnabled === null) return;
    const nextAutoReplyEnabled = !isAutoReplyEnabled;
    
    try {
      if (nextAutoReplyEnabled) {
        await addAutoReplySite(currentOrigin);
      } else {
        await removeAutoReplySite(currentOrigin);
      }
      setIsAutoReplyEnabled(nextAutoReplyEnabled);
    } catch (error) {
      console.error("Failed to toggle auto-reply:", error);
    }
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleSubmitIssue = () => {
    if (!currentUrl) return;
    const title =  `Report an issue on ${new URL(currentUrl).hostname}`;
    const url = `https://github.com/stonega/ainput/issues/new?title=${encodeURIComponent(title)}`;
    chrome.tabs.create({ url });
  };

  const isLoading = isDisabled === null || !currentOrigin || activeTabId === undefined;

  return (
    <div style={{ padding: "16px", minHeight: "200px", display: "flex", flexDirection: "column" }}>
      <GlobalStyles extraCss="width: 320px;" />
      
      {/* Header */}
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "20px",
        paddingBottom: "16px",
        borderBottom: `1px solid ${theme.colors.border}`
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: theme.colors.primary, margin: 0 }}>
            AINPUT
          </h1>
        </div>
        <button
          onClick={openOptionsPage}
          className="btn-icon"
          style={{ 
            background: "transparent", 
            border: "none", 
            cursor: "pointer", 
            padding: "8px",
            borderRadius: "50%",
            display: "flex",
            color: theme.colors.textSecondary,
            transition: "all 0.2s"
          }}
          title="Open Settings"
        >
          <IoSettingsOutline size={20} />
        </button>
      </header>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: "16px", fontSize: "13px", color: theme.colors.textSecondary }}>
          Settings for <strong style={{ color: theme.colors.text }}>{new URL(currentOrigin || "http://localhost").hostname}</strong>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: "20px", color: theme.colors.textSecondary }}>
            Loading...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <ToggleSwitch
              label={!isDisabled ? "Enabled on this site" : "Disabled on this site"}
              sublabel={!isDisabled ? "AINPUT is active" : "AINPUT is turned off"}
              enabled={!isDisabled}
              onToggle={handleToggleExtension}
              icon={<FaPowerOff />}
            />
            
            <ToggleSwitch
              label="Auto-Reply"
              sublabel="Automatically suggest replies"
              enabled={isAutoReplyEnabled || false}
              onToggle={handleToggleAutoReply}
              disabled={isDisabled || false}
              icon={<FaRobot />}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${theme.colors.border}`, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={handleSubmitIssue}
            className="btn-icon"
            style={{
              background: "none",
              border: "none",
              color: theme.colors.textSecondary,
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px",
              borderRadius: theme.borderRadius.md,
            }}
            title="Submit an issue on GitHub"
          >
            <FaExclamationCircle size={13} /> Submit issue
          </button>
          <button
            onClick={openOptionsPage}
            style={{
              background: "none",
              border: "none",
              color: theme.colors.primary,
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            More settings <FaExternalLinkAlt size={10} />
          </button>
        </div>
      </footer>
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
