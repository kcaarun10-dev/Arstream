import React, { useState } from "react";
import { X, Send, Sparkles, Trophy, Calendar, MessageSquare, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { motion, AnimatePresence } from "motion/react";

interface RequestMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: "football", label: "Football" },
  { id: "cricket", label: "Cricket" },
  { id: "basketball", label: "Basketball" },
  { id: "tennis", label: "Tennis" },
  { id: "f1", label: "Formula 1" },
  { id: "ufc", label: "UFC / Boxing" },
  { id: "other", label: "Other Sports" },
];

export function RequestMatchModal({ isOpen, onClose }: RequestMatchModalProps) {
  const [matchTitle, setMatchTitle] = useState("");
  const [category, setCategory] = useState("football");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = matchTitle.trim();
    if (!cleanTitle) {
      setErrorMessage("Please enter the match or event name.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const docPayload: Record<string, any> = {
        matchTitle: cleanTitle.slice(0, 200),
        category: (category.trim().toLowerCase() || "football").slice(0, 50),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (eventDate.trim()) {
        docPayload.eventDate = eventDate.trim().slice(0, 100);
      }
      if (notes.trim()) {
        docPayload.notes = notes.trim().slice(0, 1000);
      }
      if (requesterName.trim()) {
        docPayload.requesterName = requesterName.trim().slice(0, 100);
      }

      await addDoc(collection(db, "matchRequests"), docPayload);

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setMatchTitle("");
        setEventDate("");
        setNotes("");
        setRequesterName("");
        onClose();
      }, 2200);
    } catch (err: any) {
      console.error("Failed to submit match request:", err);
      let userFriendlyMsg = "Failed to submit request. Please check your connection.";
      if (err?.message?.includes("permission") || err?.code === "permission-denied") {
        userFriendlyMsg = "Permission error when submitting request. Please try again.";
      }
      setErrorMessage(userFriendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg liquid-glass rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative overflow-hidden"
      >
        {/* Close Button */}
        <button
          id="close-request-modal-btn"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
        >
          <X size={18} />
        </button>

        {isSubmitted ? (
          <div className="py-12 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Match Request Submitted!</h3>
              <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
                Thank you! Our administrators review requests and add live streaming links rapidly.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-2xl bg-white/[0.08] border border-white/15 text-white">
                  <Sparkles size={16} />
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Request a Match
                </h2>
              </div>
              <p className="text-xs text-white/50 mt-1.5">
                Can&apos;t find your team or fixture? Request it below and our team will add the broadcast channels.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-2xl text-red-200 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Match Title Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/70 flex items-center gap-1.5">
                <Trophy size={13} className="text-white/60" />
                <span>Match / Event Name *</span>
              </label>
              <input
                id="request-match-title-input"
                type="text"
                required
                value={matchTitle}
                onChange={(e) => setMatchTitle(e.target.value)}
                placeholder="e.g. Arsenal vs Chelsea, Lakers vs Warriors, F1 Monza GP"
                className="w-full bg-white/[0.06] border border-white/10 focus:border-white/30 rounded-2xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

            {/* Sport Category Pills */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/70">
                Sport Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-white text-black font-semibold shadow-sm"
                          : "bg-white/[0.06] text-white/70 hover:text-white border border-white/10"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date / Time */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/70 flex items-center gap-1.5">
                <Calendar size={13} className="text-white/60" />
                <span>Approximate Date & Kick-off Time</span>
              </label>
              <input
                id="request-match-date-input"
                type="text"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                placeholder="e.g. Today at 20:00 GMT, Tomorrow evening, 22 Aug"
                className="w-full bg-white/[0.06] border border-white/10 focus:border-white/30 rounded-2xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

            {/* Notes / Stream Link / Details */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/70 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-white/60" />
                <span>Additional Notes or Stream Link (Optional)</span>
              </label>
              <textarea
                id="request-match-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special broadcast channel, commentary language, or suggested link..."
                className="w-full bg-white/[0.06] border border-white/10 focus:border-white/30 rounded-2xl px-3.5 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all resize-none"
              />
            </div>

            {/* Optional Nickname */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/70">
                Your Nickname (Optional)
              </label>
              <input
                id="request-match-requester-input"
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="e.g. FootballFan99"
                className="w-full bg-white/[0.06] border border-white/10 focus:border-white/30 rounded-2xl px-3.5 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="submit-match-request-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-full apple-btn-primary text-black font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send Match Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
