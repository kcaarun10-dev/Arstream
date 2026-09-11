import React, { useState, useEffect } from "react";
import { 
  Search, 
  RotateCw, 
  Radio, 
  Sparkles, 
  MessageSquarePlus, 
  LayoutGrid, 
  ListOrdered, 
  TableProperties, 
  Star, 
  X, 
  Flame, 
  Wifi, 
  Zap, 
  Clock, 
  Filter 
} from "lucide-react";

export type ViewMode = "grid" | "epg" | "compact";

interface BroadcastHeaderProps {
  search: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isLiveOnly: boolean;
  onToggleLiveOnly: () => void;
  showSavedOnly: boolean;
  onToggleSavedOnly: () => void;
  savedCount: number;
  liveCount: number;
  onRequestMatchClick: () => void;
  onResetToHome: () => void;
}

export function BroadcastHeader({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  isLiveOnly,
  onToggleLiveOnly,
  showSavedOnly,
  onToggleSavedOnly,
  savedCount,
  liveCount,
  onRequestMatchClick,
  onResetToHome,
}: BroadcastHeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <header className="sticky top-0 z-40 shrink-0 bg-[#000000]/65 backdrop-blur-2xl border-b border-white/[0.08]">
      {/* Main Command Bar */}
      <div className="h-16 px-4 sm:px-8 flex items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Brand & Monogram */}
        <div 
          onClick={onResetToHome}
          className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center p-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.2)] transition-transform group-hover:scale-105">
              <img
                src="/logo.svg"
                alt="AR Stream"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            {/* Live on-air beacon */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#FF453A] border-2 border-black shadow-[0_0_8px_rgba(255,69,58,0.8)]" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-white/80 transition-colors">
                AR Stream
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/30 text-[10px] font-semibold text-[#FF453A]">
                LIVE
              </span>
            </div>
            <span className="text-[11px] text-white/45 font-medium tracking-normal hidden sm:block">
              Sports & Live Streams
            </span>
          </div>
        </div>

        {/* Center Search Input */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-6 relative hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-white" size={15} />
          <input
            id="broadcast-search-input"
            type="text"
            placeholder="Search teams, fixtures, tournaments..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] border border-white/[0.08] focus:border-white/25 rounded-full py-2 pl-9 pr-9 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none transition-all font-normal"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View Mode Controls & Quick Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Only Filter Toggle */}
          <button
            onClick={onToggleLiveOnly}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isLiveOnly
                ? "bg-[#FF453A]/15 border-[#FF453A]/40 text-[#FF453A] shadow-sm"
                : "bg-white/[0.05] border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08]"
            }`}
            title="Show only live matches currently broadcasting"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveOnly ? "bg-[#FF453A] animate-ping" : "bg-white/40"}`} />
            <span className="hidden sm:inline">Live Only</span>
            {liveCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isLiveOnly ? "bg-[#FF453A] text-white" : "bg-white/15"}`}>
                {liveCount}
              </span>
            )}
          </button>

          {/* Watchlist Quick Filter */}
          <button
            onClick={onToggleSavedOnly}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              showSavedOnly
                ? "bg-[#FF9F0A]/15 border-[#FF9F0A]/40 text-[#FF9F0A]"
                : "bg-white/[0.05] border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08]"
            }`}
            title="View bookmarked matches"
          >
            <Star size={13} className={showSavedOnly || savedCount > 0 ? "fill-[#FF9F0A] text-[#FF9F0A]" : ""} />
            <span className="hidden sm:inline">Watchlist</span>
            {savedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#FF9F0A]/20 text-[#FF9F0A] text-[10px] font-mono font-semibold">
                {savedCount}
              </span>
            )}
          </button>

          {/* View Mode Switcher (Apple Segmented Control) */}
          <div className="hidden lg:flex items-center apple-segmented-track">
            <button
              onClick={() => onViewModeChange("grid")}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === "grid"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/45 hover:text-white"
              }`}
              title="Grid Card View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => onViewModeChange("epg")}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === "epg"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/45 hover:text-white"
              }`}
              title="EPG Schedule View"
            >
              <ListOrdered size={14} />
            </button>
            <button
              onClick={() => onViewModeChange("compact")}
              className={`p-1.5 rounded-full transition-all ${
                viewMode === "compact"
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/45 hover:text-white"
              }`}
              title="Compact Table View"
            >
              <TableProperties size={14} />
            </button>
          </div>

          {/* Request Match CTA */}
          <button
            id="request-match-header-btn"
            onClick={onRequestMatchClick}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Request a fixture"
          >
            <MessageSquarePlus size={14} />
            <span className="hidden xl:inline">Request</span>
          </button>

          {/* Refresh Action */}
          <button
            id="refresh-app-btn"
            onClick={handleRefresh}
            className={`p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white/70 hover:text-white transition-all active:scale-95 cursor-pointer ${
              isRefreshing ? "animate-spin text-white" : ""
            }`}
            title="Refresh stream list"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="px-4 pb-3 md:hidden">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={15} />
          <input
            type="text"
            placeholder="Search matches or teams..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white/[0.08] border border-white/[0.1] rounded-full py-2 pl-9 pr-9 text-base sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30 touch-manipulation min-h-[42px]"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white touch-manipulation"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
