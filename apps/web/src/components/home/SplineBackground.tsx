'use client';

import React, { Suspense } from 'react';

// Lazy load Spline to avoid heavy initial bundle size
const Spline = React.lazy(() => import('@splinetool/react-spline'));

export function SplineBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Fallback while loading */}
      <Suspense
        fallback={
          <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="animate-pulse text-[#39AEC4]">Loading 3D Scene...</div>
          </div>
        }
      >
        <Spline
          className="w-full h-full"
          scene="https://prod.spline.design/tlQbfPCmTOar9ktx/scene.splinecode"
        />
      </Suspense>

      {/* Overlay to ensure text readability if the 3D scene is too bright */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
    </div>
  );
}
