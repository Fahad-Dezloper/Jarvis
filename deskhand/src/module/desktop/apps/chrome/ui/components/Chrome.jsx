import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Plus,
  X,
  Search,
  Lock,
  ExternalLink,
  Globe,
} from "lucide-react";
import WindowControls from "@components/WindowControls";
import windowWrapper from "@hoc/windowWrapper";
import MockPage from "@module/desktop/apps/safari/ui/components/MockPages";
import { findMockPage } from "../../../safari/data/pages";
import useChrome, { NEWTAB } from "../../hooks/useChrome";
import { InternalPage } from "./InternalPages";
import { isInternalUrl } from "../../searchCore";

const displayUrl = (url) => (url === NEWTAB ? "" : url);

const NewTab = ({ navigate }) => {
  const [q, setQ] = useState("");
  return (
    <div
      data-dk-content
      className="h-full flex flex-col items-center justify-center bg-white gap-6 px-6"
    >
      <div className="text-5xl font-semibold tracking-tight select-none">
        <span className="text-blue-600">J</span>
        <span className="text-red-500">a</span>
        <span className="text-yellow-500">r</span>
        <span className="text-blue-600">v</span>
        <span className="text-green-600">i</span>
        <span className="text-red-500">s</span>
      </div>
      <form
        className="w-full max-w-md flex items-center gap-2 border border-gray-300 rounded-full px-4 py-2 shadow-sm hover:shadow"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(q);
        }}
      >
        <Search size={15} className="text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="Search the demo web, or type a URL"
          className="flex-1 outline-none text-sm bg-transparent"
        />
      </form>
      <div className="flex gap-3 text-xs">
        {[
          ["Hacker News", "hacker news"],
          ["Poker odds", "poker-odds"],
          ["orbit-todo repo", "github"],
        ].map(([label, target]) => (
          <button
            key={label}
            onClick={() => navigate(target)}
            className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

const External = ({ url }) => (
  <div className="h-full flex flex-col" data-dk-content>
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
      <Globe size={13} /> Many sites refuse to load inside another page.
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto inline-flex items-center gap-1 underline"
        onMouseDown={(e) => e.stopPropagation()}
      >
        Open in a new tab <ExternalLink size={12} />
      </a>
    </div>
    <iframe
      src={url}
      title={url}
      className="flex-1 w-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  </div>
);

const Content = ({ tab, navigate }) => {
  const url = tab.url;
  if (url === NEWTAB) return <NewTab navigate={navigate} />;
  if (isInternalUrl(url)) return <InternalPage url={url} navigate={navigate} />;
  const mock = findMockPage(url);
  if (mock)
    return (
      <div data-dk-content>
        <MockPage page={mock} navigate={navigate} />
      </div>
    );
  return <External url={url} />;
};

const Chrome = () => {
  const c = useChrome();
  const [draft, setDraft] = useState("");
  useEffect(() => setDraft(displayUrl(c.activeTab.url)), [c.activeTab.url, c.activeTabId]);

  return (
    <div className="flex flex-col h-full w-full bg-white select-none overflow-hidden rounded-xl border border-black/10 shadow-xl">
      <div
        id="window-header"
        className="window-header flex items-end bg-[#dfe1e5] pt-2 pl-3 pr-2 gap-2 h-[42px] shrink-0"
      >
        <div className="self-center pb-1">
          <WindowControls target="chrome" />
        </div>
        <div className="flex items-end flex-1 min-w-0 h-full gap-0.5 pl-2">
          {c.tabs.map((t) => {
            const active = t.id === c.activeTabId;
            return (
              <div
                key={t.id}
                onClick={() => c.setActiveTabId(t.id)}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ maxWidth: 200 }}
                className={`group flex items-center gap-1.5 h-8 flex-1 min-w-0 px-3 rounded-t-lg text-xs cursor-default ${active ? "bg-white text-gray-800" : "bg-transparent text-gray-600 hover:bg-white/50"}`}
              >
                <Globe size={12} className="shrink-0 text-gray-500" />
                <span className="truncate flex-1">{t.title}</span>
                <button
                  onClick={(e) => c.closeTab(t.id, e)}
                  className="opacity-60 hover:opacity-100 hover:bg-black/10 rounded-full p-0.5"
                  aria-label="Close tab"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
          <button
            onClick={c.newTab}
            onPointerDown={(e) => e.stopPropagation()}
            className="mb-1 ml-1 p-1 rounded-full hover:bg-black/10 text-gray-600"
            aria-label="New tab"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 bg-white border-b border-gray-200 shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={c.back}
          disabled={c.activeTab.historyIndex <= 0}
          className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30"
          aria-label="Back"
        >
          <ArrowLeft size={15} />
        </button>
        <button
          onClick={c.forward}
          disabled={c.activeTab.historyIndex >= c.activeTab.history.length - 1}
          className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30"
          aria-label="Forward"
        >
          <ArrowRight size={15} />
        </button>
        <button
          onClick={() => c.navigate(c.activeTab.url)}
          className="p-1.5 rounded-full hover:bg-gray-100"
          aria-label="Reload"
        >
          <RotateCw size={14} />
        </button>
        <form
          className="flex-1 flex items-center gap-2 bg-[#f1f3f4] hover:bg-[#e8eaed] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 rounded-full px-3 py-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            c.navigate(draft);
          }}
        >
          <Lock size={12} className="text-gray-500 shrink-0" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Search or type a URL"
            aria-label="Address and search bar"
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-gray-800"
          />
        </form>
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-white select-text">
        <Content tab={c.activeTab} navigate={c.navigate} />
      </div>
    </div>
  );
};

const ChromeWindow = windowWrapper(Chrome, "chrome");
export default ChromeWindow;
