/**
 * Universal Dark Mode - Content Script
 *
 * Strategy:
 * 1. Inject a CSS filter (invert + hue-rotate) on <html> to flip the page dark.
 * 2. Re-invert images, videos, iframes, canvases and SVGs so they keep their
 *    natural colours (double-invert = original).
 * 3. Listen for messages from the popup / background to toggle on/off per-site.
 * 4. Persist the per-site preference via chrome.storage.local.
 */

const STYLE_ID = 'universal-dark-mode-style';
const MEDIA_SELECTOR = 'img, video, iframe, canvas, svg, picture, [style*="background-image"]';

// --- CSS injected into the page ---
const DARK_CSS = `
  html {
    filter: invert(1) hue-rotate(180deg) !important;
    background: #fff !important;
  }

  /* Re-invert media so it looks natural */
  img,
  video,
  iframe,
  canvas,
  svg,
  picture,
  .no-invert {
    filter: invert(1) hue-rotate(180deg) !important;
  }

  /* Prevent double-dark on elements that already declare a dark bg */
  [style*="background-color: rgb(0"],
  [style*="background-color: #0"],
  [style*="background-color: #1"],
  [style*="background-color: #2"] {
    /* keep as-is; the top-level invert already makes them light */
  }

  /* Scrollbars */
  ::-webkit-scrollbar {
    background: #1a1a1a !important;
  }
  ::-webkit-scrollbar-thumb {
    background: #555 !important;
  }
`;

let enabled = true; // default; overridden by stored prefs

function getHostname() {
  return location.hostname;
}

function applyDarkMode() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = DARK_CSS;
  (document.head || document.documentElement).appendChild(style);
  document.documentElement.setAttribute('data-udm', 'on');
}

function removeDarkMode() {
  const el = document.getElementById(STYLE_ID);
  if (el) el.remove();
  document.documentElement.removeAttribute('data-udm');
}

function applyState(on) {
  enabled = on;
  if (on) {
    applyDarkMode();
  } else {
    removeDarkMode();
  }
}

// --- Bootstrap: read stored preference for this site ---
function init() {
  const hostname = getHostname();
  chrome.storage.local.get(['globalEnabled', `site:${hostname}`], (result) => {
    const globalEnabled = result['globalEnabled'] !== false; // default true
    const siteOverride = result[`site:${hostname}`];        // undefined | true | false

    // Site-level override takes precedence over global
    let shouldEnable;
    if (siteOverride !== undefined) {
      shouldEnable = siteOverride;
    } else {
      shouldEnable = globalEnabled;
    }

    applyState(shouldEnable);
  });
}

// --- Message listener (from popup or background) ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SET_SITE') {
    // msg.enabled: boolean, msg.hostname: string
    applyState(msg.enabled);
    sendResponse({ ok: true });
  } else if (msg.type === 'GET_STATE') {
    sendResponse({ enabled });
  }
  return true; // keep channel open for async
});

// --- Handle dynamic content: re-apply if head is replaced (SPAs) ---
const observer = new MutationObserver(() => {
  if (enabled && !document.getElementById(STYLE_ID)) {
    applyDarkMode();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.documentElement, { childList: true, subtree: false });
  });
} else {
  observer.observe(document.documentElement, { childList: true, subtree: false });
}

init();
