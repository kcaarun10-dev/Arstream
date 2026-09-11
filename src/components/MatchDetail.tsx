import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { db } from "../lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  type DocumentData,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Match, MatchChannel, StreamServer } from "../types";
import { VideoPlayer } from "./VideoPlayer";
import { StreamInfoPanel } from "./StreamInfoPanel";
import { FloatableLiveChat } from "./FloatableLiveChat";
import { AmbientBackground } from "./AmbientBackground";
import { BottomNav } from "./BottomNav";
import { RequestMatchModal } from "./RequestMatchModal";
import { useWatchlist } from "../utils/watchlist";
import { useRealtimeViewers } from "../utils/realtimeViewers";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Share2, Copy, Check, Radio, Clock, Play, ArrowRight, Trophy, MessageSquare, Server, Zap, Info, AlertCircle } from "lucide-react";
import { detectStreamProtocol, findPreferredChannel, findPreferredServer, isChannelEmbed, isEmbedUrl, extractIframeSrc } from "../utils/channelLookup";
import { useMatchMetadata } from "../utils/metaManager";
import { showSponsoredAd } from "../utils/adManager";
import { getMatchDynamicStatus, isCategoryMatch, formatRemainingTimer } from "../utils/sportsSchedule";
import { getMatchSlug, generateMatchSlug, formatMatchShortUrl, sanitizeSlug, isMatchSlugMatch, findBestMatchingMatch } from "../utils/slugUtils";
import { fetchAllStreamsForMatch, mapStreamToStreamServer } from "../utils/streamedApi";

export function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const stateDocId = (location.state as any)?.matchDocId;

  // Instant optimistic retrieval from localStorage cache supporting both ID and slug (e.g. rma-vs-int or barca-vs-realmadrid)
  const cachedMatch = React.useMemo(() => {
    if (!matchId) return null;
    try {
      const activeRaw = localStorage.getItem("current_active_match");
      if (activeRaw) {
        const activeMatch: Match = JSON.parse(activeRaw);
        if (stateDocId && activeMatch.id === stateDocId) {
          return activeMatch;
        }
        if (activeMatch.id === matchId || (activeMatch.slug && activeMatch.slug === matchId) || isMatchSlugMatch(activeMatch, matchId)) {
          return activeMatch;
        }
      }

      const stored = localStorage.getItem("ar_matches_cache");
      if (stored) {
        const list: Match[] = JSON.parse(stored);
        if (stateDocId) {
          const direct = list.find((m) => m.id === stateDocId);
          if (direct) return direct;
        }
        return findBestMatchingMatch(list, matchId);
      }
    } catch {
      // no-op
    }
    return null;
  }, [matchId, stateDocId]);

  const [match, setMatch] = useState<Match | null>(cachedMatch);

  // Sync SEO metadata, OpenGraph cards, and Schema.org rich results
  useMatchMetadata(match);
  const [relatedMatches, setRelatedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(!cachedMatch);
  const [activeServer, setActiveServer] = useState<StreamServer | null>(() => {
    if (cachedMatch && cachedMatch.channels && cachedMatch.channels.length > 0) {
      const preferred = findPreferredChannel(cachedMatch.channels) || cachedMatch.channels[0];
      const cleanUrl = preferred.url?.trim() || "";
      return {
        id: `chan-${cachedMatch.id}`,
        name: preferred.name,
        location: preferred.serverLocation || "Global Edge",
        ping: typeof preferred.ping === "number" ? preferred.ping : 0,
        url: cleanUrl,
        userAgent: preferred.userAgent,
        referrer: preferred.referrer,
        origin: preferred.origin,
        cookie: preferred.cookie,
        protocol: detectStreamProtocol(cleanUrl, preferred.protocol),
      };
    }
    return null;
  });
  const [currentQuality, setCurrentQuality] = useState<string>("auto");
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "overview">("chat");
  const { watchlist, isSaved } = useWatchlist();
  const realtimeStats = useRealtimeViewers(match, null, true);

  // Dynamic live streams fetched from Streamed.pk sources (Alpha, Bravo, Charlie, Echo, etc.)
  const [streamedLiveServers, setStreamedLiveServers] = useState<StreamServer[]>([]);
  const [isFetchingStreamedSources, setIsFetchingStreamedSources] = useState<boolean>(false);

  useEffect(() => {
    if (!match?.sources || !Array.isArray(match.sources) || match.sources.length === 0) {
      setStreamedLiveServers([]);
      return;
    }

    let isMounted = true;
    setIsFetchingStreamedSources(true);

    fetchAllStreamsForMatch(match.sources)
      .then((streams) => {
        if (!isMounted) return;
        if (streams && streams.length > 0) {
          const mappedServers = streams.map((s, idx) => mapStreamToStreamServer(s, idx));
          setStreamedLiveServers(mappedServers);
        }
      })
      .catch((err) => {
        console.warn("Notice: Streamed live streams probe:", err);
      })
      .finally(() => {
        if (isMounted) setIsFetchingStreamedSources(false);
      });

    return () => {
      isMounted = false;
    };
  }, [match?.id, JSON.stringify(match?.sources || [])]);

  // Consolidate all available stream servers for this single match with smart backup fallbacks
  const allAvailableServers: StreamServer[] = React.useMemo(() => {
    const rawList: MatchChannel[] = [];
    if (match?.channels && Array.isArray(match.channels)) {
      match.channels.forEach((c) => {
        const rawUrl = c?.url?.trim() || "";
        const rawEmbed = (c as any)?.embedCode?.trim() || "";
        const effectiveUrl = rawUrl || (rawEmbed ? extractIframeSrc(rawEmbed) : "");
        if (effectiveUrl) {
          rawList.push({
            ...c,
            name: c.name?.trim() || `Stream ${rawList.length + 1}`,
            url: effectiveUrl,
          });
        }
      });
    }
    if ((match as any)?.streams && Array.isArray((match as any).streams)) {
      (match as any).streams.forEach((s: any) => {
        const rawUrl = s?.url?.trim() || "";
        if (rawUrl && !rawList.some((c) => c.url === rawUrl)) {
          rawList.push({
            name: s.name?.trim() || `Stream ${rawList.length + 1}`,
            url: rawUrl,
            protocol: s.protocol || detectStreamProtocol(rawUrl),
            serverLocation: s.location || "Global Edge",
          });
        }
      });
    }

    // Prioritize native HLS / non-embed channels first so the primary stream is always HLS
    const sortedList = [...rawList].sort((a, b) => {
      const aEmbed = isChannelEmbed(a);
      const bEmbed = isChannelEmbed(b);
      if (!aEmbed && bEmbed) return -1;
      if (aEmbed && !bEmbed) return 1;

      const aProto = detectStreamProtocol(a.url, a.protocol);
      const bProto = detectStreamProtocol(b.url, b.protocol);
      if (aProto === "HLS" && bProto !== "HLS") return -1;
      if (aProto !== "HLS" && bProto === "HLS") return 1;
      return 0;
    });

    // Format local channels
    const servers: StreamServer[] = sortedList.map((chan, idx) => {
      const cleanUrl = (chan.url || "").trim();
      const isEmbed = isChannelEmbed(chan);
      const proto = detectStreamProtocol(cleanUrl, chan.protocol);
      return {
        id: `chan-${idx}`,
        name: chan.name || `Stream ${idx + 1}`,
        location: chan.serverLocation || "Global Edge",
        ping: typeof chan.ping === "number" && chan.ping > 0 ? chan.ping : 18 + idx * 7,
        badge: isEmbed ? "EMBED" : proto === "HLS" ? (idx === 0 ? "PRIMARY HLS" : "HLS HD") : (idx === 0 ? "1080P HD" : `MIRROR ${idx + 1}`),
        url: cleanUrl,
        userAgent: chan.userAgent,
        referrer: chan.referrer,
        origin: chan.origin,
        cookie: chan.cookie,
        protocol: proto,
      };
    });

    // Merge in dynamic streams from Streamed.pk if available
    streamedLiveServers.forEach((streamedSrv) => {
      if (!servers.some((s) => s.url === streamedSrv.url)) {
        servers.push(streamedSrv);
      }
    });

    return servers;
  }, [match, streamedLiveServers]);

  // Keep activeServer synced with available list (prioritizing primary HLS stream)
  useEffect(() => {
    if (allAvailableServers.length > 0) {
      setActiveServer((prev) => {
        const preferred = findPreferredServer(allAvailableServers) || allAvailableServers[0];
        if (!prev) return preferred;
        // If current active server is an embed but an HLS server is available, upgrade to HLS as primary!
        const prevIsEmbed = prev.protocol === "EMBED" || isEmbedUrl(prev.url);
        const prefIsHls = preferred.protocol === "HLS" || (preferred.url && preferred.url.toLowerCase().includes(".m3u8"));
        if (prevIsEmbed && prefIsHls) {
          return preferred;
        }
        const exists = allAvailableServers.some((s) => s.url === prev.url);
        return exists ? prev : preferred;
      });
    } else {
      setActiveServer(null);
    }
  }, [allAvailableServers]);

  useEffect(() => {
    if (!matchId) return;

    if (!cachedMatch) {
      setLoading(true);
    }

    const applyMatchData = (matchData: Match) => {
      setMatch(matchData);
      setLoading(false);
      if (matchData.channels && matchData.channels.length > 0) {
        const preferred = findPreferredChannel(matchData.channels) || matchData.channels[0];
        const cleanUrl = preferred.url?.trim() || "";
        setActiveServer((prev) => {
          // If previous was null or an embed, upgrade to preferred HLS
          if (!prev || prev.protocol === "EMBED" || isEmbedUrl(prev.url)) {
            return {
              id: `chan-${matchData.id}`,
              name: preferred.name,
              location: preferred.serverLocation || "Global Edge",
              ping: typeof preferred.ping === "number" ? preferred.ping : 0,
              url: cleanUrl,
              userAgent: preferred.userAgent,
              referrer: preferred.referrer,
              origin: preferred.origin,
              cookie: preferred.cookie,
              protocol: detectStreamProtocol(cleanUrl, preferred.protocol),
            };
          }
          return prev;
        });
      }
    };

    // 1. Direct fetch if matchId or stateDocId might be a document id
    const targetDocId = stateDocId || matchId;
    if (targetDocId) {
      getDoc(doc(db, "matches", targetDocId))
        .then((docSnap) => {
          if (docSnap.exists()) {
            applyMatchData({ id: docSnap.id, ...docSnap.data() } as Match);
          }
        })
        .catch((e) => console.warn("Direct getDoc notice:", e));
    }

    // 2. Real-time collection listener to resolve by doc id, slug, or team names
    const unsub = onSnapshot(collection(db, "matches"), {
      next: (snapshot) => {
        setLoading(false);
        const allMatches = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Match[];
        const queryTarget = stateDocId || matchId;
        const found = findBestMatchingMatch(allMatches, queryTarget);

        if (found) {
          applyMatchData(found);
        } else if (!cachedMatch) {
          setMatch(null);
        }
      },
      error: (error) => {
        console.warn("Match snapshot error:", error);
        setLoading(false);
      }
    });

    return () => unsub();
  }, [matchId, stateDocId, cachedMatch]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "matches"), {
      next: (snapshot: QuerySnapshot<DocumentData>) => {
        const now = Date.now();
        const items = snapshot.docs.map((documentSnapshot: QueryDocumentSnapshot<DocumentData>) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })) as Match[];

        const currentId = matchId || "";

        // Strictly filter out any match that has ended or finished
        const activeMatches = items.filter((item) => {
          if (item.id === currentId) return false;
          if (item.status === "ended" || item.status === "finished") return false;

          const dyn = getMatchDynamicStatus(item, now);
          if (dyn.isEnded || dyn.isFinished || dyn.status === "ended" || dyn.status === "finished") {
            return false;
          }
          return true;
        });

        // First prioritize matches matching current category / tournament
        const categoryRelated = activeMatches.filter((item) => {
          if (!match?.category) return true;
          return (
            isCategoryMatch(item.category, item.tournament, match.category) ||
            item.category?.toLowerCase() === match.category?.toLowerCase() ||
            (match.tournament && item.tournament && item.tournament.toLowerCase().includes(match.tournament.toLowerCase()))
          );
        });

        // If fewer than 3, backfill with other active live/upcoming streams (still non-ended)
        if (categoryRelated.length < 3) {
          const otherActive = activeMatches.filter((item) => !categoryRelated.some((r) => r.id === item.id));
          categoryRelated.push(...otherActive.slice(0, 3 - categoryRelated.length));
        }

        setRelatedMatches(categoryRelated.slice(0, 6));
      },
      error: (error) => {
        console.warn("Related matches snapshot error:", error);
      }
    });

    return unsub;
  }, [match?.category, match?.tournament, matchId]);

  const handleShare = async () => {
    const shortUrlText = match ? formatMatchShortUrl(match) : `arstream.ai.studio/match/${sanitizeSlug(matchId || "")}`;
    const fullUrl = `${window.location.origin}/match/${match ? getMatchSlug(match) : sanitizeSlug(matchId || "")}`;
    try {
      if (navigator.share) {
        await navigator.share({ 
          title: match?.team1 ? `${match.team1} vs ${match.team2}` : "Live Match Stream", 
          text: `Watch ${match?.team1 || "Match"} live on AR Stream: ${shortUrlText}`,
          url: fullUrl 
        });
        return;
      }
      await navigator.clipboard.writeText(shortUrlText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to share or copy:", error);
      try {
        await navigator.clipboard.writeText(shortUrlText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // no-op
      }
    }
  };

  const handleCopyLink = async () => {
    const shortUrlText = match ? formatMatchShortUrl(match) : `arstream.ai.studio/match/${sanitizeSlug(matchId || "")}`;
    try {
      await navigator.clipboard.writeText(shortUrlText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080c] text-white flex items-center justify-center ambient-cinema-bg">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/50">Loading match...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-[#06080c] text-white flex items-center justify-center ambient-cinema-bg">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Match Not Found</h1>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-cyan-500 text-black font-bold rounded-xl hover:bg-cyan-400 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060A] text-white ambient-cinema-bg relative">
      <AmbientBackground />
      <div className="relative z-10">
        <header className="h-16 flex items-center justify-between px-4 sm:px-8 liquid-glass border-b border-white/10 sticky top-0 z-40 shrink-0 backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-xl text-white/80 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div 
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div className="w-8 h-8 rounded-xl bg-[#080b12] border border-cyan-400/30 shadow-[0_0_15px_rgba(0,242,254,0.2)] flex items-center justify-center overflow-hidden shrink-0">
              <img 
                src="/logo.svg" 
                alt="AR Stream" 
                className="w-full h-full object-contain p-0.5" 
                loading="eager"
                referrerPolicy="no-referrer" 
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">
                AR STREAM
              </span>
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-400/30 text-[9px] font-mono font-bold text-cyan-300">
                HD STREAM
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Chat Hide / Show Header Button */}
          <button
            id="header-chat-toggle-btn"
            onClick={() => setShowChat((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 cursor-pointer ${
              showChat
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_12px_rgba(0,242,254,0.25)]"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/15 hover:text-white"
            }`}
            title={showChat ? "Hide Live Chat" : "Show Live Chat"}
          >
            <MessageSquare size={14} className={showChat ? "text-cyan-400" : "text-white/60"} />
            <span>{showChat ? "Hide Chat" : "Show Chat"}</span>
          </button>
          <button
            onClick={handleShare}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-xl text-white/80 hover:text-white transition-all"
            title="Share match"
          >
            {copied ? <Check size={20} className="text-green-400" /> : <Share2 size={20} />}
          </button>
          <button
            onClick={handleCopyLink}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-xl text-white/80 hover:text-white transition-all"
            title="Copy link"
            aria-label="Copy match link"
          >
            <Copy size={20} />
          </button>
        </div>
      </header>

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 pb-dock-content">
        {/* Responsive Layout: Theater Player & Multi-Streams + Simultaneous Live Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Main Column: Player, Stream Servers Bar, Overview / Mobile Docked Chat */}
          <div className={`${showChat ? "lg:col-span-8" : "lg:col-span-12"} space-y-4 transition-all duration-300`}>
            {/* Sticky Player Wrapper on Mobile so stream stays visible while chatting */}
            <div className="sticky top-14 sm:static z-30 bg-[#07090e]/95 sm:bg-transparent backdrop-blur-md pb-1 sm:pb-0 -mx-3 sm:mx-0 px-3 sm:px-0 transition-all">
              <div className="apple-ai-card rounded-2xl sm:rounded-3xl overflow-hidden p-1 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10">
                <VideoPlayer
                  streamItem={null}
                  match={match}
                  currentServer={activeServer}
                  onServerChange={(srv) => setActiveServer(srv)}
                  onQualityChange={(q) => setCurrentQuality(q)}
                  showChat={showChat}
                  onToggleChat={() => setShowChat((prev) => !prev)}
                />
              </div>
            </div>

            {/* QUICK STREAM SERVERS SWITCHER (Instant 1-tap switching on Mobile & PC) */}
            {allAvailableServers.length > 0 ? (
              <div className="apple-ai-card rounded-2xl p-3 sm:p-3.5 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
                    <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                      <Server size={14} className="text-cyan-400" />
                      <span>Stream Sources ({allAvailableServers.length})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-cyan-300 font-mono font-medium hidden xs:inline">
                      {activeServer ? activeServer.name : "Select Stream"}
                    </span>
                    <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 hidden sm:inline">
                      Switch if buffering
                    </span>
                  </div>
                </div>

                {/* Scrollable Stream Server Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide touch-pan-x">
                  {allAvailableServers.map((srv, sIdx) => {
                    const isActive = activeServer?.url === srv.url || (!activeServer && sIdx === 0);
                    return (
                      <button
                        key={`stream-srv-${sIdx}-${srv.id || srv.name}`}
                        id={`stream-srv-btn-${sIdx}`}
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                            (navigator as any).vibrate(15);
                          }
                          showSponsoredAd();
                          setActiveServer(srv);
                        }}
                        className={`group shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                          isActive
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_16px_rgba(0,242,254,0.3)] ring-1 ring-cyan-400/40"
                            : "bg-white/[0.04] border-white/10 hover:border-white/20 text-white/70 hover:text-white hover:bg-white/[0.08]"
                        }`}
                        title={`Switch to ${srv.name}`}
                      >
                        <div className="relative flex items-center justify-center">
                          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-cyan-400 animate-ping opacity-75" : "bg-white/30"}`} />
                          <div className={`w-1.5 h-1.5 rounded-full absolute ${isActive ? "bg-cyan-300" : "bg-white/50"}`} />
                        </div>
                        <span className="font-bold tracking-tight">{srv.name}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono uppercase font-extrabold ${
                          isActive ? "bg-cyan-400 text-black" : "bg-white/10 text-white/60 group-hover:text-white"
                        }`}>
                          {srv.badge || (sIdx === 0 ? "PRIMARY" : `SERVER ${sIdx + 1}`)}
                        </span>
                        <span className="text-[10px] font-mono text-white/40 hidden sm:inline">
                          {srv.ping}ms
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="apple-ai-card rounded-2xl p-4 border border-white/10 bg-white/[0.02] text-center text-xs text-white/60 flex items-center justify-center gap-2.5">
                <AlertCircle size={16} className="text-cyan-400 shrink-0" />
                <span>No stream sources uploaded yet for this match. Sources will be published when the broadcast goes live.</span>
              </div>
            )}

            {/* Mobile View Toggle: Live Chat (Watch & Chat) vs Match Overview */}
            <div className="lg:hidden space-y-1.5">
              <div className="relative flex items-center p-1 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-md">
                <button
                  id="mobile-tab-chat-btn"
                  onClick={() => setMobileTab("chat")}
                  className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer z-10 ${
                    mobileTab === "chat" ? "text-cyan-300" : "text-white/60 hover:text-white"
                  }`}
                >
                  {mobileTab === "chat" && (
                    <motion.div
                      layoutId="mobileActiveTabIndicator"
                      className="absolute inset-0 bg-cyan-500/20 border border-cyan-400/40 rounded-xl shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <MessageSquare size={14} className={mobileTab === "chat" ? "text-cyan-400" : "text-white/50"} />
                  <span className="relative z-10">Live Chat (Watch & Chat)</span>
                </button>
                <button
                  id="mobile-tab-info-btn"
                  onClick={() => setMobileTab("overview")}
                  className={`relative flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer z-10 ${
                    mobileTab === "overview" ? "text-black font-extrabold" : "text-white/60 hover:text-white"
                  }`}
                >
                  {mobileTab === "overview" && (
                    <motion.div
                      layoutId="mobileActiveTabIndicator"
                      className="absolute inset-0 bg-white rounded-xl shadow-md"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <Info size={14} className={mobileTab === "overview" ? "text-black" : "text-white/50"} />
                  <span className="relative z-10">Match Overview</span>
                </button>
              </div>
              <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 font-mono">
                <span>‹</span>
                <span>Swipe left/right to toggle Live Chat and Info</span>
                <span>›</span>
              </div>
            </div>

            {/* Mobile Smooth Swipeable Viewport */}
            <div className="lg:hidden overflow-hidden touch-pan-y">
              <AnimatePresence mode="wait">
                {mobileTab === "chat" ? (
                  <motion.div
                    key="mobile-live-chat"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ type: "spring", stiffness: 340, damping: 30 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_e, { offset, velocity }) => {
                      if (offset.x < -45 || velocity.x < -250) {
                        setMobileTab("overview");
                      }
                    }}
                    className="w-full h-[460px] sm:h-[500px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl"
                  >
                    <FloatableLiveChat
                      matchId={match?.id || matchId || "live_stream"}
                      matchTitle={match ? `${match.team1} vs ${match.team2}` : "Live Match"}
                      viewerCount={realtimeStats.viewers}
                      isLive={true}
                      isOpen={true}
                      docked={true}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mobile-match-overview"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ type: "spring", stiffness: 340, damping: 30 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_e, { offset, velocity }) => {
                      if (offset.x > 45 || velocity.x > 250) {
                        setMobileTab("chat");
                      }
                    }}
                    className="space-y-6"
                  >
                    <StreamInfoPanel
                      streamItem={null}
                      match={match}
                      activeServer={activeServer}
                      liveViewerCount={realtimeStats.viewers}
                      onSelectStream={(srv) => {
                        showSponsoredAd();
                        setActiveServer(srv);
                      }}
                      onSwitchStreamServer={() => {
                        if (allAvailableServers.length > 1) {
                          const cIdx = allAvailableServers.findIndex((s) => s.url === activeServer?.url);
                          const nIdx = (cIdx + 1) % allAvailableServers.length;
                          setActiveServer(allAvailableServers[nIdx]);
                        }
                      }}
                      featuredStreams={[]}
                      currentResolution={currentQuality === "auto" ? "Adaptive" : currentQuality}
                      showChat={showChat}
                      onToggleChat={() => setShowChat((prev) => !prev)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stream Info Panel (Desktop layout) */}
            <div className="hidden lg:block space-y-6">
              <StreamInfoPanel
                streamItem={null}
                match={match}
                activeServer={activeServer}
                liveViewerCount={realtimeStats.viewers}
                onSelectStream={(srv) => {
                  showSponsoredAd();
                  setActiveServer(srv);
                }}
                onSwitchStreamServer={() => {
                  if (allAvailableServers.length > 1) {
                    const cIdx = allAvailableServers.findIndex((s) => s.url === activeServer?.url);
                    const nIdx = (cIdx + 1) % allAvailableServers.length;
                    setActiveServer(allAvailableServers[nIdx]);
                  }
                }}
                featuredStreams={[]}
                currentResolution={currentQuality === "auto" ? "Adaptive" : currentQuality}
                showChat={showChat}
                onToggleChat={() => setShowChat((prev) => !prev)}
              />
            </div>
          </div>

          {/* Desktop Right Column: Docked Live Chat alongside Theater Player (4 cols on desktop) */}
          {showChat && (
            <div className="hidden lg:block lg:col-span-4 sticky top-20 h-[calc(100vh-120px)] min-h-[580px]">
              <div className="w-full h-full rounded-3xl overflow-hidden border border-white/15 shadow-2xl">
                <FloatableLiveChat
                  matchId={match?.id || matchId || "live_stream"}
                  matchTitle={match ? `${match.team1} vs ${match.team2}` : "Live Match"}
                  viewerCount={realtimeStats.viewers}
                  isLive={true}
                  isOpen={true}
                  docked={true}
                  onClose={() => setShowChat(false)}
                />
              </div>
            </div>
          )}
        </div>

        {/* On Mobile when user is in overview mode, allow floating chat pill if they want */}
        <div className="lg:hidden">
          {mobileTab === "overview" && showChat && (
            <FloatableLiveChat
              matchId={match?.id || matchId || "live_stream"}
              matchTitle={match ? `${match.team1} vs ${match.team2}` : "Live Match"}
              viewerCount={realtimeStats.viewers}
              isLive={true}
              isOpen={showChat}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>

        {relatedMatches.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-cyan-400" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">Related Live Matches</h2>
              </div>
              <span className="text-xs text-cyan-300/70 font-mono font-medium">
                {relatedMatches.length} available
              </span>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {relatedMatches.map((relatedMatch) => {
                const dyn = getMatchDynamicStatus(relatedMatch);
                const isLiveNow = dyn.isLive || dyn.status === "live";
                const leagueTitle = relatedMatch.league || relatedMatch.tournament || relatedMatch.eventName || relatedMatch.category?.toUpperCase() || "Live Sport";
                const leagueLogo = relatedMatch.leagueLogo || relatedMatch.tournamentLogo;

                return (
                  <button
                    key={relatedMatch.id}
                    onClick={() => {
                      showSponsoredAd();
                      navigate(`/match/${relatedMatch.id}`);
                    }}
                    className="group relative liquid-glass rounded-2xl p-4 text-left border border-white/10 hover:border-cyan-400/50 hover:bg-white/[0.07] transition-all flex flex-col justify-between overflow-hidden shadow-lg"
                  >
                    {/* Header: Tournament / League & Live Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-lg bg-[#0d111a] border border-white/10 p-0.5 overflow-hidden shrink-0 flex items-center justify-center">
                          {leagueLogo?.trim() ? (
                            <img
                              src={leagueLogo.trim()}
                              alt={leagueTitle}
                              className="w-full h-full object-contain"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                            />
                          ) : (
                            <span className="text-[8px] font-black text-cyan-300">
                              {(relatedMatch.category || "SP").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-cyan-300/90 truncate uppercase tracking-wider">
                          {leagueTitle}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {isLiveNow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black tracking-wider uppercase shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            LIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-[10px] font-semibold">
                            <Clock size={10} />
                            <span>
                              {relatedMatch.startTime ? new Date(relatedMatch.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Upcoming"}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Teams & Logos Grid */}
                    <div className="my-2 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2.5">
                      {/* Team 1 */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-[#111622] p-1 flex items-center justify-center shrink-0 border border-white/15 overflow-hidden shadow-inner">
                            {relatedMatch.team1Logo?.trim() ? (
                              <img
                                src={relatedMatch.team1Logo.trim()}
                                alt={relatedMatch.team1}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                              />
                            ) : (
                              <span className="text-[10px] font-black text-white/70">
                                {relatedMatch.team1?.slice(0, 2).toUpperCase() || "T1"}
                              </span>
                            )}
                          </div>
                          <span className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-cyan-300 transition-colors">
                            {relatedMatch.team1 || "Team 1"}
                          </span>
                        </div>
                      </div>

                      {/* Team 2 */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-[#111622] p-1 flex items-center justify-center shrink-0 border border-white/15 overflow-hidden shadow-inner">
                            {relatedMatch.team2Logo?.trim() ? (
                              <img
                                src={relatedMatch.team2Logo.trim()}
                                alt={relatedMatch.team2}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
                              />
                            ) : (
                              <span className="text-[10px] font-black text-white/70">
                                {relatedMatch.team2?.slice(0, 2).toUpperCase() || "T2"}
                              </span>
                            )}
                          </div>
                          <span className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-cyan-300 transition-colors">
                            {relatedMatch.team2 || "Team 2"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Channels & Watch Stream CTA */}
                    <div className="flex items-center justify-between text-[11px] text-white/50 pt-2 border-t border-white/5">
                      <span className="flex items-center gap-1 text-[10px] text-white/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        {relatedMatch.channels?.length || 1} Server{((relatedMatch.channels?.length || 1) > 1) ? "s" : ""}
                      </span>
                      <span className="text-[10px] font-bold text-cyan-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        <span>Watch Live</span>
                        <ArrowRight size={11} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Quick Action: Show Live Chat Button (when chat is hidden, raised above bottom dock) */}
      {!showChat && (
        <aside aria-label="Live chat controls" className="fixed bottom-24 sm:bottom-28 right-4 sm:right-6 z-40">
          <button
            id="floating-show-chat-btn"
            onClick={() => setShowChat(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-sm shadow-[0_0_25px_rgba(0,242,254,0.45)] transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer border border-cyan-300/60"
            title="Open Live Chat"
          >
            <div className="relative">
              <MessageSquare size={18} className="text-black" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
            </div>
            <span>Show Live Chat</span>
          </button>
        </aside>
      )}

      {/* Floating Bottom Navigation Bar for Mobile and Desktop across Detail Pages */}
      <BottomNav
        activeTab="sports"
        onTabChange={(tab: any) => {
          navigate(`/?tab=${tab}`);
        }}
        liveCount={relatedMatches.filter((m) => getMatchDynamicStatus(m).isLive).length}
        savedCount={watchlist.length}
        onRequestMatchClick={() => setShowRequestModal(true)}
      />

      {/* Request Match Modal */}
      <RequestMatchModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
      />
      </div>
    </div>
  );
}
