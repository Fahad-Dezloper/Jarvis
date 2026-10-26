// HTML -> clean reader article. Pure (no network): exercised by scripts/check-web.mjs.
// Readability (Apache-2.0) picks the article, linkedom (ISC) supplies the DOM,
// sanitize-html (MIT) enforces the tag/attribute allowlist on the way out.
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import sanitizeHtml from "sanitize-html";

export const MAX_TEXT = 12000;
const MAX_LINKS = 40;

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "a", "img", "ul", "ol", "li", "dl", "dt", "dd",
  "pre", "code", "blockquote", "figure", "figcaption", "table", "thead", "tbody", "tfoot", "tr",
  "th", "td", "caption", "em", "strong", "b", "i", "u", "s", "sub", "sup", "small", "mark", "abbr", "cite", "q", "kbd",
];
const DROP_WITH_CONTENT = [
  "script", "style", "noscript", "iframe", "object", "embed", "template", "textarea", "select",
  "option", "form", "svg", "math", "canvas", "audio", "video", "button", "dialog", "head", "title",
];

const httpHref = (value, base) => {
  try {
    const u = new URL(String(value || "").trim(), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Sanitize article HTML to the reader allowlist and absolutize URLs against `base`. */
export function sanitizeArticleHtml(html, base) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: ALLOWED_TAGS,
    nonTextTags: DROP_WITH_CONTENT,
    allowedAttributes: {
      a: ["href", "title", "rel", "data-dk-url"],
      img: ["src", "alt", "title", "width", "height", "loading", "referrerpolicy"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      abbr: ["title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"], a: ["http", "https", "mailto"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tag, attribs) => {
        const href = httpHref(attribs.href, base);
        if (!href) return { tagName: "span", attribs: {} };
        return {
          tagName: "a",
          attribs: {
            href,
            "data-dk-url": href,
            rel: "noopener noreferrer nofollow",
            ...(attribs.title ? { title: attribs.title } : {}),
          },
        };
      },
      img: (tag, attribs) => {
        const src = httpHref(attribs.src || attribs["data-src"] || attribs["data-lazy-src"], base);
        if (!src || !src.startsWith("https:")) return { tagName: "span", attribs: {} };
        return {
          tagName: "img",
          attribs: {
            src,
            alt: attribs.alt || "",
            loading: "lazy",
            referrerpolicy: "no-referrer",
            ...(attribs.width && /^\d{1,4}$/.test(attribs.width) ? { width: attribs.width } : {}),
            ...(attribs.height && /^\d{1,4}$/.test(attribs.height) ? { height: attribs.height } : {}),
          },
        };
      },
    },
  });
}

/** Plain text of sanitized HTML with paragraph breaks kept. */
export function htmlToText(html) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  document
    .querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre,figcaption,dt,dd,br,hr")
    .forEach((el) => el.after(document.createTextNode("\n\n")));
  document.querySelectorAll("td,th").forEach((el) => el.after(document.createTextNode(" | ")));
  return (document.body.textContent || "")
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLinks(html) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const seen = new Set();
  const out = [];
  document.querySelectorAll("a[href]").forEach((a) => {
    const url = a.getAttribute("href");
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || !/^https?:/i.test(url) || seen.has(url) || out.length >= MAX_LINKS) return;
    seen.add(url);
    out.push({ text: text.slice(0, 120), url });
  });
  return out;
}

const meta = (doc, ...names) => {
  for (const n of names) {
    const el = doc.querySelector(`meta[property="${n}"],meta[name="${n}"]`);
    const v = el?.getAttribute("content");
    if (v && v.trim()) return v.trim();
  }
  return "";
};

const isoDate = (s) => {
  if (!s) return "";
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
};

function fallbackContent(html) {
  const { document } = parseHTML(html);
  document
    .querySelectorAll("script,style,noscript,nav,header,footer,aside,form,iframe,svg")
    .forEach((n) => n.remove());
  const root = document.querySelector("main,article,[role=main]") || document.body;
  return root?.innerHTML || "";
}

/**
 * @param {string} html raw page HTML
 * @param {string} pageUrl final URL of the page
 * @returns {{title:string, byline:string, siteName:string, url:string, date:string, excerpt:string, html:string, text:string, textTruncated:boolean, links:{text:string,url:string}[], fallback:boolean}}
 */
export function extractArticle(html, pageUrl) {
  const source = String(html || "");
  let host = "";
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    /* keep empty */
  }
  if (!source.trim()) {
    return {
      title: host || "Untitled", byline: "", siteName: host, url: pageUrl, date: "", excerpt: "",
      html: "", text: "", textTruncated: false, links: [], fallback: false,
    };
  }
  const { document } = parseHTML(source);
  let base = pageUrl;
  const baseHref = document.querySelector("base[href]")?.getAttribute("href");
  const resolvedBase = baseHref ? httpHref(baseHref, pageUrl) : null;
  if (resolvedBase) base = resolvedBase;

  const siteName = meta(document, "og:site_name", "application-name") || host;
  const metaTitle = meta(document, "og:title", "twitter:title") || (document.title || "").trim();
  const metaDate = meta(document, "article:published_time", "og:article:published_time", "date", "pubdate");
  const metaAuthor = meta(document, "author", "article:author", "twitter:creator");

  let article;
  try {
    article = new Readability(document, { charThreshold: 250, keepClasses: false }).parse();
  } catch {
    article = null;
  }

  let rawContent = article?.content || "";
  let fallback = false;
  if (!article || (article.textContent || "").trim().length < 200) {
    const alt = fallbackContent(source);
    if (sanitizeArticleHtml(alt, base).length > sanitizeArticleHtml(rawContent, base).length) {
      rawContent = alt;
      fallback = true;
    }
  }

  const clean = sanitizeArticleHtml(rawContent, base);
  const fullText = htmlToText(clean);
  const text = fullText.slice(0, MAX_TEXT);
  return {
    title: (article?.title || metaTitle || host || "Untitled").trim().slice(0, 300),
    byline: (article?.byline || metaAuthor || "").replace(/\s+/g, " ").trim().slice(0, 200),
    siteName: (article?.siteName || siteName || host).slice(0, 120),
    url: pageUrl,
    date: isoDate(article?.publishedTime || metaDate),
    excerpt: (article?.excerpt || text.slice(0, 240)).replace(/\s+/g, " ").trim().slice(0, 300),
    html: clean,
    text,
    textTruncated: fullText.length > MAX_TEXT,
    links: extractLinks(clean),
    fallback,
  };
}
