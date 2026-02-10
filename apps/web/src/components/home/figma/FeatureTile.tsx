import React from 'react';

interface FeatureTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

export function FeatureTile({ icon, title, description, color }: FeatureTileProps) {
  return (
    <div className="group relative rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 p-4 sm:p-6 hover:border-[#824DFF]/50 transition-all cursor-pointer shadow-lg hover:shadow-[#824DFF]/20 hover:shadow-2xl overflow-hidden">
      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#824DFF]/0 to-[#824DFF]/0 group-hover:from-[#824DFF]/10 group-hover:to-transparent transition-all duration-300 rounded-[20px]" />

      <div className="relative z-10">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 transition-all group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${color}30, ${color}10)`,
            border: `1px solid ${color}40`,
          }}
        >
          <div style={{ color }} className="w-5 h-5 sm:w-6 sm:h-6">
            {icon}
          </div>
        </div>
        <h3 className="font-semibold mb-1 text-sm sm:text-base">{title}</h3>
        <p className="text-xs text-gray-400 leading-tight">{description}</p>
      </div>
    </div>
  );
}
