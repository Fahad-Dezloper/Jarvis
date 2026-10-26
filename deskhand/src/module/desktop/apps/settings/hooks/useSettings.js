import { useState, useEffect } from "react";
import useWindowsStore from "@store/window";
import "../../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import { SETTING_KEYS_HELP, normalizeSettingKey, parseBoolean, parseTheme } from "../data/settingsKeys";

const AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#9aa0a6"/><circle cx="48" cy="38" r="16" fill="#fff"/><path d="M16 88c4-20 20-28 32-28s28 8 32 28z" fill="#fff"/></svg>',
  );

const WIFI_NETWORKS = ["Home Network", "Coffee Shop 5G", "Guest Hotspot", "Airport Free WiFi"];
const BT_NAMES = { keyboard: "Magic Keyboard", airpods: "AirPods Pro", mouse: "Magic Mouse", headphones: "Sony WH" };

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
              message: `I do not know the setting "${args?.key}". Try: ${SETTING_KEYS_HELP}.`,
            };
          }
          const value = parseBoolean(args?.value);
          if (value === null) return { ok: false, message: "I need on or off for that setting." };
          if (key === "airplane") {
            store().updateSystemSetting("wifi", !value);
            store().updateSystemSetting("bluetooth", !value);
            return { ok: true, message: `Airplane mode ${value ? "on: Wi-Fi and Bluetooth are off" : "off: Wi-Fi and Bluetooth are back on"}.` };
          }
          if (key === "lowPowerMode") {
            store().updateSystemSetting(key, value ? "Always" : "Never");
            return { ok: true, message: `Low Power Mode ${value ? "on" : "off"}.` };
          }
          store().updateSystemSetting(key, value);
          return { ok: true, message: `Turned ${key} ${value ? "on" : "off"}.` };
        } catch (err) {
          return { ok: false, message: `Could not change the setting: ${err?.message || err}` };
        }
      },
      get_settings: () => {
        const st = store().systemSettings;
        const onOff = (v) => (v ? "on" : "off");
        const devices = Object.entries(st.bluetoothDevices || {})
          .filter(([, v]) => v)
          .map(([k]) => BT_NAMES[k] || k);
        return {
          ok: true,
          message: "Read the system settings.",
          data: `${st.darkMode ? "Dark" : "Light"} mode; wifi ${onOff(st.wifi)}${st.wifi && st.activeWifiNetwork ? ` (${st.activeWifiNetwork})` : ""}; bluetooth ${onOff(st.bluetooth)}${devices.length ? ` (connected: ${devices.join(", ")})` : ""}; airdrop ${onOff(st.airdrop)}; focus ${onOff(st.focusMode)}; night light ${onOff(st.nightLight)}; vpn ${onOff(st.vpn)}; firewall ${onOff(st.firewall)}; brightness ${st.brightness}; low power mode ${st.lowPowerMode}.`,
        };
      },
      connect_wifi: (args) => {
        try {
          const q = String(args?.network ?? "").trim().toLowerCase();
          const st = store().systemSettings;
          if (!st.wifi) return { ok: false, message: "Wi-Fi is off. Turn it on first." };
          const net = WIFI_NETWORKS.find((n) => n.toLowerCase() === q) || WIFI_NETWORKS.find((n) => q && n.toLowerCase().includes(q));
          if (!net) return { ok: false, message: `I do not see a network called "${args?.network ?? ""}". Available: ${WIFI_NETWORKS.join(", ")}.` };
          store().updateSystemSetting("activeWifiNetwork", net);
          return { ok: true, message: `Connected to ${net}.` };
        } catch (err) {
          return { ok: false, message: `Could not connect: ${err?.message || err}` };
        }
      },
      bluetooth_device: (args) => {
        try {
          const q = String(args?.device ?? "").trim().toLowerCase();
          const st = store().systemSettings;
          if (!st.bluetooth) return { ok: false, message: "Bluetooth is off. Turn it on first." };
          const key = Object.keys(BT_NAMES).find((k) => q && (k === q || BT_NAMES[k].toLowerCase().includes(q) || q.includes(k)));
          if (!key) return { ok: false, message: `I do not know a device called "${args?.device ?? ""}". Devices: ${Object.values(BT_NAMES).join(", ")}.` };
          const connect = args?.connected === undefined ? true : parseBoolean(args.connected) !== false;
          store().updateSystemSetting("bluetoothDevices", { ...st.bluetoothDevices, [key]: connect });
          return { ok: true, message: `${connect ? "Connected" : "Disconnected"} ${BT_NAMES[key]}.` };
        } catch (err) {
          return { ok: false, message: `Could not change the device: ${err?.message || err}` };
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
