import React from "react";
import { Trophy, Globe, Flame, Zap, Shield, Activity, Disc } from "lucide-react";

interface LeagueBarProps {
  activeLeague: string;
  onSelectLeague: (leagueName: string) => void;
}

const FEATURED_LEAGUES = [
  { id: "all", name: "All Leagues", short: "All", icon: Globe },
  { id: "champions league", name: "Champions League", short: "UCL", icon: Trophy },
  { id: "premier league", name: "Premier League", short: "EPL", icon: Trophy },
  { id: "la liga", name: "La Liga", short: "La Liga", icon: Trophy },
  { id: "formula 1", name: "Formula 1", short: "F1", icon: Zap },
  { id: "nba", name: "NBA", short: "NBA", icon: Activity },
  { id: "ufc", name: "UFC / MMA", short: "UFC", icon: Shield },
  { id: "ipl", name: "IPL Cricket", short: "IPL", icon: Flame },
  { id: "tennis", name: "Grand Slam", short: "Tennis", icon: Disc },
];

export function LeagueBar({ activeLeague, onSelectLeague }: LeagueBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1.5 px-1 touch-pan-x select-none">
      {FEATURED_LEAGUES.map((league) => {
        const Icon = league.icon;
        const isActive = activeLeague.toLowerCase() === league.id.toLowerCase() || (league.id === "all" && !activeLeague);

        return (
          <button
            key={league.id}
            onClick={() => {
              if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                (navigator as any).vibrate(12);
              }
              onSelectLeague(league.id === "all" ? "" : league.id);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border min-h-[38px] touch-manipulation active:scale-95 transition-all ${
              isActive
                ? "bg-white/[0.16] border-cyan-400/40 text-cyan-300 shadow-[0_0_12px_rgba(0,242,254,0.18)]"
                : "bg-white/[0.03] border-white/[0.07] text-white/50 hover:text-white/90 hover:bg-white/[0.07] hover:border-white/20"
            }`}
          >
            <Icon size={13} className={isActive ? "text-white" : "text-white/40"} />
            <span>{league.name}</span>
          </button>
        );
      })}
    </div>
  );
}
