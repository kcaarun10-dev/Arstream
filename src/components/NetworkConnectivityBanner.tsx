import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WifiOff, Wifi, RefreshCw, Server, AlertTriangle, ArrowRight } from "lucide-react";
import { useNetworkStatus } from "../utils/useNetworkStatus";

interface NetworkConnectivityBannerProps {
  onSwitchServer?: () => void;
  onRetry?: () => void;
  serverCount?: number;
  activeServerName?: string;
  isStreamInterrupted?: boolean;
  isLoadTimeout?: boolean;
  timeoutSeconds?: number;
}

/**
 * Subtle and non-intrusive network connectivity & stream timeout detector banner.
 * Displays when network connection is lost, stream is interrupted, or stream fails to load after 15 seconds.
 */
export const NetworkConnectivityBanner: React.FC<NetworkConnectivityBannerProps> = ({
  onSwitchServer,
  onRetry,
  serverCount = 1,
  activeServerName,
  isStreamInterrupted = false,
  isLoadTimeout = false,
  timeoutSeconds = 15,
}) => {
  const { isOnline, effectiveType } = useNetworkStatus();
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowRestoredNotice(false);
    } else if (wasOffline && isOnline) {
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  const shouldShow = !isOnline || isStreamInterrupted || isLoadTimeout || showRestoredNotice;

  if (!shouldShow) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-50 max-w-[94%] sm:max-w-lg w-full pointer-events-auto"
      >
        {!isOnline ? (
          /* Offline Alert */
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-rose-500/40 text-rose-100 shadow-[0_10px_30px_rgba(244,63,94,0.25)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <WifiOff size={16} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-rose-200 truncate">Connection Lost</p>
                <p className="text-[10px] text-rose-300/70 truncate">Live stream will resume automatically once reconnected</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-1 border border-rose-500/30 transition-all active:scale-95"
                >
                  <RefreshCw size={12} />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        ) : showRestoredNotice ? (
          /* Connection Restored Notice */
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-emerald-500/40 text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.25)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Wifi size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-200">Connection Restored</p>
                <p className="text-[10px] text-emerald-300/70">Reconnected to live broadcast stream</p>
              </div>
            </div>
          </div>
        ) : isLoadTimeout ? (
          /* Stream did not load within 15 seconds */
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-amber-500/50 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.3)] animate-pulse-subtle">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle size={16} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-200 truncate">
                  Stream Taking Longer to Load ({timeoutSeconds}s+)
                </p>
                <p className="text-[10px] text-amber-300/80 truncate">
                  {serverCount > 1
                    ? `Source may be slow or offline. Switch to another stream node (${serverCount} available).`
                    : "No stream data received yet. Try reloading or checking network."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {serverCount > 1 && onSwitchServer && (
                <button
                  onClick={onSwitchServer}
                  className="px-2.5 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95"
                >
                  <Server size={12} />
                  <span>Switch Stream</span>
                </button>
              )}
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold flex items-center gap-1 border border-amber-500/30 transition-all active:scale-95"
                >
                  <RefreshCw size={12} />
                  <span className="hidden xs:inline">Retry</span>
                </button>
              )}
            </div>
          </div>
        ) : isStreamInterrupted ? (
          /* Stream Interruption / Buffer stall notice with fast switch button */
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-amber-500/40 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.25)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-200 truncate">Stream Signal Interrupted</p>
                <p className="text-[10px] text-amber-300/70 truncate">
                  {serverCount > 1 ? `Switch to another source node (${serverCount} available)` : "Reconnecting to live feed..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {serverCount > 1 && onSwitchServer && (
                <button
                  onClick={onSwitchServer}
                  className="px-2.5 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1 shadow-md transition-all active:scale-95"
                >
                  <Server size={12} />
                  <span>Switch Stream</span>
                </button>
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
};

export default NetworkConnectivityBanner;
