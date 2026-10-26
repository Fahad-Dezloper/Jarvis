// Spoken setting names -> keys of systemSettings. Pure, no imports.

const KEY_MAP = {
  wifi: "wifi",
  wi_fi: "wifi",
  bluetooth: "bluetooth",
  airdrop: "airdrop",
  focus: "focusMode",
  focusmode: "focusMode",
  donotdisturb: "focusMode",
  nightlight: "nightLight",
  nightshift: "nightLight",
  vpn: "vpn",
  firewall: "firewall",
  darkmode: "darkMode",
  thunderbolt: "thunderbolt",
  airplane: "airplane",
  airplanemode: "airplane",
  flightmode: "airplane",
  showbatterypercentage: "showBatteryPercentage",
  batterypercentage: "showBatteryPercentage",
  optimizedbatterycharging: "optimizedBatteryCharging",
  lowpowermode: "lowPowerMode",
  lowpower: "lowPowerMode",
  batterysaver: "lowPowerMode",
};

export const SETTING_KEYS_HELP = "wifi, bluetooth, airdrop, focus mode / do not disturb, night light, vpn, firewall, dark mode, airplane mode, low power mode, battery percentage";

export function normalizeSettingKey(key) {
  const k = String(key ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return KEY_MAP[k] || null;
}

export function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const v = String(value ?? "").trim().toLowerCase();
  if (["true", "on", "yes", "enable", "enabled", "1"].includes(v)) return true;
  if (["false", "off", "no", "disable", "disabled", "0"].includes(v)) return false;
  return null;
}

export function parseTheme(value) {
  const v = String(value ?? "").toLowerCase();
  if (v.includes("dark")) return "dark";
  if (v.includes("light")) return "light";
  return null;
}
