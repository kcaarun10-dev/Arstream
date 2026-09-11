import React, { useState, useEffect, useMemo } from "react";
import { db, auth, loginWithGoogle, loginWithGoogleRedirect, getRedirectResult, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Match, MatchChannel, Channel, Team, League, MatchRequest } from "../types";
import { 
  Trophy, 
  Plus, 
  Trash2, 
  LogIn, 
  LogOut, 
  Loader2, 
  Save, 
  Search, 
  Check, 
  Edit2, 
  RotateCw, 
  Globe, 
  ChevronLeft, 
  AlertTriangle,
  Sparkles,
  X,
  Clock,
  Timer,
  Play,
  StopCircle,
  Eye,
  EyeOff,
  CalendarClock,
  Radio,
  RefreshCw,
  CheckCircle2,
  History,
  Hourglass,
  Tv,
  ExternalLink,
  Film,
  MonitorPlay,
  Copy,
  MessageSquarePlus,
  Inbox,
  Ban,
  Calendar,
  User,
  MessageSquare,
  Upload,
  FileUp,
  Code,
  Share2,
  TrendingUp,
  Users
} from "lucide-react";
import { parseM3U } from "../utils/m3uParser";
import { M3U_DATA } from "../data/playlist";
import { POPULAR_TEAMS } from "../data/teams";
import { POPULAR_LEAGUES } from "../data/leagues";
import { ADMIN_CATEGORIES, ALL_CATEGORIES } from "../data/categories";
import { getMatchDynamicStatus, formatRemainingTimer, getSportMatchInfo, sortMatches, isCategoryMatch } from "../utils/sportsSchedule";
import { useAllMatchesRealtimeViewers, formatViewerCount } from "../utils/realtimeViewers";
import { 
  findChannelInfoByUrl, 
  isLikelyStreamUrl, 
  ChannelLookupResult,
  isIframeHtml,
  stripSandbox,
  extractIframeSrc,
  extractAllIframes,
  isEmbedUrl,
  detectStreamProtocol
} from "../utils/channelLookup";
import { 
  generateMatchDescription, 
  generateMatchMetaDescription, 
  generateMatchKeywords, 
  generateMatchPageTitle 
} from "../utils/metaManager";
import { 
  generateMatchSlug, 
  sanitizeSlug, 
  getMatchSlug, 
  formatMatchShortUrl 
} from "../utils/slugUtils";
import { JSONCodeStudio } from "./JSONCodeStudio";
import { APISportsManager } from "./APISportsManager";
import { StreamedSyncManager } from "./StreamedSyncManager";
import { MatchIntelligenceHub } from "./MatchIntelligenceHub";
import { AdminAnnouncementsManager } from "./AdminAnnouncementsManager";
import { getEnrichedMatchDetails } from "../utils/matchDetailsGenerator";
import { FileJson, Code2, Terminal, Braces, FileCode, Globe2, Megaphone as MegaphoneIcon } from "lucide-react";

interface AdminDashboardProps {
  onBack?: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matches" | "leagues" | "iptv" | "requests" | "json" | "apisports" | "streamed" | "announcements">("matches");
  const [inspectorMatch, setInspectorMatch] = useState<Match | null>(null);
  const [isEnrichingSingle, setIsEnrichingSingle] = useState(false);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<"all" | "pending" | "added" | "dismissed">("all");
  const [requestSearch, setRequestSearch] = useState<string>("");
  const [isUpdatingRequest, setIsUpdatingRequest] = useState<string | null>(null);
  const [matchFormMode, setMatchFormMode] = useState<"visual" | "json">("visual");
  const [matchJsonText, setMatchJsonText] = useState<string>("");
  const [matchJsonError, setMatchJsonError] = useState<string | null>(null);
  const [adminMatchFilter, setAdminMatchFilter] = useState<"all" | "active" | "live" | "upcoming" | "upcoming_24h" | "upcoming_future" | "ended">("all");
  const [adminSportCategory, setAdminSportCategory] = useState<string>("all");
  const [adminMatchSearch, setAdminMatchSearch] = useState<string>("");
  const [extendTimerModalMatch, setExtendTimerModalMatch] = useState<Match | null>(null);
  const [customExtendMins, setCustomExtendMins] = useState<number>(30);
  const [quickChannelMatch, setQuickChannelMatch] = useState<Match | null>(null);
  const [quickChannelsList, setQuickChannelsList] = useState<MatchChannel[]>([]);
  const [isSavingQuickChannels, setIsSavingQuickChannels] = useState(false);
  const [quickChannelDetected, setQuickChannelDetected] = useState<{ [index: number]: { name: string; sourceLabel: string } }>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const livePresenceMap = useAllMatchesRealtimeViewers();

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Autocomplete searches
  const [channelSearch, setChannelSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [autoDetectedChannels, setAutoDetectedChannels] = useState<{ [key: number]: { name: string; sourceLabel: string; matchedUrl: string } }>({});
  const [iptvAutoDetected, setIptvAutoDetected] = useState<{ name: string; sourceLabel: string } | null>(null);
  const [team1Search, setTeam1Search] = useState("");
  const [team2Search, setTeam2Search] = useState("");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [showLeagueSuggestions, setShowLeagueSuggestions] = useState(false);

  // Dynamic remote logo search
  const [dynamicTeam1Suggestions, setDynamicTeam1Suggestions] = useState<any[]>([]);
  const [dynamicTeam2Suggestions, setDynamicTeam2Suggestions] = useState<any[]>([]);
  const [isSearchingTeam1, setIsSearchingTeam1] = useState(false);
  const [isSearchingTeam2, setIsSearchingTeam2] = useState(false);
  const [showTeam1Suggestions, setShowTeam1Suggestions] = useState(false);
  const [showTeam2Suggestions, setShowTeam2Suggestions] = useState(false);

  // Firestore collections
  const [firestoreTeams, setFirestoreTeams] = useState<Team[]>([]);
  const [firestoreChannels, setFirestoreChannels] = useState<Channel[]>([]);
  const [firestoreLeagues, setFirestoreLeagues] = useState<League[]>([]);

  // CricHD sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [discoveredMatches, setDiscoveredMatches] = useState<any[]>([]);
  const [showSyncWindow, setShowSyncWindow] = useState(false);

  // Standalone League manager form state
  const [leagueManagerSearch, setLeagueManagerSearch] = useState("");
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueLogo, setNewLeagueLogo] = useState("");
  const [newLeagueCategory, setNewLeagueCategory] = useState("football");
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [isSavingLeague, setIsSavingLeague] = useState(false);

  // Standalone IPTV Channel manager form state
  const [iptvManagerSearch, setIptvManagerSearch] = useState("");
  const [iptvGroupFilter, setIptvGroupFilter] = useState("all");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelGroup, setNewChannelGroup] = useState("Sports");
  const [newChannelLogo, setNewChannelLogo] = useState("");
  const [newChannelUrl, setNewChannelUrl] = useState("");
  const [newChannelUserAgent, setNewChannelUserAgent] = useState("");
  const [newChannelReferrer, setNewChannelReferrer] = useState("");
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [showAdvancedHeaders, setShowAdvancedHeaders] = useState(false);
  const [testingChannel, setTestingChannel] = useState<Channel | null>(null);

  // Iframe Upload & Embed Studio State
  const [showIframeModal, setShowIframeModal] = useState(false);
  const [iframePasteText, setIframePasteText] = useState("");
  const [iframeTargetMode, setIframeTargetMode] = useState<"form" | "quick" | "iptv">("form");
  const [testingIframeUrl, setTestingIframeUrl] = useState<string | null>(null);

  const POPULAR_IPTV_GROUPS = [
    "Sports",
    "Football",
    "Cricket",
    "General Sports",
    "News",
    "Entertainment",
    "Movies",
    "Kids",
    "Music",
    "Documentary",
    "General TV"
  ];

  const TEAM_STORAGE_KEY = "pulse-stream-custom-teams";
  const CHANNEL_STORAGE_KEY = "pulse-stream-custom-channels";
  const LEAGUE_STORAGE_KEY = "pulse-stream-custom-leagues";

  const readStoredItems = <T,>(storageKey: string): T[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const writeStoredItems = <T,>(storageKey: string, items: T[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  };

  // Local storage caching helpers
  const upsertLocalTeam = (teamName: string, teamLogo: string, category?: string) => {
    const sanitizedName = teamName?.trim();
    if (!sanitizedName) return null;
    const items = readStoredItems<Team>(TEAM_STORAGE_KEY);
    const next = [
      { id: `local-${Date.now()}`, name: sanitizedName, logo: teamLogo || "", category: category || "football", updatedAt: new Date().toISOString() },
      ...items.filter(item => item.name.toLowerCase() !== sanitizedName.toLowerCase())
    ].slice(0, 200);
    writeStoredItems(TEAM_STORAGE_KEY, next);
    return next[0];
  };

  const upsertLocalChannel = (channel: Channel) => {
    const sanitizedName = channel.name?.trim();
    if (!sanitizedName) return null;
    const items = readStoredItems<Channel>(CHANNEL_STORAGE_KEY);
    const next = [
      { ...channel, id: channel.id || `local-channel-${Date.now()}`, name: sanitizedName, logo: channel.logo || "", group: channel.group || "sports", updatedAt: new Date().toISOString() },
      ...items.filter(item => item.name.toLowerCase() !== sanitizedName.toLowerCase())
    ].slice(0, 200);
    writeStoredItems(CHANNEL_STORAGE_KEY, next);
    return next[0];
  };

  const upsertLocalLeague = (leagueName: string, leagueLogo: string, category?: string) => {
    const sanitizedName = leagueName?.trim();
    if (!sanitizedName) return null;
    const items = readStoredItems<League>(LEAGUE_STORAGE_KEY);
    const next = [
      { id: `local-league-${Date.now()}`, name: sanitizedName, logo: leagueLogo || "", category: category || "football", updatedAt: new Date().toISOString() },
      ...items.filter(item => item.name.toLowerCase() !== sanitizedName.toLowerCase())
    ].slice(0, 200);
    writeStoredItems(LEAGUE_STORAGE_KEY, next);
    return next[0];
  };

  const availableChannels = useMemo(() => parseM3U(M3U_DATA), []);
  const localCustomChannels = useMemo(() => readStoredItems<Channel>(CHANNEL_STORAGE_KEY), [firestoreChannels]);
  const localCustomLeagues = useMemo(() => readStoredItems<League>(LEAGUE_STORAGE_KEY), [firestoreLeagues]);
  const localCustomTeams = useMemo(() => readStoredItems<Team>(TEAM_STORAGE_KEY), [firestoreTeams]);

  // Combined League Suggestions (Firestore + Local + Presets)
  const combinedLeagueSuggestions = useMemo(() => {
    const q = leagueSearch.trim().toLowerCase();
    const seen = new Set<string>();
    const results: Array<{ name: string; logo: string; category?: string; source: string; id?: string }> = [];

    firestoreLeagues.forEach(l => {
      if (!seen.has(l.name.toLowerCase()) && (!q || l.name.toLowerCase().includes(q))) {
        seen.add(l.name.toLowerCase());
        results.push({ name: l.name, logo: l.logo, category: l.category, source: "DB", id: l.id });
      }
    });

    localCustomLeagues.forEach(l => {
      if (!seen.has(l.name.toLowerCase()) && (!q || l.name.toLowerCase().includes(q))) {
        seen.add(l.name.toLowerCase());
        results.push({ name: l.name, logo: l.logo, category: l.category, source: "LOCAL", id: l.id });
      }
    });

    POPULAR_LEAGUES.forEach(l => {
      if (!seen.has(l.name.toLowerCase()) && (!q || l.name.toLowerCase().includes(q))) {
        seen.add(l.name.toLowerCase());
        results.push({ name: l.name, logo: l.logo, category: l.category, source: "PRESET" });
      }
    });

    return results.slice(0, 10);
  }, [leagueSearch, firestoreLeagues, localCustomLeagues]);

  const filteredAvailableChannels = useMemo(() => {
    if (!channelSearch) return [];
    const q = channelSearch.toLowerCase();
    const m3uChannels = availableChannels.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.group.toLowerCase().includes(q)
    );
    const dbChannels = [...firestoreChannels, ...localCustomChannels].filter(c => 
      c.name.toLowerCase().includes(q)
    );
    const seen = new Set(m3uChannels.map(c => c.name.toLowerCase()));
    const uniqueDbChannels = dbChannels.filter(c => !seen.has(c.name.toLowerCase()));
    return [...m3uChannels, ...uniqueDbChannels].slice(0, 10);
  }, [channelSearch, availableChannels, firestoreChannels, localCustomChannels]);

  const team1Suggestions = useMemo(() => {
    if (!team1Search) return [];
    return POPULAR_TEAMS.filter(t => 
      t.name.toLowerCase().includes(team1Search.toLowerCase())
    ).slice(0, 5);
  }, [team1Search]);

  const team2Suggestions = useMemo(() => {
    if (!team2Search) return [];
    return POPULAR_TEAMS.filter(t => 
      t.name.toLowerCase().includes(team2Search.toLowerCase())
    ).slice(0, 5);
  }, [team2Search]);

  // Dynamic remote logo search
  useEffect(() => {
    if (!team1Search || team1Search.length < 3) {
      setDynamicTeam1Suggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingTeam1(true);
      try {
        const res = await fetch(`/api/search-team?q=${encodeURIComponent(team1Search)}`);
        const data = await res.json();
        setDynamicTeam1Suggestions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Team search failed", e);
        setDynamicTeam1Suggestions([]);
      } finally {
        setIsSearchingTeam1(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [team1Search]);

  useEffect(() => {
    if (!team2Search || team2Search.length < 3) {
      setDynamicTeam2Suggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingTeam2(true);
      try {
        const res = await fetch(`/api/search-team?q=${encodeURIComponent(team2Search)}`);
        const data = await res.json();
        setDynamicTeam2Suggestions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Team search failed", e);
        setDynamicTeam2Suggestions([]);
      } finally {
        setIsSearchingTeam2(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [team2Search]);

  const combinedTeam1Suggestions = useMemo(() => {
    const seen = new Set(team1Suggestions.map(t => t.name.toLowerCase()));
    const localSuggestions = localCustomTeams.filter(t =>
      t.name.toLowerCase().includes(team1Search.toLowerCase()) && !seen.has(t.name.toLowerCase())
    );
    const firestoreSuggestions = firestoreTeams.filter(t => 
      t.name.toLowerCase().includes(team1Search.toLowerCase()) && !seen.has(t.name.toLowerCase()) && !localSuggestions.some(ls => ls.name.toLowerCase() === t.name.toLowerCase())
    );
    return [...team1Suggestions, ...localSuggestions, ...firestoreSuggestions, ...dynamicTeam1Suggestions.filter(t => !seen.has(t.name.toLowerCase()) && !localSuggestions.some(ls => ls.name.toLowerCase() === t.name.toLowerCase()) && !firestoreSuggestions.some(fs => fs.name.toLowerCase() === t.name.toLowerCase()))];
  }, [team1Suggestions, dynamicTeam1Suggestions, firestoreTeams, localCustomTeams, team1Search]);

  const combinedTeam2Suggestions = useMemo(() => {
    const seen = new Set(team2Suggestions.map(t => t.name.toLowerCase()));
    const localSuggestions = localCustomTeams.filter(t =>
      t.name.toLowerCase().includes(team2Search.toLowerCase()) && !seen.has(t.name.toLowerCase())
    );
    const firestoreSuggestions = firestoreTeams.filter(t => 
      t.name.toLowerCase().includes(team2Search.toLowerCase()) && !seen.has(t.name.toLowerCase()) && !localSuggestions.some(ls => ls.name.toLowerCase() === t.name.toLowerCase())
    );
    return [...team2Suggestions, ...localSuggestions, ...firestoreSuggestions, ...dynamicTeam2Suggestions.filter(t => !seen.has(t.name.toLowerCase()) && !localSuggestions.some(ls => ls.name.toLowerCase() === t.name.toLowerCase()) && !firestoreSuggestions.some(fs => fs.name.toLowerCase() === t.name.toLowerCase()))];
  }, [team2Suggestions, dynamicTeam2Suggestions, firestoreTeams, localCustomTeams, team2Search]);

  // Form State
  const [formData, setFormData] = useState({
    team1: "",
    team1Logo: "",
    team2: "",
    team2Logo: "",
    category: "football",
    tournament: "",
    tournamentLogo: "",
    league: "",
    leagueLogo: "",
    eventName: "",
    startTime: "",
    endTime: "",
    durationMinutes: 130,
    autoEndMinutes: 130,
    autoEndAt: "",
    autoEndEnabled: true,
    status: "live" as 'live' | 'upcoming' | 'finished' | 'ended',
    description: "",
    metaDescription: "",
    slug: "",
    channels: [{ name: "Main Stream", url: "" }] as MatchChannel[]
  });

  const [copiedSlug, setCopiedSlug] = useState(false);
  const [copiedMatchId, setCopiedMatchId] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      if (err) {
        console.error("Redirect signin error:", err);
        setLoginError(err.message || "Redirect sign-in error");
      }
    });

    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "teams"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, {
      next: (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Team[];
        setFirestoreTeams(data);
      },
      error: (error) => {
        console.warn("Firestore teams error:", error);
      }
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "leagues"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, {
      next: (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as League[];
        setFirestoreLeagues(data);
      },
      error: (error) => {
        console.warn("Firestore leagues error:", error);
      }
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "channels"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, {
      next: (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Channel[];
        setFirestoreChannels(data);
      },
      error: (error) => {
        console.warn("Firestore channels error:", error);
      }
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "matches"), {
      next: (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Match[];
        setMatches(data);
      },
      error: (error) => {
        console.warn("Firestore admin matches error:", error);
      }
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "matchRequests"), {
      next: (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MatchRequest[];
        data.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime() || 0);
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime() || 0);
          return timeB - timeA;
        });
        setMatchRequests(data);
      },
      error: (error) => {
        console.warn("Firestore match requests notice:", error);
      }
    });
    return unsub;
  }, [user]);

  const handleUpdateRequestStatus = async (requestId: string, newStatus: 'pending' | 'added' | 'dismissed') => {
    setIsUpdatingRequest(requestId);
    try {
      await updateDoc(doc(db, "matchRequests", requestId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to update request status:", err);
      alert("Failed to update request status.");
    } finally {
      setIsUpdatingRequest(null);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!window.confirm("Are you sure you want to delete this match request?")) return;
    try {
      await deleteDoc(doc(db, "matchRequests", requestId));
    } catch (err) {
      console.error("Failed to delete request:", err);
      alert("Failed to delete request.");
    }
  };

  const handleCreateMatchFromRequest = async (req: MatchRequest) => {
    let team1 = "";
    let team2 = "";
    const title = req.matchTitle.trim();
    if (title.toLowerCase().includes(" vs ")) {
      const parts = title.split(/ vs /i);
      team1 = parts[0]?.trim() || "";
      team2 = parts.slice(1).join(" vs ").trim();
    } else if (title.toLowerCase().includes(" v ")) {
      const parts = title.split(/ v /i);
      team1 = parts[0]?.trim() || "";
      team2 = parts.slice(1).join(" v ").trim();
    } else {
      team1 = title;
      team2 = "";
    }

    const nowIso = new Date().toISOString().slice(0, 16);
    const channelsList = req.notes && (req.notes.startsWith("http://") || req.notes.startsWith("https://")) 
      ? [{ name: "Main Stream", url: req.notes.trim() }] 
      : [{ name: "Main Stream", url: "" }];

    const generatedDesc = generateMatchDescription({
      team1,
      team2,
      category: req.category || "football",
      eventName: req.matchTitle,
      startTime: nowIso,
      status: "live",
      channels: channelsList
    });
    const generatedMetaDesc = generateMatchMetaDescription({
      team1,
      team2,
      category: req.category || "football",
      eventName: req.matchTitle,
      startTime: nowIso,
      status: "live"
    });

    const matchedSportInfo = getSportMatchInfo(req.category || "football", req.matchTitle);

    setFormData({
      team1,
      team1Logo: "",
      team2,
      team2Logo: "",
      category: req.category || "football",
      tournament: "",
      tournamentLogo: "",
      league: "",
      leagueLogo: "",
      eventName: req.matchTitle,
      startTime: nowIso,
      endTime: "",
      durationMinutes: matchedSportInfo.durationMinutes,
      autoEndMinutes: matchedSportInfo.durationMinutes,
      autoEndAt: "",
      autoEndEnabled: true,
      status: "live",
      description: generatedDesc,
      metaDescription: generatedMetaDesc,
      channels: channelsList
    });

    setEditingId(null);
    setIsAdding(true);
    setActiveTab("matches");

    try {
      await updateDoc(doc(db, "matchRequests", req.id), {
        status: "added",
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Could not mark request as added automatically:", e);
    }
  };

  // Save/update league to Firestore database
  const saveLeagueToFirestore = async (leagueName: string, leagueLogo: string, category?: string, country?: string) => {
    try {
      const sanitizedName = leagueName?.trim();
      const sanitizedLogo = leagueLogo?.trim() || "";
      if (!sanitizedName) return null;

      upsertLocalLeague(sanitizedName, sanitizedLogo, category);

      const existingLeague = firestoreLeagues.find(l => l.name.toLowerCase() === sanitizedName.toLowerCase());
      
      if (existingLeague && existingLeague.id) {
        if (existingLeague.logo !== sanitizedLogo || existingLeague.category !== category) {
          await updateDoc(doc(db, "leagues", existingLeague.id), {
            logo: sanitizedLogo,
            category: category || "football",
            country: country || null,
            updatedAt: serverTimestamp()
          });
        }
        return existingLeague.id;
      }
      
      const docRef = await addDoc(collection(db, "leagues"), {
        name: sanitizedName,
        logo: sanitizedLogo,
        category: category || "football",
        country: country || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error saving league to Firestore:", error);
      return null;
    }
  };

  const saveChannelToFirestore = async (channel: Partial<Channel> & { name: string; url: string }) => {
    try {
      if (channel.id) {
        upsertLocalChannel(channel as Channel);
      } else {
        upsertLocalChannel({ id: `local-${Date.now()}`, ...channel } as Channel);
      }
      const existingChannel = [...firestoreChannels, ...localCustomChannels].find(c => c.name.toLowerCase() === channel.name.toLowerCase());

      const payload: Record<string, any> = {
        name: channel.name,
        logo: channel.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name)}&background=00f2fe&color=000`,
        group: channel.group || "Sports",
        url: channel.url,
        protocol: channel.protocol || (isEmbedUrl(channel.url) ? "EMBED" : "HLS"),
        embedCode: channel.embedCode || null,
        userAgent: channel.userAgent || null,
        referrer: channel.referrer || null,
        updatedAt: serverTimestamp()
      };

      if (existingChannel && "id" in existingChannel && existingChannel.id && !existingChannel.id.startsWith("local-")) {
        if (existingChannel.url !== channel.url || existingChannel.logo !== channel.logo || existingChannel.group !== channel.group || existingChannel.userAgent !== channel.userAgent || existingChannel.referrer !== channel.referrer) {
          await updateDoc(doc(db, "channels", existingChannel.id), payload);
        }
        return existingChannel.id;
      }
      
      const docRef = await addDoc(collection(db, "channels"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error saving channel to Firestore:", error);
      return null;
    }
  };

  const saveTeamToFirestore = async (teamName: string, teamLogo: string, domain?: string, category?: string) => {
    try {
      const sanitizedName = teamName?.trim();
      const sanitizedLogo = teamLogo?.trim() || "";
      if (!sanitizedName) return null;

      upsertLocalTeam(sanitizedName, sanitizedLogo, category);

      const existingTeam = [...firestoreTeams, ...localCustomTeams].find(t => t.name.toLowerCase() === sanitizedName.toLowerCase());
      if (existingTeam && "id" in existingTeam && existingTeam.id && !existingTeam.id.startsWith("local-")) {
        if (existingTeam.logo !== sanitizedLogo || existingTeam.category !== category || existingTeam.domain !== domain) {
          await updateDoc(doc(db, "teams", existingTeam.id), {
            logo: sanitizedLogo,
            domain: domain || null,
            category: category || null,
            updatedAt: serverTimestamp()
          });
        }
        return existingTeam.id;
      }
      
      const docRef = await addDoc(collection(db, "teams"), {
        name: sanitizedName,
        logo: sanitizedLogo,
        domain: domain || null,
        category: category || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error saving team to Firestore:", error);
      return null;
    }
  };

  const handleAddChannel = () => {
    setFormData(prev => ({
      ...prev,
      channels: [...prev.channels, { name: "", url: "" }]
    }));
  };

  const handleSyncCricHD = async () => {
    setIsSyncing(true);
    setShowSyncWindow(true);
    try {
      const res = await fetch("/api/sync-crichd");
      const data = await res.json();
      setDiscoveredMatches(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Sync failed", e);
      setDiscoveredMatches([]);
    } finally {
      setIsSyncing(false);
    }
  };

  const importDiscoveredMatch = (match: any) => {
    const cat = match.category?.toLowerCase() || 'football';
    let displayTime = "";
    try {
      displayTime = new Date(match.startTime).toISOString().slice(0, 16);
    } catch {
      displayTime = new Date().toISOString().slice(0, 16);
    }
    
    const channelList = match.channels && match.channels.length > 0 && match.channels.some((c: any) => c.url)
      ? match.channels 
      : [];

    const generatedDesc = generateMatchDescription({
      team1: match.team1,
      team2: match.team2,
      category: cat,
      tournament: match.tournament || match.category?.toUpperCase() || "",
      league: match.tournament || "",
      startTime: displayTime,
      status: match.status || 'upcoming',
      channels: channelList
    });
    const generatedMetaDesc = generateMatchMetaDescription({
      team1: match.team1,
      team2: match.team2,
      category: cat,
      tournament: match.tournament || "",
      league: match.tournament || "",
      startTime: displayTime,
      status: match.status || 'upcoming'
    });

    setFormData({
      ...formData,
      team1: match.team1,
      team2: match.team2,
      category: cat,
      tournament: match.tournament || match.category?.toUpperCase() || "",
      tournamentLogo: match.tournamentLogo || "",
      league: match.tournament || "",
      leagueLogo: match.tournamentLogo || "",
      eventName: "",
      startTime: displayTime,
      status: match.status || 'upcoming',
      description: generatedDesc,
      metaDescription: generatedMetaDesc,
      channels: channelList
    });
    
    setTeam1Search(match.team1);
    setTeam2Search(match.team2);
    setLeagueSearch(match.tournament || "");
    
    setShowSyncWindow(false);
    setIsAdding(true);
    setActiveTab("matches");
  };

  const handleImportAllLive = async () => {
    const liveMatches = discoveredMatches.filter(m => m.status === 'live');
    if (liveMatches.length === 0) return alert("No live matches found to import.");
    
    setIsSyncing(true);
    try {
      for (const m of liveMatches) {
        const cat = m.category?.toLowerCase() || 'football';
        const leagueName = m.tournament || m.category?.toUpperCase() || 'Live Sport';
        const finalChannels = (m.channels && m.channels.length > 0 && m.channels.some((c: any) => c.url))
          ? m.channels
          : [];

        const desc = generateMatchDescription({
          team1: m.team1,
          team2: m.team2,
          category: cat,
          tournament: leagueName,
          league: leagueName,
          startTime: m.startTime,
          status: 'live',
          channels: finalChannels
        });
        const metaDesc = generateMatchMetaDescription({
          team1: m.team1,
          team2: m.team2,
          category: cat,
          tournament: leagueName,
          league: leagueName,
          startTime: m.startTime,
          status: 'live'
        });
        const keywords = generateMatchKeywords({
          team1: m.team1,
          team2: m.team2,
          category: cat,
          tournament: leagueName,
          league: leagueName
        });

        await addDoc(collection(db, "matches"), {
          team1: m.team1,
          team1Logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.team1)}&background=random&color=fff`,
          team2: m.team2,
          team2Logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.team2)}&background=random&color=fff`,
          category: cat,
          tournament: leagueName,
          tournamentLogo: m.tournamentLogo || null,
          league: leagueName,
          leagueLogo: m.tournamentLogo || null,
          startTime: new Date(m.startTime).toISOString(),
          status: 'live',
          description: desc,
          metaDescription: metaDesc,
          keywords: keywords,
          channels: finalChannels,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setShowSyncWindow(false);
    } catch (e) {
       console.error("Batch import failed", e);
    } finally {
       setIsSyncing(false);
    }
  };

  const handleRemoveChannel = (index: number) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.filter((_, i) => i !== index)
    }));
    setAutoDetectedChannels(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const checkAndAutoFillChannel = (index: number, urlValue: string) => {
    if (!urlValue || !urlValue.trim()) return null;
    const found = findChannelInfoByUrl(urlValue, {
      firestoreChannels,
      localChannels: localCustomChannels,
      matches,
      availableChannels
    });

    if (found) {
      setAutoDetectedChannels(prev => ({
        ...prev,
        [index]: {
          name: found.name,
          sourceLabel: found.sourceLabel,
          matchedUrl: found.matchedUrl
        }
      }));
      return found;
    } else {
      setAutoDetectedChannels(prev => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
    }
    return null;
  };

  const handleChannelChange = (index: number, field: keyof MatchChannel, value: string) => {
    const newChannels = [...formData.channels];
    const currentChan = { ...(newChannels[index] || { name: "", url: "" }), [field]: value };

    // 1. If admin is editing the Stream URL or Embed Code:
    if (field === 'url') {
      const urlTrimmed = value.trim();
      if (isIframeHtml(urlTrimmed)) {
        const extracted = extractIframeSrc(urlTrimmed);
        currentChan.url = extracted;
        currentChan.protocol = 'EMBED';
        currentChan.embedCode = stripSandbox(urlTrimmed);
        const all = extractAllIframes(urlTrimmed);
        if (
          !currentChan.name || 
          currentChan.name.trim() === "" || 
          currentChan.name === "Main Stream" || 
          currentChan.name === "Server 1" ||
          currentChan.name.startsWith("Server ") ||
          currentChan.name === "Channel"
        ) {
          currentChan.name = all[0]?.name || `Iframe Player ${index + 1}`;
        }
      } else if (urlTrimmed) {
        if (isEmbedUrl(urlTrimmed)) {
          currentChan.protocol = 'EMBED';
        }
        const found = checkAndAutoFillChannel(index, urlTrimmed);
        if (found) {
          // Auto-fill channel name if empty or generic placeholder
          if (
            !currentChan.name || 
            currentChan.name.trim() === "" || 
            currentChan.name === "Main Stream" || 
            currentChan.name === "Server 1" ||
            currentChan.name.startsWith("Server ") ||
            currentChan.name === "Channel"
          ) {
            currentChan.name = found.name;
          }
          // Auto-fill custom headers from database if available
          if (!currentChan.userAgent && found.userAgent) {
            currentChan.userAgent = found.userAgent;
          }
          if (!currentChan.referrer && found.referrer) {
            currentChan.referrer = found.referrer;
          }
        }
      } else {
        setAutoDetectedChannels(prev => {
          const copy = { ...prev };
          delete copy[index];
          return copy;
        });
      }
    }

    // 2. If admin accidentally typed or pasted a stream URL or iframe HTML into the channel name field:
    if (field === 'name') {
      if (isIframeHtml(value)) {
        const extracted = extractIframeSrc(value);
        currentChan.url = extracted;
        currentChan.protocol = 'EMBED';
        currentChan.embedCode = stripSandbox(value);
        const all = extractAllIframes(value);
        currentChan.name = all[0]?.name || `Iframe Player ${index + 1}`;
      } else if (isLikelyStreamUrl(value)) {
        const streamUrl = value.trim();
        currentChan.url = streamUrl;
        if (isEmbedUrl(streamUrl)) {
          currentChan.protocol = 'EMBED';
        }
        const found = checkAndAutoFillChannel(index, streamUrl);
        currentChan.name = found?.name || `Server ${index + 1}`;
        if (!currentChan.userAgent && found?.userAgent) currentChan.userAgent = found.userAgent;
        if (!currentChan.referrer && found?.referrer) currentChan.referrer = found.referrer;
      }
    }

    newChannels[index] = currentChan;
    setFormData(prev => ({ ...prev, channels: newChannels }));
  };

  const forceAutoFillChannelName = (index: number) => {
    const chan = formData.channels[index];
    if (!chan || !chan.url) return;
    const found = checkAndAutoFillChannel(index, chan.url);
    if (found) {
      const newChannels = [...formData.channels];
      newChannels[index] = {
        ...newChannels[index],
        name: found.name,
        userAgent: newChannels[index].userAgent || found.userAgent,
        referrer: newChannels[index].referrer || found.referrer
      };
      setFormData(prev => ({ ...prev, channels: newChannels }));
    }
  };

  const selectChannel = async (index: number, channel: Channel) => {
    const newChannels = [...formData.channels];
    newChannels[index] = {
      name: channel.name,
      url: channel.url,
      userAgent: channel.userAgent,
      referrer: channel.referrer
    };
    setFormData(prev => ({ ...prev, channels: newChannels }));
    upsertLocalChannel({ ...channel, id: channel.id || `local-channel-${Date.now()}` });
    await saveChannelToFirestore({ ...channel, id: channel.id || `local-channel-${Date.now()}` });
    setChannelSearch("");
    setActiveSearchIndex(null);
  };

  const selectLeague = (league: { name: string; logo: string; category?: string }) => {
    setFormData(prev => ({
      ...prev,
      tournament: league.name,
      league: league.name,
      tournamentLogo: league.logo,
      leagueLogo: league.logo,
      category: league.category || prev.category
    }));
    setLeagueSearch(league.name);
    setShowLeagueSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let currentData = formData;
      if (matchFormMode === "json") {
        try {
          const parsed = JSON.parse(matchJsonText);
          if (!parsed.team1 || !parsed.team2) {
            alert("Match JSON must include 'team1' and 'team2'.");
            return;
          }
          currentData = {
            ...formData,
            ...parsed,
            channels: Array.isArray(parsed.channels) ? parsed.channels : formData.channels
          };
        } catch (jsonErr: any) {
          alert(`Invalid Match JSON Syntax: ${jsonErr.message}`);
          return;
        }
      }

      // 1. Save Teams
      upsertLocalTeam(currentData.team1, currentData.team1Logo, currentData.category);
      await saveTeamToFirestore(currentData.team1, currentData.team1Logo, undefined, currentData.category);
      upsertLocalTeam(currentData.team2, currentData.team2Logo, currentData.category);
      await saveTeamToFirestore(currentData.team2, currentData.team2Logo, undefined, currentData.category);
      
      // 2. Save / Update League and Logo link in database
      const leagueName = currentData.league?.trim() || currentData.tournament?.trim();
      const leagueLogo = currentData.leagueLogo?.trim() || currentData.tournamentLogo?.trim();
      if (leagueName) {
        await saveLeagueToFirestore(leagueName, leagueLogo || "", currentData.category);
      }

      // 3. Save Channels
      try {
        for (const channel of currentData.channels) {
          if (channel.name && channel.url) {
            await saveChannelToFirestore({
              id: '',
              name: channel.name,
              logo: '',
              group: currentData.category,
              url: channel.url,
              userAgent: channel.userAgent,
              referrer: channel.referrer
            });
          }
        }
      } catch (channelError) {
        console.warn("Channel save notice:", channelError);
      }
      
      const computedDuration = currentData.durationMinutes || currentData.autoEndMinutes || 115;
      let calculatedAutoEndAt: string | null = null;
      if (currentData.endTime) {
        calculatedAutoEndAt = new Date(currentData.endTime).toISOString();
      } else if (currentData.autoEndAt) {
        calculatedAutoEndAt = new Date(currentData.autoEndAt).toISOString();
      } else if (currentData.autoEndEnabled && currentData.startTime) {
        const startMs = new Date(currentData.startTime).getTime();
        if (!isNaN(startMs)) {
          calculatedAutoEndAt = new Date(startMs + computedDuration * 60 * 1000).toISOString();
        }
      }

      const matchForMeta = {
        team1: currentData.team1,
        team2: currentData.team2,
        category: currentData.category,
        tournament: leagueName || "",
        league: leagueName || "",
        eventName: currentData.eventName || "",
        startTime: currentData.startTime,
        status: currentData.status,
        channels: currentData.channels
      };

      const autoGeneratedDesc = generateMatchDescription(matchForMeta);
      const autoGeneratedMetaDesc = generateMatchMetaDescription(matchForMeta);
      const autoGeneratedKeywords = generateMatchKeywords(matchForMeta);

      const finalDescription = currentData.description?.trim() || autoGeneratedDesc;
      const finalMetaDescription = currentData.metaDescription?.trim() || autoGeneratedMetaDesc;

      const matchSlug = sanitizeSlug(currentData.slug) || generateMatchSlug(currentData.team1, currentData.team2);
      const matchShortUrl = formatMatchShortUrl(matchSlug);

      const payload = {
        team1: currentData.team1.trim(),
        team1Logo: currentData.team1Logo.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentData.team1)}&background=random&color=fff`,
        team2: currentData.team2.trim(),
        team2Logo: currentData.team2Logo.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentData.team2)}&background=random&color=fff`,
        slug: matchSlug,
        shortUrl: matchShortUrl,
        category: currentData.category,
        tournament: leagueName || null,
        tournamentLogo: leagueLogo || null,
        league: leagueName || null,
        leagueLogo: leagueLogo || null,
        eventName: currentData.eventName?.trim() || null,
        status: currentData.status,
        description: finalDescription,
        metaDescription: finalMetaDescription,
        keywords: autoGeneratedKeywords,
        startTime: new Date(currentData.startTime || Date.now()).toISOString(),
        endTime: currentData.endTime ? new Date(currentData.endTime).toISOString() : calculatedAutoEndAt,
        durationMinutes: computedDuration,
        autoEndMinutes: computedDuration,
        autoEndAt: calculatedAutoEndAt,
        autoEndEnabled: currentData.autoEndEnabled,
        channels: currentData.channels.filter(c => c.url?.trim()),
        updatedAt: serverTimestamp(),
      };
      
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, value]) => value !== undefined)
      );

      if (editingId) {
        await updateDoc(doc(db, "matches", editingId), cleanPayload);
      } else {
        await addDoc(collection(db, "matches"), {
          ...cleanPayload,
          createdAt: serverTimestamp(),
        });
      }

      setIsAdding(false);
      setEditingId(null);
      setFormData({
        team1: "",
        team1Logo: "",
        team2: "",
        team2Logo: "",
        category: "football",
        tournament: "",
        tournamentLogo: "",
        league: "",
        leagueLogo: "",
        eventName: "",
        startTime: "",
        endTime: "",
        durationMinutes: 115,
        autoEndMinutes: 115,
        autoEndAt: "",
        autoEndEnabled: true,
        status: "live",
        description: "",
        metaDescription: "",
        slug: "",
        channels: [{ name: "Main Stream", url: "" }]
      });
      setLeagueSearch("");
    } catch (error: any) {
      console.error("Error saving match:", error);
      alert(`Error saving match: ${error?.message || "Check permissions"}`);
    }
  };

  const handleEdit = (match: Match) => {
    let localStartDate = "";
    let localEndDate = "";
    try {
      const date = new Date(match.startTime);
      localStartDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    } catch {
      localStartDate = new Date().toISOString().slice(0, 16);
    }

    if (match.endTime || match.autoEndAt) {
      try {
        const date = new Date(match.endTime || match.autoEndAt || "");
        localEndDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      } catch {
        localEndDate = "";
      }
    }

    const editDesc = match.description || generateMatchDescription(match);
    const editMetaDesc = match.metaDescription || generateMatchMetaDescription(match);

    setFormData({
      team1: match.team1,
      team1Logo: match.team1Logo,
      team2: match.team2,
      team2Logo: match.team2Logo,
      category: match.category || "football",
      tournament: match.tournament || match.league || "",
      tournamentLogo: match.tournamentLogo || match.leagueLogo || "",
      league: match.league || match.tournament || "",
      leagueLogo: match.leagueLogo || match.tournamentLogo || "",
      eventName: match.eventName || "",
      startTime: localStartDate,
      endTime: localEndDate,
      durationMinutes: match.durationMinutes || match.autoEndMinutes || 115,
      autoEndMinutes: match.autoEndMinutes || match.durationMinutes || 115,
      autoEndAt: match.autoEndAt || "",
      autoEndEnabled: match.autoEndEnabled ?? true,
      status: match.status,
      description: editDesc,
      metaDescription: editMetaDesc,
      slug: match.slug || generateMatchSlug(match.team1, match.team2),
      channels: match.channels && match.channels.length > 0 ? match.channels : [{ name: "Main Stream", url: "" }]
    });
    setMatchJsonText(JSON.stringify(match, null, 2));
    setMatchJsonError(null);
    setMatchFormMode("visual");
    setLeagueSearch(match.league || match.tournament || "");
    setEditingId(match.id);
    setIsAdding(true);
    setActiveTab("matches");
  };

  const handleEndMatchNow = async (matchId: string) => {
    try {
      await updateDoc(doc(db, "matches", matchId), {
        status: "ended",
        autoEndAt: new Date().toISOString(),
        endTime: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error ending match:", error);
      alert("Error ending match. Check permissions.");
    }
  };

  const handleExtendMatchTimer = async (match: Match, additionalMinutes: number) => {
    try {
      const dynamic = getMatchDynamicStatus(match, Date.now());
      const baseMs = dynamic.isLive && dynamic.endMs > Date.now() ? dynamic.endMs : Date.now();
      const newEndMs = baseMs + additionalMinutes * 60 * 1000;
      const newEndIso = new Date(newEndMs).toISOString();

      await updateDoc(doc(db, "matches", match.id), {
        status: "live",
        endTime: newEndIso,
        autoEndAt: newEndIso,
        durationMinutes: Math.round((newEndMs - new Date(match.startTime).getTime()) / 60000),
        autoEndMinutes: Math.round((newEndMs - new Date(match.startTime).getTime()) / 60000),
        updatedAt: serverTimestamp()
      });
      setExtendTimerModalMatch(null);
    } catch (error) {
      console.error("Error extending match timer:", error);
      alert("Error extending timer. Check permissions.");
    }
  };

  const handleStartLiveNowWithTimer = async (match: Match, durationMinutes: number = 115) => {
    try {
      const now = new Date();
      const end = new Date(now.getTime() + durationMinutes * 60 * 1000);
      await updateDoc(doc(db, "matches", match.id), {
        status: "live",
        startTime: now.toISOString(),
        endTime: end.toISOString(),
        autoEndAt: end.toISOString(),
        durationMinutes,
        autoEndMinutes: durationMinutes,
        autoEndEnabled: true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error starting match live:", error);
    }
  };

  const handleReactivateMatch = async (match: Match) => {
    try {
      const now = new Date();
      const sportInfo = getSportMatchInfo(match.category, match.tournament || match.league);
      const end = new Date(now.getTime() + sportInfo.durationMs);
      await updateDoc(doc(db, "matches", match.id), {
        status: "live",
        startTime: now.toISOString(),
        endTime: end.toISOString(),
        autoEndAt: end.toISOString(),
        durationMinutes: sportInfo.durationMinutes,
        autoEndMinutes: sportInfo.durationMinutes,
        autoEndEnabled: true,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error reactivating match:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this match?")) {
      try {
        await deleteDoc(doc(db, "matches", id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `matches/${id}`);
      }
    }
  };

  // Standalone League Manager save handler
  const handleSaveStandaloneLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;
    setIsSavingLeague(true);
    try {
      await saveLeagueToFirestore(newLeagueName, newLeagueLogo, newLeagueCategory);
      setNewLeagueName("");
      setNewLeagueLogo("");
      setEditingLeagueId(null);
    } catch (error) {
      console.error("Failed to save league", error);
      alert("Error saving league. Check permissions.");
    } finally {
      setIsSavingLeague(false);
    }
  };

  const handleDeleteLeague = async (id: string) => {
    if (confirm("Remove this league from database?")) {
      try {
        await deleteDoc(doc(db, "leagues", id));
      } catch (error) {
        console.error("Error deleting league:", error);
      }
    }
  };

  // Quick Channel Editor for any match (Upcoming or Live)
  const handleQuickChannelChange = (index: number, field: keyof MatchChannel, value: string) => {
    const list = [...quickChannelsList];
    const current = { ...(list[index] || { name: "", url: "" }), [field]: value };

    if (field === "url") {
      const trimmed = value.trim();
      if (isIframeHtml(trimmed)) {
        const extracted = extractIframeSrc(trimmed);
        current.url = extracted;
        current.protocol = 'EMBED';
        current.embedCode = stripSandbox(trimmed);
        const all = extractAllIframes(trimmed);
        if (!current.name || current.name === "Main Stream" || current.name.startsWith("Server ")) {
          current.name = all[0]?.name || `Iframe Player ${index + 1}`;
        }
      } else if (trimmed) {
        current.url = trimmed;
        if (isEmbedUrl(trimmed)) {
          current.protocol = 'EMBED';
        }
        const found = findChannelInfoByUrl(trimmed, {
          firestoreChannels,
          localChannels: localCustomChannels,
          matches,
          availableChannels
        });
        if (found) {
          setQuickChannelDetected(prev => ({
            ...prev,
            [index]: { name: found.name, sourceLabel: found.sourceLabel }
          }));
          if (
            !current.name ||
            current.name.trim() === "" ||
            current.name === "Main Stream" ||
            current.name.startsWith("Server ")
          ) {
            current.name = found.name;
          }
          if (!current.userAgent && found.userAgent) current.userAgent = found.userAgent;
          if (!current.referrer && found.referrer) current.referrer = found.referrer;
        } else {
          setQuickChannelDetected(prev => {
            const copy = { ...prev };
            delete copy[index];
            return copy;
          });
        }
      } else {
        setQuickChannelDetected(prev => {
          const copy = { ...prev };
          delete copy[index];
          return copy;
        });
      }
    }

    if (field === "name") {
      if (isIframeHtml(value)) {
        const extracted = extractIframeSrc(value);
        current.url = extracted;
        current.protocol = 'EMBED';
        current.embedCode = stripSandbox(value);
        const all = extractAllIframes(value);
        current.name = all[0]?.name || `Iframe Player ${index + 1}`;
      } else if (isLikelyStreamUrl(value)) {
        const streamUrl = value.trim();
        current.url = streamUrl;
        if (isEmbedUrl(streamUrl)) {
          current.protocol = 'EMBED';
        }
        const found = findChannelInfoByUrl(streamUrl, {
          firestoreChannels,
          localChannels: localCustomChannels,
          matches,
          availableChannels
        });
        current.name = found?.name || `Server ${index + 1}`;
        if (!current.userAgent && found?.userAgent) current.userAgent = found.userAgent;
        if (!current.referrer && found?.referrer) current.referrer = found.referrer;
      }
    }

    list[index] = current;
    setQuickChannelsList(list);
  };

  const handleAddQuickChannelRow = () => {
    setQuickChannelsList(prev => [...prev, { name: `Server ${prev.length + 1}`, url: "" }]);
  };

  const handleRemoveQuickChannelRow = (index: number) => {
    setQuickChannelsList(prev => prev.filter((_, i) => i !== index));
    setQuickChannelDetected(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const handleAutoFillQuickChannels = () => {
    alert("Notice: Auto-generation of demo streams is disabled. Only sources uploaded or pasted by admin will be broadcast to users.");
  };

  const [isBulkLinking, setIsBulkLinking] = useState(false);

  const handleAutoLinkAllMatchesChannels = async () => {
    if (matches.length === 0) {
      alert("No matches found in database.");
      return;
    }
    alert("Notice: Bulk demo stream generation is disabled. Only stream sources uploaded by admin are shown to users.");
  };

  const handleSeedSportsEvents = async () => {
    setIsSavingQuickChannels(true);
    try {
      const now = Date.now();
      const sampleEvents: any[] = [
        {
          team1: "India",
          team2: "Australia",
          category: "cricket_t20",
          tournament: "T20 International Series",
          league: "ICC Men's T20I",
          status: "live",
          startTime: new Date(now - 25 * 60000).toISOString(),
          team1Logo: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=200&q=80",
          team2Logo: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=200&q=80",
          channels: []
        },
        {
          team1: "England",
          team2: "South Africa",
          category: "cricket_odi",
          tournament: "ODI World Cup Clash",
          league: "ICC ODI Super League",
          status: "upcoming",
          startTime: new Date(now + 120 * 60000).toISOString(),
          team1Logo: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=200&q=80",
          team2Logo: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=200&q=80",
          channels: []
        },
        {
          team1: "Red Bull Racing",
          team2: "Scuderia Ferrari",
          category: "motorsport",
          tournament: "Formula 1 Grand Prix 2026",
          league: "FIA Formula One",
          status: "upcoming",
          startTime: new Date(now + 180 * 60000).toISOString(),
          channels: []
        },
        {
          team1: "Los Angeles Lakers",
          team2: "Boston Celtics",
          category: "basketball",
          tournament: "NBA Championship",
          league: "National Basketball Association",
          status: "upcoming",
          startTime: new Date(now + 240 * 60000).toISOString(),
          channels: []
        }
      ];

      for (const ev of sampleEvents) {
        await addDoc(collection(db, "matches"), {
          ...ev,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      alert("✨ Added Cricket T20, ODI, F1, and NBA live sporting events with working HD channels!");
    } catch (e: any) {
      console.error(e);
      alert(`Notice: ${e?.message || "Failed to seed"}`);
    } finally {
      setIsSavingQuickChannels(false);
    }
  };

  const handleEnrichMatch = async (matchToEnrich: Match) => {
    if (!matchToEnrich || !matchToEnrich.id) return;
    setIsEnrichingSingle(true);
    try {
      const details = getEnrichedMatchDetails(matchToEnrich);
      const payload: Record<string, any> = {
        score: details.score,
        scoreText: details.score.text,
        venue: details.venue,
        referee: details.referee,
        round: details.round,
        season: details.season,
        lineups: details.lineups,
        events: details.events,
        stats: details.stats,
        h2h: details.h2h,
        weather: details.weather,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, "matches", matchToEnrich.id), payload);
      
      const updatedMatch = {
        ...matchToEnrich,
        ...payload
      };
      setInspectorMatch(updatedMatch as Match);
      setMatches(prev => prev.map(m => m.id === matchToEnrich.id ? (updatedMatch as Match) : m));
    } catch (err: any) {
      console.error("Error enriching match:", err);
      alert(`Could not save enriched match details: ${err?.message || "Check permissions"}`);
    } finally {
      setIsEnrichingSingle(false);
    }
  };

  const handleEnrichAllMatches = async () => {
    if (matches.length === 0) {
      alert("No matches found in database.");
      return;
    }
    setIsEnrichingAll(true);
    let count = 0;
    try {
      for (const m of matches) {
        try {
          const details = getEnrichedMatchDetails(m);
          await updateDoc(doc(db, "matches", m.id), {
            score: details.score,
            scoreText: details.score.text,
            venue: details.venue,
            referee: details.referee,
            round: details.round,
            season: details.season,
            lineups: details.lineups,
            events: details.events,
            stats: details.stats,
            h2h: details.h2h,
            weather: details.weather,
            updatedAt: serverTimestamp()
          });
          count++;
        } catch (e) {
          console.warn(`Could not enrich match ${m.id}:`, e);
        }
      }
      alert(`✨ Successfully generated and stored full match details (squads, venues, stats, H2H, and live events) for ${count} matches!`);
    } catch (err: any) {
      console.error("Bulk enrich error:", err);
      alert(`Auto-enrich notice: ${err?.message || "Operation completed"}`);
    } finally {
      setIsEnrichingAll(false);
    }
  };

  const handleSaveQuickChannels = async () => {
    if (!quickChannelMatch) return;
    setIsSavingQuickChannels(true);
    try {
      const validChannels = quickChannelsList
        .filter(c => c.url && c.url.trim())
        .map(c => ({
          name: c.name?.trim() || "Main Stream",
          url: c.url.trim(),
          userAgent: c.userAgent?.trim() || null,
          referrer: c.referrer?.trim() || null
        }));

      const cleanChannels = validChannels.map(c => Object.fromEntries(
        Object.entries(c).filter(([_, v]) => v !== null && v !== undefined)
      )) as MatchChannel[];

      await updateDoc(doc(db, "matches", quickChannelMatch.id), {
        channels: cleanChannels,
        updatedAt: serverTimestamp()
      });

      // Also persist channels to global directory
      for (const chan of cleanChannels) {
        if (chan.url) {
          saveChannelToFirestore({
            name: chan.name,
            group: quickChannelMatch.category || "Sports",
            logo: quickChannelMatch.tournamentLogo || quickChannelMatch.leagueLogo || "",
            url: chan.url,
            userAgent: chan.userAgent,
            referrer: chan.referrer
          }).catch(() => {});
        }
      }

      setQuickChannelMatch(null);
      setQuickChannelsList([]);
    } catch (err: any) {
      console.error("Error saving quick channels:", err);
      alert(`Failed to save channels: ${err?.message || "Check permissions"}`);
    } finally {
      setIsSavingQuickChannels(false);
    }
  };

  // Standalone IPTV Channel handlers
  const handleIPTVUrlChange = (val: string) => {
    const trimmed = val.trim();
    if (isIframeHtml(trimmed)) {
      const extracted = extractIframeSrc(trimmed);
      setNewChannelUrl(extracted);
      const all = extractAllIframes(trimmed);
      if (all[0]?.name && (!newChannelName || newChannelName.trim() === "" || newChannelName === "Live Channel")) {
        setNewChannelName(all[0].name);
      }
      return;
    }
    setNewChannelUrl(val);
    if (trimmed) {
      const found = findChannelInfoByUrl(trimmed, {
        firestoreChannels,
        localChannels: localCustomChannels,
        matches,
        availableChannels
      });
      if (found) {
        setIptvAutoDetected({ name: found.name, sourceLabel: found.sourceLabel });
        if (!newChannelName || newChannelName.trim() === "" || newChannelName === "Live Channel") {
          setNewChannelName(found.name);
        }
        if (!newChannelLogo && found.logo) {
          setNewChannelLogo(found.logo);
        }
        if (found.group && (newChannelGroup === "Sports" || !newChannelGroup)) {
          setNewChannelGroup(found.group);
        }
        if (!newChannelUserAgent && found.userAgent) {
          setNewChannelUserAgent(found.userAgent);
          setShowAdvancedHeaders(true);
        }
        if (!newChannelReferrer && found.referrer) {
          setNewChannelReferrer(found.referrer);
          setShowAdvancedHeaders(true);
        }
      } else {
        setIptvAutoDetected(null);
      }
    } else {
      setIptvAutoDetected(null);
    }
  };

  const handleIPTVNameChange = (val: string) => {
    if (isIframeHtml(val)) {
      handleIPTVUrlChange(val);
    } else if (isLikelyStreamUrl(val)) {
      handleIPTVUrlChange(val);
    } else {
      setNewChannelName(val);
    }
  };

  const handleSaveStandaloneIPTVChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedName = newChannelName.trim();
    const rawUrl = newChannelUrl.trim();
    const sanitizedUrl = isIframeHtml(rawUrl) ? extractIframeSrc(rawUrl) : rawUrl;
    const sanitizedGroup = newChannelGroup.trim() || "Sports";
    const sanitizedLogo = newChannelLogo.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(sanitizedName)}&background=00f2fe&color=000`;
    const sanitizedUserAgent = newChannelUserAgent.trim() || null;
    const sanitizedReferrer = newChannelReferrer.trim() || null;
    const isEmbed = isIframeHtml(rawUrl) || isEmbedUrl(sanitizedUrl);

    if (!sanitizedName) {
      alert("Please enter a channel name.");
      return;
    }
    if (!sanitizedUrl) {
      alert("Please enter a stream URL (.m3u8 or iframe embed link).");
      return;
    }

    setIsSavingChannel(true);
    try {
      if (editingChannelId) {
        await updateDoc(doc(db, "channels", editingChannelId), {
          name: sanitizedName,
          group: sanitizedGroup,
          logo: sanitizedLogo,
          url: sanitizedUrl,
          protocol: isEmbed ? "EMBED" : "HLS",
          embedCode: isIframeHtml(rawUrl) ? stripSandbox(rawUrl) : null,
          userAgent: sanitizedUserAgent,
          referrer: sanitizedReferrer,
          updatedAt: serverTimestamp()
        });
        setFirestoreChannels(prev => prev.map(c => c.id === editingChannelId ? {
          ...c,
          name: sanitizedName,
          group: sanitizedGroup,
          logo: sanitizedLogo,
          url: sanitizedUrl,
          protocol: isEmbed ? "EMBED" : "HLS",
          embedCode: isIframeHtml(rawUrl) ? stripSandbox(rawUrl) : undefined,
          userAgent: sanitizedUserAgent || undefined,
          referrer: sanitizedReferrer || undefined
        } : c));
      } else {
        await saveChannelToFirestore({
          name: sanitizedName,
          group: sanitizedGroup,
          logo: sanitizedLogo,
          url: sanitizedUrl,
          protocol: isEmbed ? "EMBED" : "HLS",
          embedCode: isIframeHtml(rawUrl) ? stripSandbox(rawUrl) : undefined,
          userAgent: sanitizedUserAgent || undefined,
          referrer: sanitizedReferrer || undefined
        });
      }
      setNewChannelName("");
      setNewChannelUrl("");
      setNewChannelLogo("");
      setNewChannelUserAgent("");
      setNewChannelReferrer("");
      setEditingChannelId(null);
      setShowAdvancedHeaders(false);
      setIptvAutoDetected(null);
    } catch (err: any) {
      console.error("Error saving standalone channel:", err);
      alert("Failed to save channel. Check database permissions.");
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleDeleteIPTVChannel = async (id: string) => {
    if (confirm("Are you sure you want to delete this IPTV channel from the database?")) {
      try {
        await deleteDoc(doc(db, "channels", id));
      } catch (error) {
        console.error("Error deleting IPTV channel:", error);
        alert("Could not delete channel. Check permissions.");
      }
    }
  };

  const handleEditIPTVChannel = (channel: Channel) => {
    setNewChannelName(channel.name);
    setNewChannelGroup(channel.group || "Sports");
    setNewChannelLogo(channel.logo || "");
    setNewChannelUrl(channel.url);
    setNewChannelUserAgent(channel.userAgent || "");
    setNewChannelReferrer(channel.referrer || "");
    setEditingChannelId(channel.id && !channel.id.startsWith("preset-") ? channel.id : null);
    if (channel.userAgent || channel.referrer) {
      setShowAdvancedHeaders(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClonePresetToDatabase = async (preset: Channel) => {
    setNewChannelName(preset.name);
    setNewChannelGroup(preset.group || "Sports");
    setNewChannelLogo(preset.logo || "");
    setNewChannelUrl(preset.url);
    setNewChannelUserAgent(preset.userAgent || "");
    setNewChannelReferrer(preset.referrer || "");
    setEditingChannelId(null);
    if (preset.userAgent || preset.referrer) {
      setShowAdvancedHeaders(true);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login popup failed:", err);
      let message = err.message || "Failed to sign in with Google";
      if (err.code === "auth/unauthorized-domain") {
        message = `Unauthorized Domain: "${window.location.hostname}" is not yet registered in Firebase. In Firebase Console (Authentication > Settings > Authorized domains), add "${window.location.hostname}".`;
      } else if (err.code === "auth/popup-blocked") {
        message = "Popup was blocked by your browser. Attempting redirect sign-in...";
        try {
          await loginWithGoogleRedirect();
          return;
        } catch (redirErr: any) {
          message = redirErr.message || "Popup and redirect sign-in both failed.";
        }
      } else if (err.code === "auth/popup-closed-by-user") {
        message = "Sign-in popup was closed before completing.";
      }
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleRedirectLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await loginWithGoogleRedirect();
    } catch (err: any) {
      setLoginError(err.message || "Redirect sign-in failed.");
      setIsLoggingIn(false);
    }
  };

  const navigateBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = "/";
    }
  };

  // Filtered leagues for League Manager Tab
  const filteredManagerLeagues = useMemo(() => {
    return [...firestoreLeagues, ...POPULAR_LEAGUES.map(p => ({ id: `preset-${p.name}`, name: p.name, logo: p.logo, category: p.category }))].filter(l => {
      if (!leagueManagerSearch) return true;
      return l.name.toLowerCase().includes(leagueManagerSearch.toLowerCase()) || (l.category || "").toLowerCase().includes(leagueManagerSearch.toLowerCase());
    });
  }, [firestoreLeagues, leagueManagerSearch]);

  // Filtered IPTV Channels for IPTV Manager Tab
  const allIPTVChannelsList = useMemo(() => {
    const customNames = new Set(firestoreChannels.map(c => c.name.toLowerCase()));
    const remainingPresets = availableChannels.filter(c => !customNames.has(c.name.toLowerCase()));
    return [
      ...firestoreChannels,
      ...remainingPresets.map(p => ({ ...p, id: `preset-${p.name}` }))
    ];
  }, [firestoreChannels, availableChannels]);

  const filteredIPTVChannels = useMemo(() => {
    const q = iptvManagerSearch.trim().toLowerCase();
    return allIPTVChannelsList.filter(c => {
      if (iptvGroupFilter === "custom_only") {
        if (c.id?.startsWith("preset-")) return false;
      } else if (iptvGroupFilter !== "all") {
        if ((c.group || "General").toLowerCase() !== iptvGroupFilter.toLowerCase()) return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.group || "").toLowerCase().includes(q) ||
        (c.url || "").toLowerCase().includes(q)
      );
    });
  }, [allIPTVChannelsList, iptvManagerSearch, iptvGroupFilter]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#06080c]"><Loader2 className="animate-spin text-cyan-400" size={36} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#06080c] flex flex-col items-center justify-center p-6 relative">
        <button
          id="admin-login-back-btn"
          onClick={navigateBack}
          className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-bold transition-all"
        >
          <ChevronLeft size={16} /> Back to AR Stream
        </button>

        <div className="w-full max-w-md liquid-glass rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#080b12] border border-cyan-400/30 shadow-[0_0_25px_rgba(0,242,254,0.3)] flex items-center justify-center overflow-hidden mb-4">
            <img src="/logo.svg" alt="AR Stream" className="w-full h-full object-contain p-2" />
          </div>
          <div className="text-3xl font-black mb-2 flex items-center justify-center gap-2">
            <span className="text-white tracking-widest">AR STREAM</span>
            <span className="text-xs bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 px-2 py-1 rounded ml-2 uppercase tracking-widest font-black">ADMIN CONSOLE</span>
          </div>
          <p className="text-xs text-white/50 mb-8">Sign in with authorized administrator account</p>

          {loginError && (
            <div className="w-full mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertTriangle size={16} /> Sign-in Notice
              </div>
              <p className="leading-relaxed break-words">{loginError}</p>
            </div>
          )}

          <div className="w-full space-y-3">
            <button 
              id="admin-google-login-btn"
              disabled={isLoggingIn}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-bold hover:bg-zinc-200 transition-all shadow-xl active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 size={20} className="animate-spin text-black" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Login with Google (Popup)</span>
                </>
              )}
            </button>

            <button 
              id="admin-google-redirect-btn"
              disabled={isLoggingIn}
              onClick={handleGoogleRedirectLogin}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white px-4 py-3 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              Alternative: Sign in with Redirect
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 w-full text-left">
            <p className="text-[10px] text-white/40">Current Host: <span className="font-mono text-white/70">{window.location.hostname}</span></p>
          </div>
        </div>
      </div>
    );
  }

  if ((user.email || "").toLowerCase() !== "kcaarun10@gmail.com") {
    return (
      <div className="min-h-screen bg-[#06080c] flex items-center justify-center text-center p-6 relative">
        <button
          id="unauthorized-back-btn"
          onClick={navigateBack}
          className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-bold transition-all"
        >
          <ChevronLeft size={16} /> Back to AR Stream
        </button>

        <div className="w-full max-w-md liquid-glass rounded-3xl p-8">
          <h1 className="text-2xl font-black mb-2 text-red-400">Unauthorized Account</h1>
          <p className="text-xs text-white/50 mb-4">
            Logged in as <span className="text-white font-mono">{user.email}</span>
          </p>
          <p className="text-xs text-white/50 mb-8">
            You need administrative privileges (<span className="text-cyan-400">kcaarun10@gmail.com</span>) to access Match Manager.
          </p>
          <div className="flex gap-3 justify-center">
            <button 
              id="admin-logout-btn"
              onClick={() => auth.signOut()} 
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              Sign Out / Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080c] text-white pb-32 ambient-cinema-bg">
      <header className="p-4 sm:p-6 flex items-center justify-between sticky top-0 liquid-glass border-b border-white/10 z-50">
        <div className="flex items-center gap-3">
          <button
            id="admin-header-back-btn"
            onClick={navigateBack}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-xl text-white/80 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Back to App"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Trophy className="text-cyan-400" /> Admin Studio
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-bold">
            <button
              onClick={() => setActiveTab("matches")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "matches" ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"}`}
            >
              Matches ({matches.length})
            </button>
            <button
              onClick={() => setActiveTab("leagues")}
              className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === "leagues" ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"}`}
            >
              Leagues & Logos ({firestoreLeagues.length})
            </button>
            <button
              id="admin-tab-iptv-btn"
              onClick={() => setActiveTab("iptv")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activeTab === "iptv" ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"}`}
            >
              <Tv size={14} />
              <span>IPTV ({firestoreChannels.length})</span>
            </button>
            <button
              id="admin-tab-requests-btn"
              onClick={() => setActiveTab("requests")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "requests" 
                  ? "bg-cyan-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <MessageSquarePlus size={14} className={activeTab === "requests" ? "text-black" : "text-cyan-400"} />
              <span>Requests</span>
              {matchRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                  activeTab === "requests" ? "bg-black text-cyan-300" : "bg-cyan-400 text-black animate-pulse"
                }`}>
                  {matchRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              id="admin-tab-json-btn"
              onClick={() => setActiveTab("json")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "json" 
                  ? "bg-cyan-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <FileJson size={14} className={activeTab === "json" ? "text-black" : "text-cyan-400"} />
              <span>JSON Studio</span>
            </button>
            <button
              id="admin-tab-apisports-btn"
              onClick={() => setActiveTab("apisports")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "apisports" 
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black shadow-[0_0_15px_rgba(0,242,254,0.4)]" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Globe2 size={14} className={activeTab === "apisports" ? "text-black" : "text-cyan-400"} />
              <span>API-Sports Sync</span>
            </button>
            <button
              id="admin-tab-streamed-btn"
              onClick={() => setActiveTab("streamed")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "streamed" 
                  ? "bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-black shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <Radio size={14} className={activeTab === "streamed" ? "text-black animate-pulse" : "text-cyan-400"} />
              <span>Streamed.pk Live</span>
            </button>
            <button
              id="admin-tab-announcements-btn"
              onClick={() => setActiveTab("announcements")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "announcements" 
                  ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white font-black shadow-[0_0_15px_rgba(244,63,94,0.4)]" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <MegaphoneIcon size={14} className={activeTab === "announcements" ? "text-white" : "text-rose-400"} />
              <span>Announcements & Ads</span>
            </button>
          </div>

          <button 
            id="admin-sync-crichd-btn"
            onClick={handleSyncCricHD}
            className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-black hover:bg-white/10 transition-all"
          >
            <RotateCw size={14} className={isSyncing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">SYNC</span> CRICHD
          </button>
          <button 
            id="admin-header-signout-btn"
            onClick={() => auth.signOut()} 
            className="text-white/50 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {showSyncWindow && (
          <div className="mb-8 liquid-glass rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-4">
                 <h3 className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-2">
                   <Globe size={14} /> Discovered Matches ({discoveredMatches.length})
                 </h3>
                 {!isSyncing && discoveredMatches.some(m => m.status === 'live') && (
                   <button 
                     onClick={handleImportAllLive}
                     className="bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-[10px] font-black px-3 py-1 rounded-lg hover:bg-cyan-500/20 transition-all"
                   >
                     IMPORT ALL LIVE
                   </button>
                 )}
               </div>
               <button onClick={() => setShowSyncWindow(false)} className="text-white/40 hover:text-white">✕</button>
            </div>
            
            {isSyncing ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <Loader2 size={32} className="text-cyan-400 animate-spin" />
                <p className="text-xs font-bold text-white/40 animate-pulse">Scanning server schedule links...</p>
              </div>
            ) : discoveredMatches.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2 scrollbar-hide">
                  {discoveredMatches.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => importDiscoveredMatch(m)}
                      className={`p-4 border rounded-2xl text-left hover:border-cyan-400 hover:bg-cyan-500/10 transition-all group relative overflow-hidden ${m.status === 'live' ? 'bg-cyan-500/5 border-cyan-400/20' : 'bg-black/40 border-white/5'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-[10px] font-black text-white/40 group-hover:text-cyan-400 uppercase tracking-wider">{m.category || 'SPORT'}</div>
                        <div className={`text-[9px] font-black px-2 py-0.5 rounded-full ${m.status === 'live' ? 'bg-green-500 text-black animate-pulse' : 'bg-zinc-800 text-white/40'}`}>
                          {m.status?.toUpperCase()}
                        </div>
                      </div>
                      <div className="text-sm font-black text-white group-hover:text-cyan-400 transition-colors truncate pr-8">{m.team1} vs {m.team2}</div>
                      <div className="text-[10px] text-white/50 mt-2 flex items-center gap-2">
                         <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">{m.channels?.length || 0} CHANNELS</span>
                         <span className="truncate">{new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
               <div className="col-span-full py-12 text-center flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/5 mx-auto">
                    <Globe size={24} className="text-white/20" />
                  </div>
                  <p className="text-xs text-white/20 italic">No live matches found in current scan.</p>
               </div>
            )}
          </div>
        )}

        {/* TAB 1: MATCHES */}
        {activeTab === "matches" && (
          <div>
            {!isAdding ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <button 
                  onClick={() => setIsAdding(true)}
                  className="h-14 border-2 border-dashed border-cyan-400/40 bg-cyan-500/5 hover:bg-cyan-500/15 rounded-2xl flex items-center justify-center gap-2 text-cyan-300 hover:text-white transition-all shadow-lg hover:shadow-cyan-500/10 cursor-pointer text-xs font-black px-3"
                >
                  <Plus size={16} className="text-cyan-400" /> <span>Add Live Match</span>
                </button>
                <button 
                  onClick={handleAutoLinkAllMatchesChannels}
                  disabled={isBulkLinking}
                  className="h-14 border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 rounded-2xl flex items-center justify-center gap-2 text-emerald-300 hover:text-white transition-all shadow-lg cursor-pointer text-xs font-black px-3"
                  title="Automatically creates and links high-definition broadcast channels to all matches missing streams"
                >
                  <Tv size={16} className={isBulkLinking ? "animate-spin text-emerald-400" : "text-emerald-400"} />
                  <span>{isBulkLinking ? "Linking..." : "⚡ Auto-Link HD Channels"}</span>
                </button>
                <button 
                  onClick={handleEnrichAllMatches}
                  disabled={isEnrichingAll}
                  className="h-14 border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 rounded-2xl flex items-center justify-center gap-2 text-purple-300 hover:text-white transition-all shadow-lg cursor-pointer text-xs font-black px-3"
                  title="Auto-generates and updates full match intelligence (lineups, stats, live timeline, venue, and H2H) for all matches in the database"
                >
                  <Sparkles size={16} className={isEnrichingAll ? "animate-spin text-purple-400" : "text-purple-400"} />
                  <span>{isEnrichingAll ? "Enriching..." : "⚡ Auto-Enrich Full Details"}</span>
                </button>
                <button 
                  onClick={handleSeedSportsEvents}
                  className="h-14 border border-blue-500/30 bg-blue-950/20 hover:bg-blue-950/40 rounded-2xl flex items-center justify-center gap-2 text-blue-300 hover:text-white transition-all shadow-lg cursor-pointer text-xs font-black px-3"
                  title="Adds live Cricket T20, ODI, F1 Motorsport, and NBA events with active HD channels"
                >
                  <Trophy size={16} className="text-blue-400" />
                  <span>⚡ Add Top Sports</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} id="match-form" className="liquid-glass rounded-3xl p-6 mb-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-extrabold text-cyan-300 flex items-center gap-2">
                      <Sparkles size={18} /> {editingId ? "Edit Match Details" : "Create New Live Match"}
                    </h3>
                    <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setMatchFormMode("visual")}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          matchFormMode === "visual" ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
                        }`}
                      >
                        Visual Form
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMatchFormMode("json");
                          setMatchJsonText(JSON.stringify(formData, null, 2));
                          setMatchJsonError(null);
                        }}
                        className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                          matchFormMode === "json" ? "bg-cyan-500 text-black font-black" : "text-white/60 hover:text-white"
                        }`}
                      >
                        <Code2 size={13} />
                        <span>Write JSON</span>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(null);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all self-end sm:self-auto"
                  >
                    <X size={16} />
                  </button>
                </div>

                {matchFormMode === "json" ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-xs text-white/60 font-mono flex items-center gap-1.5">
                        <Terminal size={14} className="text-cyan-400" />
                        <span>Edit raw Match JSON code directly. Changes will be saved to Firestore on submit.</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(matchJsonText);
                              setMatchJsonText(JSON.stringify(parsed, null, 2));
                              setMatchJsonError(null);
                            } catch (e: any) {
                              setMatchJsonError(e.message);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-cyan-300 border border-cyan-400/30 flex items-center gap-1 transition-all"
                        >
                          <Braces size={12} /> Format Code
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const parsed = JSON.parse(matchJsonText);
                              setFormData(prev => ({ ...prev, ...parsed }));
                              setMatchFormMode("visual");
                              setMatchJsonError(null);
                            } catch (e: any) {
                              setMatchJsonError(e.message);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg text-xs font-bold text-cyan-300 border border-cyan-400/30 flex items-center gap-1 transition-all"
                        >
                          <Check size={12} /> Sync to Form
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#080d16] shadow-inner">
                      <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
                        <span>match_payload.json</span>
                        <span className="text-cyan-400 font-bold">{matchJsonText.length} characters</span>
                      </div>
                      <textarea
                        id="match-json-textarea"
                        value={matchJsonText}
                        onChange={(e) => {
                          setMatchJsonText(e.target.value);
                          try {
                            JSON.parse(e.target.value);
                            setMatchJsonError(null);
                          } catch (err: any) {
                            setMatchJsonError(err.message);
                          }
                        }}
                        rows={16}
                        spellCheck={false}
                        className="w-full p-4 bg-transparent font-mono text-xs sm:text-sm text-cyan-200/90 leading-6 focus:outline-none custom-scrollbar"
                      />
                    </div>

                    {matchJsonError && (
                      <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-2 text-xs text-red-300 font-mono">
                        <AlertTriangle size={14} className="shrink-0 text-red-400" />
                        <span>JSON Syntax Error: {matchJsonError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                {/* Team 1 Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="space-y-2 relative">
                    <label htmlFor="team1-name" className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                      Team 1 Name
                    </label>
                    <input 
                      required
                      id="team1-name"
                      name="team1-name"
                      placeholder="e.g. Real Madrid / India / Max Verstappen"
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:border-cyan-400/50 outline-none transition-all font-semibold"
                      value={formData.team1}
                      onFocus={() => {
                        setShowTeam1Suggestions(true);
                        setTeam1Search(formData.team1);
                      }}
                      onBlur={() => setTimeout(() => setShowTeam1Suggestions(false), 250)}
                      onChange={e => {
                        setFormData({...formData, team1: e.target.value});
                        setTeam1Search(e.target.value);
                      }}
                    />
                    {showTeam1Suggestions && (combinedTeam1Suggestions.length > 0 || isSearchingTeam1) && (
                      <div className="absolute top-full left-0 right-0 mt-2 liquid-glass rounded-xl shadow-2xl z-[100] max-h-64 overflow-y-auto">
                        {isSearchingTeam1 && <div className="p-3 flex items-center gap-2 text-xs text-white/50"><Loader2 size={12} className="animate-spin" /> Searching teams...</div>}
                        {combinedTeam1Suggestions.map((t, i) => {
                          const logoUrl = t.logo || (t.domain ? `https://logo.clearbit.com/${t.domain}` : `https://www.google.com/s2/favicons?domain=${t.domain || t.name.replace(/\s+/g, '').toLowerCase() + '.com'}&sz=128`);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, team1: t.name, team1Logo: logoUrl });
                                upsertLocalTeam(t.name, logoUrl, formData.category);
                                saveTeamToFirestore(t.name, logoUrl, t.domain, formData.category);
                                setShowTeam1Suggestions(false);
                              }}
                              className="w-full p-3 flex items-center gap-3 hover:bg-white/10 border-b border-white/5 text-left text-xs transition-colors"
                            >
                              <div className="w-8 h-8 flex-shrink-0 bg-white/5 rounded-lg border border-white/5 p-1 flex items-center justify-center">
                                {logoUrl ? (
                                  <img 
                                    src={logoUrl} 
                                    className="w-full h-full object-contain" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => (e.currentTarget.src = "https://i.imgur.com/3XIe0au.png")}
                                  />
                                ) : (
                                  <span className="text-[10px] font-black text-cyan-300">{t.name.slice(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <span className="font-bold block truncate">{t.name}</span>
                                 {t.domain && <span className="text-[10px] text-white/50 block truncate">{t.domain}</span>}
                              </div>
                              {POPULAR_TEAMS.some(pt => pt.name === t.name) && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-black">PRESET</span>}
                              {firestoreTeams.some(ft => ft.name === t.name) && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-black">DB</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="team1-logo" className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Team 1 Logo URL</label>
                    <div className="flex gap-2">
                      <input 
                        required
                        id="team1-logo"
                        name="team1-logo"
                        placeholder="https://.../logo.png"
                        className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-cyan-200/90 focus:border-cyan-400/50 outline-none transition-all"
                        value={formData.team1Logo}
                        onChange={e => setFormData({...formData, team1Logo: e.target.value})}
                      />
                      {formData.team1Logo?.trim() ? (
                        <div className="w-11 h-11 rounded-xl bg-black/60 border border-white/10 p-1.5 flex items-center justify-center shrink-0">
                          <img src={formData.team1Logo.trim()} alt="Team 1" className="w-full h-full object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Team 2 Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="space-y-2 relative">
                    <label htmlFor="team2-name" className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                      Team 2 Name
                    </label>
                    <input 
                      required
                      id="team2-name"
                      name="team2-name"
                      placeholder="e.g. Barcelona / England / Lewis Hamilton"
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm focus:border-cyan-400/50 outline-none transition-all font-semibold"
                      value={formData.team2}
                      onFocus={() => {
                        setShowTeam2Suggestions(true);
                        setTeam2Search(formData.team2);
                      }}
                      onBlur={() => setTimeout(() => setShowTeam2Suggestions(false), 250)}
                      onChange={e => {
                        setFormData({...formData, team2: e.target.value});
                        setTeam2Search(e.target.value);
                      }}
                    />
                    {showTeam2Suggestions && (combinedTeam2Suggestions.length > 0 || isSearchingTeam2) && (
                      <div className="absolute top-full left-0 right-0 mt-2 liquid-glass rounded-xl shadow-2xl z-[100] max-h-64 overflow-y-auto">
                        {isSearchingTeam2 && <div className="p-3 flex items-center gap-2 text-xs text-white/50"><Loader2 size={12} className="animate-spin" /> Searching teams...</div>}
                        {combinedTeam2Suggestions.map((t, i) => {
                          const logoUrl = t.logo || (t.domain ? `https://logo.clearbit.com/${t.domain}` : `https://www.google.com/s2/favicons?domain=${t.domain || t.name.replace(/\s+/g, '').toLowerCase() + '.com'}&sz=128`);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, team2: t.name, team2Logo: logoUrl });
                                upsertLocalTeam(t.name, logoUrl, formData.category);
                                saveTeamToFirestore(t.name, logoUrl, t.domain, formData.category);
                                setShowTeam2Suggestions(false);
                              }}
                              className="w-full p-3 flex items-center gap-3 hover:bg-white/10 border-b border-white/5 text-left text-xs transition-colors"
                            >
                              <div className="w-8 h-8 flex-shrink-0 bg-white/5 rounded-lg border border-white/5 p-1 flex items-center justify-center">
                                {logoUrl ? (
                                  <img 
                                    src={logoUrl} 
                                    className="w-full h-full object-contain" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => (e.currentTarget.src = "https://i.imgur.com/3XIe0au.png")}
                                  />
                                ) : (
                                  <span className="text-[10px] font-black text-cyan-300">{t.name.slice(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <span className="font-bold block truncate">{t.name}</span>
                                 {t.domain && <span className="text-[10px] text-white/50 block truncate">{t.domain}</span>}
                              </div>
                              {POPULAR_TEAMS.some(pt => pt.name === t.name) && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-black">PRESET</span>}
                              {firestoreTeams.some(ft => ft.name === t.name) && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-black">DB</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="team2-logo" className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Team 2 Logo URL</label>
                    <div className="flex gap-2">
                      <input 
                        required
                        id="team2-logo"
                        name="team2-logo"
                        placeholder="https://.../logo.png"
                        className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-cyan-200/90 focus:border-cyan-400/50 outline-none transition-all"
                        value={formData.team2Logo}
                        onChange={e => setFormData({...formData, team2Logo: e.target.value})}
                      />
                      {formData.team2Logo?.trim() ? (
                        <div className="w-11 h-11 rounded-xl bg-black/60 border border-white/10 p-1.5 flex items-center justify-center shrink-0">
                          <img src={formData.team2Logo.trim()} alt="Team 2" className="w-full h-full object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Match Short URL & Human-Readable Link Slug */}
                <div className="space-y-3 bg-gradient-to-r from-cyan-950/20 via-blue-950/20 to-purple-950/20 p-4 rounded-2xl border border-cyan-500/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Globe2 size={16} className="text-cyan-400" />
                      <label htmlFor="match-custom-slug" className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                        Match Short Link & Custom Slug
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!formData.team1 && !formData.team2) {
                          alert("Please fill in Team 1 and Team 2 first");
                          return;
                        }
                        const autoShort = generateMatchSlug(formData.team1, formData.team2);
                        setFormData({ ...formData, slug: autoShort });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Sparkles size={12} className="text-cyan-400" />
                      <span>Auto Short Name ({generateMatchSlug(formData.team1 || "barcelona", formData.team2 || "realmadrid")})</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-white/60">
                    Clean, human-readable link for sharing. Adam can customize or shorten team names (e.g., <code className="text-cyan-300">barca-vs-realmadrid</code> instead of random database codes).
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 flex items-center bg-black/60 border border-white/10 rounded-xl overflow-hidden focus-within:border-cyan-400/50">
                      <span className="px-3 py-2 text-xs font-mono text-white/40 bg-white/5 border-r border-white/10 select-none shrink-0">
                        arstream.ai.studio/match/
                      </span>
                      <input
                        id="match-custom-slug"
                        name="match-custom-slug"
                        placeholder={generateMatchSlug(formData.team1 || "barcelona", formData.team2 || "realmadrid")}
                        className="flex-1 bg-transparent px-3 py-2 text-xs font-mono text-cyan-200 placeholder-white/30 outline-none"
                        value={formData.slug}
                        onChange={(e) => {
                          const val = e.target.value;
                          // If full URL pasted, extract slug
                          const extracted = val.includes("/match/") 
                            ? val.split("/match/")[1].split("?")[0].split("#")[0] 
                            : val;
                          setFormData({ ...formData, slug: sanitizeSlug(extracted) });
                        }}
                      />
                    </div>
                  </div>

                  {/* Live Link Preview Pill */}
                  <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-white/60">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Live URL:</span>
                      <span className="text-cyan-300 truncate">
                        arstream.ai.studio/match/{sanitizeSlug(formData.slug) || generateMatchSlug(formData.team1 || "team-1", formData.team2 || "team-2")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const effectiveSlug = sanitizeSlug(formData.slug) || generateMatchSlug(formData.team1, formData.team2);
                        navigator.clipboard?.writeText(`arstream.ai.studio/match/${effectiveSlug}`);
                        setCopiedSlug(true);
                        setTimeout(() => setCopiedSlug(false), 2000);
                      }}
                      className="ml-2 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      {copiedSlug ? (
                        <>
                          <Check size={11} className="text-green-400" />
                          <span className="text-green-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* League / Event & Category Details */}
                <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="category" className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Sport Category</label>
                      <select 
                        id="category"
                        name="category"
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-bold text-cyan-300 focus:border-cyan-400/50 outline-none transition-all"
                        value={formData.category}
                        onChange={e => {
                          const newCat = e.target.value;
                          const sportInfo = getSportMatchInfo(newCat, formData.tournament);
                          setFormData({
                            ...formData, 
                            category: newCat,
                            durationMinutes: sportInfo.durationMinutes,
                            autoEndMinutes: sportInfo.durationMinutes
                          });
                        }}
                      >
                        {ADMIN_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id} className="bg-[#0b0f19] text-white">
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="status" className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Live Status</label>
                      <select 
                        id="status"
                        name="status"
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-bold focus:border-cyan-400/50 outline-none transition-all"
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                      >
                        <option value="live" className="bg-[#0b0f19] text-green-400">🔴 Live Now</option>
                        <option value="upcoming" className="bg-[#0b0f19] text-cyan-400">⏳ Upcoming</option>
                        <option value="ended" className="bg-[#0b0f19] text-red-400">🛑 Ended (Disappears from Page)</option>
                        <option value="finished" className="bg-[#0b0f19] text-white/40">✓ Finished</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="start-time" className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Start Date & Time</label>
                      <input 
                        required
                        id="start-time"
                        name="start-time"
                        type="datetime-local"
                        className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs font-semibold focus:border-cyan-400/50 outline-none transition-all text-white/90"
                        value={formData.startTime}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev, 
                            startTime: val,
                            endTime: val && prev.durationMinutes ? new Date(new Date(val).getTime() + prev.durationMinutes * 60000).toISOString().slice(0, 16) : prev.endTime
                          }));
                        }}
                      />
                    </div>
                  </div>

                  {/* Auto-End Timer & Disappear Settings */}
                  <div className="bg-cyan-950/25 border border-cyan-500/25 p-4 rounded-2xl space-y-3.5 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Timer size={16} className="text-cyan-400 animate-pulse" />
                        <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                          Live Auto-End Timer & Auto-Disappear
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 select-none">
                        <input
                          type="checkbox"
                          checked={formData.autoEndEnabled}
                          onChange={e => setFormData({ ...formData, autoEndEnabled: e.target.checked })}
                          className="rounded border-white/20 bg-black/40 text-cyan-500 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-bold text-[11px]">Auto-End Active</span>
                      </label>
                    </div>

                    <p className="text-[11px] text-white/60 leading-relaxed">
                      Set how long the live broadcast lasts. When the timer ends, the match will automatically transition to <strong className="text-red-400">Ended</strong> and <strong className="text-cyan-300">disappear immediately from the public live stream page</strong>.
                    </p>

                    {formData.autoEndEnabled && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest block mb-1.5">
                            Quick Duration Presets
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "45m", mins: 45 },
                              { label: "90m", mins: 90 },
                              { label: "130m (Football Match)", mins: 130 },
                              { label: "180m (3h)", mins: 180 },
                              { label: "210m (T20 Cricket - 3.5h)", mins: 210 },
                              { label: "480m (ODI Cricket - 8h)", mins: 480 },
                              { label: "1440m (1 Day Test)", mins: 1440 },
                              { label: "7200m (5 Days Test Match)", mins: 7200 },
                            ].map(p => (
                              <button
                                key={p.mins}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    durationMinutes: p.mins,
                                    autoEndMinutes: p.mins,
                                    endTime: prev.startTime ? new Date(new Date(prev.startTime).getTime() + p.mins * 60000).toISOString().slice(0, 16) : ""
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  formData.durationMinutes === p.mins
                                    ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-black scale-105"
                                    : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/5"
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                              Duration in Minutes
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="5"
                                max="10080"
                                value={formData.durationMinutes || ""}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setFormData(prev => ({
                                    ...prev,
                                    durationMinutes: val,
                                    autoEndMinutes: val,
                                    endTime: prev.startTime ? new Date(new Date(prev.startTime).getTime() + val * 60000).toISOString().slice(0, 16) : ""
                                  }));
                                }}
                                placeholder="e.g. 130"
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-cyan-300 focus:border-cyan-400 outline-none"
                              />
                              <span className="text-xs text-white/40 font-mono">mins</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                              Exact End Date & Time (Optional)
                            </label>
                            <input
                              type="datetime-local"
                              value={formData.endTime || ""}
                              onChange={e => {
                                const endVal = e.target.value;
                                let calcMins = formData.durationMinutes;
                                if (endVal && formData.startTime) {
                                  const diffMs = new Date(endVal).getTime() - new Date(formData.startTime).getTime();
                                  if (diffMs > 0) {
                                    calcMins = Math.round(diffMs / 60000);
                                  }
                                }
                                setFormData(prev => ({
                                  ...prev,
                                  endTime: endVal,
                                  autoEndAt: endVal,
                                  durationMinutes: calcMins,
                                  autoEndMinutes: calcMins
                                }));
                              }}
                              className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs font-semibold focus:border-cyan-400 outline-none text-white/90"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* League / Event Autocomplete & Logo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2 relative">
                      <label htmlFor="tournament" className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest flex items-center justify-between">
                        <span>League / Event / Tournament Name</span>
                        <span className="text-[9px] text-white/40 lowercase">(auto-saves to database)</span>
                      </label>
                      <input 
                        id="tournament"
                        name="tournament"
                        placeholder="e.g. UEFA Champions League, ICC T20 World Cup, Premier League"
                        className="w-full bg-black/50 border border-cyan-400/20 rounded-xl p-3 text-xs font-bold focus:border-cyan-400 outline-none transition-all"
                        value={formData.league || formData.tournament}
                        onFocus={() => {
                          setShowLeagueSuggestions(true);
                          setLeagueSearch(formData.league || formData.tournament);
                        }}
                        onBlur={() => setTimeout(() => setShowLeagueSuggestions(false), 250)}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({...formData, league: val, tournament: val});
                          setLeagueSearch(val);
                        }}
                      />
                      {showLeagueSuggestions && combinedLeagueSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 liquid-glass rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto">
                          {combinedLeagueSuggestions.map((l, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => selectLeague(l)}
                              className="w-full p-3 flex items-center gap-3 hover:bg-white/10 border-b border-white/5 text-left text-xs transition-colors"
                            >
                              <div className="w-7 h-7 flex-shrink-0 bg-white/5 rounded-lg border border-white/5 p-1 flex items-center justify-center">
                                {l.logo ? (
                                  <img src={l.logo} className="w-full h-full object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                ) : (
                                  <Trophy size={14} className="text-cyan-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-bold block truncate text-white">{l.name}</span>
                                {l.category && <span className="text-[10px] text-white/40 uppercase block">{l.category}</span>}
                              </div>
                              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-black">{l.source}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="tournament-logo" className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">League / Event Logo URL</label>
                      <div className="flex gap-2">
                        <input 
                          id="tournament-logo"
                          name="tournament-logo"
                          placeholder="https://.../league_logo.svg (Updates DB record)"
                          className="flex-1 bg-black/50 border border-cyan-400/20 rounded-xl p-3 text-xs font-mono text-cyan-200/90 focus:border-cyan-400 outline-none transition-all"
                          value={formData.leagueLogo || formData.tournamentLogo}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData({...formData, leagueLogo: val, tournamentLogo: val});
                          }}
                        />
                        {(formData.leagueLogo?.trim() || formData.tournamentLogo?.trim()) ? (
                          <div className="w-11 h-11 rounded-xl bg-black/60 border border-white/10 p-1.5 flex items-center justify-center shrink-0">
                            <img 
                              src={formData.leagueLogo?.trim() || formData.tournamentLogo?.trim()} 
                              alt="League" 
                              className="w-full h-full object-contain" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => (e.currentTarget.style.display = 'none')} 
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stream Channels Section */}
                <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                     <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Stream Servers & Channels ({formData.channels.length})</label>
                     <div className="flex items-center gap-2">
                       <button
                         type="button"
                         onClick={() => {
                           setIframeTargetMode("form");
                           setShowIframeModal(true);
                         }}
                         className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-400/30 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                       >
                         <Code size={13} /> Upload / Paste Iframe
                       </button>
                       <button type="button" onClick={handleAddChannel} className="text-cyan-400 hover:text-cyan-300 text-xs font-bold uppercase tracking-widest transition-all hover:scale-105 flex items-center gap-1">
                         <Plus size={14} /> Add Channel
                       </button>
                     </div>
                  </div>
                  {formData.channels.map((chan, idx) => {
                    const isEmbed = chan.protocol === 'EMBED' || isEmbedUrl(chan.url) || Boolean(chan.embedCode);
                    return (
                    <div key={idx} className="relative space-y-3 p-4 bg-black/40 rounded-2xl border border-white/10">
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 relative">
                           <label htmlFor={`channel-search-${idx}`} className="sr-only">Channel Name</label>
                           <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                           <input 
                            id={`channel-search-${idx}`}
                            name={`channel-search-${idx}`}
                            placeholder="Channel Name (e.g. Server 1 / Sky Sports / TNT / Willow TV)"
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold focus:border-cyan-400/40 outline-none transition-all"
                            value={activeSearchIndex === idx ? channelSearch : chan.name}
                            onFocus={() => {
                              setActiveSearchIndex(idx);
                              setChannelSearch(chan.name);
                            }}
                            onChange={e => {
                              if (activeSearchIndex === idx) {
                                setChannelSearch(e.target.value);
                              }
                              handleChannelChange(idx, 'name', e.target.value);
                            }}
                          />
                          {activeSearchIndex === idx && filteredAvailableChannels.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 liquid-glass rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto">
                              {filteredAvailableChannels.map((c, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => selectChannel(idx, c)}
                                  className="w-full p-3 flex items-center gap-3 hover:bg-white/10 border-b border-white/5 text-left text-xs transition-colors"
                                >
                                  {c.logo ? (
                                    <img src={c.logo} className="w-6 h-6 rounded-md bg-white/5" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[9px] font-bold text-cyan-300">TV</div>
                                  )}
                                  <div className="flex-1 truncate">
                                    <div className="font-bold">{c.name}</div>
                                    <div className="text-[10px] text-white/50">{c.group}</div>
                                  </div>
                                  {firestoreChannels.some(fc => fc.name === c.name) && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-black">DB</span>}
                                  {chan.url === c.url && <Check size={14} className="text-cyan-400" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {chan.url && (
                          <button
                            type="button"
                            onClick={() => setTestingChannel({
                              id: `test-${idx}`,
                              name: chan.name || `Channel ${idx + 1}`,
                              url: chan.url,
                              protocol: isEmbed ? "EMBED" : "HLS",
                              group: formData.category || "Match Server",
                              userAgent: chan.userAgent,
                              referrer: chan.referrer
                            })}
                            className="px-2.5 py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                            title="Preview and test stream / iframe"
                          >
                            <MonitorPlay size={14} />
                            <span className="hidden sm:inline">Test</span>
                          </button>
                        )}

                        {formData.channels.length > 1 && (
                          <button type="button" onClick={() => handleRemoveChannel(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="Remove Channel"><Trash2 size={16} /></button>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor={`channel-url-${idx}`} className="text-[10px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                            <span>Stream URL or Iframe Embed</span>
                            {isEmbed && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-purple-500/20 text-purple-300 border border-purple-400/30 px-1.5 py-0.5 rounded font-black">
                                🌐 Sandbox-Free Iframe
                              </span>
                            )}
                            {autoDetectedChannels[idx] && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-1.5 py-0.5 rounded font-black">
                                <Sparkles size={10} className="text-cyan-400" />
                                Auto-filled ({autoDetectedChannels[idx].sourceLabel})
                              </span>
                            )}
                          </label>
                          <div className="flex items-center gap-2">
                            {/* Protocol toggle */}
                            <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-white/10 text-[9px]">
                              <button
                                type="button"
                                onClick={() => handleChannelChange(idx, 'protocol', 'HLS')}
                                className={`px-1.5 py-0.5 rounded font-bold transition-all ${!isEmbed ? 'bg-cyan-500 text-black' : 'text-white/40 hover:text-white'}`}
                              >
                                HLS
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChannelChange(idx, 'protocol', 'EMBED')}
                                className={`px-1.5 py-0.5 rounded font-bold transition-all ${isEmbed ? 'bg-purple-500 text-white' : 'text-white/40 hover:text-white'}`}
                              >
                                EMBED
                              </button>
                            </div>
                            {chan.url && (
                              <button
                                type="button"
                                onClick={() => forceAutoFillChannelName(idx)}
                                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold transition-all hover:underline"
                                title="Re-check database and auto-fill channel name"
                              >
                                <Sparkles size={11} /> Auto-fill
                              </button>
                            )}
                          </div>
                        </div>
                        <input 
                          id={`channel-url-${idx}`}
                          name={`channel-url-${idx}`}
                          placeholder="Paste .m3u8 link OR <iframe src='...'></iframe> embed code"
                          className={`w-full bg-black/50 border rounded-xl p-3 text-xs font-mono text-cyan-200/90 focus:border-cyan-400/50 outline-none transition-all ${
                            autoDetectedChannels[idx] ? "border-cyan-400/40 bg-cyan-950/10" : "border-white/10"
                          }`}
                          value={chan.url}
                          onChange={e => handleChannelChange(idx, 'url', e.target.value)}
                        />
                        {autoDetectedChannels[idx] && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-cyan-300/80 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                            <Check size={12} className="text-cyan-400 shrink-0" />
                            <span>Matched stream in <strong>{autoDetectedChannels[idx].sourceLabel}</strong>: <strong className="text-white">{autoDetectedChannels[idx].name}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <input 
                            id={`channel-ua-${idx}`}
                            name={`channel-ua-${idx}`}
                            placeholder="Custom User-Agent (Optional)"
                            className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[11px] text-white/70 focus:border-cyan-400/40 outline-none transition-all"
                            value={chan.userAgent || ""}
                            onChange={e => handleChannelChange(idx, 'userAgent', e.target.value)}
                          />
                        </div>
                        <div>
                          <input 
                            id={`channel-ref-${idx}`}
                            name={`channel-ref-${idx}`}
                            placeholder="Custom Referer / Origin (Optional)"
                            className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[11px] text-white/70 focus:border-cyan-400/40 outline-none transition-all"
                            value={chan.referrer || ""}
                            onChange={e => handleChannelChange(idx, 'referrer', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    );
                  })}
                  {activeSearchIndex !== null && (
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => {
                        setActiveSearchIndex(null);
                        setChannelSearch("");
                      }} 
                    />
                  )}
                </div>

                {/* Auto-Generated Metadata & SEO Description Studio */}
                <div className="space-y-4 bg-gradient-to-br from-cyan-950/20 via-black/40 to-purple-950/20 p-5 rounded-2xl border border-cyan-400/20 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                          Auto-Generated Match Metadata & SEO Description
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded-full font-bold">
                            Live Auto-Sync
                          </span>
                        </h4>
                        <p className="text-[10px] text-white/50">
                          Auto-generates match overview, Google search snippets, and social sharing cards based on live details.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const autoDesc = generateMatchDescription(formData);
                          const autoMeta = generateMatchMetaDescription(formData);
                          setFormData(prev => ({
                            ...prev,
                            description: autoDesc,
                            metaDescription: autoMeta
                          }));
                        }}
                        className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95 cursor-pointer"
                        title="Generate or refresh descriptions based on the current team names, league, kick-off time, and servers"
                      >
                        <Sparkles size={13} /> Auto-Generate from Details
                      </button>
                      {(formData.description || formData.metaDescription) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              description: "",
                              metaDescription: ""
                            }));
                          }}
                          className="px-2.5 py-1.5 text-[10px] text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        >
                          Clear Custom
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description Inputs */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Rich Match Story Description */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="match-description" className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-1.5">
                          <span>Live Match Story & Overview Description</span>
                          <span className="text-[9px] text-white/40 font-normal lowercase">(Shown in player stream panel & app overview)</span>
                        </label>
                        {!formData.description && (
                          <span className="text-[9px] text-cyan-400/80 font-semibold italic">
                            * Auto-generated preview below. Type to override.
                          </span>
                        )}
                      </div>
                      <textarea
                        id="match-description"
                        name="match-description"
                        rows={3}
                        placeholder={generateMatchDescription(formData)}
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white/90 focus:border-cyan-400 outline-none leading-relaxed transition-all placeholder:text-white/30"
                      />
                    </div>

                    {/* SEO Meta Description */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="match-meta-description" className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-1.5">
                          <span>Search Engine (SERP) & Social Card Meta Description</span>
                          <span className="text-[9px] text-white/40 font-normal lowercase">(For Google, WhatsApp, X / Twitter & Discord previews)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const currentMeta = formData.metaDescription || generateMatchMetaDescription(formData);
                            const len = currentMeta.length;
                            const isOptimal = len >= 120 && len <= 160;
                            return (
                              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                                isOptimal 
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                                  : len > 160 
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-white/10 text-white/60"
                              }`}>
                                {len}/160 chars {isOptimal ? "• Optimal SEO" : len > 160 ? "• May truncate" : ""}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <textarea
                        id="match-meta-description"
                        name="match-meta-description"
                        rows={2}
                        placeholder={generateMatchMetaDescription(formData)}
                        value={formData.metaDescription}
                        onChange={e => setFormData({ ...formData, metaDescription: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs text-white/90 focus:border-cyan-400 outline-none leading-relaxed transition-all placeholder:text-white/30 font-sans"
                      />
                    </div>
                  </div>

                  {/* Live Search & Social Card Previews */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                    {/* Google Search Result Preview */}
                    <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 space-y-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                        <Globe2 size={11} className="text-cyan-400" /> Google Search Result Snippet
                      </span>
                      <div className="space-y-1">
                        <div className="text-[11px] text-emerald-400 font-mono truncate">
                          https://ar-stream.app/match/{formData.team1 ? `${formData.team1.toLowerCase().replace(/\s+/g, '-')}-vs-${(formData.team2 || '').toLowerCase().replace(/\s+/g, '-')}` : "live-sports"}
                        </div>
                        <div className="text-sm font-semibold text-blue-400 hover:underline cursor-pointer truncate">
                          {generateMatchPageTitle(formData)}
                        </div>
                        <div className="text-xs text-white/70 line-clamp-2 leading-relaxed font-sans">
                          {formData.metaDescription || generateMatchMetaDescription(formData)}
                        </div>
                      </div>
                    </div>

                    {/* Social OpenGraph Preview Card */}
                    <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 space-y-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
                        <Share2 size={11} className="text-purple-400" /> Social Card (WhatsApp / X / Telegram)
                      </span>
                      <div className="p-2.5 bg-white/5 rounded-lg border border-white/5 flex gap-3 items-center">
                        <div className="w-12 h-12 rounded-lg bg-black/80 border border-white/10 flex items-center justify-center shrink-0 p-1">
                          {formData.team1Logo ? (
                            <img src={formData.team1Logo} alt="Team 1" className="w-full h-full object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <Trophy size={18} className="text-cyan-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest block">AR Stream Live</span>
                          <span className="text-xs font-bold text-white block truncate">
                            {formData.team1 && formData.team2 ? `${formData.team1} vs ${formData.team2}` : formData.eventName || formData.team1 || "Live Sports Match"}
                          </span>
                          <span className="text-[11px] text-white/60 line-clamp-1">
                            {formData.metaDescription || generateMatchMetaDescription(formData)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Generated Keywords Preview */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                      Auto-Indexed Search Keywords & Tags ({generateMatchKeywords(formData).length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {generateMatchKeywords(formData).map((kw, i) => (
                        <span key={i} className="text-[10px] bg-white/5 text-cyan-200 border border-white/5 px-2 py-0.5 rounded-md font-medium">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                </>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit"
                    id="submit-match"
                    name="submit-match"
                    className="flex-1 bg-cyan-500 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(0,242,254,0.3)] transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Save size={20} /> {editingId ? "Update Match & Save League" : "Publish Match Live"}
                  </button>
                  <button 
                    type="button"
                    id="cancel-match"
                    name="cancel-match"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(null);
                    }}
                    className="px-6 border border-white/10 rounded-2xl font-bold hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Matches list & Timer Management */}
            <div className="space-y-4">
              {/* Header & Match Stats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-bold text-white/50 tracking-widest uppercase flex items-center gap-2">
                    <Radio size={14} className="text-cyan-400" />
                    <span>Live Sports & Broadcast Management ({matches.length})</span>
                  </h2>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Manage all sport events (Cricket, Football, Motorsport, Basketball & more). Full control over timers, channels, and statuses.
                  </p>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide">
                  {[
                    { 
                      id: "all", 
                      label: "All Events", 
                      count: matches.filter(m => isCategoryMatch(m.category, m.tournament || m.league, adminSportCategory)).length 
                    },
                    { 
                      id: "live", 
                      label: "Live Now", 
                      count: matches.filter(m => isCategoryMatch(m.category, m.tournament || m.league, adminSportCategory) && getMatchDynamicStatus(m, nowMs).isLive).length 
                    },
                    { 
                      id: "upcoming", 
                      label: "All Upcoming", 
                      count: matches.filter(m => isCategoryMatch(m.category, m.tournament || m.league, adminSportCategory) && getMatchDynamicStatus(m, nowMs).isUpcoming).length 
                    },
                    { 
                      id: "upcoming_24h", 
                      label: "< 24h Public", 
                      count: matches.filter(m => isCategoryMatch(m.category, m.tournament || m.league, adminSportCategory) && getMatchDynamicStatus(m, nowMs).isUpcoming && (getMatchDynamicStatus(m, nowMs).startMs - nowMs <= 24 * 60 * 60 * 1000)).length 
                    },
                    { 
                      id: "upcoming_future", 
                      label: "> 24h Advance (Admin)", 
                      count: matches.filter(m => isCategoryMatch(m.category, m.tournament || m.league, adminSportCategory) && getMatchDynamicStatus(m, nowMs).isUpcoming && (getMatchDynamicStatus(m, nowMs).startMs - nowMs > 24 * 60 * 60 * 1000)).length 
                    },
                    { 
                      id: "ended", 
                      label: "Ended / Past", 
                      count: matches.filter(m => isCategoryMatch(m.category, m.tournament || m.league, adminSportCategory) && getMatchDynamicStatus(m, nowMs).isEnded).length 
                    },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAdminMatchFilter(tab.id as any)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all whitespace-nowrap ${
                        adminMatchFilter === tab.id
                          ? "bg-cyan-500 text-black font-black shadow-sm"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Sport Category Selector & Search */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between bg-[#0b0f19] p-2 rounded-2xl border border-white/5">
                {/* Horizontal Category Scroll */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 max-w-full sm:max-w-2xl">
                  {ALL_CATEGORIES.map(cat => {
                    const count = cat.id === "all" 
                      ? matches.length 
                      : matches.filter(m => isCategoryMatch(m.category, m.tournament || m.league, cat.id)).length;
                    const isActive = adminSportCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setAdminSportCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          isActive
                            ? "bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                            : "bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white"
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-mono ${isActive ? "bg-cyan-400/20 text-cyan-200 font-black" : "bg-white/10 text-white/40"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Quick Search */}
                <div className="relative min-w-[200px] shrink-0">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search matches or teams..."
                    value={adminMatchSearch}
                    onChange={e => setAdminMatchSearch(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-[11px] text-white placeholder-white/30 focus:border-cyan-400 outline-none"
                  />
                  {adminMatchSearch && (
                    <button
                      onClick={() => setAdminMatchSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/40 hover:text-white"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Render Matches List */}
              <div className="space-y-3">
                {sortMatches(
                  matches.filter(m => {
                    // 1. Sport category check
                    if (!isCategoryMatch(m.category, m.tournament || m.league, adminSportCategory)) {
                      return false;
                    }

                    // 2. Status filter check
                    const dynamic = getMatchDynamicStatus(m, nowMs);
                    const isWithin24h = dynamic.isUpcoming && (dynamic.startMs - nowMs <= 24 * 60 * 60 * 1000);
                    const isFutureAdvance = dynamic.isUpcoming && (dynamic.startMs - nowMs > 24 * 60 * 60 * 1000);

                    if (adminMatchFilter === "live" && !dynamic.isLive) return false;
                    if (adminMatchFilter === "upcoming" && !dynamic.isUpcoming) return false;
                    if (adminMatchFilter === "upcoming_24h" && !isWithin24h) return false;
                    if (adminMatchFilter === "upcoming_future" && !isFutureAdvance) return false;
                    if (adminMatchFilter === "ended" && !dynamic.isEnded) return false;

                    // 3. Search query check
                    if (adminMatchSearch.trim()) {
                      const q = adminMatchSearch.trim().toLowerCase();
                      return (
                        m.team1.toLowerCase().includes(q) ||
                        m.team2.toLowerCase().includes(q) ||
                        (m.category || "").toLowerCase().includes(q) ||
                        (m.tournament || "").toLowerCase().includes(q) ||
                        (m.league || "").toLowerCase().includes(q)
                      );
                    }

                    return true;
                  }),
                  nowMs
                ).map(m => {
                  const dynamic = getMatchDynamicStatus(m, nowMs);
                  const isWithin24h = dynamic.isUpcoming && (dynamic.startMs - nowMs <= 24 * 60 * 60 * 1000);
                  const isFutureAdvance = dynamic.isUpcoming && (dynamic.startMs - nowMs > 24 * 60 * 60 * 1000);
                  const channelCount = m.channels?.length || 0;
                  const kickOffDate = new Date(m.startTime);
                  const isToday = !isNaN(kickOffDate.getTime()) && kickOffDate.toDateString() === new Date(nowMs).toDateString();
                  const dateDisplay = !isNaN(kickOffDate.getTime())
                    ? (isToday
                        ? `Today at ${kickOffDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : kickOffDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
                    : "Live Schedule";

                  const sportCat = (m.category || "sport").toLowerCase();
                  const isCricket = sportCat.includes("cricket") || (m.tournament || "").toLowerCase().includes("cricket") || (m.tournament || "").toLowerCase().includes("ipl");

                  return (
                    <div 
                      key={m.id} 
                      className={`liquid-glass-subtle border p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                        dynamic.isLive 
                          ? "border-red-500/40 bg-red-950/15 shadow-[0_0_25px_rgba(239,68,68,0.08)]" 
                          : dynamic.isEnded 
                          ? "border-white/5 opacity-75 bg-black/40" 
                          : isFutureAdvance
                          ? "border-indigo-500/25 bg-[#0e101f]/80 hover:border-indigo-400/40"
                          : "border-white/10 hover:border-cyan-400/40 bg-[#0d111a]/80"
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        <div className="flex -space-x-2 shrink-0 pt-0.5 sm:pt-0">
                          {m.team1Logo?.trim() ? (
                            <img 
                              src={m.team1Logo.trim()} 
                              alt={m.team1}
                              className="w-11 h-11 rounded-full border-2 border-[#0d111a] bg-[#131926] p-1 shadow-lg object-contain" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => (e.currentTarget.src = "https://i.imgur.com/3XIe0au.png")} 
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full border-2 border-[#0d111a] bg-[#131926] flex items-center justify-center text-[10px] font-black text-cyan-300">
                              {m.team1 ? m.team1.slice(0, 2).toUpperCase() : "T1"}
                            </div>
                          )}
                          {m.team2Logo?.trim() ? (
                            <img 
                              src={m.team2Logo.trim()} 
                              alt={m.team2}
                              className="w-11 h-11 rounded-full border-2 border-[#0d111a] bg-[#131926] p-1 shadow-lg object-contain" 
                              referrerPolicy="no-referrer" 
                              onError={(e) => (e.currentTarget.src = "https://i.imgur.com/3XIe0au.png")} 
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full border-2 border-[#0d111a] bg-[#131926] flex items-center justify-center text-[10px] font-black text-cyan-300">
                              {m.team2 ? m.team2.slice(0, 2).toUpperCase() : "T2"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-white">{m.team1} vs {m.team2}</span>
                            
                            {/* Sport Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              isCricket 
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                                : "bg-cyan-500/15 text-cyan-300 border border-cyan-400/25"
                            }`}>
                              {m.category?.toUpperCase() || "SPORT"}
                            </span>

                            {dynamic.isLive && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1.5 bg-red-600/30 border border-red-500/60 text-red-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                  <span>LIVE NOW</span>
                                </span>
                                {(livePresenceMap[m.id] || 0) > 0 && (
                                  <span className="flex items-center gap-1 bg-red-950/60 border border-red-500/40 text-red-200 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                                    <Eye size={10} className="text-red-400" />
                                    <span>{formatViewerCount(livePresenceMap[m.id] || 0)} watching</span>
                                  </span>
                                )}
                              </div>
                            )}
                            {dynamic.isUpcoming && isWithin24h && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                  <Eye size={10} className="text-emerald-400" />
                                  <span>PUBLIC ON APP (&lt; 24H)</span>
                                </span>
                              </div>
                            )}
                            {dynamic.isUpcoming && isFutureAdvance && (
                              <span className="flex items-center gap-1 bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" title="Visible only to admin. Will automatically show on the user app when kick-off is less than 24 hours away.">
                                <EyeOff size={10} className="text-indigo-400" />
                                <span>ADMIN ONLY (&gt; 24H)</span>
                              </span>
                            )}
                            {dynamic.isEnded && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1 bg-white/5 border border-white/10 text-white/40 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                  <CheckCircle2 size={10} />
                                  <span>ENDED / FINISHED</span>
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="text-[11px] text-white/60 tracking-wider flex items-center gap-2 flex-wrap">
                            <span className="text-cyan-400 font-bold uppercase">{m.league || m.tournament || m.category || "Live Event"}</span>
                            <span>&bull;</span>
                            <span className="text-white/70">📅 {dateDisplay}</span>

                            {/* Live Timer Countdown */}
                            {dynamic.isLive && (
                              <>
                                <span>&bull;</span>
                                <span className="text-cyan-300 font-mono font-bold bg-cyan-950/70 border border-cyan-500/40 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm">
                                  <Timer size={12} className="text-cyan-400 animate-spin" />
                                  <span>Auto-Ends in: {formatRemainingTimer(dynamic.remainingMs)}</span>
                                </span>
                              </>
                            )}

                            {/* Upcoming Countdown */}
                            {dynamic.isUpcoming && (
                              <>
                                <span>&bull;</span>
                                <span className="text-amber-300 font-mono font-semibold bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock size={11} className="text-amber-400" />
                                  <span>Starts in: {formatRemainingTimer(dynamic.startMs - nowMs)}</span>
                                </span>
                              </>
                            )}

                            {/* Advance Match User Visibility Timer */}
                            {isFutureAdvance && (
                              <>
                                <span>&bull;</span>
                                <span className="text-indigo-300/90 font-mono text-[10px] bg-indigo-950/50 border border-indigo-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <CalendarClock size={11} className="text-indigo-400" />
                                  <span>Auto-shows to users in: {formatRemainingTimer(dynamic.startMs - nowMs - 24 * 60 * 60 * 1000)}</span>
                                </span>
                              </>
                            )}

                            {/* Ended match 30m retention indicator */}
                            {dynamic.isEnded && (
                              <>
                                <span>&bull;</span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                  dynamic.isWithinFinishedGracePeriod 
                                    ? "bg-amber-950/40 border border-amber-500/30 text-amber-300 font-bold"
                                    : "bg-white/5 border border-white/10 text-white/30"
                                }`}>
                                  <CheckCircle2 size={10} />
                                  <span>
                                    {dynamic.isWithinFinishedGracePeriod 
                                      ? `Visible in Finished tab (${Math.max(0, 30 - (dynamic.minutesSinceEnd || 0))}m left before auto-hide)`
                                      : `Hidden from users (ended ${dynamic.minutesSinceEnd || 0}m ago)`}
                                  </span>
                                </span>
                              </>
                            )}
                          </div>

                          {/* Channel Links Summary / Warning if none */}
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {channelCount > 0 ? (
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md font-medium">
                                <Tv size={11} />
                                <span>{channelCount} TV {channelCount === 1 ? 'Channel' : 'Channels'} Configured</span>
                                {m.channels && m.channels.length > 0 && (
                                  <span className="text-white/40 ml-1">
                                    ({m.channels.slice(0, 2).map((c: any) => c.name).join(", ")}{m.channels.length > 2 ? "..." : ""})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-amber-400/90 bg-amber-950/30 border border-amber-500/30 px-2 py-0.5 rounded-md font-medium">
                                <AlertTriangle size={11} className="text-amber-400" />
                                <span>No streaming channels linked yet &bull; Click Manage Channels to add</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Admin Action Controls */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                        {/* Full Match Details Inspector Button */}
                        <button
                          type="button"
                          onClick={() => setInspectorMatch(m)}
                          className="px-2.5 py-1.5 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 hover:from-purple-500/30 hover:to-cyan-500/30 border border-purple-400/40 text-purple-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                          title="Inspect full match intelligence, lineups, stats, referee, and live events"
                        >
                          <Sparkles size={13} className="text-cyan-300" />
                          <span>Full Details</span>
                        </button>

                        {/* Quick Channels Action on every match */}
                        <button
                          type="button"
                          onClick={() => {
                            setQuickChannelMatch(m);
                            setQuickChannelsList(m.channels && m.channels.length > 0 ? JSON.parse(JSON.stringify(m.channels)) : [{ name: "Main Stream", url: "" }]);
                            setQuickChannelDetected({});
                          }}
                          className="px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                          title="Quickly view, add, or edit stream channels for this match"
                        >
                          <Tv size={13} />
                          <span>{channelCount > 0 ? `${channelCount} Channels` : "+ Add Channels"}</span>
                        </button>

                        {/* Live match actions */}
                        {dynamic.isLive && (
                          <>
                            <button
                              type="button"
                              onClick={() => setExtendTimerModalMatch(m)}
                              className="px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              title="Extend Live Timer"
                            >
                              <Timer size={13} />
                              <span>Extend Timer</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEndMatchNow(m.id)}
                              className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              title="End Live and Hide from page"
                            >
                              <StopCircle size={13} />
                              <span>End & Hide</span>
                            </button>
                          </>
                        )}

                        {/* Upcoming match actions */}
                        {dynamic.isUpcoming && (
                          <button
                            type="button"
                            onClick={() => handleStartLiveNowWithTimer(m, m.durationMinutes || (isCricket ? 240 : 115))}
                            className="px-2.5 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            title="Go Live Now with timer"
                          >
                            <Play size={13} />
                            <span>Go Live Now ({m.durationMinutes || (isCricket ? 240 : 115)}m)</span>
                          </button>
                        )}

                        {/* Ended match actions (Reactivate / Go Live) */}
                        {dynamic.isEnded && (
                          <button
                            type="button"
                            onClick={() => handleReactivateMatch(m)}
                            className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            title="Reactivate match and broadcast live again"
                          >
                            <RotateCw size={13} />
                            <span>Reactivate Live</span>
                          </button>
                        )}

                        <button 
                          type="button" 
                          onClick={() => handleEdit(m)} 
                          className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-90 cursor-pointer" 
                          title="Full match edit"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleDelete(m.id)} 
                          className="p-2 text-red-400/70 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all active:scale-90 cursor-pointer" 
                          title="Delete match"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {matches.length === 0 && (
                  <div className="py-16 text-center text-white/40 text-sm liquid-glass rounded-2xl">
                    No matches created yet. Click "Add New Live Match" above.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LEAGUES & LOGOS MANAGER */}
        {activeTab === "leagues" && (
          <div className="space-y-6">
            <form onSubmit={handleSaveStandaloneLeague} className="liquid-glass rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-black text-cyan-300 uppercase tracking-widest flex items-center gap-2">
                <Trophy size={16} /> {editingLeagueId ? "Update League / Event" : "Add or Update League & Logo in Database"}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Save tournaments and events to Firestore. When matches reference this league or when you update its logo URL, it synchronizes across all matches and persists in the database.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold text-white/50 uppercase">League Name</label>
                  <input
                    required
                    placeholder="e.g. UEFA Champions League"
                    value={newLeagueName}
                    onChange={e => setNewLeagueName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-cyan-400 outline-none"
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold text-white/50 uppercase">Sport Category</label>
                  <select
                    value={newLeagueCategory}
                    onChange={e => setNewLeagueCategory(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-bold text-cyan-300 focus:border-cyan-400 outline-none"
                  >
                    {ADMIN_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id} className="bg-[#0b0f19] text-white">{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-[10px] font-bold text-white/50 uppercase">Logo URL (SVG / PNG)</label>
                  <div className="flex gap-2">
                    <input
                      placeholder="https://.../logo.svg"
                      value={newLeagueLogo}
                      onChange={e => setNewLeagueLogo(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-cyan-200 focus:border-cyan-400 outline-none"
                    />
                    {newLeagueLogo?.trim() ? (
                      <div className="w-10 h-10 rounded-lg bg-black/60 border border-white/10 p-1 flex items-center justify-center shrink-0">
                        <img src={newLeagueLogo.trim()} className="w-full h-full object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingLeagueId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLeagueId(null);
                      setNewLeagueName("");
                      setNewLeagueLogo("");
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingLeague}
                  className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
                >
                  {isSavingLeague ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{editingLeagueId ? "Save League Update" : "Save League in DB"}</span>
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">
                  Database & Preset Leagues ({filteredManagerLeagues.length})
                </h3>
                <div className="w-64 relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    placeholder="Search leagues..."
                    value={leagueManagerSearch}
                    onChange={e => setLeagueManagerSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-white/40 focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredManagerLeagues.map((l, i) => {
                  const isFirestore = !l.id?.startsWith("preset-");
                  return (
                    <div key={i} className="liquid-glass-subtle border border-white/5 p-3 rounded-2xl flex items-center justify-between group hover:border-cyan-400/30 transition-all">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 p-1.5 flex items-center justify-center shrink-0">
                          {l.logo?.trim() ? (
                            <img src={l.logo.trim()} alt={l.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <Trophy size={16} className="text-cyan-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">{l.name}</div>
                          <div className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-2 mt-0.5">
                            <span>{l.category || "sport"}</span>
                            <span>&bull;</span>
                            <span className={isFirestore ? "text-green-400 font-bold" : "text-cyan-400"}>{isFirestore ? "FIRESTORE DB" : "PRESET"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => {
                            setNewLeagueName(l.name);
                            setNewLeagueLogo(l.logo);
                            setNewLeagueCategory(l.category || "football");
                            setEditingLeagueId(isFirestore ? l.id : null);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg text-xs font-bold"
                          title="Edit logo link"
                        >
                          <Edit2 size={14} />
                        </button>
                        {isFirestore && (
                          <button
                            onClick={() => handleDeleteLeague(l.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-bold"
                            title="Delete league"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: IPTV CHANNELS MANAGER */}
        {activeTab === "iptv" && (
          <div className="space-y-6">
            {/* IPTV ADD / EDIT FORM */}
            <form onSubmit={handleSaveStandaloneIPTVChannel} className="liquid-glass rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-cyan-300 uppercase tracking-widest flex items-center gap-2">
                  <Tv size={16} /> {editingChannelId ? "Update IPTV Channel in Database" : "Add New IPTV Channel to Database"}
                </h3>
                {editingChannelId && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 font-bold">
                    Editing Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Add live television and broadcast channels directly into Firestore. Custom channels appear instantly with top priority in the IPTV Live section of the application.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Channel Name */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                      Channel Name <span className="text-cyan-400">*</span>
                    </label>
                    {iptvAutoDetected && (
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-black flex items-center gap-1">
                        <Sparkles size={10} className="text-cyan-400" />
                        Auto-detected ({iptvAutoDetected.sourceLabel})
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => handleIPTVNameChange(e.target.value)}
                    placeholder="e.g. Sky Sports Main Event, Willow HD, TNT Sports"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:border-cyan-400 outline-none"
                  />
                </div>

                {/* Channel Group / Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                    Category / Group <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newChannelGroup}
                    onChange={(e) => setNewChannelGroup(e.target.value)}
                    placeholder="e.g. Sports, News, Movies, Entertainment"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              {/* Quick Group Selection Pills */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">
                  Quick Category Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_IPTV_GROUPS.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setNewChannelGroup(grp)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                        newChannelGroup === grp
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logo URL with live preview & auto-avatar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                    Channel Logo URL (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newChannelName.trim()) {
                        alert("Enter a channel name first.");
                        return;
                      }
                      setNewChannelLogo(`https://ui-avatars.com/api/?name=${encodeURIComponent(newChannelName.trim())}&background=00f2fe&color=000&bold=true`);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold"
                  >
                    <Sparkles size={11} /> Auto Generate Logo
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newChannelLogo}
                    onChange={(e) => setNewChannelLogo(e.target.value)}
                    placeholder="https://.../logo.png"
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:border-cyan-400 outline-none"
                  />
                  {newChannelLogo?.trim() ? (
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0">
                      <img
                        src={newChannelLogo.trim()}
                        alt="Preview"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Stream URL */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                    Stream URL (.m3u8 or Live URL) <span className="text-cyan-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIframeTargetMode("iptv");
                        setShowIframeModal(true);
                      }}
                      className="px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-400/30 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                    >
                      <Code size={11} /> Upload / Paste Iframe
                    </button>
                    {newChannelUrl && (
                      <button
                        type="button"
                        onClick={() => handleIPTVUrlChange(newChannelUrl)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold"
                      >
                        <Sparkles size={11} /> Auto-fill from DB
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={newChannelUrl}
                  onChange={(e) => handleIPTVUrlChange(e.target.value)}
                  placeholder="https://example.com/live/stream.m3u8"
                  className={`w-full bg-black/40 border rounded-xl p-3 text-xs text-cyan-300 font-mono placeholder:text-white/30 focus:border-cyan-400 outline-none ${
                    iptvAutoDetected ? "border-cyan-400/40 bg-cyan-950/10" : "border-white/10"
                  }`}
                />
                {iptvAutoDetected && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-cyan-300/80 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                    <Check size={12} className="text-cyan-400 shrink-0" />
                    <span>Auto-matched details in <strong>{iptvAutoDetected.sourceLabel}</strong> for <strong>{iptvAutoDetected.name}</strong></span>
                  </div>
                )}
              </div>

              {/* Advanced Headers Collapsible (User-Agent / Referrer) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedHeaders(!showAdvancedHeaders)}
                  className="text-[11px] font-bold text-white/50 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
                >
                  <span>{showAdvancedHeaders ? "▼ Hide" : "▶ Show"} Advanced Stream Headers (User-Agent / Referrer)</span>
                </button>

                {showAdvancedHeaders && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-3 bg-black/30 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider block">
                        Custom User-Agent
                      </label>
                      <input
                        type="text"
                        value={newChannelUserAgent}
                        onChange={(e) => setNewChannelUserAgent(e.target.value)}
                        placeholder="e.g. ExoPlayer, Mozilla/5.0..."
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-white/20 focus:border-cyan-400 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider block">
                        Custom Referrer / Origin
                      </label>
                      <input
                        type="text"
                        value={newChannelReferrer}
                        onChange={(e) => setNewChannelReferrer(e.target.value)}
                        placeholder="e.g. https://sports-stream.live"
                        className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-white/20 focus:border-cyan-400 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingChannel}
                  className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] flex items-center justify-center gap-2"
                >
                  {isSavingChannel ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingChannelId ? "Update Channel" : "Save Channel to Database"}
                </button>
                {editingChannelId && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewChannelName("");
                      setNewChannelGroup("Sports");
                      setNewChannelLogo("");
                      setNewChannelUrl("");
                      setNewChannelUserAgent("");
                      setNewChannelReferrer("");
                      setEditingChannelId(null);
                      setShowAdvancedHeaders(false);
                    }}
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* IPTV CHANNELS DIRECTORY */}
            <div className="liquid-glass rounded-3xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Tv size={16} className="text-cyan-400" /> Channels Library ({allIPTVChannelsList.length})
                  </h3>
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-400/20">
                    {firestoreChannels.length} in Firestore DB
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[240px]">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={iptvManagerSearch}
                    onChange={(e) => setIptvManagerSearch(e.target.value)}
                    placeholder="Search channel, group, URL..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/30 focus:border-cyan-400 outline-none"
                  />
                  {iptvManagerSearch && (
                    <button
                      onClick={() => setIptvManagerSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1">
                <button
                  onClick={() => setIptvGroupFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    iptvGroupFilter === "all"
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  All ({allIPTVChannelsList.length})
                </button>
                <button
                  onClick={() => setIptvGroupFilter("custom_only")}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    iptvGroupFilter === "custom_only"
                      ? "bg-amber-500/20 border-amber-400 text-amber-300"
                      : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  Firestore Custom Only ({firestoreChannels.length})
                </button>
                {POPULAR_IPTV_GROUPS.map((grp) => (
                  <button
                    key={grp}
                    onClick={() => setIptvGroupFilter(grp)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                      iptvGroupFilter.toLowerCase() === grp.toLowerCase()
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                        : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>

              {/* Channel Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {filteredIPTVChannels.map((c, idx) => {
                  const isFirestore = !c.id?.startsWith("preset-");
                  return (
                    <div
                      key={`${c.id || c.name || 'iptv'}-${idx}`}
                      className="p-3.5 rounded-2xl bg-black/40 border border-white/10 hover:border-cyan-400/30 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                          {c.logo?.trim() ? (
                            <img
                              src={c.logo.trim()}
                              alt=""
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                              onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                            />
                          ) : (
                            <Tv size={18} className="text-cyan-400/60" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                              {c.name}
                            </h4>
                            {isFirestore ? (
                              <span className="text-[8px] font-bold bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-400/30 shrink-0">
                                DATABASE
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold bg-white/10 text-white/40 px-1.5 py-0.2 rounded shrink-0">
                                PRESET
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-cyan-400/80 font-mono">
                              {c.group || "General"}
                            </span>
                            {(c.userAgent || c.referrer) && (
                              <span className="text-[9px] text-amber-400/80 font-mono bg-amber-500/10 px-1 rounded">
                                Headers Active
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-white/30 font-mono truncate mt-0.5">
                            {c.url}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Test Play Stream */}
                        <button
                          type="button"
                          onClick={() => setTestingChannel(c)}
                          className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg text-xs font-bold"
                          title="Test Stream Playback"
                        >
                          <MonitorPlay size={15} />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleEditIPTVChannel(c)}
                          className="p-2 text-white/60 hover:text-cyan-300 hover:bg-white/5 rounded-lg text-xs font-bold"
                          title={isFirestore ? "Edit Channel" : "Customize & Save to DB"}
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Delete or Clone */}
                        {isFirestore ? (
                          <button
                            type="button"
                            onClick={() => c.id && handleDeleteIPTVChannel(c.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-bold"
                            title="Delete from Database"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleClonePresetToDatabase(c)}
                            className="p-2 text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg text-xs font-bold"
                            title="Save Preset to Database"
                          >
                            <Plus size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredIPTVChannels.length === 0 && (
                <div className="py-12 text-center text-white/40 text-xs">
                  No IPTV channels found matching your search.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: USER MATCH REQUESTS */}
        {activeTab === "requests" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header / Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/40 p-4 rounded-3xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 flex items-center justify-center">
                  <MessageSquarePlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>User Match Requests</span>
                    <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-400/30 font-mono">
                      {matchRequests.length} Total
                    </span>
                  </h3>
                  <p className="text-xs text-white/50">
                    Matches requested by site visitors from the home page.
                  </p>
                </div>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
                {(["all", "pending", "added", "dismissed"] as const).map((filterKey) => {
                  const count = filterKey === "all" 
                    ? matchRequests.length 
                    : matchRequests.filter(r => r.status === filterKey).length;
                  const isActive = requestFilter === filterKey;
                  return (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setRequestFilter(filterKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 uppercase tracking-wider ${
                        isActive
                          ? filterKey === "pending"
                            ? "bg-amber-500 text-black font-black shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                            : filterKey === "added"
                            ? "bg-emerald-500 text-black font-black shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                            : filterKey === "dismissed"
                            ? "bg-zinc-700 text-white font-black"
                            : "bg-cyan-500 text-black font-black shadow-[0_0_12px_rgba(0,242,254,0.4)]"
                          : "bg-white/5 text-white/60 hover:text-white border border-white/5 hover:border-white/10"
                      }`}
                    >
                      <span>{filterKey}</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-black/30 text-[10px] font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search within requests */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input
                id="search-match-requests-input"
                type="text"
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                placeholder="Search requests by match name, sport, requester or notes..."
                className="w-full bg-black/40 border border-white/10 focus:border-cyan-400 rounded-2xl py-3 pl-11 pr-4 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all font-medium"
              />
              {requestSearch && (
                <button
                  onClick={() => setRequestSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Requests Cards List */}
            {(() => {
              const filteredRequests = matchRequests.filter((r) => {
                if (requestFilter !== "all" && r.status !== requestFilter) return false;
                if (!requestSearch) return true;
                const q = requestSearch.toLowerCase();
                return (
                  r.matchTitle?.toLowerCase().includes(q) ||
                  r.category?.toLowerCase().includes(q) ||
                  r.notes?.toLowerCase().includes(q) ||
                  r.requesterName?.toLowerCase().includes(q) ||
                  r.eventDate?.toLowerCase().includes(q)
                );
              });

              if (filteredRequests.length === 0) {
                return (
                  <div className="py-16 text-center liquid-glass rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
                      <Inbox size={26} />
                    </div>
                    <h4 className="text-sm font-bold text-white/70">No Match Requests Found</h4>
                    <p className="text-xs text-white/40 max-w-sm">
                      {requestSearch 
                        ? "Try clearing the search query to view other requests."
                        : requestFilter === "pending"
                        ? "Great job! All match requests have been reviewed."
                        : "User requests submitted from the front page will appear here instantly."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-4">
                  {filteredRequests.map((req) => {
                    const formattedDate = req.createdAt?.seconds 
                      ? new Date(req.createdAt.seconds * 1000).toLocaleString([], { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })
                      : "Recently";

                    return (
                      <div
                        key={req.id}
                        className={`liquid-glass rounded-3xl p-5 border transition-all space-y-4 ${
                          req.status === 'pending'
                            ? "border-cyan-400/30 bg-cyan-950/10 shadow-[0_0_20px_rgba(0,242,254,0.05)]"
                            : req.status === 'added'
                            ? "border-emerald-500/30 bg-emerald-950/10"
                            : "border-white/5 opacity-70"
                        }`}
                      >
                        {/* Top Meta Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                              {req.category || "SPORT"}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              req.status === 'pending'
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                                : req.status === 'added'
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                            }`}>
                              STATUS: {req.status?.toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
                            <Clock size={12} className="text-white/30" />
                            <span>Submitted {formattedDate}</span>
                          </div>
                        </div>

                        {/* Title & Details */}
                        <div className="space-y-2">
                          <h4 className="text-base sm:text-lg font-black text-white">
                            {req.matchTitle}
                          </h4>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
                            {req.eventDate && (
                              <div className="flex items-center gap-1.5 text-cyan-300">
                                <Calendar size={13} className="text-cyan-400 shrink-0" />
                                <span>{req.eventDate}</span>
                              </div>
                            )}

                            {req.requesterName && (
                              <div className="flex items-center gap-1.5 text-white/50">
                                <User size={13} className="text-white/40 shrink-0" />
                                <span>Requested by: <strong className="text-white/80">{req.requesterName}</strong></span>
                              </div>
                            )}
                          </div>

                          {/* Notes / Streaming URL suggestion */}
                          {req.notes && (
                            <div className="p-3 bg-black/40 border border-white/10 rounded-2xl space-y-1">
                              <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1">
                                <MessageSquare size={11} className="text-cyan-400" />
                                <span>Requester Notes & Suggestions:</span>
                              </div>
                              <p className="text-xs text-white/80 leading-relaxed break-all select-all font-mono">
                                {req.notes}
                              </p>
                              {req.notes.startsWith("http") && (
                                <div className="pt-1">
                                  <a
                                    href={req.notes}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-1"
                                  >
                                    <span>Open Suggested Link</span>
                                    <ExternalLink size={10} />
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCreateMatchFromRequest(req)}
                              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-black text-xs rounded-xl flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.25)] transition-all active:scale-95 cursor-pointer"
                            >
                              <Sparkles size={14} />
                              <span>Create Match From Request</span>
                            </button>

                            {req.status === 'pending' && (
                              <button
                                type="button"
                                disabled={isUpdatingRequest === req.id}
                                onClick={() => handleUpdateRequestStatus(req.id, 'added')}
                                className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                                title="Mark as Added / Broadcast Available"
                              >
                                <CheckCircle2 size={14} />
                                <span>Mark Added</span>
                              </button>
                            )}

                            {req.status === 'pending' && (
                              <button
                                type="button"
                                disabled={isUpdatingRequest === req.id}
                                onClick={() => handleUpdateRequestStatus(req.id, 'dismissed')}
                                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                                title="Dismiss this request"
                              >
                                <Ban size={14} />
                                <span>Dismiss</span>
                              </button>
                            )}

                            {req.status === 'dismissed' && (
                              <button
                                type="button"
                                disabled={isUpdatingRequest === req.id}
                                onClick={() => handleUpdateRequestStatus(req.id, 'pending')}
                                className="px-3 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                              >
                                <RotateCw size={13} />
                                <span>Reopen</span>
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(req.id)}
                            className="p-2 text-red-400/60 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Delete Request"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 5: JSON CODE STUDIO */}
        {activeTab === "json" && (
          <div className="animate-in fade-in duration-300">
            <JSONCodeStudio
              currentMatches={matches}
              currentChannels={firestoreChannels}
              currentLeagues={firestoreLeagues}
              onRefreshData={() => {}}
            />
          </div>
        )}

        {/* TAB 5: API-SPORTS EXTRACTOR & DAILY SYNC */}
        {activeTab === "apisports" && (
          <div className="animate-in fade-in duration-300">
            <APISportsManager
              currentMatches={matches}
              currentChannels={firestoreChannels}
              onRefreshData={() => {}}
              onEditMatch={(matchData) => {
                setFormData({
                  team1: matchData.team1 || "",
                  team1Logo: matchData.team1Logo || "",
                  team2: matchData.team2 || "",
                  team2Logo: matchData.team2Logo || "",
                  category: matchData.category || "football",
                  league: matchData.league || "",
                  leagueLogo: matchData.leagueLogo || "",
                  tournament: matchData.tournament || "",
                  tournamentLogo: matchData.tournamentLogo || "",
                  eventName: matchData.eventName || "",
                  startTime: matchData.startTime ? new Date(matchData.startTime).toISOString().slice(0, 16) : "",
                  endTime: matchData.endTime ? new Date(matchData.endTime).toISOString().slice(0, 16) : "",
                  durationMinutes: matchData.durationMinutes || 115,
                  autoEndMinutes: matchData.autoEndMinutes || 115,
                  autoEndAt: matchData.autoEndAt || "",
                  autoEndEnabled: matchData.autoEndEnabled ?? true,
                  status: matchData.status || "upcoming",
                  channels: matchData.channels && matchData.channels.length > 0 ? matchData.channels : [{ name: "Main Stream", url: "" }]
                });
                setMatchJsonText(JSON.stringify(matchData, null, 2));
                setEditingId(null);
                setIsAdding(true);
                setActiveTab("matches");
              }}
            />
          </div>
        )}

        {/* TAB 6: STREAMED.PK LIVE BROADCAST ENGINE */}
        {activeTab === "streamed" && (
          <div className="animate-in fade-in duration-300">
            <StreamedSyncManager
              currentMatches={matches}
              onRefreshData={() => {}}
              onEditMatch={(matchData) => {
                setFormData({
                  team1: matchData.team1 || "",
                  team1Logo: matchData.team1Logo || "",
                  team2: matchData.team2 || "",
                  team2Logo: matchData.team2Logo || "",
                  category: matchData.category || "football",
                  league: matchData.league || "",
                  leagueLogo: matchData.leagueLogo || "",
                  tournament: matchData.tournament || "",
                  tournamentLogo: matchData.tournamentLogo || "",
                  eventName: matchData.eventName || "",
                  startTime: matchData.startTime ? new Date(matchData.startTime).toISOString().slice(0, 16) : "",
                  endTime: matchData.endTime ? new Date(matchData.endTime).toISOString().slice(0, 16) : "",
                  durationMinutes: matchData.durationMinutes || 115,
                  autoEndMinutes: matchData.autoEndMinutes || 115,
                  autoEndAt: matchData.autoEndAt || "",
                  autoEndEnabled: matchData.autoEndEnabled ?? true,
                  status: matchData.status || "upcoming",
                  channels: matchData.channels && matchData.channels.length > 0 ? matchData.channels : [{ name: "Main Stream", url: "" }]
                });
                setMatchJsonText(JSON.stringify(matchData, null, 2));
                setEditingId(null);
                setIsAdding(true);
                setActiveTab("matches");
              }}
            />
          </div>
        )}

        {/* TAB 7: ANNOUNCEMENTS & POP-UP ADS */}
        {activeTab === "announcements" && (
          <AdminAnnouncementsManager />
        )}
      </div>

      {/* TEST STREAM MODAL */}
      {testingChannel && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="liquid-glass border border-cyan-500/30 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <MonitorPlay size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{testingChannel.name}</h3>
                  <p className="text-[10px] text-cyan-400/80 font-mono">{testingChannel.group} &bull; Stream Test</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestingChannel(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Video container */}
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center relative">
              {testingChannel.url ? (
                <video
                  src={testingChannel.url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    console.warn("Test video error:", e);
                  }}
                />
              ) : null}
            </div>

            <div className="bg-black/50 p-3 rounded-xl border border-white/5 space-y-1">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                Direct Stream URL:
              </div>
              <p className="text-[10px] font-mono text-cyan-300/80 break-all select-all">
                {testingChannel.url}
              </p>
              {testingChannel.userAgent && (
                <div className="text-[9px] text-white/50 font-mono pt-1">
                  User-Agent: {testingChannel.userAgent}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(testingChannel.url);
                  alert("Stream URL copied to clipboard!");
                }}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Copy size={13} /> Copy URL
              </button>
              <button
                type="button"
                onClick={() => setTestingChannel(null)}
                className="px-6 py-2.5 bg-cyan-500 text-black font-black rounded-xl text-xs hover:bg-cyan-400 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXTEND TIMER QUICK MODAL */}
      {extendTimerModalMatch && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="liquid-glass border border-cyan-500/30 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Timer size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Extend Live Broadcast</h3>
                  <p className="text-[10px] text-white/50">{extendTimerModalMatch.team1} vs {extendTimerModalMatch.team2}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendTimerModalMatch(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Add extra time to prevent this match from auto-ending and disappearing. The match will stay live on the home feed.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest block">
                Quick Extend Presets
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "+15m", mins: 15 },
                  { label: "+30m", mins: 30 },
                  { label: "+45m", mins: 45 },
                  { label: "+1h", mins: 60 },
                  { label: "+2h", mins: 120 },
                  { label: "+4h", mins: 240 },
                  { label: "+8h (ODI)", mins: 480 },
                  { label: "+1 Day (Test)", mins: 1440 },
                ].map(p => (
                  <button
                    key={p.mins}
                    type="button"
                    onClick={() => handleExtendMatchTimer(extendTimerModalMatch, p.mins)}
                    className="py-2 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 rounded-xl text-xs font-black transition-all active:scale-95 text-center"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest block">
                Or Custom Extra Minutes
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="10080"
                  value={customExtendMins}
                  onChange={e => setCustomExtendMins(parseInt(e.target.value) || 0)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-bold text-cyan-300 focus:border-cyan-400 outline-none"
                  placeholder="e.g. 130"
                />
                <button
                  type="button"
                  onClick={() => handleExtendMatchTimer(extendTimerModalMatch, customExtendMins)}
                  className="px-5 bg-cyan-500 text-black font-black rounded-xl text-xs hover:bg-cyan-400 transition-all active:scale-95"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExtendTimerModalMatch(null)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CHANNELS MODAL (Upcoming & Live Match Channel Manager) */}
      {quickChannelMatch && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass border border-cyan-500/30 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Tv size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Manage Streaming Channels</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold uppercase">
                      {quickChannelMatch.category || "Sport"}
                    </span>
                  </h3>
                  <p className="text-xs text-white/60 font-medium">
                    {quickChannelMatch.team1} vs {quickChannelMatch.team2} &bull; {quickChannelMatch.league || quickChannelMatch.tournament || "Event"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setQuickChannelMatch(null); setQuickChannelsList([]); }}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 shrink-0 bg-white/5 p-2.5 rounded-2xl border border-white/10">
              <p className="text-xs text-white/70">
                Configure stream links for this match. Click auto-generate to instantly populate working broadcast servers.
              </p>
              <button
                type="button"
                onClick={handleAutoFillQuickChannels}
                className="px-3 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-xs font-black rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5 shrink-0 shadow-lg cursor-pointer"
                title="Automatically generates sport-specific high-definition broadcast servers"
              >
                <Sparkles size={13} />
                <span>⚡ Auto-Fill HD Channels</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {quickChannelsList.map((chan, idx) => (
                <div key={idx} className="p-3.5 bg-black/40 rounded-2xl border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-cyan-400 uppercase tracking-wider">
                      Stream Channel #{idx + 1}
                    </span>
                    {quickChannelsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQuickChannelRow(idx)}
                        className="text-red-400/80 hover:text-red-300 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-white/50 uppercase">Channel Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Willow HD, Sky Sports"
                        value={chan.name}
                        onChange={e => handleQuickChannelChange(idx, "name", e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-white/30 focus:border-cyan-400 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[9px] font-bold text-white/50 uppercase">Stream URL (.m3u8 / mpd / embed)</label>
                      <input
                        type="text"
                        placeholder="https://domain.com/live/stream.m3u8"
                        value={chan.url}
                        onChange={e => handleQuickChannelChange(idx, "url", e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-cyan-300 font-mono placeholder-white/30 focus:border-cyan-400 outline-none"
                      />
                    </div>
                  </div>

                  {quickChannelDetected[idx] && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 rounded-lg">
                      <Sparkles size={11} className="text-emerald-400 animate-pulse" />
                      <span>Auto-matched from <strong>{quickChannelDetected[idx].sourceLabel}</strong>: <em>{quickChannelDetected[idx].name}</em></span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/5">
                    <input
                      type="text"
                      placeholder="Optional User-Agent"
                      value={chan.userAgent || ""}
                      onChange={e => handleQuickChannelChange(idx, "userAgent", e.target.value)}
                      className="bg-black/40 border border-white/5 rounded-xl p-2 text-[10px] text-white/70 placeholder-white/20 focus:border-cyan-400 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Optional Referrer URL"
                      value={chan.referrer || ""}
                      onChange={e => handleQuickChannelChange(idx, "referrer", e.target.value)}
                      className="bg-black/40 border border-white/5 rounded-xl p-2 text-[10px] text-white/70 placeholder-white/20 focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddQuickChannelRow}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl text-xs font-bold text-cyan-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus size={14} /> Add Another Stream Server
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => { setQuickChannelMatch(null); setQuickChannelsList([]); }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingQuickChannels}
                onClick={handleSaveQuickChannels}
                className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {isSavingQuickChannels ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save Channels to Match</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* STREAM / EMBED TEST MODAL */}
      {testingChannel && (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass border border-cyan-500/40 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-black/60 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <MonitorPlay size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>{testingChannel.name || "Stream Preview"}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                      {testingChannel.protocol || (isEmbedUrl(testingChannel.url) ? "EMBED" : "HLS")}
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/50 font-mono truncate max-w-lg">
                    {testingChannel.url}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestingChannel(null)}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
              {testingChannel.protocol === 'EMBED' || isEmbedUrl(testingChannel.url) ? (
                <iframe
                  src={extractIframeSrc(testingChannel.url)}
                  frameBorder="0"
                  scrolling="no"
                  allowFullScreen={true}
                  {...{ allowtransparency: "true" }}
                  className="w-full h-full border-0 bg-black"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; screen-wake-lock; focus-without-user-activation; payment"
                  referrerPolicy="no-referrer"
                  style={{
                    overflow: "hidden",
                    overflowX: "hidden",
                    overflowY: "hidden",
                    height: "100%",
                    width: "100%",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: 0,
                  }}
                />
              ) : (
                <iframe
                  src={extractIframeSrc(testingChannel.url)}
                  frameBorder="0"
                  scrolling="no"
                  allowFullScreen={true}
                  {...{ allowtransparency: "true" }}
                  className="w-full h-full border-0 bg-black"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  referrerPolicy="no-referrer"
                  style={{
                    overflow: "hidden",
                    overflowX: "hidden",
                    overflowY: "hidden",
                    height: "100%",
                    width: "100%",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: 0,
                  }}
                />
              )}
            </div>

            <div className="p-4 bg-black/80 border-t border-white/10 flex items-center justify-between">
              <div className="text-[11px] text-white/60 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Sandbox-Free Direct Embed &bull; Autoplay & Fullscreen Enabled</span>
              </div>
              <button
                type="button"
                onClick={() => setTestingChannel(null)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black rounded-xl transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IFRAME UPLOAD & EMBED STUDIO MODAL */}
      {showIframeModal && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass border border-purple-500/40 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <Code size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Iframe Embed & File Uploader</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 font-bold uppercase">
                      Direct & Sandbox-Free
                    </span>
                  </h3>
                  <p className="text-xs text-white/60 font-medium">
                    Upload HTML file or paste raw &lt;iframe&gt; embed code. Stream URLs and titles are parsed automatically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowIframeModal(false); setIframePasteText(""); }}
                className="text-white/40 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 rounded-2xl p-4 text-center bg-purple-950/10 transition-all group cursor-pointer relative">
                <input
                  type="file"
                  accept=".html,.htm,.txt,.m3u"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        if (content) {
                          setIframePasteText(content);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileUp size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Click or drag & drop .html or .txt file here</p>
                    <p className="text-[10px] text-white/50">Supports HTML embed code files, widgets, and multi-iframe playlists</p>
                  </div>
                </div>
              </div>

              {/* Raw Iframe Code Textarea */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                  Or Paste Raw &lt;iframe&gt; Tags or Embed URLs
                </label>
                <textarea
                  rows={4}
                  value={iframePasteText}
                  onChange={(e) => setIframePasteText(e.target.value)}
                  placeholder={`<iframe src="https://streamprovider.com/embed/player?id=12345" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl p-3 text-xs font-mono text-purple-200 placeholder:text-white/20 focus:border-purple-400 outline-none resize-none"
                />
              </div>

              {/* Parsed Results Live Preview */}
              {(() => {
                const parsed = extractAllIframes(iframePasteText);
                const directSrc = extractIframeSrc(iframePasteText);
                const items = parsed.length > 0 
                  ? parsed 
                  : directSrc ? [{ name: "Embedded Player 1", url: directSrc, rawTag: iframePasteText }] : [];

                if (items.length === 0) return null;

                return (
                  <div className="space-y-2 bg-black/40 p-3 rounded-2xl border border-white/10">
                    <div className="flex items-center justify-between text-[11px] font-bold text-purple-300">
                      <span>Detected Streams ({items.length})</span>
                      <span className="text-[10px] text-white/40">Ready to inject</span>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {items.map((item, idx) => (
                        <div key={idx} className="p-2.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{item.name}</p>
                            <p className="text-[10px] font-mono text-cyan-300/80 truncate">{item.url}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTestingChannel({
                              id: `test-embed-${idx}`,
                              name: item.name,
                              url: item.url,
                              protocol: 'EMBED',
                              group: 'Embedded Stream'
                            })}
                            className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0"
                          >
                            <MonitorPlay size={12} /> Test
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 shrink-0 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => { setShowIframeModal(false); setIframePasteText(""); }}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!iframePasteText.trim()}
                onClick={() => {
                  const parsed = extractAllIframes(iframePasteText);
                  const directSrc = extractIframeSrc(iframePasteText);
                  const items = parsed.length > 0 
                    ? parsed 
                    : directSrc ? [{ name: "Embedded Player 1", url: directSrc, rawTag: stripSandbox(iframePasteText) }] : [];

                  if (items.length === 0) {
                    alert("No valid iframe or stream URL found in the input.");
                    return;
                  }

                  if (iframeTargetMode === "form") {
                    // Inject into formData.channels
                    const newChannels = items.map((item, idx) => ({
                      name: item.name || `Iframe Player ${idx + 1}`,
                      url: item.url,
                      protocol: "EMBED" as const,
                      embedCode: stripSandbox(item.rawTag)
                    }));
                    setFormData(prev => ({
                      ...prev,
                      channels: prev.channels.length === 1 && !prev.channels[0].url ? newChannels : [...prev.channels, ...newChannels]
                    }));
                  } else if (iframeTargetMode === "quick") {
                    // Inject into quickChannelsList
                    const newChannels = items.map((item, idx) => ({
                      name: item.name || `Iframe Player ${idx + 1}`,
                      url: item.url,
                      protocol: "EMBED" as const,
                      embedCode: stripSandbox(item.rawTag)
                    }));
                    setQuickChannelsList(prev => (prev.length === 1 && !prev[0].url) ? newChannels : [...prev, ...newChannels]);
                  } else if (iframeTargetMode === "iptv") {
                    // Inject first item into standalone IPTV form
                    const first = items[0];
                    setNewChannelUrl(first.url);
                    if (first.name && (!newChannelName || newChannelName === "Live Channel")) {
                      setNewChannelName(first.name);
                    }
                  }

                  setShowIframeModal(false);
                  setIframePasteText("");
                }}
                className="px-6 py-2.5 bg-purple-500 hover:bg-purple-400 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                <Plus size={13} />
                <span>Inject {iframeTargetMode === "iptv" ? "into Channel Form" : "Channels"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL MATCH DETAILS INTELLIGENCE & INSPECTOR MODAL */}
      {inspectorMatch && (
        <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl w-full my-auto space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between bg-[#0b0f19] p-4 rounded-2xl border border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Match Intelligence & Inspector</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                      ID: {inspectorMatch.id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/50">
                    Comprehensive live data, squads, live timeline, stats & channel routing
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isEnrichingSingle}
                  onClick={() => handleEnrichMatch(inspectorMatch)}
                  className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-95"
                  title="Auto-enrich and save squads, stats, timeline, and venue to Firestore"
                >
                  <Sparkles size={13} className={isEnrichingSingle ? "animate-spin" : ""} />
                  <span>{isEnrichingSingle ? "Saving..." : "⚡ Save Details to DB"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectorMatch(null)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Intelligence Hub Content */}
            <div className="overflow-y-auto flex-1 pr-1">
              <MatchIntelligenceHub
                match={inspectorMatch}
                isAdmin={true}
                onRefreshLiveDetails={() => handleEnrichMatch(inspectorMatch)}
                isRefreshing={isEnrichingSingle}
                onSelectChannel={(chan) => {
                  setTestingChannel({
                    id: `inspect-test-${chan.name}`,
                    name: chan.name,
                    url: chan.url,
                    protocol: chan.protocol || (chan.url?.includes('<iframe') ? 'EMBED' : 'HLS'),
                    group: 'Direct Stream'
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
