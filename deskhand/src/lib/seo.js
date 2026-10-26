export const SITE_NAME = "Jarvis";
export const SITE_DESCRIPTION =
  "Jarvis is a macOS-style desktop in your browser that you control by voice. Dictate with Wispr Flow, and the desktop obeys.";

export function pageMetadata({ title = SITE_NAME, description = SITE_DESCRIPTION } = {}) {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
