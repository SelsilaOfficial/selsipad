'use client';

import { motion } from 'framer-motion';

export function PageBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-[#020617]">
      {/* Deep Midnight Gradient Base */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1e1b4b_0%,_transparent_50%)] opacity-40" />
      
      {/* Primary Animated Orb (Top Left - Deep Blue) */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[10%] -left-[10%] w-[80vw] h-[80vw] bg-indigo-900/20 rounded-full blur-[100px]"
      />

      {/* Secondary Animated Orb (Bottom Right - Cyan/Purple) */}
      <motion.div 
        animate={{ 
          scale: [1.1, 1, 1.1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[0%] -right-[10%] w-[70vw] h-[70vw] bg-cyan-900/10 rounded-full blur-[120px]"
      />
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02]" />
    </div>
  );
}
