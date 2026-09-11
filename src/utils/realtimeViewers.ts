import { useState, useEffect } from "react";
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Match, StreamItem } from "../types";
import { getMatchDynamicStatus } from "./sportsSchedule";

// Generates or retrieves a unique persistent client session ID for this browser tab
export function getClientId(): string {
  try {
    let id = sessionStorage.getItem("ar_stream_viewer_id");
    if (!id) {
      id = "v_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4);
      sessionStorage.setItem("ar_stream_viewer_id", id);
    }
    return id;
  } catch {
    return "v_" + Math.random().toString(36).substring(2, 10);
  }
}

// Clean string for Firestore document ID matching regex ^[a-zA-Z0-9_\-]+$
function sanitizeDocId(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 50);
}

/**
 * Format real viewer numbers cleanly (e.g., 1, 12, 1.4K, etc.)
 */
export function formatViewerCount(count: number, compact: boolean = true): string {
  if (count <= 0) return "0";
  if (!compact || count < 1000) {
    return count.toLocaleString();
  }
  if (count >= 1_000_000) {
    const val = (count / 1_000_000).toFixed(1);
    return `${val.endsWith(".0") ? val.slice(0, -2) : val}M`;
  }
  const val = (count / 1_000).toFixed(1);
  return `${val.endsWith(".0") ? val.slice(0, -2) : val}K`;
}

export const formatCompactNumber = formatViewerCount;

/**
 * Hook to manage real-time active viewer presence in Firestore
 * Tracks the actual number of connected users watching this match/stream.
 */
export function useRealtimeViewers(
  match?: Match | null,
  streamItem?: StreamItem | null,
  isActivelyWatching: boolean = true
) {
  const targetId = match?.id || streamItem?.id || (match ? `${match.team1}_${match.team2}` : streamItem?.title || "");
  const cleanTargetId = targetId ? sanitizeDocId(targetId) : "";
  const dynamicStatus = match ? getMatchDynamicStatus(match, Date.now()) : { isLive: true, isUpcoming: false, isFinished: false, isEnded: false };

  const [realViewers, setRealViewers] = useState<number>(() => isActivelyWatching ? 1 : 0);

  // 1. Heartbeat to register this user as an active viewer in Firestore
  useEffect(() => {
    if (!cleanTargetId || !isActivelyWatching) return;

    const clientId = getClientId();
    const presenceDocId = `${cleanTargetId}_${clientId}`.slice(0, 100);
    const presenceRef = doc(db, "livePresence", presenceDocId);

    const sendHeartbeat = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        await setDoc(presenceRef, {
          targetId: cleanTargetId,
          clientId: clientId,
          lastSeen: serverTimestamp(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        // Fallback silently if offline or database closing
      }
    };

    // Immediate initial heartbeat
    sendHeartbeat();

    // Heartbeat every 15 seconds while playing
    const heartbeatInterval = setInterval(sendHeartbeat, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        deleteDoc(presenceRef).catch(() => {});
      }
    };
  }, [cleanTargetId, isActivelyWatching]);

  // 2. Real-time onSnapshot subscription to count active viewers on this stream
  useEffect(() => {
    if (!cleanTargetId) {
      setRealViewers(isActivelyWatching ? 1 : 0);
      return;
    }

    try {
      const q = query(
        collection(db, "livePresence"),
        where("targetId", "==", cleanTargetId)
      );

      const unsubscribe = onSnapshot(q, {
        next: (snapshot) => {
          const now = Date.now();
          let activeCount = 0;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let isRecent = true;

            if (data.lastSeen instanceof Timestamp) {
              const lastSeenMs = data.lastSeen.toMillis();
              // Count as active if heartbeat received within last 45 seconds
              if (now - lastSeenMs > 45000) {
                isRecent = false;
              }
            } else if (typeof data.updatedAt === "string") {
              const lastSeenMs = new Date(data.updatedAt).getTime();
              if (now - lastSeenMs > 45000) {
                isRecent = false;
              }
            }

            if (isRecent) {
              activeCount++;
            }
          });

          // If the current user is watching, ensure at least 1 is shown
          const finalCount = isActivelyWatching ? Math.max(1, activeCount) : activeCount;
          setRealViewers(finalCount);
        },
        error: () => {
          // In case of any read issues, default to 1 if active
          setRealViewers(isActivelyWatching ? 1 : 0);
        }
      });

      return () => unsubscribe();
    } catch {
      setRealViewers(isActivelyWatching ? 1 : 0);
    }
  }, [cleanTargetId, isActivelyWatching]);

  return {
    viewers: realViewers,
    formatted: formatViewerCount(realViewers, true),
    formattedFull: formatViewerCount(realViewers, false),
    label: dynamicStatus.isLive ? (realViewers === 1 ? "viewer watching" : "viewers watching") : (dynamicStatus.isUpcoming ? "waiting" : "views"),
    isLive: dynamicStatus.isLive,
    isUpcoming: dynamicStatus.isUpcoming,
    isFinished: dynamicStatus.isFinished || dynamicStatus.isEnded,
    trend: "stable" as const,
  };
}

/**
 * Global hook to listen to all active match viewers in real time.
 * Returns a map of targetId -> actual live viewer count.
 */
export function useAllMatchesRealtimeViewers() {
  const [presenceMap, setPresenceMap] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const q = collection(db, "livePresence");
      const unsubscribe = onSnapshot(q, {
        next: (snapshot) => {
          const now = Date.now();
          const counts: Record<string, number> = {};

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const targetId = data.targetId;
            if (!targetId) return;

            let isRecent = true;
            if (data.lastSeen instanceof Timestamp) {
              const lastSeenMs = data.lastSeen.toMillis();
              if (now - lastSeenMs > 45000) {
                isRecent = false;
              }
            } else if (typeof data.updatedAt === "string") {
              const lastSeenMs = new Date(data.updatedAt).getTime();
              if (now - lastSeenMs > 45000) {
                isRecent = false;
              }
            }

            if (isRecent) {
              counts[targetId] = (counts[targetId] || 0) + 1;
            }
          });

          setPresenceMap(counts);
        },
        error: () => {
          setPresenceMap({});
        }
      });

      return () => unsubscribe();
    } catch {
      setPresenceMap({});
    }
  }, []);

  return presenceMap;
}
