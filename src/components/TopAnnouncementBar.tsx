import React, { useState, useEffect, useMemo } from "react";
import { Megaphone, ExternalLink, X, ChevronRight, Bell, Sparkles } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Announcement, AnnouncementBadgeColor } from "../types";
import { getCachedAnnouncements, triggerNoticePopup } from "../utils/announcementManager";

export function TopAnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => getCachedAnnouncements());
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("ar_announcement_bar_dismissed") === "true";
    } catch {
      return false;
    }
  });

  // Real-time listener for announcements
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const colRef = collection(db, "announcements");
      unsubscribe = onSnapshot(colRef, {
        next: (snapshot) => {
          if (!snapshot.empty) {
            const list: Announcement[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              list.push({
                id: docSnap.id,
                text: data.text || "",
                linkUrl: data.linkUrl || "",
                badge: data.badge || "NOTICE",
                badgeColor: (data.badgeColor as AnnouncementBadgeColor) || "red",
                isActive: data.isActive !== false,
                openInNewTab: data.openInNewTab !== false,
                priority: typeof data.priority === "number" ? data.priority : 1,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              });
            });

            // Sort by priority, then active
            list.sort((a, b) => (a.priority || 0) - (b.priority || 0));
            setAnnouncements(list);

            try {
              localStorage.setItem("ar_announcements_cache", JSON.stringify(list));
            } catch {
              // Ignore storage errors
            }
          }
        },
        error: (err) => {
          console.warn("Firestore announcements sync notice:", err.message);
        }
      });
    } catch (err) {
      console.warn("Firestore announcements init notice:", err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const activeAnnouncements = useMemo(() => {
    return announcements.filter((a) => a.isActive);
  }, [announcements]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("ar_announcement_bar_dismissed", "true");
    } catch {
      // Ignore
    }
  };

  const handleRestore = () => {
    setIsDismissed(false);
    try {
      sessionStorage.removeItem("ar_announcement_bar_dismissed");
    } catch {
      // Ignore
    }
  };

  if (activeAnnouncements.length === 0) {
    return null;
  }

  // When dismissed by user, show a small floating bell pill in bottom-left or top
  if (isDismissed) {
    return (
      <button
        id="restore-announcement-bar-btn"
        onClick={handleRestore}
        className="fixed bottom-24 right-4 z-40 px-3 py-1.5 rounded-full bg-black/85 hover:bg-black text-white/80 hover:text-white border border-white/15 text-[11px] font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md transition-all cursor-pointer group"
        title="View announcements"
      >
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        <Megaphone size={13} className="text-rose-400 group-hover:scale-110 transition-transform" />
        <span>Announcements ({activeAnnouncements.length})</span>
      </button>
    );
  }

  // Helper for badge colors
  const getBadgeStyle = (color?: AnnouncementBadgeColor) => {
    switch (color) {
      case "red":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.3)]";
      case "amber":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]";
      case "emerald":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]";
      case "cyan":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]";
      case "purple":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]";
      case "blue":
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.3)]";
    }
  };

  // We repeat items to guarantee infinite seamless marquee loop
  const marqueeItems = [...activeAnnouncements, ...activeAnnouncements, ...activeAnnouncements];

  return (
    <div
      id="top-scrolling-announcement-bar"
      className="relative z-50 w-full bg-gradient-to-r from-[#0d0914] via-[#090d16] to-[#0d0914] border-b border-white/10 text-white select-none overflow-hidden"
    >
      <div className="flex items-center h-9 sm:h-10 px-2 sm:px-4">
        {/* Left Sticky Label / Icon */}
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 pr-3 sm:pr-4 border-r border-white/10 z-10 bg-inherit py-1">
          <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-400">
            <Megaphone size={12} className="sm:size-3.5 fill-rose-400/30" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
          </div>
          <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase text-rose-400 hidden xs:inline">
            ANNOUNCEMENT
          </span>
        </div>

        {/* Center Marquee Track */}
        <div className="flex-1 overflow-hidden relative mx-2 sm:mx-4 group cursor-pointer">
          {/* Subtle fade edges */}
          <div className="absolute left-0 inset-y-0 w-6 bg-gradient-to-r from-[#0d0914] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 inset-y-0 w-6 bg-gradient-to-l from-[#0d0914] to-transparent z-10 pointer-events-none" />

          <div className="animate-marquee-infinite flex items-center gap-8 sm:gap-12 py-1">
            {marqueeItems.map((item, index) => {
              const hasLink = Boolean(item.linkUrl && item.linkUrl.trim().length > 0);

              return (
                <div
                  key={`${item.id}-${index}`}
                  className="flex items-center gap-2 sm:gap-3 shrink-0 group/item transition-transform hover:scale-[1.01]"
                  onClick={() => {
                    if (hasLink) {
                      window.open(
                        item.linkUrl,
                        item.openInNewTab ? "_blank" : "_self",
                        "noopener,noreferrer"
                      );
                    }
                  }}
                >
                  {/* Badge */}
                  <span
                    className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getBadgeStyle(
                      item.badgeColor
                    )}`}
                  >
                    {item.badge || "NOTICE"}
                  </span>

                  {/* Text */}
                  <span
                    className={`text-[11px] sm:text-xs font-medium tracking-tight whitespace-nowrap ${
                      hasLink
                        ? "text-white group-hover/item:text-cyan-300 group-hover/item:underline underline-offset-2"
                        : "text-white/90"
                    }`}
                  >
                    {item.text}
                  </span>

                  {/* Click indicator if link exists */}
                  {hasLink && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-400/30 px-1.5 py-0.5 rounded-md shrink-0 group-hover/item:bg-cyan-500/20">
                      <span>Click to open</span>
                      <ExternalLink size={10} className="stroke-[2.5]" />
                    </span>
                  )}

                  <span className="text-white/20 select-none px-2">•</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Action Tools: Notice Trigger & Close button */}
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 border-l border-white/10 z-10 bg-inherit">
          <button
            id="open-notice-popup-bar-btn"
            onClick={triggerNoticePopup}
            className="px-2 sm:px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white/80 hover:text-white text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            title="Open Notice & Sponsor Banner"
          >
            <Sparkles size={11} className="text-amber-400" />
            <span className="hidden sm:inline">Notice</span>
          </button>

          <button
            id="dismiss-announcement-bar-btn"
            onClick={handleDismiss}
            className="w-6 h-6 rounded-md hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="Dismiss announcement bar"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
