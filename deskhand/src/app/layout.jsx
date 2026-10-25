import "../styles/index.css";
import { SITE_DESCRIPTION, SITE_NAME, pageMetadata } from "../lib/seo";
import { siteUrl } from "../lib/site-url";

export const metadata = {
  metadataBase: new URL(siteUrl),
  ...pageMetadata({}),
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon/favicon.ico",
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Not a public site: keep it out of search indexes.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://api.jamendo.com" />
        <link rel="preconnect" href="https://prod-1.storage.jamendo.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://wttr.in" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const removeAttr = (el) => {
                  if (el.removeAttribute) {
                    el.removeAttribute('bis_skin_checked');
                  }
                };
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((m) => {
                    if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                      removeAttr(m.target);
                    }
                    if (m.addedNodes) {
                      m.addedNodes.forEach((n) => {
                        if (n.nodeType === 1) {
                          removeAttr(n);
                          n.querySelectorAll('[bis_skin_checked]').forEach(removeAttr);
                        }
                      });
                    }
                  });
                });
                observer.observe(document.documentElement, {
                  childList: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['bis_skin_checked']
                });
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
