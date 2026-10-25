// Loads the tracks behind a named playlist: Jamendo first, locally
// synthesized tracks when the network call fails or returns too little.
import { getCoverColor, getCoverEmoji } from "./musicData";
import { synthSupported, synthTrackUrl, trackSeconds } from "./synth";

const MIN_TRACKS = 3;
const FETCH_TIMEOUT_MS = 6000;

export function formatJamendoTracks(results) {
  return (results || [])
    .filter((track) => track && track.audio)
    .map((track, index) => {
      let coverUrl = track.album_image || track.image || "";
      if (coverUrl.startsWith("http://")) coverUrl = coverUrl.replace("http://", "https://");
      let url = track.audio;
      if (url.startsWith("http://")) url = url.replace("http://", "https://");
      return {
        id: track.id,
        title: track.name,
        artist: track.artist_name || "Unknown Artist",
        album: track.album_name || "Single",
        duration: track.duration,
        coverColor: getCoverColor(index),
        coverText: getCoverEmoji(track.name),
        coverUrl,
        url,
        language: "English",
      };
    });
}

/** Jamendo query fragment such as "tags=lofi" or "search=jazz". Never throws. */
export async function fetchJamendo(fragment, limit = 20) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const clientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=${limit}&order=popularity_total_desc&${fragment}`,
      { signal: ctrl.signal },
    );
    const data = await res.json();
    if (data?.headers?.status === "success") return formatJamendoTracks(data.results);
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Three named, locally rendered tracks for a playlist. */
export async function synthesizedTracks(playlist) {
  if (!synthSupported()) return [];
  const out = [];
  for (let i = 0; i < playlist.synth.length; i++) {
    const spec = playlist.synth[i];
    try {
      const url = await synthTrackUrl(`${playlist.id}-${i}`, spec);
      out.push({
        id: `synth-${playlist.id}-${i}`,
        title: spec.name,
        artist: "Generative (offline)",
        album: playlist.name,
        duration: trackSeconds(spec),
        coverColor: playlist.coverColor,
        coverText: playlist.coverText,
        coverUrl: "",
        url,
        language: "Instrumental",
        isSynth: true,
      });
    } catch {
      /* skip a track that failed to render */
    }
  }
  return out;
}

const networkCache = new Map();

/** Resolves { tracks, source: "jamendo" | "offline" | "none" }. */
export async function getPlaylistTracks(playlist) {
  if (networkCache.has(playlist.id)) {
    return { tracks: networkCache.get(playlist.id), source: "jamendo" };
  }
  for (const fragment of playlist.queries) {
    const tracks = await fetchJamendo(fragment);
    if (tracks.length >= MIN_TRACKS) {
      networkCache.set(playlist.id, tracks);
      return { tracks, source: "jamendo" };
    }
  }
  const tracks = await synthesizedTracks(playlist);
  return { tracks, source: tracks.length ? "offline" : "none" };
}
