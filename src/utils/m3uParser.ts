import { Channel } from "../types";

const m3uCache = new Map<string, Channel[]>();

export function parseM3U(content: string): Channel[] {
  if (!content) return [];
  
  const cached = m3uCache.get(content);
  if (cached) return cached;

  const channels: Channel[] = [];
  const seenIds = new Set<string>();
  const lines = content.split(/\r?\n/);
  
  let currentInfo: Partial<Channel> = {};
  let currentReferrer: string | undefined = undefined;
  let currentUserAgent: string | undefined = undefined;
  let currentOrigin: string | undefined = undefined;
  let currentCookie: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      // Parse metadata from #EXTINF
      const nameMatch = line.match(/,(.*)$/);
      const name = nameMatch ? nameMatch[1].trim() : "Unknown Channel";

      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const idMatch = line.match(/tvg-id="([^"]*)"/i);
      const referrerMatch = line.match(/http-referr?er="([^"]*)"/i) || line.match(/referr?er="([^"]*)"/i);
      const userAgentMatch = line.match(/http-user-agent="([^"]*)"/i) || line.match(/user-agent="([^"]*)"/i);
      const originMatch = line.match(/http-origin="([^"]*)"/i) || line.match(/origin="([^"]*)"/i);
      const cookieMatch = line.match(/http-cookie="([^"]*)"/i) || line.match(/cookie="([^"]*)"/i);

      currentInfo = {
        id: idMatch ? idMatch[1] : `channel-${channels.length}`,
        name: name,
        logo: logoMatch ? logoMatch[1] : "",
        group: groupMatch ? groupMatch[1] : "General",
        referrer: referrerMatch ? referrerMatch[1] : currentReferrer,
        userAgent: userAgentMatch ? userAgentMatch[1] : currentUserAgent,
        origin: originMatch ? originMatch[1] : currentOrigin,
        cookie: cookieMatch ? cookieMatch[1] : currentCookie,
      };
    } else if (line.startsWith("#EXTVLCOPT:")) {
      // #EXTVLCOPT:http-user-agent=... / #EXTVLCOPT:http-referrer=...
      const opt = line.substring(11).trim();
      const uaMatch = opt.match(/^http-user-agent=(.*)$/i);
      if (uaMatch) {
        currentUserAgent = uaMatch[1].trim().replace(/^["']|["']$/g, '');
        if (currentInfo) currentInfo.userAgent = currentUserAgent;
      }
      const refMatch = opt.match(/^http-referr?er=(.*)$/i);
      if (refMatch) {
        currentReferrer = refMatch[1].trim().replace(/^["']|["']$/g, '');
        if (currentInfo) currentInfo.referrer = currentReferrer;
      }
      const originMatch = opt.match(/^http-origin=(.*)$/i);
      if (originMatch) {
        currentOrigin = originMatch[1].trim().replace(/^["']|["']$/g, '');
        if (currentInfo) currentInfo.origin = currentOrigin;
      }
      const cookieMatch = opt.match(/^http-cookie=(.*)$/i);
      if (cookieMatch) {
        currentCookie = cookieMatch[1].trim().replace(/^["']|["']$/g, '');
        if (currentInfo) currentInfo.cookie = currentCookie;
      }
    } else if (line.startsWith("#EXTHTTP:")) {
      // #EXTHTTP:{"User-Agent":"...", "Referer":"...", "Origin":"...", "Cookie":"..."}
      try {
        const jsonStr = line.substring(9).trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed["User-Agent"] || parsed["user-agent"]) {
          currentUserAgent = parsed["User-Agent"] || parsed["user-agent"];
          if (currentInfo) currentInfo.userAgent = currentUserAgent;
        }
        if (parsed["Referer"] || parsed["referer"] || parsed["Referrer"] || parsed["referrer"]) {
          currentReferrer = parsed["Referer"] || parsed["referer"] || parsed["Referrer"] || parsed["referrer"];
          if (currentInfo) currentInfo.referrer = currentReferrer;
        }
        if (parsed["Origin"] || parsed["origin"]) {
          currentOrigin = parsed["Origin"] || parsed["origin"];
          if (currentInfo) currentInfo.origin = currentOrigin;
        }
        if (parsed["Cookie"] || parsed["cookie"]) {
          currentCookie = parsed["Cookie"] || parsed["cookie"];
          if (currentInfo) currentInfo.cookie = currentCookie;
        }
      } catch {
        // Ignore invalid json
      }
    } else if (line.startsWith("#KODIPROP:")) {
      // #KODIPROP:inputstream.adaptive.manifest_headers=User-Agent=...&Referer=...
      const prop = line.substring(10).trim();
      if (prop.includes("headers=")) {
        const headersPart = prop.substring(prop.indexOf("headers=") + 8);
        const params = new URLSearchParams(headersPart);
        const ua = params.get("User-Agent") || params.get("user-agent") || params.get("http-user-agent");
        const ref = params.get("Referer") || params.get("referer") || params.get("Referrer") || params.get("referrer") || params.get("http-referrer");
        const origin = params.get("Origin") || params.get("origin") || params.get("http-origin");
        const cookie = params.get("Cookie") || params.get("cookie") || params.get("http-cookie");
        if (ua) {
          currentUserAgent = ua;
          if (currentInfo) currentInfo.userAgent = ua;
        }
        if (ref) {
          currentReferrer = ref;
          if (currentInfo) currentInfo.referrer = ref;
        }
        if (origin) {
          currentOrigin = origin;
          if (currentInfo) currentInfo.origin = origin;
        }
        if (cookie) {
          currentCookie = cookie;
          if (currentInfo) currentInfo.cookie = cookie;
        }
      }
    } else if (line.startsWith("http://") || line.startsWith("https://") || line.startsWith("/")) {
      let rawStreamUrl = line;
      let streamUa = currentInfo.userAgent || currentUserAgent;
      let streamRef = currentInfo.referrer || currentReferrer;
      let streamOrigin = currentInfo.origin || currentOrigin;
      let streamCookie = currentInfo.cookie || currentCookie;

      // Check for IPTV pipe format: http://url.m3u8|User-Agent=...&Referer=...&Origin=...&Cookie=...
      if (rawStreamUrl.includes("|")) {
        const parts = rawStreamUrl.split("|");
        rawStreamUrl = parts[0].trim();
        const headerParams = new URLSearchParams(parts[1]);
        const pipeUa = headerParams.get("User-Agent") || headerParams.get("user-agent") || headerParams.get("http-user-agent");
        const pipeRef = headerParams.get("Referer") || headerParams.get("referer") || headerParams.get("Referrer") || headerParams.get("referrer") || headerParams.get("http-referrer");
        const pipeOrigin = headerParams.get("Origin") || headerParams.get("origin") || headerParams.get("http-origin");
        const pipeCookie = headerParams.get("Cookie") || headerParams.get("cookie") || headerParams.get("http-cookie");
        if (pipeUa) streamUa = pipeUa;
        if (pipeRef) streamRef = pipeRef;
        if (pipeOrigin) streamOrigin = pipeOrigin;
        if (pipeCookie) streamCookie = pipeCookie;
      }

      if (currentInfo.name) {
        const rawId = (currentInfo.id && currentInfo.id.trim()) ? currentInfo.id.trim() : `channel-${channels.length + 1}`;
        let uniqueId = rawId;
        let suffix = 2;
        while (seenIds.has(uniqueId)) {
          uniqueId = `${rawId}-${suffix}`;
          suffix++;
        }
        seenIds.add(uniqueId);

        channels.push({
          ...(currentInfo as Channel),
          id: uniqueId,
          url: rawStreamUrl,
          userAgent: streamUa,
          referrer: streamRef,
          origin: streamOrigin,
          cookie: streamCookie,
        });
        currentInfo = {};
        currentUserAgent = undefined;
        currentReferrer = undefined;
        currentOrigin = undefined;
        currentCookie = undefined;
      }
    }
  }

  m3uCache.set(content, channels);
  return channels;
}


