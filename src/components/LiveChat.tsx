import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  getUserProfile,
  updateUsername,
  UserProfile,
  generateRandomUsername,
} from "../utils/userProfile";
import {
  Send,
  Smile,
  Edit2,
  Users,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Volume2,
  VolumeX,
  Check,
  Flame,
  AlertCircle,
  X,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface LiveChatMessage {
  id: string;
  matchId: string;
  text: string;
  username: string;
  userId: string;
  userColor?: string;
  userBadge?: string;
  timestamp: number;
  createdAt?: string;
  isSelf?: boolean;
}

interface LiveChatProps {
  matchId: string;
  matchTitle?: string;
  viewerCount?: number;
  isLive?: boolean;
  className?: string;
  onClose?: () => void;
}

const QUICK_REACTIONS = [
  "🔥",
  "⚽",
  "🏏",
  "🎯",
  "👏",
  "🚀",
  "😱",
  "❤️",
  "🎉",
  "GOAL! 🔥",
  "SIX! 🏏",
  "WHAT A SAVE! 🧤",
];

export const LiveChat: React.FC<LiveChatProps> = ({
  matchId,
  matchTitle = "Live Match",
  viewerCount = 1,
  isLive = true,
  className = "",
  onClose,
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getUserProfile());
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Edit Username Modal
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editNameInput, setEditNameInput] = useState("");
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [editNameSuccess, setEditNameSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const initialLoadedRef = useRef<boolean>(false);

  // Sync profile if updated elsewhere
  useEffect(() => {
    const handleProfileUpdate = (e: CustomEvent<UserProfile>) => {
      if (e.detail) setUserProfile(e.detail);
    };

    window.addEventListener("live_user_profile_updated", handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener("live_user_profile_updated", handleProfileUpdate as EventListener);
    };
  }, []);

  // Subscribe to real-time chat messages for this matchId
  useEffect(() => {
    if (!matchId) return;

    const chatCol = collection(db, "liveChat");
    // Query by matchId without orderBy to avoid Firestore composite index requirement
    const q = query(
      chatCol,
      where("matchId", "==", matchId),
      limit(150)
    );

    const unsub = onSnapshot(q, {
      next: (snapshot) => {
        const fetched: LiveChatMessage[] = snapshot.docs
          .map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
            const data = docSnap.data();
            const ts = typeof data.timestamp === "number" 
              ? data.timestamp 
              : (data.createdAt ? new Date(data.createdAt).getTime() : Date.now());

            return {
              id: docSnap.id,
              matchId: data.matchId || matchId,
              text: data.text || "",
              username: data.username || "Viewer",
              userId: data.userId || "",
              userColor: data.userColor || "#00f2fe",
              userBadge: data.userBadge || "🔥 Fan",
              timestamp: ts,
              createdAt: data.createdAt,
              isSelf: data.userId === userProfile.userId,
            };
          })
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // If no messages yet in database, provide a welcome cheer message
        if (fetched.length === 0) {
          const initialMessage: LiveChatMessage = {
            id: "system_welcome",
            matchId,
            text: `Welcome to the live chat for ${matchTitle}! Say hi and cheer for your team.`,
            username: "AR Stream Bot",
            userId: "system_bot",
            userColor: "#00f2fe",
            userBadge: "🤖 Bot",
            timestamp: Date.now() - 10000,
            isSelf: false,
          };
          setMessages([initialMessage]);
        } else {
          setMessages((prevMessages) => {
            // Count new incoming messages if already loaded
            if (initialLoadedRef.current && fetched.length > prevMessages.length) {
              const diff = fetched.length - prevMessages.length;
              setUnreadCount((c) => c + diff);
            }
            return fetched;
          });
        }

        // On first initial load only, position at bottom smoothly
        if (!initialLoadedRef.current) {
          initialLoadedRef.current = true;
          setTimeout(() => {
            scrollToBottom(false);
          }, 100);
        }
      },
      error: (error) => {
        console.warn("Live chat snapshot note:", error);
      }
    });

    return () => unsub();
  }, [matchId, matchTitle, userProfile.userId]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
      setIsScrolledUp(false);
      setUnreadCount(0);
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    if (distanceToBottom > 80) {
      setIsScrolledUp(true);
    } else {
      setIsScrolledUp(false);
      setUnreadCount(0);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend ?? inputText).trim();
    if (!rawText || isSending || cooldown > 0) return;

    if (rawText.length > 500) {
      alert("Message is too long (maximum 500 characters)");
      return;
    }

    setIsSending(true);
    const now = Date.now();

    const payload = {
      matchId: String(matchId),
      text: rawText,
      username: userProfile.username || "Viewer",
      userId: userProfile.userId,
      userColor: userProfile.avatarColor || "#00f2fe",
      userBadge: userProfile.badge || "🔥 Fan",
      timestamp: now,
      createdAt: new Date(now).toISOString(),
    };

    // Optimistically show message immediately
    const tempId = `temp_${now}_${Math.random()}`;
    const optimisticMsg: LiveChatMessage = {
      ...payload,
      id: tempId,
      isSelf: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setCooldown(1); // 1-second anti-spam delay

    try {
      // Save directly to Firestore liveChat collection
      await addDoc(collection(db, "liveChat"), payload);
      scrollToBottom();
    } catch (error) {
      console.error("Failed to send live chat message to Firestore:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenEditName = () => {
    setEditNameInput(userProfile.username);
    setEditNameError(null);
    setEditNameSuccess(false);
    setShowEditNameModal(true);
  };

  const handleSaveUsername = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const res = updateUsername(editNameInput);
    if (!res.success) {
      setEditNameError(res.error || "Invalid username");
      return;
    }

    if (res.profile) {
      setUserProfile(res.profile);
    }
    setEditNameSuccess(true);
    setTimeout(() => {
      setShowEditNameModal(false);
      setEditNameSuccess(false);
    }, 600);
  };

  const handleGenerateRandomName = () => {
    const fresh = generateRandomUsername();
    setEditNameInput(fresh);
    setEditNameError(null);
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      id="live-chat-panel"
      className={`flex flex-col bg-[#0b0e14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl ${className}`}
    >
      {/* Chat Header */}
      <div className="px-4 py-3 bg-[#0f141f] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black tracking-wider uppercase shadow-[0_0_10px_rgba(239,68,68,0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            LIVE CHAT
          </div>

          <div className="flex items-center gap-1 text-xs text-white/60 font-mono">
            <Users size={13} className="text-cyan-400" />
            <span>{viewerCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* User profile / Edit Name pill */}
          <button
            onClick={handleOpenEditName}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 transition-all text-xs font-bold"
            title="Edit your display username"
          >
            <div
              className="w-2.5 h-2.5 rounded-full ring-1 ring-cyan-400"
              style={{ backgroundColor: userProfile.avatarColor }}
            />
            <span className="max-w-[90px] sm:max-w-[110px] truncate">{userProfile.username}</span>
            <Edit2 size={11} className="text-cyan-400 opacity-70" />
          </button>

          {onClose && (
            <button
              id="live-chat-hide-header-btn"
              onClick={onClose}
              className="flex items-center gap-1 px-2 py-1 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold transition-all active:scale-95"
              title="Hide live chat"
              aria-label="Hide live chat"
            >
              <X size={14} />
              <span className="hidden xs:inline">Hide</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Container */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-3.5 overflow-y-auto space-y-2.5 min-h-[220px] max-h-[420px] sm:max-h-[500px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent text-sm"
      >
        {messages.map((msg) => {
          const isSystem = msg.userId === "system_bot";
          const isSelf = msg.userId === userProfile.userId;

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="my-2 p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-200 text-xs text-center flex items-center justify-center gap-2 shadow-inner"
              >
                <Sparkles size={14} className="text-cyan-400 shrink-0" />
                <span>{msg.text}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 group transition-opacity ${
                isSelf ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar Icon / Initial */}
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black text-black shrink-0 shadow-md border border-white/20"
                style={{ backgroundColor: msg.userColor || "#00f2fe" }}
              >
                {msg.username.slice(0, 2).toUpperCase()}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  isSelf
                    ? "bg-cyan-600/30 border border-cyan-400/40 text-cyan-50 rounded-tr-sm"
                    : "bg-white/[0.06] border border-white/10 text-white/90 rounded-tl-sm"
                }`}
              >
                {/* Header: Sender Name & Badge & Time */}
                <div className="flex items-center gap-1.5 mb-1 text-[10px]">
                  <span
                    className="font-extrabold truncate max-w-[120px]"
                    style={{ color: isSelf ? "#67e8f9" : (msg.userColor || "#38bdf8") }}
                  >
                    {isSelf ? "You" : msg.username}
                  </span>

                  {msg.userBadge && (
                    <span className="px-1.5 py-0.2 rounded bg-white/10 text-white/70 text-[9px] font-medium scale-90">
                      {msg.userBadge}
                    </span>
                  )}

                  <span className="text-white/40 ml-auto font-mono text-[9px]">
                    {formatMessageTime(msg.timestamp)}
                  </span>
                </div>

                {/* Message Body */}
                <p className="break-words font-medium text-white/95 whitespace-pre-wrap selection:bg-cyan-500 selection:text-black">
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll to Bottom pill */}
      {(isScrolledUp || unreadCount > 0) && (
        <button
          onClick={() => scrollToBottom(true)}
          className="mx-auto -mt-10 mb-2 z-10 px-3.5 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-[0_0_15px_rgba(0,242,254,0.4)] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <ChevronDown size={14} className={unreadCount > 0 ? "animate-bounce" : ""} />
          <span>{unreadCount > 0 ? `↓ ${unreadCount} new ${unreadCount === 1 ? "message" : "messages"}` : "Jump to bottom"}</span>
        </button>
      )}

      {/* Quick Reaction Emoji Row */}
      <div className="px-3 py-1.5 bg-[#090c12] border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleSendMessage(emoji)}
            disabled={isSending || cooldown > 0}
            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-xs font-medium text-white/80 hover:text-white transition-all active:scale-90 shrink-0 disabled:opacity-50"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-[#0d111a] border-t border-white/10 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={cooldown > 0 ? `Please wait ${cooldown}s...` : `Chat as ${userProfile.username}...`}
            maxLength={300}
            disabled={isSending || cooldown > 0}
            className="w-full bg-black/40 border border-white/15 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none transition-colors"
          />
          {inputText.length > 200 && (
            <span className="absolute right-3 top-2.5 text-[10px] text-white/40 font-mono">
              {300 - inputText.length}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isSending || cooldown > 0}
          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] active:scale-95 shrink-0"
        >
          <Send size={14} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>

      {/* Change / Keep Username Modal */}
      <AnimatePresence>
        {showEditNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#0d121d] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowEditNameModal(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white p-1"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-black font-black text-xs"
                  style={{ backgroundColor: userProfile.avatarColor }}
                >
                  {userProfile.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Your Chat Username</h3>
                  <p className="text-[11px] text-white/50">Saved permanently in your browser data</p>
                </div>
              </div>

              <form onSubmit={handleSaveUsername} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-300 mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editNameInput}
                      onChange={(e) => {
                        setEditNameInput(e.target.value);
                        setEditNameError(null);
                      }}
                      maxLength={25}
                      className="w-full bg-black/60 border border-white/20 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      placeholder="e.g. Striker_99"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleGenerateRandomName}
                      className="absolute right-2 top-2 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-cyan-300 font-bold flex items-center gap-1 transition-colors"
                      title="Roll a new random sports username"
                    >
                      <RotateCcw size={11} />
                      <span>Randomize</span>
                    </button>
                  </div>

                  {editNameError && (
                    <div className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5">
                      <AlertCircle size={12} />
                      <span>{editNameError}</span>
                    </div>
                  )}

                  {editNameSuccess && (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs mt-1.5">
                      <Check size={12} />
                      <span>Username saved successfully!</span>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/60">
                  💡 You can change your name anytime or keep your unique generated identity across all live matches!
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditNameModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)]"
                  >
                    Save & Keep Name
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
