import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Match } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { getMatchDynamicStatus, sortMatches, isCategoryMatch, isMatchVisibleForUser } from "../utils/sportsSchedule";
import { 
  Radio, 
  Clock, 
  CheckCircle2, 
  Eye, 
  Play, 
  Star, 
  Trophy, 
  ChevronRight, 
  Tv, 
  Flame, 
  ExternalLink,
  Calendar,
  Sparkles
} from "lucide-react";
import { useAllMatchesRealtimeViewers, formatViewerCount } from "../utils/realtimeViewers";
import { showSponsoredAd } from "../utils/adManager";
import { useWatchlist } from "../utils/watchlist";
import { ViewMode } from "./BroadcastHeader";

interface ChannelListProps {
  matches: Match[];
  selectedMatchId?: string;
  onSelect: (match: Match) => void;
  search: string;
  activeCategory: string;
  activeStatus: string;
  viewMode?: ViewMode;
  showSavedOnly?: boolean;
}

function MatchStatusBadge({ match, nowMs, liveCount }: { match: Match; nowMs: number; liveCount?: number }) {
  const dynamicStatus = getMatchDynamicStatus(match, nowMs);

  if (dynamicStatus.isLive) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <div className="flex items-center gap-1.5 bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-normal">
          <span className="w-1.5 h-1.5 bg-[#FF453A] rounded-full animate-ping" />
          <span>LIVE</span>
        </div>
        {liveCount !== undefined && liveCount > 0 && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/10 text-white/80 text-[10px] font-mono">
            <Eye size={10} className="text-[#FF453A]" />
            <span>{formatViewerCount(liveCount)}</span>
          </div>
        )}
      </div>
    );
  }

  if (dynamicStatus.isUpcoming) {
    const diff = dynamicStatus.startMs - nowMs;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return (
      <div className="text-right leading-tight">
        <div className="inline-flex items-center gap-1 text-[10px] font-medium text-white/80 bg-white/[0.08] border border-white/10 px-2.5 py-0.5 rounded-full">
          <Clock size={10} className="text-white/60" />
          <span>In {timeStr}</span>
        </div>
        <div className="text-[9px] text-white/40 font-mono mt-0.5">
          {new Date(match.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    );
  }

  const minsAgo = dynamicStatus.minutesSinceEnd ?? 0;
  return (
    <div className="text-right leading-tight">
      <div className="inline-flex items-center gap-1 text-[9px] font-medium text-white/60 bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={10} className="text-white/40" />
        <span>Ended</span>
      </div>
      <div className="text-[9px] text-white/40 font-mono mt-0.5">
        {minsAgo > 0 ? `${minsAgo}m ago` : "Finished"}
      </div>
    </div>
  );
}

export const ChannelList = React.memo(function ChannelList({
  matches,
  selectedMatchId,
  onSelect,
  search,
  activeCategory,
  activeStatus,
  viewMode = "grid",
  showSavedOnly = false,
}: ChannelListProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const livePresenceMap = useAllMatchesRealtimeViewers();
  const { isSaved, toggle } = useWatchlist();

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const processedMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    const filtered = matches.filter((m) => {
      // Watchlist filter
      if (showSavedOnly && !isSaved(m.id)) {
        return false;
      }

      const matchDynamic = getMatchDynamicStatus(m, nowMs);

      // Category filter
      if (!isCategoryMatch(m.category, m.tournament || m.league, activeCategory)) {
        return false;
      }

      // Status filter
      if (activeStatus === "live") {
        if (!matchDynamic.isLive) return false;
      } else if (activeStatus === "upcoming") {
        if (!matchDynamic.isUpcoming || (matchDynamic.startMs - nowMs > TWENTY_FOUR_HOURS_MS)) return false;
      } else if (activeStatus === "finished") {
        if (!matchDynamic.isFinished && !matchDynamic.isEnded) return false;
        if (!matchDynamic.isWithinFinishedGracePeriod) return false;
      } else {
        if (!isMatchVisibleForUser(m, nowMs)) {
          return false;
        }
      }

      if (query) {
        return (
          (m.team1 || "").toLowerCase().includes(query) ||
          (m.team2 || "").toLowerCase().includes(query) ||
          (m.category || "").toLowerCase().includes(query) ||
          (m.tournament || "").toLowerCase().includes(query) ||
          (m.league || "").toLowerCase().includes(query) ||
          (m.eventName || "").toLowerCase().includes(query)
        );
      }

      return true;
    });

    return sortMatches(filtered, nowMs);
  }, [matches, activeCategory, activeStatus, search, nowMs, showSavedOnly, isSaved]);

  // EPG Grouping: Live Now, Next 2 Hours, Today Later, Tomorrow/Future
  const epgGroups = useMemo(() => {
    if (viewMode !== "epg") return null;

    const twoHoursMs = 2 * 60 * 60 * 1000;
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayMs = endOfToday.getTime();

    const live: Match[] = [];
    const startingSoon: Match[] = [];
    const laterToday: Match[] = [];
    const upcomingDays: Match[] = [];

    processedMatches.forEach((m) => {
      const dyn = getMatchDynamicStatus(m, nowMs);
      if (dyn.isLive) {
        live.push(m);
      } else if (dyn.isUpcoming) {
        if (dyn.startMs - nowMs <= twoHoursMs) {
          startingSoon.push(m);
        } else if (dyn.startMs <= endOfTodayMs) {
          laterToday.push(m);
        } else {
          upcomingDays.push(m);
        }
      } else {
        laterToday.push(m);
      }
    });

    return [
      { title: "Live Broadcasts (On Air Now)", badge: "LIVE", matches: live, isLive: true },
      { title: "Starting Soon (Next 2 Hours)", badge: "SOON", matches: startingSoon },
      { title: "Scheduled Prime Time Today", badge: "TODAY", matches: laterToday },
      { title: "Upcoming Schedule & Tomorrow", badge: "UPCOMING", matches: upcomingDays },
    ].filter((g) => g.matches.length > 0);
  }, [processedMatches, viewMode, nowMs]);

  if (processedMatches.length === 0) {
    return (
      <div className="text-center py-20 px-4 bg-[#0a0d16]/50 rounded-3xl border border-white/[0.06] my-4">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-3 text-white/40">
          <Trophy size={24} />
        </div>
        <h3 className="text-base font-bold text-white mb-1">No Matches Found</h3>
        <p className="text-xs text-white/50 max-w-md mx-auto">
          {showSavedOnly 
            ? "You haven't bookmarked any matches yet. Click the star icon on any fixture to add it to your watchlist!"
            : "No fixtures match your selected filter or search query. Try changing categories or check back soon for updated broadcasts."}
        </p>
      </div>
    );
  }

  // Render EPG Schedule Guide View
  if (viewMode === "epg" && epgGroups) {
    return (
      <div className="space-y-6 pb-20">
        {epgGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                group.isLive ? "bg-[#FF453A] text-white" : "bg-white/10 text-white/80"
              }`}>
                {group.badge}
              </span>
              <h3 className="text-xs font-semibold text-white/80">
                {group.title} ({group.matches.length})
              </h3>
            </div>

            <div className="apple-card divide-y divide-white/[0.06] overflow-hidden">
              {group.matches.map((match, mIdx) => {
                const isSelected = selectedMatchId === match.id;
                const dynamicStatus = getMatchDynamicStatus(match, nowMs);
                const bookmarked = isSaved(match.id);
                const liveCount = livePresenceMap[match.id];

                return (
                  <div
                    key={`${match.id || 'match'}-${mIdx}`}
                    className={`flex items-center justify-between p-3.5 sm:p-4 hover:bg-white/[0.04] transition-colors gap-3 ${
                      isSelected ? "bg-white/[0.08]" : ""
                    }`}
                  >
                    {/* Time / Status Column */}
                    <div className="w-20 sm:w-24 shrink-0">
                      {dynamicStatus.isLive ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-[10px] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A] animate-ping" />
                          <span>LIVE</span>
                        </div>
                      ) : (
                        <div className="text-xs font-mono font-medium text-white/80">
                          {new Date(match.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      <div className="text-[10px] text-white/40 truncate mt-0.5">
                        {match.category?.toUpperCase() || "SPORT"}
                      </div>
                    </div>

                    {/* League & Teams Column */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-white/50 truncate uppercase tracking-wider">
                        {match.league || match.tournament || "Championship"}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-2 font-bold text-sm text-white truncate">
                          <span className="truncate">{match.team1}</span>
                          <span className="text-white/40 text-xs font-mono px-1">vs</span>
                          <span className="truncate">{match.team2}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggle(match.id)}
                        className={`p-2 rounded-full transition-colors ${
                          bookmarked ? "text-[#FF9F0A] bg-[#FF9F0A]/15" : "text-white/30 hover:text-white"
                        }`}
                        title="Bookmark match"
                      >
                        <Star size={14} className={bookmarked ? "fill-[#FF9F0A]" : ""} />
                      </button>

                      <button
                        onClick={() => {
                          showSponsoredAd();
                          onSelect(match);
                        }}
                        className="px-4 py-2 rounded-full apple-btn-primary text-black font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <Play size={12} className="fill-black text-black" />
                        <span>Watch Live</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render Compact Table View
  if (viewMode === "compact") {
    return (
      <div className="apple-card overflow-hidden divide-y divide-white/[0.06] pb-20">
        <div className="grid grid-cols-12 px-4 py-2.5 bg-black/40 text-[10px] font-mono text-white/40 uppercase tracking-wider">
          <div className="col-span-2 sm:col-span-2">Time</div>
          <div className="col-span-4 sm:col-span-3">Tournament</div>
          <div className="col-span-5 sm:col-span-5">Fixture</div>
          <div className="col-span-1 sm:col-span-2 text-right">Action</div>
        </div>

        {processedMatches.map((match, cIdx) => {
          const dynamicStatus = getMatchDynamicStatus(match, nowMs);
          const bookmarked = isSaved(match.id);

          return (
            <div
              key={`${match.id || 'compact'}-${cIdx}`}
              className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors text-xs text-white"
            >
              <div className="col-span-2 sm:col-span-2 flex items-center gap-1.5">
                {dynamicStatus.isLive ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-[10px] font-semibold">
                    LIVE
                  </span>
                ) : (
                  <span className="text-white/70 font-mono text-[11px]">
                    {new Date(match.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              <div className="col-span-4 sm:col-span-3 truncate text-white/50 text-[11px]">
                {match.league || match.tournament || match.category?.toUpperCase() || "Sport"}
              </div>

              <div className="col-span-5 sm:col-span-5 flex items-center gap-2 truncate font-semibold">
                <span className="truncate">{match.team1}</span>
                <span className="text-white/30 text-[10px] font-mono">VS</span>
                <span className="truncate">{match.team2}</span>
              </div>

              <div className="col-span-1 sm:col-span-2 flex items-center justify-end gap-1.5">
                <button
                  onClick={() => toggle(match.id)}
                  className={`p-1.5 rounded-full ${bookmarked ? "text-[#FF9F0A]" : "text-white/30 hover:text-white"}`}
                >
                  <Star size={12} className={bookmarked ? "fill-[#FF9F0A]" : ""} />
                </button>
                <button
                  onClick={() => {
                    showSponsoredAd();
                    onSelect(match);
                  }}
                  className="p-1.5 px-3 rounded-full apple-btn-primary text-black font-semibold text-[11px] flex items-center gap-1"
                >
                  <Play size={10} className="fill-black text-black" />
                  <span className="hidden sm:inline">Watch</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Default: Grid Card Presentation
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 pb-24">
      {processedMatches.map((match, gIdx) => {
        const isSelected = selectedMatchId === match.id;
        const dynamicStatus = getMatchDynamicStatus(match, nowMs);
        const liveCount = livePresenceMap[match.id];
        const bookmarked = isSaved(match.id);
        const channelCount = match.channels?.length || 1;

        return (
          <div
            key={`${match.id || 'grid'}-${gIdx}`}
            onClick={() => {
              if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                (navigator as any).vibrate(15);
              }
              showSponsoredAd();
              onSelect(match);
            }}
            className={`group relative rounded-3xl p-5 text-left transition-all duration-200 overflow-hidden apple-card cursor-pointer select-none touch-manipulation active:scale-[0.985] ${
              isSelected
                ? "ring-2 ring-white/40 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
                : dynamicStatus.isLive
                ? "border-[#FF453A]/30 hover:border-[#FF453A]/50 shadow-[0_4px_24px_rgba(255,69,58,0.08)]"
                : "border-white/[0.08] hover:border-white/20"
            }`}
          >
            {/* Ambient live pulse background effect */}
            {dynamicStatus.isLive && (
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#FF453A]/10 rounded-full blur-2xl pointer-events-none" />
            )}

            {/* Top Bar: League & Status Badge */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* League Badge / Icon */}
                <div className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.06] p-1 shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
                  {(match.leagueLogo?.trim() || match.tournamentLogo?.trim()) ? (
                    <img
                      src={match.leagueLogo?.trim() || match.tournamentLogo?.trim()}
                      alt="League logo"
                      className="w-full h-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Trophy size={14} className="text-white/70" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-white/80 font-semibold truncate">
                    {match.league || match.tournament || match.eventName || "Live Championship"}
                  </div>
                  <div className="text-[10px] text-white/40 font-medium truncate">
                    {match.category?.toUpperCase() || "SPORT"} • {channelCount} {channelCount === 1 ? "Stream" : "Streams"} Available
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 flex items-center gap-2">
                <MatchStatusBadge match={match} nowMs={nowMs} liveCount={liveCount} />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(match.id);
                  }}
                  className={`p-1.5 rounded-full border transition-colors ${
                    bookmarked
                      ? "bg-[#FF9F0A]/20 border-[#FF9F0A]/40 text-[#FF9F0A]"
                      : "bg-white/[0.05] border-white/10 text-white/40 hover:text-white hover:bg-white/10"
                  }`}
                  title={bookmarked ? "Remove from Watchlist" : "Add to Watchlist"}
                >
                  <Star size={13} className={bookmarked ? "fill-[#FF9F0A]" : ""} />
                </button>
              </div>
            </div>

            {/* Teams Face-Off */}
            <div className="flex items-center justify-between gap-3 my-2">
              {/* Team 1 */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.06] p-2 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/25 transition-colors shadow-sm overflow-hidden">
                  {match.team1Logo?.trim() ? (
                    <img
                      src={match.team1Logo.trim()}
                      alt={match.team1}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {match.team1 ? match.team1.slice(0, 3).toUpperCase() : "T1"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-white/80 transition-colors truncate">
                    {match.team1}
                  </h4>
                  <span className="text-[10px] text-white/40 font-medium tracking-normal">Home</span>
                </div>
              </div>

              {/* VS Divider */}
              <div className="px-2 shrink-0 flex flex-col items-center">
                <span className="text-[10px] font-bold text-white/70 font-mono px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/15">
                  VS
                </span>
              </div>

              {/* Team 2 */}
              <div className="flex items-center gap-3 flex-1 min-w-0 flex-row-reverse text-right">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.06] p-2 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/25 transition-colors shadow-sm overflow-hidden">
                  {match.team2Logo?.trim() ? (
                    <img
                      src={match.team2Logo.trim()}
                      alt={match.team2}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {match.team2 ? match.team2.slice(0, 3).toUpperCase() : "T2"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-white/80 transition-colors truncate">
                    {match.team2}
                  </h4>
                  <span className="text-[10px] text-white/40 font-medium tracking-normal">Away</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar - Apple TV Style White Pill Watch Live Button */}
            <div className="pt-3.5 mt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
                <Radio size={12} className={dynamicStatus.isLive ? "text-[#FF453A]" : "text-white/30"} />
                <span>{dynamicStatus.isLive ? "Live Broadcast" : "Scheduled Stream"}</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                    (navigator as any).vibrate(15);
                  }
                  showSponsoredAd();
                  onSelect(match);
                }}
                className="px-5 py-2.5 rounded-full apple-btn-primary text-black font-semibold text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer touch-manipulation min-h-[40px]"
              >
                <Play size={13} className="fill-black text-black" />
                <span>Watch Live</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
});
