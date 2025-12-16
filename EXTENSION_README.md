# CSP Bypass Chrome Extension

A Chrome browser extension version of CSPBypass.com - a tool designed to help ethical hackers bypass restrictive Content Security Policies (CSP) and exploit XSS vulnerabilities.

## Development

This extension is built using [Bun](https://bun.sh).

### Prerequisites

- [Bun](https://bun.sh) installed on your system

### Building the Extension

1. Install dependencies (if any):

   ```bash
   bun install
   ```

2. Build the extension:

   ```bash
   bun run build
   ```

   This will create a `dist` directory with all the extension files.

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `dist` directory from this project
5. The extension icon should appear in your Chrome toolbar

### Icons

The extension requires icon files:

- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

You can create these from the existing `cspbypass.png` file or use any 16x16, 48x48, and 128x128 pixel images. The build script will automatically generate icons if they don't exist.

### Features

- **Automatic CSP Detection**: Automatically reads CSP from the current page (meta tags and HTTP headers)
- **Live Data**: Fetches CSP bypass data from GitHub with 6-hour caching
- **Fast Search**: Search through CSP bypass gadgets by domain or code
- **CSP Directive Parsing**: Automatically parses `script-src` and `default-src` directives from detected CSP headers
- **One-Click Copy**: Click any result to copy the payload to clipboard

### File Structure

```
CSPBypass/
├── manifest.json          # Extension manifest
├── popup.html             # Extension popup UI
├── popup.js               # Extension popup logic
├── background.js          # Service worker for CSP detection
├── build.ts               # Bun build script
├── generate-icons.ts      # Icon generation script
├── package.json           # Bun package configuration
└── dist/                  # Built extension (generated)
    ├── manifest.json
    ├── popup.html
    ├── popup.js
    ├── background.js
    └── icons/
```

### Data Source

The extension fetches CSP bypass data from:

- `https://raw.githubusercontent.com/renniepak/CSPBypass/refs/heads/main/data.tsv`

Data is cached locally for 6 hours to minimize network requests. If the fetch fails, the extension will use the cached data even if expired.

## Purpose

This project is purely for **ethical purposes**. The tool and techniques shared here are intended to help security researchers, ethical hackers, and penetration testers identify potential CSP misconfigurations, responsibly disclose vulnerabilities, and improve web security overall.

**Note:** Always ensure that you have permission to test any website or system and follow all applicable laws and responsible disclosure practices.
