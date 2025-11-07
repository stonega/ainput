import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [count, setCount] = useState(0);
  const [currentURL, setCurrentURL] = useState<string>();
  const [currentOrigin, setCurrentOrigin] = useState<string>();
  const [activeTabId, setActiveTabId] = useState<number>();
  const [isDisabled, setIsDisabled] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.action.setBadgeText({ text: count.toString() });
  }, [count]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];

      if (!tab || !tab.url) {
        setCurrentURL(undefined);
        setCurrentOrigin(undefined);
        setActiveTabId(undefined);
        setIsDisabled(null);
        return;
      }

      setCurrentURL(tab.url);
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
    <>
      <ul style={{ minWidth: "700px" }}>
        <li>Current URL: {currentURL}</li>
        <li>Current Time: {new Date().toLocaleTimeString()}</li>
        <li>
          Extension on this page:{" "}
          {isDisabled === null
            ? "Loading..."
            : isDisabled
            ? "Disabled"
            : "Enabled"}
        </li>
      </ul>
      <button
        onClick={() => setCount(count + 1)}
        style={{ marginRight: "5px" }}
      >
        count up
      </button>
      <button onClick={changeBackground} style={{ marginRight: "5px" }}>
        change background
      </button>
      <button
        onClick={handleToggleExtension}
        disabled={isDisabled === null || !currentOrigin || activeTabId === undefined}
      >
        {isDisabled ? "Enable on this page" : "Disable on this page"}
      </button>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
