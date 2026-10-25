import { ARTIFACT_URL, GITHUB_URL, HN_URL } from "./pages";

export const DEFAULT_BOOKMARKS = [
  { id: 101, title: "Poker odds (Claude artifact)", url: ARTIFACT_URL, img: "" },
  { id: 102, title: "Hacker News", url: HN_URL, img: "" },
  { id: 103, title: "orbit-todo on GitHub", url: GITHUB_URL, img: "" },
  {
    id: 5,
    title: "Wikipedia",
    url: "https://en.wikipedia.org",
    img: "https://en.wikipedia.org/favicon.ico",
  },
  {
    id: 6,
    title: "OpenStreetMap",
    url: "https://openstreetmap.org",
    img: "/brands/openstreetmap.webp",
  },
];
