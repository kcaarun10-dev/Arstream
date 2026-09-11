import React from "react";
import { ALL_CATEGORIES } from "../data/categories";
import { motion } from "motion/react";

interface CategorySliderProps {
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  categoryLiveCounts?: Record<string, number>;
}

export function CategorySlider({ 
  activeCategory, 
  onCategoryChange,
  categoryLiveCounts = {},
}: CategorySliderProps) {
  return (
    <div className="flex gap-2.5 px-1 py-2 overflow-x-auto scrollbar-hide shrink-0 items-center touch-pan-x select-none">
      {ALL_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;
        const liveCount = categoryLiveCounts[cat.id] || 0;

        return (
          <button
            key={cat.id}
            id={`category-btn-${cat.id}`}
            onClick={() => {
              if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                (navigator as any).vibrate(12);
              }
              onCategoryChange(cat.id);
            }}
            className={`group relative flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 whitespace-nowrap shrink-0 min-h-[40px] touch-manipulation active:scale-95 cursor-pointer ${
              isActive
                ? "bg-white text-black font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] border-white"
                : "bg-white/[0.05] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.1] hover:border-cyan-400/40"
            }`}
          >
            <div className={`transition-colors ${
              isActive ? "text-black" : "text-white/60 group-hover:text-white"
            }`}>
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />
            </div>

            <span className={`text-xs font-semibold tracking-tight transition-colors ${
              isActive ? "text-black" : "text-white/75 group-hover:text-white"
            }`}>
              {cat.name}
            </span>

            {/* Live Indicator Pill on Sport if games are happening */}
            {liveCount > 0 && (
              <span className={`flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold ${
                isActive ? "bg-[#FF453A] text-white" : "bg-[#FF453A] text-white animate-pulse"
              }`}>
                <span className="w-1 h-1 rounded-full bg-white" />
                <span>{liveCount}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
