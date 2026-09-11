export interface StreamServer {
  id: string;
  name: string;
  location: string;
  ping: number; // in ms
  badge?: string;
  url: string;
  protocol?: 'HLS' | 'MP4' | 'DASH' | 'EMBED';
  userAgent?: string;
  referrer?: string;
  origin?: string;
  cookie?: string;
}

export interface MatchChannel {
  name: string;
  url: string;
  userAgent?: string;
  referrer?: string;
  origin?: string;
  cookie?: string;
  quality?: string;
  ping?: number;
  serverLocation?: string;
  protocol?: 'HLS' | 'MP4' | 'DASH' | 'EMBED';
  embedCode?: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  srclang: string;
  src?: string;
}

export interface StreamQuality {
  id: string;
  label: string;
  resolution: string;
  bitrate: string;
  fps: number;
}

export interface StreamItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  description: string;
  thumbnail: string;
  backdropUrl?: string;
  isLive: boolean;
  viewCount: number;
  likesCount: number;
  qualityBadge: string; // e.g. "4K UHD" | "1080P 60FPS"
  audioCodec: string;   // e.g. "Dolby Atmos 5.1" | "Spatial Audio"
  rating: string;
  duration?: string;
  releaseYear?: string;
  tags: string[];
  servers: StreamServer[];
}

export interface MatchScore {
  home: number | string;
  away: number | string;
  text?: string;
  period?: string;
  minute?: number;
}

export interface MatchVenue {
  name?: string;
  city?: string;
  country?: string;
  capacity?: number | string;
  surface?: string;
  image?: string;
}

export interface MatchEvent {
  id?: string;
  minute: number | string;
  type: 'goal' | 'card_yellow' | 'card_red' | 'sub' | 'var' | 'wicket' | 'boundary' | 'half' | 'whistle' | 'info';
  team: 'home' | 'away' | 'system';
  player?: string;
  detail?: string;
}

export interface MatchSquadPlayer {
  name: string;
  number?: number | string;
  position?: string;
  isCaptain?: boolean;
}

export interface MatchSquad {
  formation?: string;
  coach?: string;
  startingXI: MatchSquadPlayer[];
  substitutes?: MatchSquadPlayer[];
}

export interface MatchLineups {
  home?: MatchSquad;
  away?: MatchSquad;
}

export interface MatchStats {
  possession?: { home: number; away: number };
  shots?: { home: number; away: number };
  shotsOnTarget?: { home: number; away: number };
  corners?: { home: number; away: number };
  fouls?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
  passes?: { home: number; away: number };
  passAccuracy?: { home: number; away: number };
}

export interface MatchH2H {
  date: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  winner?: string;
  tournament?: string;
}

export interface Match {
  id: string;
  slug?: string; // e.g. "barca-vs-realmadrid" or custom slug
  shortUrl?: string; // Short link representation
  team1: string;
  team1Logo: string;
  team2: string;
  team2Logo: string;
  category: string;
  startTime: any; // Firestore Timestamp or ISO string
  endTime?: any; // Firestore Timestamp or ISO string or number
  durationMinutes?: number; // Duration of live event in minutes
  autoEndMinutes?: number; // Custom auto-end timer in minutes
  autoEndAt?: any; // Explicit timestamp or ISO string when match must disappear
  autoEndEnabled?: boolean;
  status: 'upcoming' | 'live' | 'finished' | 'ended';
  channels: MatchChannel[];
  createdAt: any;
  updatedAt: any;
  viewers?: number;
  tournament?: string;
  tournamentLogo?: string;
  league?: string;
  leagueLogo?: string;
  eventName?: string;
  description?: string;
  metaDescription?: string;
  keywords?: string[];
  score?: string | MatchScore;
  scoreText?: string;
  venue?: MatchVenue | string;
  referee?: string;
  round?: string;
  season?: string | number;
  lineups?: MatchLineups;
  events?: MatchEvent[];
  stats?: MatchStats;
  h2h?: MatchH2H[];
  weather?: { temp?: string; condition?: string; humidity?: string; wind?: string };
  apiFixtureId?: number;
  apiLeagueId?: number;
  country?: string;
  sources?: { source: string; id: string }[];
  streamedId?: string;
  popular?: boolean;
  poster?: string;
}

export interface League {
  id: string;
  name: string;
  logo: string;
  category?: string;
  country?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  domain?: string;
  category?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
  protocol?: 'HLS' | 'MP4' | 'DASH' | 'EMBED';
  embedCode?: string;
  userAgent?: string;
  referrer?: string;
  origin?: string;
  cookie?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface StreamDiagnostics {
  resolution: string;
  bitrate: string;
  bufferHealth: number; // in seconds
  latency: number;      // in ms
  droppedFrames: number;
  codec: string;
  serverNode: string;
}

export interface MatchRequest {
  id: string;
  matchTitle: string;
  category: string;
  eventDate?: string;
  notes?: string;
  requesterName?: string;
  status: 'pending' | 'added' | 'dismissed';
  createdAt: any;
  updatedAt?: any;
}

export type AnnouncementBadgeColor = 'red' | 'amber' | 'emerald' | 'cyan' | 'purple' | 'blue';

export interface Announcement {
  id: string;
  text: string;
  linkUrl?: string;
  badge?: string; // e.g., "NOTICE", "BREAKING", "LIVE", "UPDATE", "OFFER"
  badgeColor?: AnnouncementBadgeColor;
  isActive: boolean;
  priority?: number;
  openInNewTab?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface SiteNoticeConfig {
  id?: string;
  enabled: boolean;
  title: string;
  message: string;
  bannerImageUrl: string;
  mainRedirectUrl: string;
  buttonText: string;
  adImageUrl?: string;
  adRedirectUrl?: string;
  showFrequency?: 'always' | 'once_per_session' | 'once_per_day';
  autoOpenDelay?: number; // ms delay before auto pop-up on page open
  updatedAt?: any;
}

// ============================================================
// Streamed.pk API Types
// ============================================================

export interface Stream {
  id: string;        // Unique identifier for the stream
  streamNo: number;  // Stream number/index
  language: string;  // Stream language (e.g., "English", "Spanish")
  hd: boolean;       // Whether the stream is in HD quality
  embedUrl: string;  // URL that can be used to embed the stream
  source: string;    // Source identifier (e.g., "alpha", "bravo", "admin")
  viewers?: number;
}

export interface APIMatch {
  id: string;               // Unique identifier for the match
  title: string;            // Match title (e.g. "Team A vs Team B")
  category: string;         // Sport category (e.g. "football", "basketball")
  date: number;             // Unix timestamp in milliseconds
  poster?: string;          // URL path to match poster image
  popular: boolean;         // Whether the match is marked as popular
  teams?: {
    home?: {
      name: string;     // Home team name
      badge: string;    // URL path to home team badge
    };
    away?: {
      name: string;     // Away team name
      badge: string;    // URL path to away team badge
    };
  };
  sources: {
    source: string;       // Stream source identifier (e.g. "alpha", "bravo")
    id: string;           // Source-specific match ID
  }[];
}

export interface Sport {
  id: string;    // Sport identifier (used in Matches API endpoints)
  name: string;  // Display name of the sport
}



