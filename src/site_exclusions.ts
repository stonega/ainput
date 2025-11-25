
/**
 * Manages the list of sites where the extension is disabled or has specific settings.
 */

export const getDisabledSites = (): Promise<string[]> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["disabledSites"], (items) => {
      resolve(items.disabledSites || []);
    });
  });
};

export const setDisabledSites = (sites: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ disabledSites: sites }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

export const addDisabledSite = async (origin: string): Promise<void> => {
  const sites = await getDisabledSites();
  if (!sites.includes(origin)) {
    const updatedSites = [...sites, origin];
    await setDisabledSites(updatedSites);
  }
};

export const removeDisabledSite = async (origin: string): Promise<void> => {
  const sites = await getDisabledSites();
  const updatedSites = sites.filter((site) => site !== origin);
  await setDisabledSites(updatedSites);
};

export const isSiteDisabled = async (origin: string): Promise<boolean> => {
  const sites = await getDisabledSites();
  return sites.includes(origin);
};

// Auto-reply settings are also site-specific, so we include them here for convenience.

export const getAutoReplySites = (): Promise<string[]> => {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["autoReplySites"], (items) => {
      resolve(items.autoReplySites || []);
    });
  });
};

export const setAutoReplySites = (sites: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ autoReplySites: sites }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

export const addAutoReplySite = async (origin: string): Promise<void> => {
  const sites = await getAutoReplySites();
  if (!sites.includes(origin)) {
    const updatedSites = [...sites, origin];
    await setAutoReplySites(updatedSites);
  }
};

export const removeAutoReplySite = async (origin: string): Promise<void> => {
  const sites = await getAutoReplySites();
  const updatedSites = sites.filter((site) => site !== origin);
  await setAutoReplySites(updatedSites);
};

export const isAutoReplyEnabledForSite = async (origin: string): Promise<boolean> => {
  const sites = await getAutoReplySites();
  return sites.includes(origin);
};
