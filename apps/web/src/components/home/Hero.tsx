'use client';

import React, { useEffect, useState } from 'react';

export function Hero() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // 1. Check reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    // 2. Load Spline script dynamically
    const scriptId = 'spline-viewer-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'module';
      script.src = 'https://unpkg.com/@splinetool/viewer@1.12.51/build/spline-viewer.js';
      document.body.appendChild(script);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0B10]">
      {/* Background Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {!reduceMotion ? (
          // @ts-ignore
          <spline-viewer url="https://prod.spline.design/tlQbfPCmTOar9ktx/scene.splinecode" />
        ) : (
          // Reduced Motion Fallback: Static Image/Gradient
          <div className="w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,#000000_100%)] flex items-center justify-center">
            <img
              src="/assets/selsipad-full-logo.png"
              alt="Selsipad Logo"
              className="w-1/2 max-w-[500px] opacity-20 blur-sm"
            />
          </div>
        )}
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(130,77,255,0.25),transparent_55%)]" />

      {/* Content */}
      <div className="relative z-10 px-6 pt-24 text-white flex flex-col items-center justify-center h-[80vh]">
        <h1 className="text-5xl md:text-8xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/50 drop-shadow-2xl">
          SELSIPAD
        </h1>
        <p className="mt-4 text-xl text-white/60 font-light tracking-wide">
          The Future of Decentralized Launchpads
        </p>
      </div>
    </div>
  );
}
