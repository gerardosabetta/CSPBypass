document.addEventListener("DOMContentLoaded", () => {
  /**
   * Elements from the DOM
   */
  const searchInput = document.getElementById("search");
  const resultsList = document.getElementById("results");
  const copyStatus = document.getElementById("copy-status"); // Screen‑reader only
  const toast = document.getElementById("toast"); // Visible toast

  /**
   * Data variables
   */
  let tsvData = [];
  let debounceTimeout;

  /**
   * Encodes a string to prevent HTML injection.
   * @param {string} str - The string to encode.
   * @returns {string} - The encoded string.
   */
  const htmlEncode = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };

  /**
   * Debounces a function to limit the rate at which it can fire.
   * @param {Function} func - The function to debounce.
   * @param {number} delay - The delay in milliseconds.
   * @returns {Function} - The debounced function.
   */
  const debounce = (func, delay) => {
    return (...args) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => func(...args), delay);
    };
  };

  /**
   * Parses TSV data into an array of objects.
   * @param {string} tsv - The TSV data as a string.
   * @returns {Array} - An array of parsed objects.
   */
  const parseTSV = (tsv) => {
    return (
      tsv
        .trim()
        // Split on newlines, then ignore the first line (which is presumably headers)
        .split("\n")
        .slice(1)
        .map((line) => {
          line = line.trim();
          // This regex captures:
          //   ^(\S+)       => first sequence of non-whitespace (domain)
          //   \s+          => the first block of whitespace
          //   (.*)         => everything else (the code) as the second capture
          const match = line.match(/^(\S+)\s+(.*)$/);

          // If the line doesn't match our pattern, skip it
          if (!match) return null;

          // match[1] = domain, match[2] = entire code block
          const domain = match[1];
          const code = match[2];

          return domain && code
            ? {
                domain,
                code,
              }
            : null;
        })
        .filter(Boolean)
    );
  };

  /**
   * Shows a short-lived toast message.
   * @param {string} message - The message to display.
   */
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(
      () => toast.classList.remove("show"),
      1500
    );
  };

  /**
   * Fetches TSV data from GitHub with 6-hour caching.
   * @returns {Promise<string>} - The TSV data as a string.
   */
  const fetchTSVData = async () => {
    const CACHE_KEY = "cspbypass_data";
    const CACHE_TIMESTAMP_KEY = "cspbypass_data_timestamp";
    const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    const DATA_URL =
      "https://raw.githubusercontent.com/renniepak/CSPBypass/refs/heads/main/data.tsv";

    try {
      // Check cache
      const cacheResult = await chrome.storage.local.get([
        CACHE_KEY,
        CACHE_TIMESTAMP_KEY,
      ]);
      const cachedData = cacheResult[CACHE_KEY];
      const cacheTimestamp = cacheResult[CACHE_TIMESTAMP_KEY];
      const now = Date.now();

      // Return cached data if it's still valid
      if (
        cachedData &&
        cacheTimestamp &&
        now - cacheTimestamp < CACHE_DURATION
      ) {
        console.log("Using cached data");
        return cachedData;
      }

      // Fetch fresh data
      console.log("Fetching fresh data from GitHub");
      const response = await fetch(DATA_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.text();

      // Cache the data
      await chrome.storage.local.set({
        [CACHE_KEY]: data,
        [CACHE_TIMESTAMP_KEY]: now,
      });

      return data;
    } catch (error) {
      console.error("Error fetching TSV data:", error);
      // Try to return cached data even if expired
      const cacheResult = await chrome.storage.local.get([CACHE_KEY]);
      if (cacheResult[CACHE_KEY]) {
        console.log("Using expired cache as fallback");
        return cacheResult[CACHE_KEY];
      }
      throw error;
    }
  };

  /**
   * Displays the search results in the results list.
   * @param {Array} data - The data to display.
   */
  const displayResults = (data) => {
    resultsList.innerHTML = data.length
      ? data
          .map(
            (item) =>
              `<li><strong>${htmlEncode(
                item.domain
              )}</strong><br><br><span class="code">${htmlEncode(
                item.code
              )}</span></li>`
          )
          .join("")
      : "<li>No results found</li>";
  };

  /**
   * Copy handler (event delegation on the results <ul>).
   */
  resultsList.addEventListener("click", (event) => {
    const li = event.target.closest("li");
    if (!li || !resultsList.contains(li)) return;

    const codeSpan = li.querySelector(".code");
    if (!codeSpan) return;

    const payload = codeSpan.textContent;

    navigator.clipboard
      .writeText(payload)
      .then(() => {
        // Visual feedback
        li.classList.add("copied");
        setTimeout(() => li.classList.remove("copied"), 800);
        showToast("Payload copied 📋");
        // Screen‑reader feedback
        copyStatus.textContent = "Payload copied";
      })
      .catch((err) => console.error("Clipboard copy failed:", err));
  });

  /**
   * Processes script-src or default-src directives.
   * @param {string} cspDirective - The CSP directive string.
   * @returns {Array} - An array of processed items.
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
   * Filters the data based on query items and displays the results.
   * @param {Array} queryItems - The items to filter by.
   */
  const filterAndDisplay = (queryItems) => {
    const results = tsvData.filter((data) =>
      queryItems.some(
        (item) => data.domain.includes(item) || data.code.includes(item)
      )
    );
    displayResults(results);
    // Notify background worker of the count
    updateBadgeCount(results.length);
  };

  /**
   * Applies the search logic based on the query.
   * @param {string} query - The search query.
   */
  const applySearch = (query) => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      resultsList.innerHTML = "";
      updateBadgeCount(0);
      return;
    }

    if (
      trimmedQuery.includes("script-src") ||
      trimmedQuery.includes("default-src")
    ) {
      const directive = trimmedQuery.includes("script-src")
        ? "script-src"
        : "default-src";
      const cspDirective = trimmedQuery
        .split(directive)[1]
        ?.split(";")[0]
        ?.trim();
      if (cspDirective) {
        const processedItems = processCSPDirective(cspDirective);
        filterAndDisplay(processedItems);
        return;
      }
    }

    const results = tsvData.filter(
      (item) =>
        item.domain.toLowerCase().includes(trimmedQuery) ||
        item.code.toLowerCase().includes(trimmedQuery)
    );
    displayResults(results);
    // Notify background worker of the count
    updateBadgeCount(results.length);
  };

  /**
   * Updates the badge count in the background worker.
   * @param {number} count - The number of bypasses found.
   */
  const updateBadgeCount = (count) => {
    chrome.runtime
      .sendMessage({
        action: "setBypassCount",
        count: count,
      })
      .catch((err) => console.error("Error updating badge:", err));
  };

  /**
   * Fetches CSP from the current page.
   * @returns {Promise<Object|null>} - The CSP result object with csp, source, and optional message/error.
   */
  const fetchCSPFromCurrentPage = async () => {
    try {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getCSP" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error fetching CSP:", chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response || null);
          }
        });
      });
    } catch (error) {
      console.error("Error fetching CSP:", error);
      return null;
    }
  };

  /**
   * Initializes the application by loading data and setting up event listeners.
   */
  const initialize = async () => {
    try {
      // Fetch data from GitHub with caching
      const data = await fetchTSVData();
      tsvData = parseTSV(data);

      // Try to get CSP from current page first
      const cspResult = await fetchCSPFromCurrentPage();
      if (cspResult && cspResult.csp) {
        searchInput.value = cspResult.csp;
        applySearch(cspResult.csp);
        const sourceText =
          cspResult.source === "meta"
            ? "meta tag"
            : cspResult.source === "http-header"
            ? "HTTP header"
            : "current page";
        showToast(`CSP detected from ${sourceText}`);
      } else {
        // Fallback to stored query if no CSP found
        chrome.storage.local.get(["lastQuery"], (result) => {
          if (result.lastQuery) {
            searchInput.value = result.lastQuery;
            applySearch(result.lastQuery);
          } else {
            // Show helpful message if no CSP and no stored query
            if (cspResult && cspResult.message) {
              showToast(cspResult.message);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error loading TSV data:", error);
    }

    // Note: Input is readonly, so we don't need to listen for input events
    // Search is automatically triggered when CSP is loaded
  };

  // Start the application
  initialize();
});
