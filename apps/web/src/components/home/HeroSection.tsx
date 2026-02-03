'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight, Rocket, Zap, Globe } from 'lucide-react';
import Image from 'next/image';

export function HeroSection() {
  return (
    <section className="relative min-h-[65vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Background handled by PageBackground */}

      <div className="relative z-10 container mx-auto px-4 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4 hover:bg-white/10 transition-colors cursor-default"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-indigo-300">Multi-Chain Launchpad Live</span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-4"
        >
          <span className="text-white">Launch the</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-2xl">
            Next Big Thing
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed"
        >
          The premier multi-chain platform for Fairlaunch, Presales, and Bonding Curves. 
          Secure, transparent, and built for the community.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/explore">
            <button className="group relative px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:scale-105 transition-all duration-300 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)]">
              <span className="relative z-10 flex items-center gap-2">
                Explore Projects
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </Link>
          
          <Link href="/create">
            <button className="group relative px-8 py-4 rounded-full bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm">
              <span className="flex items-center gap-2">
                Start Launch
                <Rocket className="w-5 h-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform text-indigo-400" />
              </span>
            </button>
          </Link>
        </motion.div>

        {/* Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 pt-8 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
        >
           {STATS.map((stat, idx) => (
             <div key={idx} className="text-center group hover:bg-white/5 p-4 rounded-xl transition-colors cursor-default">
               <div className="text-3xl font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">{stat.value}</div>
               <div className="text-sm text-gray-500 font-medium tracking-wide uppercase">{stat.label}</div>
             </div>
           ))}
        </motion.div>
      </div>
    </section>
  );
}

const STATS = [
  { label: 'Total Raised', value: '$45M+' },
  { label: 'Projects Launched', value: '120+' },
  { label: 'Total Participants', value: '85K+' },
  { label: 'Chains Supported', value: '5' },
];
