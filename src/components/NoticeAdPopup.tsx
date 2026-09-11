import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Megaphone, 
  ExternalLink, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap,
  Lock,
  Unlock,
  Clock,
  Gift,
  Flame,
  Check
} from "lucide-react";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { SiteNoticeConfig } from "../types";
import { 
  getCachedSiteNotice, 
  shouldShowNotice, 
  markNoticeAsShown, 
  registerNoticeOpenHandler 
} from "../utils/announcementManager";
import { openAdRedirect } from "../utils/adManager";

export function NoticeAdPopup() {
  const [config, setConfig] = useState<SiteNoticeConfig>(() => getCachedSiteNotice());
  const [isOpen, setIsOpen] = useState(false);
  
  // Step state: "ad" (first watch ads) -> "announcement" (after clicking ads show announcement)
  const [step, setStep] = useState<"ad" | "announcement">("ad");
  // Strictly track whether the user has clicked on the ad during this modal session
  const [hasClickedAd, setHasClickedAd] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);

  // Subscribe to real-time updates of site notice config in Firestore
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const docRef = doc(db, "siteConfig", "notice");
      unsubscribe = onSnapshot(docRef, {
        next: (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const newConfig: SiteNoticeConfig = {
              id: "notice",
              enabled: data.enabled !== false,
              title: data.title || "Official Stream Announcement & Backup Mirrors",
              message: data.message || "",
              bannerImageUrl: data.bannerImageUrl || "",
              mainRedirectUrl: data.mainRedirectUrl || "",
              buttonText: data.buttonText || "👉 Join Official Channel / Mirror",
              adImageUrl: data.adImageUrl || "",
              adRedirectUrl: data.adRedirectUrl || "",
              showFrequency: data.showFrequency || "always",
              autoOpenDelay: typeof data.autoOpenDelay === "number" ? data.autoOpenDelay : 800,
              updatedAt: data.updatedAt,
            };
            setConfig(newConfig);
            try {
              localStorage.setItem("ar_site_notice_cache", JSON.stringify(newConfig));
            } catch {
              // Ignore
            }
          }
        },
        error: (err) => {
          console.warn("Firestore notice listener notice:", err.message);
        }
      });
    } catch (err) {
      console.warn("Firestore notice init notice:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Listen to programmatic triggers (e.g., user clicks Notice button in top bar or Admin clicks preview)
  useEffect(() => {
    const unregister = registerNoticeOpenHandler(() => {
      // Must watch ad first and click ad before announcement & continue button are unlocked
      setStep("ad");
      setHasClickedAd(false);
      setCountdown(5);
      setIsOpen(true);
    });
    return () => unregister();
  }, []);

  // Automatically pop up after web opens according to configuration
  useEffect(() => {
    if (!config.enabled) return;

    if (shouldShowNotice(config)) {
      const delay = Math.max(300, config.autoOpenDelay || 800);
      const timer = setTimeout(() => {
        // First watch ads on entrance
        setStep("ad");
        setHasClickedAd(false);
        setCountdown(5);
        setIsOpen(true);
        markNoticeAsShown(config);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [config.enabled, config.showFrequency, config.autoOpenDelay]);

  // Countdown timer while viewing ad
  useEffect(() => {
    if (!isOpen || step !== "ad") return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, step, countdown]);

  // "AFTER CLICK ADS SHOW ANNOUNCEMENT & UNLOCK CONTINUE TO WEBSITE"
  // When user clicks the ad (banner or button), open sponsor link in new tab
  // and transition to announcement view, where "Continue to Website" will now be shown.
  const handleAdClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 1. Open the sponsored ad URL in new window/tab
    if (config.adRedirectUrl && config.adRedirectUrl.trim().length > 0) {
      window.open(config.adRedirectUrl, "_blank", "noopener,noreferrer");
    } else {
      openAdRedirect();
    }

    // 2. Mark that ad has been clicked
    setHasClickedAd(true);

    // 3. Immediately show the official announcement screen
    setStep("announcement");
  };

  // Handle clicking main redirect url inside the announcement
  const handleMainAction = () => {
    if (config.mainRedirectUrl && config.mainRedirectUrl.trim().length > 0) {
      try {
        window.open(config.mainRedirectUrl, "_blank", "noopener,noreferrer");
      } catch (e) {
        console.warn("Popup redirect notice:", e);
      }
    }
    setIsOpen(false);
  };

  // Dismiss modal only allowed after user has clicked the ad
  const handleClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!hasClickedAd) return; // Disallow closing before clicking the ad
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="notice-ad-popup-overlay"
          className="fixed inset-0 z-[99998] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in select-none overflow-y-auto"
          onClick={() => {
            // Only allow clicking outside to dismiss if user already clicked the ad
            if (hasClickedAd) {
              handleClose();
            }
          }}
        >
          <motion.div
            id="notice-ad-popup-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -15 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-xl sm:max-w-2xl bg-[#090d16]/98 border border-white/15 rounded-2xl sm:rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden pointer-events-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar / Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-white/10 bg-black/50">
              <div className="flex items-center gap-2 text-white">
                {step === "ad" ? (
                  <>
                    <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Zap size={15} className="fill-amber-400/30" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-amber-400">
                        Sponsored Advertisement
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                        <Clock size={10} />
                        <span>Step 1 of 2: Watch Ad</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                      <Megaphone size={14} className="fill-cyan-400/30" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-white/90">
                        {config.title || "Official Announcement"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 flex items-center gap-1">
                        <Check size={11} className="stroke-[3]" />
                        <span>UNLOCKED</span>
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Close Button: ONLY shown after the ad has been clicked */}
              {hasClickedAd ? (
                <button
                  id="close-notice-popup-x-btn"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer group"
                  title="Close and continue to website"
                >
                  <X size={16} className="group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                  <Lock size={12} className="text-amber-400" />
                  <span>Click ad to unlock</span>
                </div>
              )}
            </div>

            {/* Step Progression Indicators */}
            <div className="px-4 sm:px-6 pt-3 pb-1 bg-black/30 border-b border-white/5 flex items-center gap-2">
              {/* Indicator 1: Watch Ad */}
              <div
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                  step === "ad"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {hasClickedAd ? (
                  <Check size={13} className="text-emerald-400 stroke-[3]" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
                <span>1. Watch Sponsor Ad</span>
              </div>

              {/* Indicator 2: Official Announcement (Locked until ad click) */}
              <div
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                  step === "announcement"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                    : "bg-white/5 text-white/35 border border-white/5"
                }`}
              >
                {hasClickedAd ? (
                  <Unlock size={13} className="text-cyan-400" />
                ) : (
                  <Lock size={13} className="text-white/40" />
                )}
                <span>2. Official Announcement</span>
                {!hasClickedAd && (
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                    Locked
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {step === "ad" ? (
                /* ==========================================================
                   STEP 1: FIRST WATCH ADS (NO CONTINUE BUTTON HERE)
                   ========================================================== */
                <div className="space-y-4 animate-fade-in">
                  {/* Status Banner */}
                  <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-purple-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <Flame size={20} className="fill-amber-400/20" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-black text-white">
                          First Watch Sponsor Ad
                        </span>
                        <span className="text-[11px] text-white/70">
                          Click the ad below to unlock the announcement & website!
                        </span>
                      </div>
                    </div>

                    {/* Countdown / Status Badge */}
                    <div className="px-3 py-1.5 rounded-full bg-black/60 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold shrink-0 flex items-center gap-1.5 self-end sm:self-center">
                      <Clock size={13} className={countdown > 0 ? "animate-spin" : ""} />
                      <span>
                        {countdown > 0
                          ? `Watching Ad: ${countdown}s`
                          : "Ad Ready! Click below"}
                      </span>
                    </div>
                  </div>

                  {/* Primary Ad Creative Banner (Clickable) */}
                  {config.adImageUrl ? (
                    <div
                      id="sponsored-ad-banner-clickable"
                      onClick={handleAdClick}
                      className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden border-2 border-amber-500/40 hover:border-amber-400 shadow-2xl transition-all group cursor-pointer aspect-[16/9] sm:aspect-[21/9] bg-black/60"
                      title="Click ad to unlock announcement"
                    >
                      <img
                        src={config.adImageUrl}
                        alt="Sponsored Partner Ad"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex items-end justify-between p-3.5 sm:p-5">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] sm:text-xs font-black w-fit uppercase tracking-wider">
                            OFFICIAL SPONSOR AD
                          </span>
                          <span className="text-xs sm:text-sm font-black text-white drop-shadow">
                            Special Partner Deal & Stream Access
                          </span>
                        </div>
                        <div className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-xl transform group-hover:scale-105 transition-transform shrink-0">
                          <span>Click Ad</span>
                          <ExternalLink size={13} className="stroke-[3]" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      id="sponsored-ad-banner-clickable"
                      onClick={handleAdClick}
                      className="relative w-full rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#0c1f17] via-[#082a1b] to-[#041a10] border-2 border-emerald-500/50 hover:border-emerald-400 p-4 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 shadow-[0_0_35px_rgba(16,185,129,0.2)] hover:shadow-[0_0_45px_rgba(16,185,129,0.4)] transition-all group cursor-pointer overflow-hidden"
                      title="Click ad to unlock announcement"
                    >
                      <div className="absolute -top-10 -left-10 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-400/30 transition-all" />
                      <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

                      <div className="flex items-center gap-3.5 sm:gap-5 z-10 w-full md:w-auto">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/60 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] group-hover:scale-105 transition-transform shrink-0">
                          <Gift size={26} className="animate-bounce" />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              VERIFIED SPONSOR
                            </span>
                            <span className="text-[10px] text-white/60 font-mono">100% Free Unlock</span>
                          </div>
                          <span className="text-base sm:text-xl font-black text-white tracking-tight mt-1 leading-tight">
                            Ultra HD 4K Live Sports & Welcome Deal
                          </span>
                          <span className="text-xs text-emerald-300/90 font-medium">
                            Zero buffering • Instant server mirrors • Exclusive access
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 z-10 shrink-0 w-full md:w-auto justify-end">
                        <div className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg group-hover:scale-105 transition-transform">
                          <span>Visit Sponsor</span>
                          <ExternalLink size={14} className="stroke-[3]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* THE ACTION: CLICK AD TO UNLOCK ANNOUNCEMENT & WEBSITE */}
                  <button
                    id="click-ad-to-unlock-announcement-btn"
                    onClick={handleAdClick}
                    className="w-full py-4 px-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 hover:from-amber-400 hover:to-rose-400 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] transition-all transform hover:scale-[1.01] active:scale-98 cursor-pointer animate-pulse"
                  >
                    <ExternalLink size={18} className="stroke-[3]" />
                    <span>👉 Click Ad to View Announcement & Unlock Website</span>
                    <ArrowRight size={18} className="stroke-[3]" />
                  </button>

                  <p className="text-[11px] text-white/50 text-center">
                    💡 Click the sponsor ad above to unlock the official announcement and website access!
                  </p>
                </div>
              ) : (
                /* ==========================================================
                   STEP 2: AFTER CLICK ADS SHOW ANNOUNCEMENT & CONTINUE TO WEBSITE
                   ========================================================== */
                <div className="space-y-4 animate-fade-in">
                  {/* Unlocked Confirmation Banner */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/15 to-emerald-500/20 border border-emerald-500/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-emerald-300">
                      <Sparkles size={18} className="text-cyan-400 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-black text-white">
                          Official Announcement Unlocked!
                        </span>
                        <span className="text-[11px] text-emerald-300/80">
                          Thank you for supporting AR Stream.
                        </span>
                      </div>
                    </div>

                    {/* Prominent Continue Button right in the unlock header */}
                    <button
                      id="notice-header-continue-btn"
                      onClick={handleClose}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <span>Continue to Website</span>
                      <ArrowRight size={14} className="stroke-[3]" />
                    </button>
                  </div>

                  {/* Message Description */}
                  {config.message && (
                    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.04] border border-white/10 text-white/90 text-xs sm:text-sm leading-relaxed">
                      <p className="whitespace-pre-line">{config.message}</p>
                    </div>
                  )}

                  {/* Announcement Banner Image (Admin Provided) */}
                  {config.bannerImageUrl && (
                    <div
                      id="notice-banner-image-wrapper"
                      onClick={handleMainAction}
                      className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden border border-white/15 hover:border-cyan-400/80 shadow-2xl transition-all group cursor-pointer aspect-[16/8] sm:aspect-[21/9] bg-black/50"
                      title="Click banner to visit link"
                    >
                      <img
                        src={config.bannerImageUrl}
                        alt="Announcement Banner"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-3 sm:p-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-black/70 text-white/90 text-[10px] sm:text-xs font-bold backdrop-blur-md border border-white/20">
                            Official Channel & Links
                          </span>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs flex items-center gap-1 shadow-lg transform group-hover:scale-105 transition-transform">
                          <span>Click to Open</span>
                          <ExternalLink size={12} className="stroke-[3]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Redirect URL Big Action Button */}
                  {config.mainRedirectUrl && (
                    <button
                      id="notice-main-cta-btn"
                      onClick={handleMainAction}
                      className="w-full py-3.5 sm:py-4 px-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] transition-all transform hover:scale-[1.01] active:scale-98 cursor-pointer"
                    >
                      <span>{config.buttonText || "Open Main Link Now →"}</span>
                      <ArrowRight size={18} className="stroke-[3]" />
                    </button>
                  )}

                  {/* Direct "Continue to Website" Button inside content */}
                  <button
                    id="notice-inner-continue-btn"
                    onClick={handleClose}
                    className="w-full py-3 px-5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-emerald-400/50 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-98"
                  >
                    <span>Continue to Website</span>
                    <ArrowRight size={15} className="text-emerald-400 stroke-[3]" />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-black/60 border-t border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                <span className="hidden xs:inline">AR Stream Broadcast Network</span>
              </div>

              {/* ONLY SHOW "Continue to Website" AFTER user has clicked the ad! */}
              {hasClickedAd && step === "announcement" ? (
                <button
                  id="notice-continue-to-website-btn"
                  onClick={handleClose}
                  className="w-full xs:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-black text-xs font-black transition-all cursor-pointer ml-auto flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-105 active:scale-95"
                >
                  <span>Continue to Website</span>
                  <ArrowRight size={14} className="stroke-[3]" />
                </button>
              ) : (
                <div className="flex items-center gap-2 text-[11px] sm:text-xs text-amber-400/90 font-bold ml-auto bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-xl">
                  <Lock size={12} className="shrink-0 animate-pulse text-amber-400" />
                  <span>Click sponsor ad above to unlock website access</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
