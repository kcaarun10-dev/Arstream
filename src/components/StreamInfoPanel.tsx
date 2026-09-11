import React, { useState } from "react";
import { StreamItem, StreamServer, Match } from "../types";
import { 
  Eye, 
  ThumbsUp, 
  Bookmark, 
  Share2, 
  Radio, 
  Server, 
  Activity, 
  Sparkles, 
  Check, 
  Film, 
  Cpu, 
  Volume2, 
  Tv, 
  Clock, 
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Trophy,
  ShieldCheck,
  TrendingUp,
  Users,
  MessageSquare,
  Tag,
  FileText,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { generateMatchDescription, generateMatchKeywords } from "../utils/metaManager";
import { useRealtimeViewers } from "../utils/realtimeViewers";
import { showSponsoredAd } from "../utils/adManager";
import { formatMatchShortUrl, getMatchSlug } from "../utils/slugUtils";
import { LiveChat } from "./LiveChat";

interface StreamInfoPanelProps {
  streamItem?: StreamItem | null;
  match?: Match | null;
  activeServer?: StreamServer | null;
  onSelectStream?: (stream: StreamItem) => void;
  onSwitchStreamServer?: () => void;
  featuredStreams?: StreamItem[];
  liveViewerCount?: number;
  currentResolution?: string;
  currentBitrate?: string;
  bufferHealth?: number;
  showChat?: boolean;
  onToggleChat?: () => void;
}

export const StreamInfoPanel: React.FC<StreamInfoPanelProps> = ({
  streamItem,
  match,
  activeServer,
  onSelectStream,
  onSwitchStreamServer,
  featuredStreams = [],
  liveViewerCount,
  currentResolution,
  currentBitrate,
  bufferHealth,
  showChat,
  onToggleChat,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState<number | null>(streamItem?.likesCount ?? null);
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "upnext" | "diagnostics">("details");

  const realtimeStats = useRealtimeViewers(match, streamItem);
  const isLive = streamItem?.isLive || match?.status === "live" || realtimeStats.isLive;
  const viewerCount = liveViewerCount ?? realtimeStats.viewers;
  const title = streamItem?.title || (match ? `${match.team1} vs ${match.team2}` : "Live Stream");
  const leagueName = match?.league || match?.tournament || match?.eventName || streamItem?.category;
  const leagueLogo = match?.leagueLogo || match?.tournamentLogo;

  const subtitle = streamItem?.subtitle || (match
    ? `${leagueName ? `${leagueName} • ` : ""}${match.category?.toUpperCase?.() || match.category} • ${match.status?.toUpperCase() || "LIVE"}`
    : undefined);
  const description = streamItem?.description || match?.description || (match ? generateMatchDescription(match) : (leagueName ? `${match?.team1} vs ${match?.team2} • ${leagueName}` : undefined));
  const tags = streamItem?.tags?.length 
    ? streamItem.tags 
    : (match?.keywords?.length ? match.keywords : (match ? generateMatchKeywords(match) : [leagueName, match?.category, match?.status].filter(Boolean) as string[]));

  const handleLike = () => {
    if (isLiked) {
      setLikesCount((prev) => (prev ?? 0) - 1);
      setIsLiked(false);
    } else {
      setLikesCount((prev) => (prev ?? 0) + 1);
      setIsLiked(true);
    }
  };

  const handleShare = async () => {
    const shortUrl = match ? formatMatchShortUrl(match) : window.location.href;
    const fullShareUrl = match ? `${window.location.origin}/match/${getMatchSlug(match)}` : window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: title,
          text: `Watch ${title} live on AR Stream: ${shortUrl}`,
          url: fullShareUrl,
        });
        setIsCopied(false);
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shortUrl);
      }
    } catch (error) {
      console.warn("Share unavailable:", error);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shortUrl);
      }
    }

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="w-full space-y-6 pt-4">
      {/* Floating Main Information Card */}
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-6">
          {/* Header Row: Badges, Title & Meta */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="space-y-3 max-w-3xl">
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {isLive ? (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF453A]/15 border border-[#FF453A]/30 text-[#FF453A] text-[11px] font-semibold tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF453A] animate-pulse" />
                    <span>LIVE BROADCAST</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] border border-white/15 text-white text-[11px] font-medium">
                    <Sparkles size={13} className="text-white/70" />
                    <span>{streamItem?.qualityBadge || (match ? match.category : "Live")}</span>
                  </div>
                )}

                {streamItem?.audioCodec && (
                  <div className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/70 text-[11px] font-medium tracking-wide">
                    {streamItem.audioCodec}
                  </div>
                )}

                {(match?.category || streamItem?.category) && (
                  <div className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/70 text-[11px] font-mono font-medium">
                    {match?.category || streamItem?.category}
                  </div>
                )}

                {leagueName && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/80 text-[11px] font-medium">
                    {leagueLogo?.trim() ? (
                      <img src={leagueLogo.trim()} alt={leagueName} className="w-3.5 h-3.5 object-contain" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : null}
                    <span className="truncate max-w-[200px]">{leagueName}</span>
                  </div>
                )}
              </div>

              {/* Title & Subtitle */}
              <div>
                {match && (match.team1Logo || match.team2Logo) && (
                  <div className="flex items-center gap-2.5 py-1 mb-2">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.05] border border-white/10 shadow-sm">
                      {match.team1Logo?.trim() ? (
                        <img 
                          src={match.team1Logo.trim()} 
                          alt={match.team1} 
                          className="w-5 h-5 object-contain" 
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} 
                        />
                      ) : null}
                      <span className="text-xs sm:text-sm font-bold text-white">{match.team1}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">VS</span>
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.05] border border-white/10 shadow-sm">
                      {match.team2Logo?.trim() ? (
                        <img 
                          src={match.team2Logo.trim()} 
                          alt={match.team2} 
                          className="w-5 h-5 object-contain" 
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} 
                        />
                      ) : null}
                      <span className="text-xs sm:text-sm font-bold text-white">{match.team2}</span>
                    </div>
                  </div>
                )}

                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="text-sm sm:text-base text-white/60 font-medium mt-1 flex items-center gap-2">{subtitle}</p>
                ) : null}
                {match && (
                  <div className="flex items-center gap-2 text-xs font-mono pt-2">
                    <span className="text-white/40">Short URL:</span>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Click to copy short share URL"
                    >
                      <span>{formatMatchShortUrl(match)}</span>
                      {isCopied ? <Check size={12} className="text-[#30D158]" /> : <Copy size={12} className="text-white/50" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar (Like, Watchlist, Share, Live Viewers) */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Live Viewers Pill */}
              {viewerCount !== null && (
                <div 
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-white font-mono text-xs font-medium border transition-all ${
                    isLive
                      ? "border-[#FF453A]/30 bg-[#FF453A]/10 text-white"
                      : "border-white/10 bg-white/[0.04] text-white/80"
                  }`}
                  title={isLive ? `Live audience: ${realtimeStats.formattedFull} connected` : `Viewer count`}
                >
                  <div className="relative flex items-center justify-center">
                    {isLive && (
                      <span className="absolute w-2 h-2 rounded-full bg-[#FF453A] animate-ping opacity-75" />
                    )}
                    <Eye size={14} className={isLive ? "text-[#FF453A] relative z-10" : "text-white/60"} />
                  </div>
                  <span className="font-semibold tracking-tight">
                    {viewerCount > 0 
                      ? `${realtimeStats.formatted} ${realtimeStats.label}` 
                      : "Connecting..."}
                  </span>
                </div>
              )}

              {/* Switch Stream / Server Button */}
              {onSwitchStreamServer && (
                <button
                  id="panel-switch-stream-btn"
                  onClick={onSwitchStreamServer}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/15 border border-white/15 text-white transition-all duration-200 active:scale-95 text-xs font-semibold cursor-pointer"
                  title="Switch Stream Source Node"
                >
                  <Server size={14} className="text-white/70" />
                  <span>Switch Stream</span>
                </button>
              )}

              {/* Chat Hide / Show Button in Stream Info Bar */}
              {onToggleChat && (
                <button
                  id="panel-chat-toggle-btn"
                  onClick={onToggleChat}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 active:scale-95 text-xs font-semibold cursor-pointer ${
                    showChat
                      ? "bg-white text-black border-white shadow-sm"
                      : "bg-white/[0.06] hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                  }`}
                  title={showChat ? "Hide Live Chat" : "Show Live Chat"}
                >
                  <MessageSquare size={14} className={showChat ? "text-black" : "text-white/60"} />
                  <span>{showChat ? "Hide Chat" : "Show Chat"}</span>
                </button>
              )}

              {/* Like Button */}
              {likesCount !== null && (
                <button
                  id="panel-like-btn"
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 active:scale-95 text-xs font-semibold cursor-pointer ${
                    isLiked 
                      ? "bg-white text-black border-white shadow-sm" 
                      : "bg-white/[0.06] hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                  }`}
                  title="Like Stream"
                >
                  <ThumbsUp size={14} className={isLiked ? "fill-black text-black" : "text-white/60"} />
                  <span>{likesCount.toLocaleString()}</span>
                </button>
              )}

              {/* Watchlist Bookmark */}
              <button
                id="panel-watchlist-btn"
                onClick={() => setIsSaved(!isSaved)}
                className={`p-2 sm:px-4 sm:py-2 rounded-full border transition-all duration-200 active:scale-95 text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                  isSaved 
                    ? "bg-[#FF9F0A]/20 border-[#FF9F0A]/40 text-[#FF9F0A]" 
                    : "bg-white/[0.06] hover:bg-white/10 border-white/10 text-white/70 hover:text-white"
                }`}
                title="Add to Watchlist"
              >
                <Bookmark size={14} className={isSaved ? "fill-[#FF9F0A] text-[#FF9F0A]" : "text-white/60"} />
                <span className="hidden sm:inline">{isSaved ? "Saved" : "Watchlist"}</span>
              </button>

              {/* Share Button */}
              <button
                id="panel-share-btn"
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all duration-200 active:scale-95 text-xs font-semibold cursor-pointer"
                title="Share link"
              >
                {isCopied ? <Check size={14} className="text-[#30D158]" /> : <Share2 size={14} className="text-white/60" />}
                <span>{isCopied ? "Copied" : "Share"}</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs for Floating Info Panel */}
          <div className="flex items-center gap-1.5 border-b border-white/[0.08] pb-3 pt-1">
            <button
              id="tab-overview-btn"
              onClick={() => setActiveTab("details")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "details"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <Info size={14} />
              <span>Overview</span>
            </button>

            <button
              id="tab-upnext-btn"
              onClick={() => setActiveTab("upnext")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "upnext"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <Film size={14} />
              <span>Up Next</span>
            </button>

            <button
              id="tab-diagnostics-btn"
              onClick={() => setActiveTab("diagnostics")}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "diagnostics"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              }`}
            >
              <Activity size={14} />
              <span>Telemetry</span>
            </button>
          </div>

          {/* Tab Content 1: Overview & Story */}
          {activeTab === "details" && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-3"
            >
              {!showFullDesc ? (
                /* Collapsed Compact State: Saves screen space, tap to show full */
                <button
                  id="collapsed-description-tags-bar"
                  onClick={() => setShowFullDesc(true)}
                  className="w-full text-left p-3.5 sm:p-4 rounded-2xl apple-card hover:border-white/20 transition-all flex items-center justify-between gap-3 group cursor-pointer active:scale-[0.99]"
                  title="Tap to show full description and tags"
                  aria-expanded={false}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-white/70" />
                    </div>
                    <p className="text-xs sm:text-sm text-white/70 truncate min-w-0 flex-1 font-medium">
                      {description || "View match details, tournament background & tags..."}
                    </p>
                    {tags.length > 0 && (
                      <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/70 text-[11px] font-mono shrink-0">
                        <Tag size={10} />
                        <span>{tags.length} tags</span>
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] group-hover:bg-white/[0.15] border border-white/15 text-white text-xs font-semibold transition-all">
                    <span>Show Details</span>
                    <ChevronDown size={14} className="text-white/60 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </button>
              ) : (
                /* Expanded State: Full description and all tags shown */
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-5 sm:p-6 rounded-3xl apple-card space-y-4 relative"
                >
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-white/60" />
                      <span className="text-xs font-bold text-white tracking-tight">
                        Match Details & Context
                      </span>
                    </div>
                    <button
                      id="collapse-description-btn"
                      onClick={() => setShowFullDesc(false)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white text-xs font-medium transition-all active:scale-95 cursor-pointer"
                      title="Hide description and tags to save space"
                      aria-expanded={true}
                    >
                      <span>Show Less</span>
                      <ChevronUp size={14} />
                    </button>
                  </div>

                  {description ? (
                    <p className="text-white/85 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal">
                      {description}
                    </p>
                  ) : (
                    <p className="text-white/50 text-sm">Description not available.</p>
                  )}

                  {tags.length > 0 && (
                    <div className="pt-3 border-t border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-xs text-white/50 font-medium mb-2.5">
                        <Tag size={12} className="text-white/50" />
                        <span>Tags ({tags.length})</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      id="bottom-collapse-description-btn"
                      onClick={() => setShowFullDesc(false)}
                      className="text-xs font-medium text-white/60 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Collapse</span>
                      <ChevronUp size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Tab Content 2: Up Next Carousel */}
          {activeTab === "upnext" && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredStreams.map((item, fIdx) => {
                  const isCurrent = streamItem?.id === item.id;
                  return (
                    <div
                      key={`${item.id || 'stream'}-${fIdx}`}
                      onClick={() => {
                        showSponsoredAd();
                        if (onSelectStream) onSelectStream(item);
                      }}
                      className={`rounded-3xl p-3.5 flex gap-3.5 cursor-pointer group/card border transition-all ${
                        isCurrent 
                          ? "border-white/30 bg-white/[0.12] shadow-sm" 
                          : "apple-card hover:border-white/20"
                      }`}
                    >
                      <div className="w-24 h-16 rounded-2xl overflow-hidden relative shrink-0 bg-white/5 flex items-center justify-center">
                        {item.thumbnail?.trim() ? (
                          <img 
                            src={item.thumbnail.trim()} 
                            alt={item.title} 
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" 
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <Tv size={20} className="text-white/40" />
                        )}
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[9px] font-mono font-medium text-white">
                          {item.duration || "Live"}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover/card:text-white/80 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-white/50 truncate mt-0.5">
                          {item.category}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-medium text-white/80 px-2 py-0.5 bg-white/10 rounded-full">
                            {item.qualityBadge}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {item.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Tab Content 3: Server & Stream Telemetry Diagnostics */}
          {activeTab === "diagnostics" && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
            >
              <div className="p-4 rounded-3xl apple-card space-y-1">
                <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
                  <Server size={14} className="text-white/60" />
                  <span>CDN Node</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white truncate">
                  {activeServer?.name || "Not available"}
                </div>
                <div className="text-[11px] text-white/50 font-mono">
                  {activeServer?.ping ? `${activeServer.ping}ms Ping` : "Ping optimal"}
                </div>
              </div>

              <div className="p-4 rounded-3xl apple-card space-y-1">
                <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
                  <Users size={14} className="text-[#FF453A]" />
                  <span>Active Viewers</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {realtimeStats.formattedFull}
                </div>
                <div className="text-[11px] text-[#30D158] font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
                  Live Presence
                </div>
              </div>

              <div className="p-4 rounded-3xl apple-card space-y-1">
                <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
                  <Cpu size={14} className="text-white/60" />
                  <span>Render Profile</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {currentResolution || "1080p 60fps"}
                </div>
                <div className="text-[11px] text-white/50 font-mono">
                  {activeServer?.protocol ? activeServer.protocol : "HLS Ultra HD"}
                </div>
              </div>

              <div className="p-4 rounded-3xl apple-card space-y-1">
                <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
                  <Zap size={14} className="text-[#FF9F0A]" />
                  <span>Data Bitrate</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {currentBitrate || "6,200 Kbps"}
                </div>
                <div className="text-[11px] text-white/50 font-mono">
                  Adaptive CBR
                </div>
              </div>

              <div className="p-4 rounded-3xl apple-card space-y-1">
                <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
                  <Activity size={14} className="text-[#30D158]" />
                  <span>Buffer Health</span>
                </div>
                <div className="text-sm sm:text-base font-bold text-white">
                  {bufferHealth !== undefined ? `${bufferHealth}s Forward` : "Stable"}
                </div>
                <div className="text-[11px] text-[#30D158] font-mono">
                  Zero Drift
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
