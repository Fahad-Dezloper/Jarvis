import { useState, useEffect, useRef } from "react";
import useWindowsStore from "@store/window";
import "../../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import { DEFAULT_BOOKMARKS, IFRAME_COMPATIBLE_SITES, MOCK_HISTORY } from "../data";
import {
  ARTIFACT_URL,
  START_URL,
  findMockPage,
  isCurrentPageRef,
  pickLink,
  resolveTarget,
} from "../data/pages";
import { copyText } from "../clipboard";

// The browser opens on the built-in shared artifact; Back leads to the start page.
const makeInitialTab = () => ({
  id: "tab-1",
  title: "Poker odds explained",
  url: ARTIFACT_URL,
  history: [START_URL, ARTIFACT_URL],
  historyIndex: 1,
  isReaderMode: false,
});

const isIframeable = (url) => {
  if (url.startsWith("safari://")) return true;
  if (findMockPage(url)) return true;
  const urlLower = url.toLowerCase();
  if (urlLower.includes("wikipedia.org")) return true;
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    const currentHost = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
    if (host === "localhost" || host === "127.0.0.1" || host === currentHost) {
      return true;
    }
  } catch {
    /* empty */
  }
  return IFRAME_COMPATIBLE_SITES.some((site) => urlLower.includes(site));
};

const useSafari = () => {
  const [tabs, setTabs] = useState(() => [makeInitialTab()]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [addressInput, setAddressInput] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("bookmarks"); // bookmarks, readingList, history
  const [searchEngine, setSearchEngine] = useState("Google");
  const [showDownloads, setShowDownloads] = useState(false);
  const [showTabOverview, setShowTabOverview] = useState(false);
  const [enabledSections, setEnabledSections] = useState({
    favorites: true,
    privacyReport: true,
    readingList: true,
  });
  const [bookmarks, setBookmarks] = useState(DEFAULT_BOOKMARKS);
  const [historyList, setHistoryList] = useState(MOCK_HISTORY);

  // macOS Safari Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSearchAlert, setShowSearchAlert] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [homepage, setHomepage] = useState("safari://start");
  const [showTabIcons, setShowTabIcons] = useState(true);
  const [preventTracking, setPreventTracking] = useState(true);
  const [blockCookies, setBlockCookies] = useState(false);
  const [enableJavaScript, setEnableJavaScript] = useState(true);
  const [developMenuEnabled, setDevelopMenuEnabled] = useState(false);

  // Custom reading settings
  const [readerFont, setReaderFont] = useState("serif"); // serif, sans
  const [readerTheme, setReaderTheme] = useState("sepia"); // white, sepia, gray, night
  const [readerFontSize, setReaderFontSize] = useState(16); // px

  const { closeWindow, openWindow, setWindowData } = useWindowsStore();
  const safariWindowData = useWindowsStore((state) => state.windows.safari?.data);
  const isOpen = useWindowsStore((state) => state.windows.safari?.isOpen);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);

  // Reset tabs when Safari window is closed
  useEffect(() => {
    if (!isOpen) {
      setTabs([makeInitialTab()]);
      setActiveTabId("tab-1");
      setAddressInput("");
      setShowSidebar(false);
      setShowDownloads(false);
      setShowTabOverview(false);
      setShowSettings(false);
      setShowAbout(false);
    }
  }, [isOpen]);

  // Sync addressInput with activeTab url
  useEffect(() => {
    if (activeTab) {
      if (activeTab.url === "safari://start") {
        setAddressInput("");
      } else {
        setAddressInput(activeTab.url);
      }
    }
  }, [activeTab, activeTabId]);

  // Log history
  useEffect(() => {
    if (activeTab && activeTab.url && !activeTab.url.startsWith("safari://")) {
      const title = activeTab.title || activeTab.url;
      const url = activeTab.url;
      setHistoryList((prev) => {
        if (prev.length > 0 && prev[0].url === url) return prev;
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return [{ title, url, time: timeStr }, ...prev];
      });
    }
  }, [activeTab]);

  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTabObj = {
      id: newId,
      title: "Start Page",
      url: "safari://start",
      history: ["safari://start"],
      historyIndex: 0,
      isReaderMode: false,
    };
    setTabs((prev) => [...prev, newTabObj]);
    setActiveTabId(newId);
    setShowTabOverview(false);
  };

  const handleCloseTab = (tabId, e) => {
    if (e) e.stopPropagation();
    if (tabs.length === 1) {
      // Just reset the single tab to start page
      setTabs([
        {
          id: "tab-1",
          title: "Start Page",
          url: "safari://start",
          history: ["safari://start"],
          historyIndex: 0,
          isReaderMode: false,
        },
      ]);
      setActiveTabId("tab-1");
      return;
    }
    const closeIndex = tabs.findIndex((t) => t.id === tabId);
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      const nextActiveIndex = Math.max(0, closeIndex - 1);
      setActiveTabId(nextTabs[nextActiveIndex].id);
    }
  };

  const navigateTabTo = (url) => {
    let targetUrl = url.trim();
    if (!targetUrl) return;

    const lowerQuery = targetUrl.toLowerCase();
    let isRedirected = false;
    const mockHit = findMockPage(targetUrl);

    if (mockHit) {
      targetUrl = mockHit.url;
      isRedirected = true;
    } else if (lowerQuery.includes("wikipedia")) {
      targetUrl = "https://en.wikipedia.org";
      isRedirected = true;
    } else if (lowerQuery.includes("map")) {
      targetUrl = "https://openstreetmap.org";
      isRedirected = true;
    }

    if (!isRedirected && !targetUrl.startsWith("safari://")) {
      if (!/^https?:\/\//i.test(targetUrl)) {
        const isLocal =
          lowerQuery.startsWith("localhost") ||
          lowerQuery.startsWith("127.0.0.1") ||
          lowerQuery.startsWith(window.location.host.toLowerCase()) ||
          lowerQuery.startsWith(window.location.hostname.toLowerCase());

        if (isLocal) {
          let protocol = "http://";
          if (
            lowerQuery.startsWith(window.location.host.toLowerCase()) ||
            lowerQuery.startsWith(window.location.hostname.toLowerCase())
          ) {
            protocol = window.location.protocol + "//";
          }
          targetUrl = protocol + targetUrl;
        } else if (targetUrl.includes(".") && !targetUrl.includes(" ")) {
          targetUrl = "https://" + targetUrl;
        } else {
          // search query: convert to google search URL
          targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
        }
      }
    }

    // Intercept any URLs/searches that are not iframeable
    if (!targetUrl.startsWith("safari://") && !isIframeable(targetUrl)) {
      setSearchQuery(targetUrl);
      setShowSearchAlert(true);
      return;
    }

    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === activeTabId) {
          const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
          nextHistory.push(targetUrl);

          let newTitle;
          if (mockHit) {
            newTitle = mockHit.title;
          } else if (targetUrl === "safari://start") {
            newTitle = "Start Page";
          } else if (targetUrl === "safari://privacy-report") {
            newTitle = "Privacy Report";
          } else if (targetUrl === "safari://history") {
            newTitle = "History";
          } else if (targetUrl === "safari://bookmarks") {
            newTitle = "Bookmarks";
          } else if (targetUrl === "https://en.wikipedia.org") {
            newTitle = "Wikipedia";
          } else if (targetUrl === "https://openstreetmap.org") {
            newTitle = "OpenStreetMap";
          } else if (
            targetUrl.includes("google.com/search") ||
            targetUrl.includes("duckduckgo.com") ||
            targetUrl.includes("bing.com/search") ||
            targetUrl.includes("yahoo.com/search")
          ) {
            try {
              const urlObj = new URL(targetUrl);
              const qParam = urlObj.searchParams.get("q") || urlObj.searchParams.get("p");
              const engineName = urlObj.hostname.includes("google")
                ? "Google"
                : urlObj.hostname.includes("duckduckgo")
                  ? "DuckDuckGo"
                  : urlObj.hostname.includes("bing")
                    ? "Bing"
                    : urlObj.hostname.includes("yahoo")
                      ? "Yahoo"
                      : "Web";
              newTitle = qParam ? `${qParam} - ${engineName} Search` : `${engineName} Search`;
            } catch {
              newTitle = "Search";
            }
          } else {
            try {
              const hostname = new URL(targetUrl).hostname;
              newTitle = hostname.replace("www.", "");
            } catch {
              newTitle = targetUrl;
            }
          }

          return {
            ...tab,
            url: targetUrl,
            title: newTitle,
            history: nextHistory,
            historyIndex: nextHistory.length - 1,
            isReaderMode: false, // Reset reader mode on navigation
          };
        }
        return tab;
      }),
    );
  };

  // Navigate to URL or open settings passed in window data (placed after navigateTabTo is declared)
  useEffect(() => {
    if (safariWindowData) {
      if (safariWindowData.url) {
        navigateTabTo(safariWindowData.url);
      }
      if (safariWindowData.openSettings) {
        setShowSettings(true);
      }
      if (safariWindowData.openAbout) {
        setShowAbout(true);
      }
      setWindowData("safari", null);
    }
  }, [safariWindowData]);

  const handleGoBack = () => {
    if (activeTab.historyIndex > 0) {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id === activeTabId) {
            const nextIndex = tab.historyIndex - 1;
            const nextUrl = tab.history[nextIndex];
            return {
              ...tab,
              url: nextUrl,
              historyIndex: nextIndex,
              title: getTitleForUrl(nextUrl),
              isReaderMode: false,
            };
          }
          return tab;
        }),
      );
    }
  };

  const handleGoForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      setTabs((prevTabs) =>
        prevTabs.map((tab) => {
          if (tab.id === activeTabId) {
            const nextIndex = tab.historyIndex + 1;
            const nextUrl = tab.history[nextIndex];
            return {
              ...tab,
              url: nextUrl,
              historyIndex: nextIndex,
              title: getTitleForUrl(nextUrl),
              isReaderMode: false,
            };
          }
          return tab;
        }),
      );
    }
  };

  const getTitleForUrl = (url) => {
    const mock = findMockPage(url);
    if (mock) return mock.title;
    if (url === "safari://start") return "Start Page";
    if (url === "safari://privacy-report") return "Privacy Report";
    if (url === "safari://history") return "History";
    if (url === "safari://bookmarks") return "Bookmarks";
    if (url === "https://en.wikipedia.org") return "Wikipedia";
    if (url === "https://openstreetmap.org") return "OpenStreetMap";
    if (
      url.includes("google.com/search") ||
      url.includes("duckduckgo.com") ||
      url.includes("bing.com/search") ||
      url.includes("yahoo.com/search")
    ) {
      try {
        const urlObj = new URL(url);
        const q = urlObj.searchParams.get("q") || urlObj.searchParams.get("p");
        const engineName = urlObj.hostname.includes("google")
          ? "Google"
          : urlObj.hostname.includes("duckduckgo")
            ? "DuckDuckGo"
            : urlObj.hostname.includes("bing")
              ? "Bing"
              : urlObj.hostname.includes("yahoo")
                ? "Yahoo"
                : "Web";
        return q ? `${q} - ${engineName}` : `${engineName} Search`;
      } catch {
        return "Search";
      }
    }
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "Web Page";
    }
  };

  const handleReload = () => {
    // Simulated reload effect
    const prevUrl = activeTab.url;
    navigateTabTo("safari://start");
    setTimeout(() => {
      navigateTabTo(prevUrl);
    }, 100);
  };

  const toggleReaderMode = () => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === activeTabId) {
          return { ...tab, isReaderMode: !tab.isReaderMode };
        }
        return tab;
      }),
    );
  };

  const toggleBookmark = () => {
    if (activeTab.url === "safari://start" || activeTab.url.startsWith("safari://")) return;
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
    } else {
      setBookmarks((prev) => [
        ...prev,
        {
          id: Date.now(),
          title: activeTab.title,
          url: activeTab.url,
          img: `https://www.google.com/s2/favicons?domain=${new URL(activeTab.url).hostname}&sz=32`,
        },
      ]);
    }
  };

  // Fresh state for the voice handlers (registered once, read through refs).
  const live = useRef({});
  useEffect(() => {
    live.current = { activeTab, bookmarks, navigateTabTo, handleGoBack };
  });

  useEffect(() => {
    const visibleLinks = () => {
      const out = [];
      try {
        document.querySelectorAll("#safari a[data-dk-url]").forEach((a) => {
          const label = (a.textContent || a.getAttribute("title") || "").trim();
          if (label) out.push({ label, url: a.getAttribute("data-dk-url") });
        });
      } catch {
        /* no DOM */
      }
      for (const b of live.current.bookmarks || []) out.push({ label: b.title, url: b.url });
      return out;
    };

    const unregister = registerHandlers("browser", {
      open_url: (args) => {
        try {
          const target = String(args?.url ?? "").trim();
          if (!target) return { ok: false, message: "No page or link was given." };
          const hit = resolveTarget(target, visibleLinks());
          const url = hit ? hit.url : target;
          live.current.navigateTabTo(url);
          const mock = findMockPage(url);
          const what = mock ? mock.title : url === START_URL ? "the start page" : url;
          return { ok: true, message: `Opened ${what}.` };
        } catch (err) {
          return { ok: false, message: `Could not open that page: ${err?.message || err}` };
        }
      },
      copy_link: async (args) => {
        try {
          const element = String(args?.element ?? "").trim();
          const current = live.current.activeTab;
          let url = current.url;
          let label = current.title;
          if (element && !isCurrentPageRef(element)) {
            const link = pickLink(element, visibleLinks());
            if (link) {
              url = link.url;
              label = link.label;
            } else if (pickLink(element, [{ label: current.title, url: current.url }], 30)) {
              url = current.url;
            } else {
              const mock = resolveTarget(element, []);
              if (mock) url = mock.url;
              else
                return {
                  ok: false,
                  message: `I could not find a link called "${element}" on this page.`,
                };
            }
          }
          if (url === START_URL) {
            return { ok: false, message: "The start page has no shareable link." };
          }
          const copied = await copyText(url);
          return {
            ok: true,
            message: copied
              ? `Copied ${url} to the clipboard.`
              : `Copied ${url} (held in the desktop clipboard; the system clipboard was blocked).`,
            url,
            label,
          };
        } catch (err) {
          return { ok: false, message: `Could not copy the link: ${err?.message || err}` };
        }
      },
      back: () => {
        try {
          const tab = live.current.activeTab;
          if (tab.historyIndex <= 0) return { ok: false, message: "There is no earlier page to go back to." };
          live.current.handleGoBack();
          return { ok: true, message: "Went back one page." };
        } catch (err) {
          return { ok: false, message: `Could not go back: ${err?.message || err}` };
        }
      },
    });
    const unregisterSummary = registerSummary("browser", () => {
      const tab = live.current.activeTab;
      return `Browser is showing "${tab.title}" at ${tab.url}. ${tab.historyIndex > 0 ? "Back is available." : "No earlier page."}`;
    });
    return () => {
      unregister();
      unregisterSummary();
    };
  }, []);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    addressInput,
    setAddressInput,
    showSidebar,
    setShowSidebar,
    sidebarTab,
    setSidebarTab,
    searchEngine,
    setSearchEngine,
    showDownloads,
    setShowDownloads,
    showTabOverview,
    setShowTabOverview,
    enabledSections,
    setEnabledSections,
    bookmarks,
    setBookmarks,
    historyList,
    setHistoryList,
    readerFont,
    setReaderFont,
    readerTheme,
    setReaderTheme,
    readerFontSize,
    setReaderFontSize,
    activeTab,
    isBookmarked,
    navigateTabTo,
    handleNewTab,
    handleCloseTab,
    handleGoBack,
    handleGoForward,
    handleReload,
    toggleReaderMode,
    toggleBookmark,
    isIframeable,
    closeWindow,
    openWindow,
    showSettings,
    setShowSettings,
    showAbout,
    setShowAbout,
    showSearchAlert,
    setShowSearchAlert,
    searchQuery,
    setSearchQuery,
    homepage,
    setHomepage,
    showTabIcons,
    setShowTabIcons,
    preventTracking,
    setPreventTracking,
    blockCookies,
    setBlockCookies,
    enableJavaScript,
    setEnableJavaScript,
    developMenuEnabled,
    setDevelopMenuEnabled,
  };
};

export default useSafari;
