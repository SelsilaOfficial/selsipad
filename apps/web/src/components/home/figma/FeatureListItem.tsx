import Link from 'next/link';
import React from 'react';

interface FeatureListItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  href?: string;
}

export function FeatureListItem({ icon, title, description, color, href }: FeatureListItemProps) {
  const content = (
    <div className="group relative rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-4 sm:p-5 hover:border-[#39AEC4]/60 transition-all cursor-pointer shadow-lg hover:shadow-[#756BBA]/30 overflow-hidden h-full flex items-center">
      {/* Hover Glow Effect - Gradient Teal to Purple */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#39AEC4]/0 via-[#756BBA]/0 to-[#756BBA]/0 group-hover:from-[#39AEC4]/10 group-hover:via-[#756BBA]/5 group-hover:to-[#756BBA]/10 transition-all duration-300 rounded-[20px]" />

      <div className="relative z-10 flex items-center gap-4 w-full">
        {/* Icon with Gradient Background */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110 bg-gradient-to-br from-[#39AEC4]/30 via-[#4EABC8]/20 to-[#756BBA]/30 border border-[#39AEC4]/40 group-hover:border-[#756BBA]/60">
          <div className="w-6 h-6 sm:w-7 sm:h-7 text-[#39AEC4] group-hover:text-[#756BBA] transition-colors">
            {icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base sm:text-lg mb-0.5">{title}</h3>
          <p className="text-xs sm:text-sm text-gray-400 truncate">{description}</p>
        </div>

        {/* Arrow */}
        {href && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity -ml-2 mr-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 18L15 12L9 6"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
