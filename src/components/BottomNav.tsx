import React from "react";
import { Radio, Tv, Star, MessageSquarePlus } from "lucide-react";
import { motion } from "motion/react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  liveCount?: number;
  savedCount?: number;
  onRequestMatchClick?: () => void;
}

export function BottomNav({ 
  activeTab, 
  onTabChange, 
  liveCount = 0, 
  savedCount = 0,
  onRequestMatchClick 
}: BottomNavProps) {
  const tabs = [
    { id: "sports", label: "Live Sports", icon: Radio, count: liveCount, isLive: true },
    { id: "iptv", label: "IPTV Guide", icon: Tv, count: undefined, isLive: false },
    { id: "watchlist", label: "Watchlist", icon: Star, count: savedCount, isLive: false },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 px-3 sm:px-4 pointer-events-none flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))]">
      <nav 
        id="bottom-navigation-bar"
        className="pointer-events-auto h-15 sm:h-16 max-w-md w-full apple-glass rounded-full flex items-center justify-around px-2 sm:px-3 shadow-[0_12px_36px_rgba(0,0,0,0.65)] border border-white/15 touch-manipulation backdrop-blur-2xl"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          const handleTabPress = () => {
            if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
              (navigator as any).vibrate(15);
            }
            onTabChange(tab.id);
          };

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={handleTabPress}
              className="relative flex flex-col items-center justify-center gap-1 group py-1.5 flex-1 min-h-[48px] touch-manipulation select-none active:scale-95 transition-transform"
            >
              {isActive && (
                <motion.div 
                  layoutId="activeNavPill"
                  className="absolute inset-y-1 inset-x-1.5 sm:inset-x-2 bg-white/[0.12] rounded-full border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}

              <div className="relative z-10">
                <div className={`transition-all duration-200 ${
                  isActive ? "text-[#0A84FF] scale-105" : "text-white/45 group-hover:text-white"
                }`}>
                  <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                </div>

                {/* Badge Count */}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold shadow-sm ${
                    tab.isLive ? "bg-[#FF453A] text-white animate-pulse" : "bg-[#FF9F0A] text-black"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </div>

              <span className={`relative z-10 text-[10px] font-semibold tracking-tight transition-colors ${
                isActive ? "text-white" : "text-white/45 group-hover:text-white/70"
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Quick Request Match button in bottom nav */}
        {onRequestMatchClick && (
          <button
            onClick={() => {
              if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
                (navigator as any).vibrate(15);
              }
              onRequestMatchClick();
            }}
            className="flex flex-col items-center justify-center gap-1 group py-1.5 flex-1 min-h-[48px] touch-manipulation select-none text-white/45 hover:text-white active:scale-95 transition-all"
          >
            <MessageSquarePlus size={19} strokeWidth={1.8} />
            <span className="text-[10px] font-semibold tracking-tight">
              Request
            </span>
          </button>
        )}
      </nav>
    </div>
  );
}
