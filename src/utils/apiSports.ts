import { Match, Channel } from "../types";
import { MAIN_NATIONS_LEAGUES, isImportantLeague, getLeagueDetailsById } from "../data/importantLeagues";

export interface ApiSportsAccountStatus {
  account?: {
    firstname: string;
    lastname: string;
    email: string;
  };
  subscription?: {
    plan: string;
    end: string;
    active: boolean;
  };
  requests?: {
    current: number;
    limit_day: number;
  };
  keyValid: boolean;
  error?: string;
}

export interface ApiSportsFixtureItem {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score?: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export const DEFAULT_APISPORTS_KEY = "88fba276f1c1c73d68b6fb953f729c34";

/**
 * Determines whether an API-Sports status is live, upcoming, or ended
 */
export function mapApiSportsStatus(shortStatus: string): "live" | "upcoming" | "ended" {
  const s = (shortStatus || "").toUpperCase();
  // Live states: 1H, 2H, HT (Half time), ET (Extra time), P (Penalty), BT (Break time), LIVE, INT (Interrupted)
  if (["1H", "2H", "HT", "ET", "P", "BT", "LIVE", "INT"].includes(s)) {
    return "live";
  }
  // Ended states: FT (Full Time), AET (After Extra Time), PEN (After Penalty), AWD (Awarded), WO (Walkover), CANC (Cancelled), ABD (Abandoned)
  if (["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "POST"].includes(s)) {
    return "ended";
  }
  // Default to upcoming: NS (Not Started), TBD (Time to be defined)
  return "upcoming";
}

/**
 * Intelligent IPTV channel pairing based on league, nation, and team names
 */
export function autoPairChannels(
  leagueName: string,
  country: string,
  category: string,
  availableChannels: Channel[]
): { name: string; url: string; userAgent?: string; referrer?: string }[] {
  const lLower = leagueName.toLowerCase();
  const cLower = country.toLowerCase();

  const matched: { name: string; url: string; userAgent?: string; referrer?: string }[] = [];

  // Match channels whose group or name matches the sport or league
  for (const ch of availableChannels) {
    if (!ch.url) continue;
    const chName = ch.name.toLowerCase();
    const chGroup = (ch.group || "").toLowerCase();

    // Direct league match (e.g. "Sky Sports Premier League", "La Liga TV", "BeIN Sports", "TNT Sports", "DAZN")
    if (
      (lLower.includes("premier league") && (chName.includes("premier") || chName.includes("sky sports") || chName.includes("tnt sports"))) ||
      (lLower.includes("la liga") && (chName.includes("laliga") || chName.includes("dazn") || chName.includes("movistar") || chName.includes("espn"))) ||
      (lLower.includes("serie a") && (chName.includes("serie a") || chName.includes("sky sport") || chName.includes("dazn") || chName.includes("tnt"))) ||
      (lLower.includes("champions league") && (chName.includes("champions") || chName.includes("tnt") || chName.includes("cbs") || chName.includes("bein"))) ||
      (lLower.includes("bundesliga") && (chName.includes("bundesliga") || chName.includes("sky") || chName.includes("espn"))) ||
      (cLower.includes("spain") && (chName.includes("spain") || chName.includes("laliga") || chName.includes("movistar"))) ||
      (chGroup.includes("football") || chGroup.includes("sports"))
    ) {
      if (!matched.some(m => m.url === ch.url)) {
        matched.push({
          name: ch.name,
          url: ch.url,
          userAgent: ch.userAgent || "",
          referrer: ch.referrer || ""
        });
      }
    }

    if (matched.length >= 4) break;
  }

  return matched;
}

/**
 * Utility to strip undefined fields from objects before sending to Firestore
 */
export function cleanFirestorePayload<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = cleanFirestorePayload(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => (item !== null && typeof item === "object") ? cleanFirestorePayload(item) : item);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Converts raw API-Sports fixture item into application Match schema
 */
export function convertApiSportsFixtureToMatch(
  item: ApiSportsFixtureItem,
  availableChannels: Channel[] = []
): Partial<Match> & {
  apiFixtureId: number;
  apiLeagueId: number;
  country: string;
  round: string;
  scoreText?: string;
} {
  const status = mapApiSportsStatus(item.fixture.status.short);
  const homeScore = item.goals.home;
  const awayScore = item.goals.away;
  const scoreText = (homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined) 
    ? `${homeScore} - ${awayScore}` 
    : "";

  const durationMinutes = 130;
  const startMs = new Date(item.fixture.date).getTime();
  const calculatedAutoEndAt = new Date(startMs + durationMinutes * 60 * 1000).toISOString();

  // Channels are left empty so that the admin can assign them manually
  const pairedChannels: any[] = [];

  const payload: Record<string, any> = {
    team1: item.teams.home.name || "Home Team",
    team1Logo: item.teams.home.logo || "",
    team2: item.teams.away.name || "Away Team",
    team2Logo: item.teams.away.logo || "",
    category: "football",
    league: item.league.name || "",
    leagueLogo: item.league.logo || "",
    tournament: item.league.name || "",
    tournamentLogo: item.league.logo || "",
    eventName: item.league.round || `Matchday`,
    status,
    startTime: new Date(item.fixture.date).toISOString(),
    durationMinutes,
    autoEndMinutes: durationMinutes,
    autoEndAt: calculatedAutoEndAt,
    autoEndEnabled: true,
    channels: pairedChannels,
    apiFixtureId: item.fixture.id,
    apiLeagueId: item.league.id,
    country: item.league.country || "",
    round: item.league.round || "",
    scoreText: scoreText || ""
  };

  return cleanFirestorePayload(payload) as any;
}

