// Service worker to extract CSP from pages and show badge with bypass count

// Store CSP headers by tab ID (from HTTP headers)
const cspHeaders = new Map();
// Store bypass counts by tab ID
const bypassCounts = new Map();

/**
 * Parses TSV data into an array of objects.
 */
const parseTSV = (tsv) => {
  return tsv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      line = line.trim();
      const match = line.match(/^(\S+)\s+(.*)$/);
      if (!match) return null;
      const domain = match[1];
      const code = match[2];
      return domain && code ? { domain, code } : null;
    })
    .filter(Boolean);
};

/**
 * Processes script-src or default-src directives.
 */
const processCSPDirective = (cspDirective) => {
  const items = cspDirective.split(" ").flatMap((item) => {
    if (item.includes("*")) {
      const cleanItem = item
        .replace(/https?:\/\//, "")
        .split("*")
        .slice(-2)
        .join("");
      return [cleanItem.startsWith(".") ? cleanItem : "." + cleanItem];
    }
    return item.includes(".") ? item : [];
  });
  return Array.from(new Set(items));
};

/**
 * Counts bypasses for a given CSP.
 */
const countBypasses = (csp, tsvData) => {
  if (!csp || !tsvData || tsvData.length === 0) return 0;

  const trimmedCSP = csp.trim().toLowerCase();
  if (!trimmedCSP) return 0;

  // Check if it's a CSP directive
  if (trimmedCSP.includes("script-src") || trimmedCSP.includes("default-src")) {
    const directive = trimmedCSP.includes("script-src")
      ? "script-src"
      : "default-src";
    const cspDirective = trimmedCSP.split(directive)[1]?.split(";")[0]?.trim();
    if (cspDirective) {
      const processedItems = processCSPDirective(cspDirective);
      const results = tsvData.filter((data) =>
        processedItems.some(
          (item) => data.domain.includes(item) || data.code.includes(item)
        )
      );
      return results.length;
    }
  }

  // Regular search
  const results = tsvData.filter(
    (item) =>
      item.domain.toLowerCase().includes(trimmedCSP) ||
      item.code.toLowerCase().includes(trimmedCSP)
  );
  return results.length;
};

/**
 * Updates the badge for a specific tab.
 */
const updateBadgeForTab = async (tabId) => {
  if (!tabId) return;

  const count = bypassCounts.get(tabId) || 0;
  if (count > 0) {
    // Set badge text (Chrome limits to 4 characters)
    const badgeText = count > 999 ? "999+" : count.toString();
    await chrome.action.setBadgeText({ text: badgeText, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: "#66f0a7", tabId });
  } else {
    // Clear badge
    await chrome.action.setBadgeText({ text: "", tabId });
  }
};

/**
 * Updates the badge for the active tab.
 */
const updateBadgeForActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]) {
    await updateBadgeForTab(tabs[0].id);
  }
};

/**
 * Fetches TSV data and calculates bypass count for a CSP.
 */
const calculateBypassCount = async (csp, tabId) => {
  if (!csp) {
    bypassCounts.set(tabId, 0);
    await updateBadgeForTab(tabId);
    return;
  }

  try {
    const CACHE_KEY = "cspbypass_data";
    const CACHE_TIMESTAMP_KEY = "cspbypass_data_timestamp";
    const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
    const DATA_URL =
      "https://raw.githubusercontent.com/renniepak/CSPBypass/refs/heads/main/data.tsv";

    // Get cached data
    const cacheResult = await chrome.storage.local.get([
      CACHE_KEY,
      CACHE_TIMESTAMP_KEY,
    ]);
    const cachedData = cacheResult[CACHE_KEY];
    const cacheTimestamp = cacheResult[CACHE_TIMESTAMP_KEY];
    const now = Date.now();

    let tsvData;
    if (cachedData && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
      tsvData = parseTSV(cachedData);
    } else {
      // Fetch fresh data
      const response = await fetch(DATA_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.text();
      tsvData = parseTSV(data);

      // Cache it
      await chrome.storage.local.set({
        [CACHE_KEY]: data,
        [CACHE_TIMESTAMP_KEY]: now,
      });
    }

    // Calculate bypass count
    const count = countBypasses(csp, tsvData);
    bypassCounts.set(tabId, count);
    await updateBadgeForTab(tabId);
  } catch (error) {
    console.error("Error calculating bypass count:", error);
    bypassCounts.set(tabId, 0);
    await updateBadgeForTab(tabId);
  }
};

// Listen for response headers to extract CSP (works in MV3 with proper permissions)
chrome.webRequest.onHeadersReceived.addListener(
  async (details) => {
    // Only process main frame requests
    if (details.type !== "main_frame") {
      return;
    }

    // Look for Content-Security-Policy or Content-Security-Policy-Report-Only headers
    const cspHeader = details.responseHeaders?.find(
      (header) =>
        header.name.toLowerCase() === "content-security-policy" ||
        header.name.toLowerCase() === "content-security-policy-report-only"
    );

    if (cspHeader && cspHeader.value) {
      cspHeaders.set(details.tabId, cspHeader.value);
      // Calculate bypass count when CSP is detected
      await calculateBypassCount(cspHeader.value, details.tabId);
    }
  },
  {
    urls: ["<all_urls>"],
    types: ["main_frame"],
  },
  ["responseHeaders"]
);

// Listen for tab activation to update badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateBadgeForTab(activeInfo.tabId);
});

// Listen for tab updates (e.g., navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    // Try to get CSP from meta tags
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const metaCSP = document.querySelector(
            'meta[http-equiv="Content-Security-Policy"]'
          );
          if (metaCSP && metaCSP.content) {
            return metaCSP.content;
          }
          const metaCSPRO = document.querySelector(
            'meta[http-equiv="Content-Security-Policy-Report-Only"]'
          );
          if (metaCSPRO && metaCSPRO.content) {
            return metaCSPRO.content;
          }
          return null;
        },
      });

      if (results && results[0] && results[0].result) {
        await calculateBypassCount(results[0].result, tabId);
      } else {
        // Check HTTP headers
        const headerCSP = cspHeaders.get(tabId);
        if (headerCSP) {
          await calculateBypassCount(headerCSP, tabId);
        } else {
          bypassCounts.set(tabId, 0);
          await updateBadgeForTab(tabId);
        }
      }
    } catch (error) {
      // Page might not be accessible (e.g., chrome:// pages)
      const headerCSP = cspHeaders.get(tabId);
      if (headerCSP) {
        await calculateBypassCount(headerCSP, tabId);
      } else {
        bypassCounts.set(tabId, 0);
        await updateBadgeForTab(tabId);
      }
    }
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  cspHeaders.delete(tabId);
  bypassCounts.delete(tabId);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCSP") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || !tabs[0]) {
        sendResponse({ csp: null });
        return;
      }

      const tabId = tabs[0].id;

      // First check if we have CSP from HTTP headers
      const headerCSP = cspHeaders.get(tabId);

      try {
        // Try to get CSP from meta tags (more reliable and works immediately)
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // Check for meta tag CSP
            const metaCSP = document.querySelector(
              'meta[http-equiv="Content-Security-Policy"]'
            );
            if (metaCSP && metaCSP.content) {
              return { source: "meta", csp: metaCSP.content };
            }

            // Check for report-only meta tag
            const metaCSPRO = document.querySelector(
              'meta[http-equiv="Content-Security-Policy-Report-Only"]'
            );
            if (metaCSPRO && metaCSPRO.content) {
              return { source: "meta-report-only", csp: metaCSPRO.content };
            }

            return null;
          },
        });

        // Meta tag CSP takes precedence
        if (
          results &&
          results[0] &&
          results[0].result &&
          results[0].result.csp
        ) {
          sendResponse({
            csp: results[0].result.csp,
            source: results[0].result.source,
          });
        } else if (headerCSP) {
          // Fallback to HTTP header CSP
          sendResponse({
            csp: headerCSP,
            source: "http-header",
          });
        } else {
          sendResponse({
            csp: null,
            message:
              "No CSP found. The page may not have a Content Security Policy set.",
          });
        }
      } catch (error) {
        // Page might be a chrome:// page or not accessible
        // Try HTTP header as fallback
        if (headerCSP) {
          sendResponse({
            csp: headerCSP,
            source: "http-header",
          });
        } else {
          console.error("Error getting CSP:", error);
          sendResponse({
            csp: null,
            error: error.message,
          });
        }
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "updateBadge") {
    // Allow popup to trigger badge update
    updateBadgeForActiveTab();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "setBypassCount") {
    // Set bypass count from popup
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs && tabs[0]) {
        const tabId = tabs[0].id;
        bypassCounts.set(tabId, request.count || 0);
        await updateBadgeForTab(tabId);
      }
    });
    sendResponse({ success: true });
    return true;
  }
});
