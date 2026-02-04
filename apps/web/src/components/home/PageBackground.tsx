'use client';

import { motion } from 'framer-motion';

export function PageBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Deep Space Gradient Base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-bg-page" />
      
      {/* Primary Animated Orb (Top Left) */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[10%] -left-[10%] w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-indigo-600/15 rounded-full blur-[120px]"
      />

      {/* Secondary Animated Orb (Bottom Right) */}
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[0%] -right-[10%] w-[70vw] h-[70vw] max-w-[700px] max-h-[700px] bg-purple-600/10 rounded-full blur-[140px]"
      />

      {/* Tertiary Accent Orb (Center-ish) - Adds depth to middle sections */}
      <motion.div 
        animate={{ 
          scale: [0.8, 1, 0.8],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        className="absolute top-[40%] left-[20%] w-[600px] h-[600px] bg-blue-500/05 rounded-full blur-[100px]"
      />
      
      {/* Grid Mesh Texture */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />
    </div>
  );
}
