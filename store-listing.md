# Chrome Web Store Listing – Universal Dark Mode

## Name
Universal Dark Mode

## Short Description (up to 132 characters)
Force dark mode on any website. Global toggle + per-site control. No ads, no tracking, no accounts.

## Full Description
Universal Dark Mode gives you instant dark mode on every website — even ones that don't support it natively.

**How it works**
The extension applies a smart CSS filter that inverts the page colours and corrects hue, making any site dark without breaking images, videos, or iframes. It works immediately on page load, before any content flashes on screen.

**Features**
- 🌑 Global on/off toggle — enable or disable dark mode everywhere in one click
- 🌐 Per-site overrides — whitelist or force-enable specific sites independently of the global setting
- ⚡ Zero flash — the style is injected at document_start, before paint
- 🖼️ Smart image/video handling — photos, videos, and iframes are re-inverted so colours look natural
- 🔒 Fully local — no accounts, no servers, no telemetry. All preferences are stored locally on your device
- 🪶 Lightweight — no dependencies, no build step, ~5 KB total

**Privacy**
This extension stores your preferences (global toggle and per-site settings) exclusively in your browser's local storage. Nothing is ever transmitted off your device.

---

## Category
Productivity (or Accessibility)

## Language
English

---

## Permission Justifications

### `storage`
Used to persist the global dark mode toggle and per-site overrides in `chrome.storage.local`. No data is sent to any server.

### `activeTab`
Used to read the hostname of the currently active tab so the popup can show the correct per-site toggle state.

### `scripting`
Used to programmatically apply or remove the dark mode CSS style on the active tab when the user changes the toggle in the popup.

### `<all_urls>` (host permission)
The extension must be able to inject its dark mode style into any website the user visits. Without broad host access, dark mode cannot work across all sites.

---

## Screenshots (take these manually)

Suggested shots (1280×800 or 640×400):
1. A popular site (e.g. Wikipedia) with dark mode ON — show the inverted page
2. The popup open on a site, showing the global + per-site toggles
3. Side-by-side: same site with dark mode OFF vs ON
4. A media-heavy site (e.g. a news homepage) to show images look natural

---

## Promo Tile
See `promo-tile.png` (440×280) generated alongside this file.
