import { useEffect } from "react";
import { BookOpen, ExternalLink, Info, RotateCw, ShieldAlert } from "lucide-react";
import useBrowserStore, { loadPage } from "../../browserStore";
import { isHttpUrl, pageUrl, parseInternalUrl } from "../../searchCore";

export const favicon = (host) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const READER_CSS = `
.dk-reader { font-family: Georgia, "Times New Roman", serif; font-size: 17px; line-height: 1.7; color: #1f1e1d; overflow-wrap: anywhere; }
.dk-reader > :first-child { margin-top: 0; }
.dk-reader p { margin: 0 0 1em; }
.dk-reader h1, .dk-reader h2, .dk-reader h3, .dk-reader h4 { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.3; margin: 1.6em 0 .5em; font-weight: 650; }
.dk-reader h1 { font-size: 1.5em; } .dk-reader h2 { font-size: 1.3em; } .dk-reader h3 { font-size: 1.12em; } .dk-reader h4 { font-size: 1em; }
.dk-reader a { color: #1a56c4; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.dk-reader a:hover { color: #0f3b8c; }
.dk-reader img { max-width: 100%; height: auto; border-radius: 6px; margin: .4em 0; display: block; }
.dk-reader figure { margin: 1.2em 0; } .dk-reader figcaption { font-size: .82em; color: #6b6b66; font-family: system-ui, sans-serif; }
.dk-reader ul, .dk-reader ol { margin: 0 0 1em 1.4em; padding: 0; } .dk-reader ul { list-style: disc; } .dk-reader ol { list-style: decimal; } .dk-reader li { margin: .25em 0; }
.dk-reader blockquote { margin: 1em 0; padding: .1em 1em; border-left: 3px solid #d4d4cf; color: #4a4a46; }
.dk-reader pre { background: #f1f1ee; border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 13px; line-height: 1.5; margin: 0 0 1em; }
.dk-reader code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .88em; background: #f1f1ee; padding: .1em .3em; border-radius: 4px; } .dk-reader pre code { background: none; padding: 0; }
.dk-reader table { border-collapse: collapse; margin: 0 0 1em; display: block; overflow-x: auto; font-size: .92em; }
.dk-reader th, .dk-reader td { border: 1px solid #deded9; padding: 6px 10px; text-align: left; vertical-align: top; } .dk-reader th { background: #f4f4f1; }
.dk-reader hr { border: 0; border-top: 1px solid #deded9; margin: 1.6em 0; }
`;

const READER_TIP =
  "Many sites block embedding, so Jarvis shows a reader view: the page is fetched on the server and cleaned up for reading.";

export const ReaderBadge = () => (
  <span
    title={READER_TIP}
    data-tooltip-content={READER_TIP}
    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 cursor-help select-none"
  >
    <BookOpen size={11} /> Reader view
    <Info size={10} className="opacity-60" />
  </span>
);

const OpenOriginal = ({ url, className = "" }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    onMouseDown={(e) => e.stopPropagation()}
    onPointerDown={(e) => e.stopPropagation()}
    className={`inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 ${className}`}
  >
    <ExternalLink size={13} /> Open original
  </a>
);

const ERROR_TITLES = {
  site_blocked: "This site blocked reading",
  blocked: "This address can't be read",
  invalid: "That doesn't look like a web address",
  not_html: "This isn't a web page",
  too_large: "This page is too large to read here",
  timeout: "The site took too long",
  not_found: "Page not found",
  dns_failed: "Site not found",
  rate_limited: "Slow down a moment",
};

/** Reader view of a real page, fetched through /api/web/page. */
export const ReaderPage = ({ url, navigate, onTitle }) => {
  const p = parseInternalUrl(url);
  const target = p?.url || "";
  const entry = useBrowserStore((s) => s.getPage(target));

  useEffect(() => {
    if (!entry) loadPage(target);
  }, [target, entry]);

  const data = entry?.status === "ok" ? entry.data : null;
  useEffect(() => {
    if (data?.title && onTitle) onTitle(url, data.title);
  }, [data, url, onTitle]);

  const host = hostOf(target);

  if (!isHttpUrl(target))
    return (
      <div data-dk-content className="p-10 text-sm text-gray-600">
        Only http and https pages can be opened.
      </div>
    );

  if (!entry || entry.status === "loading")
    return (
      <div
        data-dk-content
        className="h-full min-h-[240px] flex flex-col items-center justify-center gap-4 text-gray-500 bg-[#fbfbfa]"
      >
        <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        <div className="text-center">
          <div className="text-sm font-medium text-gray-700">Loading {host || "page"}</div>
          <div className="text-xs text-gray-400 mt-0.5">Fetching it through the Jarvis reader</div>
        </div>
      </div>
    );

  if (entry.status === "error")
    return (
      <div data-dk-content className="h-full min-h-[240px] flex items-center justify-center bg-[#fbfbfa] p-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto text-amber-500 mb-3" size={32} />
          <h2 className="text-lg font-semibold text-gray-800">
            {ERROR_TITLES[entry.error?.code] || "This page could not be read"}
          </h2>
          <p className="text-sm text-gray-600 mt-1.5">
            {entry.error?.message}
            {entry.error?.code === "site_blocked" ? " Open the original in a new tab instead." : ""}
          </p>
          <p className="text-xs text-gray-400 mt-2 break-all">{target}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <OpenOriginal url={target} />
            <button
              onClick={() => loadPage(target, { force: true })}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <RotateCw size={13} /> Try again
            </button>
          </div>
        </div>
      </div>
    );

  const onClick = (e) => {
    const a = e.target?.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    e.preventDefault();
    if (!isHttpUrl(href)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    const same = href.split("#")[0] === (data.url || target).split("#")[0];
    if (same) {
      const id = decodeURIComponent(href.split("#")[1] || "");
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigate(pageUrl(href));
  };

  const finalUrl = data.url || target;
  const finalHost = hostOf(finalUrl);
  return (
    <div data-dk-content className="min-h-full bg-[#fbfbfa] text-[#1f1e1d]">
      <style>{READER_CSS}</style>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-1.5 bg-white/95 backdrop-blur border-b border-gray-200">
        <ReaderBadge />
        <span className="text-xs text-gray-500 truncate flex-1 min-w-0">{finalHost}</span>
        <OpenOriginal url={finalUrl} className="!py-1 !text-xs shrink-0" />
      </div>
      <article className="max-w-[720px] mx-auto px-8 py-8">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 font-sans">
          <img src={favicon(finalHost)} alt="" width={16} height={16} className="rounded-sm" />
          <span className="font-medium text-gray-700">{data.siteName || finalHost}</span>
          {data.date && (
            <>
              <span className="text-gray-300">|</span>
              <span>{data.date}</span>
            </>
          )}
        </div>
        <h1 className="text-[28px] font-semibold leading-tight mb-2" style={{ fontFamily: "Georgia, serif" }}>
          {data.title}
        </h1>
        {data.byline && <p className="text-sm text-gray-600 mb-5 font-sans">{data.byline}</p>}
        {data.html ? (
          <div className="dk-reader" onClick={onClick} dangerouslySetInnerHTML={{ __html: data.html }} />
        ) : (
          <p className="text-sm text-gray-500">No readable text was found on this page.</p>
        )}
        {data.textTruncated && (
          <p className="text-[11px] text-gray-400 mt-6 font-sans">
            Long page: the summary text offered to the assistant is cut at 12,000 characters.
          </p>
        )}
        <div className="mt-8 pt-4 border-t border-gray-200 flex items-center gap-3 font-sans">
          <OpenOriginal url={finalUrl} />
          <span className="text-xs text-gray-400 break-all">{finalUrl}</span>
        </div>
      </article>
    </div>
  );
};
