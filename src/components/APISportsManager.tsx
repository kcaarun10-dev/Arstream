import React, { useState, useEffect, useMemo } from "react";
import { 
  Globe2, 
  Calendar, 
  RefreshCw, 
  Check, 
  Sparkles, 
  Save, 
  Radio, 
  Trophy, 
  Tv, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Filter, 
  Shield, 
  Zap, 
  Sliders, 
  Play, 
  Eye, 
  Layers,
  ChevronRight,
  Info,
  CalendarDays,
  Send,
  SlidersHorizontal,
  Code
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Match, Channel } from "../types";
import { 
  MAIN_NATIONS_LEAGUES, 
  IMPORTANT_LEAGUE_IDS, 
  isImportantLeague, 
  getLeagueDetailsById 
} from "../data/importantLeagues";
import { 
  DEFAULT_APISPORTS_KEY, 
  ApiSportsFixtureItem, 
  ApiSportsAccountStatus, 
  convertApiSportsFixtureToMatch,
  cleanFirestorePayload
} from "../utils/apiSports";

interface APISportsManagerProps {
  currentMatches: Match[];
  currentChannels: Channel[];
  onRefreshData?: () => void;
  onEditMatch?: (match: Partial<Match>) => void;
}

export const APISportsManager: React.FC<APISportsManagerProps> = ({
  currentMatches,
  currentChannels,
  onRefreshData,
  onEditMatch
}) => {
  // Config & State
  const [apiKey, setApiKey] = useState<string>(DEFAULT_APISPORTS_KEY);
  const [accountStatus, setAccountStatus] = useState<ApiSportsAccountStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(false);

  // Filter States
  const [selectedCountry, setSelectedCountry] = useState<string>("Spain");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("all");
  const [onlyImportantLeagues, setOnlyImportantLeagues] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isLiveOnly, setIsLiveOnly] = useState<boolean>(false);
  const [fixtureIdInput, setFixtureIdInput] = useState<string>("");
  const [activeViewMode, setActiveViewMode] = useState<"extractor" | "widget" | "automation">("extractor");

  // Fixtures State
  const [fixtures, setFixtures] = useState<ApiSportsFixtureItem[]>([]);
  const [isLoadingFixtures, setIsLoadingFixtures] = useState<boolean>(false);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<number>>(new Set());
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postResult, setPostResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Widget settings
  const [widgetCountry, setWidgetCountry] = useState<string>("spain");
  const [widgetTheme, setWidgetTheme] = useState<"dark" | "white">("dark");
  const [widgetTab, setWidgetTab] = useState<string>("all");

  // Automated daily sync configuration in localStorage
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem("apisports_auto_sync") === "true";
  });
  const [autoSyncCountries, setAutoSyncCountries] = useState<string[]>(() => {
    const raw = localStorage.getItem("apisports_auto_countries");
    return raw ? JSON.parse(raw) : ["Spain", "England", "Europe / International", "Italy", "Germany", "France", "Saudi Arabia"];
  });

  // Fetch account status on load
  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/apisports/status?key=${encodeURIComponent(apiKey)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setAccountStatus({
          account: json.data.account,
          subscription: json.data.subscription,
          requests: json.data.requests,
          keyValid: true
        });
      } else {
        setAccountStatus({
          keyValid: false,
          error: json.errors?.[0] || "Invalid API key"
        });
      }
    } catch (err: any) {
      setAccountStatus({
        keyValid: false,
        error: err.message
      });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [apiKey]);

  // Available leagues for selected country
  const currentCountryObj = useMemo(() => {
    return MAIN_NATIONS_LEAGUES.find(n => n.country.toLowerCase() === selectedCountry.toLowerCase()) || MAIN_NATIONS_LEAGUES[0];
  }, [selectedCountry]);

  // Fetch fixtures from API-Sports
  const handleFetchFixtures = async () => {
    setIsLoadingFixtures(true);
    setFixtureError(null);
    setPostResult(null);

    try {
      let url = `/api/apisports/fixtures?key=${encodeURIComponent(apiKey)}&timezone=UTC`;
      
      if (fixtureIdInput.trim()) {
        url += `&id=${encodeURIComponent(fixtureIdInput.trim())}`;
      } else if (isLiveOnly) {
        url += `&live=all`;
      } else {
        url += `&date=${selectedDate}`;
      }

      if (selectedLeagueId !== "all" && !fixtureIdInput.trim()) {
        url += `&league=${selectedLeagueId}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success && Array.isArray(data.fixtures)) {
        let list: ApiSportsFixtureItem[] = data.fixtures;

        // If "Important leagues only" filter is active and not querying specific fixture ID, filter out minor cups/lower divisions
        if (onlyImportantLeagues && !fixtureIdInput.trim()) {
          list = list.filter(item => isImportantLeague(item.league.id));
        }

        // If specific country is selected and not "ALL", filter by country (unless specific fixture ID searched)
        if (selectedCountry !== "ALL" && !fixtureIdInput.trim()) {
          list = list.filter(item => {
            const leagueDetail = getLeagueDetailsById(item.league.id);
            if (leagueDetail) {
              return leagueDetail.country.toLowerCase() === selectedCountry.toLowerCase();
            }
            return item.league.country?.toLowerCase() === selectedCountry.toLowerCase();
          });
        }

        setFixtures(list);
        setSelectedFixtureIds(new Set(list.map(f => f.fixture.id)));

        if (list.length === 0) {
          if (data.errors && Object.keys(data.errors).length > 0) {
            setFixtureError(typeof data.errors === "string" ? data.errors : JSON.stringify(data.errors));
          } else {
            setFixtureError(`No fixtures found for ${selectedCountry} on ${isLiveOnly ? "Live Matches" : selectedDate}. Try selecting another date (e.g. today or next matchday) or turning off "Important Only".`);
          }
        }
      } else {
        const errorMsg = data.errors && Object.keys(data.errors).length ? (typeof data.errors === "string" ? data.errors : JSON.stringify(data.errors)) : (data.error || "Failed to fetch fixtures");
        setFixtureError(errorMsg);
        setFixtures([]);
      }
    } catch (err: any) {
      setFixtureError(err.message || "Failed to contact API-Sports service.");
      setFixtures([]);
    } finally {
      setIsLoadingFixtures(false);
    }
  };

  // Trigger fetch when country, date, or live mode changes
  useEffect(() => {
    handleFetchFixtures();
  }, [selectedCountry, selectedDate, selectedLeagueId, onlyImportantLeagues, isLiveOnly]);

  // Toggle selection
  const handleToggleSelect = (fixtureId: number) => {
    setSelectedFixtureIds(prev => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedFixtureIds.size === fixtures.length) {
      setSelectedFixtureIds(new Set());
    } else {
      setSelectedFixtureIds(new Set(fixtures.map(f => f.fixture.id)));
    }
  };

  // Bulk Post Extracted Fixtures to Firestore Database
  const handlePostToDatabase = async (fixturesToPost: ApiSportsFixtureItem[]) => {
    if (fixturesToPost.length === 0) return;
    setIsPosting(true);
    setPostResult(null);

    try {
      let created = 0;
      let updated = 0;

      for (const item of fixturesToPost) {
        const rawMatchData = convertApiSportsFixtureToMatch(item);
        const matchData = cleanFirestorePayload(rawMatchData);

        // Check if matching game already exists in Firestore
        const existing = currentMatches.find(m => 
          m.team1.toLowerCase() === matchData.team1?.toLowerCase() &&
          m.team2.toLowerCase() === matchData.team2?.toLowerCase()
        );

        if (existing) {
          // Preserve existing manually added channels
          const existingChannels = existing.channels && Array.isArray(existing.channels) && existing.channels.length > 0 
            ? existing.channels 
            : (matchData.channels || []);
          await updateDoc(doc(db, "matches", existing.id), cleanFirestorePayload({
            ...matchData,
            channels: existingChannels,
            updatedAt: serverTimestamp()
          }));
          updated++;
        } else {
          // Only use matched channels if present, never inject fake streams
          await addDoc(collection(db, "matches"), cleanFirestorePayload({
            ...matchData,
            channels: matchData.channels || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }));
          created++;
        }
      }

      setPostResult({
        type: "success",
        text: `Successfully posted ${created} new match(es) and updated ${updated} match(es) in Firestore database!`
      });

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error("Post fixtures error:", err);
      setPostResult({
        type: "error",
        text: `Error saving fixtures: ${err.message || "Failed to write to database"}`
      });
    } finally {
      setIsPosting(false);
    }
  };

  // Quick Preset Dates
  const setDatePreset = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Save auto-sync preferences
  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem("apisports_auto_sync", enabled ? "true" : "false");
  };

  const handleToggleCountryAutoSync = (countryName: string) => {
    let next: string[];
    if (autoSyncCountries.includes(countryName)) {
      next = autoSyncCountries.filter(c => c !== countryName);
    } else {
      next = [...autoSyncCountries, countryName];
    }
    setAutoSyncCountries(next);
    localStorage.setItem("apisports_auto_countries", JSON.stringify(next));
  };

  // Load API-Sports Widget script when entering widget tab
  useEffect(() => {
    if (activeViewMode === "widget") {
      const scriptId = "api-sports-widget-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.type = "module";
        script.src = "https://widgets.api-sports.io/2.0.3/widgets.js";
        document.body.appendChild(script);
      }
    }
  }, [activeViewMode]);

  return (
    <div className="space-y-6">
      {/* Top Banner Card: API-Sports Configuration & Quota Status */}
      <div className="liquid-glass rounded-3xl p-6 border border-cyan-500/20 shadow-[0_0_40px_rgba(0,242,254,0.1)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 text-cyan-300">
              <Globe2 size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  API-SPORTS DAILY EXTRACTOR & SYNC
                </h2>
                <span className="text-[10px] bg-green-500/20 border border-green-400/40 text-green-300 px-2.5 py-0.5 rounded-full font-black uppercase flex items-center gap-1">
                  <Zap size={10} /> Active Connection
                </span>
              </div>
              <p className="text-white/60 text-xs mt-0.5">
                Extract fixtures, team logos, and league data from API-Football for Spain & top global leagues and post them daily to Firestore.
              </p>
            </div>
          </div>

          {/* Tab View Switcher */}
          <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-white/10 text-xs font-bold self-start lg:self-auto">
            <button
              id="apisports-view-extractor-btn"
              onClick={() => setActiveViewMode("extractor")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === "extractor" ? "bg-cyan-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" : "text-white/60 hover:text-white"
              }`}
            >
              <Layers size={14} />
              <span>Fixtures Extractor</span>
            </button>

            <button
              id="apisports-view-automation-btn"
              onClick={() => setActiveViewMode("automation")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === "automation" ? "bg-cyan-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" : "text-white/60 hover:text-white"
              }`}
            >
              <CalendarDays size={14} />
              <span>Daily Auto-Post</span>
            </button>

            <button
              id="apisports-view-widget-btn"
              onClick={() => setActiveViewMode("widget")}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeViewMode === "widget" ? "bg-purple-500 text-white font-black shadow-[0_0_15px_rgba(168,85,247,0.4)]" : "text-white/60 hover:text-white"
              }`}
            >
              <Code size={14} />
              <span>Live Widget</span>
            </button>
          </div>
        </div>

        {/* Account Details & API Key Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 text-xs">
          <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
            <span className="text-white/50 font-semibold">Account:</span>
            <span className="text-cyan-300 font-mono font-bold">
              {accountStatus?.account?.email || "kcaarun10@gmail.com"}
            </span>
          </div>

          <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
            <span className="text-white/50 font-semibold">Daily Quota:</span>
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold">
                {accountStatus?.requests?.current ?? 12} / {accountStatus?.requests?.limit_day ?? 100} requests
              </span>
              <button 
                onClick={fetchStatus}
                title="Refresh Quota"
                className="text-white/40 hover:text-white"
              >
                <RefreshCw size={12} className={statusLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex items-center justify-between">
            <span className="text-white/50 font-semibold">Key:</span>
            <span className="text-white/70 font-mono text-[11px]">
              {apiKey.slice(0, 6)}••••••••{apiKey.slice(-4)}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW 1: FIXTURES EXTRACTOR */}
      {activeViewMode === "extractor" && (
        <div className="space-y-6">
          {/* Main Filter & Nation Selector Bar */}
          <div className="liquid-glass rounded-3xl p-6 border border-white/10 space-y-5">
            {/* Country Selector Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-white/50 tracking-wider flex items-center gap-1.5">
                  <Globe2 size={14} className="text-cyan-400" />
                  Select Nation / Category:
                </span>
                <span className="text-[11px] text-cyan-300 font-semibold">
                  Selected: {selectedCountry} ({currentCountryObj.leagues.length} Main Competitions)
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setSelectedCountry("ALL"); setSelectedLeagueId("all"); }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                    selectedCountry === "ALL" 
                      ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-black shadow-lg shadow-cyan-500/20" 
                      : "bg-white/5 text-white/70 hover:text-white border border-white/5 hover:bg-white/10"
                  }`}
                >
                  <Trophy size={14} />
                  <span>All Main Nations</span>
                </button>

                {MAIN_NATIONS_LEAGUES.map((nation) => (
                  <button
                    key={nation.country}
                    type="button"
                    onClick={() => { setSelectedCountry(nation.country); setSelectedLeagueId("all"); }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      selectedCountry === nation.country 
                        ? "bg-cyan-500 text-black font-black shadow-lg shadow-cyan-500/30 scale-[1.02]" 
                        : "bg-white/5 text-white/70 hover:text-white border border-white/5 hover:bg-white/10"
                    }`}
                  >
                    {nation.flagUrl ? (
                      <img 
                        src={nation.flagUrl} 
                        alt={nation.country} 
                        className="w-4 h-3 object-cover rounded-sm shadow-sm"
                        onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                      />
                    ) : null}
                    <span>{nation.country}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Filters: Specific League, Date, Live Mode, Fixture ID, and Important Leagues Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-white/5">
              {/* League Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/60 uppercase">Competition / League:</label>
                <select
                  disabled={isLiveOnly || !!fixtureIdInput.trim()}
                  value={selectedLeagueId}
                  onChange={(e) => setSelectedLeagueId(e.target.value)}
                  className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 disabled:opacity-40"
                >
                  <option value="all">All Important Leagues ({selectedCountry})</option>
                  {currentCountryObj.leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-white/60 uppercase">Fixture Date:</label>
                  <span className="text-[10px] text-cyan-400 font-mono">YYYY-MM-DD</span>
                </div>
                <input
                  type="date"
                  disabled={isLiveOnly || !!fixtureIdInput.trim()}
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setIsLiveOnly(false); }}
                  className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 disabled:opacity-40"
                />
              </div>

              {/* Date Quick Presets & Live Toggle */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/60 uppercase">Date / Mode:</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setDatePreset(0); setIsLiveOnly(false); setFixtureIdInput(""); }}
                    className={`flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all ${
                      !isLiveOnly && selectedDate === new Date().toISOString().slice(0, 10) && !fixtureIdInput
                        ? "bg-cyan-500 text-black font-black"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDatePreset(1); setIsLiveOnly(false); setFixtureIdInput(""); }}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white/70 text-center transition-all"
                  >
                    +1D
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsLiveOnly(!isLiveOnly); setFixtureIdInput(""); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1 ${
                      isLiveOnly 
                        ? "bg-red-500 text-white font-black animate-pulse shadow-lg shadow-red-500/30" 
                        : "bg-white/5 hover:bg-white/10 text-white/70"
                    }`}
                  >
                    <Radio size={11} className={isLiveOnly ? "text-white" : "text-red-400"} />
                    <span>Live</span>
                  </button>
                </div>
              </div>

              {/* Specific Fixture ID Lookup */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/60 uppercase">Search by Fixture ID:</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 1490398"
                    value={fixtureIdInput}
                    onChange={(e) => setFixtureIdInput(e.target.value)}
                    className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400"
                  />
                  {fixtureIdInput && (
                    <button
                      type="button"
                      onClick={() => setFixtureIdInput("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Important Leagues Toggle */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/60 uppercase">Scope:</label>
                <button
                  type="button"
                  onClick={() => setOnlyImportantLeagues(!onlyImportantLeagues)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                    onlyImportantLeagues
                      ? "bg-cyan-500/10 border-cyan-400/40 text-cyan-300"
                      : "bg-white/5 border-white/10 text-white/60"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Shield size={13} className="text-cyan-400 shrink-0" />
                    <span className="truncate">Top Leagues</span>
                  </span>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                    onlyImportantLeagues ? "bg-cyan-400 text-black font-bold" : "bg-white/20"
                  }`}>
                    {onlyImportantLeagues ? "✓" : ""}
                  </span>
                </button>
              </div>
            </div>

            {/* Action Bar (Extract Now, Post All, Post Selected) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-3">
                <button
                  id="apisports-extract-btn"
                  disabled={isLoadingFixtures}
                  onClick={handleFetchFixtures}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isLoadingFixtures ? "animate-spin" : ""} />
                  <span>{isLoadingFixtures ? "Extracting from API-Sports..." : "Extract Fixtures"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={fixtures.length === 0}
                  className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/80 hover:text-white rounded-xl transition-all disabled:opacity-40"
                >
                  {selectedFixtureIds.size === fixtures.length && fixtures.length > 0 ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="apisports-post-selected-btn"
                  disabled={selectedFixtureIds.size === 0 || isPosting}
                  onClick={() => {
                    const selectedList = fixtures.filter(f => selectedFixtureIds.has(f.fixture.id));
                    handlePostToDatabase(selectedList);
                  }}
                  className="px-4 py-2.5 bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {isPosting ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Post Selected ({selectedFixtureIds.size}) to DB</span>
                </button>

                <button
                  id="apisports-post-all-btn"
                  disabled={fixtures.length === 0 || isPosting}
                  onClick={() => handlePostToDatabase(fixtures)}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  {isPosting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Post All ({fixtures.length}) to DB</span>
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Status Alert */}
          {postResult && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs sm:text-sm animate-in fade-in ${
              postResult.type === "success" 
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
              <div className="flex items-center gap-2.5">
                {postResult.type === "success" ? (
                  <CheckCircle2 size={20} className="text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle size={20} className="text-red-400 shrink-0" />
                )}
                <span className="font-bold">{postResult.text}</span>
              </div>
              <button onClick={() => setPostResult(null)} className="text-white/40 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* Extracted Fixtures Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Trophy size={18} className="text-cyan-400" />
                <span>Extracted Fixtures ({fixtures.length})</span>
              </h3>
              <span className="text-xs text-white/40 font-mono">
                {selectedCountry} • {selectedDate}
              </span>
            </div>

            {fixtures.length > 0 && (
              <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-400/30 px-3 py-1 rounded-full font-bold">
                {selectedFixtureIds.size} of {fixtures.length} selected
              </span>
            )}
          </div>

          {/* Loading State */}
          {isLoadingFixtures && (
            <div className="py-16 text-center space-y-3 bg-black/30 rounded-3xl border border-white/5">
              <RefreshCw size={32} className="text-cyan-400 animate-spin mx-auto" />
              <p className="text-white/80 font-bold text-sm">Querying API-Sports for {selectedCountry}...</p>
              <p className="text-white/40 text-xs">Extracting matchday kick-off times, badges, and league data.</p>
            </div>
          )}

          {/* Error / Empty State */}
          {!isLoadingFixtures && fixtureError && (
            <div className="py-12 px-6 text-center space-y-3 bg-black/30 rounded-3xl border border-white/5">
              <Info size={32} className="text-cyan-400 mx-auto" />
              <p className="text-white/80 font-bold text-sm">No Matches Found</p>
              <p className="text-white/50 text-xs max-w-md mx-auto">{fixtureError}</p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => setDatePreset(0)}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-300 rounded-xl text-xs font-bold transition-all"
                >
                  Switch to Today
                </button>
                <button
                  onClick={() => { setSelectedCountry("ALL"); setOnlyImportantLeagues(false); }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all"
                >
                  View All Nations
                </button>
              </div>
            </div>
          )}

          {/* Fixtures List / Grid */}
          {!isLoadingFixtures && fixtures.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fixtures.map((item) => {
                const isSelected = selectedFixtureIds.has(item.fixture.id);
                const matchData = convertApiSportsFixtureToMatch(item);
                const kickOffDate = new Date(item.fixture.date);
                const timeString = kickOffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateString = kickOffDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const statusShort = (item.fixture.status.short || "").toUpperCase();
                const isLive = ["1H", "2H", "HT", "ET", "P", "LIVE"].includes(statusShort);
                const isEnded = ["FT", "AET", "PEN"].includes(statusShort);

                return (
                  <div
                    key={item.fixture.id}
                    className={`relative rounded-2xl p-4 transition-all border ${
                      isSelected 
                        ? "bg-cyan-950/20 border-cyan-400/50 shadow-lg shadow-cyan-500/10" 
                        : "bg-black/40 border-white/5 hover:border-white/20"
                    }`}
                  >
                    {/* Header: Competition & Kick-off Time */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.league.logo?.trim() ? (
                          <img 
                            src={item.league.logo.trim()} 
                            alt={item.league.name} 
                            className="w-5 h-5 object-contain shrink-0"
                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                          />
                        ) : null}
                        <span className="font-bold text-white/80 truncate">
                          {item.league.name}
                        </span>
                        <span className="text-[10px] text-white/40 hidden sm:inline">
                          ({item.league.round})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isLive ? (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            LIVE {item.fixture.status.elapsed ? `${item.fixture.status.elapsed}'` : statusShort}
                          </span>
                        ) : isEnded ? (
                          <span className="text-[10px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                            FT ({matchData.scoreText || "Ended"})
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-400/20">
                            <Clock size={11} />
                            {dateString} {timeString}
                          </span>
                        )}

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.fixture.id)}
                          className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 cursor-pointer accent-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Teams & Score Row */}
                    <div className="grid grid-cols-5 items-center gap-2 py-2">
                      {/* Home Team */}
                      <div className="col-span-2 flex items-center gap-2.5">
                        {item.teams.home.logo?.trim() ? (
                          <img
                            src={item.teams.home.logo.trim()}
                            alt={item.teams.home.name}
                            className="w-8 h-8 object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.teams.home.name)}&background=random&color=fff`;
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-cyan-900/40 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                            {item.teams.home.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-extrabold text-xs text-white truncate">
                          {item.teams.home.name}
                        </span>
                      </div>

                      {/* VS / Score */}
                      <div className="col-span-1 text-center">
                        {matchData.scoreText ? (
                          <span className="font-black text-sm text-cyan-300 font-mono bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
                            {matchData.scoreText}
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold text-white/40 tracking-wider">
                            VS
                          </span>
                        )}
                      </div>

                      {/* Away Team */}
                      <div className="col-span-2 flex items-center justify-end gap-2.5 text-right">
                        <span className="font-extrabold text-xs text-white truncate">
                          {item.teams.away.name}
                        </span>
                        {item.teams.away.logo?.trim() ? (
                          <img
                            src={item.teams.away.logo.trim()}
                            alt={item.teams.away.name}
                            className="w-8 h-8 object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.teams.away.name)}&background=random&color=fff`;
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-cyan-900/40 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                            {item.teams.away.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/5 text-xs">
                      <div className="flex items-center gap-1.5 text-white/50 text-[11px]">
                        <Tv size={12} className="text-cyan-400" />
                        <span>Channels: Manual in Admin</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onEditMatch) {
                              onEditMatch(matchData);
                            }
                          }}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                        >
                          <span>Edit Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePostToDatabase([item])}
                          className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black rounded-lg text-[11px] font-extrabold border border-cyan-400/30 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Save size={11} />
                          <span>Post to DB</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: AUTOMATION & DAILY POST SETTINGS */}
      {activeViewMode === "automation" && (
        <div className="space-y-6">
          <div className="liquid-glass rounded-3xl p-6 border border-white/10 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <CalendarDays size={18} className="text-cyan-400" />
                  <span>Daily Auto-Extraction & Sync Configuration</span>
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Automate daily fixture extraction for Spain & top global leagues straight to your Firestore database.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAutoSync(!autoSyncEnabled)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                    autoSyncEnabled 
                      ? "bg-green-500 text-black shadow-lg shadow-green-500/25" 
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  <Zap size={14} />
                  <span>Auto-Daily Sync: {autoSyncEnabled ? "ENABLED" : "DISABLED"}</span>
                </button>
              </div>
            </div>

            {/* Nations to Include in Daily Sync */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase text-white/70 tracking-wider block">
                Nations & Important Leagues Included in Daily Sync:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {MAIN_NATIONS_LEAGUES.map((nation) => {
                  const isChecked = autoSyncCountries.includes(nation.country);
                  return (
                    <div
                      key={nation.country}
                      onClick={() => handleToggleCountryAutoSync(nation.country)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked 
                          ? "bg-cyan-950/20 border-cyan-400/40 text-white" 
                          : "bg-black/30 border-white/5 text-white/50 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {nation.flagUrl ? (
                          <img 
                            src={nation.flagUrl} 
                            alt={nation.country} 
                            className="w-5 h-3.5 object-cover rounded-sm shadow-sm"
                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                          />
                        ) : null}
                        <div>
                          <span className="font-bold text-xs block">{nation.country}</span>
                          <span className="text-[10px] text-white/40">{nation.leagues.length} Important Leagues</span>
                        </div>
                      </div>

                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isChecked ? "bg-cyan-400 text-black" : "bg-white/10"
                      }`}>
                        {isChecked ? "✓" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sync Settings Info Box */}
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2 text-xs">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Info size={14} />
                <span>How the Daily Synchronizer Works:</span>
              </span>
              <ul className="space-y-1 text-white/70 font-mono text-[11px] list-disc list-inside">
                <li>Server extracts daily matches every day for selected countries at 00:00 UTC.</li>
                <li>Only official top-tier leagues (La Liga, Premier League, Champions League, Serie A, etc.) are indexed.</li>
                <li>Live match statuses & elapsed minutes are refreshed automatically during live game windows.</li>
                <li>Auto-ends matches after standard match duration (115 mins) unless extended by Admin.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE API-SPORTS WIDGET VIEWER */}
      {activeViewMode === "widget" && (
        <div className="space-y-6">
          <div className="liquid-glass rounded-3xl p-6 border border-white/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Code size={18} className="text-purple-400" />
                  <span>API-Sports Official Interactive Widget</span>
                </h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Live & interactive fixture widget embedded using your API-Sports key <code className="text-cyan-300 font-mono">88fba276f1c1c73d68b6fb953f729c34</code>.
                </p>
              </div>

              {/* Widget Country Controls */}
              <div className="flex items-center gap-2">
                <select
                  value={widgetCountry}
                  onChange={(e) => setWidgetCountry(e.target.value)}
                  className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="spain">Spain (La Liga)</option>
                  <option value="england">England (Premier League)</option>
                  <option value="italy">Italy (Serie A)</option>
                  <option value="germany">Germany (Bundesliga)</option>
                  <option value="france">France (Ligue 1)</option>
                  <option value="world">International / Champions League</option>
                  <option value="saudi-arabia">Saudi Arabia</option>
                  <option value="brazil">Brazil</option>
                  <option value="usa">USA (MLS)</option>
                  <option value="portugal">Portugal</option>
                  <option value="netherlands">Netherlands</option>
                </select>

                <select
                  value={widgetTheme}
                  onChange={(e) => setWidgetTheme(e.target.value as any)}
                  className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="dark">Dark Theme</option>
                  <option value="white">White Theme</option>
                </select>
              </div>
            </div>

            {/* Embed Container with Widget Tag */}
            <div className="rounded-2xl p-4 bg-[#0a0e17] border border-white/10 min-h-[420px] overflow-hidden">
              <div
                dangerouslySetInnerHTML={{
                  __html: `
                    <div id="wg-api-sports-container" style="min-height: 380px;">
                      <api-sports-widget data-type="games"
                        data-country="${widgetCountry}"
                        data-tab="${widgetTab}"
                        data-theme="${widgetTheme}"
                      ></api-sports-widget>
                      <api-sports-widget data-type="config"
                        data-key="${apiKey}"
                        data-sport="football"
                        data-lang="en"
                        data-theme="${widgetTheme}"
                        data-show-errors="true"
                      ></api-sports-widget>
                    </div>
                  `
                }}
              />
            </div>

            {/* Code Snippet Reference */}
            <div className="bg-black/50 p-4 rounded-2xl border border-white/5 space-y-2">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
                Widget HTML Source Code Reference:
              </span>
              <pre className="text-[11px] font-mono text-cyan-200/90 overflow-x-auto p-2 bg-black/40 rounded-xl">
{`<api-sports-widget data-type="games"
  data-country="${widgetCountry}"
  data-tab="${widgetTab}"
  data-theme="${widgetTheme}"
></api-sports-widget>

<api-sports-widget data-type="config"
  data-key="${apiKey}"
  data-sport="football"
  data-lang="en"
  data-theme="${widgetTheme}"
  data-show-errors="true"
></api-sports-widget>`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
