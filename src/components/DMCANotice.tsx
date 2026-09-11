import React, { useState } from "react";
import { ShieldCheck, Info, X, ExternalLink, Scale } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DMCANoticeProps {
  className?: string;
}

export function DMCANotice({ className = "" }: DMCANoticeProps) {
  const [showFullModal, setShowFullModal] = useState(false);

  return (
    <>
      <div 
        id="dmca-notice-footer"
        className={`w-full max-w-6xl mx-auto px-4 py-4 liquid-glass-subtle border border-white/5 rounded-2xl text-xs text-white/50 space-y-2 ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2">
            <span className="p-1 rounded-lg bg-white/5 text-cyan-400 shrink-0">
              <ShieldCheck size={14} />
            </span>
            <div className="font-semibold text-white/80 flex items-center gap-2 flex-wrap">
              <span className="text-cyan-400 font-bold uppercase tracking-wider text-[11px]">DMCA Notice</span>
              <span className="text-[10px] text-white/40 hidden sm:inline">&bull;</span>
              <span className="text-[11px] font-normal text-white/60">
                This website does not host any media content on its own servers. Our site visitors might use external or third parties services to show content (Example: Embedding media from sites like Bet365, Dailymotion, Streamable, etc.)
              </span>
            </div>
          </div>

          <button
            id="view-dmca-details-btn"
            type="button"
            onClick={() => setShowFullModal(true)}
            className="shrink-0 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline flex items-center gap-1 self-end sm:self-center"
          >
            <span>Legal Disclaimer</span>
            <ExternalLink size={10} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFullModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg liquid-glass rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative space-y-4"
            >
              <button
                id="close-dmca-modal-btn"
                onClick={() => setShowFullModal(false)}
                className="absolute top-5 right-5 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                  <Scale size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                    DMCA & Content Disclaimer
                  </h3>
                  <p className="text-[11px] text-white/50">Copyright compliance & indexing policy</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-white/70 leading-relaxed border-t border-b border-white/10 py-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-cyan-200">
                  <p className="font-semibold text-[11px] text-cyan-300 uppercase tracking-wider mb-1">
                    Official DMCA Notice
                  </p>
                  <p>
                    This website does not host any media content on its own servers. Our site visitors might use external or third parties services to show content (Example: Embedding media from sites like Bet365, Dailymotion, Streamable, etc.)
                  </p>
                </div>

                <p>
                  All streams, video embeds, and IPTV playlists referenced on this site are publicly accessible links provided by third-party hosting platforms. We do not store, encode, broadcast, or transmit any audio/visual media on our infrastructure.
                </p>

                <p>
                  If you are a copyright owner or an agent thereof and believe that any content linked on this platform infringes upon your copyrights, please contact the hosting service directly or reach out with specific URL references for immediate link removal.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowFullModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
