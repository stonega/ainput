import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
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

  return (
    <div style={{ padding: "16px", minWidth: "250px", textAlign: "center" }}>
      <p style={{ fontSize: "14px", color: "#333", marginBottom: "12px" }}>
        Control whether the extension is active on{" "}
        <strong>{currentOrigin || "this page"}</strong>.
      </p>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          cursor:
            isDisabled === null || !currentOrigin || activeTabId === undefined
              ? "not-allowed"
              : "pointer",
          opacity:
            isDisabled === null || !currentOrigin || activeTabId === undefined
              ? 0.6
              : 1,
        }}
      >
        <input
          type="checkbox"
          checked={!isDisabled}
          onChange={handleToggleExtension}
          disabled={
            isDisabled === null || !currentOrigin || activeTabId === undefined
          }
          style={{ display: "none" }}
        />
        <span
          style={{
            position: "relative",
            width: "50px",
            height: "26px",
            backgroundColor: isDisabled ? "#ccc" : "#28a745",
            borderRadius: "13px",
            transition: "background-color 0.2s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: isDisabled ? "2px" : "26px",
              width: "22px",
              height: "22px",
              backgroundColor: "white",
              borderRadius: "50%",
              transition: "left 0.2s",
            }}
          ></span>
        </span>
        <span style={{ marginLeft: "10px", userSelect: "none" }}>
          {isDisabled === null ? "Loading..." : isDisabled ? "Disabled" : "Enabled"}
        </span>
      </label>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
