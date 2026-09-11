import React, { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FirestoreError, QuerySnapshot } from "firebase/firestore";
import { ChannelList } from "./components/ChannelList";
import { IPTVList } from "./components/IPTVList";
import { MatchDetail } from "./components/MatchDetail";
import { VideoPlayer } from "./components/VideoPlayer";
import { StreamInfoPanel } from "./components/StreamInfoPanel";
import { FloatableLiveChat } from "./components/FloatableLiveChat";
import { BottomNav } from "./components/BottomNav";
import { CategorySlider } from "./components/CategorySlider";
import { LeagueBar } from "./components/LeagueBar";
import { BroadcastHeader, ViewMode } from "./components/BroadcastHeader";
import { HeroSpotlight } from "./components/HeroSpotlight";
import { AmbientBackground } from "./components/AmbientBackground";
import { AdminDashboard } from "./components/AdminDashboard";
import { RequestMatchModal } from "./components/RequestMatchModal";
import { DMCANotice } from "./components/DMCANotice";
import { SponsoredAdModal } from "./components/SponsoredAdModal";
import { TopAnnouncementBar } from "./components/TopAnnouncementBar";
import { NoticeAdPopup } from "./components/NoticeAdPopup";
import { showSponsoredAd } from "./utils/adManager";
import { Channel, Match, StreamItem, StreamServer } from "./types";
import { getMatchSlug } from "./utils/slugUtils";
import { fetchMatches, convertAPIMatchToMatch } from "./utils/streamedApi";
import { motion, AnimatePresence } from "motion/react";
import { parseM3U } from "./utils/m3uParser";
import { M3U_DATA } from "./data/playlist";
import { getMatchDynamicStatus, isMatchVisibleForUser } from "./utils/sportsSchedule";
import { detectStreamProtocol, findPreferredChannel, findPreferredServer } from "./utils/channelLookup";
import { useMatchMetadata } from "./utils/metaManager";
import { useWatchlist } from "./utils/watchlist";
import { useAllMatchesRealtimeViewers } from "./utils/realtimeViewers";
import { 
  ChevronLeft, 
  X, 
  MessageSquarePlus, 
  Send, 
  Sparkles, 
  Radio, 
  Star, 
  Trophy,
  Filter,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Tv
} from "lucide-react";
import { db } from "./lib/firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";

export default function App() {
  return (
    <BrowserRouter>
      <TopAnnouncementBar />
      <NoticeAdPopup />
      <SponsoredAdModal />
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/match/:matchId" element={<MatchDetail />} />
        <Route path="/iptv/:iptvId" element={<IPTVDetail />} />
        <Route path="/domain/iptv/:iptvId" element={<IPTVDetail />} />
        <Route path="/admin" element={<AdminRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

function AdminRoute() {
  const navigate = useNavigate();
  return <AdminDashboard onBack={() => navigate("/")} />;
}

function IPTVDetail() {
  const { iptvId } = useParams<{ iptvId: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const { watchlist } = useWatchlist();

  useMatchMetadata(null, channel);

  useEffect(() => {
    if (!iptvId) return;

    const channels = parseM3U(M3U_DATA);
    const numericIndex = Number(iptvId);
    const directMatch = Number.isInteger(numericIndex) && numericIndex > 0 ? channels[numericIndex - 1] : undefined;

    if (directMatch) {
      setChannel(directMatch);
      return;
    }

    const decodedId = decodeURIComponent(iptvId);
    const found = channels.find((item) => encodeURIComponent(item.url) === decodedId || item.id === decodedId);
    setChannel(found || null);
  }, [iptvId]);

  if (!channel) {
    return (
      <div className="min-h-screen bg-[#06080e] text-white flex items-center justify-center ambient-cinema-bg">
        <div className="text-center p-8 rounded-3xl bg-[#0c101c] border border-white/10 max-w-md">
          <h1 className="text-xl font-bold mb-3">IPTV Broadcast Not Found</h1>
          <p className="text-xs text-white/50 mb-6">The requested IPTV feed is currently offline or moved.</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-cyan-500 text-black font-black text-xs uppercase rounded-xl hover:bg-cyan-400 transition-all cursor-pointer shadow-lg"
          >
            Back to Broadcasts
          </button>
        </div>
      </div>
    );
  }

  const pseudoMatch: Match = {
    id: `iptv-${iptvId}`,
    team1: channel.name,
    team1Logo: channel.logo || "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=200&q=80",
    team2: channel.group,
    team2Logo: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=200&q=80",
    category: channel.group,
    startTime: new Date().toISOString(),
    status: "live",
    channels: [{
      name: `${channel.name} (Direct Stream)`,
      url: channel.url,
      userAgent: channel.userAgent,
      referrer: channel.referrer,
      origin: channel.origin,
      cookie: channel.cookie,
      serverLocation: "IPTV HyperNode"
    }],
    createdAt: { seconds: 0, nanoseconds: 0 },
    updatedAt: { seconds: 0, nanoseconds: 0 }
  };

  return (
    <div className="min-h-screen bg-[#04060A] text-white ambient-cinema-bg relative">
      <AmbientBackground />
      <header className="h-16 flex items-center justify-between px-4 sm:px-8 bg-[#04060A]/80 border-b border-white/[0.08] sticky top-0 z-40 shrink-0 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 bg-white/[0.05] hover:bg-white/[0.12] rounded-xl text-white/80 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            <ChevronLeft size={16} />
            <span>Guide</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center overflow-hidden shrink-0">
              <img 
                src="/logo.svg" 
                alt="AR Stream" 
                className="w-full h-full object-contain p-0.5" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <span className="text-base font-black tracking-wider text-white uppercase truncate max-w-[200px] sm:max-w-none">
              AR STREAM • {channel.name}
            </span>
          </div>
        </div>
      </header>

      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-dock-content">
        <div className="relative z-20 apple-ai-card rounded-2xl sm:rounded-3xl overflow-hidden p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 mb-4">
          <VideoPlayer
            streamItem={null}
            match={pseudoMatch}
            onServerChange={() => {}}
            onQualityChange={() => {}}
          />
        </div>

        <div className="relative z-10 pb-6 mt-4">
          <StreamInfoPanel
            streamItem={null}
            match={pseudoMatch}
            activeServer={{
              id: "iptv-default",
              name: `${channel.name} (Direct Stream)`,
              location: "IPTV HyperNode",
              ping: 0,
              url: channel.url,
              userAgent: channel.userAgent,
              referrer: channel.referrer,
              origin: channel.origin,
              cookie: channel.cookie,
              protocol: "HLS"
            }}
            onSelectStream={() => {}}
            featuredStreams={[]}
            currentResolution="Adaptive"
          />
        </div>

        {/* Floatable Apple AI Live Chat Box */}
        <FloatableLiveChat
          matchId={`iptv-${channel.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
          matchTitle={`${channel.name} Live Feed`}
          viewerCount={184}
          isLive={true}
          isOpen={true}
        />
      </div>

      {/* Floating Bottom Navigation Bar for IPTV Detail */}
      <BottomNav
        activeTab="iptv"
        onTabChange={(tab: any) => {
          navigate(`/?tab=${tab}`);
        }}
        liveCount={1}
        savedCount={watchlist.length}
        onRequestMatchClick={() => setShowRequestModal(true)}
      />

      {/* Request Match Modal */}
      <RequestMatchModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
      />
    </div>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as "sports" | "iptv" | "watchlist" | null;
  const [activeTab, setActiveTab] = useState<"sports" | "iptv" | "watchlist">(tabParam || "sports");

  useEffect(() => {
    if (tabParam && (tabParam === "sports" || tabParam === "iptv" || tabParam === "watchlist")) {
      setActiveTab(tabParam);
      if (tabParam === "watchlist") {
        setShowSavedOnly(true);
      } else {
        setShowSavedOnly(false);
      }
    }
  }, [tabParam]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeLeague, setActiveLeague] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isLiveOnly, setIsLiveOnly] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Watchlist integration
  const { watchlist, isSaved } = useWatchlist();

  // Selected Media States
  const [currentStream, setCurrentStream] = useState<StreamItem | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>(() => {
    try {
      const cached = localStorage.getItem("ar_matches_cache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [firestoreMatches, setFirestoreMatches] = useState<Match[]>([]);
  const [autoStreamMatches, setAutoStreamMatches] = useState<Match[]>([]);
  const [showPlayer, setShowPlayer] = useState(false);

  // Merge Firestore Matches with 24/7 Automated Stream Pool
  useEffect(() => {
    const merged: Match[] = [...firestoreMatches];
    const seenIds = new Set(merged.map((m) => m.id));
    const seenTitles = new Set(
      merged.map((m) => `${m.team1.toLowerCase().trim()} vs ${m.team2.toLowerCase().trim()}`)
    );

    autoStreamMatches.forEach((autoM) => {
      const titleKey = `${autoM.team1.toLowerCase().trim()} vs ${autoM.team2.toLowerCase().trim()}`;
      const existingIndex = merged.findIndex(
        (m) =>
          m.id === autoM.id ||
          (m.streamedId && m.streamedId === autoM.streamedId) ||
          `${m.team1.toLowerCase().trim()} vs ${m.team2.toLowerCase().trim()}` === titleKey
      );

      if (existingIndex >= 0) {
        // If Firestore match exists but has 0 active streams, automatically attach discovered streams!
        if (!merged[existingIndex].channels || merged[existingIndex].channels.length === 0) {
          merged[existingIndex] = {
            ...merged[existingIndex],
            channels: autoM.channels,
            sources: autoM.sources || merged[existingIndex].sources,
          };
        }
      } else if (!seenIds.has(autoM.id) && !seenTitles.has(titleKey)) {
        merged.push(autoM);
        seenIds.add(autoM.id);
        seenTitles.add(titleKey);
      }
    });

    if (merged.length > 0) {
      setMatches(merged);
      try {
        localStorage.setItem("ar_matches_cache", JSON.stringify(merged));
      } catch (e) {
        console.warn("Local storage cache notice:", e);
      }
    }
  }, [firestoreMatches, autoStreamMatches]);

  // Diagnostics & Quality
  const [activeServer, setActiveServer] = useState<StreamServer | null>(null);
  const [currentQuality, setCurrentQuality] = useState<string>("auto");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const liveViewersMap = useAllMatchesRealtimeViewers();

  // Dynamic SEO metadata
  useMatchMetadata(selectedMatch, null, currentStream);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter Active Matches
  const activeMatches = matches.filter(m => isMatchVisibleForUser(m, nowMs));
  const liveCount = activeMatches.filter(m => getMatchDynamicStatus(m, nowMs).isLive).length;
  const upcomingCount = activeMatches.filter(m => getMatchDynamicStatus(m, nowMs).isUpcoming).length;
  const finishedCount = activeMatches.filter(m => getMatchDynamicStatus(m, nowMs).isFinished).length;
  const savedCount = activeMatches.filter(m => isSaved(m.id)).length;

  // Category live counts calculation
  const categoryLiveCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activeMatches.forEach((m) => {
      if (getMatchDynamicStatus(m, nowMs).isLive) {
        const cat = (m.category || "other").toLowerCase();
        counts[cat] = (counts[cat] || 0) + 1;
        counts["all"] = (counts["all"] || 0) + 1;
      }
    });
    return counts;
  }, [activeMatches, nowMs]);

  const STATUS_FILTERS = [
    { id: "all", label: "All Events", count: activeMatches.length },
    { id: "live", label: "Live Broadcasts", count: liveCount, isLive: true },
    { id: "upcoming", label: "Upcoming Schedule", count: upcomingCount },
    { id: "finished", label: "Recently Finished", count: finishedCount },
  ];

  // Automated Match & Stream Ingestion
  useEffect(() => {
    let isMounted = true;

    // 1. Direct getDocs from Firestore
    getDocs(collection(db, "matches"))
      .then((snapshot) => {
        if (!isMounted) return;
        if (!snapshot.empty) {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Match[];
          setFirestoreMatches(data);
        }
      })
      .catch((err) => console.warn("Direct Firestore notice:", err));

    // 2. Real-time Snapshot from Firestore
    const unsub = onSnapshot(collection(db, "matches"), {
      next: (snapshot: QuerySnapshot) => {
        if (!isMounted) return;
        if (!snapshot.empty) {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Match[];
          setFirestoreMatches(data);
        }
      },
      error: (error: FirestoreError) => {
        console.warn("Firestore Snapshot notice:", error);
      }
    });

    // 3. Automated Stream Pool Fetcher (every 45 seconds)
    const fetchAutoStreams = async () => {
      try {
        const res = await fetch("/api/streamed/auto-matches");
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.matches)) {
          setAutoStreamMatches(json.matches);
        }
      } catch (err) {
        console.warn("Auto-matches probe notice:", err);
      }
    };

    fetchAutoStreams();
    const autoInterval = setInterval(fetchAutoStreams, 45000);

    return () => {
      isMounted = false;
      clearInterval(autoInterval);
      unsub();
    };
  }, []);

  const handleSelectFeatured = (stream: StreamItem) => {
    showSponsoredAd(() => {
      setSelectedMatch(null);
      setCurrentStream(stream);
      setShowPlayer(true);
      if (stream.servers && stream.servers.length > 0) {
        const preferredServer = findPreferredServer(stream.servers) || stream.servers[0];
        setActiveServer(preferredServer);
      }
    });
  };

  const handleSelectMatch = (match: Match) => {
    showSponsoredAd(() => {
      if (match.id.startsWith("iptv-")) {
        const routeId = match.id.replace(/^iptv-/, "");
        navigate(`/iptv/${routeId}`);
        return;
      }

      // Store in instant local cache for zero-latency loading on the dedicated page
      try {
        localStorage.setItem("current_active_match", JSON.stringify(match));
        const stored = localStorage.getItem("ar_matches_cache");
        const list: Match[] = stored ? JSON.parse(stored) : [];
        const filtered = list.filter((m) => m.id !== match.id);
        filtered.unshift(match);
        localStorage.setItem("ar_matches_cache", JSON.stringify(filtered.slice(0, 50)));
      } catch (e) {
        // no-op
      }

      // Close any home player state
      setShowPlayer(false);
      setSelectedMatch(null);
      setCurrentStream(null);

      // Navigate to human-friendly match slug (e.g., /match/rma-vs-int or /match/barca-vs-realmadrid)
      const slug = getMatchSlug(match);
      navigate(`/match/${slug}`, { state: { matchDocId: match.id } });
    });
  };

  const effectiveStatus = isLiveOnly ? "live" : activeStatus;
  const effectiveCategory = activeCategory;

  return (
    <div className="flex flex-col h-screen bg-[#04060A] text-white selection:bg-white/20 selection:text-white overflow-hidden ambient-cinema-bg relative">
      {/* Dynamic Ambient Aurora & Stadium Lights Canvas */}
      <AmbientBackground />

      {/* Redesigned Studio Broadcast Header */}
      <BroadcastHeader
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isLiveOnly={isLiveOnly}
        onToggleLiveOnly={() => setIsLiveOnly(prev => !prev)}
        showSavedOnly={showSavedOnly || activeTab === "watchlist"}
        onToggleSavedOnly={() => {
          if (activeTab === "watchlist") {
            setActiveTab("sports");
            setShowSavedOnly(false);
          } else {
            setShowSavedOnly(prev => !prev);
          }
        }}
        savedCount={savedCount}
        liveCount={liveCount}
        onRequestMatchClick={() => setShowRequestModal(true)}
        onResetToHome={() => {
          setSelectedMatch(null);
          setCurrentStream(null);
          setActiveTab("sports");
          setSearch("");
          setActiveCategory("all");
          setActiveLeague("");
          setIsLiveOnly(false);
          setShowSavedOnly(false);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
          {/* Cinema Live Player Overlay */}
          {showPlayer && (
            <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
              <div className="relative rounded-3xl overflow-hidden apple-card border border-white/15 shadow-[0_24px_50px_rgba(0,0,0,0.8)]">
                {/* Close Player Bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.04] border-b border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#FF453A] animate-pulse" />
                    <span className="font-semibold text-white tracking-tight">
                      {selectedMatch ? `${selectedMatch.team1} vs ${selectedMatch.team2}` : currentStream?.title || "Active Broadcast"}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowPlayer(false)}
                    className="p-1.5 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <X size={14} />
                    <span>Minimize</span>
                  </button>
                </div>

                <div className="p-1 sm:p-2">
                  <VideoPlayer 
                    streamItem={currentStream}
                    match={selectedMatch}
                    onServerChange={(srv) => setActiveServer(srv)}
                    onQualityChange={(q) => setCurrentQuality(q)}
                  />
                </div>
              </div>

              <div className="relative z-10 pb-6 mt-4">
                <StreamInfoPanel
                  streamItem={currentStream}
                  match={selectedMatch}
                  activeServer={activeServer}
                  onSelectStream={handleSelectFeatured}
                  featuredStreams={[]}
                  currentResolution={currentQuality !== "auto" ? currentQuality.toUpperCase() : undefined}
                />
              </div>
            </div>
          )}

          {/* Main Browsing Sections */}
          <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-dock-content space-y-5">
            {/* Live Sports Tab */}
            {activeTab === "sports" && (
              <>
                {/* Hero Spotlight Carousel (Shown if not searching and has matches) */}
                {!search && !showSavedOnly && !isLiveOnly && activeCategory === "all" && !activeLeague && (
                  <HeroSpotlight
                    matches={activeMatches}
                    onSelectMatch={handleSelectMatch}
                    nowMs={nowMs}
                    liveViewersMap={liveViewersMap}
                  />
                )}

                {/* Sports Category Strip */}
                <div className="space-y-3">
                  <CategorySlider 
                    activeCategory={effectiveCategory} 
                    onCategoryChange={setActiveCategory}
                    categoryLiveCounts={categoryLiveCounts}
                  />

                  {/* League Fast Switcher */}
                  <LeagueBar
                    activeLeague={activeLeague}
                    onSelectLeague={setActiveLeague}
                  />
                </div>

                {/* Status Tabs (All, Live, Upcoming, Finished) */}
                <div className="flex items-center justify-between gap-3 pt-1 border-b border-white/[0.06] pb-3 flex-wrap">
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1">
                    {STATUS_FILTERS.map((filter) => {
                      const isActive = effectiveStatus === filter.id;
                      return (
                        <button
                          key={filter.id}
                          onClick={() => {
                            if (isLiveOnly) setIsLiveOnly(false);
                            setActiveStatus(filter.id);
                          }}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all whitespace-nowrap cursor-pointer touch-manipulation active:scale-95 ${
                            isActive 
                              ? "bg-white text-black border-white shadow-sm font-semibold" 
                              : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08]"
                          }`}
                        >
                          {filter.isLive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A] animate-pulse" />
                          )}
                          <span>{filter.label}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                            isActive ? "bg-black/10 text-black font-semibold" : "bg-white/10 text-white/60"
                          }`}>
                            {filter.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Filter Status Note */}
                  <div className="text-[11px] text-white/40 font-mono hidden sm:block">
                    {showSavedOnly ? "Showing Watchlist Matches" : `Showing ${activeMatches.length} Filtered Broadcasts`}
                  </div>
                </div>

                {/* Fixtures List (Grid, EPG, or Compact View) */}
                <ChannelList
                  matches={activeMatches.filter(m => {
                    if (activeLeague) {
                      const l = (m.league || m.tournament || "").toLowerCase();
                      if (!l.includes(activeLeague.toLowerCase())) return false;
                    }
                    return true;
                  })}
                  selectedMatchId={selectedMatch?.id}
                  onSelect={handleSelectMatch}
                  search={search}
                  activeCategory={effectiveCategory}
                  activeStatus={effectiveStatus}
                  viewMode={viewMode}
                  showSavedOnly={showSavedOnly}
                />

                {/* Request a Match Prompt Banner */}
                <div className="rounded-3xl p-5 sm:p-6 apple-card flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 text-center sm:text-left">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center text-white shrink-0">
                      <MessageSquarePlus size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        Missing A Specific Match or Derby?
                      </h4>
                      <p className="text-xs text-white/50 mt-0.5">
                        Send a quick fixture request and our curators will add live verified links.
                      </p>
                    </div>
                  </div>

                  <button
                    id="request-match-banner-btn"
                    onClick={() => setShowRequestModal(true)}
                    className="px-6 py-2.5 rounded-full apple-btn-primary text-black font-semibold text-xs flex items-center gap-2 active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Submit Request</span>
                  </button>
                </div>
              </>
            )}

            {/* IPTV Guide Tab */}
            {activeTab === "iptv" && (
              <IPTVList 
                onSelect={handleSelectMatch} 
                search={search} 
              />
            )}

            {/* Watchlist Dedicated Tab */}
            {activeTab === "watchlist" && (
              <div className="space-y-4">
                <div className="p-5 rounded-3xl apple-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 flex items-center justify-center text-[#FF9F0A]">
                      <Star size={24} className="fill-[#FF9F0A]" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        My Bookmarked Watchlist
                      </h2>
                      <p className="text-xs text-white/50">
                        Quick access to your starred matches and favorite sporting events.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 text-[#FF9F0A] font-mono text-xs font-semibold">
                    {savedCount} Saved
                  </span>
                </div>

                <ChannelList
                  matches={activeMatches}
                  selectedMatchId={selectedMatch?.id}
                  onSelect={handleSelectMatch}
                  search={search}
                  activeCategory="all"
                  activeStatus="all"
                  viewMode={viewMode}
                  showSavedOnly={true}
                />
              </div>
            )}

            {/* DMCA Legal Compliance Notice */}
            <div className="pt-4">
              <DMCANotice />
            </div>
          </div>
        </div>
      </main>

      {/* Floating Bottom Navigation Dock */}
      <BottomNav 
        activeTab={activeTab} 
        onTabChange={(tab: any) => {
          setActiveTab(tab);
          setSearchParams({ tab });
          if (tab === "watchlist") {
            setShowSavedOnly(true);
          } else {
            setShowSavedOnly(false);
          }
        }}
        liveCount={liveCount}
        savedCount={savedCount}
        onRequestMatchClick={() => setShowRequestModal(true)}
      />

      {/* Request a Match Dialog */}
      <RequestMatchModal 
        isOpen={showRequestModal} 
        onClose={() => setShowRequestModal(false)} 
      />
    </div>
  );
}
