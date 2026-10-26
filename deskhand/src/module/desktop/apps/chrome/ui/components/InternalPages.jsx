import { useEffect, useState } from "react";
import { ExternalLink, Search as SearchIcon, FileText, BookOpen, Globe } from "lucide-react";
import useBrowserStore, { runSearch } from "../../browserStore";
import { articleUrl, pageUrl, parseInternalUrl, searchUrl } from "../../searchCore";
import { ReaderPage, favicon } from "./ReaderPage";

// Real <a> elements so voice commands can match the visible title.
const Anchor = ({ url, navigate, className, children }) => (
  <a
    href={url}
    data-dk-url={url}
    onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      navigate(url);
    }}
    onMouseDown={(e) => e.stopPropagation()}
    onPointerDown={(e) => e.stopPropagation()}
    className={className}
  >
    {children}
  </a>
);

const Badge = ({ r }) => {
  if (r.kind === "research")
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
        Paradigm Research
      </span>
    );
  if (r.kind === "paper")
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
        arXiv paper
      </span>
    );
  if (r.demo)
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
        Offline sample
      </span>
    );
  return null;
};

/** Where a result opens: real web pages through the reader, curated entries as an abstract page. */
const resultTarget = (r) => (r.kind === "web" && !r.demo ? pageUrl(r.url) : articleUrl(r.id));

const SOURCES = [
  ["web", "Web"],
  ["news", "News"],
  ["papers", "Papers"],
];

const ProviderLabel = ({ set }) => {
  if (!set?.provider) return null;
  const offline = set.offline || /offline/i.test(set.provider);
  return (
    <span
      title={offline ? "The search service could not be reached." : "Where these results came from"}
      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${offline ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}
    >
      via {set.provider}
    </span>
  );
};

const Favicon = ({ site }) =>
  site ? (
    <img
      src={favicon(site)}
      alt=""
      width={16}
      height={16}
      referrerPolicy="no-referrer"
      className="w-4 h-4 rounded-sm shrink-0"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  ) : (
    <Globe size={14} className="text-gray-400 shrink-0" />
  );

export const SearchResultsPage = ({ url, navigate }) => {
  const p = parseInternalUrl(url);
  const set = useBrowserStore((s) => s.getSearch(p.q, p.source));
  const [draft, setDraft] = useState(p.q);
  const [busy, setBusy] = useState(false);

  const hasSet = Boolean(set);
  useEffect(() => {
    setDraft(p.q);
  }, [p.q, p.source]);
  useEffect(() => {
    if (hasSet) return;
    let alive = true;
    setBusy(true);
    runSearch(p.q, p.source).finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [p.q, p.source, hasSet]);

  const go = (q, source) => q.trim() && navigate(searchUrl(q.trim(), source));

  return (
    <div data-dk-content className="min-h-full bg-white text-[#202124]">
      <div className="flex items-center gap-4 px-6 pt-4 pb-2 border-b border-gray-200 sticky top-0 bg-white z-10">
        <span className="text-xl font-semibold tracking-tight select-none">
          <span className="text-blue-600">J</span>
          <span className="text-red-500">a</span>
          <span className="text-yellow-500">r</span>
          <span className="text-blue-600">v</span>
          <span className="text-green-600">i</span>
          <span className="text-red-500">s</span>
          <span className="text-green-600"> Search</span>
        </span>
        <form
          className="flex-1 max-w-xl flex items-center gap-2 border border-gray-300 rounded-full px-4 py-1.5 shadow-sm hover:shadow focus-within:shadow"
          onSubmit={(e) => {
            e.preventDefault();
            go(draft, p.source);
          }}
        >
          <SearchIcon size={14} className="text-gray-400" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex-1 outline-none text-sm bg-transparent"
            aria-label="Search"
          />
        </form>
      </div>
      <div className="flex gap-5 px-6 text-[13px] border-b border-gray-200">
        {SOURCES.map(([id, label]) => (
          <button
            key={id}
            onClick={() => go(p.q, id)}
            className={`py-2 border-b-2 ${p.source === id ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="px-6 py-4 max-w-3xl">
        {busy && !set && <p className="text-sm text-gray-500">Searching...</p>}
        {set && (
          <>
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-2 flex-wrap">
              <span>
                {set.results.length} result{set.results.length === 1 ? "" : "s"} for "{set.query}"
                {p.source === "papers" ? ", newest first within each source" : ""}
              </span>
              <ProviderLabel set={set} />
            </p>
            {set.summary && (
              <p className="text-[13px] text-gray-700 bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 my-2 leading-relaxed">
                {set.summary}
              </p>
            )}
            {set.notes.map((n) => (
              <p
                key={n}
                className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 inline-block mr-2"
              >
                {n}
              </p>
            ))}
            <ol className="mt-3 space-y-5">
              {set.results.map((r, i) => (
                <li key={r.id} data-result-index={i + 1}>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-0.5">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-500">
                      {i + 1}
                    </span>
                    <Favicon site={r.site} />
                    <span className="truncate max-w-[16rem]">{r.source}</span>
                    {r.date && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{r.date}</span>
                      </>
                    )}
                    <Badge r={r} />
                  </div>
                  <Anchor
                    url={resultTarget(r)}
                    navigate={navigate}
                    className="text-[17px] text-blue-700 hover:underline leading-snug block"
                  >
                    {r.title}
                  </Anchor>
                  {r.snippet && (
                    <p className="text-[13px] text-gray-700 leading-relaxed mt-0.5">{r.snippet}</p>
                  )}
                </li>
              ))}
              {!set.results.length && (
                <li className="text-sm text-gray-500">
                  No results. Try different words, or switch between Web, News and Papers.
                </li>
              )}
            </ol>
          </>
        )}
      </div>
    </div>
  );
};

export const ArticlePage = ({ url, navigate }) => {
  const p = parseInternalUrl(url);
  const a = useBrowserStore((s) => s.getArticle(p.id));
  if (!a)
    return (
      <div data-dk-content className="p-8 text-sm text-gray-500">
        This page is no longer available. Run the search again.
      </div>
    );
  return (
    <div data-dk-content className="min-h-full bg-[#fbfbfa] text-[#1f1e1d]">
      <article className="max-w-2xl mx-auto px-8 py-8">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <FileText size={14} />
          <span>{a.source}</span>
          <span className="text-gray-300">|</span>
          <span>{a.date || "n.d."}</span>
          <Badge r={a} />
        </div>
        <h1
          className="text-2xl font-semibold leading-tight mb-2"
          style={{ fontFamily: "Georgia, serif" }}
        >
          {a.title}
        </h1>
        {a.authors?.length > 0 && (
          <p className="text-sm text-gray-600 mb-4">{a.authors.join(", ")}</p>
        )}
        {a.kind === "paper" && (
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Abstract</h2>
        )}
        {(a.abstract || a.snippet).split("\n\n").map((para, i) => (
          <p
            key={i}
            className="text-[15px] leading-relaxed mb-3"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {para}
          </p>
        ))}
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          {!a.demo && /^https?:/i.test(a.url) && (
            <button
              onClick={() => navigate?.(pageUrl(a.url))}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50"
            >
              <BookOpen size={14} /> Read full page
            </button>
          )}
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <ExternalLink size={14} /> Open original
          </a>
          <span className="text-xs text-gray-400 break-all">{a.url}</span>
        </div>
        {a.demo && (
          <p className="text-[11px] text-gray-400 mt-6">Offline sample page (invented), shown because the search service could not be reached.</p>
        )}
      </article>
    </div>
  );
};

export const InternalPage = ({ url, navigate, onTitle }) => {
  const p = parseInternalUrl(url);
  if (p?.type === "search") return <SearchResultsPage url={url} navigate={navigate} />;
  if (p?.type === "page") return <ReaderPage url={url} navigate={navigate} onTitle={onTitle} />;
  if (p?.type === "article") return <ArticlePage url={url} navigate={navigate} />;
  return null;
};
