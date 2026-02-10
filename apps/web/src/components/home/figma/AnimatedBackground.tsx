'use client';

import React from 'react';
import { motion } from 'motion/react';

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Pure Black Background */}
      <div className="absolute inset-0 bg-black" />

      {/* Animated Gradient Orbs with Cyan tones */}
      <motion.div
        className="absolute w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(57, 174, 196, 0.4) 0%, rgba(78, 171, 200, 0.2) 50%, transparent 70%)',
        }}
        animate={{
          x: ['-10%', '110%'],
          y: ['20%', '80%'],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute w-80 h-80 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(117, 107, 186, 0.3) 0%, rgba(117, 107, 186, 0.15) 50%, transparent 70%)',
        }}
        animate={{
          x: ['100%', '-10%'],
          y: ['70%', '10%'],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(81, 163, 201, 0.35) 0%, rgba(57, 174, 196, 0.2) 50%, transparent 70%)',
        }}
        animate={{
          x: ['50%', '30%'],
          y: ['-10%', '100%'],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: 'reverse',
          ease: 'easeInOut',
        }}
      />

      {/* Stars/Particles Effect */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(2px 2px at 20% 30%, white, transparent),
                           radial-gradient(2px 2px at 60% 70%, white, transparent),
                           radial-gradient(1px 1px at 50% 50%, white, transparent),
                           radial-gradient(1px 1px at 80% 10%, white, transparent),
                           radial-gradient(2px 2px at 90% 60%, white, transparent),
                           radial-gradient(1px 1px at 33% 80%, white, transparent),
                           radial-gradient(1px 1px at 15% 55%, white, transparent)`,
          backgroundSize: '200% 200%',
          backgroundPosition: '0% 0%',
        }}
      />
    </div>
  );
}
