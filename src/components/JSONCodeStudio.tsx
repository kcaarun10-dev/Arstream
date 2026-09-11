import React, { useState, useEffect, useMemo } from "react";
import { 
  Code2, 
  FileCode, 
  Check, 
  Copy, 
  Download, 
  Upload, 
  Sparkles, 
  Save, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCw, 
  Tv, 
  Trophy, 
  Radio, 
  Database,
  FileJson,
  Braces,
  HelpCircle,
  Eye,
  RefreshCw,
  Terminal
} from "lucide-react";
import { db } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  serverTimestamp 
} from "firebase/firestore";
import { Match, Channel, League } from "../types";

interface JSONCodeStudioProps {
  currentMatches: Match[];
  currentChannels: Channel[];
  currentLeagues: League[];
  onRefreshData?: () => void;
}

type JSONTarget = "matches" | "channels" | "leagues" | "database";

const MATCH_TEMPLATE = {
  team1: "Manchester City",
  team1Logo: "https://resources.premierleague.com/premierleague/badges/t43.svg",
  team2: "Real Madrid",
  team2Logo: "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg",
  category: "football",
  tournament: "UEFA Champions League",
  tournamentLogo: "https://upload.wikimedia.org/wikipedia/en/b/bf/UEFA_Champions_League_logo_2.svg",
  league: "UEFA Champions League",
  leagueLogo: "https://upload.wikimedia.org/wikipedia/en/b/bf/UEFA_Champions_League_logo_2.svg",
  eventName: "Quarter Final - Leg 1",
  status: "live",
  startTime: new Date().toISOString(),
  durationMinutes: 115,
  autoEndEnabled: true,
  channels: [
    {
      name: "TNT Sports 1 HD",
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      userAgent: "",
      referrer: ""
    },
    {
      name: "Sky Sports Main Event",
      url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8"
    }
  ]
};

const BULK_MATCHES_TEMPLATE = [
  MATCH_TEMPLATE,
  {
    team1: "India",
    team1Logo: "https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg",
    team2: "Australia",
    team2Logo: "https://upload.wikimedia.org/wikipedia/commons/8/88/Flag_of_Australia_%28converted%29.svg",
    category: "cricket",
    tournament: "ICC Champions Trophy",
    tournamentLogo: "https://i.imgur.com/3XIe0au.png",
    status: "upcoming",
    startTime: new Date(Date.now() + 3600000 * 3).toISOString(),
    durationMinutes: 300,
    autoEndEnabled: true,
    channels: [
      {
        name: "Star Sports 1 HD",
        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
      }
    ]
  }
];

const CHANNEL_TEMPLATE = {
  name: "Sky Sports Football HD",
  group: "Football",
  logo: "https://i.imgur.com/3XIe0au.png",
  url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36",
  referrer: "https://example.com/"
};

const BULK_CHANNELS_TEMPLATE = [
  CHANNEL_TEMPLATE,
  {
    name: "BeIN Sports 1 English HD",
    group: "Sports",
    logo: "https://i.imgur.com/3XIe0au.png",
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8"
  },
  {
    name: "TNT Sports 2",
    group: "Sports",
    logo: "https://i.imgur.com/3XIe0au.png",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
  }
];

const LEAGUE_TEMPLATE = {
  name: "Premier League",
  logo: "https://resources.premierleague.com/premierleague/badges/rb/premierleague.svg",
  category: "football",
  country: "England"
};

export const JSONCodeStudio: React.FC<JSONCodeStudioProps> = ({
  currentMatches,
  currentChannels,
  currentLeagues,
  onRefreshData
}) => {
  const [target, setTarget] = useState<JSONTarget>("matches");
  const [jsonCode, setJsonCode] = useState<string>(() => JSON.stringify(BULK_MATCHES_TEMPLATE, null, 2));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidJson, setIsValidJson] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<"append" | "upsert" | "replace">("upsert");
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Validate JSON on change
  useEffect(() => {
    if (!jsonCode.trim()) {
      setIsValidJson(false);
      setValidationError("JSON editor is empty.");
      return;
    }
    try {
      JSON.parse(jsonCode);
      setIsValidJson(true);
      setValidationError(null);
    } catch (err: any) {
      setIsValidJson(false);
      setValidationError(err.message || "Invalid JSON syntax");
    }
  }, [jsonCode]);

  // Load sample template for selected target
  const handleLoadTemplate = (templateType: "single" | "bulk") => {
    setStatusMessage(null);
    let sample: any = null;
    if (target === "matches") {
      sample = templateType === "single" ? MATCH_TEMPLATE : BULK_MATCHES_TEMPLATE;
    } else if (target === "channels") {
      sample = templateType === "single" ? CHANNEL_TEMPLATE : BULK_CHANNELS_TEMPLATE;
    } else if (target === "leagues") {
      sample = templateType === "single" ? LEAGUE_TEMPLATE : [LEAGUE_TEMPLATE, { name: "La Liga", logo: "https://assets.laliga.com/assets/logos/laliga-v-color.png", category: "football", country: "Spain" }];
    } else if (target === "database") {
      sample = {
        exportedAt: new Date().toISOString(),
        matches: BULK_MATCHES_TEMPLATE,
        channels: BULK_CHANNELS_TEMPLATE,
        leagues: [LEAGUE_TEMPLATE]
      };
    }
    setJsonCode(JSON.stringify(sample, null, 2));
    setStatusMessage({ type: "info", text: `Loaded ${templateType} ${target} template into editor.` });
  };

  // Load live Firestore data into editor
  const handleLoadCurrentData = () => {
    setStatusMessage(null);
    let currentData: any = null;
    if (target === "matches") {
      currentData = currentMatches.map(m => {
        const { id, ...rest } = m;
        return { id, ...rest };
      });
    } else if (target === "channels") {
      currentData = currentChannels.map(c => {
        const { id, ...rest } = c;
        return { id, ...rest };
      });
    } else if (target === "leagues") {
      currentData = currentLeagues.map(l => {
        const { id, ...rest } = l;
        return { id, ...rest };
      });
    } else if (target === "database") {
      currentData = {
        exportedAt: new Date().toISOString(),
        matchesCount: currentMatches.length,
        channelsCount: currentChannels.length,
        leaguesCount: currentLeagues.length,
        matches: currentMatches,
        channels: currentChannels,
        leagues: currentLeagues
      };
    }
    setJsonCode(JSON.stringify(currentData, null, 2));
    setStatusMessage({ type: "success", text: `Loaded current live ${target} (${Array.isArray(currentData) ? currentData.length : 'full'} items) from database.` });
  };

  // Format code (Beautify)
  const handleFormatCode = () => {
    try {
      const parsed = JSON.parse(jsonCode);
      setJsonCode(JSON.stringify(parsed, null, 2));
      setValidationError(null);
      setIsValidJson(true);
      setStatusMessage({ type: "info", text: "JSON code formatted with 2-space indentation." });
    } catch (err: any) {
      setValidationError(err.message || "Cannot format invalid JSON.");
    }
  };

  // Minify code
  const handleMinifyCode = () => {
    try {
      const parsed = JSON.parse(jsonCode);
      setJsonCode(JSON.stringify(parsed));
      setValidationError(null);
      setIsValidJson(true);
      setStatusMessage({ type: "info", text: "JSON code minified." });
    } catch (err: any) {
      setValidationError(err.message || "Cannot minify invalid JSON.");
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(jsonCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      setStatusMessage({ type: "info", text: "JSON code copied to clipboard." });
    } catch {
      setStatusMessage({ type: "error", text: "Failed to copy code to clipboard." });
    }
  };

  // Download JSON file
  const handleDownloadFile = () => {
    try {
      const blob = new Blob([jsonCode], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stream-hub-${target}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: "success", text: `Downloaded JSON as ${a.download}` });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: `Download failed: ${err.message}` });
    }
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        setJsonCode(JSON.stringify(parsed, null, 2));
        setStatusMessage({ type: "success", text: `Imported "${file.name}" (${file.size} bytes).` });
      } catch (err: any) {
        setStatusMessage({ type: "error", text: `Invalid JSON file: ${err.message}` });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Sanitizer and validator for match objects
  const sanitizeMatchObject = (item: any): any => {
    if (!item || typeof item !== "object") throw new Error("Match item must be a JSON object.");
    if (!item.team1 || typeof item.team1 !== "string") throw new Error("Match requires 'team1' string.");
    if (!item.team2 || typeof item.team2 !== "string") throw new Error("Match requires 'team2' string.");
    
    const category = (item.category || "football").toLowerCase();
    const status = ["upcoming", "live", "finished", "ended"].includes(item.status) ? item.status : "upcoming";
    const startTime = item.startTime ? new Date(item.startTime).toISOString() : new Date().toISOString();
    const durationMinutes = typeof item.durationMinutes === "number" ? Math.max(10, Math.min(10080, item.durationMinutes)) : 115;
    
    let rawChannels = Array.isArray(item.channels) ? item.channels : [];
    if (rawChannels.length === 0 && item.url) {
      rawChannels = [{ name: item.channelName || "Main Stream", url: item.url }];
    }

    const channels = rawChannels
      .filter((c: any) => c && typeof c === "object" && typeof c.url === "string" && c.url.trim().length > 0)
      .map((c: any, idx: number) => ({
        name: String(c.name || `Server ${idx + 1}`).trim().slice(0, 100),
        url: String(c.url).trim().slice(0, 4000),
        userAgent: c.userAgent ? String(c.userAgent).trim().slice(0, 1000) : "",
        referrer: c.referrer ? String(c.referrer).trim().slice(0, 1000) : ""
      }));

    return {
      team1: item.team1.trim().slice(0, 100),
      team1Logo: item.team1Logo ? String(item.team1Logo).trim().slice(0, 2000) : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.team1)}&background=random&color=fff`,
      team2: item.team2.trim().slice(0, 100),
      team2Logo: item.team2Logo ? String(item.team2Logo).trim().slice(0, 2000) : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.team2)}&background=random&color=fff`,
      category: category.slice(0, 50),
      tournament: item.tournament ? String(item.tournament).trim().slice(0, 200) : null,
      tournamentLogo: item.tournamentLogo ? String(item.tournamentLogo).trim().slice(0, 2000) : null,
      league: item.league ? String(item.league).trim().slice(0, 200) : (item.tournament ? String(item.tournament).trim().slice(0, 200) : null),
      leagueLogo: item.leagueLogo ? String(item.leagueLogo).trim().slice(0, 2000) : (item.tournamentLogo ? String(item.tournamentLogo).trim().slice(0, 2000) : null),
      eventName: item.eventName ? String(item.eventName).trim().slice(0, 200) : null,
      status,
      startTime,
      durationMinutes,
      autoEndMinutes: durationMinutes,
      autoEndEnabled: item.autoEndEnabled !== false,
      channels: channels.slice(0, 20),
      updatedAt: serverTimestamp()
    };
  };

  // Sanitizer and validator for IPTV channel objects
  const sanitizeChannelObject = (item: any): any => {
    if (!item || typeof item !== "object") throw new Error("Channel item must be a JSON object.");
    if (!item.name || typeof item.name !== "string") throw new Error("Channel requires 'name' string.");
    if (!item.url || typeof item.url !== "string") throw new Error("Channel requires 'url' string.");

    return {
      name: item.name.trim().slice(0, 100),
      url: item.url.trim().slice(0, 4000),
      group: (item.group ? String(item.group).trim() : "Sports").slice(0, 100),
      logo: item.logo ? String(item.logo).trim().slice(0, 2000) : "",
      userAgent: item.userAgent ? String(item.userAgent).trim().slice(0, 1000) : "",
      referrer: item.referrer ? String(item.referrer).trim().slice(0, 1000) : "",
      updatedAt: serverTimestamp()
    };
  };

  // Sanitizer and validator for league objects
  const sanitizeLeagueObject = (item: any): any => {
    if (!item || typeof item !== "object") throw new Error("League item must be a JSON object.");
    if (!item.name || typeof item.name !== "string") throw new Error("League requires 'name' string.");

    return {
      name: item.name.trim().slice(0, 150),
      logo: item.logo ? String(item.logo).trim().slice(0, 2000) : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=00f2fe&color=000`,
      category: item.category ? String(item.category).trim().slice(0, 50) : "football",
      country: item.country ? String(item.country).trim().slice(0, 100) : "",
      updatedAt: serverTimestamp()
    };
  };

  // Write and apply JSON code directly to Firestore database
  const handleApplyToDatabase = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const parsed = JSON.parse(jsonCode);

      if (target === "matches") {
        const list = Array.isArray(parsed) ? parsed : [parsed];
        if (list.length === 0) throw new Error("Matches array is empty.");

        let savedCount = 0;
        let updatedCount = 0;

        for (const rawItem of list) {
          const sanitized = sanitizeMatchObject(rawItem);
          
          if (rawItem.id && importMode === "upsert") {
            const docRef = doc(db, "matches", rawItem.id);
            await updateDoc(docRef, sanitized);
            updatedCount++;
          } else {
            // Check if existing match with same teams and date exists
            const existing = currentMatches.find(m => 
              m.team1.toLowerCase() === sanitized.team1.toLowerCase() && 
              m.team2.toLowerCase() === sanitized.team2.toLowerCase()
            );

            if (existing && importMode === "upsert") {
              await updateDoc(doc(db, "matches", existing.id), sanitized);
              updatedCount++;
            } else {
              await addDoc(collection(db, "matches"), {
                ...sanitized,
                createdAt: serverTimestamp()
              });
              savedCount++;
            }
          }
        }

        setStatusMessage({
          type: "success",
          text: `Successfully executed JSON! Created ${savedCount} new match(es), updated ${updatedCount} existing match(es) in Firestore.`
        });
      } else if (target === "channels") {
        const list = Array.isArray(parsed) ? parsed : [parsed];
        if (list.length === 0) throw new Error("Channels array is empty.");

        let savedCount = 0;
        let updatedCount = 0;

        for (const rawItem of list) {
          const sanitized = sanitizeChannelObject(rawItem);

          if (rawItem.id && importMode === "upsert") {
            const docRef = doc(db, "channels", rawItem.id);
            await updateDoc(docRef, sanitized);
            updatedCount++;
          } else {
            const existing = currentChannels.find(c => c.name.toLowerCase() === sanitized.name.toLowerCase());
            if (existing && importMode === "upsert") {
              await updateDoc(doc(db, "channels", existing.id), sanitized);
              updatedCount++;
            } else {
              await addDoc(collection(db, "channels"), {
                ...sanitized,
                createdAt: serverTimestamp()
              });
              savedCount++;
            }
          }
        }

        setStatusMessage({
          type: "success",
          text: `Successfully executed JSON! Saved ${savedCount} new channel(s), updated ${updatedCount} existing channel(s) in Firestore.`
        });
      } else if (target === "leagues") {
        const list = Array.isArray(parsed) ? parsed : [parsed];
        if (list.length === 0) throw new Error("Leagues array is empty.");

        let savedCount = 0;
        let updatedCount = 0;

        for (const rawItem of list) {
          const sanitized = sanitizeLeagueObject(rawItem);

          if (rawItem.id && importMode === "upsert") {
            const docRef = doc(db, "leagues", rawItem.id);
            await updateDoc(docRef, sanitized);
            updatedCount++;
          } else {
            const existing = currentLeagues.find(l => l.name.toLowerCase() === sanitized.name.toLowerCase());
            if (existing && importMode === "upsert") {
              await updateDoc(doc(db, "leagues", existing.id), sanitized);
              updatedCount++;
            } else {
              await addDoc(collection(db, "leagues"), {
                ...sanitized,
                createdAt: serverTimestamp()
              });
              savedCount++;
            }
          }
        }

        setStatusMessage({
          type: "success",
          text: `Successfully executed JSON! Saved ${savedCount} new league(s), updated ${updatedCount} existing league(s) in Firestore.`
        });
      } else if (target === "database") {
        if (typeof parsed !== "object") throw new Error("Database root must be a JSON object containing 'matches', 'channels', and/or 'leagues'.");

        let mCount = 0;
        let cCount = 0;
        let lCount = 0;

        if (Array.isArray(parsed.matches)) {
          for (const item of parsed.matches) {
            const sanitized = sanitizeMatchObject(item);
            await addDoc(collection(db, "matches"), { ...sanitized, createdAt: serverTimestamp() });
            mCount++;
          }
        }

        if (Array.isArray(parsed.channels)) {
          for (const item of parsed.channels) {
            const sanitized = sanitizeChannelObject(item);
            await addDoc(collection(db, "channels"), { ...sanitized, createdAt: serverTimestamp() });
            cCount++;
          }
        }

        if (Array.isArray(parsed.leagues)) {
          for (const item of parsed.leagues) {
            const sanitized = sanitizeLeagueObject(item);
            await addDoc(collection(db, "leagues"), { ...sanitized, createdAt: serverTimestamp() });
            lCount++;
          }
        }

        setStatusMessage({
          type: "success",
          text: `Full Database JSON write completed! (${mCount} matches, ${cCount} channels, ${lCount} leagues saved to Firestore).`
        });
      }

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error("JSON Execute Error:", err);
      setStatusMessage({
        type: "error",
        text: `Error applying JSON to database: ${err.message || "Failed to write documents"}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Line count for code editor margin
  const lineCount = useMemo(() => {
    return jsonCode.split("\n").length;
  }, [jsonCode]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="liquid-glass rounded-3xl p-6 border border-cyan-500/20 shadow-[0_0_40px_rgba(0,242,254,0.1)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
              <FileJson size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                  JSON CODE STUDIO & DATABASE WRITER
                </h2>
                <span className="text-[10px] bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 px-2 py-0.5 rounded-full font-black uppercase">
                  Direct Firestore
                </span>
              </div>
              <p className="text-white/60 text-xs mt-0.5">
                Write, validate, format, and execute raw JSON code directly to Firestore collections.
              </p>
            </div>
          </div>

          {/* Collection / Target Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/10 text-xs font-bold">
            <button
              id="json-target-matches-btn"
              onClick={() => { setTarget("matches"); handleLoadTemplate("bulk"); }}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                target === "matches" ? "bg-cyan-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" : "text-white/60 hover:text-white"
              }`}
            >
              <Radio size={14} />
              <span>Matches JSON ({currentMatches.length})</span>
            </button>

            <button
              id="json-target-channels-btn"
              onClick={() => { setTarget("channels"); handleLoadTemplate("bulk"); }}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                target === "channels" ? "bg-cyan-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" : "text-white/60 hover:text-white"
              }`}
            >
              <Tv size={14} />
              <span>IPTV Channels JSON ({currentChannels.length})</span>
            </button>

            <button
              id="json-target-leagues-btn"
              onClick={() => { setTarget("leagues"); handleLoadTemplate("single"); }}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                target === "leagues" ? "bg-cyan-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" : "text-white/60 hover:text-white"
              }`}
            >
              <Trophy size={14} />
              <span>Leagues JSON ({currentLeagues.length})</span>
            </button>

            <button
              id="json-target-database-btn"
              onClick={() => { setTarget("database"); handleLoadCurrentData(); }}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                target === "database" ? "bg-purple-500 text-white font-black shadow-[0_0_15px_rgba(168,85,247,0.4)]" : "text-white/60 hover:text-white"
              }`}
            >
              <Database size={14} />
              <span>Full Database JSON</span>
            </button>
          </div>
        </div>

        {/* Toolbar & Template Insertion Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Sparkles size={12} className="text-cyan-400" /> Templates:
            </span>
            <button
              onClick={() => handleLoadTemplate("single")}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-white/80 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Braces size={13} className="text-cyan-400" /> Single {target.slice(0, -1) || target}
            </button>
            <button
              onClick={() => handleLoadTemplate("bulk")}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-white/80 hover:text-white transition-all flex items-center gap-1.5"
            >
              <FileCode size={13} className="text-purple-400" /> Bulk Array
            </button>
            <button
              onClick={handleLoadCurrentData}
              className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 rounded-lg text-xs font-semibold text-cyan-300 transition-all flex items-center gap-1.5"
            >
              <RotateCw size={13} /> Load Live {target} from DB
            </button>
          </div>

          {/* Quick Actions (Format, Copy, Download, Upload) */}
          <div className="flex items-center gap-2">
            <button
              id="json-format-btn"
              onClick={handleFormatCode}
              title="Prettify JSON with 2-space indentation"
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5"
            >
              <Code2 size={13} className="text-cyan-400" /> Format Code
            </button>
            <button
              onClick={handleMinifyCode}
              title="Minify JSON (one-line compact format)"
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white/80 hover:text-white transition-all"
            >
              Minify
            </button>
            <button
              id="json-copy-btn"
              onClick={handleCopyCode}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 hover:text-white transition-all"
              title="Copy to Clipboard"
            >
              {copySuccess ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            <button
              onClick={handleDownloadFile}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 hover:text-white transition-all"
              title="Download JSON File"
            >
              <Download size={14} />
            </button>
            <label 
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 hover:text-white transition-all cursor-pointer"
              title="Upload JSON File"
            >
              <Upload size={14} />
              <input type="file" accept=".json,application/json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Code Editor Box with Line Numbers */}
      <div className="relative rounded-3xl overflow-hidden border border-cyan-500/20 bg-[#0c1017] shadow-2xl">
        {/* Editor Title Bar */}
        <div className="bg-[#161b22] px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-white/70">
            <Terminal size={14} className="text-cyan-400" />
            <span>schema/{target}.json</span>
            <span className="text-[10px] text-white/40">({lineCount} lines, {jsonCode.length} characters)</span>
          </div>

          <div className="flex items-center gap-2">
            {isValidJson ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
                <CheckCircle2 size={12} /> Valid JSON Syntax
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                <AlertTriangle size={12} /> Invalid Syntax
              </span>
            )}
          </div>
        </div>

        {/* Editor Area with Monospace Textarea */}
        <div className="relative flex min-h-[380px] max-h-[600px]">
          {/* Line Numbers Column */}
          <div className="w-12 py-3.5 bg-[#090d13] border-r border-white/5 text-right pr-2 select-none font-mono text-[11px] text-white/20 overflow-hidden shrink-0">
            {Array.from({ length: Math.min(lineCount, 500) }).map((_, i) => (
              <div key={i} className="leading-5 h-5">{i + 1}</div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            id="json-code-textarea"
            value={jsonCode}
            onChange={(e) => setJsonCode(e.target.value)}
            placeholder={`// Enter or paste ${target} JSON code here...`}
            spellCheck={false}
            className="w-full h-[450px] p-3.5 bg-transparent font-mono text-xs sm:text-sm text-cyan-200/90 leading-5 focus:outline-none resize-y selection:bg-cyan-500/30 custom-scrollbar"
          />
        </div>

        {/* Syntax Error Diagnostics Drawer (if invalid) */}
        {validationError && (
          <div className="bg-red-500/10 border-t border-red-500/30 p-3 flex items-start gap-2.5 text-xs text-red-300">
            <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Syntax Error:</span>
              <span className="font-mono text-[11px] text-red-200/80">{validationError}</span>
            </div>
          </div>
        )}

        {/* Live Status Message Notification */}
        {statusMessage && (
          <div className={`p-4 border-t flex items-center justify-between text-xs sm:text-sm ${
            statusMessage.type === "success" 
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : statusMessage.type === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
          }`}>
            <div className="flex items-center gap-2">
              {statusMessage.type === "success" && <CheckCircle2 size={18} className="text-green-400 shrink-0" />}
              {statusMessage.type === "error" && <AlertTriangle size={18} className="text-red-400 shrink-0" />}
              {statusMessage.type === "info" && <Sparkles size={18} className="text-cyan-400 shrink-0" />}
              <span className="font-semibold">{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-white/40 hover:text-white p-1">
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {/* Action Execution Footer */}
        <div className="bg-[#12161f] p-4 sm:p-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs text-white/50 font-bold uppercase tracking-wider">Sync Mode:</span>
            <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setImportMode("upsert")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  importMode === "upsert" ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
                }`}
              >
                Upsert (Update & Create)
              </button>
              <button
                type="button"
                onClick={() => setImportMode("append")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  importMode === "append" ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
                }`}
              >
                Append Only
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              id="json-apply-database-btn"
              disabled={!isValidJson || isProcessing}
              onClick={handleApplyToDatabase}
              className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                isValidJson && !isProcessing
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black shadow-cyan-500/25 cursor-pointer"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Executing to Firestore...</span>
                </>
              ) : (
                <>
                  <Save size={15} />
                  <span>Execute & Save to Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* JSON Schema Guidance & Helper Reference */}
      <div className="liquid-glass rounded-3xl p-6 border border-white/5 space-y-4">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <HelpCircle size={16} className="text-cyan-400" />
          JSON Schema Field Reference
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
            <span className="font-extrabold text-cyan-300 block">Matches Schema</span>
            <ul className="space-y-1 text-white/70 font-mono text-[11px]">
              <li>• <span className="text-cyan-400">team1</span>, <span className="text-cyan-400">team2</span> (string, req)</li>
              <li>• <span className="text-cyan-400">team1Logo</span>, <span className="text-cyan-400">team2Logo</span> (url)</li>
              <li>• <span className="text-cyan-400">category</span> ("football", "cricket"...)</li>
              <li>• <span className="text-cyan-400">status</span> ("live", "upcoming", "ended")</li>
              <li>• <span className="text-cyan-400">startTime</span> (ISO 8601 string)</li>
              <li>• <span className="text-cyan-400">channels</span>: [ &#123; name, url, userAgent, referrer &#125; ]</li>
            </ul>
          </div>

          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
            <span className="font-extrabold text-cyan-300 block">IPTV Channels Schema</span>
            <ul className="space-y-1 text-white/70 font-mono text-[11px]">
              <li>• <span className="text-cyan-400">name</span> (string, req)</li>
              <li>• <span className="text-cyan-400">url</span> (stream url, .m3u8, req)</li>
              <li>• <span className="text-cyan-400">group</span> ("Sports", "Football", "News")</li>
              <li>• <span className="text-cyan-400">logo</span> (icon / logo URL)</li>
              <li>• <span className="text-cyan-400">userAgent</span>, <span className="text-cyan-400">referrer</span> (opt)</li>
            </ul>
          </div>

          <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
            <span className="font-extrabold text-cyan-300 block">Leagues Schema</span>
            <ul className="space-y-1 text-white/70 font-mono text-[11px]">
              <li>• <span className="text-cyan-400">name</span> (string, req)</li>
              <li>• <span className="text-cyan-400">logo</span> (badge / emblem URL, req)</li>
              <li>• <span className="text-cyan-400">category</span> ("football", "basketball")</li>
              <li>• <span className="text-cyan-400">country</span> (opt, e.g. "England")</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
