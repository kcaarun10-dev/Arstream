import React, { useMemo, useState, useEffect } from "react";
import { parseM3U } from "../utils/m3uParser";
import { M3U_DATA } from "../data/playlist";
import { Channel, Match } from "../types";
import { 
  Tv, 
  Sparkles, 
  Radio, 
  Search, 
  Star, 
  Play, 
  Globe, 
  Film, 
  Zap, 
  Layers,
  X
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { showSponsoredAd } from "../utils/adManager";

interface IPTVListProps {
  onSelect: (match: Match) => void;
  search: string;
}

const STORAGE_KEY = "ar_iptv_firestore_cache";
const FAVORITES_KEY = "ar_iptv_favorite_channels";

export const IPTVList = React.memo(function IPTVList({ onSelect, search: externalSearch }: IPTVListProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [localSearch, setLocalSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (channelName: string) => {
    setFavorites((prev) => {
      const next = prev.includes(channelName)
        ? prev.filter((n) => n !== channelName)
        : [...prev, channelName];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // no-op
      }
      return next;
    });
  };

  // Real-time Firestore channels with optimistic local cache
  const [firestoreChannels, setFirestoreChannels] = useState<Channel[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const q = query(collection(db, "channels"), orderBy("name", "asc"));
      unsub = onSnapshot(q, {
        next: (snapshot) => {
          const list = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as Channel[];
          setFirestoreChannels(list);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          } catch {
            // Ignore cache errors
          }
        },
        error: (error) => {
          console.warn("IPTV channels snapshot listener:", error);
        }
      });
    } catch (e) {
      console.warn("IPTV channels query setup error:", e);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const defaultChannels = useMemo(() => parseM3U(M3U_DATA), []);

  const channels = useMemo(() => {
    const customNames = new Set(firestoreChannels.map((c) => c.name.toLowerCase()));
    const remainingDefault = defaultChannels.filter((c) => !customNames.has(c.name.toLowerCase()));
    return [...firestoreChannels, ...remainingDefault];
  }, [firestoreChannels, defaultChannels]);

  const allGroups = useMemo(() => {
    const counts: Record<string, number> = {};
    channels.forEach((c) => {
      const g = c.group || "General";
      counts[g] = (counts[g] || 0) + 1;
    });
    const sortedGroups = Object.keys(counts).sort();
    return [{ name: "All Channels", id: "all", count: channels.length }, ...sortedGroups.map(g => ({ name: g, id: g, count: counts[g] }))];
  }, [channels]);

  const activeSearch = (externalSearch || localSearch).trim().toLowerCase();

  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (selectedGroup !== "all" && (c.group || "General") !== selectedGroup) {
        return false;
      }
      if (!activeSearch) return true;
      return (
        c.name.toLowerCase().includes(activeSearch) ||
        (c.group && c.group.toLowerCase().includes(activeSearch))
      );
    }).sort((a, b) => {
      const aFav = favorites.includes(a.name) ? 1 : 0;
      const bFav = favorites.includes(b.name) ? 1 : 0;
      return bFav - aFav;
    });
  }, [channels, activeSearch, selectedGroup, favorites]);

  const handleChannelSelect = (channel: Channel) => {
    showSponsoredAd();
    const routeId = channel.id || String(channels.findIndex((item) => item.url === channel.url && item.name === channel.name) + 1);
    const pseudoMatch: Match = {
      id: `iptv-${routeId}`,
      team1: channel.name,
      team1Logo: channel.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name)}&background=06b6d4&color=000`,
      team2: channel.group || "IPTV Live",
      team2Logo: channel.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.group || "TV")}&background=random&color=fff`,
      category: channel.group || "IPTV",
      startTime: new Date().toISOString(),
      status: "live",
      channels: [
        {
          name: `${channel.name} (Direct Stream)`,
          url: channel.url,
          userAgent: channel.userAgent,
          referrer: channel.referrer,
          serverLocation: "Global IPTV Node",
        },
      ],
      createdAt: { seconds: 0, nanoseconds: 0 },
      updatedAt: { seconds: 0, nanoseconds: 0 },
    };
    onSelect(pseudoMatch);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* IPTV Guide Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 rounded-3xl bg-[#0b0e17] border border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <Tv size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                Global IPTV Television Guide
              </h2>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                {filteredChannels.length} Channels
              </span>
            </div>
            <p className="text-xs text-white/50">
              Live broadcast satellite feeds, sports channels, and world television stations.
            </p>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search channels..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-white/35 focus:outline-none focus:border-cyan-400"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1">
        {allGroups.map((group) => {
          const isActive = selectedGroup === group.id;
          return (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-black border-white shadow-sm font-semibold"
                  : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
              }`}
            >
              <span>{group.name}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                isActive ? "bg-black/10 text-black font-semibold" : "bg-white/10 text-white/60"
              }`}>
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredChannels.map((channel, idx) => {
          const isFav = favorites.includes(channel.name);

          return (
            <div
              key={`${channel.id || channel.url || 'ch'}-${idx}`}
              className="group relative rounded-3xl p-4 apple-card hover:border-white/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/10 p-1 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-white/25">
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Tv size={18} className="text-white/70" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(channel.name);
                      }}
                      className={`p-1.5 rounded-full border transition-colors ${
                        isFav
                          ? "bg-[#FF9F0A]/20 border-[#FF9F0A]/40 text-[#FF9F0A]"
                          : "bg-white/[0.04] border-white/10 text-white/40 hover:text-white"
                      }`}
                      title={isFav ? "Remove Favorite" : "Save Favorite"}
                    >
                      <Star size={13} className={isFav ? "fill-[#FF9F0A]" : ""} />
                    </button>

                    <span className="px-2 py-0.5 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/30 text-[9px] font-mono font-semibold text-[#FF453A]">
                      LIVE
                    </span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-white group-hover:text-white/80 transition-colors line-clamp-1">
                  {channel.name}
                </h4>
                <p className="text-[11px] text-white/40 font-mono mt-0.5">
                  {channel.group || "General Television"}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-white/40 font-mono">
                  1080p • 60 FPS
                </span>

                <button
                  onClick={() => handleChannelSelect(channel)}
                  className="px-4 py-1.5 rounded-full apple-btn-primary text-black font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Play size={11} className="fill-black text-black" />
                  <span>Tune In</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredChannels.length === 0 && (
        <div className="text-center py-20 apple-card rounded-3xl">
          <Tv size={28} className="mx-auto text-white/30 mb-2" />
          <h3 className="text-sm font-bold text-white">No IPTV Channels Found</h3>
          <p className="text-xs text-white/40 mt-1">Try resetting the category filter or search query.</p>
        </div>
      )}
    </div>
  );
});
