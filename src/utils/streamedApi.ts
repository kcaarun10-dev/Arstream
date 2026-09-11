import { APIMatch, Stream, Sport, Match, MatchChannel, StreamServer } from "../types";

const STREAMED_BASE_URL = "https://streamed.pk";

/**
 * Get Team Badge Image URL in WebP format from Images API
 * Endpoint: /api/images/badge/[id].webp
 */
export function getTeamBadgeUrl(badgeId?: string): string {
  if (!badgeId || badgeId.trim().length === 0) {
    return "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=200&q=80";
  }
  if (badgeId.startsWith("http://") || badgeId.startsWith("https://")) {
    return badgeId;
  }
  const cleanId = badgeId.replace(/\.webp$/i, "").replace(/^\/api\/images\/badge\//i, "");
  return `${STREAMED_BASE_URL}/api/images/badge/${cleanId}.webp`;
}

/**
 * Get Match Poster Image URL in WebP format from Images API
 * - Poster: /api/images/proxy/[poster].webp
 * - Combined Badges: /api/images/poster/[homeBadge]/[awayBadge].webp
 */
export function getMatchPosterUrl(poster?: string, homeBadge?: string, awayBadge?: string): string {
  if (poster && poster.trim().length > 0) {
    if (poster.startsWith("http://") || poster.startsWith("https://")) {
      return poster;
    }
    if (poster.startsWith("/")) {
      const cleanPath = poster.endsWith(".webp") ? poster : `${poster}.webp`;
      return `${STREAMED_BASE_URL}${cleanPath}`;
    }
    const cleanPoster = poster.replace(/\.webp$/i, "");
    return `${STREAMED_BASE_URL}/api/images/proxy/${cleanPoster}.webp`;
  }

  if (homeBadge && awayBadge) {
    const cleanHome = homeBadge.replace(/\.webp$/i, "");
    const cleanAway = awayBadge.replace(/\.webp$/i, "");
    return `${STREAMED_BASE_URL}/api/images/poster/${cleanHome}/${cleanAway}.webp`;
  }

  return "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80";
}

/**
 * Fetch All Available Sports Categories from Sports API
 * Endpoint: GET /api/sports
 */
export async function fetchSports(): Promise<Sport[]> {
  const endpoints = [
    "/api/streamed/sports",
    `${STREAMED_BASE_URL}/api/sports`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Try next endpoint fallback
    }
  }

  // Fallback sports list
  return [
    { id: "football", name: "Football" },
    { id: "basketball", name: "Basketball" },
    { id: "cricket", name: "Cricket" },
    { id: "tennis", name: "Tennis" },
    { id: "fight", name: "Fight (MMA, Boxing)" },
    { id: "motor-sports", name: "Motor Sports" },
    { id: "hockey", name: "Hockey" },
    { id: "baseball", name: "Baseball" },
    { id: "rugby", name: "Rugby" },
    { id: "american-football", name: "American Football" },
    { id: "afl", name: "AFL" },
    { id: "other", name: "Other" },
  ];
}

/**
 * Fetch Matches from Matches API
 * Available Endpoints:
 * - live: /api/matches/live or /api/matches/live/popular
 * - all-today: /api/matches/all-today or /api/matches/all-today/popular
 * - all: /api/matches/all or /api/matches/all/popular
 * - [sport]: /api/matches/[sport] or /api/matches/[sport]/popular
 */
export async function fetchMatches(options?: {
  scope?: "live" | "all-today" | "all";
  sport?: string;
  popular?: boolean;
}): Promise<APIMatch[]> {
  const { scope = "all-today", sport, popular = false } = options || {};

  let path = "";
  if (sport && sport !== "all") {
    path = popular ? `/api/matches/${sport}/popular` : `/api/matches/${sport}`;
  } else if (scope === "live") {
    path = popular ? `/api/matches/live/popular` : `/api/matches/live`;
  } else if (scope === "all") {
    path = popular ? `/api/matches/all/popular` : `/api/matches/all`;
  } else {
    path = popular ? `/api/matches/all-today/popular` : `/api/matches/all-today`;
  }

  const endpoints = [
    `/api/streamed${path.replace(/^\/api/, "")}`,
    `${STREAMED_BASE_URL}${path}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Try next
    }
  }

  return [];
}

/**
 * Fetch Streams from Source-Specific Stream Endpoints
 * Endpoint: GET /api/stream/[source]/[id]
 * Sources: alpha, bravo, charlie, delta, echo, foxtrot, golf, hotel, intel, admin, etc.
 */
export async function fetchStreamsForSource(source: string, id: string): Promise<Stream[]> {
  if (!source || !id) return [];

  const endpoints = [
    `/api/streamed/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    `${STREAMED_BASE_URL}/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Try next
    }
  }

  return [];
}

/**
 * Fetch all available streams for a match by querying all its sources in parallel
 */
export async function fetchAllStreamsForMatch(sources: { source: string; id: string }[]): Promise<Stream[]> {
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    sources.map((s) => fetchStreamsForSource(s.source, s.id))
  );

  const streams: Stream[] = [];
  const seenEmbedUrls = new Set<string>();

  results.forEach((result) => {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      result.value.forEach((stream) => {
        if (stream.embedUrl && !seenEmbedUrls.has(stream.embedUrl)) {
          seenEmbedUrls.add(stream.embedUrl);
          streams.push(stream);
        }
      });
    }
  });

  return streams;
}

/**
 * Map Streamed.pk Stream Object to application StreamServer for video player
 */
export function mapStreamToStreamServer(stream: Stream, index: number): StreamServer {
  const sourceUpper = (stream.source || "Alpha").toUpperCase();
  const qualityTag = stream.hd ? "1080P HD" : "SD";
  const lang = stream.language || "English";

  return {
    id: `streamed-${stream.source}-${stream.streamNo || index + 1}-${stream.id || index}`,
    name: `Stream #${stream.streamNo || index + 1}: ${lang} [${sourceUpper}]`,
    location: `${sourceUpper} Edge Node`,
    ping: 15 + index * 5,
    badge: qualityTag,
    url: stream.embedUrl,
    protocol: "EMBED",
  };
}

/**
 * Map Streamed.pk Stream Object to MatchChannel
 */
export function mapStreamToMatchChannel(stream: Stream, index: number): MatchChannel {
  const sourceUpper = (stream.source || "Alpha").toUpperCase();
  const lang = stream.language || "English";
  const quality = stream.hd ? "1080p HD" : "SD";

  return {
    name: `Stream #${stream.streamNo || index + 1}: ${lang} (${quality}) [${sourceUpper}]`,
    url: stream.embedUrl,
    quality: quality,
    protocol: "EMBED",
    serverLocation: `${sourceUpper} Relay`,
    embedCode: `<iframe src="${stream.embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>`,
  };
}

/**
 * Map Streamed.pk APIMatch to the application Match interface
 */
export function convertAPIMatchToMatch(apiMatch: APIMatch, existingStreams: Stream[] = []): Match {
  const homeName = apiMatch.teams?.home?.name || apiMatch.title.split(" vs ")[0] || "Home Team";
  const awayName = apiMatch.teams?.away?.name || apiMatch.title.split(" vs ")[1] || "Away Team";
  const homeBadge = getTeamBadgeUrl(apiMatch.teams?.home?.badge);
  const awayBadge = getTeamBadgeUrl(apiMatch.teams?.away?.badge);

  const startTimeIso = new Date(apiMatch.date).toISOString();
  const matchDateMs = apiMatch.date;
  const now = Date.now();
  const diffMinutes = (now - matchDateMs) / (60 * 1000);

  // Status heuristics based on timestamp & category
  let status: "live" | "upcoming" | "finished" = "upcoming";
  if (diffMinutes >= -15 && diffMinutes <= 180) {
    status = "live";
  } else if (diffMinutes > 180) {
    status = "finished";
  }

  // Pre-generate channels from streams if provided, or from sources
  const channels: MatchChannel[] = existingStreams.map((s, idx) => mapStreamToMatchChannel(s, idx));

  // If no streams loaded yet, generate placeholder channels based on sources
  if (channels.length === 0 && apiMatch.sources && apiMatch.sources.length > 0) {
    apiMatch.sources.forEach((s, idx) => {
      const srcName = s.source.charAt(0).toUpperCase() + s.source.slice(1);
      channels.push({
        name: `Source ${srcName} (Server ${idx + 1})`,
        url: "", // will be fetched dynamically via Streams API
        quality: "HD",
        protocol: "EMBED",
        serverLocation: `${srcName} Broadcast Edge`,
      });
    });
  }

  const posterUrl = getMatchPosterUrl(
    apiMatch.poster,
    apiMatch.teams?.home?.badge,
    apiMatch.teams?.away?.badge
  );

  return {
    id: `streamed-${apiMatch.id}`,
    streamedId: apiMatch.id,
    team1: homeName,
    team1Logo: homeBadge,
    team2: awayName,
    team2Logo: awayBadge,
    category: apiMatch.category || "football",
    tournament: `${(apiMatch.category || "sport").toUpperCase()} Championship`,
    startTime: startTimeIso,
    status: status,
    popular: apiMatch.popular,
    poster: posterUrl,
    sources: apiMatch.sources || [],
    channels: channels,
    description: `Watch live stream of ${apiMatch.title}. Multiple HD stream sources available with zero lag.`,
    metaDescription: `Live streaming for ${apiMatch.title} (${(apiMatch.category || "sport").toUpperCase()}). HD streams, verified sources, and real-time commentary.`,
    createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
  };
}
