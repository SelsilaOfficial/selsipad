'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  className = '',
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((opt) => opt.value === value)?.label || label;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl
          bg-bg-elevated/50 border transition-all duration-200
          hover:bg-bg-elevated hover:border-border-subtle
          ${isOpen ? 'border-primary-main/50 ring-1 ring-primary-main/20' : 'border-border-subtle/50'}
        `}
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">
            {label}
          </span>
          <span className="text-sm font-medium text-text-primary">{selectedLabel}</span>
        </div>
        <ChevronDown
          size={16}
          className={`text-text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 p-1 bg-bg-card border border-border-subtle rounded-xl shadow-xl overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-border-subtle scrollbar-track-transparent">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors
                    ${
                      value === option.value
                        ? 'bg-primary-main/10 text-primary-main font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
