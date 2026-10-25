const getDomain = (url) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "";
  }
};

export const IFRAME_COMPATIBLE_SITES = [
  "openstreetmap.org",
  "wttr.in",
  "example.com",
  "example.org",
].filter(Boolean);
