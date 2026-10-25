import React from "react";
import { ArrowLeft, Star, GitFork, Eye, Folder, FileText, Share2, Sparkles } from "lucide-react";
import {
  ARTIFACT_URL,
  GITHUB_URL,
  HN_URL,
  POKER_DRAWS,
  POKER_TABLE,
  STORIES,
} from "../../data/pages";

// Real <a> elements: the visible text is the label that voice commands match.
const Link = ({ url, navigate, className = "", children, title }) => (
  <a
    href={url}
    data-dk-url={url}
    title={title}
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

const OfflineNote = () => (
  <p className="text-[10px] text-gray-400 mt-10 text-center">
    Offline demo page. Nothing here is loaded from the network.
  </p>
);

const ArtifactPage = ({ navigate }) => (
  <div className="min-h-full bg-[#faf9f5] text-[#1f1e1d]">
    <header className="flex items-center justify-between px-6 py-3 border-b border-[#e8e6dc] bg-[#faf9f5]">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-[#d97757] text-white flex items-center justify-center">
          <Sparkles size={13} />
        </span>
        <span className="font-semibold text-sm">Claude</span>
        <span className="text-xs text-gray-500">/ Shared artifact</span>
      </div>
      <Link
        url={ARTIFACT_URL}
        navigate={navigate}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#d97757] hover:underline"
      >
        <Share2 size={13} /> Share artifact link
      </Link>
    </header>
    <article className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Poker odds explained</h1>
      <p className="text-xs text-gray-500 mt-1">Shared artifact · created with Claude</p>
      <p className="mt-5 text-sm leading-relaxed text-gray-700">
        Poker odds tell you how often a hand wins or improves. Compare your chance of hitting the
        card you need against the price the pot is offering. If the chance is bigger than the price,
        calling is profitable over time.
      </p>

      <h2 className="text-lg font-semibold mt-8 mb-2">Starting hands against one random hand</h2>
      <div className="overflow-x-auto rounded-xl border border-[#e8e6dc] bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#f3f1e8] text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">Hand</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Win chance</th>
              <th className="px-4 py-2 hidden sm:table-cell">Note</th>
            </tr>
          </thead>
          <tbody>
            {POKER_TABLE.map((row) => (
              <tr key={row.hand} className="border-t border-[#efede4]">
                <td className="px-4 py-2 font-mono font-semibold">{row.hand}</td>
                <td className="px-4 py-2">{row.name}</td>
                <td className="px-4 py-2 font-semibold text-[#b5502e]">{row.vsRandom}</td>
                <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-2">Chance of completing a draw</h2>
      <div className="overflow-x-auto rounded-xl border border-[#e8e6dc] bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#f3f1e8] text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">Draw</th>
              <th className="px-4 py-2">Outs</th>
              <th className="px-4 py-2">Flop to river</th>
              <th className="px-4 py-2">Turn to river</th>
            </tr>
          </thead>
          <tbody>
            {POKER_DRAWS.map((row) => (
              <tr key={row.draw} className="border-t border-[#efede4]">
                <td className="px-4 py-2">{row.draw}</td>
                <td className="px-4 py-2">{row.outs}</td>
                <td className="px-4 py-2">{row.flopToRiver}</td>
                <td className="px-4 py-2">{row.turnToRiver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-gray-700 leading-relaxed">
        Quick rule: multiply your outs by 4 on the flop, or by 2 on the turn, to estimate the
        percentage chance of hitting by the river.
      </p>

      <p className="mt-8 text-xs text-gray-500">
        Also see{" "}
        <Link url={GITHUB_URL} navigate={navigate} className="text-[#d97757] underline">
          the odds calculator source on GitHub
        </Link>{" "}
        or{" "}
        <Link url={HN_URL} navigate={navigate} className="text-[#d97757] underline">
          the discussion on Hacker News
        </Link>
        .
      </p>
      <OfflineNote />
    </article>
  </div>
);

const HackerNewsPage = ({ navigate }) => (
  <div className="min-h-full bg-[#f6f6ef] text-black font-sans">
    <div className="bg-[#ff6600] px-3 py-1.5 flex items-center gap-3 text-[13px]">
      <span className="border border-white text-white font-bold px-1 leading-tight">Y</span>
      <Link url={HN_URL} navigate={navigate} className="font-bold text-black">
        Hacker News
      </Link>
      <span className="text-black/80 hidden sm:inline">new | past | comments | ask | show | jobs</span>
    </div>
    <ol className="px-3 py-3 space-y-2.5">
      {STORIES.map((s, i) => (
        <li key={s.id} className="flex gap-2 text-[13px]">
          <span className="text-gray-500 w-6 text-right shrink-0">{i + 1}.</span>
          <div className="min-w-0">
            <Link url={s.url} navigate={navigate} className="text-black hover:underline">
              {s.title}
            </Link>{" "}
            <span className="text-[11px] text-gray-500">({s.domain})</span>
            <div className="text-[11px] text-gray-500">
              {s.points} points by {s.by} {s.age} | {s.comments} comments
            </div>
          </div>
        </li>
      ))}
    </ol>
    <OfflineNote />
  </div>
);

const REPO_FILES = [
  { name: "src", dir: true, msg: "Add filter by status", age: "3 days ago" },
  { name: "tests", dir: true, msg: "Cover date formatting", age: "5 days ago" },
  { name: ".gitignore", dir: false, msg: "Initial commit", age: "2 weeks ago" },
  { name: "README.md", dir: false, msg: "Document scripts", age: "6 days ago" },
  { name: "package.json", dir: false, msg: "Bump vite", age: "4 days ago" },
];

const GitHubPage = ({ navigate }) => (
  <div className="min-h-full bg-white text-[#1f2328]">
    <div className="bg-[#f6f8fa] border-b border-[#d0d7de] px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-lg">
          <span className="text-[#0969da]">orbit-labs</span>
          <span className="text-gray-400">/</span>
          <Link url={GITHUB_URL} navigate={navigate} className="font-semibold text-[#0969da] hover:underline">
            orbit-todo
          </Link>
          <span className="text-[11px] border border-[#d0d7de] rounded-full px-2 py-0.5 text-gray-500">
            Public
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 border border-[#d0d7de] rounded-md px-2 py-1 bg-white">
            <Eye size={12} /> Watch 14
          </span>
          <span className="flex items-center gap-1 border border-[#d0d7de] rounded-md px-2 py-1 bg-white">
            <GitFork size={12} /> Fork 23
          </span>
          <span className="flex items-center gap-1 border border-[#d0d7de] rounded-md px-2 py-1 bg-white">
            <Star size={12} /> Star 412
          </span>
        </div>
      </div>
      <p className="text-sm text-gray-600 mt-2">
        A tiny local-first todo app built with React and Vite.
      </p>
    </div>

    <div className="px-6 py-4 max-w-3xl">
      <div className="border border-[#d0d7de] rounded-md overflow-hidden">
        <div className="bg-[#f6f8fa] px-4 py-2 text-xs text-gray-600 border-b border-[#d0d7de]">
          <span className="font-semibold text-[#1f2328]">nadiak</span> Add filter by status
          <span className="float-right">a41f9c2 · 5 commits</span>
        </div>
        {REPO_FILES.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-3 px-4 py-2 text-sm border-t border-[#eaeef2] first:border-t-0"
          >
            {f.dir ? (
              <Folder size={15} className="text-[#54aeff]" />
            ) : (
              <FileText size={15} className="text-gray-500" />
            )}
            <Link
              url={`${GITHUB_URL}#${f.name}`}
              navigate={navigate}
              className="text-[#1f2328] hover:text-[#0969da] hover:underline w-40"
            >
              {f.name}
            </Link>
            <span className="text-xs text-gray-500 flex-1 truncate">{f.msg}</span>
            <span className="text-xs text-gray-400 shrink-0">{f.age}</span>
          </div>
        ))}
      </div>

      <div className="border border-[#d0d7de] rounded-md mt-5">
        <div className="bg-[#f6f8fa] px-4 py-2 text-xs font-semibold border-b border-[#d0d7de]">
          README.md
        </div>
        <div className="p-5 text-sm leading-relaxed">
          <h1 className="text-2xl font-semibold border-b border-[#d0d7de] pb-2 mb-3">orbit-todo</h1>
          <p>Add tasks, tick them off, filter by status. Tasks live in localStorage.</p>
          <pre className="bg-[#f6f8fa] rounded-md p-3 mt-3 text-xs overflow-x-auto">
            {"npm install\nnpm run dev   # http://localhost:5173\nnpm test"}
          </pre>
        </div>
      </div>
      <OfflineNote />
    </div>
  </div>
);

const ArticlePage = ({ page, navigate }) => (
  <div className="min-h-full bg-white text-gray-800">
    <div className="border-b border-gray-200 px-6 py-3 flex items-center gap-3">
      <Link
        url={HN_URL}
        navigate={navigate}
        className="flex items-center gap-1 text-xs font-semibold text-[#ff6600] hover:underline"
      >
        <ArrowLeft size={13} /> Back to Hacker News
      </Link>
      <span className="text-xs text-gray-400">{page.story?.domain}</span>
    </div>
    <article className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold">{page.title}</h1>
      <p className="text-xs text-gray-500 mt-1">
        {page.story ? `${page.story.points} points · ${page.story.comments} comments` : ""}
      </p>
      <p className="mt-5 text-sm leading-relaxed text-gray-700">
        This article is a stand-in so the demo works without a network connection. The real post
        would be loaded from {page.story?.domain || "the original site"}.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-gray-700">
        Open the link in a regular browser to read the full text.
      </p>
      <OfflineNote />
    </article>
  </div>
);

const MockPage = ({ page, navigate }) => {
  let body;
  switch (page.kind) {
    case "artifact":
      body = <ArtifactPage navigate={navigate} />;
      break;
    case "hn":
      body = <HackerNewsPage navigate={navigate} />;
      break;
    case "github":
      body = <GitHubPage navigate={navigate} />;
      break;
    default:
      body = <ArticlePage page={page} navigate={navigate} />;
  }
  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto bg-white select-text"
      data-dk-page={page.id}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {body}
    </div>
  );
};

export default MockPage;
