import React, { useState, useEffect } from "react";
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Check, 
  Radio, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Zap, 
  RefreshCw,
  Bell,
  ArrowRight,
  Sliders
} from "lucide-react";
import { Announcement, SiteNoticeConfig, AnnouncementBadgeColor } from "../types";
import { 
  getCachedAnnouncements, 
  getCachedSiteNotice, 
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement, 
  saveSiteNoticeConfig, 
  triggerNoticePopup,
  DEFAULT_SITE_NOTICE 
} from "../utils/announcementManager";
import { db } from "../lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";

export function AdminAnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => getCachedAnnouncements());
  const [noticeConfig, setNoticeConfig] = useState<SiteNoticeConfig>(() => getCachedSiteNotice());

  // Announcement Form State
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState<string | null>(null);
  const [formText, setFormText] = useState("");
  const [formLinkUrl, setFormLinkUrl] = useState("");
  const [formBadge, setFormBadge] = useState("NOTICE");
  const [formBadgeColor, setFormBadgeColor] = useState<AnnouncementBadgeColor>("red");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(true);
  const [formPriority, setFormPriority] = useState(1);
  const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);

  // Notice Form State
  const [noticeEnabled, setNoticeEnabled] = useState(noticeConfig.enabled);
  const [noticeTitle, setNoticeTitle] = useState(noticeConfig.title);
  const [noticeMessage, setNoticeMessage] = useState(noticeConfig.message);
  const [bannerImageUrl, setBannerImageUrl] = useState(noticeConfig.bannerImageUrl);
  const [mainRedirectUrl, setMainRedirectUrl] = useState(noticeConfig.mainRedirectUrl);
  const [buttonText, setButtonText] = useState(noticeConfig.buttonText);
  const [adImageUrl, setAdImageUrl] = useState(noticeConfig.adImageUrl || "");
  const [adRedirectUrl, setAdRedirectUrl] = useState(noticeConfig.adRedirectUrl || "");
  const [showFrequency, setShowFrequency] = useState(noticeConfig.showFrequency || "always");
  const [autoOpenDelay, setAutoOpenDelay] = useState(noticeConfig.autoOpenDelay || 900);
  const [isSavingNotice, setIsSavingNotice] = useState(false);
  const [noticeSaveSuccess, setNoticeSaveSuccess] = useState(false);

  // Sync real-time announcements from Firestore
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const colRef = collection(db, "announcements");
      unsub = onSnapshot(colRef, {
        next: (snapshot) => {
          if (!snapshot.empty) {
            const list: Announcement[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              list.push({
                id: d.id,
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
            list.sort((a, b) => (a.priority || 0) - (b.priority || 0));
            setAnnouncements(list);
          }
        },
        error: (error) => {
          console.warn("Announcements admin listener notice:", error.message);
        }
      });
    } catch (e) {
      console.warn("Announcements admin listener notice:", e);
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Sync real-time notice config from Firestore
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const docRef = doc(db, "siteConfig", "notice");
      unsub = onSnapshot(docRef, {
        next: (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const cfg: SiteNoticeConfig = {
              id: "notice",
              enabled: data.enabled !== false,
              title: data.title || "Official Announcement",
              message: data.message || "",
              bannerImageUrl: data.bannerImageUrl || "",
              mainRedirectUrl: data.mainRedirectUrl || "",
              buttonText: data.buttonText || "Open Main Link →",
              adImageUrl: data.adImageUrl || "",
              adRedirectUrl: data.adRedirectUrl || "",
              showFrequency: data.showFrequency || "always",
              autoOpenDelay: typeof data.autoOpenDelay === "number" ? data.autoOpenDelay : 900,
              updatedAt: data.updatedAt,
            };
            setNoticeConfig(cfg);
            setNoticeEnabled(cfg.enabled);
            setNoticeTitle(cfg.title);
            setNoticeMessage(cfg.message);
            setBannerImageUrl(cfg.bannerImageUrl);
            setMainRedirectUrl(cfg.mainRedirectUrl);
            setButtonText(cfg.buttonText);
            setAdImageUrl(cfg.adImageUrl || "");
            setAdRedirectUrl(cfg.adRedirectUrl || "");
            setShowFrequency(cfg.showFrequency || "always");
            setAutoOpenDelay(cfg.autoOpenDelay || 900);
          }
        },
        error: (error) => {
          console.warn("Notice config admin listener notice:", error.message);
        }
      });
    } catch (e) {
      console.warn("Notice config admin listener notice:", e);
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Announcement Handlers
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) return;

    setIsSubmittingAnnouncement(true);
    try {
      if (isEditingAnnouncement) {
        await updateAnnouncement(isEditingAnnouncement, {
          text: formText.trim(),
          linkUrl: formLinkUrl.trim(),
          badge: formBadge.trim().toUpperCase() || "NOTICE",
          badgeColor: formBadgeColor,
          isActive: formIsActive,
          openInNewTab: formOpenInNewTab,
          priority: Number(formPriority) || 1,
        });
      } else {
        await createAnnouncement({
          text: formText.trim(),
          linkUrl: formLinkUrl.trim(),
          badge: formBadge.trim().toUpperCase() || "NOTICE",
          badgeColor: formBadgeColor,
          isActive: formIsActive,
          openInNewTab: formOpenInNewTab,
          priority: Number(formPriority) || 1,
        });
      }

      // Reset form
      setFormText("");
      setFormLinkUrl("");
      setFormBadge("NOTICE");
      setFormBadgeColor("red");
      setFormIsActive(true);
      setFormOpenInNewTab(true);
      setFormPriority(1);
      setIsEditingAnnouncement(null);
    } catch (err) {
      console.error("Failed to save announcement:", err);
    } finally {
      setIsSubmittingAnnouncement(false);
    }
  };

  const handleEditClick = (item: Announcement) => {
    setIsEditingAnnouncement(item.id);
    setFormText(item.text);
    setFormLinkUrl(item.linkUrl || "");
    setFormBadge(item.badge || "NOTICE");
    setFormBadgeColor(item.badgeColor || "red");
    setFormIsActive(item.isActive);
    setFormOpenInNewTab(item.openInNewTab !== false);
    setFormPriority(item.priority || 1);
  };

  const handleCancelEdit = () => {
    setIsEditingAnnouncement(null);
    setFormText("");
    setFormLinkUrl("");
    setFormBadge("NOTICE");
    setFormBadgeColor("red");
    setFormIsActive(true);
    setFormOpenInNewTab(true);
    setFormPriority(1);
  };

  const handleToggleActive = async (item: Announcement) => {
    await updateAnnouncement(item.id, { isActive: !item.isActive });
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (confirm("Are you sure you want to delete this announcement?")) {
      await deleteAnnouncement(id);
    }
  };

  // Notice Config Handlers
  const handleSaveNoticeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotice(true);
    try {
      const updated: SiteNoticeConfig = {
        id: "notice",
        enabled: noticeEnabled,
        title: noticeTitle.trim() || "Official Announcement",
        message: noticeMessage.trim(),
        bannerImageUrl: bannerImageUrl.trim(),
        mainRedirectUrl: mainRedirectUrl.trim(),
        buttonText: buttonText.trim() || "Open Main Link →",
        adImageUrl: adImageUrl.trim(),
        adRedirectUrl: adRedirectUrl.trim(),
        showFrequency: showFrequency as any,
        autoOpenDelay: Number(autoOpenDelay) || 900,
      };

      await saveSiteNoticeConfig(updated);
      setNoticeSaveSuccess(true);
      setTimeout(() => setNoticeSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save notice config:", err);
    } finally {
      setIsSavingNotice(false);
    }
  };

  const emojiPills = ["📢", "🔴", "⚽", "⚡", "🎁", "🔥", "🏆", "📺", "🚀"];

  return (
    <div className="space-y-8 animate-fade-in text-white">
      {/* Top Banner Overview */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-black/60 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <Megaphone size={18} />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Announcements & Notice Pop-ups
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-white/60 max-w-2xl">
              Post scrolling text tickers at the top of all pages with custom redirect links, and configure the automatic pop-up notice that displays when users open the website.
            </p>
          </div>

          <button
            id="admin-test-popup-preview-btn"
            onClick={triggerNoticePopup}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer transform hover:scale-105 active:scale-95 shrink-0"
          >
            <Sparkles size={15} />
            <span>Preview Pop-up Now</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Top Scrolling Announcement Bar */}
      <div className="p-6 rounded-3xl bg-[#090d16]/90 border border-white/10 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold text-white">
              Top Scrolling Announcement Ticker
            </h3>
            <span className="text-xs text-white/40">
              ({announcements.filter(a => a.isActive).length} active)
            </span>
          </div>

          <span className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full">
            Visible on all pages
          </span>
        </div>

        {/* Form: Add or Edit Announcement */}
        <form onSubmit={handleSaveAnnouncement} className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Plus size={14} />
              <span>{isEditingAnnouncement ? "Edit Announcement" : "Create New Announcement"}</span>
            </h4>
            {isEditingAnnouncement && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-white/50 hover:text-white flex items-center gap-1"
              >
                <X size={13} />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {/* Text Input with Emoji shortcuts */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-white/80">
                Announcement Text <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/40 mr-1">Quick Icons:</span>
                {emojiPills.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormText((prev) => `${emoji} ${prev}`)}
                    className="w-5 h-5 rounded hover:bg-white/10 text-xs flex items-center justify-center transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="e.g. ⚽ Real Madrid vs Barcelona Live HD Streaming Now! Click to watch or join channel"
              className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm text-white placeholder:text-white/30 outline-none transition-all"
            />
          </div>

          {/* Link URL & Badge Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Redirect Link */}
            <div className="lg:col-span-2">
              <label className="text-xs font-bold text-white/80 mb-1.5 flex items-center justify-between">
                <span>Redirect Link URL (Optional)</span>
                {formLinkUrl && (
                  <a
                    href={formLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Test Link</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </label>
              <div className="relative">
                <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="url"
                  value={formLinkUrl}
                  onChange={(e) => setFormLinkUrl(e.target.value)}
                  placeholder="https://t.me/your_channel or https://example.com"
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-xs text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </div>

            {/* Badge Text */}
            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 block">
                Badge Label
              </label>
              <input
                type="text"
                value={formBadge}
                onChange={(e) => setFormBadge(e.target.value)}
                placeholder="e.g. LIVE, BREAKING, HOT"
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-xs text-white uppercase placeholder:text-white/30 outline-none"
              />
            </div>

            {/* Badge Color */}
            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 block">
                Badge Color
              </label>
              <select
                value={formBadgeColor}
                onChange={(e) => setFormBadgeColor(e.target.value as AnnouncementBadgeColor)}
                className="w-full px-3 py-2 rounded-xl bg-black/80 border border-white/15 text-xs text-white outline-none cursor-pointer"
              >
                <option value="red">Red (Breaking/Alert)</option>
                <option value="amber">Amber (Warning/Hot)</option>
                <option value="emerald">Emerald (Success/Offer)</option>
                <option value="cyan">Cyan (Live/Stream)</option>
                <option value="purple">Purple (Special)</option>
                <option value="blue">Blue (Info)</option>
              </select>
            </div>
          </div>

          {/* Options & Action Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4 text-xs font-medium text-white/80">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-white/30 text-rose-500 focus:ring-0 cursor-pointer"
                />
                <span>Active (Scroll on site)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formOpenInNewTab}
                  onChange={(e) => setFormOpenInNewTab(e.target.checked)}
                  className="rounded border-white/30 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <span>Open link in new tab</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAnnouncement}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{isEditingAnnouncement ? "Update Announcement" : "Post Announcement"}</span>
            </button>
          </div>
        </form>

        {/* Existing Announcements List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
            Current Announcements ({announcements.length})
          </h4>

          {announcements.length === 0 ? (
            <div className="p-8 rounded-2xl bg-black/20 border border-white/5 text-center text-white/40 text-xs">
              No announcements created yet. Post your first announcement above.
            </div>
          ) : (
            announcements.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  item.isActive
                    ? "bg-black/40 border-white/15 hover:border-white/30"
                    : "bg-black/20 border-white/5 opacity-60"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  {/* Badge */}
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                      item.badgeColor === "red"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : item.badgeColor === "cyan"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        : item.badgeColor === "emerald"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {item.badge || "NOTICE"}
                  </span>

                  {/* Text & Link info */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-white truncate">
                      {item.text}
                    </span>
                    {item.linkUrl && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 mt-0.5 truncate"
                      >
                        <LinkIcon size={10} />
                        <span className="truncate">{item.linkUrl}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Toggle Active Switch */}
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      item.isActive
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
                    }`}
                    title={item.isActive ? "Click to deactivate" : "Click to activate"}
                  >
                    {item.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                    <span>{item.isActive ? "Active" : "Disabled"}</span>
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={() => handleEditClick(item)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-all cursor-pointer"
                    title="Edit announcement"
                  >
                    <Edit2 size={14} />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteAnnouncement(item.id)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                    title="Delete announcement"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: Web-Open Notice Pop-up & Banner Ad Settings */}
      <div className="p-6 rounded-3xl bg-[#090d16]/90 border border-white/10 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Sparkles size={16} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Web-Open Notice Pop-up & Sponsor Banner
              </h3>
              <p className="text-xs text-white/50">
                Pops up automatically like a notice when users visit your website.
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNoticeEnabled(!noticeEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                noticeEnabled
                  ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                  : "bg-white/10 text-white/50 border border-white/10"
              }`}
            >
              {noticeEnabled ? "Pop-up: ENABLED" : "Pop-up: DISABLED"}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveNoticeSettings} className="space-y-5">
          {/* Notice Title & Message */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 block">
                Notice Title / Headline <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="e.g. Official Announcement & Backup Links"
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm text-white placeholder:text-white/30 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 block">
                CTA Button Text
              </label>
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="e.g. 👉 Join Official Channel / Mirror"
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm text-white placeholder:text-white/30 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-white/80 mb-1.5 block">
              Notice Description / Message
            </label>
            <textarea
              rows={3}
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              placeholder="e.g. Welcome to AR Stream! For uninterrupted live football, cricket streams and backup domains, join our official channel..."
              className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm text-white placeholder:text-white/30 outline-none resize-y"
            />
          </div>

          {/* Main URL & Banner Image URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 flex items-center justify-between">
                <span>Main Redirect URL (Admin Destination) <span className="text-rose-400">*</span></span>
                {mainRedirectUrl && (
                  <a
                    href={mainRedirectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Test Main URL</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </label>
              <div className="relative">
                <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="url"
                  required
                  value={mainRedirectUrl}
                  onChange={(e) => setMainRedirectUrl(e.target.value)}
                  placeholder="e.g. https://t.me/your_telegram_channel or https://sponsor.com"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm text-white placeholder:text-white/30 outline-none"
                />
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                Clicking the banner or the main CTA button redirects visitors to this URL.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 block">
                Banner Image URL (Clickable Notice Banner)
              </label>
              <div className="relative">
                <ImageIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="url"
                  value={bannerImageUrl}
                  onChange={(e) => setBannerImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or https://yourdomain.com/banner.png"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm text-white placeholder:text-white/30 outline-none"
                />
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                Visual poster/banner image that fills the pop-up.
              </p>
            </div>
          </div>

          {/* Banner Live Preview */}
          {bannerImageUrl && (
            <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-2">
              <span className="text-[11px] font-bold text-white/60">Banner Image Preview:</span>
              <div className="relative w-full max-w-lg rounded-xl overflow-hidden border border-white/20 aspect-[21/9]">
                <img
                  src={bannerImageUrl}
                  alt="Banner Preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          {/* Secondary Ads Section */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Zap size={14} />
              <span>Sponsored Ad Creative (Optional)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">
                  Ad Banner Image URL
                </label>
                <input
                  type="url"
                  value={adImageUrl}
                  onChange={(e) => setAdImageUrl(e.target.value)}
                  placeholder="https://example.com/ad-square.png"
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-white/30 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">
                  Ad Destination URL
                </label>
                <input
                  type="url"
                  value={adRedirectUrl}
                  onChange={(e) => setAdRedirectUrl(e.target.value)}
                  placeholder="https://www.profitableratecpmnetwork.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Frequency and Delay */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 block">
                Display Frequency
              </label>
              <select
                value={showFrequency}
                onChange={(e) => setShowFrequency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-black/80 border border-white/15 text-xs text-white outline-none cursor-pointer"
              >
                <option value="always">Every time website opens (Recommended for promotions)</option>
                <option value="once_per_session">Once per browser tab session</option>
                <option value="once_per_day">Once per day per user</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-white/80 mb-1.5 block">
                Auto-Open Delay After Page Load
              </label>
              <select
                value={autoOpenDelay}
                onChange={(e) => setAutoOpenDelay(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-black/80 border border-white/15 text-xs text-white outline-none cursor-pointer"
              >
                <option value={400}>Immediate (400ms)</option>
                <option value={900}>Smooth Entrance (900ms)</option>
                <option value={2000}>After 2 seconds</option>
                <option value={4000}>After 4 seconds</option>
              </select>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            {noticeSaveSuccess ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-bounce">
                <Check size={16} /> Notice Settings Saved Successfully!
              </span>
            ) : (
              <span className="text-xs text-white/50">
                Changes take effect in real time for all website visitors.
              </span>
            )}

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={triggerNoticePopup}
                className="w-1/2 sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Eye size={14} />
                <span>Test Pop-up</span>
              </button>

              <button
                type="submit"
                disabled={isSavingNotice}
                className="w-1/2 sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>{isSavingNotice ? "Saving..." : "Save Notice Settings"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
