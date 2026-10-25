import { useState, useEffect } from "react";
import useWindowsStore from "@store/window";
import "../../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import { normalizeSettingKey, parseBoolean, parseTheme } from "../data/settingsKeys";

const AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#9aa0a6"/><circle cx="48" cy="38" r="16" fill="#fff"/><path d="M16 88c4-20 20-28 32-28s28 8 32 28z" fill="#fff"/></svg>',
  );

// Local placeholder account (no network lookups).
const GUEST_PROFILE = {
  profile: { name: "Guest", login: "guest", avatar_url: AVATAR },
  repos: [],
};

const useSettings = () => {
  const { windows } = useWindowsStore();
  const windowData = windows.settings?.data;

  const [activeTab, setActiveTab] = useState("Apple ID");
  const githubData = GUEST_PROFILE;
  const isLoading = false;

  useEffect(() => {
    if (windowData?.tab) {
      setActiveTab(windowData.tab);
    }
  }, [windowData]);

  useEffect(() => {
    const store = () => useWindowsStore.getState();
    const unregister = registerHandlers("settings", {
      set_theme: (args) => {
        try {
          const theme = parseTheme(args?.theme);
          if (!theme) return { ok: false, message: 'Theme must be "light" or "dark".' };
          store().updateSystemSetting("darkMode", theme === "dark");
          return { ok: true, message: `Switched to ${theme} mode.` };
        } catch (err) {
          return { ok: false, message: `Could not change the theme: ${err?.message || err}` };
        }
      },
      set_setting: (args) => {
        try {
          const key = normalizeSettingKey(args?.key);
          if (!key) {
            return {
              ok: false,
              message: `I do not know the setting "${args?.key}". Try wifi, bluetooth, focus mode, night light or vpn.`,
            };
          }
          const value = parseBoolean(args?.value);
          if (value === null) return { ok: false, message: "I need on or off for that setting." };
          store().updateSystemSetting(key, value);
          return { ok: true, message: `Turned ${key} ${value ? "on" : "off"}.` };
        } catch (err) {
          return { ok: false, message: `Could not change the setting: ${err?.message || err}` };
        }
      },
    });
    const unregisterSummary = registerSummary("settings", () => {
      const st = store().systemSettings;
      return `${st.darkMode ? "Dark" : "Light"} mode. wifi ${st.wifi ? "on" : "off"}, bluetooth ${st.bluetooth ? "on" : "off"}, focus ${st.focusMode ? "on" : "off"}, night light ${st.nightLight ? "on" : "off"}, vpn ${st.vpn ? "on" : "off"}.`;
    });
    return () => {
      unregister();
      unregisterSummary();
    };
  }, []);

  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [mobileView, setMobileView] = useState("main");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return {
    activeTab,
    setActiveTab,
    githubData,
    isLoading,
    isMobile,
    mobileView,
    setMobileView,
  };
};

export default useSettings;
