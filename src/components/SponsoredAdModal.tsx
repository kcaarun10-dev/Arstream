import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Megaphone, ArrowRight, Download, ShieldCheck, Sparkles, ExternalLink } from "lucide-react";
import { registerAdHandler, openAdRedirect } from "../utils/adManager";

interface SponsoredAdModalProps {
  initialOpen?: boolean;
}

export const SponsoredAdModal: React.FC<SponsoredAdModalProps> = ({ initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCreative, setActiveCreative] = useState<number>(0);
  const callbackRef = useRef<(() => void) | null>(null);

  // Register listener for programmatic ad triggers across stream taps & server switches
  useEffect(() => {
    const unregister = registerAdHandler((onCloseCallback) => {
      callbackRef.current = onCloseCallback || null;
      // Cycle through high-CTR creative themes
      setActiveCreative((prev) => (prev + 1) % 3);
      setIsOpen(true);
    });

    return () => {
      unregister();
    };
  }, []);

  // Show ad when triggered programmatically (e.g. initialOpen prop or stream switches)
  useEffect(() => {
    if (initialOpen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [initialOpen]);

  const handleAction = (redirect = true) => {
    if (redirect) {
      openAdRedirect();
    }
    setIsOpen(false);
    if (callbackRef.current) {
      const cb = callbackRef.current;
      callbackRef.current = null;
      cb();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="sponsored-ad-overlay"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
          onClick={() => handleAction(true)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -15 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-2xl sm:max-w-3xl bg-[#090d14]/95 border border-white/15 rounded-2xl sm:rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header matching screenshot */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/10 bg-black/40">
              <div className="flex items-center gap-2 text-white/80">
                <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <Megaphone size={14} className="fill-rose-400/30" />
                </div>
                <span className="text-[11px] sm:text-xs font-black tracking-[0.18em] text-white/80 uppercase">
                  Sponsored Advertisement
                </span>
              </div>

              <button
                id="close-sponsored-ad-x-btn"
                onClick={() => handleAction(true)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer group"
                title="Close and continue"
              >
                <X size={16} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Middle Ad Content - Exact replica of the screenshot banner */}
            <div className="p-4 sm:p-6 bg-gradient-to-b from-transparent to-black/30">
              <div
                id="sponsored-ad-banner-clickable"
                onClick={() => handleAction(true)}
                className="relative w-full rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#032d19] via-[#053820] to-[#042817] border border-emerald-500/40 hover:border-emerald-400/80 p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 shadow-2xl transition-all group cursor-pointer overflow-hidden"
              >
                {/* Background ambient lighting */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-400/25 transition-all" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

                {/* Left Section: Brand Logo & Heading */}
                <div className="flex items-center gap-3.5 sm:gap-5 z-10 w-full md:w-auto">
                  {/* Opera Red Logo */}
                  <div className="relative shrink-0 flex items-center gap-2.5">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-red-600/90 shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center justify-center p-2 border-2 border-white/20 group-hover:scale-105 transition-transform">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-[3px] border-white flex items-center justify-center">
                        <div className="w-3.5 h-3.5 rounded-full bg-red-600" />
                      </div>
                    </div>
                    <span className="text-xl sm:text-2xl font-black text-white tracking-tight hidden xs:inline">
                      Opera
                    </span>
                  </div>

                  {/* Main Tagline */}
                  <div className="flex flex-col">
                    <span className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
                      No logs.
                    </span>
                    <span className="text-lg sm:text-2xl font-black text-emerald-300 tracking-tight leading-tight">
                      No tracking.
                    </span>
                  </div>
                </div>

                {/* Center / Right Section: CTA & App Mockup Preview */}
                <div className="flex items-center gap-3 sm:gap-4 z-10 w-full md:w-auto justify-between md:justify-end">
                  {/* "INSTALL FOR FREE" Button */}
                  <div className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-full bg-white hover:bg-emerald-50 text-[#04331d] font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.3)] group-hover:scale-105 transition-all shrink-0">
                    <Download size={15} className="stroke-[3]" />
                    <span className="tracking-wide">INSTALL FOR FREE</span>
                  </div>

                  {/* Browser / App Interface Mockup matching screenshot */}
                  <div className="relative w-28 sm:w-36 h-14 sm:h-16 rounded-lg bg-[#0e1726]/90 border border-white/15 p-1.5 hidden sm:flex flex-col justify-between shadow-inner shrink-0 overflow-hidden">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                    </div>

                    <div className="flex items-center gap-2 bg-black/40 rounded p-1">
                      <div className="p-1 rounded bg-purple-500/20 text-purple-400">
                        <ShieldCheck size={12} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[7px] text-white/90 font-bold uppercase tracking-wider">Protected</span>
                        <span className="text-[6px] text-emerald-400 font-mono">100% Free</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Button matching screenshot: "Close Ad & Watch Stream →" */}
            <div className="p-4 sm:pb-6 flex justify-center bg-black/40 border-t border-white/5">
              <button
                id="close-ad-watch-stream-btn"
                onClick={() => handleAction(true)}
                className="w-full max-w-xs sm:max-w-sm py-3 sm:py-3.5 px-6 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-400 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(37,99,235,0.45)] hover:shadow-[0_0_40px_rgba(37,99,235,0.7)] transition-all transform hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                <span>Close Ad & Watch Stream</span>
                <ArrowRight size={17} className="stroke-[3]" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
