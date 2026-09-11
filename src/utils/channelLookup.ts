import { Channel, Match, MatchChannel, StreamServer } from "../types";

export interface ChannelLookupResult {
  name: string;
  logo?: string;
  group?: string;
  userAgent?: string;
  referrer?: string;
  source: 'firestore_channels' | 'matches_db' | 'local_storage' | 'm3u_playlist' | 'url_heuristic';
  sourceLabel: string;
  matchedUrl: string;
}

export interface ChannelLookupSources {
  firestoreChannels?: Channel[];
  localChannels?: Channel[];
  matches?: Match[];
  availableChannels?: Channel[];
}

/**
 * Strips whitespace, hashes, and non-essential query tokens from stream URLs
 * to allow accurate cross-token matching.
 */
export function normalizeStreamUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  let url = rawUrl.trim();
  // Remove wrapping quotes if pasted from config
  url = url.replace(/^["']|["']$/g, '');
  return url;
}

/**
 * Returns the base path of the stream URL without dynamic tokens/auth parameters.
 */
export function getBaseStreamUrl(rawUrl: string): string {
  const normalized = normalizeStreamUrl(rawUrl);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    // Return protocol + host + pathname (without search params or hash)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.toLowerCase().replace(/\/+$/, '');
  } catch {
    // Fallback: strip query string manually
    return normalized.split('?')[0].split('#')[0].toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Removes any `sandbox` or `sandbox="..."` attributes from HTML strings or iframe tags.
 * Ensures embed stream iframes run completely unrestricted (sandbox-free) without blocking scripts, audio, or video players.
 */
export function stripSandbox(input?: string): string {
  if (!input) return "";
  return input
    .replace(/\s+sandbox(\s*=\s*(["'][^"']*["']|[^\s>]+))?/gi, "")
    .replace(/\s+sandbox(?=[\s>])/gi, "");
}

/**
 * Checks if a string contains HTML iframe tags.
 */
export function isIframeHtml(input?: string): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();
  return lower.includes('<iframe') || lower.includes('</iframe>') || (lower.includes('src=') && lower.includes('http'));
}

/**
 * Extracts the src URL from an iframe HTML string, or cleans an embed URL.
 * Handles patterns like `<iframe src="https://example.com/embed/123" ...></iframe>`
 */
export function extractIframeSrc(input?: string): string {
  if (!input) return '';
  const trimmed = stripSandbox(input).trim();
  
  // Check if string contains an iframe tag with src attribute
  const iframeSrcMatch = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i) ||
                         trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    let extracted = iframeSrcMatch[1].trim();
    if (extracted.startsWith('//')) {
      extracted = `https:${extracted}`;
    }
    return extracted;
  }

  // If input was wrapped in quotes or backticks
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

/**
 * Extracts all iframe tags and their URLs from multi-line text or uploaded HTML.
 */
export function extractAllIframes(text: string): Array<{ name: string; url: string; rawTag: string }> {
  if (!text) return [];
  const results: Array<{ name: string; url: string; rawTag: string }> = [];
  
  // Regex to match all <iframe>...</iframe> or <iframe.../>
  const iframeRegex = /<iframe[^>]*>.*?<\/iframe>|<iframe[^>]*\/?>/gis;
  const matches = text.match(iframeRegex) || [];

  matches.forEach((tag, idx) => {
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const titleMatch = tag.match(/title=["']([^"']+)["']/i) || tag.match(/name=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      let url = srcMatch[1].trim();
      if (url.startsWith('//')) url = `https:${url}`;
      
      const parsedName = titleMatch && titleMatch[1] ? titleMatch[1].trim() : `Iframe Stream ${idx + 1}`;
      const sanitizedTag = stripSandbox(tag);
      results.push({
        name: parsedName,
        url,
        rawTag: sanitizedTag
      });
    }
  });

  return results;
}

/**
 * Checks if a URL is an embedded player / iframe live broadcast link.
 */
export function isEmbedUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (isIframeHtml(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://') && !lower.startsWith('//')) return false;

  // Direct video files with HLS or MP4 extensions are native streams, not web embeds
  if (lower.includes('.m3u8') || lower.includes('.mpd') || lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.ts?')) {
    return false;
  }

  return (
    lower.includes('/embed/') ||
    lower.includes('/embed?') ||
    lower.includes('embed.') ||
    lower.includes('embedhd.') ||
    lower.includes('embedhd') ||
    lower.includes('embedindia.') ||
    lower.includes('embedstream.') ||
    lower.includes('streamed.su') ||
    lower.includes('sportshub.') ||
    lower.includes('footybite') ||
    lower.includes('crichd.') ||
    lower.includes('vidsrc.') ||
    lower.includes('sawlive.') ||
    lower.includes('streameast') ||
    lower.includes('youtube.com/embed') ||
    lower.includes('twitch.tv') ||
    lower.includes('dailymotion.com/embed') ||
    lower.includes('vimeo.com/video') ||
    lower.includes('castto') ||
    lower.includes('daddylive') ||
    lower.includes('methstreams') ||
    lower.includes('topembed') ||
    lower.includes('givemereddit') ||
    lower.includes('buffstream') ||
    lower.includes('1stream') ||
    lower.includes('sportplus') ||
    lower.includes('papahd') ||
    lower.includes('strikeout') ||
    lower.includes('player.') ||
    lower.includes('/player/') ||
    lower.includes('/player?') ||
    lower.includes('/watch/') ||
    lower.includes('/stream/') ||
    lower.includes('iframe') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm') ||
    lower.includes('.php')
  );
}

/**
 * Checks if a channel object represents an embedded live stream player.
 */
export function isChannelEmbed(channel?: { url?: string; protocol?: string; embedCode?: string } | null): boolean {
  if (!channel) return false;
  if (channel.protocol === 'EMBED') return true;
  if (channel.embedCode && isIframeHtml(channel.embedCode)) return true;
  if (channel.url && (isIframeHtml(channel.url) || isEmbedUrl(channel.url))) return true;
  return false;
}

/**
 * Prioritizes native HLS streaming channels (.m3u8, direct HLS protocol) over embedded iframe players.
 * Falls back to other direct video protocols (DASH, MP4), and lastly to EMBED/iframe players.
 */
export function findPreferredChannel(channels?: MatchChannel[]): MatchChannel | null {
  if (!channels || channels.length === 0) return null;

  // 1. Primary choice: HLS streams (.m3u8, direct HLS protocol, not embed)
  const hlsChannel = channels.find((c) => {
    if (!c) return false;
    const url = (c.url || "").trim();
    if (!url && !(c as any).embedCode) return false;
    if (isChannelEmbed(c)) return false;
    const proto = detectStreamProtocol(url, c.protocol);
    return proto === "HLS" || url.toLowerCase().includes(".m3u8");
  });
  if (hlsChannel) return hlsChannel;

  // 2. Secondary choice: Other native direct video streams (DASH, MP4) that are not embeds
  const directChannel = channels.find((c) => {
    if (!c) return false;
    const url = (c.url || "").trim();
    if (!url) return false;
    return !isChannelEmbed(c);
  });
  if (directChannel) return directChannel;

  // 3. Fallback: Embedded iframe player
  const embedChannel = channels.find((c) => isChannelEmbed(c));
  return embedChannel || channels[0];
}

/**
 * Prioritizes native HLS stream servers (.m3u8) over embedded iframe players.
 */
export function findPreferredServer(servers?: StreamServer[]): StreamServer | null {
  if (!servers || servers.length === 0) return null;

  // 1. Primary choice: HLS servers (.m3u8, direct HLS protocol)
  const hlsServer = servers.find((s) => {
    if (!s || !s.url) return false;
    if (s.protocol === "EMBED" || isEmbedUrl(s.url)) return false;
    const proto = detectStreamProtocol(s.url, s.protocol);
    return proto === "HLS" || s.url.toLowerCase().includes(".m3u8");
  });
  if (hlsServer) return hlsServer;

  // 2. Secondary choice: Non-embed direct stream
  const directServer = servers.find((s) => {
    if (!s || !s.url) return false;
    return s.protocol !== "EMBED" && !isEmbedUrl(s.url);
  });
  if (directServer) return directServer;

  // 3. Fallback: Embedded iframe player
  const embedServer = servers.find((s) => s.protocol === "EMBED" || isEmbedUrl(s.url));
  return embedServer || servers[0];
}

/**
 * Detects the playback protocol for a given URL and explicit protocol.
 */
export function detectStreamProtocol(url?: string, explicitProtocol?: string): 'HLS' | 'MP4' | 'DASH' | 'EMBED' {
  if (explicitProtocol === 'EMBED' || explicitProtocol === 'HLS' || explicitProtocol === 'MP4' || explicitProtocol === 'DASH') {
    return explicitProtocol;
  }
  if (isIframeHtml(url) || isEmbedUrl(url)) {
    return 'EMBED';
  }
  const lower = (url || '').toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('/hls/') || lower.includes('playlist')) {
    return 'HLS';
  }
  if (lower.includes('.mpd')) {
    return 'DASH';
  }
  return 'MP4';
}

/**
 * Detects if a string is a stream URL (e.g. pasted into a name input field by mistake).
 */
export function isLikelyStreamUrl(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('rtmp://') ||
    trimmed.startsWith('rtsp://') ||
    trimmed.includes('.m3u8') ||
    trimmed.includes('.mpd') ||
    trimmed.includes('/manifest') ||
    trimmed.includes('/playlist') ||
    trimmed.includes('/live/') ||
    trimmed.includes('.ts?') ||
    isEmbedUrl(trimmed)
  );
}

/**
 * Extracts a human-readable channel name from a URL slug as a fallback.
 */
export function extractChannelNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(normalizeStreamUrl(url));
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    if (pathSegments.length === 0) return null;

    // Special handling for embed links with tournament and match slugs like /embed/laliga/2026-08-22/val-cel
    if (parsed.pathname.includes('/embed/') || parsed.host.includes('embed')) {
      const meaningful = pathSegments.filter(s => 
        !['embed', 'live', 'stream', 'watch', 'player', 'iframe'].includes(s.toLowerCase()) && 
        !/^\d{4}-\d{2}-\d{2}$/.test(s) && 
        !/^\d+$/.test(s)
      );
      if (meaningful.length > 0) {
        const formatted = meaningful.map(s => 
          s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
        );
        if (formatted.length >= 2) {
          // e.g. "Val Cel (Laliga)"
          return `${formatted[formatted.length - 1]} (${formatted[0]})`;
        }
        return formatted[formatted.length - 1];
      }
    }

    // Look for segment that isn't just 'live', 'hls', 'master.m3u8', 'playlist.m3u8'
    const ignored = new Set(['live', 'hls', 'master.m3u8', 'playlist.m3u8', 'index.m3u8', 'stream.m3u8', 'mono.m3u8', 'chunklist.m3u8', 'output.m3u8', 'embed', 'player']);
    
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const seg = pathSegments[i];
      if (!ignored.has(seg.toLowerCase()) && seg.length > 2 && !/^\d{4}-\d{2}-\d{2}$/.test(seg)) {
        // Clean up formatting: e.g. "sky_sports_main_event" -> "Sky Sports Main Event"
        const clean = seg
          .replace(/\.(m3u8|mpd|ts|flv|html|php)$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .trim();
        if (clean.length > 2 && !/^\d+$/.test(clean)) {
          return clean;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Auto-detects and looks up channel information from DB, matches, and playlists by streaming URL.
 */
export function findChannelInfoByUrl(
  inputUrl: string,
  sources: ChannelLookupSources
): ChannelLookupResult | null {
  const rawUrl = normalizeStreamUrl(inputUrl);
  if (!rawUrl || rawUrl.length < 5) return null;

  const targetExact = rawUrl.toLowerCase();
  const targetBase = getBaseStreamUrl(rawUrl);

  const {
    firestoreChannels = [],
    localChannels = [],
    matches = [],
    availableChannels = []
  } = sources;

  // Helper to extract channels list from matches in DB
  const matchChannels: Array<{ name: string; url: string; userAgent?: string; referrer?: string; logo?: string; group?: string }> = [];
  matches.forEach(m => {
    if (Array.isArray(m.channels)) {
      m.channels.forEach(c => {
        if (c && c.url && c.name && c.name !== "Main Stream" && c.name !== "Server 1") {
          matchChannels.push({
            name: c.name,
            url: c.url,
            userAgent: c.userAgent,
            referrer: c.referrer,
            logo: m.tournamentLogo || m.leagueLogo || m.team1Logo,
            group: m.category || "Sports"
          });
        }
      });
    }
  });

  // TIER 1: Exact URL Matches
  // 1a. Firestore Channels DB
  for (const c of firestoreChannels) {
    if (c.url && c.url.trim().toLowerCase() === targetExact && c.name?.trim()) {
      return {
        name: c.name.trim(),
        logo: c.logo,
        group: c.group,
        userAgent: c.userAgent,
        referrer: c.referrer,
        source: 'firestore_channels',
        sourceLabel: 'Database (IPTV)',
        matchedUrl: c.url
      };
    }
  }

  // 1b. Matches in Firestore DB
  for (const c of matchChannels) {
    if (c.url && c.url.trim().toLowerCase() === targetExact && c.name?.trim()) {
      return {
        name: c.name.trim(),
        logo: c.logo,
        group: c.group,
        userAgent: c.userAgent,
        referrer: c.referrer,
        source: 'matches_db',
        sourceLabel: 'Database (Live Match)',
        matchedUrl: c.url
      };
    }
  }

  // 1c. Local Custom Channels
  for (const c of localChannels) {
    if (c.url && c.url.trim().toLowerCase() === targetExact && c.name?.trim()) {
      return {
        name: c.name.trim(),
        logo: c.logo,
        group: c.group,
        userAgent: c.userAgent,
        referrer: c.referrer,
        source: 'local_storage',
        sourceLabel: 'Local DB',
        matchedUrl: c.url
      };
    }
  }

  // 1d. Playlist Channels (M3U)
  for (const c of availableChannels) {
    if (c.url && c.url.trim().toLowerCase() === targetExact && c.name?.trim()) {
      return {
        name: c.name.trim(),
        logo: c.logo,
        group: c.group,
        userAgent: c.userAgent,
        referrer: c.referrer,
        source: 'm3u_playlist',
        sourceLabel: 'Channel Playlist',
        matchedUrl: c.url
      };
    }
  }

  // TIER 2: Base URL Matches (Ignoring dynamic token, auth query parameters, session ids)
  if (targetBase && targetBase.length > 10) {
    // 2a. Firestore Channels DB
    for (const c of firestoreChannels) {
      if (c.url && getBaseStreamUrl(c.url) === targetBase && c.name?.trim()) {
        return {
          name: c.name.trim(),
          logo: c.logo,
          group: c.group,
          userAgent: c.userAgent,
          referrer: c.referrer,
          source: 'firestore_channels',
          sourceLabel: 'Database (IPTV)',
          matchedUrl: c.url
        };
      }
    }

    // 2b. Matches in Firestore DB
    for (const c of matchChannels) {
      if (c.url && getBaseStreamUrl(c.url) === targetBase && c.name?.trim()) {
        return {
          name: c.name.trim(),
          logo: c.logo,
          group: c.group,
          userAgent: c.userAgent,
          referrer: c.referrer,
          source: 'matches_db',
          sourceLabel: 'Database (Live Match)',
          matchedUrl: c.url
        };
      }
    }

    // 2c. Local Storage Channels
    for (const c of localChannels) {
      if (c.url && getBaseStreamUrl(c.url) === targetBase && c.name?.trim()) {
        return {
          name: c.name.trim(),
          logo: c.logo,
          group: c.group,
          userAgent: c.userAgent,
          referrer: c.referrer,
          source: 'local_storage',
          sourceLabel: 'Local DB',
          matchedUrl: c.url
        };
      }
    }

    // 2d. Playlist Channels (M3U)
    for (const c of availableChannels) {
      if (c.url && getBaseStreamUrl(c.url) === targetBase && c.name?.trim()) {
        return {
          name: c.name.trim(),
          logo: c.logo,
          group: c.group,
          userAgent: c.userAgent,
          referrer: c.referrer,
          source: 'm3u_playlist',
          sourceLabel: 'Channel Playlist',
          matchedUrl: c.url
        };
      }
    }
  }

  // TIER 3: Partial substring matching for stream URLs with distinct ID paths
  if (targetBase && targetBase.length > 20) {
    const allDbList = [
      ...firestoreChannels.map(c => ({ ...c, src: 'firestore_channels' as const, lbl: 'Database (IPTV)' })),
      ...matchChannels.map(c => ({ ...c, src: 'matches_db' as const, lbl: 'Database (Live Match)' })),
      ...localChannels.map(c => ({ ...c, src: 'local_storage' as const, lbl: 'Local DB' })),
      ...availableChannels.map(c => ({ ...c, src: 'm3u_playlist' as const, lbl: 'Channel Playlist' }))
    ];

    for (const c of allDbList) {
      if (!c.url || !c.name?.trim()) continue;
      const cBase = getBaseStreamUrl(c.url);
      if (!cBase || cBase.length < 20) continue;

      if (targetBase.includes(cBase) || cBase.includes(targetBase)) {
        return {
          name: c.name.trim(),
          logo: c.logo,
          group: c.group,
          userAgent: c.userAgent,
          referrer: c.referrer,
          source: c.src,
          sourceLabel: c.lbl,
          matchedUrl: c.url
        };
      }
    }
  }

  // TIER 4: Smart URL Name Extraction fallback
  const extractedName = extractChannelNameFromUrl(rawUrl);
  if (extractedName) {
    return {
      name: extractedName,
      source: 'url_heuristic',
      sourceLabel: 'Auto Extracted',
      matchedUrl: rawUrl
    };
  }

  return null;
}

/**
 * Returns stream channels for a match.
 * STRICT POLICY: Only admin-uploaded sources are displayed; fake demo streams are disabled.
 */
export function generateSmartChannelsForMatch(_match: {
  team1?: string;
  team2?: string;
  category?: string;
  tournament?: string;
  league?: string;
}): MatchChannel[] {
  // Never inject fake/demo streams. Only admin-uploaded sources are shown.
  return [];
}

