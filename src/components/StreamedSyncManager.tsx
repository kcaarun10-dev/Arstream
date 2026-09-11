import React, { useState, useEffect, useMemo } from "react";
import { 
  Radio, 
  RefreshCw, 
  Sparkles, 
  Play, 
  Tv, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Filter, 
  Zap, 
  Eye, 
  X,
  Search,
  Check,
  Flame,
  Star,
  Layers,
  ArrowRight,
  ShieldCheck,
  Server,
  Activity,
  Globe
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Match, Channel, APIMatch, Stream, Sport } from "../types";
import { 
  fetchSports, 
  fetchMatches, 
  fetchAllStreamsForMatch, 
  fetchStreamsForSource,
  convertAPIMatchToMatch, 
  getTeamBadgeUrl, 
  getMatchPosterUrl 
} from "../utils/streamedApi";
import { EmbeddedLiveStreamPlayer } from "./EmbeddedLiveStreamPlayer";

interface StreamedSyncManagerProps {
  currentMatches: Match[];
  onRefreshData?: () => void;
  onEditMatch?: (match: Partial<Match>) => void;
}

export const StreamedSyncManager: React.FC<StreamedSyncManagerProps> = ({
  currentMatches,
  onRefreshData,
  onEditMatch,
}) => {
  // Filters & State
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [scope, setScope] = useState<"live" | "all-today" | "all">("live");
  const [popularOnly, setPopularOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data State
  const [matches, setMatches] = useState<APIMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stream Discovery State
  const [testingMatchId, setTestingMatchId] = useState<string | null>(null);
  const [streamsMap, setStreamsMap] = useState<Record<string, Stream[]>>({});
  
  // Preview Modal
  const [previewStream, setPreviewStream] = useState<Stream | null>(null);
  const [previewMatchTitle, setPreviewMatchTitle] = useState<string>("");

  // Import Status
  const [importingId, setImportingId] = useState<string | null>(null);
  const [bulkImporting, setBulkImporting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Set of IDs already in Firestore
  const existingTitles = useMemo(() => {
    return new Set(
      currentMatches.map((m) =>
        `${m.team1.toLowerCase().trim()} vs ${m.team2.toLowerCase().trim()}`
      )
    );
  }, [currentMatches]);

  const existingStreamedIds = useMemo(() => {
    return new Set(
      currentMatches
        .filter((m) => m.streamedId || m.id.startsWith("streamed-"))
        .map((m) => m.streamedId || m.id.replace(/^streamed-/, ""))
    );
  }, [currentMatches]);

  // Load sports list on mount
  useEffect(() => {
    fetchSports()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSports(data);
        }
      })
      .catch((err) => console.warn("Failed to fetch sports:", err));
  }, []);

  // Fetch matches whenever scope, sport, or popular filter changes
  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatches({
        scope: scope,
        sport: selectedSport !== "all" ? selectedSport : undefined,
        popular: popularOnly,
      });
      setMatches(data);
    } catch (err: any) {
      setError(err.message || "Failed to load matches from Streamed API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, [scope, selectedSport, popularOnly]);

  // Filter matches by local search
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase().trim();
    return matches.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.teams?.home?.name && m.teams.home.name.toLowerCase().includes(q)) ||
        (m.teams?.away?.name && m.teams.away.name.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
    );
  }, [matches, searchQuery]);

  // Check streams for a specific match
  const handleCheckStreams = async (match: APIMatch) => {
    if (!match.sources || match.sources.length === 0) {
      setNotification({ type: "error", text: "No stream sources defined for this match." });
      return;
    }
    setTestingMatchId(match.id);
    try {
      const streams = await fetchAllStreamsForMatch(match.sources);
      setStreamsMap((prev) => ({ ...prev, [match.id]: streams }));
      if (streams.length === 0) {
        setNotification({
          type: "error",
          text: `Checked ${match.sources.length} sources (${match.sources.map(s => s.source).join(", ")}), but streams have not started yet.`,
        });
      } else {
        setNotification({
          type: "success",
          text: `Found ${streams.length} live stream source(s) with high definition embeds!`,
        });
      }
    } catch (e: any) {
      setNotification({ type: "error", text: "Failed to probe streams: " + e.message });
    } finally {
      setTestingMatchId(null);
    }
  };

  // Import single match to Firestore
  const handleImportMatch = async (apiMatch: APIMatch) => {
    setImportingId(apiMatch.id);
    try {
      // 1. Fetch current live streams if not cached yet
      let streams = streamsMap[apiMatch.id];
      if (!streams && apiMatch.sources && apiMatch.sources.length > 0) {
        streams = await fetchAllStreamsForMatch(apiMatch.sources);
        setStreamsMap((prev) => ({ ...prev, [apiMatch.id]: streams }));
      }

      // 2. Convert to app Match structure
      const matchData = convertAPIMatchToMatch(apiMatch, streams || []);

      // 3. Save to Firestore
      const docRef = await addDoc(collection(db, "matches"), {
        ...matchData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNotification({
        type: "success",
        text: `Successfully imported "${matchData.team1} vs ${matchData.team2}" to Live Broadcasts!`,
      });

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setNotification({ type: "error", text: "Import error: " + err.message });
    } finally {
      setImportingId(null);
    }
  };

  // Bulk import all live matches
  const handleBulkImportLive = async () => {
    const liveMatches = matches.filter((m) => {
      const isImported = existingStreamedIds.has(m.id) || existingTitles.has(`${m.teams?.home?.name?.toLowerCase().trim()} vs ${m.teams?.away?.name?.toLowerCase().trim()}`);
      return !isImported;
    });

    if (liveMatches.length === 0) {
      alert("All current matches in this view are already imported!");
      return;
    }

    if (!confirm(`Import ${liveMatches.length} matches into Firestore?`)) {
      return;
    }

    setBulkImporting(true);
    let successCount = 0;

    for (const m of liveMatches) {
      try {
        const streams = streamsMap[m.id] || [];
        const matchData = convertAPIMatchToMatch(m, streams);
        await addDoc(collection(db, "matches"), {
          ...matchData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        successCount++;
      } catch (err) {
        console.warn("Bulk import failed for match:", m.title, err);
      }
    }

    setBulkImporting(false);
    setNotification({
      type: "success",
      text: `Successfully imported ${successCount} matches to Live Broadcasts!`,
    });

    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Top Banner & Title */}
      <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#0c1324] via-[#091a24] to-[#0a1820] border border-cyan-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] shrink-0">
            <Radio size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-wide uppercase text-white">
                Streamed.pk Live Broadcast Engine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                API Connected
              </span>
            </div>
            <p className="text-xs text-white/60 mt-0.5">
              Live Sports, Matches & Source Stream Endpoints (Alpha, Bravo, Charlie, Echo, Foxtrot, Golf, Intel, etc.)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={loadMatches}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-cyan-400" : ""} />
            <span>Refresh Feed</span>
          </button>

          <button
            onClick={handleBulkImportLive}
            disabled={bulkImporting || matches.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={15} className={bulkImporting ? "animate-spin" : ""} />
            <span>{bulkImporting ? "Importing All..." : "Bulk Import All Viewable"}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs font-bold animate-fade-in ${
            notification.type === "success"
              ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
              : "bg-rose-500/20 border border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#090d16] border border-white/10 flex flex-wrap items-center justify-between gap-3">
        {/* Scope Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
          <button
            onClick={() => setScope("live")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              scope === "live"
                ? "bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Live Broadcasts</span>
          </button>
          <button
            onClick={() => setScope("all-today")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              scope === "all-today"
                ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Clock size={13} />
            <span>Today's Matches</span>
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              scope === "all"
                ? "bg-white/20 text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Layers size={13} />
            <span>All Matches</span>
          </button>
        </div>

        {/* Sport Category Selector & Popular Checkbox */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sports Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-bold hidden sm:inline">Sport:</span>
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="all">All Sports</option>
              {sports.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Popular Toggle */}
          <button
            onClick={() => setPopularOnly(!popularOnly)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              popularOnly
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white"
            }`}
          >
            <Star size={13} className={popularOnly ? "fill-amber-400 text-amber-400" : ""} />
            <span>Popular Only</span>
          </button>

          {/* Search Box */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search match or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-400 w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-cyan-400 mx-auto" />
          <p className="text-xs font-bold text-white/60 uppercase tracking-wider">
            Fetching Streamed.pk Matches & Stream Sources...
          </p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="py-16 text-center p-8 rounded-2xl bg-[#090d16] border border-white/10 space-y-3">
          <AlertCircle size={32} className="text-white/30 mx-auto" />
          <p className="text-sm font-bold text-white/80">No matches found matching this filter</p>
          <p className="text-xs text-white/50 max-w-sm mx-auto">
            Try switching between "Live Broadcasts", "Today's Matches", or selecting "All Sports".
          </p>
          <button
            onClick={() => {
              setScope("all-today");
              setSelectedSport("all");
              setPopularOnly(false);
              setSearchQuery("");
            }}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/30 transition-all cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMatches.map((m) => {
            const homeName = m.teams?.home?.name || m.title.split(" vs ")[0] || "Home Team";
            const awayName = m.teams?.away?.name || m.title.split(" vs ")[1] || "Away Team";
            const homeBadge = getTeamBadgeUrl(m.teams?.home?.badge);
            const awayBadge = getTeamBadgeUrl(m.teams?.away?.badge);
            const matchDate = new Date(m.date);
            const isLive = Math.abs(Date.now() - m.date) < 2 * 60 * 60 * 1000;
            const streams = streamsMap[m.id];
            const isImported =
              existingStreamedIds.has(m.id) ||
              existingTitles.has(`${homeName.toLowerCase().trim()} vs ${awayName.toLowerCase().trim()}`);

            return (
              <div
                key={m.id}
                className="rounded-2xl bg-[#090d16] border border-white/10 hover:border-white/20 p-4 flex flex-col justify-between gap-3.5 transition-all shadow-lg group relative overflow-hidden"
              >
                {/* Top Row: Category, Time, Popular Tag */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-black uppercase tracking-wider">
                      {m.category || "sport"}
                    </span>
                    {m.popular && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                        <Star size={10} className="fill-amber-400" />
                        <span>POPULAR</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-white/60 font-mono text-[11px]">
                    <Clock size={12} className={isLive ? "text-rose-400 animate-spin" : ""} />
                    <span className={isLive ? "text-rose-400 font-black" : ""}>
                      {isLive ? "LIVE NOW" : matchDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Match Title & Teams */}
                <div className="space-y-2 py-1">
                  <div className="flex items-center justify-between gap-3">
                    {/* Home Team */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0">
                        <img
                          src={homeBadge}
                          alt={homeName}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-white truncate">
                        {homeName}
                      </span>
                    </div>

                    <span className="text-[11px] font-black text-white/30 uppercase shrink-0">VS</span>

                    {/* Away Team */}
                    <div className="flex items-center justify-end gap-2.5 flex-1 min-w-0">
                      <span className="text-xs sm:text-sm font-black text-white truncate text-right">
                        {awayName}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0">
                        <img
                          src={awayBadge}
                          alt={awayName}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-white/50 truncate text-center">
                    {m.title}
                  </p>
                </div>

                {/* Available Stream Sources */}
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-white/50 font-bold uppercase tracking-wider">
                    <span>Stream Sources:</span>
                    <span className="text-cyan-400 font-mono">{m.sources?.length || 0} Endpoints</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {m.sources && m.sources.length > 0 ? (
                      m.sources.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-mono text-[10px] uppercase font-bold border border-white/10 hover:border-cyan-400/50 transition-colors"
                          title={`Source ID: ${s.id}`}
                        >
                          {s.source}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-white/40 italic">No sources listed</span>
                    )}
                  </div>

                  {/* Discovered Streams Summary if tested */}
                  {streams && streams.length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-1">
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check size={11} className="stroke-[3]" />
                        <span>{streams.length} Live Mirrors Ready</span>
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {streams.map((str, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => {
                              setPreviewStream(str);
                              setPreviewMatchTitle(m.title);
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1 border border-emerald-500/30 transition-all cursor-pointer"
                          >
                            <Play size={8} className="fill-emerald-400" />
                            <span>#{str.streamNo} {str.language.split(" ")[0]} ({str.hd ? "HD" : "SD"})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  {/* Test Streams Button */}
                  <button
                    onClick={() => handleCheckStreams(m)}
                    disabled={testingMatchId === m.id}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Activity size={13} className={testingMatchId === m.id ? "animate-spin text-cyan-400" : "text-cyan-400"} />
                    <span>{testingMatchId === m.id ? "Probing..." : "Test Streams"}</span>
                  </button>

                  {/* Import to Firestore Button */}
                  {isImported ? (
                    <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5 shrink-0">
                      <CheckCircle2 size={13} />
                      <span>Imported</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleImportMatch(m)}
                      disabled={importingId === m.id}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-[11px] font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles size={13} className={importingId === m.id ? "animate-spin" : ""} />
                      <span>{importingId === m.id ? "Importing..." : "Import to Guide"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stream Video Preview Modal */}
      {previewStream && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setPreviewStream(null)}
        >
          <div
            className="w-full max-w-4xl bg-[#090d16] border border-white/15 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Play size={14} className="fill-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-white">
                      Live Stream Preview: {previewStream.source.toUpperCase()} #{previewStream.streamNo}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold font-mono">
                      {previewStream.hd ? "1080P HD" : "SD"}
                    </span>
                  </div>
                  <span className="text-[11px] text-white/50 truncate block">
                    {previewMatchTitle} • {previewStream.language}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(previewStream.embedUrl, "_blank")}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
                  title="Open embed in new window"
                >
                  <ExternalLink size={15} />
                </button>
                <button
                  onClick={() => setPreviewStream(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Video Player Box */}
            <div className="aspect-video w-full bg-black relative flex items-center justify-center overflow-hidden">
              <EmbeddedLiveStreamPlayer
                url={previewStream.embedUrl}
                title={`${previewMatchTitle} - Stream ${previewStream.streamNo}`}
                className="w-full h-full"
              />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-black/60 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Globe size={13} className="text-cyan-400" />
                <span>Source: {previewStream.source}</span>
                <span>•</span>
                <span>Language: {previewStream.language}</span>
              </div>
              <button
                onClick={() => setPreviewStream(null)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StreamedSyncManager;
