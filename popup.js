/* popup.js – controls for the Universal Dark Mode extension */

const globalToggle = document.getElementById('global-toggle');
const siteToggle   = document.getElementById('site-toggle');
const siteNameEl   = document.getElementById('site-name');

let currentTab   = null;
let currentHost  = '';

// --- Helpers ---

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function sendToContent(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (resp) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(resp);
    });
  });
}

// Compute whether dark mode should be active for a given host,
// given globalEnabled and optional siteOverride.
function computeEnabled(globalEnabled, siteOverride) {
  if (siteOverride !== undefined) return siteOverride;
  return globalEnabled;
}

// --- Initialise popup state ---

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab  = tab;

  try {
    const url = new URL(tab.url || '');
    currentHost = url.hostname;
  } catch {
    currentHost = '';
  }

  siteNameEl.textContent = currentHost || 'this page';

  const siteKey = `site:${currentHost}`;
  const result  = await storageGet(['globalEnabled', siteKey]);

  const globalEnabled = result['globalEnabled'] !== false; // default true
  const siteOverride  = result[siteKey];                  // undefined | true | false

  globalToggle.checked = globalEnabled;
  siteToggle.checked   = computeEnabled(globalEnabled, siteOverride);
}

// --- Event listeners ---

globalToggle.addEventListener('change', async () => {
  const globalEnabled = globalToggle.checked;
  await storageSet({ globalEnabled });

  // Re-read site override to compute effective state for this site
  const siteKey  = `site:${currentHost}`;
  const result   = await storageGet([siteKey]);
  const siteOverride = result[siteKey];

  const effective = computeEnabled(globalEnabled, siteOverride);
  siteToggle.checked = effective;

  // Notify all tabs (background will handle it)
  chrome.runtime.sendMessage({ type: 'GLOBAL_CHANGED', globalEnabled });
});

siteToggle.addEventListener('change', async () => {
  const siteEnabled = siteToggle.checked;
  const siteKey     = `site:${currentHost}`;

  // Store override only when it differs from global; otherwise clear it
  const result        = await storageGet(['globalEnabled']);
  const globalEnabled = result['globalEnabled'] !== false;

  if (siteEnabled === globalEnabled) {
    // No need for an override – remove it to keep storage clean
    await new Promise((resolve) => chrome.storage.local.remove(siteKey, resolve));
  } else {
    await storageSet({ [siteKey]: siteEnabled });
  }

  // Push state to active tab's content script
  if (currentTab?.id) {
    await sendToContent(currentTab.id, {
      type: 'SET_SITE',
      hostname: currentHost,
      enabled: siteEnabled,
    });
  }
});

init();
