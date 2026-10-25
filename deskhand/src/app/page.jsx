"use client";

import LoadingView from "@module/loading/ui/view/LoadingView";
import Desktop from "@module/desktop";
import gsap from "gsap";
import { useState, useEffect, useCallback } from "react";
import GlobalAudio from "@module/shared/ui/components/GlobalAudio";

import { Draggable } from "gsap/Draggable";
gsap.registerPlugin(Draggable);

export default function Page() {
  const [isMounted, setIsMounted] = useState(false);
  const [booting, setBooting] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleBootComplete = useCallback(() => {
    setBooting(false);
    try {
      sessionStorage.removeItem("isRestartingSystem");
    } catch {
      // storage unavailable: nothing to clear
    }
  }, []);

  const handleLogin = useCallback(() => setIsLoggedIn(true), []);

  if (!isMounted) {
    return <div className="fixed inset-0 bg-black z-99999" suppressHydrationWarning={true} />;
  }

  return (
    <>
      <LoadingView
        booting={booting}
        isLoggedIn={isLoggedIn}
        isMobile={false}
        onBootComplete={handleBootComplete}
        onLogin={handleLogin}
      />
      {isLoggedIn && (
        <>
          <Desktop />
          <GlobalAudio />
        </>
      )}
    </>
  );
}
