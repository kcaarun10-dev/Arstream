import React, { useState } from "react";
import { Match, MatchChannel, StreamServer } from "../types";
import { 
  Trophy, 
  MapPin, 
  Clock, 
  Calendar, 
  Shield, 
  Users, 
  Activity, 
  Flame, 
  Zap, 
  Sparkles, 
  RefreshCw, 
  Tv, 
  CloudSun, 
  Compass, 
  Award,
  ChevronRight,
  TrendingUp,
  Radio,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getEnrichedMatchDetails } from "../utils/matchDetailsGenerator";

interface MatchIntelligenceHubProps {
  match: Match;
  activeServer?: StreamServer | null;
  onSelectChannel?: (channel: MatchChannel) => void;
  isAdmin?: boolean;
  onRefreshLiveDetails?: () => void;
  isRefreshing?: boolean;
}

export const MatchIntelligenceHub: React.FC<MatchIntelligenceHubProps> = ({
  match,
  activeServer,
  onSelectChannel,
  isAdmin = false,
  onRefreshLiveDetails,
  isRefreshing = false
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "lineups" | "stats" | "h2h" | "channels">("overview");
  const [selectedSquadTeam, setSelectedSquadTeam] = useState<"home" | "away">("home");

  const details = getEnrichedMatchDetails(match);
  const { score, venue, referee, round, lineups, events, stats, h2h, weather, isLive, matchElapsedMinutes } = details;

  const team1Name = match.team1 || "Home Team";
  const team2Name = match.team2 || "Away Team";
  const leagueName = match.league || match.tournament || match.eventName || match.category?.toUpperCase() || "Live Championship";
  const leagueLogo = match.leagueLogo || match.tournamentLogo;

  return (
    <div className="w-full liquid-glass rounded-3xl border border-white/10 overflow-hidden shadow-2xl space-y-0">
      {/* Top Header & Live Match Scoreboard Banner */}
      <div className="relative p-5 sm:p-7 bg-gradient-to-b from-[#0e1424]/90 to-[#080c16]/95 border-b border-white/10 overflow-hidden">
        {/* Subtle glowing ambient accents */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* League & Live Status Row */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#090d16] border border-white/15 p-1 flex items-center justify-center shrink-0 shadow-md">
              {leagueLogo?.trim() ? (
                <img 
                  src={leagueLogo.trim()} 
                  alt={leagueName} 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} 
                />
              ) : (
                <Trophy size={16} className="text-cyan-400" />
              )}
            </div>
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-cyan-300 tracking-wide uppercase flex items-center gap-1.5">
                <span>{leagueName}</span>
                {round && <span className="text-[10px] text-white/50 lowercase font-normal">({round})</span>}
              </span>
              <div className="text-[10px] text-white/40 flex items-center gap-2">
                <span className="capitalize">{match.category || "Sport"}</span>
                <span>•</span>
                <span>{venue.name}, {venue.city}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshLiveDetails && (
              <button
                type="button"
                onClick={onRefreshLiveDetails}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm"
                title="Fetch updated real-time score & timeline"
              >
                <RefreshCw size={13} className={isRefreshing ? "animate-spin text-cyan-400" : ""} />
                <span className="hidden sm:inline">{isRefreshing ? "Fetching..." : "Fetch Update"}</span>
              </button>
            )}

            {isLive ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/20 border border-red-500/50 text-red-300 text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.35)] animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>LIVE {matchElapsedMinutes > 0 ? `• ${matchElapsedMinutes}'` : ""}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-bold">
                <Clock size={13} className="text-cyan-400" />
                <span>{match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Upcoming"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Match Face-Off Presentation (No unwanted scoreboard) */}
        <div className="grid grid-cols-12 items-center gap-3 py-2 bg-black/40 rounded-2xl p-4 sm:p-6 border border-white/5 shadow-inner">
          {/* Home Team */}
          <div className="col-span-4 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 text-center sm:text-left">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#111624] p-2 flex items-center justify-center shrink-0 border-2 border-white/10 shadow-xl overflow-hidden group-hover:border-cyan-400/50 transition-colors">
              {match.team1Logo?.trim() ? (
                <img 
                  src={match.team1Logo.trim()} 
                  alt={team1Name} 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} 
                />
              ) : (
                <span className="text-xs font-black text-cyan-300">{team1Name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black text-white truncate">{team1Name}</h3>
              <p className="text-[10px] sm:text-xs text-white/50 font-medium">Home Squad</p>
            </div>
          </div>

          {/* Central Face-Off & Kickoff Status */}
          <div className="col-span-4 flex flex-col items-center justify-center text-center">
            <div className="px-5 py-2 rounded-2xl bg-black/70 border border-white/10 shadow-inner flex items-center justify-center">
              <span className="text-lg sm:text-xl font-black font-mono tracking-widest text-cyan-300">
                VS
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-white/50 uppercase tracking-widest">
              <span>{isLive ? "Live Broadcast" : (match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Upcoming")}</span>
            </div>
          </div>

          {/* Away Team */}
          <div className="col-span-4 flex flex-col-reverse sm:flex-row items-center sm:items-center justify-end gap-2 sm:gap-4 text-center sm:text-right">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black text-white truncate">{team2Name}</h3>
              <p className="text-[10px] sm:text-xs text-white/50 font-medium">Away Squad</p>
            </div>
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#111624] p-2 flex items-center justify-center shrink-0 border-2 border-white/10 shadow-xl overflow-hidden group-hover:border-cyan-400/50 transition-colors">
              {match.team2Logo?.trim() ? (
                <img 
                  src={match.team2Logo.trim()} 
                  alt={team2Name} 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} 
                />
              ) : (
                <span className="text-xs font-black text-cyan-300">{team2Name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Venue & Referee Footnote */}
        <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between text-[11px] text-white/60 gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-white/70">
              <MapPin size={13} className="text-cyan-400 shrink-0" />
              <span>{venue.name} ({venue.capacity} capacity)</span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-white/70">
              <Shield size={13} className="text-purple-400 shrink-0" />
              <span>Referee: {referee}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
            <CloudSun size={13} />
            <span>{weather.temp} • {weather.condition}</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-3 pb-2 bg-[#090d18] border-b border-white/10 overflow-x-auto scrollbar-hide">
        {[
          { id: "overview", label: "Overview & Story", icon: Trophy },
          { id: "timeline", label: `Timeline (${events.length})`, icon: Activity },
          { id: "lineups", label: "Lineups & Tactics", icon: Users },
          { id: "stats", label: "Live Stats", icon: TrendingUp },
          { id: "h2h", label: "Head-to-Head", icon: Flame },
          { id: "channels", label: `Streams (${match.channels?.length || 0})`, icon: Tv },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={14} className={isActive ? "text-cyan-400" : "text-white/40"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="p-5 sm:p-7 bg-[#070b14]/95 min-h-[300px]">
        {/* TAB 1: OVERVIEW & STORY */}
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Match Story & AI Narrative */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
                <Sparkles size={15} />
                <span>Match Narrative & Intelligence</span>
              </div>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-medium">
                {match.description || `${team1Name} goes head-to-head with ${team2Name} in an electric ${leagueName} fixture broadcast in high-definition 4K. Both squads bring their starting line-ups to battle at ${venue.name}.`}
              </p>
            </div>

            {/* Quick Intelligence Grid: Venue, Weather, Referee, Broadcast */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={12} className="text-cyan-400" /> Venue & Pitch
                </div>
                <div className="text-xs font-extrabold text-white">{venue.name}</div>
                <div className="text-[10px] text-white/50">{venue.city}, {venue.country} • {venue.surface}</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <CloudSun size={12} className="text-amber-400" /> Climate & Weather
                </div>
                <div className="text-xs font-extrabold text-white">{weather.temp} • {weather.condition}</div>
                <div className="text-[10px] text-white/50">Humidity: {weather.humidity} • Wind: {weather.wind}</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <Shield size={12} className="text-purple-400" /> Match Officials
                </div>
                <div className="text-xs font-extrabold text-white">{referee}</div>
                <div className="text-[10px] text-white/50">VAR & Assistant Crews Active</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <Tv size={12} className="text-emerald-400" /> Streaming Channels
                </div>
                <div className="text-xs font-extrabold text-emerald-300">
                  {match.channels?.length || 0} Ultra-HD Servers
                </div>
                <div className="text-[10px] text-white/50">1080p 60FPS • Zero-Lag Edge</div>
              </div>
            </div>

            {/* Tags / Keywords */}
            {match.keywords && match.keywords.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Match Topics & Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {match.keywords.map((tag, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-cyan-200 font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: TIMELINE & EVENTS */}
        {activeTab === "timeline" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Activity size={14} className="text-cyan-400" /> Real-Time Match Events
              </h4>
              <span className="text-[10px] text-white/40 font-mono font-semibold">
                {isLive ? "Live Matchfeed" : "Match History"}
              </span>
            </div>

            {events.length > 0 ? (
              <div className="space-y-3 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-white/10 pl-2">
                {events.map((evt, idx) => {
                  const isHome = evt.team === "home";
                  const isSystem = evt.team === "system";

                  let iconBg = "bg-cyan-500/20 text-cyan-300 border-cyan-400/40";
                  let eventLabel = "Match Event";

                  if (evt.type === "goal") {
                    iconBg = "bg-emerald-500/20 text-emerald-300 border-emerald-400/50";
                    eventLabel = "GOAL!";
                  } else if (evt.type === "card_yellow") {
                    iconBg = "bg-amber-500/20 text-amber-300 border-amber-400/50";
                    eventLabel = "Yellow Card";
                  } else if (evt.type === "card_red") {
                    iconBg = "bg-red-500/20 text-red-300 border-red-400/50";
                    eventLabel = "Red Card";
                  } else if (evt.type === "sub") {
                    iconBg = "bg-blue-500/20 text-blue-300 border-blue-400/50";
                    eventLabel = "Substitution";
                  }

                  return (
                    <div key={idx} className="relative flex items-start gap-4 group">
                      {/* Minute badge */}
                      <div className="w-8 h-8 rounded-full bg-[#0d1220] border border-cyan-400/40 text-cyan-300 text-[10px] font-black font-mono flex items-center justify-center shrink-0 z-10 shadow-md">
                        {evt.minute}
                      </div>

                      {/* Event content box */}
                      <div className="flex-1 p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-cyan-400/30 transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase ${iconBg}`}>
                            {eventLabel}
                          </span>
                          {!isSystem && (
                            <span className="text-[10px] text-white/40 font-bold">
                              {isHome ? team1Name : team2Name}
                            </span>
                          )}
                        </div>
                        {evt.player && (
                          <div className="text-xs sm:text-sm font-extrabold text-white mt-1">
                            {evt.player}
                          </div>
                        )}
                        {evt.detail && (
                          <p className="text-[11px] text-white/60 mt-0.5">{evt.detail}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-white/40 text-xs">
                Timeline events will populate once the fixture kicks off.
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: LINEUPS & TACTICAL FORMATION */}
        {activeTab === "lineups" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Squad Switcher Toggle */}
            <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-black/60 border border-white/10 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setSelectedSquadTeam("home")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  selectedSquadTeam === "home"
                    ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <span>{team1Name}</span>
                <span className="text-[10px] opacity-75 font-mono">({lineups.home?.formation || "4-3-3"})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSquadTeam("away")}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  selectedSquadTeam === "away"
                    ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <span>{team2Name}</span>
                <span className="text-[10px] opacity-75 font-mono">({lineups.away?.formation || "4-3-3"})</span>
              </button>
            </div>

            {/* Active Squad Roster */}
            {(() => {
              const activeSquad = selectedSquadTeam === "home" ? lineups.home : lineups.away;
              const activeTeamTitle = selectedSquadTeam === "home" ? team1Name : team2Name;

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Starting XI */}
                  <div className="lg:col-span-8 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Users size={14} className="text-cyan-400" />
                        <span>Starting XI ({activeSquad?.startingXI.length || 0})</span>
                      </div>
                      <span className="text-[11px] text-cyan-300 font-mono font-bold">
                        Coach: {activeSquad?.coach || "Head Coach"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {activeSquad?.startingXI.map((player, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-cyan-400/40 transition-all flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-cyan-300 text-[11px] font-black font-mono flex items-center justify-center shrink-0">
                              {player.number || idx + 1}
                            </div>
                            <span className="text-xs font-bold text-white truncate">
                              {player.name}
                            </span>
                          </div>
                          {player.position && (
                            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-[9px] font-mono font-black shrink-0">
                              {player.position}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Substitutes Bench */}
                  <div className="lg:col-span-4 space-y-3">
                    <div className="text-xs font-black text-white uppercase tracking-wider pb-2 border-b border-white/5 flex items-center gap-2">
                      <Shield size={14} className="text-purple-400" />
                      <span>Substitutes ({activeSquad?.substitutes?.length || 0})</span>
                    </div>

                    <div className="space-y-2">
                      {activeSquad?.substitutes?.map((sub, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded bg-white/5 text-[10px] font-mono font-bold text-white/50 flex items-center justify-center shrink-0">
                              {sub.number || 12 + idx}
                            </span>
                            <span className="text-white/80 truncate font-medium">{sub.name}</span>
                          </div>
                          <span className="text-[9px] text-white/40 font-mono">BENCH</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* TAB 4: STATS */}
        {activeTab === "stats" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Possession Comparative Bar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-cyan-300">{team1Name} ({stats.possession?.home || 50}%)</span>
                <span className="text-white/50 uppercase tracking-widest text-[10px]">Ball Possession</span>
                <span className="text-purple-300">{team2Name} ({stats.possession?.away || 50}%)</span>
              </div>
              <div className="w-full h-3 bg-purple-500/40 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-cyan-400 rounded-l-full transition-all duration-500 shadow-[0_0_12px_rgba(0,242,254,0.5)]" 
                  style={{ width: `${stats.possession?.home || 50}%` }}
                />
              </div>
            </div>

            {/* Stat Row Comparison Matrix */}
            <div className="space-y-2.5">
              {[
                { label: "Total Shots", home: stats.shots?.home || 12, away: stats.shots?.away || 8 },
                { label: "Shots on Target", home: stats.shotsOnTarget?.home || 5, away: stats.shotsOnTarget?.away || 3 },
                { label: "Corner Kicks", home: stats.corners?.home || 6, away: stats.corners?.away || 4 },
                { label: "Total Passes", home: stats.passes?.home || 450, away: stats.passes?.away || 390 },
                { label: "Pass Accuracy", home: `${stats.passAccuracy?.home || 86}%`, away: `${stats.passAccuracy?.away || 81}%` },
                { label: "Fouls Committed", home: stats.fouls?.home || 9, away: stats.fouls?.away || 11 },
                { label: "Yellow Cards", home: stats.yellowCards?.home || 1, away: stats.yellowCards?.away || 2 },
              ].map((row, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                  <span className="font-mono font-black text-cyan-300 w-12 text-left">{row.home}</span>
                  <span className="text-white/70 font-semibold text-center flex-1">{row.label}</span>
                  <span className="font-mono font-black text-purple-300 w-12 text-right">{row.away}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 5: HEAD-TO-HEAD */}
        {activeTab === "h2h" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="text-xs font-black text-white uppercase tracking-wider pb-2 border-b border-white/5 flex items-center gap-2">
              <Flame size={14} className="text-amber-400" />
              <span>Previous Encounters & Head-to-Head History</span>
            </div>

            <div className="space-y-2.5">
              {h2h.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-cyan-400/30 transition-all flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                    <Calendar size={11} />
                    <span>{item.date}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs sm:text-sm font-extrabold text-white">
                    <span className={item.winner === item.homeTeam ? "text-cyan-300" : "text-white/70"}>
                      {item.homeTeam}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs text-white">
                      {item.score}
                    </span>
                    <span className={item.winner === item.awayTeam ? "text-cyan-300" : "text-white/70"}>
                      {item.awayTeam}
                    </span>
                  </div>

                  <div className="text-[10px] font-bold text-amber-300/80 uppercase">
                    {item.tournament || "League"}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 6: BROADCAST CHANNELS & SERVERS */}
        {activeTab === "channels" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Tv size={14} className="text-cyan-400" />
                <span>Configured Live Streams & Broadcast Servers</span>
              </h4>
              <span className="text-[10px] text-emerald-400 font-mono">
                {match.channels?.length || 0} active nodes
              </span>
            </div>

            {match.channels && match.channels.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {match.channels.map((chan, idx) => {
                  const isCurrentActive = activeServer?.url === chan.url;
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        isCurrentActive
                          ? "bg-cyan-500/10 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.2)]"
                          : "bg-black/40 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{chan.name || `Server ${idx + 1}`}</span>
                          </div>
                          <div className="text-[10px] text-white/50 mt-0.5">
                            {chan.serverLocation || "Global Edge CDN"} • {chan.protocol || "HLS 1080p"}
                          </div>
                        </div>

                        {isCurrentActive && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[9px] font-mono font-bold">
                            CURRENT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                        <span className="text-white/40 font-mono truncate max-w-[150px]">
                          {chan.url.startsWith("http") ? chan.url.replace(/^https?:\/\//, "").slice(0, 24) + "..." : "Custom stream"}
                        </span>
                        {onSelectChannel && (
                          <button
                            type="button"
                            onClick={() => onSelectChannel(chan)}
                            className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase transition-all"
                          >
                            Switch To Node
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-white/40 text-xs">
                No custom broadcast channels attached to this match yet.
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
