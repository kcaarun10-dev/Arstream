/**
 * Utilities for clean human-readable match slugs & team short names
 * Eliminates random gibberish links (e.g. m_183921... or abahdajijwa)
 * Transforms names: Barcelona -> barca, Real Madrid -> realmadrid, etc.
 * Supports custom admin short links like: arstream.ai.studio/match/barcelona-vs-realmadrid
 */

export const TEAM_SHORT_NAMES: Record<string, string> = {
  // Football Club Giants
  "barcelona": "barca",
  "fc barcelona": "barca",
  "barca": "barca",
  "real madrid": "rma",
  "real madrid cf": "rma",
  "realmadrid": "rma",
  "rma": "rma",
  "inter": "int",
  "inter milan": "int",
  "internazionale": "int",
  "int": "int",
  "manchester united": "man-utd",
  "manchester united fc": "man-utd",
  "man utd": "man-utd",
  "man united": "man-utd",
  "manchester city": "man-city",
  "manchester city fc": "man-city",
  "man city": "man-city",
  "liverpool": "liverpool",
  "liverpool fc": "liverpool",
  "arsenal": "arsenal",
  "arsenal fc": "arsenal",
  "chelsea": "chelsea",
  "chelsea fc": "chelsea",
  "tottenham hotspur": "spurs",
  "tottenham": "spurs",
  "spurs": "spurs",
  "bayern munich": "bayern",
  "fc bayern munchen": "bayern",
  "bayern munchen": "bayern",
  "borussia dortmund": "dortmund",
  "dortmund": "dortmund",
  "bvb": "dortmund",
  "paris saint-germain": "psg",
  "paris saint germain": "psg",
  "psg": "psg",
  "juventus": "juve",
  "juve": "juve",
  "ac milan": "milan",
  "milan": "milan",
  "atletico madrid": "atleti",
  "atletico de madrid": "atleti",
  "atleti": "atleti",
  "napoli": "napoli",
  "as roma": "roma",
  "roma": "roma",
  "ajax": "ajax",
  "benfica": "benfica",
  "sporting cp": "sporting",
  "fc porto": "porto",
  "porto": "porto",
  "newcastle united": "newcastle",
  "aston villa": "villa",
  "bayer leverkusen": "leverkusen",
  "leipzig": "rb-leipzig",
  "rb leipzig": "rb-leipzig",

  // Cricket Teams & Franchises
  "chennai super kings": "csk",
  "csk": "csk",
  "mumbai indians": "mi",
  "mi": "mi",
  "royal challengers bangalore": "rcb",
  "royal challengers bengaluru": "rcb",
  "rcb": "rcb",
  "kolkata knight riders": "kkr",
  "kkr": "kkr",
  "delhi capitals": "dc",
  "dc": "dc",
  "punjab kings": "pbks",
  "rajasthan royals": "rr",
  "sunrisers hyderabad": "srh",
  "gujarat titans": "gt",
  "lucknow super giants": "lsg",
  "india": "ind",
  "australia": "aus",
  "england": "eng",
  "pakistan": "pak",
  "south africa": "sa",
  "new zealand": "nz",
  "west indies": "wi",
  "sri lanka": "sl",
  "bangladesh": "ban",
  "afghanistan": "afg",

  // Basketball & Other
  "los angeles lakers": "lakers",
  "la lakers": "lakers",
  "golden state warriors": "warriors",
  "boston celtics": "celtics",
  "chicago bulls": "bulls",
  "miami heat": "heat",
  "brooklyn nets": "nets",
  "new york knicks": "knicks",
};

/**
 * Converts any team name into a clean, human-readable short alias
 */
export function getTeamShortName(teamName: string): string {
  if (!teamName) return "";
  const cleaned = teamName.toLowerCase().trim();

  // 1. Direct dictionary match
  if (TEAM_SHORT_NAMES[cleaned]) {
    return TEAM_SHORT_NAMES[cleaned];
  }

  // 2. Substring matching for popular clubs (e.g. "FC Barcelona 2026" -> "barca")
  for (const [key, alias] of Object.entries(TEAM_SHORT_NAMES)) {
    if (cleaned.includes(key)) {
      return alias;
    }
  }

  // 3. Normalized fallback: clean non-alphanumerics into kebab-case
  return cleaned
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Cleans user or admin input into a valid slug
 * If admin pastes "arstream.ai.studio/match/barcelona-vs-realmadrid", extracts the clean slug
 */
export function sanitizeSlug(input: string): string {
  if (!input) return "";
  let text = input.trim();

  // Strip protocol and domain if full URL was pasted
  if (text.includes("/match/")) {
    text = text.split("/match/").pop() || text;
  } else if (text.includes("/")) {
    text = text.split("/").filter(Boolean).pop() || text;
  }

  return text
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Automatically creates a clean short match slug from two team names
 * Example: ("FC Barcelona", "Real Madrid") -> "barca-vs-realmadrid"
 */
export function generateMatchSlug(team1: string, team2: string): string {
  const t1 = getTeamShortName(team1) || "team1";
  const t2 = getTeamShortName(team2) || "team2";
  return `${t1}-vs-${t2}`;
}

/**
 * Returns the resolved clean slug for any match object
 */
export function getMatchSlug(match: {
  id?: string;
  slug?: string;
  team1?: string;
  team2?: string;
}): string {
  if (match.slug && match.slug.trim()) {
    return sanitizeSlug(match.slug);
  }
  if (match.team1 && match.team2) {
    return generateMatchSlug(match.team1, match.team2);
  }
  return sanitizeSlug(match.id || "live-stream");
}

/**
 * Formats standard short display URL
 * e.g. "arstream.ai.studio/match/barcelona-vs-realmadrid"
 */
export function formatMatchShortUrl(slugOrMatch: string | { id?: string; slug?: string; team1?: string; team2?: string }): string {
  const slug = typeof slugOrMatch === "string" ? sanitizeSlug(slugOrMatch) : getMatchSlug(slugOrMatch);
  return `arstream.ai.studio/match/${slug}`;
}

/**
 * Gets the relative router path for a match
 * e.g. "/match/rma-vs-int"
 */
export function getMatchRoutePath(match: { id?: string; slug?: string; team1?: string; team2?: string }): string {
  return `/match/${getMatchSlug(match)}`;
}

/**
 * Checks if a match matches a route parameter or slug (e.g. "rma-vs-int" or doc id)
 */
export function isMatchSlugMatch(
  match: { id?: string; slug?: string; team1?: string; team2?: string },
  querySlug: string
): boolean {
  if (!querySlug) return false;
  const clean = sanitizeSlug(querySlug);
  if (match.id === querySlug || match.id === clean) return true;
  if (match.slug && (match.slug === querySlug || sanitizeSlug(match.slug) === clean)) return true;
  if (getMatchSlug(match) === clean) return true;
  if (match.team1 && match.team2) {
    if (generateMatchSlug(match.team1, match.team2) === clean) return true;
    if (generateMatchSlug(match.team2, match.team1) === clean) return true;
    const raw1 = `${sanitizeSlug(match.team1)}-vs-${sanitizeSlug(match.team2)}`;
    const raw2 = `${sanitizeSlug(match.team2)}-vs-${sanitizeSlug(match.team1)}`;
    if (raw1 === clean || raw2 === clean) return true;
    
    const t1 = getTeamShortName(match.team1);
    const t2 = getTeamShortName(match.team2);
    if (`${t1}-vs-${t2}` === clean || `${t2}-vs-${t1}` === clean) return true;
  }
  return false;
}

/**
 * Resolves the best matching match from a list of matches given an ID or slug.
 * Handles duplicate team matches by prioritizing:
 * 1. Exact document ID match
 * 2. Exact slug field match
 * 3. Forward slug match (team1-vs-team2) over reverse (team2-vs-team1)
 * 4. Active 'live' matches over stale/upcoming ones
 * 5. Matches with configured streaming channels
 * 6. Most recently updated/created match
 */
export function findBestMatchingMatch<T extends {
  id?: string;
  slug?: string;
  team1?: string;
  team2?: string;
  status?: string;
  channels?: any[];
  updatedAt?: any;
  createdAt?: any;
  startTime?: any;
}>(matches: T[], querySlug: string): T | null {
  if (!matches || matches.length === 0 || !querySlug) return null;
  const clean = sanitizeSlug(querySlug);

  // 1. Direct match by exact document id (absolute top priority)
  const exactDoc = matches.find((m) => m.id === querySlug || (m.id && sanitizeSlug(m.id) === clean));
  if (exactDoc) return exactDoc;

  // Filter all candidates that could possibly match the query slug
  const candidates = matches.filter((m) => isMatchSlugMatch(m, clean));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Score candidates to reliably disambiguate
  const scored = candidates.map((m) => {
    let score = 0;

    // Explicit custom slug defined on the match
    if (m.slug && (m.slug === querySlug || sanitizeSlug(m.slug) === clean)) {
      score += 120;
    }

    // Direct team1-vs-team2 slug (correct home vs away orientation)
    if (m.team1 && m.team2) {
      if (generateMatchSlug(m.team1, m.team2) === clean) {
        score += 80;
      }
      const rawForward = `${sanitizeSlug(m.team1)}-vs-${sanitizeSlug(m.team2)}`;
      if (rawForward === clean) {
        score += 70;
      }
      const t1 = getTeamShortName(m.team1);
      const t2 = getTeamShortName(m.team2);
      if (`${t1}-vs-${t2}` === clean) {
        score += 60;
      }
    }

    // Status preference: live broadcast takes priority over old/upcoming entries
    if (m.status === "live") {
      score += 50;
    } else if (m.status === "upcoming") {
      score += 20;
    }

    // Channel count: matches with active streaming channels configured by admin take priority
    const validChans = (m.channels || []).filter((c) => c && (c.url?.trim() || c.embedCode?.trim()));
    score += Math.min(validChans.length * 20, 60);

    // Recency preference: newer updated or start times take priority over older test entries
    const upSec = m.updatedAt?.seconds || 0;
    const crSec = m.createdAt?.seconds || 0;
    let startMs = 0;
    if (m.startTime) {
      const parsed = new Date(m.startTime).getTime();
      if (!isNaN(parsed)) startMs = parsed;
    }
    const recencyTime = Math.max(upSec * 1000, crSec * 1000, startMs);
    if (recencyTime > 0) {
      score += Math.min(recencyTime / 100000000000, 15);
    }

    return { match: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].match;
}
