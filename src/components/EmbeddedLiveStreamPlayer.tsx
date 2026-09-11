import React, { useState, useEffect, useRef } from "react";
import { extractIframeSrc } from "../utils/channelLookup";
import { Globe, RefreshCw, AlertCircle, Maximize, ExternalLink } from "lucide-react";

export interface EmbeddedLiveStreamPlayerProps {
  /**
   * The live stream embed URL or raw <iframe> embed snippet.
   */
  url: string;
  /**
   * Accessible title describing the broadcast (e.g., "Premier League Live Stream").
   */
  title?: string;
  /**
   * Optional custom CSS class for the player container.
   */
  className?: string;
  /**
   * Video scaling display mode (Fit, Fill / Zoom Crop, Stretch, Wide 21:9, Standard 4:3, etc.)
   */
  displayMode?: "fit" | "fill" | "stretch" | "wide" | "4:3";
  /**
   * Visual filter tone preset
   */
  filterPreset?: "normal" | "vivid" | "cinema" | "bright" | "crisp";
  /**
   * Callback when the stream frame finishes loading.
   */
  onLoaded?: () => void;
  /**
   * Callback if the embed fails to load.
   */
  onError?: () => void;
}

/**
 * Direct Live Stream Embedded Video Player.
 * Runs embedded stream sources directly in the iframe without intermediate proxying.
 */
export const EmbeddedLiveStreamPlayer: React.FC<EmbeddedLiveStreamPlayerProps> = ({
  url,
  title = "Embedded Live Stream Video Player",
  className = "",
  displayMode = "fit",
  filterPreset = "normal",
  onLoaded,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Extract clean direct embed URL from raw URL or <iframe> snippet - runs directly without any proxy
  const embedSrc = React.useMemo(() => {
    return extractIframeSrc(url || "");
  }, [url]);

  // Reset loading state when source URL changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [embedSrc, reloadKey]);

  // Ensure the iframe element NEVER has any sandbox attribute in the DOM
  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;

    // Explicitly remove sandbox attribute if present
    if (el.hasAttribute("sandbox")) {
      el.removeAttribute("sandbox");
    }

    // Active MutationObserver to immediately strip sandbox attribute if added dynamically
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "sandbox") {
          el.removeAttribute("sandbox");
        }
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ["sandbox"] });
    return () => observer.disconnect();
  }, [embedSrc, reloadKey]);

  const handleFrameLoad = () => {
    setIsLoading(false);
    setHasError(false);
    if (onLoaded) {
      onLoaded();
    }
  };

  const handleFrameError = () => {
    setIsLoading(false);
    setHasError(true);
    if (onError) {
      onError();
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    setReloadKey((prev) => prev + 1);
  };

  // Dynamic filter CSS calculation
  const getFilterStyle = () => {
    switch (filterPreset) {
      case "vivid":
        return "saturate(1.25) contrast(1.1)";
      case "cinema":
        return "contrast(1.15) brightness(0.95) saturate(1.1)";
      case "bright":
        return "brightness(1.12) contrast(1.05)";
      case "crisp":
        return "contrast(1.2) saturate(1.05)";
      default:
        return "none";
    }
  };

  // Dynamic scale / aspect-ratio transform calculation
  const getScaleStyle = (): React.CSSProperties => {
    switch (displayMode) {
      case "fill":
        return { transform: "scale(1.18)", transformOrigin: "center center" };
      case "stretch":
        return { width: "100%", height: "100%", transform: "scaleX(1.15) scaleY(1.05)", transformOrigin: "center center" };
      case "wide":
        return { width: "100%", height: "100%", transform: "scaleX(1.28) scaleY(0.92)", transformOrigin: "center center" };
      case "4:3":
        return { width: "100%", height: "100%", transform: "scaleX(0.85)", transformOrigin: "center center" };
      case "fit":
      default:
        return { transform: "none" };
    }
  };

  if (!embedSrc) {
    return (
      <div 
        className={`w-full aspect-video bg-neutral-950 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-white/70 border border-white/10 ${className}`}
      >
        <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
        <p className="font-semibold text-white">No Live Stream URL Provided</p>
        <p className="text-xs text-white/50 mt-1 max-w-sm">Please select a valid broadcast server or stream channel to begin playback.</p>
      </div>
    );
  }

  return (
    <div
      id="embedded-live-stream-container"
      className={`relative w-full h-full min-h-0 bg-black overflow-hidden select-none flex items-center justify-center ${className}`}
    >
      {/* Loading Skeleton / Live Connection Spinner */}
      {isLoading && (
        <div 
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm pointer-events-none transition-opacity duration-300"
          aria-live="polite"
        >
          <div className="relative w-14 h-14 mb-3">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
            <div 
              className="absolute inset-2 rounded-full border-2 border-emerald-400/20 border-b-emerald-400 animate-spin" 
              style={{ animationDirection: "reverse", animationDuration: "1.2s" }} 
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="w-5 h-5 text-cyan-300 animate-pulse" />
            </div>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-white/10 border border-cyan-400/30 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">
              Connecting Live Streams...
            </span>
          </div>
        </div>
      )}

      {/* Error Fallback Banner */}
      {hasError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95 p-6 text-center text-white">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
          <h4 className="text-base font-bold text-white">Live Stream Connection Issue</h4>
          <p className="text-xs text-white/60 mt-1 mb-4 max-w-md">
            Unable to connect directly to the embedded stream. You can reload the player to retry.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={handleReload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Stream</span>
            </button>
          </div>
        </div>
      )}

      {/*
        The Embedded Live Stream <iframe> Element:
        - Matches exact requested specs: frameBorder="0", scrolling="no", allowFullScreen, allowTransparency, and absolute 100% hidden-overflow styling
        - Explicitly NO sandbox attribute so all third-party stream players, audio, scripts, and video engines run completely unrestricted
        - Comprehensive allow attributes for modern video playback, autoplay, and fullscreen
      */}
      <iframe
        id="player"
        ref={iframeRef}
        key={`${embedSrc}-${reloadKey}`}
        src={embedSrc}
        frameBorder="0"
        scrolling="no"
        allowFullScreen={true}
        {...{ allowtransparency: "true" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; screen-wake-lock; payment; storage-access; cross-origin-isolated"
        width="100%"
        height="100%"
        title={title}
        aria-label={title}
        referrerPolicy="no-referrer"
        onLoad={handleFrameLoad}
        onError={handleFrameError}
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
          filter: getFilterStyle(),
          ...getScaleStyle(),
          transition: "transform 0.3s ease, filter 0.3s ease",
        }}
        className={`w-full h-full bg-black transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Quick Floating Controls Pill for Mobile Devices */}
      <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1.5 p-1 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 shadow-2xl opacity-90 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            if (embedSrc) {
              window.open(embedSrc, "_blank", "noopener,noreferrer");
            }
          }}
          className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
          title="Open Stream in Direct Tab (Runs outside any parent iframe sandbox)"
          aria-label="Open Stream in Direct Tab"
        >
          <ExternalLink size={13} />
          <span className="hidden sm:inline">Direct Tab</span>
        </button>
        <button
          type="button"
          onClick={handleReload}
          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          title="Reload Stream"
          aria-label="Reload Stream"
        >
          <RefreshCw size={13} />
        </button>
        <button
          type="button"
          onClick={() => {
            const container = document.getElementById("embedded-live-stream-container");
            if (container) {
              if (document.fullscreenElement) {
                document.exitFullscreen?.();
              } else {
                container.requestFullscreen?.();
              }
            }
          }}
          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          title="Fullscreen"
          aria-label="Fullscreen"
        >
          <Maximize size={13} />
        </button>
      </div>
    </div>
  );
};

export const LiveStreamPlayer: React.FC<{ url?: string; title?: string }> = ({
  url = "",
  title = "Live Stream",
}) => {
  const directUrl = React.useMemo(() => {
    return extractIframeSrc(url || "");
  }, [url]);

  return (
    <div className="relative w-full aspect-video min-h-[260px] sm:min-h-[380px] bg-black overflow-hidden rounded-2xl apple-ai-card">
      <iframe
        id="player"
        src={directUrl}
        frameBorder="0"
        scrolling="no"
        allowFullScreen={true}
        {...{ allowtransparency: "true" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; screen-wake-lock; payment; storage-access; cross-origin-isolated"
        width="100%"
        height="100%"
        title={title}
        aria-label={title}
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
    </div>
  );
};

export default EmbeddedLiveStreamPlayer;
