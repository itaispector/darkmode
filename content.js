/**
 * Universal Dark Mode - Content Script
 *
 * Strategy:
 * 1. Detect whether the page is already dark using multiple heuristics.
 * 2. Only inject the CSS inversion filter if the page appears light.
 * 3. Re-invert images, videos, iframes, canvases and SVGs so they keep their
 *    natural colours (double-invert = original).
 * 4. Listen for messages from the popup / background to toggle on/off per-site.
 * 5. Persist the per-site preference via chrome.storage.local.
 */

const STYLE_ID = 'universal-dark-mode-style';

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

// --- Theme detection helpers ---

/**
 * Calculate WCAG relative luminance for an RGB colour.
 * Returns a value between 0 (black) and 1 (white).
 */
function relativeLuminance(r, g, b) {
  return [r, g, b].reduce((lum, c, i) => {
    const s = c / 255;
    const linear = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    return lum + linear * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

/**
 * Parse the computed background-color of an element and return its luminance,
 * or null if the colour is transparent / unset.
 */
function elementBgLuminance(el) {
  if (!el) return null;
  const bg = window.getComputedStyle(el).backgroundColor;
  const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
  if (alpha < 0.05) return null; // effectively transparent
  return relativeLuminance(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
}

/**
 * Inspect the page using multiple signals to decide whether it already
 * presents a dark colour scheme to the user.
 *
 * Returns true  → page is already dark, do NOT invert.
 * Returns false → page is light, safe to invert.
 */
function pageIsAlreadyDark() {
  const root = document.documentElement;
  const body = document.body;

  // 1. CSS `color-scheme` property on the root element (modern standard).
  const computedCS = (window.getComputedStyle(root).colorScheme || '').toLowerCase();
  if (computedCS.includes('dark') && !computedCS.includes('light')) return true;

  // 2. <meta name="color-scheme"> tag.
  const metaCS = document.querySelector('meta[name="color-scheme"]');
  if (metaCS) {
    const content = (metaCS.getAttribute('content') || '').toLowerCase();
    if (content.includes('dark') && !content.includes('light')) return true;
  }

  // 3. Common class / data-attribute conventions used by popular frameworks.
  for (const el of [root, body]) {
    if (!el) continue;
    const cls        = (el.className                              || '').toLowerCase();
    const dataTheme  = (el.getAttribute('data-theme')            || '').toLowerCase();
    const dataBs     = (el.getAttribute('data-bs-theme')         || '').toLowerCase(); // Bootstrap 5
    const dataCS     = (el.getAttribute('data-color-scheme')     || '').toLowerCase();
    const combined   = `${cls} ${dataTheme} ${dataBs} ${dataCS}`;
    if (/\b(dark|night|black)\b/.test(combined)) return true;
  }

  // 4. Background luminance sampling.
  //    Luminance < 0.4 means the background is significantly darker than mid-grey.
  for (const el of [root, body]) {
    const lum = elementBgLuminance(el);
    if (lum !== null) return lum < 0.4;
  }

  // 5. Default: assume light (safe fallback — inversion on a light site is harmless).
  return false;
}

// --- Apply / remove helpers ---

function applyDarkMode() {
  if (document.getElementById(STYLE_ID)) return;

  // Adaptive check: skip inversion when the page is already dark so we
  // don't accidentally convert a dark site into a light one.
  if (pageIsAlreadyDark()) return;

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
    // Detection requires computed styles; defer until the DOM is ready.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyDarkMode, { once: true });
    } else {
      applyDarkMode();
    }
  } else {
    removeDarkMode();
  }
}

// --- Bootstrap: read stored preference for this site ---
function init() {
  const hostname = getHostname();
  chrome.storage.local.get(['globalEnabled', `site:${hostname}`], (result) => {
    const globalEnabled = result['globalEnabled'] !== false; // default true
    const siteOverride  = result[`site:${hostname}`];       // undefined | true | false

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
// Also re-run detection in case an SPA switched themes.
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
