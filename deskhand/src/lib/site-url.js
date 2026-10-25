const configuredSiteUrl = process.env.SITE_URL?.trim();
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const candidate =
  configuredSiteUrl || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");

let origin = "http://localhost:3000";
try {
  origin = new URL(candidate).origin;
} catch {
  // fall back to localhost: the site URL only feeds metadataBase
}

export const siteUrl = origin;
export const absoluteSiteUrl = (path = "/") => new URL(path, `${siteUrl}/`).toString();
