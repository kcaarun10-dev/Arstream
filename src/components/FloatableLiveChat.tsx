import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
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
  Minus,
  Maximize2,
  Minimize2,
  Move,
  Pin,
  PinOff,
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

interface FloatableLiveChatProps {
  matchId: string;
  matchTitle?: string;
  viewerCount?: number;
  isLive?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  docked?: boolean;
  onToggleDock?: () => void;
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

export const FloatableLiveChat: React.FC<FloatableLiveChatProps> = ({
  matchId,
  matchTitle = "Live Match",
  viewerCount = 1,
  isLive = true,
  isOpen = true,
  onClose,
  docked = false,
  onToggleDock,
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getUserProfile());
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Profile Modal State
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

        if (fetched.length === 0) {
          const initialMessage: LiveChatMessage = {
            id: "system_welcome",
            matchId,
            text: `Welcome to the live chat for ${matchTitle}! Chat in real-time with sports fans.`,
            username: "AR Stream Bot",
            userId: "system_bot",
            userColor: "#a855f7",
            userBadge: "🤖 Bot",
            timestamp: Date.now(),
          };
          setMessages([initialMessage]);
        } else {
          setMessages(fetched);
        }

        if (initialLoadedRef.current) {
          if (isMinimized || isScrolledUp) {
            setUnreadCount((prev) => prev + 1);
          } else {
            scrollToBottom();
          }
        } else {
          initialLoadedRef.current = true;
          scrollToBottom();
        }
      },
      error: (error) => {
        handleFirestoreError(error, OperationType.LIST, "liveChat");
      }
    });

    return () => unsub();
  }, [matchId, matchTitle, userProfile.userId, isMinimized, isScrolledUp]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
      setUnreadCount(0);
      setIsScrolledUp(false);
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    if (distanceToBottom > 80) {
      setIsScrolledUp(true);
    } else {
      setIsScrolledUp(false);
      setUnreadCount(0);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isSending || cooldown > 0) return;

    setIsSending(true);
    try {
      const chatCol = collection(db, "liveChat");
      await addDoc(chatCol, {
        matchId,
        text: textToSend.slice(0, 300),
        username: userProfile.username,
        userId: userProfile.userId,
        userColor: userProfile.avatarColor,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
      });

      if (!customText) {
        setInputText("");
      }
      setCooldown(1);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "liveChat");
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

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editNameInput.trim();
    if (trimmed.length < 2) {
      setEditNameError("Username must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 20) {
      setEditNameError("Username cannot exceed 20 characters.");
      return;
    }

    try {
      const updated = updateUsername(trimmed);
      setUserProfile(updated);
      setEditNameSuccess(true);
      setTimeout(() => {
        setShowEditNameModal(false);
        setEditNameSuccess(false);
      }, 700);
    } catch {
      setEditNameError("Failed to update username. Please try again.");
    }
  };

  const formatMessageTime = (ts: number) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return "";
    }
  };

  // If chat is explicitly closed by parent
  if (!isOpen) {
    return null;
  }

  // MINIMIZED CAPSULE STATE (Apple AI Floating Pill)
  if (isMinimized && !docked) {
    return (
      <div className="fixed bottom-20 right-4 sm:right-6 z-50">
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={() => {
            setIsMinimized(false);
            setUnreadCount(0);
          }}
          className="group apple-ai-pill rounded-full px-4 py-2.5 flex items-center gap-2.5 text-white cursor-pointer shadow-[0_12px_36px_rgba(0,0,0,0.6)]"
        >
          <div className="relative">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block animate-pulse" />
            <span className="absolute -inset-0.5 rounded-full bg-emerald-400/50 animate-ping" />
          </div>
          <MessageSquare size={16} className="text-cyan-400" />
          <span className="text-xs font-bold tracking-tight">Live Match Chat</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-black text-[10px] font-black animate-bounce">
              {unreadCount}
            </span>
          )}
          <span className="text-[11px] text-white/50 font-mono hidden xs:inline">
            • {viewerCount.toLocaleString()} {viewerCount === 1 ? "viewer" : "viewers"}
          </span>
        </motion.button>
      </div>
    );
  }

  // FULL FLOATABLE CHAT BOX
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className={`z-50 ${
          docked
            ? "w-full h-full"
            : `fixed bottom-20 right-3 sm:right-6 ${
                isExpanded
                  ? "w-[94vw] max-w-lg h-[650px]"
                  : "w-[94vw] max-w-[380px] sm:w-[390px] h-[500px]"
              }`
        }`}
      >
        <div className="w-full h-full apple-ai-card rounded-3xl flex flex-col overflow-hidden border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
          {/* Header Bar */}
          <div className="px-4 py-3 bg-white/[0.04] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF453A] animate-pulse" />
                <div className="absolute -inset-1 rounded-full bg-[#FF453A]/30 animate-ping" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate tracking-tight">
                    Live Chat
                  </h3>
                  <span className="px-2 py-0.2 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[9px] font-extrabold uppercase">
                    Apple AI Glass
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-medium">
                  <Users size={11} className="text-cyan-400" />
                  <span>{viewerCount.toLocaleString()} viewers active</span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Profile / Edit Name */}
              <button
                onClick={handleOpenEditName}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 text-[11px] font-semibold transition-all"
                title="Edit username"
              >
                <div
                  className="w-2 h-2 rounded-full ring-1 ring-cyan-400"
                  style={{ backgroundColor: userProfile.avatarColor }}
                />
                <span className="max-w-[70px] truncate">{userProfile.username}</span>
                <Edit2 size={10} className="text-cyan-400 opacity-70" />
              </button>

              {/* Sound Toggle */}
              <button
                onClick={() => setSoundEnabled((s) => !s)}
                className={`p-1.5 rounded-xl transition-all ${
                  soundEnabled
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                    : "text-white/50 hover:text-white bg-white/5"
                }`}
                title={soundEnabled ? "Mute chat sounds" : "Enable chat sounds"}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>

              {/* Dock / Undock Toggle (if on desktop) */}
              {onToggleDock && (
                <button
                  onClick={onToggleDock}
                  className="p-1.5 rounded-xl text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all hidden sm:flex"
                  title={docked ? "Float Window" : "Dock to Side"}
                >
                  {docked ? <PinOff size={13} /> : <Pin size={13} />}
                </button>
              )}

              {/* Minimize to capsule */}
              {!docked && (
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-xl text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                  title="Minimize chat"
                >
                  <Minus size={13} />
                </button>
              )}

              {/* Expand / Shrink */}
              {!docked && (
                <button
                  onClick={() => setIsExpanded((e) => !e)}
                  className="p-1.5 rounded-xl text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all hidden sm:flex"
                  title={isExpanded ? "Standard Size" : "Expand Size"}
                >
                  {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              )}

              {/* Close */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                  title="Close chat"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Messages Scroll View */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 p-3.5 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent text-sm"
          >
            {messages.map((msg) => {
              const isSystem = msg.userId === "system_bot";
              const isSelf = msg.userId === userProfile.userId;

              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="my-2 p-2.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 text-cyan-200 text-xs text-center flex items-center justify-center gap-2 shadow-inner"
                  >
                    <Sparkles size={14} className="text-cyan-400 shrink-0" />
                    <span>{msg.text}</span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 transition-opacity ${
                    isSelf ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black text-black shrink-0 shadow-md border border-white/20"
                    style={{ backgroundColor: msg.userColor || "#00f2fe" }}
                  >
                    {msg.username.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                      isSelf
                        ? "bg-cyan-600/30 border border-cyan-400/40 text-cyan-50 rounded-tr-sm"
                        : "bg-white/[0.06] border border-white/10 text-white/90 rounded-tl-sm"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px]">
                      <span
                        className="font-extrabold truncate max-w-[120px]"
                        style={{ color: isSelf ? "#67e8f9" : msg.userColor || "#38bdf8" }}
                      >
                        {isSelf ? "You" : msg.username}
                      </span>
                      {msg.userBadge && (
                        <span className="px-1.5 py-0.2 rounded bg-white/10 text-white/70 text-[9px] font-medium">
                          {msg.userBadge}
                        </span>
                      )}
                      <span className="text-white/40 ml-auto font-mono text-[9px]">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    </div>
                    <p className="break-words font-medium text-white/95 whitespace-pre-wrap selection:bg-cyan-500 selection:text-black">
                      {msg.text}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Jump to bottom pill */}
          {(isScrolledUp || unreadCount > 0) && (
            <button
              onClick={() => scrollToBottom(true)}
              className="mx-auto -mt-10 mb-2 z-10 px-3.5 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-[0_0_15px_rgba(0,242,254,0.4)] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <ChevronDown size={14} className={unreadCount > 0 ? "animate-bounce" : ""} />
              <span>
                {unreadCount > 0
                  ? `↓ ${unreadCount} new ${unreadCount === 1 ? "message" : "messages"}`
                  : "Jump to bottom"}
              </span>
            </button>
          )}

          {/* Quick Reaction Row */}
          <div className="px-3 py-1.5 bg-black/40 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSendMessage(emoji)}
                disabled={isSending || cooldown > 0}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-medium text-white/80 hover:text-white transition-all active:scale-90 shrink-0 disabled:opacity-50"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-black/60 border-t border-white/10 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Cheer for your team..."
              maxLength={300}
              className="flex-1 bg-white/[0.08] hover:bg-white/[0.12] focus:bg-white/[0.15] border border-white/15 focus:border-cyan-400/60 rounded-2xl px-3.5 py-2 text-xs text-white placeholder-white/40 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending || cooldown > 0}
              className="p-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] active:scale-95 cursor-pointer"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </motion.div>

      {/* Edit Username Modal */}
      <AnimatePresence>
        {showEditNameModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="apple-ai-card rounded-3xl p-5 w-full max-w-sm border border-white/20 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Customize Nickname</h3>
                <button
                  onClick={() => setShowEditNameModal(false)}
                  className="p-1 rounded-xl text-white/50 hover:text-white bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveUsername} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/60 mb-1.5">
                    Your Live Chat Handle
                  </label>
                  <input
                    type="text"
                    value={editNameInput}
                    onChange={(e) => {
                      setEditNameInput(e.target.value);
                      setEditNameError(null);
                    }}
                    placeholder="Enter nickname"
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    maxLength={20}
                  />
                  {editNameError && (
                    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                      <AlertCircle size={12} /> {editNameError}
                    </p>
                  )}
                  {editNameSuccess && (
                    <p className="text-emerald-400 text-xs mt-1.5 flex items-center gap-1">
                      <Check size={12} /> Nickname saved!
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rand = generateRandomUsername();
                      setEditNameInput(rand);
                    }}
                    className="px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-semibold"
                  >
                    🎲 Random
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-lg"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatableLiveChat;
