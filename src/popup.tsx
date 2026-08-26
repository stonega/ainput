import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IoSettingsOutline } from "react-icons/io5";
import { FaExclamationCircle } from "react-icons/fa";
import { theme, GlobalStyles } from "./theme";

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  enabled,
  onToggle,
  disabled = false,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    disabled={disabled}
    onClick={onToggle}
    className="popup-switch"
    style={{
      position: "relative",
      width: "48px",
      height: "28px",
      padding: 0,
      flex: "0 0 auto",
      border: `1px solid ${enabled ? theme.colors.primary : "#cbd5e1"}`,
      borderRadius: theme.borderRadius.full,
      backgroundColor: enabled ? theme.colors.primary : "#cbd5e1",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.58 : 1,
      transition: "background-color 180ms ease, border-color 180ms ease",
    }}
  >
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "3px",
        left: enabled ? "23px" : "3px",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        backgroundColor: theme.colors.surface,
        boxShadow: "0 2px 5px rgba(15, 23, 42, 0.2)",
        transition: "left 180ms ease",
      }}
    />
  </button>
);

export const Popup = () => {
  const [currentOrigin, setCurrentOrigin] = useState<string>();
  const [currentUrl, setCurrentUrl] = useState<string>();
  const [activeTabId, setActiveTabId] = useState<number>();
  const [isDisabled, setIsDisabled] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!mounted) return;

      const tab = tabs[0];
      setCurrentUrl(tab?.url);

      if (!tab?.url || tab.id === undefined) {
        setIsLoading(false);
        return;
      }

      try {
        const url = new URL(tab.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          setIsLoading(false);
          return;
        }

        const origin = url.origin;
        setActiveTabId(tab.id);
        setCurrentOrigin(origin);

        chrome.storage.sync.get(["disabledSites"], (items) => {
          if (!mounted) return;
          const disabledSites: string[] = items.disabledSites || [];
          setIsDisabled(disabledSites.includes(origin));
          setIsLoading(false);
        });
      } catch (error) {
        console.error("Unable to parse tab URL:", error);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleExtension = () => {
    if (
      !currentOrigin ||
      activeTabId === undefined ||
      isDisabled === null ||
      isSaving
    ) {
      return;
    }

    const nextDisabled = !isDisabled;
    setIsSaving(true);
    setToggleError(null);

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
          setIsSaving(false);
          if (chrome.runtime.lastError) {
            setToggleError("Unable to update this site. Try again.");
            return;
          }

          setIsDisabled(nextDisabled);
          chrome.tabs.sendMessage(activeTabId, {
            action: "setExtensionEnabled",
            enabled: !nextDisabled,
          });
        }
      );
    });
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleSubmitIssue = () => {
    const hostname = currentUrl ? new URL(currentUrl).hostname : "";
    const title = hostname
      ? `Report an issue on ${hostname}`
      : "Report an issue";
    const url = `https://github.com/stonega/ainput/issues/new?title=${encodeURIComponent(
      title
    )}`;
    chrome.tabs.create({ url });
  };

  const hostname = currentOrigin
    ? new URL(currentOrigin).hostname.replace(/^www\./, "")
    : "This browser page";
  const isAvailable =
    currentOrigin !== undefined &&
    activeTabId !== undefined &&
    isDisabled !== null;
  const isEnabled = isAvailable && !isDisabled;

  const statusTitle = isLoading
    ? "Checking this site"
    : !isAvailable
    ? "Unavailable on this page"
    : isEnabled
    ? "Active on this site"
    : "Paused on this site";

  const statusDescription = isLoading
    ? "Loading your site preferences…"
    : !isAvailable
    ? "Open a regular webpage to use AInput."
    : isEnabled
    ? "AI actions are ready in supported input fields."
    : "AInput is hidden until you turn it back on.";

  return (
    <div
      style={{
        width: "360px",
        minHeight: "285px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.colors.background,
      }}
    >
      <GlobalStyles extraCss="width: 360px; min-width: 360px;" />
      <style>{`
        button { font: inherit; }
        button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 177, 242, 0.2);
        }
        .popup-icon-button:hover {
          color: ${theme.colors.primary} !important;
          border-color: #bae6fd !important;
          background: #f0f9ff !important;
        }
        .popup-link:hover {
          color: ${theme.colors.primary} !important;
          background: #e0f2fe !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .popup-switch, .popup-switch span { transition: none !important; }
        }
      `}</style>

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: theme.colors.text,
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            AINPUT
          </h1>
          <p
            style={{
              margin: "3px 0 0",
              color: theme.colors.textSecondary,
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            Make every input intelligent
          </p>
        </div>

        <button
          type="button"
          onClick={openOptionsPage}
          className="popup-icon-button"
          aria-label="Open AInput settings"
          title="Open AInput settings"
          style={{
            width: "36px",
            height: "36px",
            padding: 0,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.md,
            backgroundColor: theme.colors.surface,
            color: theme.colors.textSecondary,
            cursor: "pointer",
            boxShadow: theme.shadows.sm,
            transition: "all 160ms ease",
          }}
        >
          <IoSettingsOutline size={19} />
        </button>
      </header>

      <section
        aria-label="Current site status"
        style={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.xl,
          backgroundColor: theme.colors.surface,
          boxShadow: theme.shadows.sm,
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                color: theme.colors.textSecondary,
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Current site
            </span>
            <span
              aria-hidden="true"
              style={{
                width: "3px",
                height: "3px",
                flex: "0 0 auto",
                borderRadius: "50%",
                backgroundColor: "#cbd5e1",
              }}
            />
            <span
              title={hostname}
              style={{
                overflow: "hidden",
                color: theme.colors.text,
                fontSize: "13px",
                fontWeight: 650,
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {hostname}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                color: theme.colors.text,
                fontSize: "14px",
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {statusTitle}
            </div>
            <div
              style={{
                maxWidth: "220px",
                marginTop: "4px",
                color: theme.colors.textSecondary,
                fontSize: "11px",
                lineHeight: 1.45,
              }}
            >
              {statusDescription}
            </div>
          </div>

          <ToggleSwitch
            label={
              isEnabled
                ? "Disable AInput on this site"
                : "Enable AInput on this site"
            }
            enabled={isEnabled}
            disabled={!isAvailable || isLoading || isSaving}
            onToggle={handleToggleExtension}
          />
        </div>

        {toggleError && (
          <div
            role="alert"
            style={{
              margin: "0 16px 16px",
              padding: "9px 10px",
              border: "1px solid #fecaca",
              borderRadius: theme.borderRadius.md,
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            {toggleError}
          </div>
        )}
      </section>

      <footer
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          type="button"
          onClick={handleSubmitIssue}
          className="popup-link"
          style={{
            padding: "8px 9px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            border: "none",
            borderRadius: theme.borderRadius.md,
            background: "transparent",
            color: theme.colors.textSecondary,
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            transition: "all 160ms ease",
          }}
        >
          <FaExclamationCircle size={12} /> Report an issue
        </button>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: isEnabled
              ? theme.colors.primary
              : theme.colors.textSecondary,
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: isEnabled ? theme.colors.primary : "#94a3b8",
              boxShadow: isEnabled
                ? "0 0 0 3px rgba(0, 177, 242, 0.12)"
                : "none",
            }}
          />
          {isEnabled ? "Ready" : "Standby"}
        </span>
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
