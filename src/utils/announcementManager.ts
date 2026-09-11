import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp 
} from "firebase/firestore";
import { Announcement, SiteNoticeConfig } from "../types";

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "default-1",
    text: "🔥 Welcome to AR Stream! Ultra HD Live Sports & Worldwide IPTV Channels are Online Now. Click here to join our official community.",
    linkUrl: "https://t.me/ar_stream_live",
    badge: "HOT UPDATE",
    badgeColor: "red",
    isActive: true,
    openInNewTab: true,
    priority: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: "default-2",
    text: "⚽ Live Football, Cricket, Basketball & F1 feeds updated every 5 minutes. Request your custom match in the guide!",
    linkUrl: "https://t.me/ar_stream_live",
    badge: "LIVE NOTICE",
    badgeColor: "cyan",
    isActive: true,
    openInNewTab: true,
    priority: 2,
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_SITE_NOTICE: SiteNoticeConfig = {
  id: "notice",
  enabled: true,
  title: "Official Stream Announcement & Backup Mirrors",
  message: "Welcome to AR Stream! For uninterrupted 4K / 1080p sports streams, instant server mirrors, and daily live match schedules, join our official channel or visit our sponsor below.",
  bannerImageUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80",
  mainRedirectUrl: "https://t.me/ar_stream_live",
  buttonText: "👉 Join Official Channel / Mirror",
  adImageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",
  adRedirectUrl: "https://www.profitableratecpmnetwork.com/c7yfnvwr?key=3c565d28d928905ef6317ce8c186511a",
  showFrequency: "always",
  autoOpenDelay: 900
};

const LOCAL_ANNOUNCEMENTS_KEY = "ar_announcements_cache";
const LOCAL_NOTICE_KEY = "ar_site_notice_cache";
const SESSION_NOTICE_SHOWN_KEY = "ar_notice_shown_session";
const DAILY_NOTICE_SHOWN_KEY = "ar_notice_shown_day";

// Helpers for cached state
export function getCachedAnnouncements(): Announcement[] {
  try {
    const raw = localStorage.getItem(LOCAL_ANNOUNCEMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Error reading cached announcements", e);
  }
  return DEFAULT_ANNOUNCEMENTS;
}

export function getCachedSiteNotice(): SiteNoticeConfig {
  try {
    const raw = localStorage.getItem(LOCAL_NOTICE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.enabled === "boolean") return parsed;
    }
  } catch (e) {
    console.warn("Error reading cached site notice", e);
  }
  return DEFAULT_SITE_NOTICE;
}

// Notice Display Logic
export function shouldShowNotice(config: SiteNoticeConfig): boolean {
  if (!config.enabled) return false;
  if (!config.mainRedirectUrl && !config.bannerImageUrl) return false;

  const freq = config.showFrequency || "always";

  if (freq === "always") {
    return true;
  }

  if (freq === "once_per_session") {
    return !sessionStorage.getItem(SESSION_NOTICE_SHOWN_KEY);
  }

  if (freq === "once_per_day") {
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(DAILY_NOTICE_SHOWN_KEY);
    return lastShown !== today;
  }

  return true;
}

export function markNoticeAsShown(config: SiteNoticeConfig): void {
  try {
    sessionStorage.setItem(SESSION_NOTICE_SHOWN_KEY, "true");
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DAILY_NOTICE_SHOWN_KEY, today);
  } catch {
    // Ignore storage issues
  }
}

// Listener registry for programmatic notice pop-up
type NoticeOpenHandler = () => void;
let globalNoticeOpenHandler: NoticeOpenHandler | null = null;

export function registerNoticeOpenHandler(handler: NoticeOpenHandler): () => void {
  globalNoticeOpenHandler = handler;
  return () => {
    if (globalNoticeOpenHandler === handler) {
      globalNoticeOpenHandler = null;
    }
  };
}

export function triggerNoticePopup(): void {
  if (globalNoticeOpenHandler) {
    globalNoticeOpenHandler();
  }
}

// Admin Firestore Actions
export async function createAnnouncement(announcement: Omit<Announcement, "id">): Promise<string> {
  const path = "announcements";
  try {
    const colRef = collection(db, path);
    const docRef = await addDoc(colRef, {
      ...announcement,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update local cache
    const current = getCachedAnnouncements();
    const updated = [{ id: docRef.id, ...announcement }, ...current];
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    // Local fallback
    const fakeId = `local-${Date.now()}`;
    const current = getCachedAnnouncements();
    const updated = [{ id: fakeId, ...announcement }, ...current];
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
    return fakeId;
  }
}

export async function updateAnnouncement(id: string, data: Partial<Announcement>): Promise<void> {
  const path = `announcements/${id}`;
  try {
    const docRef = doc(db, "announcements", id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });

    // Update local cache
    const current = getCachedAnnouncements();
    const updated = current.map(item => item.id === id ? { ...item, ...data } : item);
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    // Local fallback
    const current = getCachedAnnouncements();
    const updated = current.map(item => item.id === id ? { ...item, ...data } : item);
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const path = `announcements/${id}`;
  try {
    const docRef = doc(db, "announcements", id);
    await deleteDoc(docRef);

    // Update local cache
    const current = getCachedAnnouncements();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    const current = getCachedAnnouncements();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem(LOCAL_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
  }
}

export async function saveSiteNoticeConfig(config: SiteNoticeConfig): Promise<void> {
  const path = "siteConfig/notice";
  try {
    const docRef = doc(db, "siteConfig", "notice");
    await setDoc(docRef, {
      ...config,
      updatedAt: serverTimestamp()
    }, { merge: true });

    localStorage.setItem(LOCAL_NOTICE_KEY, JSON.stringify(config));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    localStorage.setItem(LOCAL_NOTICE_KEY, JSON.stringify(config));
  }
}
