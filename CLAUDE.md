# Universal Dark Mode – Chrome Extension

A Manifest V3 Chrome extension that forces dark mode on any website using CSS filter inversion, with global and per-site toggles persisted via `chrome.storage.local`.

## Project Structure

```
manifest.json      # MV3 manifest – permissions, content scripts, icons
background.js      # Service worker – install defaults, tab navigation, global broadcasts
content.js         # Content script – injects/removes dark CSS, listens for messages
popup.html         # Extension popup UI – global toggle + per-site toggle
popup.js           # Popup logic – reads/writes storage, sends messages to content script
generate-icons.js  # One-off script to generate PNG icons (Node.js, run manually)
icons/             # icon16/32/48/128.png
```

## Architecture

### Dark mode mechanism
`content.js` injects a `<style>` tag with:
- `html { filter: invert(1) hue-rotate(180deg) }` – inverts the whole page
- Re-inverts `img, video, iframe, canvas, svg, picture` – restores natural colours
- A `MutationObserver` re-applies the style if SPAs replace `<head>`

### Storage schema (`chrome.storage.local`)
| Key | Type | Meaning |
|---|---|---|
| `globalEnabled` | `boolean` | Default `true`; enables dark mode on all sites |
| `site:<hostname>` | `boolean \| undefined` | Per-site override; `undefined` = follow global |

Per-site overrides take precedence over `globalEnabled`. If a site override equals the global value, it is deleted to keep storage clean.

### Message types (popup ↔ background ↔ content)
| `type` | Direction | Payload |
|---|---|---|
| `SET_SITE` | background/popup → content | `{ hostname, enabled }` |
| `GET_STATE` | popup → content | — |
| `GLOBAL_CHANGED` | popup → background | `{ globalEnabled }` |

## Development

### Loading the extension
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this directory

### Reloading after changes
- **background.js / manifest.json**: click the reload icon on `chrome://extensions`
- **content.js**: reload the target page
- **popup.html / popup.js**: close and reopen the popup

### Regenerating icons
```bash
node generate-icons.js
```
Requires Node.js; creates `icons/icon{16,32,48,128}.png`.

## Key Constraints

- **No build step** – plain ES2020 JS, no bundler, no npm. Do not introduce a build pipeline unless explicitly asked.
- **Manifest V3** – use `chrome.scripting`, `chrome.storage`, and service workers; avoid MV2 APIs (`chrome.browserAction`, persistent background pages).
- **No external dependencies** – everything runs inside the extension sandbox.
- **`chrome://` and `about:` pages** – content scripts cannot be injected there; all message sends to such tabs are silently caught and ignored.
- **`all_frames: true`** – the content script runs in iframes too; `location.hostname` is used (not `tab.url`) to key storage.

## Common Tasks

### Add a new per-site exclusion list (whitelist)
Store an array under a new key, read it in `content.js` `init()` before calling `applyState`.

### Change the default dark mode state
Edit `DEFAULT_GLOBAL` in `background.js` and the fallback in `content.js` (`globalEnabled !== false`).

### Extend the CSS
Edit `DARK_CSS` in `content.js`. The style tag is identified by `STYLE_ID = 'universal-dark-mode-style'`.
