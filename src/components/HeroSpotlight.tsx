import React, { useState, useEffect, useCallback } from "react";
import { Match } from "../types";
import { 
  Play, 
  Eye, 
  Clock, 
  Trophy, 
  ChevronLeft, 
  ChevronRight, 
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getMatchDynamicStatus } from "../utils/sportsSchedule";
import { formatViewerCount } from "../utils/realtimeViewers";
import { useWatchlist } from "../utils/watchlist";
import { showSponsoredAd } from "../utils/adManager";

interface HeroSpotlightProps {
  matches: Match[];
  onSelectMatch: (match: Match) => void;
  nowMs: number;
  liveViewersMap: Record<string, number>;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 120 : -120,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring", stiffness: 320, damping: 32 },
      opacity: { duration: 0.28 },
      scale: { duration: 0.28 },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 120 : -120,
    opacity: 0,
    scale: 0.97,
    transition: {
      x: { type: "spring", stiffness: 320, damping: 32 },
      opacity: { duration: 0.2 },
    },
  }),
};

export function HeroSpotlight({
  matches,
  onSelectMatch,
  nowMs,
  liveViewersMap,
}: HeroSpotlightProps) {
  const { isSaved, toggle } = useWatchlist();
  const [[page, direction], setPage] = useState<[number, number]>([0, 0]);
  const [isPaused, setIsPaused] = useState(false);

  // Pick top marquee candidates: Live first, then upcoming starting soonest
  const spotlightCandidates = React.useMemo(() => {
    if (!matches || matches.length === 0) return [];

    const liveList = matches.filter((m) => getMatchDynamicStatus(m, nowMs).isLive);
    const upcomingList = matches
      .filter((m) => getMatchDynamicStatus(m, nowMs).isUpcoming)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Priority: Live matches, fallback to upcoming matches, max 5 items
    const combined = [...liveList, ...upcomingList].slice(0, 5);
    return combined;
  }, [matches, nowMs]);

  const paginate = useCallback((newDirection: number) => {
    if (spotlightCandidates.length === 0) return;
    setPage(([prevPage]) => {
      const nextIndex = (prevPage + newDirection + spotlightCandidates.length) % spotlightCandidates.length;
      return [nextIndex, newDirection];
    });
  }, [spotlightCandidates.length]);

  const handleNext = () => paginate(1);
  const handlePrev = () => paginate(-1);

  // Auto advance spotlight every 7 seconds if not hovered or dragged
  useEffect(() => {
    if (spotlightCandidates.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      paginate(1);
    }, 7000);
    return () => clearInterval(interval);
  }, [spotlightCandidates.length, isPaused, paginate]);

  if (spotlightCandidates.length === 0) return null;

  const currentIndex = ((page % spotlightCandidates.length) + spotlightCandidates.length) % spotlightCandidates.length;
  const currentMatch = spotlightCandidates[currentIndex] || spotlightCandidates[0];
  const dynamicStatus = getMatchDynamicStatus(currentMatch, nowMs);
  const liveCount = liveViewersMap[currentMatch.id] || 0;
  const bookmarked = isSaved(currentMatch.id);

  return (
    <div 
      className="relative w-full rounded-3xl overflow-hidden border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.7)] apple-ai-card group select-none touch-pan-y"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Specular Apple luminous top edge highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none z-30" />
      
      {/* Dynamic Stadium & Ambient Atmosphere Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
        
        {/* Animated ambient stadium floodlights */}
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

        {/* Stadium grid overlay texture */}
        <div 
          className="absolute inset-0 opacity-10 bg-repeat"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 0)",
            backgroundSize: "24px 24px"
          }}
        />
      </div>

      {/* Main Spotlight Content */}
      <div className="relative z-20 p-5 sm:p-7 md:p-8 flex flex-col justify-between min-h-[280px] sm:min-h-[310px]">
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            {/* Live or Countdown Pill */}
            {dynamicStatus.isLive ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-xs font-semibold backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-[#FF453A] animate-ping" />
                <span>LIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] border border-white/10 text-white/80 text-xs font-medium">
                <Clock size={13} className="text-white/60" />
                <span>Starts in {Math.max(1, Math.round((dynamicStatus.startMs - nowMs) / 60000))}m</span>
              </div>
            )}

            {/* League / Tournament Chip */}
            <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/[0.08] border border-white/[0.1] text-white/90 text-xs font-medium backdrop-blur-md">
              <Trophy size={13} className="text-white/80" />
              <span className="truncate max-w-[200px] sm:max-w-[320px]">
                {currentMatch.league || currentMatch.tournament || currentMatch.eventName || "World Championship"}
              </span>
            </div>

            {/* Stream Quality Tag */}
            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/10 text-[10px] font-mono font-medium text-white/70">
              HD
            </span>
          </div>

          {/* Viewers & Bookmark Actions */}
          <div className="flex items-center gap-2">
            {liveCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/10 text-white/80 text-xs font-mono font-medium backdrop-blur-md">
                <Eye size={13} className="text-[#FF453A]" />
                <span>{formatViewerCount(liveCount)} watching</span>
              </div>
            )}

            <button
              onClick={() => toggle(currentMatch.id)}
              className={`p-2 rounded-full border transition-all cursor-pointer ${
                bookmarked
                  ? "bg-[#FF9F0A]/20 border-[#FF9F0A]/50 text-[#FF9F0A]"
                  : "bg-white/[0.06] border-white/10 text-white/60 hover:text-white hover:bg-white/10"
              }`}
              title={bookmarked ? "Remove from Watchlist" : "Save to Watchlist"}
            >
              <Star size={15} className={bookmarked ? "fill-[#FF9F0A]" : ""} />
            </button>
          </div>
        </div>

        {/* Center Match Face-off Presentation with Hardware-Accelerated Kinetic Drag Swipe */}
        <div className="relative overflow-hidden my-4 sm:my-5">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentMatch.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragStart={() => setIsPaused(true)}
              onDragEnd={(_e, { offset, velocity }) => {
                setIsPaused(false);
                const swipePower = Math.abs(offset.x) * velocity.x;
                if (offset.x < -40 || swipePower < -8000) {
                  paginate(1);
                } else if (offset.x > 40 || swipePower > 8000) {
                  paginate(-1);
                }
              }}
              className="flex flex-col md:flex-row items-center justify-between gap-6 cursor-grab active:cursor-grabbing touch-pan-y"
            >
              {/* Match Teams Info */}
              <div className="flex items-center justify-center md:justify-start gap-4 sm:gap-6 w-full md:w-auto">
                {/* Team 1 */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1 md:flex-initial justify-end md:justify-start">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.06] border border-white/15 p-2 flex items-center justify-center shadow-md shrink-0 group-hover:border-white/30 transition-colors pointer-events-none">
                    {currentMatch.team1Logo ? (
                      <img
                        src={currentMatch.team1Logo}
                        alt={currentMatch.team1}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-base font-bold text-white">
                        {currentMatch.team1.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="text-right md:text-left min-w-0 pointer-events-none">
                    <h3 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
                      {currentMatch.team1}
                    </h3>
                    <span className="text-[11px] text-white/40 font-medium tracking-normal">Home</span>
                  </div>
                </div>

                {/* VS Pill */}
                <div className="flex flex-col items-center shrink-0 px-2 pointer-events-none">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/15 text-[10px] font-mono font-bold text-white/80">
                    VS
                  </span>
                  <span className="text-[10px] text-white/40 font-mono mt-1">
                    {dynamicStatus.isLive ? "LIVE" : new Date(currentMatch.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Team 2 */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1 md:flex-initial">
                  <div className="min-w-0 pointer-events-none">
                    <h3 className="text-base sm:text-xl md:text-2xl font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-[200px]">
                      {currentMatch.team2}
                    </h3>
                    <span className="text-[11px] text-white/40 font-medium tracking-normal">Away</span>
                  </div>
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.06] border border-white/15 p-2 flex items-center justify-center shadow-md shrink-0 group-hover:border-white/30 transition-colors pointer-events-none">
                    {currentMatch.team2Logo ? (
                      <img
                        src={currentMatch.team2Logo}
                        alt={currentMatch.team2}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-base font-bold text-white">
                        {currentMatch.team2.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action CTAs - Apple TV Style White Pill Watch Live Button */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end shrink-0">
                <button
                  onClick={() => {
                    showSponsoredAd();
                    onSelectMatch(currentMatch);
                  }}
                  className="w-full md:w-auto min-h-[46px] px-8 py-3 rounded-full apple-btn-primary flex items-center justify-center gap-2.5 cursor-pointer touch-manipulation text-sm font-semibold hover:scale-105 active:scale-95 transition-transform"
                >
                  <Play size={16} className="fill-black text-black" />
                  <span>Watch Live</span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Indicators / Navigation Controls */}
        {spotlightCandidates.length > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/40 font-semibold tracking-wider uppercase">
                Spotlight ({currentIndex + 1}/{spotlightCandidates.length})
              </span>
              <span className="text-[10px] text-cyan-400/70 font-mono hidden sm:inline">
                • Drag or swipe to switch
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Touch friendly pagination dots */}
              <div className="flex items-center">
                {spotlightCandidates.map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      const dir = idx > currentIndex ? 1 : -1;
                      setPage([idx, dir]);
                    }}
                    className="p-2 flex items-center justify-center touch-manipulation cursor-pointer"
                    aria-label={`Go to slide ${idx + 1}`}
                  >
                    <span 
                      className={`h-2 rounded-full transition-all duration-300 block ${
                        idx === currentIndex
                          ? "w-7 bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                          : "w-2 bg-white/20 hover:bg-white/40"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 ml-1">
                <button
                  onClick={handlePrev}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.15] text-white/70 hover:text-white transition-all active:scale-90 flex items-center justify-center touch-manipulation cursor-pointer"
                  aria-label="Previous event"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNext}
                  className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.15] text-white/70 hover:text-white transition-all active:scale-90 flex items-center justify-center touch-manipulation cursor-pointer"
                  aria-label="Next event"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
