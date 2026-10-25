import { useState, useEffect, useRef, useCallback } from "react";
import useWindowsStore from "@store/window";
import "../../devBridge";
import { registerHandlers, registerSummary } from "@deskhand/bridge";
import { getCoverColor, getCoverEmoji } from "../data/musicData";
import { PLAYLISTS, clampVolume, matchPlaylist, matchTrack } from "../data/playlists";
import { fetchJamendo, getPlaylistTracks, synthesizedTracks } from "../data/playlistTracks";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const audioEl = () => (typeof document === "undefined" ? null : document.getElementById("global-music-player"));

const STUNNING_ALBUM_COVERS = [
  "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1487180142328-0c4e37023af5?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1482440308425-276ad0f28b19?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1513829096999-4978602297af?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1446057032654-9d8885b7a391?w=500&auto=format&fit=crop&q=80",
];

const useMusic = () => {
  const { music, setMusicState, focusWindow } = useWindowsStore();
  const activeTrack = music.activeTrack;
  const isPlaying = music.isPlaying;
  const volume = music.volume;
  const isMuted = music.isMuted;

  const tracks = music.tracks || [];
  const setTracks = (newTracks) => setMusicState({ tracks: newTracks });
  const isShuffle = music.isShuffle;
  const setIsShuffle = (val) => setMusicState({ isShuffle: val });
  const isRepeat = music.isRepeat;
  const setIsRepeat = (val) => setMusicState({ isRepeat: val });

  const [currentTime, setCurrentTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Browse");
  const [isLoading, setIsLoading] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  const audioRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync with global audio element
  useEffect(() => {
    const audio = document.getElementById("global-music-player");
    if (!audio) return;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      const duration = Math.round(audio.duration);
      if (duration && !isNaN(duration) && duration !== activeTrack.duration) {
        setMusicState({ activeTrack: { ...activeTrack, duration } });
      }
    };

    setCurrentTime(audio.currentTime);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [activeTrack, setMusicState]);

  useEffect(() => {
    const fetchTracks = async () => {
      setIsLoading(true);
      try {
        const playlist = searchQuery.trim() === "" && PLAYLISTS.find((p) => p.name === activeCategory);
        if (playlist) {
          const { tracks: listed } = await getPlaylistTracks(playlist);
          setTracks(listed);
          return;
        }

        const clientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;

        let params = `client_id=${clientId}&format=json&limit=25`;
        if (searchQuery.trim() !== "") {
          params += `&search=${encodeURIComponent(searchQuery)}`;
        } else {
          switch (activeCategory) {
            case "Browse":
              params += `&tags=pop&order=popularity_total_desc`;
              break;
            case "Listen Now":
              params += `&tags=lofi&order=popularity_total_desc`;
              break;
            case "Hindi Music":
              params += `&search=indian&order=popularity_total_desc`;
              break;
            case "English Music":
              params += `&tags=rock&order=popularity_total_desc`;
              break;
            case "Recently Added":
              params += `&order=releasedate_desc`;
              break;
            case "Artists":
              params += `&search=acoustic&order=popularity_total_desc`;
              break;
            case "Albums":
              params += `&search=chillout&order=popularity_total_desc`;
              break;
            case "Songs":
              params += `&order=popularity_total_desc`;
              break;
            default:
              params += `&order=popularity_total_desc`;
          }
        }

        const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
        const data = await res.json();

        if (data.headers && data.headers.status === "success" && data.results) {
          const formattedTracks = data.results.map((track, index) => {
            let coverUrl = track.album_image || track.image || "";
            if (coverUrl && coverUrl.startsWith("http://")) {
              coverUrl = coverUrl.replace("http://", "https://");
            }
            return {
              id: track.id,
              title: track.name,
              artist: track.artist_name || "Unknown Artist",
              album: track.album_name || "Single",
              duration: track.duration,
              coverColor: getCoverColor(index),
              coverText: getCoverEmoji(track.name),
              coverUrl: coverUrl,
              url: track.audio,
              language: "English",
            };
          });
          setTracks(formattedTracks);
        } else {
          setTracks([]);
        }
      } catch (err) {
        console.error("Failed to fetch Jamendo tracks:", err);
        setTracks([]);
      } finally {
        setIsLoading(false);
      }
    };
    const timer = setTimeout(() => {
      fetchTracks();
    }, 450);
    return () => clearTimeout(timer);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    if (tracks.length > 0 && activeTrack.id === 0) {
      setMusicState({ activeTrack: tracks[0] });
    }
  }, [tracks, activeTrack, setMusicState]);

  const handleSelectTrack = (track) => {
    setMusicState({ activeTrack: track, isPlaying: true });
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handlePlayPause = () => {
    if (activeTrack.url) {
      setMusicState({ isPlaying: !isPlaying });
    }
  };

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    let nextTrack;
    if (isShuffle) {
      const randIdx = Math.floor(Math.random() * tracks.length);
      nextTrack = tracks[randIdx];
    } else {
      const currentIdx = tracks.findIndex((t) => t.id === activeTrack.id);
      if (currentIdx === -1) {
        nextTrack = tracks[0];
      } else {
        nextTrack = tracks[(currentIdx + 1) % tracks.length];
      }
    }
    setMusicState({ activeTrack: nextTrack, isPlaying: true });
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, [tracks, activeTrack, isShuffle, setMusicState]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    const currentIdx = tracks.findIndex((t) => t.id === activeTrack.id);
    const prevIdx =
      currentIdx === -1 ? tracks.length - 1 : (currentIdx - 1 + tracks.length) % tracks.length;
    setMusicState({ activeTrack: tracks[prevIdx], isPlaying: true });
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, [tracks, activeTrack, setMusicState]);

  const allowSound = () => {
    setNeedsGesture(false);
    setMusicState({ isPlaying: true });
    const audio = audioEl();
    if (audio) audio.play().catch(() => setNeedsGesture(true));
  };

  useEffect(() => {
    if (isPlaying) setNeedsGesture(false);
  }, [isPlaying]);

  // Fresh state for the voice handlers (registered once, read through refs).
  const live = useRef({});
  useEffect(() => {
    live.current = { handleNext, handlePrev };
  });

  useEffect(() => {
    const store = () => useWindowsStore.getState();

    // Starts a track and reports what really happened.
    const startAndVerify = async (track, list) => {
      store().setMusicState({ tracks: list, activeTrack: track, isPlaying: true });
      for (let i = 0; i < 16; i++) {
        await sleep(120);
        const audio = audioEl();
        if (!store().music.isPlaying) return "blocked";
        if (audio?.error) return "failed";
        if (audio && !audio.paused && (audio.readyState >= 2 || audio.currentTime > 0)) return "playing";
      }
      const audio = audioEl();
      return audio && !audio.paused ? "playing" : "unknown";
    };

    const describe = (state, text) => {
      if (state === "blocked") {
        setNeedsGesture(true);
        return {
          ok: true,
          message: `${text} The browser is blocking sound until you click "Click to allow sound" in the Music window.`,
        };
      }
      return { ok: true, message: text };
    };

    const playPlaylist = async (playlist) => {
      setActiveCategory(playlist.name);
      setSearchQuery("");
      let { tracks: list, source } = await getPlaylistTracks(playlist);
      if (!list.length) {
        return { ok: false, message: `${playlist.name} has no playable tracks right now.` };
      }
      let state = await startAndVerify(list[0], list);
      if (state === "failed" && source === "jamendo") {
        const offline = await synthesizedTracks(playlist);
        if (offline.length) {
          list = offline;
          source = "offline";
          state = await startAndVerify(list[0], list);
        }
      }
      if (state === "failed") {
        return { ok: false, message: `Could not play ${playlist.name}: the audio failed to load.` };
      }
      const where = source === "offline" ? "offline generated tracks" : "Jamendo";
      return describe(
        state,
        `Playing the "${playlist.name}" playlist (${list.length} tracks from ${where}), starting with "${list[0].title}".`,
      );
    };

    const unregister = registerHandlers("music", {
      play: async (args) => {
        try {
          const query = String(args?.query ?? "").trim();
          const music = store().music;
          if (!query) {
            if (music.activeTrack?.url) {
              const state = await startAndVerify(music.activeTrack, music.tracks);
              return describe(state, `Resumed "${music.activeTrack.title}".`);
            }
            return await playPlaylist(PLAYLISTS[0]);
          }
          const pl = matchPlaylist(query);
          if (pl) return await playPlaylist(pl.playlist);

          const tm = matchTrack(query, music.tracks);
          if (tm) {
            const state = await startAndVerify(tm.track, music.tracks);
            return describe(state, `Playing "${tm.track.title}" by ${tm.track.artist}.`);
          }
          const found = await fetchJamendo(`search=${encodeURIComponent(query)}`);
          if (found.length) {
            setActiveCategory("Songs");
            setSearchQuery(query);
            const state = await startAndVerify(found[0], found);
            return describe(state, `Playing "${found[0].title}" by ${found[0].artist}.`);
          }
          return {
            ok: false,
            message: `I could not find "${query}". Available playlists: ${PLAYLISTS.map((p) => p.name).join(", ")}.`,
          };
        } catch (err) {
          return { ok: false, message: `Could not play that: ${err?.message || err}` };
        }
      },
      pause: () => {
        try {
          const music = store().music;
          if (!music.isPlaying) return { ok: true, message: "Music is already paused." };
          store().setMusicState({ isPlaying: false });
          return { ok: true, message: `Paused "${music.activeTrack.title}".` };
        } catch (err) {
          return { ok: false, message: `Could not pause: ${err?.message || err}` };
        }
      },
      next: () => {
        try {
          if (!store().music.tracks.length) return { ok: false, message: "There are no tracks to skip through." };
          live.current.handleNext();
          return { ok: true, message: `Skipped to "${store().music.activeTrack.title}".` };
        } catch (err) {
          return { ok: false, message: `Could not skip: ${err?.message || err}` };
        }
      },
      previous: () => {
        try {
          if (!store().music.tracks.length) return { ok: false, message: "There are no tracks to go back through." };
          live.current.handlePrev();
          return { ok: true, message: `Went back to "${store().music.activeTrack.title}".` };
        } catch (err) {
          return { ok: false, message: `Could not go back: ${err?.message || err}` };
        }
      },
      set_volume: (args) => {
        try {
          const level = clampVolume(String(args?.level ?? "").replace("%", ""));
          if (level === null) return { ok: false, message: "I need a volume between 0 and 100." };
          store().setMusicState({ volume: level, isMuted: level === 0 });
          return { ok: true, message: `Volume set to ${level}%.` };
        } catch (err) {
          return { ok: false, message: `Could not change the volume: ${err?.message || err}` };
        }
      },
    });
    const unregisterSummary = registerSummary("music", () => {
      const m = store().music;
      const names = PLAYLISTS.map((p) => p.name).join(", ");
      const now = m.activeTrack?.url
        ? `${m.isPlaying ? "Playing" : "Paused"} "${m.activeTrack.title}" by ${m.activeTrack.artist}`
        : "Nothing is loaded";
      return `${now}. Volume ${m.volume}%. Playlists: ${names}.`;
    });
    return () => {
      unregister();
      unregisterSummary();
    };
  }, []);

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${min}:${sec}`;
  };

  const handleProgressChange = (e) => {
    const newTime = parseInt(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  return {
    tracks,
    setTracks,
    activeTrack,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    setCurrentTime,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    isShuffle,
    setIsShuffle,
    isRepeat,
    setIsRepeat,
    isLoading,
    needsGesture,
    allowSound,
    audioRef,
    searchInputRef,
    handleTimeUpdate: () => {},
    handleLoadedMetadata: () => {},
    handleAudioEnded: () => {},
    handleSelectTrack,
    handlePlayPause,
    handleNext,
    handlePrev,
    formatTime,
    handleProgressChange,
    focusWindow,
    setMusicState,
  };
};

export default useMusic;
