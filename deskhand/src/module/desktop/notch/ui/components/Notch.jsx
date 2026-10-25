import React, { useState, useRef, useEffect } from "react";
import useWindowsStore from "@store/window";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Mic,
  ExternalLink,
  Star,
  Cloud,
  Settings,
  Camera,
  Maximize2,
  Minimize2,
  Trash2,
  FileText,
} from "lucide-react";

const getCameraErrorMessage = (error) => {
  switch (error?.name) {
    case "NotReadableError":
    case "TrackStartError":
      return "Camera is busy. Close Chrome's camera preview or another camera app, then retry.";
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera was blocked by the browser or system. Check your device's camera privacy settings, then retry.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found. Connect your camera, then retry.";
    case "SecurityError":
      return "Camera access is blocked in this page. Open it on HTTPS or localhost, then retry.";
    case "AbortError":
      return "Camera start was interrupted. Please retry.";
    default:
      return `Camera could not start (${error?.name || "unknown error"}). Please retry.`;
  }
};

const Notch = () => {
  const { music, setMusicState, openWindow } = useWindowsStore();
  const { activeTrack, isPlaying, _volume, _isMuted } = music;

  const [_dragProgress, setDragProgress] = useState(0);
  const [isMusicExpanded, setIsMusicExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [_duration, setDuration] = useState(0);

  const [activeTab, setActiveTab] = useState("nook"); // "nook" or "tray"
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const cameraOverlayRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);
  const cameraStreamRef = useRef(null);
  const cameraRequestIdRef = useRef(0);
  const isCameraOpenRef = useRef(false);
  const [activeFilter, setActiveFilter] = useState("none");
  const [isDemoMode, setIsDemoMode] = useState(false);

  const notchRef = useRef(null);

  // Click outside listener to collapse popups
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notchRef.current && !notchRef.current.contains(event.target)) {
        setIsMusicExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Music Handlers
  const hasSong = activeTrack && activeTrack.id !== 0;

  const togglePlay = (e) => {
    e.stopPropagation();
    if (activeTrack.url) {
      setMusicState({ isPlaying: !isPlaying });
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("macos-portfolio-next-track"));
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("macos-portfolio-prev-track"));
  };

  const getCalendarDays = () => {
    const days = [];
    const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      days.push({
        dayName: weekdays[date.getDay()],
        dayNum: String(date.getDate()).padStart(2, "0"),
        isToday: i === 0,
      });
    }
    return days;
  };

  const getMonthName = () => {
    const today = new Date();
    return today.toLocaleString("default", { month: "long" });
  };

  const openCamera = async (e) => {
    e?.stopPropagation();
    const requestId = ++cameraRequestIdRef.current;
    isCameraOpenRef.current = true;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraError("");
    setIsDemoMode(false);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (requestId !== cameraRequestIdRef.current || !isCameraOpenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch (error) {
      if (requestId === cameraRequestIdRef.current && isCameraOpenRef.current) {
        const errorCode = error?.name ? ` (${error.name})` : "";
        setCameraError(`${getCameraErrorMessage(error)}${errorCode}`);
      }
    }
  };

  // Wire the webcam stream to the <video> element once camera overlay is rendered
  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen, cameraStream]);

  useEffect(() => {
    if (!isCameraOpen) return;
    const handleFullscreenChange = () => {
      setIsCameraFullscreen(document.fullscreenElement === cameraOverlayRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isCameraOpen]);

  const toggleCameraFullscreen = async (e) => {
    e.stopPropagation();
    const overlay = cameraOverlayRef.current;
    if (!overlay?.requestFullscreen) return;

    try {
      if (document.fullscreenElement === overlay) {
        await document.exitFullscreen();
      } else {
        await overlay.requestFullscreen();
      }
    } catch (error) {
      console.warn("Could not toggle camera fullscreen:", error);
    }
  };

  const closeCamera = (e) => {
    if (e) e.stopPropagation();
    if (document.fullscreenElement === cameraOverlayRef.current) {
      document.exitFullscreen().catch(() => {});
    }
    isCameraOpenRef.current = false;
    cameraRequestIdRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setIsCameraOpen(false);
    setIsCameraFullscreen(false);
    setIsDemoMode(false);
    setCameraError("");
  };

  const takeSnapshot = (e) => {
    e.stopPropagation();
    // Shutter flash animation and sound
    setCameraFlash(true);
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      }
    } catch {
      /* silent */
    }
    setTimeout(() => setCameraFlash(false), 180);

    if (isDemoMode) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");

        // Draw background gradient
        const grad = ctx.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, "#1e1b4b");
        grad.addColorStop(1, "#311042");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        // Draw Grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < 640; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 480);
          ctx.stroke();
        }
        for (let y = 0; y < 480; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(640, y);
          ctx.stroke();
        }

        // Apply active filter
        if (activeFilter === "grayscale") ctx.filter = "grayscale(100%)";
        else if (activeFilter === "sepia") ctx.filter = "sepia(100%)";
        else if (activeFilter === "cold") ctx.filter = "hue-rotate(180deg) saturate(140%)";
        else if (activeFilter === "vintage")
          ctx.filter = "sepia(50%) contrast(120%) brightness(90%)";
        else if (activeFilter === "invert") ctx.filter = "invert(100%)";
        else ctx.filter = "none";

        // Draw Face box
        ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(220, 140, 200, 200);

        // Draw text
        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("FACE DETECTED", 230, 165);

        // Draw Simulated emoji avatar in center
        ctx.font = "60px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("👨‍💻", 320, 240);

        const link = document.createElement("a");
        link.download = `snapshot-demo-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (err) {
        console.error("Demo Snapshot failed:", err);
      }
      return;
    }

    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");

      // Apply active filter to normal camera snapshot
      if (activeFilter === "grayscale") ctx.filter = "grayscale(100%)";
      else if (activeFilter === "sepia") ctx.filter = "sepia(100%)";
      else if (activeFilter === "cold") ctx.filter = "hue-rotate(180deg) saturate(140%)";
      else if (activeFilter === "vintage") ctx.filter = "sepia(50%) contrast(120%) brightness(90%)";
      else if (activeFilter === "invert") ctx.filter = "invert(100%)";
      else ctx.filter = "none";

      ctx.drawImage(videoRef.current, 0, 0);

      const link = document.createElement("a");
      link.download = `snapshot-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Snapshot failed:", err);
    }
  };

  // Close camera stream on unmount or isMusicExpanded change
  useEffect(() => {
    if (!isMusicExpanded) closeCamera(null);
  }, [isMusicExpanded]);

  useEffect(
    () => () => {
      cameraRequestIdRef.current += 1;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).map((file) => ({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        url: URL.createObjectURL(file),
        type: file.type,
      }));
      setDroppedFiles((prev) => [...prev, ...files]);
    }
  };

  const handleRemoveFile = (e, index) => {
    e.stopPropagation();
    setDroppedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatTime = (sec) => {
    if (isNaN(sec) || sec === Infinity) return "0:00";
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  useEffect(() => {
    const updateTime = () => {
      const audioEl = document.querySelector("audio");
      if (audioEl) {
        setCurrentTime(audioEl.currentTime || 0);
        setDuration(audioEl.duration || 0);
        const progress = (audioEl.currentTime / audioEl.duration) * 100;
        setDragProgress(isNaN(progress) ? 0 : progress);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 500);
    return () => clearInterval(interval);
  }, [isMusicExpanded]);

  let notchClass = "macos-notch compact";
  if (isMusicExpanded) {
    notchClass = "macos-notch expanded";
  } else if (isPlaying && hasSong) {
    notchClass = "macos-notch active-music";
  }

  // Clicking the notch opens the music popup
  const handleNotchClick = () => {
    if (isMusicExpanded) return;
    setIsMusicExpanded(true);
  };

  const getNotchStyle = () => {
    if (isMusicExpanded) {
      return { width: "640px", height: "190px" };
    }
    if (isPlaying && hasSong) {
      return { width: "220px", height: "30px" };
    }
    return { width: "150px", height: "30px" };
  };

  return (
    <div ref={notchRef} className="macos-notch-container" onClick={handleNotchClick}>
      <div className={notchClass} style={getNotchStyle()}>
        {/* Compact Default State */}
        {notchClass === "macos-notch compact" && (
          <div className="w-3 h-3 rounded-full bg-zinc-900 border border-zinc-800" />
        )}

        {/* Active Music Playing Mini State */}
        {notchClass === "macos-notch active-music" && (
          <div className="notch-music-compact">
            <div className="flex items-center gap-1.5 overflow-hidden w-28">
              {activeTrack.coverUrl ? (
                <img
                  src={activeTrack.coverUrl}
                  alt="art"
                  className="w-4 h-4 rounded-sm object-cover flex-shrink-0 animate-spin [animation-duration:8s]"
                />
              ) : (
                <span className="text-[10px] flex-shrink-0">{activeTrack.coverText || "🎵"}</span>
              )}
              <span className="truncate text-white text-[10px] select-none font-medium">
                {activeTrack.title}
              </span>
            </div>
            <div className="notch-wave">
              <div className="notch-wave-bar" />
              <div className="notch-wave-bar" />
              <div className="notch-wave-bar" />
              <div className="notch-wave-bar" />
              <div className="notch-wave-bar" />
            </div>
          </div>
        )}

        {/* Fully Expanded Media Player State */}
        {notchClass === "macos-notch expanded" && (
          <div
            className="notch-nook-expanded w-full h-full flex flex-col justify-between relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient background glow */}
            <div className="notch-ambient-glow" />

            {/* Header section */}
            <div className="notch-nook-header">
              <div className="notch-nook-tabs">
                <button
                  className={`notch-nook-tab ${activeTab === "nook" ? "active" : ""}`}
                  onClick={() => setActiveTab("nook")}
                >
                  <Star size={11} fill={activeTab === "nook" ? "currentColor" : "none"} />
                  Nook
                </button>
                <button
                  className={`notch-nook-tab ${activeTab === "tray" ? "active" : ""}`}
                  onClick={() => setActiveTab("tray")}
                >
                  <Cloud size={11} />
                  Tray
                </button>
              </div>

              <button
                className="notch-nook-settings"
                onClick={() => {
                  openWindow("settings");
                  setIsMusicExpanded(false);
                }}
                title="System Settings"
              >
                <Settings size={14} />
              </button>
            </div>

            {/* Camera flash screen animation */}
            {cameraFlash && (
              <div className="absolute inset-0 bg-white z-50 pointer-events-none rounded-[28px] animate-flash-shutter" />
            )}

            {/* Camera Live Feed Overlay */}
            {isCameraOpen && (
              <div ref={cameraOverlayRef} className="notch-camera-live-overlay">
                {cameraError && !isDemoMode ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
                    <Camera size={24} className="text-zinc-500" />
                    <p className="text-zinc-400 text-[11px]">{cameraError}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold rounded-full transition-all"
                        onClick={closeCamera}
                      >
                        Close
                      </button>
                      <button
                        className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-semibold rounded-full transition-all"
                        onClick={openCamera}
                      >
                        Retry Camera
                      </button>
                      <button
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-full transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDemoMode(true);
                        }}
                      >
                        Try Demo Mode
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Live feed (either video or simulated) */}
                    <div className="relative flex-1 overflow-hidden bg-black">
                      {isDemoMode ? (
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-slate-900 to-purple-950 flex flex-col items-center justify-center overflow-hidden">
                          {/* Grid scan lines */}
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                          {/* Animated scanning bar */}
                          <div className="absolute left-0 right-0 h-[2px] bg-green-500/30 shadow-[0_0_6px_#22c55e] animate-scan-bar pointer-events-none" />

                          {/* Pulsing indicator */}
                          <div className="absolute top-3 left-4 flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] text-green-400 font-bold tracking-widest">
                              DEMO FEED
                            </span>
                          </div>

                          {/* Simulated Face Bracket */}
                          <div className="w-24 h-24 border border-dashed border-green-500/40 rounded-xl relative flex items-center justify-center animate-face-pulse">
                            <span className="absolute top-1 left-1.5 text-[7px] font-bold text-green-400/80 tracking-wider">
                              MOCK FEED
                            </span>
                            <div className="w-2 h-2 border-t-2 border-l-2 border-green-400 absolute top-0 left-0" />
                            <div className="w-2 h-2 border-t-2 border-r-2 border-green-400 absolute top-0 right-0" />
                            <div className="w-2 h-2 border-b-2 border-l-2 border-green-400 absolute bottom-0 left-0" />
                            <div className="w-2 h-2 border-b-2 border-r-2 border-green-400 absolute bottom-0 right-0" />

                            {/* Mock Avatar */}
                            <div className="w-14 h-14 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden">
                              <span className="text-2xl animate-bounce">👨‍💻</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="notch-camera-live-video"
                          style={{
                            filter:
                              activeFilter === "grayscale"
                                ? "grayscale(1)"
                                : activeFilter === "sepia"
                                  ? "sepia(1)"
                                  : activeFilter === "cold"
                                    ? "hue-rotate(180deg) saturate(1.4)"
                                    : activeFilter === "vintage"
                                      ? "sepia(0.5) contrast(1.2) brightness(0.9)"
                                      : activeFilter === "invert"
                                        ? "invert(1)"
                                        : "none",
                          }}
                        />
                      )}

                      {/* Live indicator (for real feed) */}
                      {!isDemoMode && (
                        <div className="absolute top-3 left-4 flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[9px] text-white/80 font-bold tracking-widest">
                            LIVE
                          </span>
                        </div>
                      )}

                      {/* Floating filter switcher */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 z-10">
                        {[
                          { id: "none", name: "Normal" },
                          { id: "grayscale", name: "Mono" },
                          { id: "sepia", name: "Sepia" },
                          { id: "cold", name: "Cold" },
                          { id: "vintage", name: "Warm" },
                          { id: "invert", name: "X-Ray" },
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilter(f.id);
                            }}
                            className={`px-2 py-0.5 text-[8.5px] font-bold rounded-full transition-all ${
                              activeFilter === f.id
                                ? "bg-white text-black"
                                : "text-white/60 hover:text-white hover:bg-white/10"
                            }`}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Capture control bar */}
                    <div className="flex items-center justify-between px-5 py-2.5 bg-zinc-950/90 border-t border-white/5">
                      <button
                        className="text-zinc-400 hover:text-white text-[11px] font-semibold tracking-wide transition-colors"
                        onClick={closeCamera}
                      >
                        ✕ Close
                      </button>
                      <button
                        className="w-10 h-10 rounded-full border-2 border-white bg-transparent flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all group"
                        onClick={takeSnapshot}
                        title="Take Snapshot"
                      >
                        <div className="w-7 h-7 rounded-full bg-white group-active:scale-95 transition-all" />
                      </button>
                      <button
                        className="flex items-center justify-end gap-1.5 text-zinc-400 hover:text-white transition-colors"
                        onClick={toggleCameraFullscreen}
                        aria-label={
                          isCameraFullscreen ? "Exit fullscreen preview" : "View camera fullscreen"
                        }
                        title={isCameraFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
                      >
                        {isCameraFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        <span className="text-[11px] font-medium">Capture</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab content area */}
            <div className="flex-1 w-full overflow-hidden flex flex-col justify-center mt-2.5">
              {activeTab === "nook" ? (
                /* Nook Tab: Music | Calendar | Camera */
                <div
                  className="flex items-center justify-between h-full w-full select-none"
                  style={{ gap: "0" }}
                >
                  {/* Column 1: Music */}
                  <div className="flex items-center gap-3 pr-3.5 border-r border-white/10 h-[85%] w-[33%] flex-shrink-0">
                    <div
                      className="nook-album-art-container flex-shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                      onClick={() => {
                        openWindow("music");
                        setIsMusicExpanded(false);
                      }}
                      title="Open Music App"
                    >
                      <div
                        className={`nook-album-art flex items-center justify-center overflow-hidden relative ${isPlaying ? "playing" : ""}`}
                      >
                        {hasSong && activeTrack.coverUrl ? (
                          <img
                            src={activeTrack.coverUrl}
                            alt="album art"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">{activeTrack.coverText || "🎵"}</span>
                        )}
                      </div>
                      <div className="nook-album-art-glow" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
                      <span className="nook-music-title truncate w-full">
                        {hasSong ? activeTrack.title : "Select a Song"}
                      </span>
                      <span className="nook-music-subtitle truncate w-full">
                        {hasSong ? formatTime(currentTime) : "Jamendo"}
                      </span>
                      <div className="nook-music-controls mt-1 flex items-center gap-1.5">
                        <button className="nook-ctrl-btn" onClick={handlePrev} title="Previous">
                          <SkipBack size={10} fill="currentColor" />
                        </button>
                        <button
                          className="nook-ctrl-btn"
                          onClick={togglePlay}
                          title={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? (
                            <Pause size={11} fill="currentColor" />
                          ) : (
                            <Play size={11} fill="currentColor" />
                          )}
                        </button>
                        <button className="nook-ctrl-btn" onClick={handleNext} title="Next">
                          <SkipForward size={10} fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Calendar */}
                  <div className="flex flex-col justify-center px-4 border-r border-white/10 h-[85%] w-[45%] flex-shrink-0 min-w-0">
                    <div className="nook-cal-month text-left mb-1 pl-0.5 font-bold text-[9.5px] uppercase tracking-wider text-zinc-500">
                      {getMonthName()}
                    </div>
                    <div className="nook-cal-days-row mb-1">
                      {getCalendarDays().map((day, idx) => (
                        <span
                          key={idx}
                          className="nook-cal-day-header-cell"
                          style={{ color: day.isToday ? "#0a84ff" : "" }}
                        >
                          {day.dayName}
                        </span>
                      ))}
                    </div>
                    <div className="nook-cal-days-row mb-1.5">
                      {getCalendarDays().map((day, idx) => (
                        <span
                          key={idx}
                          className={`nook-cal-day-cell ${day.isToday ? "today" : ""}`}
                        >
                          {day.dayNum}
                        </span>
                      ))}
                    </div>
                    <div className="nook-cal-status flex items-center gap-1.5 text-[8.5px] text-zinc-500 font-semibold uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span>Schedule Clear</span>
                    </div>
                  </div>

                  {/* Column 3: Camera */}
                  <div className="flex flex-col items-center justify-center gap-1.5 pl-3.5 h-[85%] w-[22%] flex-shrink-0">
                    <button
                      className="nook-camera-lens-btn"
                      onClick={openCamera}
                      title="Open Camera"
                    >
                      <div className="nook-camera-lens-inner">
                        <Camera size={13} />
                      </div>
                    </button>
                    <span className="nook-camera-label">Camera</span>
                  </div>
                </div>
              ) : (
                /* Tray Tab: Drag & Drop files storage area */
                <div className="notch-tray-container">
                  {droppedFiles.length === 0 ? (
                    <div
                      className={`notch-tray-dropzone ${isDragOver ? "dragover" : ""}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <Cloud
                        size={18}
                        className={`transition-transform ${isDragOver ? "translate-y-[-2px] text-[#0a84ff]" : ""}`}
                      />
                      <span className="text-[10px] font-semibold tracking-wide">
                        Drop files to store temporarily
                      </span>
                    </div>
                  ) : (
                    <div className="notch-tray-files scrollbar-none">
                      {droppedFiles.map((file, idx) => (
                        <div key={idx} className="notch-tray-file-card group">
                          <FileText size={16} className="text-zinc-400 mb-0.5" />
                          <span className="text-[8px] text-white truncate w-full text-center font-medium">
                            {file.name}
                          </span>
                          <span className="text-[6.5px] text-zinc-500">{file.size}</span>

                          <button
                            className="absolute -top-1 -right-1 p-0.5 bg-red-500/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleRemoveFile(e, idx)}
                            title="Remove file"
                          >
                            <Trash2 size={7} />
                          </button>
                        </div>
                      ))}

                      {/* Dropzone Mini to add more files if files are already dropped */}
                      <div
                        className={`notch-tray-add-card ${isDragOver ? "border-[#0a84ff] bg-[#0a84ff]/5 text-white" : ""}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <Cloud size={12} />
                        <span className="text-[7px] font-bold tracking-wide mt-0.5">Add Files</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notch;
