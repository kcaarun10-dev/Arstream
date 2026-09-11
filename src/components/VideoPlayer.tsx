import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Match, MatchChannel, StreamServer, StreamItem } from "../types";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Volume1,
  Maximize, 
  Minimize, 
  Tv, 
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings,
  Radio,
  Wifi,
  Sparkles,
  Sliders,
  Check,
  Subtitles,
  Gauge,
  Layers,
  PictureInPicture2,
  X,
  Server,
  Activity,
  Zap,
  Info,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Globe,
  MonitorPlay,
  Eye,
  Users,
  TrendingUp,
  Lock,
  Unlock,
  ZoomIn,
  Sun,
  Scaling,
  Crop,
  Ratio,
  Expand,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { isEmbedUrl, detectStreamProtocol, extractIframeSrc, isChannelEmbed, findPreferredChannel, findPreferredServer } from "../utils/channelLookup";
import { useRealtimeViewers } from "../utils/realtimeViewers";
import { EmbeddedLiveStreamPlayer } from "./EmbeddedLiveStreamPlayer";
import { NetworkConnectivityBanner } from "./NetworkConnectivityBanner";
import { showSponsoredAd } from "../utils/adManager";

interface VideoPlayerProps {
  match?: Match | null;
  streamItem?: StreamItem | null;
  currentServer?: StreamServer | null;
  onServerChange?: (server: StreamServer) => void;
  onQualityChange?: (quality: string) => void;
  showChat?: boolean;
  onToggleChat?: () => void;
}

interface QualityOption {
  id: string;
  label: string;
  resolution: string;
  bitrate: string;
  levelIndex: number;
}

const formatBitrate = (bitrate?: number) => {
  if (!bitrate || bitrate <= 0) return "Adaptive";
  if (bitrate >= 1_000_000) return `${(bitrate / 1_000_000).toFixed(1)} Mbps`;
  if (bitrate >= 1_000) return `${Math.round(bitrate / 1_000)} Kbps`;
  return `${bitrate} bps`;
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const SUBTITLE_OPTIONS = [
  { id: "off", label: "Off" },
  { id: "en", label: "English [CC]" },
  { id: "es", label: "Spanish (Español)" },
  { id: "fr", label: "French (Français)" },
  { id: "ja", label: "Japanese (日本語)" },
];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  match, 
  streamItem,
  currentServer,
  onServerChange,
  onQualityChange,
  showChat,
  onToggleChat,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Active Source / Server State
  const [activeServer, setActiveServer] = useState<StreamServer | MatchChannel | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(1.0);

  // Embedded External Player State & Controls
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playerEngine, setPlayerEngine] = useState<"auto" | "embed" | "direct">("auto");
  const [embedReloadKey, setEmbedReloadKey] = useState(0);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [embedPlaying, setEmbedPlaying] = useState(true);
  const [embedVolume, setEmbedVolume] = useState(1);
  const [embedMuted, setEmbedMuted] = useState(false);
  const [embedAudioBoost, setEmbedAudioBoost] = useState<1 | 1.5 | 2>(1);
  const [videoDisplayMode, setVideoDisplayMode] = useState<"fit" | "fill" | "stretch" | "wide" | "4:3">("fit");
  const [videoFilterPreset, setVideoFilterPreset] = useState<"normal" | "vivid" | "cinema" | "bright" | "crisp">("normal");
  const [embedShieldMode, setEmbedShieldMode] = useState<"shielded" | "interactive">("interactive");
  const [showEmbedControlsDrawer, setShowEmbedControlsDrawer] = useState(false);

  // Time & Buffer State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [bufferAhead, setBufferAhead] = useState(0);
  const [liveDelay, setLiveDelay] = useState<number>(8); // 8-second live delay for ultra smooth streaming buffer
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Advanced Menu Modals & Drawers
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"quality" | "screen" | "buffer" | "speed" | "subtitles" | "audio">("quality");
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [activePlayingQuality, setActivePlayingQuality] = useState<string>("");
  const [qualityLevels, setQualityLevels] = useState<QualityOption[]>([]);
  const [selectedSpeed, setSelectedSpeed] = useState(1);
  const [selectedSubtitle, setSelectedSubtitle] = useState("off");
  const [showServerDrawer, setShowServerDrawer] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Real-time live audience stats
  const realtimeStats = useRealtimeViewers(match, streamItem);

  // Double-tap / Seek Ripple Badges
  const [rewindRipple, setRewindRipple] = useState(false);
  const [forwardRipple, setForwardRipple] = useState(false);
  const [hudFeedback, setHudFeedback] = useState<{ icon: string; text: string } | null>(null);

  // 15-Second Stream Loading Timeout Watchdog
  const [isStreamLoadTimedOut, setIsStreamLoadTimedOut] = useState(false);
  const streamLoadWatchdogRef = useRef<NodeJS.Timeout | null>(null);

  // Determine whether this stream plays in external embed player or native video
  const isEmbedStream = activeServer
    ? (playerEngine === "embed" || (playerEngine === "auto" && (activeServer.protocol === "EMBED" || isEmbedUrl(activeServer.url))))
    : false;

  // Available servers consolidated from streamItem or match channels + smart fallback streams
  const availableServers: StreamServer[] = React.useMemo(() => {
    if (streamItem?.servers && streamItem.servers.length > 0) {
      return streamItem.servers;
    }

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

    // Only show admin-uploaded channels/streams. Never inject fake/demo streams.
    return sortedList.map((chan, idx) => {
      const cleanUrl = (chan.url || "").trim();
      const isEmbed = isChannelEmbed(chan);
      const proto = detectStreamProtocol(cleanUrl, chan.protocol);
      return {
        id: `chan-${idx}`,
        name: chan.name || `Stream ${idx + 1}`,
        location: chan.serverLocation || "Global Edge",
        ping: typeof chan.ping === "number" && chan.ping > 0 ? chan.ping : (18 + idx * 8),
        badge: isEmbed ? "EMBED" : proto === "HLS" ? (idx === 0 ? "PRIMARY HLS" : "HLS HD") : (idx === 0 ? "PRIMARY HD" : `MIRROR ${idx + 1}`),
        url: cleanUrl,
        userAgent: chan.userAgent,
        referrer: chan.referrer,
        origin: chan.origin,
        cookie: chan.cookie,
        protocol: proto
      };
    });
  }, [streamItem, match]);

  // Sync when parent changes currentServer explicitly
  useEffect(() => {
    if (currentServer && currentServer.url) {
      if (!activeServer || activeServer.url !== currentServer.url) {
        setActiveServer(currentServer);
        setError(null);
        setIsStreamLoadTimedOut(false);
        setIsBuffering(true);
      }
    }
  }, [currentServer]);

  // Initializing active source from streamItem or match - prioritizing native HLS streams
  useEffect(() => {
    if (currentServer && currentServer.url) {
      setActiveServer(currentServer);
      return;
    }
    if (streamItem && streamItem.servers && streamItem.servers.length > 0) {
      const preferred = findPreferredServer(streamItem.servers) || streamItem.servers[0];
      setActiveServer(preferred);
      if (onServerChange) onServerChange(preferred);
    } else if (availableServers && availableServers.length > 0) {
      const preferred = findPreferredServer(availableServers) || availableServers[0];
      setActiveServer(preferred);
      if (onServerChange) onServerChange(preferred);
    } else {
      setActiveServer(null);
    }
    setEmbedLoaded(false);
  }, [streamItem, match, availableServers]);

  // Controls Visibility Timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (isPlaying && !isScrubbing && !showSettingsMenu && !showServerDrawer) {
      controlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2800);
    }
  }, [isPlaying, isScrubbing, showSettingsMenu, showServerDrawer]);

  // Trigger brief visual HUD pill
  const showHud = (text: string, icon = "✨") => {
    setHudFeedback({ icon, text });
    setTimeout(() => setHudFeedback(null), 1200);
  };

  // Embed Player PostMessage & Remote Control Dispatcher
  const sendEmbedCommand = useCallback((action: 'play' | 'pause' | 'mute' | 'unmute' | 'volume' | 'reload' | 'seek', val?: any) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    try {
      if (action === 'play') {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: '' }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
        iframe.contentWindow.postMessage({ type: 'play', action: 'play' }, '*');
        iframe.contentWindow.postMessage('play', '*');
        setEmbedPlaying(true);
        showHud("Embed Playing", "▶");
      } else if (action === 'pause') {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
        iframe.contentWindow.postMessage({ type: 'pause', action: 'pause' }, '*');
        iframe.contentWindow.postMessage('pause', '*');
        setEmbedPlaying(false);
        showHud("Embed Paused", "⏸");
      } else if (action === 'mute') {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: '' }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({ method: 'mute' }), '*');
        iframe.contentWindow.postMessage({ type: 'mute', action: 'mute' }, '*');
        setEmbedMuted(true);
        showHud("Muted", "🔇");
      } else if (action === 'unmute') {
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: '' }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({ method: 'unmute' }), '*');
        iframe.contentWindow.postMessage({ type: 'unmute', action: 'unmute' }, '*');
        setEmbedMuted(false);
        showHud("Unmuted", "🔊");
      } else if (action === 'volume') {
        const volNum = typeof val === 'number' ? Math.max(0, Math.min(1, val)) : 1;
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [Math.round(volNum * 100)] }), '*');
        iframe.contentWindow.postMessage(JSON.stringify({ method: 'setVolume', value: volNum }), '*');
        iframe.contentWindow.postMessage({ type: 'setVolume', volume: volNum }, '*');
        setEmbedVolume(volNum);
        if (volNum > 0 && embedMuted) setEmbedMuted(false);
        showHud(`Volume ${Math.round(volNum * 100 * embedAudioBoost)}%`, "🔊");
      } else if (action === 'seek') {
        const offset = typeof val === 'number' ? val : 10;
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [offset, true] }), '*');
        showHud(offset > 0 ? `+${offset}s Jump` : `${offset}s Jump`, "⏩");
      } else if (action === 'reload') {
        setEmbedReloadKey((k) => k + 1);
        setEmbedLoaded(false);
        showHud("Reloading Stream...", "🔄");
      }
    } catch (err) {
      console.log("Embed postMessage dispatch caught:", err);
    }
  }, [embedMuted, embedAudioBoost]);

  // Toggle Embed Play / Pause
  const toggleEmbedPlay = useCallback(() => {
    if (embedPlaying) {
      sendEmbedCommand('pause');
    } else {
      sendEmbedCommand('play');
    }
  }, [embedPlaying, sendEmbedCommand]);

  // Toggle Embed Mute
  const toggleEmbedMute = useCallback(() => {
    if (embedMuted) {
      sendEmbedCommand('unmute');
    } else {
      sendEmbedCommand('mute');
    }
  }, [embedMuted, sendEmbedCommand]);

  // Get CSS Filter for Picture Enhancer
  const getEmbedFilterStyle = () => {
    switch (videoFilterPreset) {
      case "vivid":
        return "saturate(1.35) contrast(1.15) brightness(1.05)";
      case "cinema":
        return "contrast(1.22) brightness(0.95) saturate(1.1)";
      case "bright":
        return "brightness(1.2) contrast(1.08) saturate(1.05)";
      case "crisp":
        return "contrast(1.3) saturate(1.15) brightness(1.02)";
      default:
        return "none";
    }
  };

  // Get Scaling & Transform Class for Aspect Ratio
  const getEmbedAspectRatioStyle = (): React.CSSProperties => {
    switch (videoDisplayMode) {
      case "fill":
        return { transform: "scale(1.16)", transformOrigin: "center center" };
      case "stretch":
        return { transform: "scaleX(1.1)", transformOrigin: "center center" };
      case "wide":
        return { transform: "scaleY(0.85) scaleX(1.05)", transformOrigin: "center center" };
      case "4:3":
        return { maxWidth: "75%", margin: "0 auto" };
      default:
        return { transform: "scale(1)" };
    }
  };

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(err => console.log("Play interrupted:", err));
      showHud("Playing", "▶");
    } else {
      videoRef.current.pause();
      showHud("Paused", "⏸");
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  // 10-second Rewind / Forward with visual ripple
  const handleSkip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const target = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
    video.currentTime = target;
    setCurrentTime(target);

    if (seconds < 0) {
      setRewindRipple(true);
      setTimeout(() => setRewindRipple(false), 600);
      showHud("Rewind 10s", "⏪");
    } else {
      setForwardRipple(true);
      setTimeout(() => setForwardRipple(false), 600);
      showHud("Forward 10s", "⏩");
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  // Fullscreen Handler with cross-browser and mobile Safari support
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current as any;
    if (!container) return;

    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isFs) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          if (video && video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
          }
        });
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if (video && video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
      setIsFullscreen(true);
      showHud("Fullscreen", "⛶");
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      }
      setIsFullscreen(false);
      showHud("Exit Fullscreen", "🗗");
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  // Sync fullscreen state with browser events (e.g. mobile swipe or Esc key)
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("mozfullscreenchange", handleFsChange);
    };
  }, []);

  // Picture in Picture Handler
  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
        showHud("PiP Closed", "🗗");
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
        showHud("Picture-in-Picture Active", "🗖");
      }
    } catch (err) {
      console.warn("PiP Error:", err);
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  // Volume Changes
  const handleVolumeChange = (newVol: number) => {
    const val = Math.max(0, Math.min(1, newVol));
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = (val === 0);
    }
    setIsMuted(val === 0);
    showHud(`Volume: ${Math.round(val * 100)}%`, val === 0 ? "🔇" : "🔊");
    resetControlsTimer();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    videoRef.current.muted = nextMute;
    if (!nextMute && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
    showHud(nextMute ? "Muted" : `Unmuted (${Math.round(volume * 100)}%)`, nextMute ? "🔇" : "🔊");
    resetControlsTimer();
  };

  // Speed Change
  const handleSpeedChange = (speed: number) => {
    setSelectedSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    showHud(`Speed: ${speed}x`, "⚡");
    setShowSettingsMenu(false);
    resetControlsTimer();
  };

  // Quality Change
  const handleQualityChange = (qId: string) => {
    setSelectedQuality(qId);

    if (hlsRef.current) {
      if (qId === "auto") {
        hlsRef.current.currentLevel = -1;
        const curLvl = hlsRef.current.levels?.[hlsRef.current.currentLevel];
        if (curLvl?.height) {
          setActivePlayingQuality(`${curLvl.height}p`);
        }
      } else {
        const selected = qualityLevels.find((option) => option.id === qId);
        if (selected) {
          hlsRef.current.currentLevel = selected.levelIndex;
          if (selected.resolution && selected.resolution !== "Adaptive") {
            setActivePlayingQuality(selected.resolution);
          } else if (selected.label) {
            setActivePlayingQuality(selected.label);
          }
        }
      }
    }

    if (onQualityChange) onQualityChange(qId);
    showHud(qId === "auto" ? "Quality: Auto" : `Quality: ${qId.toUpperCase()}`, "✨");
    setShowSettingsMenu(false);
    resetControlsTimer();
  };

  // Subtitle Change
  const handleSubtitleChange = (subId: string) => {
    setSelectedSubtitle(subId);
    showHud(`Captions: ${subId === "off" ? "Off" : subId.toUpperCase()}`, "💬");
    setShowSettingsMenu(false);
    resetControlsTimer();
  };

  // Server Change
  const handleSelectServer = (server: StreamServer) => {
    showSponsoredAd();
    setError(null);
    setIsStreamLoadTimedOut(false);
    setActiveServer(server);
    if (onServerChange) onServerChange(server);
    setShowServerDrawer(false);
    showHud(`Switched to: ${server.name}`, "🌐");
    resetControlsTimer();
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid capturing when typing inside inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
          e.preventDefault();
          handleSkip(-10);
          break;
        case "arrowright":
          e.preventDefault();
          handleSkip(10);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
        case "c":
          e.preventDefault();
          setSelectedSubtitle(prev => prev === "off" ? "en" : "off");
          showHud(selectedSubtitle === "off" ? "Captions: EN" : "Captions: Off", "💬");
          break;
        case "d":
          e.preventDefault();
          setShowDiagnostics(prev => !prev);
          break;
        case "escape":
          setShowSettingsMenu(false);
          setShowServerDrawer(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, handleSkip, handleVolumeChange, volume, toggleFullscreen, toggleMute, togglePiP, selectedSubtitle]);

  // Format Time Helper
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Scrubber Hover Handler
  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * (duration || 100));
  };

  // Scrubber Seek Handler
  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = pos * (duration || 1);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    resetControlsTimer();
  };

  // Touch Scrubber Seeking with live scrub preview
  const handleProgressTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX;
    const pos = Math.max(0, Math.min(1, (touchX - rect.left) / rect.width));
    const target = pos * duration;
    setHoverPosition(pos * 100);
    setHoverTime(target);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    resetControlsTimer();
  };

  // Watchdog: If stream did not load after 15 seconds, show Network Connectivity Detector & Notification Banner
  useEffect(() => {
    setIsStreamLoadTimedOut(false);
    if (streamLoadWatchdogRef.current) {
      clearTimeout(streamLoadWatchdogRef.current);
    }

    if (!activeServer) return;

    // Start 15s watchdog timer on source load
    streamLoadWatchdogRef.current = setTimeout(() => {
      const isEmbedActive = isEmbedStream && embedLoaded;
      const isVideoActive = !isEmbedStream && (isPlaying || currentTime > 0) && !isBuffering;

      if (!isEmbedActive && !isVideoActive) {
        setIsStreamLoadTimedOut(true);
      }
    }, 15000);

    return () => {
      if (streamLoadWatchdogRef.current) {
        clearTimeout(streamLoadWatchdogRef.current);
      }
    };
  }, [activeServer?.id, activeServer?.url, isEmbedStream]);

  // When stream successfully starts playing or loads, dismiss the 15s timeout alert
  useEffect(() => {
    if (isPlaying || embedLoaded || (currentTime > 0 && !isBuffering)) {
      setIsStreamLoadTimedOut(false);
      if (streamLoadWatchdogRef.current) {
        clearTimeout(streamLoadWatchdogRef.current);
      }
    }
  }, [isPlaying, embedLoaded, currentTime, isBuffering]);

  // Stream Attachment (HLS.js / Native MP4 / Embed)
  useEffect(() => {
    setError(null);
    setIsBuffering(true);

    if (!activeServer) {
      setIsBuffering(false);
      return;
    }

    // If stream is detected as an external embed URL or protocol
    if (isEmbedStream) {
      setIsBuffering(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
      return;
    }

    if (!videoRef.current) {
      setIsBuffering(false);
      return;
    }

    const video = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const rawUrl = activeServer.url;
    const isHls = rawUrl.toLowerCase().includes(".m3u8") || activeServer.protocol === "HLS" || rawUrl.toLowerCase().includes("/hls");

    // Build proxied URL with custom headers (User-Agent, Referer)
    const shouldProxy = rawUrl.startsWith("http") && !rawUrl.includes("commondatastorage.googleapis.com");

    let streamUrl = rawUrl;
    if (shouldProxy) {
      const params = new URLSearchParams();
      params.set("url", rawUrl);
      if (activeServer.userAgent) params.set("ua", activeServer.userAgent);
      if (activeServer.referrer) params.set("ref", activeServer.referrer);
      if (activeServer.origin) params.set("origin", activeServer.origin);
      if (activeServer.cookie) params.set("cookie", activeServer.cookie);
      streamUrl = `/api/proxy?${params.toString()}`;
    }

    let retryTimer: NodeJS.Timeout | null = null;

    if (isHls && Hls.isSupported()) {
      const targetLiveDelay = liveDelay > 0 ? liveDelay : 8;
      const hls = new Hls({
        enableWorker: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 35 * 1000 * 1000,
        lowLatencyMode: false,
        progressive: true,
        startLevel: -1,
        startFragPrefetch: true,
        liveSyncDuration: targetLiveDelay, // Target ~8s live edge delay for buffer stability
        liveMaxLatencyDuration: targetLiveDelay + 6,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 500,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 500,
        fragLoadingTimeOut: 12000,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 500,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels = hls.levels ?? [];
        if (levels.length > 0) {
          const derivedLevels = levels.map((level, index) => ({
            id: `level-${index}`,
            label: level.height ? `${level.height}p` : `Level ${index + 1}`,
            resolution: level.height ? `${level.height}p` : "Adaptive",
            bitrate: formatBitrate(level.bitrate),
            levelIndex: index,
          }));
          setQualityLevels(derivedLevels);

          // Find medium quality (target ~720p or middle index)
          let targetIndex = -1;

          // 1. Check for exact 720p
          targetIndex = levels.findIndex((lvl) => lvl.height === 720);

          // 2. If no exact 720p, find resolution closest to 720p (preferring <= 720p)
          if (targetIndex === -1 && levels.some((lvl) => lvl.height > 0)) {
            let minDiff = Infinity;
            levels.forEach((lvl, idx) => {
              if (lvl.height > 0) {
                const diff = Math.abs(lvl.height - 720);
                if (diff < minDiff) {
                  minDiff = diff;
                  targetIndex = idx;
                }
              }
            });
          }

          // 3. If levels don't specify height (audio/video bitrate only), pick median index
          if (targetIndex === -1) {
            targetIndex = Math.floor(levels.length / 2);
          }

          // Apply initial medium quality (user can change manually anytime)
          if (targetIndex >= 0 && targetIndex < levels.length) {
            hls.currentLevel = targetIndex;
            const mediumQualityId = `level-${targetIndex}`;
            setSelectedQuality(mediumQualityId);
            if (levels[targetIndex].height) {
              setActivePlayingQuality(`${levels[targetIndex].height}p`);
            }
            if (onQualityChange) onQualityChange(mediumQualityId);
          } else {
            setSelectedQuality("auto");
            if (onQualityChange) onQualityChange("auto");
          }
        } else {
          setQualityLevels([]);
          setSelectedQuality("auto");
          if (onQualityChange) onQualityChange("auto");
        }

        setIsBuffering(false);
        setError(null);
        video.play().catch(() => {});
      });

      // Track the actual active quality stream in real-time when level switches
      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const currentLvl = hls.levels?.[data.level];
        if (currentLvl) {
          if (currentLvl.height) {
            setActivePlayingQuality(`${currentLvl.height}p`);
          } else if (currentLvl.bitrate) {
            setActivePlayingQuality(`${Math.round(currentLvl.bitrate / 1000)}k`);
          }
        }
      });

      // Track active fragment level
      hls.on(Hls.Events.FRAG_CHANGED, (_, data) => {
        const fragLevel = data.frag?.level;
        if (typeof fragLevel === "number" && hls.levels?.[fragLevel]) {
          const lvl = hls.levels[fragLevel];
          if (lvl?.height) {
            setActivePlayingQuality(`${lvl.height}p`);
          }
        }
      });

      let networkRetryCount = 0;
      const MAX_NETWORK_RETRIES = 3;

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              const httpStatus = data.response?.code || 0;
              if (httpStatus === 400 || httpStatus === 403 || httpStatus === 404 || httpStatus === 410) {
                setIsBuffering(false);
                setError(
                  httpStatus === 400
                    ? "Stream Source Rejected Request (HTTP 400 - Expired Live Token or Bad Request). The broadcast token has expired or is invalid. Please update the stream link or switch server."
                    : httpStatus === 403
                    ? "Access Denied by Source Server (HTTP 403 Forbidden). Stream link has expired or is geo-restricted."
                    : `Stream Source Offline (HTTP ${httpStatus}). Please switch to a backup stream server.`
                );
                hls.destroy();
                return;
              }

              if (data.details === "manifestParsingError" || data.details === "manifestLoadError") {
                // If native HLS playback is supported (e.g. Safari / iOS), attempt direct video fallback
                if (video.canPlayType("application/vnd.apple.mpegurl")) {
                  video.src = streamUrl;
                  video.load();
                  video.play().catch(() => {});
                  return;
                }
              }

              if (networkRetryCount < MAX_NETWORK_RETRIES) {
                networkRetryCount++;
                console.warn(`HLS Network error (${data.details}), retrying (${networkRetryCount}/${MAX_NETWORK_RETRIES})...`);
                hls.startLoad();
              } else {
                setIsBuffering(false);
                setError(`Stream network connection failed (${data.details}). Source server might be offline or unreachable.`);
                hls.destroy();
              }
              break;
            }

            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;

            default:
              setIsBuffering(false);
              setError(
                data.details === "manifestParsingError"
                  ? "Manifest format incompatible with source server. Please switch to a backup server node."
                  : `Stream connection error (${data.details}). Switching server is recommended.`
              );
              hls.destroy();
              break;
          }
        }
      });
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Apple HLS support
      setQualityLevels([]);
      setSelectedQuality("auto");
      if (onQualityChange) onQualityChange("auto");
      video.src = streamUrl;
      video.load();
      video.play().catch(() => {});
    } else {
      setQualityLevels([]);
      setSelectedQuality("auto");
      if (onQualityChange) onQualityChange("auto");
      video.src = streamUrl;
      video.load();
    }

    // Video Event Listeners
    const onPlay = () => {
      setIsPlaying(true);
      if (video.videoHeight > 0) setActivePlayingQuality(`${video.videoHeight}p`);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      if (video.videoHeight > 0) setActivePlayingQuality(`${video.videoHeight}p`);
    };
    const onLoadedMetadata = () => {
      if (video.videoHeight > 0) setActivePlayingQuality(`${video.videoHeight}p`);
    };
    const onResize = () => {
      if (video.videoHeight > 0) setActivePlayingQuality(`${video.videoHeight}p`);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);

      // Calculate buffer health
      if (video.buffered && video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
            const end = video.buffered.end(i);
            setBufferedEnd(end);
            setBufferAhead(Math.max(0, Math.round(end - video.currentTime)));
            break;
          }
        }
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("resize", onResize);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", onTimeUpdate);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("resize", onResize);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onTimeUpdate);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeServer, isEmbedStream]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  const isLiveStream = streamItem?.isLive || match?.status === "live";

  // Compute accurate real-time quality display label (never shows false static 720p)
  const getQualityDisplayLabel = () => {
    if (selectedQuality === "auto") {
      return activePlayingQuality ? `Auto (${activePlayingQuality})` : "Auto";
    }
    const chosen = qualityLevels.find((q) => q.id === selectedQuality);
    if (chosen) {
      return chosen.label || chosen.resolution || activePlayingQuality || "720p";
    }
    return activePlayingQuality || "Auto";
  };

  // Video Display Mode & Aspect Ratio transformation helper
  const getVideoTransformStyle = (): React.CSSProperties => {
    switch (videoDisplayMode) {
      case "fill":
        return { objectFit: "cover", transform: "scale(1.15)", transformOrigin: "center center" };
      case "stretch":
        return { objectFit: "fill", width: "100%", height: "100%", transform: "scaleX(1.12) scaleY(1.04)", transformOrigin: "center center" };
      case "wide":
        return { objectFit: "contain", transform: "scaleX(1.25) scaleY(0.92)", transformOrigin: "center center" };
      case "4:3":
        return { objectFit: "contain", transform: "scaleX(0.82)", transformOrigin: "center center" };
      case "fit":
      default:
        return { objectFit: "contain", transform: "none" };
    }
  };

  // Video Filter Preset CSS helper with dynamic brightness touch control
  const getVideoFilterStyle = () => {
    const bStyle = `brightness(${brightness})`;
    switch (videoFilterPreset) {
      case "vivid":
        return `saturate(1.25) contrast(1.1) ${bStyle}`;
      case "cinema":
        return `contrast(1.15) saturate(1.1) brightness(${brightness * 0.95})`;
      case "bright":
        return `contrast(1.05) saturate(1.05) brightness(${brightness * 1.12})`;
      case "crisp":
        return `contrast(1.2) saturate(1.05) ${bStyle}`;
      default:
        return brightness !== 1 ? bStyle : "none";
    }
  };

  // Mobile and PC tap / click and double-tap gesture handler
  const lastTapRef = useRef<{ time: number; side: "left" | "right" | "center" }>({
    time: 0,
    side: "center",
  });

  // Mobile Touch Gestures (Vertical drag for brightness on left, volume on right)
  const touchTrackingRef = useRef<{
    startX: number;
    startY: number;
    lastY: number;
    startTime: number;
    side: "left" | "right" | "center";
    isSwiping: boolean;
    gestureType: "brightness" | "volume" | null;
  }>({
    startX: 0,
    startY: 0,
    lastY: 0,
    startTime: 0,
    side: "center",
    isSwiping: false,
    gestureType: null,
  });

  const handleTouchStartZone = (e: React.TouchEvent, side: "left" | "right" | "center") => {
    const touch = e.touches[0];
    touchTrackingRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastY: touch.clientY,
      startTime: Date.now(),
      side,
      isSwiping: false,
      gestureType: null,
    };
  };

  const handleTouchMoveZone = (e: React.TouchEvent) => {
    const t = touchTrackingRef.current;
    if (!t.startTime) return;
    const touch = e.touches[0];
    const diffY = touch.clientY - t.startY;
    const stepY = touch.clientY - t.lastY;
    t.lastY = touch.clientY;

    if (Math.abs(diffY) > 10) {
      t.isSwiping = true;
      if (!t.gestureType) {
        t.gestureType = t.side === "left" ? "brightness" : "volume";
      }

      if (t.gestureType === "brightness") {
        const delta = -stepY * 0.006;
        setBrightness((prev) => {
          const next = Math.max(0.4, Math.min(1.5, prev + delta));
          showHud(`Brightness: ${Math.round(next * 100)}%`, "☀️");
          return next;
        });
      } else if (t.gestureType === "volume") {
        const delta = -stepY * 0.006;
        setVolume((prev) => {
          const next = Math.max(0, Math.min(1, prev + delta));
          if (videoRef.current) {
            videoRef.current.volume = next;
            videoRef.current.muted = next === 0;
          }
          setIsMuted(next === 0);
          showHud(`Volume: ${Math.round(next * 100)}%`, next === 0 ? "🔇" : "🔊");
          return next;
        });
      }
    }
  };

  const handleTouchEndZone = (e: React.TouchEvent) => {
    const t = touchTrackingRef.current;
    if (!t.startTime) return;

    if (!t.isSwiping) {
      handlePlayerTap(e, t.side);
    }
    touchTrackingRef.current = {
      startX: 0,
      startY: 0,
      lastY: 0,
      startTime: 0,
      side: "center",
      isSwiping: false,
      gestureType: null,
    };
  };

  const handlePlayerTap = (e: React.MouseEvent | React.TouchEvent, side: "left" | "right" | "center" = "center") => {
    // Don't toggle controls if user clicked on interactive dropdowns or menus
    if (showSettingsMenu || showServerDrawer) {
      setShowSettingsMenu(false);
      setShowServerDrawer(false);
      return;
    }

    const now = Date.now();
    const last = lastTapRef.current;
    
    // Check for double-tap / double-click within 300ms on the same side
    if (now - last.time < 300 && last.side === side) {
      if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
        (navigator as any).vibrate(30);
      }
      if (side === "left") {
        handleSkip(-10);
      } else if (side === "right") {
        handleSkip(10);
      } else {
        toggleFullscreen();
      }
      lastTapRef.current = { time: 0, side: "center" };
    } else {
      // Single tap / click: toggle controls visibility
      lastTapRef.current = { time: now, side };
      setShowControls((prev) => {
        const willShow = !prev;
        if (willShow) {
          resetControlsTimer();
        } else if (controlsTimer.current) {
          clearTimeout(controlsTimer.current);
        }
        return willShow;
      });
    }
  };

  return (
    <div 
      id="ar-stream-player-container"
      ref={containerRef}
      onMouseMove={() => {
        if (!showControls) setShowControls(true);
        resetControlsTimer();
      }}
      onMouseLeave={() => {
        if (isPlaying && !showSettingsMenu && !showServerDrawer) {
          setShowControls(false);
        }
      }}
      className={`relative w-full ${
        isFullscreen
          ? "rounded-none h-screen w-screen"
          : isEmbedStream
          ? "min-h-[260px] xs:min-h-[300px] sm:min-h-[380px] md:min-h-[460px] aspect-video sm:aspect-video rounded-2xl sm:rounded-3xl border border-white/10"
          : "aspect-video rounded-2xl sm:rounded-3xl border border-white/10"
      } bg-black overflow-hidden select-none transition-all duration-500 shadow-2xl`}
    >
      {/* Specular Liquid Ambient Glow behind video player */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06080c]/80 via-transparent to-[#06080c]/40 pointer-events-none z-10" />

      {/* Real-time Network Connectivity Detector & Live Stream Interruption Banner */}
      <NetworkConnectivityBanner
        serverCount={availableServers.length}
        activeServerName={activeServer?.name}
        isStreamInterrupted={Boolean(error || (isBuffering && isPlaying))}
        isLoadTimeout={isStreamLoadTimedOut}
        timeoutSeconds={15}
        onSwitchServer={() => setShowServerDrawer(true)}
        onRetry={() => {
          setError(null);
          setIsStreamLoadTimedOut(false);
          setIsBuffering(true);
          const current = activeServer;
          setActiveServer(null);
          setTimeout(() => setActiveServer(current), 100);
        }}
      />

      {/* Primary Video / Embed Surface */}
      {!activeServer && availableServers.length === 0 ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95 p-6 text-center text-white select-none">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-cyan-400">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">No Stream Sources Available</h3>
          <p className="text-xs text-white/50 max-w-md leading-relaxed">
            No stream sources have been uploaded by the admin for this match yet. Sources will appear here once the broadcast is published.
          </p>
        </div>
      ) : isEmbedStream && activeServer ? (
        <EmbeddedLiveStreamPlayer
          url={activeServer?.url || ""}
          title={`${match?.homeTeam?.name || streamItem?.title || "Match"} Live Broadcast Stream`}
          className="w-full h-full"
          displayMode={videoDisplayMode}
          filterPreset={videoFilterPreset}
          onLoaded={() => {
            setEmbedLoaded(true);
            setIsBuffering(false);
          }}
        />
      ) : (
        <>
          {/* Main HTML5 Video Element */}
          <video
            id="main-video-element"
            ref={videoRef}
            className="w-full h-full cursor-pointer transition-all duration-300"
            style={{
              filter: getVideoFilterStyle(),
              ...getVideoTransformStyle(),
              transition: "transform 0.3s ease, filter 0.3s ease",
            }}
            playsInline
            muted={isMuted}
            onClick={(e) => handlePlayerTap(e, "center")}
            onDoubleClick={toggleFullscreen}
          />

          {/* Realistic Simulated Subtitle Overlay */}
          {selectedSubtitle !== "off" && isPlaying && (
            <div className="absolute bottom-20 sm:bottom-24 left-0 right-0 flex justify-center pointer-events-none z-20 px-4">
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/75 backdrop-blur-md px-4 py-1.5 rounded-xl border border-white/10 text-white font-semibold text-xs sm:text-base tracking-wide text-center max-w-xl shadow-lg"
              >
                {selectedSubtitle === "en" && "Quantum link stabilized. Connecting to AR Stream orbital network..."}
                {selectedSubtitle === "es" && "Enlace cuántico estabilizado. Conectando a la red orbital AR Stream..."}
                {selectedSubtitle === "fr" && "Lien quantique stabilisé. Connexion au réseau orbital AR Stream..."}
                {selectedSubtitle === "ja" && "量子リンクが安定しました。ARストリーム軌道ネットワークに接続中..."}
              </motion.div>
            </div>
          )}

          {/* Touch & Click Interaction Zones for Mobile & PC */}
          <div 
            id="left-rewind-touch-area"
            onTouchStart={(e) => handleTouchStartZone(e, "left")}
            onTouchMove={handleTouchMoveZone}
            onTouchEnd={handleTouchEndZone}
            onClick={(e) => { e.stopPropagation(); handlePlayerTap(e, "left"); }}
            className="absolute top-12 bottom-16 left-0 w-1/3 z-20 cursor-pointer touch-none"
            title="Double tap to rewind 10s • Swipe vertically to adjust brightness"
          />
          <div 
            id="center-play-touch-area"
            onTouchStart={(e) => handleTouchStartZone(e, "center")}
            onTouchMove={handleTouchMoveZone}
            onTouchEnd={handleTouchEndZone}
            onClick={(e) => { e.stopPropagation(); handlePlayerTap(e, "center"); }}
            className="absolute top-12 bottom-16 left-1/3 w-1/3 z-20 cursor-pointer touch-none"
            title="Single tap to show/hide controls, double tap for fullscreen"
          />
          <div 
            id="right-forward-touch-area"
            onTouchStart={(e) => handleTouchStartZone(e, "right")}
            onTouchMove={handleTouchMoveZone}
            onTouchEnd={handleTouchEndZone}
            onClick={(e) => { e.stopPropagation(); handlePlayerTap(e, "right"); }}
            className="absolute top-12 bottom-16 right-0 w-1/3 z-20 cursor-pointer touch-none"
            title="Double tap to forward 10s • Swipe vertically to adjust volume"
          />

          {/* Rewind Animated Ripple HUD (-10s) */}
          <AnimatePresence>
            {rewindRipple && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, x: -30 }}
                animate={{ opacity: 1, scale: 1.1, x: 0 }}
                exit={{ opacity: 0, scale: 1.3, x: -20 }}
                className="absolute left-12 top-1/2 -translate-y-1/2 z-30 liquid-glass p-5 rounded-full flex flex-col items-center justify-center text-cyan-300 pointer-events-none border border-cyan-400/40 shadow-[0_0_30px_rgba(0,242,254,0.4)]"
              >
                <RotateCcw size={32} />
                <span className="text-xs font-black mt-1">-10s</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forward Animated Ripple HUD (+10s) */}
          <AnimatePresence>
            {forwardRipple && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, x: 30 }}
                animate={{ opacity: 1, scale: 1.1, x: 0 }}
                exit={{ opacity: 0, scale: 1.3, x: 20 }}
                className="absolute right-12 top-1/2 -translate-y-1/2 z-30 liquid-glass p-5 rounded-full flex flex-col items-center justify-center text-cyan-300 pointer-events-none border border-cyan-400/40 shadow-[0_0_30px_rgba(0,242,254,0.4)]"
              >
                <RotateCw size={32} />
                <span className="text-xs font-black mt-1">+10s</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center-Screen Large Play Button (Visible When Video is Paused) */}
          {!isPlaying && !isBuffering && !error && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <motion.button
                id="center-liquid-play-btn"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="pointer-events-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full liquid-glass flex items-center justify-center text-cyan-300 border-2 border-cyan-400/50 shadow-[0_0_50px_rgba(0,242,254,0.4)] transition-transform duration-300 group/centerplay"
                title="Play Stream"
              >
                {/* Pulsing Liquid Ring */}
                <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping pointer-events-none opacity-40" />
                <Play size={36} className="ml-1.5 fill-cyan-400 text-cyan-400 drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]" />
              </motion.button>
            </div>
          )}

          {/* Futuristic Glass Loading & Buffering Spinner */}
          <AnimatePresence>
            {isBuffering && !error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[4px] z-30 pointer-events-none"
              >
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                  <div className="absolute inset-2 rounded-full border-2 border-purple-500/20 border-b-purple-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles size={16} className="text-cyan-300 animate-pulse" />
                  </div>
                </div>
                <div className="liquid-glass px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                  <Wifi size={13} className="text-cyan-400 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-white/90">
                    Optimizing AR Stream Buffer...
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Brief Floating HUD Pill Notification */}
      <AnimatePresence>
        {hudFeedback && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-xl px-4 py-2 rounded-full border border-cyan-400/30 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(0,242,254,0.25)] pointer-events-none"
          >
            <span>{hudFeedback.icon}</span>
            <span>{hudFeedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream Error Recovery Modal */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl z-40 p-6 text-center">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 mb-3">
            <AlertCircle size={40} className="animate-pulse" />
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white mb-1.5">STREAM CONNECTION INTERRUPTED</h3>
          <p className="text-white/60 text-xs sm:text-sm max-w-md mb-4">{error}</p>

          {/* Quick Server Switch Options */}
          {availableServers && availableServers.length > 1 && (
            <div className="mb-4 max-w-md w-full">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 block mb-2">Available Stream Servers</span>
              <div className="flex flex-wrap justify-center gap-2 max-h-28 overflow-y-auto custom-scrollbar p-1">
                {availableServers.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => {
                      setActiveServer(srv);
                      setError(null);
                      setIsBuffering(true);
                      if (onServerChange) onServerChange(srv);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      activeServer?.id === srv.id
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,242,254,0.3)]"
                        : "bg-white/5 border-white/10 hover:bg-white/10 text-white/80"
                    }`}
                  >
                    {srv.name} {srv.badge ? `(${srv.badge})` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            {availableServers && availableServers.length > 1 && (
              <button
                id="error-switch-server-btn"
                onClick={() => setShowServerDrawer(true)}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,242,254,0.4)]"
              >
                Choose Server
              </button>
            )}
            <button
              id="error-retry-btn"
              onClick={() => {
                setError(null);
                setIsBuffering(true);
                const current = activeServer;
                setActiveServer(null);
                setTimeout(() => setActiveServer(current), 150);
              }}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/10"
            >
              Retry Stream
            </button>
          </div>
        </div>
      )}

      {/* Futuristic Glass Top Header Bar (Shown for both Native and Embed streams) */}
      <AnimatePresence>
        {showControls && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-0 left-0 right-0 p-2.5 sm:p-4 z-30 flex items-center justify-between pointer-events-none"
          >
            {/* Title, Logos & Live Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto min-w-0 max-w-[70%]">
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2 sm:px-2.5 py-1 shadow-[0_0_15px_rgba(0,242,254,0.1)] backdrop-blur-md shrink-0">
                <img
                  src="/logo.ico"
                  alt="AR Stream"
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white hidden xs:inline">AR STREAM</span>
              </div>

              {isLiveStream && (
                <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-red-600/30 border border-red-500/50 text-red-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span>LIVE</span>
                </div>
              )}

              {/* Title & Team Logos Label */}
              <div className="flex items-center gap-1.5 liquid-glass px-2.5 sm:px-3 py-1 rounded-full text-white/90 text-[11px] sm:text-xs font-semibold truncate border border-white/10 max-w-[45vw] sm:max-w-md">
                {match?.team1Logo?.trim() && (
                  <img 
                    src={match.team1Logo.trim()} 
                    alt={match.team1} 
                    className="w-4 h-4 rounded-full object-contain shrink-0 bg-white/10 p-0.5" 
                    referrerPolicy="no-referrer" 
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} 
                  />
                )}
                <span className="truncate">{streamItem?.title || (match ? `${match.team1} vs ${match.team2}` : "Live Stream")}</span>
                {match?.team2Logo?.trim() && (
                  <img 
                    src={match.team2Logo.trim()} 
                    alt={match.team2} 
                    className="w-4 h-4 rounded-full object-contain shrink-0 bg-white/10 p-0.5" 
                    referrerPolicy="no-referrer" 
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} 
                  />
                )}
              </div>
            </div>

            {/* Quick Server Switcher & Action Icons */}
            <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
              {/* Real-time Viewers Badge */}
              <div 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-all ${
                  isLiveStream
                    ? "bg-red-950/50 border-red-500/40 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                    : "liquid-glass text-white/90 border-white/10"
                }`}
                title={isLiveStream ? `Real-time viewers: ${realtimeStats.formattedFull} connected` : `Viewer count`}
              >
                <div className="relative flex items-center justify-center">
                  {isLiveStream && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping absolute" />
                  )}
                  <Eye size={12} className={isLiveStream ? "text-red-400 relative z-10" : "text-cyan-400"} />
                </div>
                <span>{realtimeStats.formatted}</span>
              </div>

              {/* Active Server Pill Button */}
              <button
                id="header-server-selector-btn"
                onClick={() => setShowServerDrawer(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full liquid-glass-interactive text-[11px] font-semibold text-white/90 hover:text-cyan-300 border border-white/10"
                title="Switch Server Source"
              >
                <Server size={12} className="text-cyan-400" />
                <span className="hidden sm:inline truncate max-w-[100px]">{activeServer?.name || "Server"}</span>
              </button>

              {/* Fullscreen Quick Button */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-full liquid-glass-interactive text-white/80 hover:text-cyan-300 border border-white/10 transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stream Telemetry Diagnostics HUD Overlay (Only for native video streams) */}
      <AnimatePresence>
        {!isEmbedStream && showDiagnostics && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-16 right-4 sm:right-6 z-30 liquid-glass p-4 rounded-2xl border border-cyan-400/30 text-white text-xs font-mono space-y-2 w-64 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 font-sans">
              <span className="font-extrabold text-cyan-300 text-xs flex items-center gap-1.5">
                <Activity size={14} /> AR STREAM TELEMETRY
              </span>
              <button onClick={() => setShowDiagnostics(false)} className="text-white/50 hover:text-white">✕</button>
            </div>
            <div className="flex justify-between"><span className="text-white/50">Engine:</span> <span className="text-emerald-400 font-bold">HLS Native Stream</span></div>
            <div className="flex justify-between"><span className="text-white/50">Resolution:</span> <span>{selectedQuality && selectedQuality !== "auto" ? selectedQuality.toUpperCase() : "Auto"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Protocol:</span> <span className="text-cyan-300">{activeServer?.protocol || "HLS"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Source:</span> <span className="text-white truncate max-w-[130px]">{activeServer?.name || "AR Stream CDN"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Buffer Ahead:</span> <span className="text-green-400">{bufferAhead > 0 ? `${bufferAhead}s` : "Live"}</span></div>
            <div className="flex justify-between"><span className="text-white/50">CDN Latency:</span> <span className="text-cyan-400">{activeServer?.ping ? `${activeServer.ping}ms` : "Live CDN"}</span></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standard HTML5 / HLS Controls Bar */}
      {!isEmbedStream && (
        /* Standard HTML5 / HLS Controls Bar */
        <AnimatePresence>
          {showControls && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 z-30 bg-gradient-to-t from-[#06080c]/95 via-[#06080c]/70 to-transparent flex flex-col gap-2.5"
            >
              {/* Scrubber Progress Bar Track */}
              <div className="relative group/scrub px-1">
                {/* Hover Timestamp Preview Tooltip */}
                {hoverTime !== null && (
                  <div 
                    className="absolute -top-9 -translate-x-1/2 px-2.5 py-1 rounded-lg glass-tooltip text-[11px] font-mono font-bold text-cyan-300 pointer-events-none transition-transform z-30"
                    style={{ left: `${hoverPosition}%` }}
                  >
                    {formatTime(hoverTime)}
                  </div>
                )}

                <div 
                  id="video-seek-bar"
                  ref={progressBarRef}
                  onClick={handleSeek}
                  onTouchStart={handleProgressTouch}
                  onTouchMove={handleProgressTouch}
                  onTouchEnd={() => setHoverTime(null)}
                  onMouseMove={handleProgressMouseMove}
                  onMouseLeave={() => setHoverTime(null)}
                  className="relative h-7 sm:h-4 w-full flex items-center cursor-pointer py-2 sm:py-1.5 touch-none"
                >
                  {/* Background Channel */}
                  <div className="w-full h-1.5 group-hover/scrub:h-2.5 bg-white/15 rounded-full overflow-hidden transition-all duration-200 relative">
                    {/* Buffer Preloaded Bar */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all duration-300"
                      style={{ width: `${bufferPercent}%` }}
                    />
                    {/* Active Play Progress Bar */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full shadow-[0_0_12px_rgba(0,242,254,0.8)]"
                      style={{ width: `${hoverTime !== null ? hoverPosition : progressPercent}%` }}
                    />
                  </div>

                  {/* Scrubber Glow Thumb */}
                  <div 
                    className={`absolute w-4 h-4 bg-white rounded-full border-2 border-cyan-400 shadow-[0_0_14px_rgba(0,242,254,0.95)] -translate-x-1/2 transition-transform duration-150 pointer-events-none ${
                      hoverTime !== null ? "scale-125 ring-2 ring-cyan-400/50" : "scale-100 sm:scale-0 group-hover/scrub:scale-100"
                    }`}
                    style={{ left: `${hoverTime !== null ? hoverPosition : progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Bottom Controls Row: Play, Volume, Time, Speed, Subtitles, Settings, Fullscreen */}
              <div className="flex items-center justify-between gap-1.5 sm:gap-4">
                {/* Left Group: Play/Pause, Rewind, Forward, Volume, Time */}
                <div className="flex items-center gap-1 sm:gap-2.5 min-w-0">
                  {/* Circular Glass Play/Pause Button */}
                  <button
                    id="bottom-play-btn"
                    onClick={togglePlay}
                    className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-full liquid-glass-interactive flex items-center justify-center text-cyan-300 hover:text-white border border-cyan-400/30 hover:border-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.2)] active:scale-95 transition-all"
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                  >
                    {isPlaying ? (
                      <Pause size={17} className="fill-current" />
                    ) : (
                      <Play size={17} className="ml-0.5 fill-current" />
                    )}
                  </button>

                  {/* 10s Rewind Button (desktop/tablet) */}
                  <button
                    id="bottom-rewind-btn"
                    onClick={() => handleSkip(-10)}
                    className="hidden sm:flex p-2 text-white/70 hover:text-cyan-300 transition-colors active:scale-95"
                    title="Rewind 10s (Left Arrow)"
                  >
                    <RotateCcw size={18} />
                  </button>

                  {/* 10s Forward Button (desktop/tablet) */}
                  <button
                    id="bottom-forward-btn"
                    onClick={() => handleSkip(10)}
                    className="hidden sm:flex p-2 text-white/70 hover:text-cyan-300 transition-colors active:scale-95"
                    title="Forward 10s (Right Arrow)"
                  >
                    <RotateCw size={18} />
                  </button>

                  {/* Volume Slider & Mute Toggle */}
                  <div className="flex items-center gap-1 group/volume">
                    <button
                      id="bottom-volume-btn"
                      onClick={toggleMute}
                      className="p-1.5 sm:p-2 text-white/80 hover:text-cyan-300 transition-colors"
                      title={isMuted ? "Unmute (M)" : "Mute (M)"}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX size={18} className="text-red-400" />
                      ) : volume < 0.5 ? (
                        <Volume1 size={18} />
                      ) : (
                        <Volume2 size={18} />
                      )}
                    </button>

                    <div className="hidden sm:flex w-0 group-hover/volume:w-20 sm:group-hover/volume:w-24 overflow-hidden transition-all duration-300 items-center">
                      <input
                        id="bottom-volume-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-20 sm:w-24 h-1 bg-white/20 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Time Display */}
                  <div className="text-[10px] sm:text-xs font-mono font-medium text-white/80 shrink-0 truncate">
                    <span className="text-white font-bold">{formatTime(currentTime)}</span>
                    <span className="text-white/40 mx-1">/</span>
                    <span className="text-white/60">{isLiveStream ? "LIVE" : formatTime(duration)}</span>
                  </div>
                </div>

                {/* Right Group: CC, Speed, Settings, PiP, Fullscreen */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {/* Fast Stream Switch Button */}
                  {availableServers && availableServers.length > 1 && (
                    <button
                      id="bottom-server-switch-btn"
                      onClick={() => setShowServerDrawer(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl liquid-glass-interactive text-[11px] font-semibold text-cyan-300 hover:text-white border border-cyan-400/30 hover:border-cyan-400 transition-all shadow-[0_0_10px_rgba(0,242,254,0.15)] active:scale-95"
                      title="Switch Stream Server"
                    >
                      <Server size={14} className="text-cyan-400" />
                      <span className="hidden sm:inline">Switch Stream</span>
                    </button>
                  )}

                  {/* Screen Fit & Stretch Mode Quick Selector */}
                  <button
                    id="bottom-aspect-fit-btn"
                    onClick={() => {
                      setSettingsTab("screen");
                      setShowSettingsMenu((prev) => !prev || settingsTab !== "screen");
                    }}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl transition-all ${
                      videoDisplayMode !== "fit"
                        ? "text-cyan-300 bg-cyan-500/15 border border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]"
                        : "text-white/75 hover:text-white hover:bg-white/10 border border-white/5"
                    }`}
                    title={`Screen Fit Mode: ${videoDisplayMode.toUpperCase()}`}
                  >
                    <Scaling size={15} className={videoDisplayMode !== "fit" ? "text-cyan-300" : "text-white/70"} />
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase font-mono tracking-tight hidden xs:inline sm:inline">
                      {videoDisplayMode === "fit" ? "Fit" : videoDisplayMode === "fill" ? "Fill" : videoDisplayMode === "stretch" ? "Stretch" : videoDisplayMode}
                    </span>
                  </button>

                  {/* Subtitle / CC Toggle Button */}
                  <button
                    id="bottom-subtitle-btn"
                    onClick={() => {
                      setSettingsTab("subtitles");
                      setShowSettingsMenu((prev) => !prev || settingsTab !== "subtitles");
                    }}
                    className={`hidden sm:flex p-2 rounded-xl transition-all ${
                      selectedSubtitle !== "off" 
                        ? "text-cyan-300 bg-cyan-500/15 border border-cyan-400/30" 
                        : "text-white/70 hover:text-white"
                    }`}
                    title="Captions / Subtitles"
                  >
                    <Subtitles size={18} />
                  </button>

                  {/* Playback Speed Pill */}
                  <button
                    id="bottom-speed-btn"
                    onClick={() => {
                      setSettingsTab("speed");
                      setShowSettingsMenu((prev) => !prev || settingsTab !== "speed");
                    }}
                    className="hidden sm:flex px-2.5 py-1 rounded-xl text-xs font-mono font-bold text-white/80 hover:text-cyan-300 hover:bg-white/10 transition-colors"
                    title="Playback Speed"
                  >
                    {selectedSpeed}x
                  </button>

                  {/* Quality & Settings Dropdown Toggle */}
                  <button
                    id="bottom-settings-btn"
                    onClick={() => {
                      setSettingsTab("quality");
                      setShowSettingsMenu((prev) => !prev || settingsTab !== "quality");
                    }}
                    className={`px-2 sm:px-2.5 py-1 flex items-center gap-1 sm:gap-1.5 rounded-xl transition-all ${
                      showSettingsMenu ? "text-cyan-300 bg-white/15 border border-cyan-400/30" : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                    title="Stream Quality & Settings"
                  >
                    <Settings size={15} />
                    <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-tight">
                      {getQualityDisplayLabel()}
                    </span>
                  </button>

                  {/* Chat Hide / Show Button in Player Controls */}
                  {onToggleChat && (
                    <button
                      id="bottom-chat-toggle-btn"
                      onClick={onToggleChat}
                      className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl transition-all ${
                        showChat
                          ? "text-cyan-300 bg-cyan-500/20 border border-cyan-400/50 shadow-[0_0_10px_rgba(0,242,254,0.25)]"
                          : "text-white/70 hover:text-white hover:bg-white/10 border border-white/5"
                      }`}
                      title={showChat ? "Hide Live Chat (C)" : "Show Live Chat (C)"}
                    >
                      <MessageSquare size={15} className={showChat ? "text-cyan-300" : "text-white/70"} />
                      <span className="text-[10px] sm:text-[11px] font-bold hidden xs:inline">
                        {showChat ? "Hide Chat" : "Chat"}
                      </span>
                    </button>
                  )}

                  {/* Picture in Picture Button */}
                  <button
                    id="bottom-pip-btn"
                    onClick={togglePiP}
                    className="hidden sm:flex p-2 text-white/70 hover:text-white transition-colors"
                    title="Picture in Picture (P)"
                  >
                    <PictureInPicture2 size={18} />
                  </button>

                  {/* Fullscreen Button */}
                  <button
                    id="bottom-fullscreen-btn"
                    onClick={toggleFullscreen}
                    className="p-1.5 sm:p-2 text-white/80 hover:text-cyan-300 transition-transform active:scale-90"
                    title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                  >
                    {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Floating Settings & Quality Flyout Menu */}
      <AnimatePresence>
        {showSettingsMenu && (
          <motion.div 
            id="settings-flyout-modal"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-14 sm:bottom-16 right-2 left-2 sm:left-auto sm:right-6 z-40 liquid-glass rounded-2xl border border-white/15 p-3.5 sm:p-4 sm:w-80 shadow-2xl backdrop-blur-2xl max-h-[75vh] overflow-y-auto"
          >
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
              <div className="flex gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setSettingsTab("screen")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                    settingsTab === "screen" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-white/60 hover:text-white"
                  }`}
                >
                  <Scaling size={12} />
                  <span>Screen</span>
                </button>
                <button
                  onClick={() => setSettingsTab("quality")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                    settingsTab === "quality" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-white/60 hover:text-white"
                  }`}
                >
                  Quality
                </button>
                <button
                  onClick={() => setSettingsTab("buffer")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                    settingsTab === "buffer" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-white/60 hover:text-white"
                  }`}
                >
                  <Gauge size={12} />
                  <span>Buffer ({liveDelay}s)</span>
                </button>
                <button
                  onClick={() => setSettingsTab("speed")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                    settingsTab === "speed" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-white/60 hover:text-white"
                  }`}
                >
                  Speed
                </button>
                <button
                  onClick={() => setSettingsTab("subtitles")}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                    settingsTab === "subtitles" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" : "text-white/60 hover:text-white"
                  }`}
                >
                  Subtitles
                </button>
              </div>
              <button onClick={() => setShowSettingsMenu(false)} className="p-1 text-white/40 hover:text-white shrink-0 ml-1">
                <X size={16} />
              </button>
            </div>

            {/* Screen Fit & Aspect Ratio Options */}
            {settingsTab === "screen" && (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Scaling size={13} className="text-cyan-400" />
                    <span>Display Mode & Scaling</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "fit", label: "16:9 Fit", desc: "Original proportions" },
                      { id: "stretch", label: "Stretch Screen", desc: "Fill entire width & height" },
                      { id: "fill", label: "Zoom & Fill", desc: "No black bars / crop" },
                      { id: "wide", label: "21:9 Ultra-Wide", desc: "Cinematic widescreen" },
                      { id: "4:3", label: "4:3 Classic", desc: "Retro broadcast ratio" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          setVideoDisplayMode(mode.id as any);
                          showHud(`Screen: ${mode.label}`, "📐");
                        }}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          videoDisplayMode === mode.id
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                            : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                          <span>{mode.label}</span>
                          {videoDisplayMode === mode.id && <Check size={14} className="text-cyan-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-white/50">{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Picture & Color Filter Presets */}
                <div className="pt-2 border-t border-white/10">
                  <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-400" />
                    <span>Picture Enhancer Filters</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "normal", label: "Standard (Default)" },
                      { id: "vivid", label: "Sports Vivid (Contrast)" },
                      { id: "cinema", label: "Cinema Dark" },
                      { id: "bright", label: "Bright Day Mode" },
                      { id: "crisp", label: "Ultra Sharp Clarity" }
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => {
                          setVideoFilterPreset(filter.id as any);
                          showHud(`Filter: ${filter.label}`, "✨");
                        }}
                        className={`px-2.5 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all ${
                          videoFilterPreset === filter.id
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,254,0.15)]"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <span className="truncate">{filter.label}</span>
                        {videoFilterPreset === filter.id && <Check size={13} className="text-cyan-400 shrink-0 ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quality Options */}
            {settingsTab === "quality" && (
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {qualityLevels.length > 0 ? (
                  <>
                    <button
                      onClick={() => handleQualityChange("auto")}
                      className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between transition-all ${
                        selectedQuality === "auto" 
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" 
                          : "hover:bg-white/5 text-white/80"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>Auto (Adaptive)</span>
                          {activePlayingQuality && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-400/20 text-cyan-300 font-mono">
                              Playing: {activePlayingQuality}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono">Dynamic bandwidth switching</div>
                      </div>
                      {selectedQuality === "auto" && <Check size={15} className="text-cyan-400 shrink-0" />}
                    </button>

                    {qualityLevels.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleQualityChange(opt.id)}
                        className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between transition-all ${
                          selectedQuality === opt.id 
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" 
                            : "hover:bg-white/5 text-white/80"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold flex items-center gap-1.5">
                            <span>{opt.label}</span>
                            {activePlayingQuality === opt.resolution && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="Active stream" />
                            )}
                          </div>
                          <div className="text-[10px] text-white/40 font-mono">{opt.resolution} &bull; {opt.bitrate}</div>
                        </div>
                        {selectedQuality === opt.id && <Check size={15} className="text-cyan-400 shrink-0" />}
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="text-xs text-white/50 py-3 text-center">
                    {activePlayingQuality ? `Playing at ${activePlayingQuality} (Native stream)` : "Auto Adaptive stream"}
                  </div>
                )}
              </div>
            )}

            {/* Buffer & Live Delay Tuning */}
            {settingsTab === "buffer" && (
              <div className="space-y-4">
                <div>
                  <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Gauge size={13} className="text-cyan-400" />
                      <span>Live Stream Delay</span>
                    </span>
                    <span className="text-[10px] text-cyan-300 font-mono font-bold bg-cyan-500/20 px-2 py-0.5 rounded-md">
                      {liveDelay}s Delay (Active)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { delay: 4, label: "4s Low Latency", desc: "Fast sync" },
                      { delay: 8, label: "8s Ultra Stable (Default)", desc: "Zero buffering" },
                      { delay: 12, label: "12s Deep Buffer", desc: "Weak network" },
                    ].map((item) => (
                      <button
                        key={item.delay}
                        onClick={() => {
                          setLiveDelay(item.delay);
                          if (hlsRef.current) {
                            hlsRef.current.config.liveSyncDuration = item.delay;
                            hlsRef.current.config.liveMaxLatencyDuration = item.delay + 6;
                          }
                          showHud(`Live Delay: ${item.delay}s`, "⏱️");
                        }}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          liveDelay === item.delay
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_12px_rgba(0,242,254,0.2)]"
                            : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                          <span>{item.delay}s</span>
                          {liveDelay === item.delay && <Check size={13} className="text-cyan-400 shrink-0" />}
                        </div>
                        <div className="text-[9px] text-white/50 leading-tight">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buffer Health Meter */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                  <div className="flex items-center justify-between text-xs font-bold text-white/80 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Activity size={13} className="text-emerald-400" />
                      <span>Forward Buffer Health</span>
                    </span>
                    <span className="font-mono text-emerald-400">{bufferAhead}s buffered</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-300 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (bufferAhead / 15) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/40 font-mono mt-1">
                    <span>0s (Starvation)</span>
                    <span className="text-emerald-400">Target: 8s+ Buffer</span>
                    <span>15s+</span>
                  </div>
                </div>
              </div>
            )}

            {/* Speed Options */}
            {settingsTab === "speed" && (
              <div className="grid grid-cols-3 gap-2">
                {SPEED_OPTIONS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all text-center ${
                      selectedSpeed === speed 
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40" 
                        : "bg-white/5 hover:bg-white/10 text-white/80"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}

            {/* Subtitle Options */}
            {settingsTab === "subtitles" && (
              <div className="space-y-1">
                {SUBTITLE_OPTIONS.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => handleSubtitleChange(sub.id)}
                    className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between text-xs font-bold transition-all ${
                      selectedSubtitle === sub.id 
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30" 
                        : "hover:bg-white/5 text-white/80"
                    }`}
                  >
                    <span>{sub.label}</span>
                    {selectedSubtitle === sub.id && <Check size={15} className="text-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dedicated Embed Adjustments & Controls Flyout Drawer */}
      <AnimatePresence>
        {showEmbedControlsDrawer && (
          <motion.div 
            id="embed-adjustments-drawer"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-16 sm:bottom-20 right-2 left-2 sm:left-auto sm:right-6 z-40 liquid-glass rounded-2xl border border-white/15 p-4 sm:w-88 shadow-2xl backdrop-blur-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3.5">
              <div className="flex items-center gap-2 text-cyan-300 font-extrabold text-xs tracking-wide">
                <Sliders size={15} />
                <span>EMBED PLAYER CONTROLS</span>
              </div>
              <button 
                onClick={() => setShowEmbedControlsDrawer(false)} 
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Aspect Ratio Selector */}
              <div>
                <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider block mb-1.5">
                  Aspect Ratio & Scaling
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "fit", label: "16:9 Fit" },
                    { id: "fill", label: "Zoom Fill" },
                    { id: "stretch", label: "Stretch" },
                    { id: "wide", label: "21:9 Wide" },
                    { id: "4:3", label: "4:3 Retro" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setVideoDisplayMode(item.id as any);
                        showHud(`Aspect: ${item.label}`, "📐");
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-center border ${
                        videoDisplayMode === item.id 
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]" 
                          : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Picture Enhancer Filter */}
              <div>
                <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider block mb-1.5">
                  Picture & Color Enhancer
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "normal", label: "Normal (Standard)" },
                    { id: "vivid", label: "Sports Vivid" },
                    { id: "cinema", label: "Cinema Dark" },
                    { id: "bright", label: "Bright Room" },
                    { id: "crisp", label: "Ultra Crisp" }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        setVideoFilterPreset(filter.id as any);
                        showHud(`Color: ${filter.label}`, "✨");
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between border ${
                        videoFilterPreset === filter.id 
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]" 
                          : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                      }`}
                    >
                      <span>{filter.label}</span>
                      {videoFilterPreset === filter.id && <Check size={13} className="text-cyan-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Volume Booster */}
              <div>
                <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider block mb-1.5">
                  Audio Booster
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { val: 1, label: "100% Normal" },
                    { val: 1.5, label: "150% Boost" },
                    { val: 2, label: "200% Super" }
                  ].map((boost) => (
                    <button
                      key={boost.val}
                      onClick={() => {
                        setEmbedAudioBoost(boost.val as any);
                        showHud(`Gain: ${boost.label}`, "🔊");
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-center border ${
                        embedAudioBoost === boost.val 
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,254,0.2)]" 
                          : "bg-white/5 hover:bg-white/10 border-white/10 text-white/70"
                      }`}
                    >
                      {boost.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liquid Glass Server / Source Switcher Drawer */}
      <AnimatePresence>
        {showServerDrawer && (
          <motion.div 
            id="server-switcher-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="absolute top-0 right-0 bottom-0 w-80 max-w-full liquid-glass z-50 p-6 border-l border-white/15 shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            <div>
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-cyan-300 font-extrabold text-sm tracking-wide">
                  <Server size={18} />
                  <span>AR STREAM SOURCE CDNs</span>
                </div>
                <button 
                  id="close-server-drawer-btn"
                  onClick={() => setShowServerDrawer(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {availableServers.map((server) => {
                  const isCurrent = activeServer?.url === server.url;
                  const isServerEmbed = server.protocol === "EMBED" || isEmbedUrl(server.url);
                  return (
                    <button
                      key={server.id}
                      onClick={() => handleSelectServer(server)}
                      className={`w-full p-3.5 rounded-2xl text-left border transition-all ${
                        isCurrent 
                          ? "bg-cyan-500/15 border-cyan-400/60 shadow-[0_0_20px_rgba(0,242,254,0.2)]" 
                          : "bg-white/5 hover:bg-white/10 border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isCurrent ? "text-cyan-300" : "text-white"}`}>
                          {server.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {isServerEmbed && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              EMBED
                            </span>
                          )}
                          {server.badge && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-white/10 text-cyan-400">
                              {server.badge}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/50 font-mono">
                        <span>{server.location}</span>
                        <span className="text-cyan-400 font-bold">{server.ping ? `${server.ping}ms Ping` : "Live CDN"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-500/5 border border-cyan-400/20 mt-6">
              <p className="text-[11px] text-cyan-300/80 leading-relaxed font-semibold">
                Tip: External embed players will run in isolated built-in browser frames with audio and fullscreen capabilities.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
