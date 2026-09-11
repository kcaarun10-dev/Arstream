import { Match } from "../types";

/**
 * Sport duration details in minutes based on real-world match rules:
 *
 * Football (Soccer):
 * - Regular Play: 90 minutes (Two halves of 45m)
 * - Halftime Break: 15 minutes
 * - Stoppage Time: ~3-5 minutes per half
 * - Total duration: ~105 - 120 minutes (up to 2.5h for knockout extra time)
 *
 * Cricket:
 * - T20: 3 to 3.5 hours (~210 mins) total (20 overs per side + innings break)
 * - ODI: 7 to 8 hours (~480 mins) total (50 overs per side + break)
 * - Test Match: Up to 5 days (~120 hours, ~6h scheduled play per day)
 */

export interface SportMatchInfo {
  durationMinutes: number;
  durationMs: number;
  sportType: "football" | "cricket_t20" | "cricket_odi" | "cricket_test" | "basketball" | "tennis" | "motorsport" | "other";
}

/**
 * Identifies the exact sport format and duration in milliseconds
 */
export function getSportMatchInfo(category: string, tournament?: string): SportMatchInfo {
  const cat = (category || "").toLowerCase();
  const tour = (tournament || "").toLowerCase();

  // Cricket format detection
  if (cat.includes("cricket") || tour.includes("cricket") || tour.includes("ipl") || tour.includes("bbl") || tour.includes("psl") || tour.includes("t20") || tour.includes("odi") || tour.includes("test")) {
    if (cat.includes("test") || tour.includes("test") || tour.includes("ashes") || tour.includes("ranji") || tour.includes("wtc") || tour.includes("shield")) {
      // Test match: up to 5 days (7200 minutes / 120 hours)
      const durationMinutes = 5 * 24 * 60;
      return {
        durationMinutes,
        durationMs: durationMinutes * 60 * 1000,
        sportType: "cricket_test",
      };
    }

    if (cat.includes("odi") || tour.includes("odi") || tour.includes("one day") || tour.includes("50 over") || (tour.includes("world cup") && !tour.includes("t20"))) {
      // ODI: 8 hours (480 mins) (50 overs per innings + innings interval)
      const durationMinutes = 480;
      return {
        durationMinutes,
        durationMs: durationMinutes * 60 * 1000,
        sportType: "cricket_odi",
      };
    }

    // Default Cricket / T20 (IPL, T20 World Cup, PSL, BBL, Hundred, etc.): ~3.5 hours (210 mins)
    const durationMinutes = 210;
    return {
      durationMinutes,
      durationMs: durationMinutes * 60 * 1000,
      sportType: "cricket_t20",
    };
  }

  // Football (Soccer): Default timer is 130 minutes (90m regular + 15m halftime + stoppage / extra time buffer)
  if (cat.includes("football") || cat.includes("soccer") || cat.includes("epl") || cat.includes("la liga") || cat.includes("serie a") || cat.includes("bundesliga") || cat.includes("champions league") || cat.includes("fifa")) {
    const durationMinutes = 130;
    return {
      durationMinutes,
      durationMs: durationMinutes * 60 * 1000,
      sportType: "football",
    };
  }

  // Basketball (NBA, Euroleague): ~2 to 2.5 hours (130 mins)
  if (cat.includes("basketball") || cat.includes("nba") || cat.includes("fiba") || cat.includes("euroleague")) {
    const durationMinutes = 130;
    return {
      durationMinutes,
      durationMs: durationMinutes * 60 * 1000,
      sportType: "basketball",
    };
  }

  // Tennis (ATP, WTA, Grand Slam): ~2.5 to 3.5 hours (180 mins)
  if (cat.includes("tennis") || cat.includes("atp") || cat.includes("wta") || cat.includes("wimbledon") || cat.includes("us open") || cat.includes("roland garros")) {
    const durationMinutes = 180;
    return {
      durationMinutes,
      durationMs: durationMinutes * 60 * 1000,
      sportType: "tennis",
    };
  }

  // Motorsport / F1: ~2 hours (120 mins)
  if (cat.includes("f1") || cat.includes("formula") || cat.includes("racing") || cat.includes("motorsport") || cat.includes("motogp") || cat.includes("nascar")) {
    const durationMinutes = 120;
    return {
      durationMinutes,
      durationMs: durationMinutes * 60 * 1000,
      sportType: "motorsport",
    };
  }

  // General default for other sports (Rugby, Hockey, Baseball, MMA, etc.): ~2 hours 15 mins (135 mins)
  const durationMinutes = 135;
  return {
    durationMinutes,
    durationMs: durationMinutes * 60 * 1000,
    sportType: "other",
  };
}

export const FINISHED_MATCH_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes post-match finished retention
export const UPCOMING_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours upcoming visibility window

export interface MatchLiveStatus {
  status: "live" | "upcoming" | "finished" | "ended";
  label: string;
  startMs: number;
  endMs: number;
  remainingMs: number;
  isLive: boolean;
  isUpcoming: boolean;
  isFinished: boolean;
  isEnded: boolean;
  hasCustomTimer: boolean;
  finishedAtMs?: number;
  minutesSinceEnd?: number;
  isWithinFinishedGracePeriod?: boolean; // true if ended within last 30 minutes
  isExpiredHidden?: boolean; // true if ended more than 30 minutes ago
}

/**
 * Robust category matching helper for all sports (Cricket, Football, Motorsport, Basketball, etc.)
 */
export function isCategoryMatch(
  matchCategory: string = "",
  matchTournament: string = "",
  filterCategory: string = "all"
): boolean {
  if (!filterCategory || filterCategory === "all") return true;
  const c = (matchCategory || "").toLowerCase().trim();
  const t = (matchTournament || "").toLowerCase().trim();
  const f = filterCategory.toLowerCase().trim();

  if (c === f) return true;
  if (c.includes(f) || t.includes(f)) return true;

  if (f === "cricket") {
    return (
      c.includes("cricket") ||
      c.includes("cric") ||
      t.includes("cricket") ||
      t.includes("ipl") ||
      t.includes("bbl") ||
      t.includes("psl") ||
      t.includes("t20") ||
      t.includes("odi") ||
      t.includes("test") ||
      t.includes("ashes") ||
      t.includes("cric")
    );
  }
  if (f === "football") {
    return (
      c.includes("football") ||
      c.includes("soccer") ||
      t.includes("premier league") ||
      t.includes("la liga") ||
      t.includes("champions league") ||
      t.includes("serie a") ||
      t.includes("bundesliga") ||
      t.includes("fifa") ||
      t.includes("uefa") ||
      t.includes("epl") ||
      t.includes("fa cup")
    );
  }
  if (f === "motorsport") {
    return (
      c.includes("motor") ||
      c.includes("f1") ||
      c.includes("formula") ||
      c.includes("motogp") ||
      c.includes("nascar") ||
      t.includes("f1") ||
      t.includes("formula") ||
      t.includes("grand prix")
    );
  }
  if (f === "basketball") {
    return (
      c.includes("basket") ||
      c.includes("nba") ||
      t.includes("nba") ||
      t.includes("euroleague") ||
      t.includes("fiba")
    );
  }
  if (f === "tennis") {
    return (
      c.includes("tennis") ||
      c.includes("atp") ||
      c.includes("wta") ||
      t.includes("wimbledon") ||
      t.includes("us open") ||
      t.includes("roland garros") ||
      t.includes("atp") ||
      t.includes("wta")
    );
  }
  if (f === "wrestling") {
    return (
      c.includes("wrestling") ||
      c.includes("wwe") ||
      c.includes("aew") ||
      t.includes("wwe") ||
      t.includes("raw") ||
      t.includes("smackdown") ||
      t.includes("wrestlemania")
    );
  }
  if (f === "mma") {
    return (
      c.includes("mma") ||
      c.includes("ufc") ||
      c.includes("boxing") ||
      t.includes("ufc") ||
      t.includes("boxing")
    );
  }
  if (f === "americanfootball") {
    return (
      c.includes("nfl") ||
      c.includes("american") ||
      t.includes("nfl") ||
      t.includes("super bowl")
    );
  }
  return false;
}

/**
 * Formats milliseconds into human-readable countdown string (e.g., "1h 45m", "32m 14s")
 */
export function formatRemainingTimer(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  }
  return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

/**
 * Calculates dynamic live status for sport matches respecting admin custom end timers.
 */
export function getMatchDynamicStatus(match: Match, nowMs: number = Date.now()): MatchLiveStatus {
  const startMs = new Date(match.startTime).getTime();
  const info = getSportMatchInfo(match.category, match.tournament);

  // Compute end time based on admin timer fields or default sport rules
  let endMs: number;
  let hasCustomTimer = false;

  if (match.endTime || match.autoEndAt) {
    const parsedEnd = new Date(match.endTime || match.autoEndAt).getTime();
    if (!isNaN(parsedEnd) && parsedEnd > 0) {
      endMs = parsedEnd;
      hasCustomTimer = true;
    } else {
      endMs = !isNaN(startMs) ? startMs + info.durationMs : nowMs + info.durationMs;
    }
  } else if (typeof match.autoEndMinutes === "number" && match.autoEndMinutes > 0) {
    endMs = !isNaN(startMs) ? startMs + (match.autoEndMinutes * 60 * 1000) : nowMs + (match.autoEndMinutes * 60 * 1000);
    hasCustomTimer = true;
  } else if (typeof match.durationMinutes === "number" && match.durationMinutes > 0) {
    endMs = !isNaN(startMs) ? startMs + (match.durationMinutes * 60 * 1000) : nowMs + (match.durationMinutes * 60 * 1000);
    hasCustomTimer = true;
  } else {
    endMs = !isNaN(startMs) ? startMs + info.durationMs : nowMs + info.durationMs;
  }

  const remainingMs = Math.max(0, endMs - nowMs);

  // Helper to construct finished/ended response with 30-minute retention tracking
  const createFinishedStatus = (finishTimeMs: number): MatchLiveStatus => {
    const effectiveEnd = !isNaN(finishTimeMs) && finishTimeMs > 0 ? finishTimeMs : (!isNaN(startMs) ? startMs + info.durationMs : nowMs);
    const timeSinceEnd = Math.max(0, nowMs - effectiveEnd);
    const isWithinFinishedGracePeriod = timeSinceEnd <= FINISHED_MATCH_GRACE_PERIOD_MS;
    const isExpiredHidden = timeSinceEnd > FINISHED_MATCH_GRACE_PERIOD_MS;
    const minutesSinceEnd = Math.floor(timeSinceEnd / 60000);

    return {
      status: "ended",
      label: "Ended",
      startMs,
      endMs: effectiveEnd,
      remainingMs: 0,
      isLive: false,
      isUpcoming: false,
      isFinished: true,
      isEnded: true,
      hasCustomTimer,
      finishedAtMs: effectiveEnd,
      minutesSinceEnd,
      isWithinFinishedGracePeriod,
      isExpiredHidden,
    };
  };

  // 1. Manually marked ended/finished in DB
  if (match.status === "ended" || match.status === "finished") {
    return createFinishedStatus(endMs);
  }

  // 2. Explicit Auto-End timer reached when autoEndEnabled is explicitly true
  if (match.autoEndEnabled && !isNaN(endMs) && nowMs >= endMs) {
    return createFinishedStatus(endMs);
  }

  // 3. Explicitly marked 'live' in DB -> ALWAYS LIVE! (Unless explicitly ended above)
  if (match.status === "live") {
    return {
      status: "live",
      label: "LIVE",
      startMs,
      endMs,
      remainingMs,
      isLive: true,
      isUpcoming: false,
      isFinished: false,
      isEnded: false,
      hasCustomTimer,
      isWithinFinishedGracePeriod: false,
      isExpiredHidden: false,
    };
  }

  // 4. Dynamic Time-based calculation when start time is known
  if (!isNaN(startMs)) {
    // Hasn't started yet
    if (nowMs < startMs) {
      return {
        status: "upcoming",
        label: "Upcoming",
        startMs,
        endMs,
        remainingMs,
        isLive: false,
        isUpcoming: true,
        isFinished: false,
        isEnded: false,
        hasCustomTimer,
        isWithinFinishedGracePeriod: false,
        isExpiredHidden: false,
      };
    }

    // Start time reached and within active match duration window
    if (nowMs >= startMs && nowMs < endMs) {
      return {
        status: "live",
        label: "LIVE",
        startMs,
        endMs,
        remainingMs,
        isLive: true,
        isUpcoming: false,
        isFinished: false,
        isEnded: false,
        hasCustomTimer,
        isWithinFinishedGracePeriod: false,
        isExpiredHidden: false,
      };
    }

    // Past calculated duration window -> Finished with 30m grace period
    return createFinishedStatus(endMs);
  }

  // Fallback default: Live
  return {
    status: "live",
    label: "LIVE",
    startMs: nowMs,
    endMs: nowMs + info.durationMs,
    remainingMs: info.durationMs,
    isLive: true,
    isUpcoming: false,
    isFinished: false,
    isEnded: false,
    hasCustomTimer,
    isWithinFinishedGracePeriod: false,
    isExpiredHidden: false,
  };
}

/**
 * Determines if a match is visible on the public user stream schedule:
 * 1. Live: Always visible
 * 2. Upcoming: Visible if start time is less than 24 hours away
 * 3. Finished/Ended: Kept in finished section for 30 minutes after ending, then hidden
 */
export function isMatchVisibleForUser(match: Match, nowMs: number = Date.now()): boolean {
  const dynamic = getMatchDynamicStatus(match, nowMs);

  // 1. Live matches are always visible
  if (dynamic.isLive) {
    return true;
  }

  // 2. Upcoming matches: only visible if less than 24 hours away
  if (dynamic.isUpcoming) {
    return (dynamic.startMs - nowMs) <= UPCOMING_MATCH_WINDOW_MS;
  }

  // 3. Finished/Ended matches: visible for 30 minutes after match ends, then hidden
  if (dynamic.isFinished || dynamic.isEnded) {
    return dynamic.isWithinFinishedGracePeriod ?? false;
  }

  return true;
}

/**
 * Strict Multi-Tier Match Sorting:
 * Tier 1: LIVE matches (first)
 * Tier 2: UPCOMING matches (second, chronological by start time: closest to starting first)
 * Tier 3: FINISHED matches (third, reverse chronological: most recently finished first)
 */
export function sortMatches(matches: Match[], nowMs: number = Date.now()): Match[] {
  return [...matches].sort((a, b) => {
    const statusA = getMatchDynamicStatus(a, nowMs);
    const statusB = getMatchDynamicStatus(b, nowMs);

    const getRank = (status: MatchLiveStatus) => {
      if (status.isLive) return 1;
      if (status.isUpcoming) return 2;
      return 3; // Finished
    };

    const rankA = getRank(statusA);
    const rankB = getRank(statusB);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // Within Tier 1 (LIVE):
    // Sort by start time descending (most recently started first) or by remaining time
    if (rankA === 1) {
      return statusB.startMs - statusA.startMs;
    }

    // Within Tier 2 (UPCOMING):
    // Sort chronologically ascending (match starting soonest comes FIRST)
    if (rankA === 2) {
      return statusA.startMs - statusB.startMs;
    }

    // Within Tier 3 (FINISHED):
    // Sort reverse chronologically (most recently finished match comes FIRST)
    return statusB.endMs - statusA.endMs;
  });
}
