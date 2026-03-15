/**
 * Universal Dark Mode – Background Service Worker
 *
 * Responsibilities:
 * - On extension install/update: set default storage values.
 * - When a tab navigates to a new URL: push the correct enabled state
 *   to the content script once it's ready.
 * - When the popup broadcasts GLOBAL_CHANGED: propagate to all tabs.
 */

const DEFAULT_GLOBAL = true;

// --- Install / update ---
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await chrome.storage.local.set({ globalEnabled: DEFAULT_GLOBAL });
  }
});

// --- Helper: get effective enabled state for a hostname ---
async function getEffectiveEnabled(hostname) {
  const siteKey = `site:${hostname}`;
  const result  = await chrome.storage.local.get(['globalEnabled', siteKey]);
  const globalEnabled = result['globalEnabled'] !== false;
  const siteOverride  = result[siteKey];
  return siteOverride !== undefined ? siteOverride : globalEnabled;
}

// --- Push dark-mode state to a specific tab ---
async function pushToTab(tabId, hostname) {
  const enabled = await getEffectiveEnabled(hostname);
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SET_SITE', hostname, enabled });
  } catch {
    // Content script may not be injected yet (e.g. on chrome:// pages); ignore.
  }
}

// --- Tab events: push state when page finishes loading ---
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  try {
    const { hostname } = new URL(tab.url);
    if (!hostname) return;
    await pushToTab(tabId, hostname);
  } catch {
    // Non-http URLs (e.g. chrome://) – ignore.
  }
});

// --- Message from popup: global toggle changed, notify all tabs ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GLOBAL_CHANGED') {
    (async () => {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;
        try {
          const { hostname } = new URL(tab.url);
          if (!hostname) continue;
          const siteKey    = `site:${hostname}`;
          const result     = await chrome.storage.local.get([siteKey]);
          const override   = result[siteKey];
          const effective  = override !== undefined ? override : msg.globalEnabled;
          await chrome.tabs.sendMessage(tab.id, {
            type: 'SET_SITE',
            hostname,
            enabled: effective,
          }).catch(() => {});
        } catch {
          // ignore
        }
      }
      sendResponse({ ok: true });
    })();
    return true; // async response
  }
});
