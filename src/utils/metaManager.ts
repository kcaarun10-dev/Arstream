import { useEffect } from "react";
import { Match, Channel, StreamItem } from "../types";

/**
 * Format date for humans (e.g. "Saturday, Aug 24, 2024 at 8:00 PM UTC")
 */
export function formatMatchScheduleDate(startTime: any): string {
  if (!startTime) return "Upcoming";
  try {
    const d = typeof startTime === "object" && startTime?.seconds 
      ? new Date(startTime.seconds * 1000) 
      : new Date(startTime);
    if (isNaN(d.getTime())) return "Upcoming";
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    });
  } catch {
    return "Upcoming";
  }
}

/**
 * Auto-generate a rich, comprehensive match description based on admin-provided details
 */
export function generateMatchDescription(match: Partial<Match>): string {
  const team1 = match.team1?.trim() || "";
  const team2 = match.team2?.trim() || "";
  const league = match.league?.trim() || match.tournament?.trim() || "";
  const eventName = match.eventName?.trim() || "";
  const category = (match.category || "sports").toUpperCase();
  const channelCount = match.channels?.length || 0;
  const status = match.status || "upcoming";
  const dateStr = formatMatchScheduleDate(match.startTime);

  const matchTitle = team1 && team2 ? `${team1} vs ${team2}` : eventName || team1 || "Live Sports Event";
  const leagueContext = league ? `in the ${league}` : "";

  let statusPhrase = "";
  if (status === "live") {
    statusPhrase = "is broadcasting live right now in full HD";
  } else if (status === "upcoming") {
    statusPhrase = `is scheduled to kick off on ${dateStr}`;
  } else if (status === "finished" || status === "ended") {
    statusPhrase = "has concluded. Full highlights and replay coverage available";
  } else {
    statusPhrase = "live stream broadcast";
  }

  const serverPhrase = channelCount > 1 
    ? `Stream seamlessly across ${channelCount} redundant high-speed servers with adaptive bitrate and low latency.`
    : channelCount === 1 
      ? `Enjoy direct high-speed stream server access with crystal-clear audio and zero buffering.`
      : `High-definition live coverage with multi-server playback.`;

  return `Watch ${matchTitle} ${leagueContext} on AR Stream. This ${category} event ${statusPhrase}. ${serverPhrase} Catch all the real-time action, tactical plays, and live commentary on any device with no download required.`;
}

/**
 * Auto-generate a concise, high-CTR SEO meta description (140-160 characters)
 */
export function generateMatchMetaDescription(match: Partial<Match>): string {
  const team1 = match.team1?.trim() || "";
  const team2 = match.team2?.trim() || "";
  const league = match.league?.trim() || match.tournament?.trim() || "";
  const category = match.category || "sports";
  const status = match.status || "upcoming";
  const matchTitle = team1 && team2 ? `${team1} vs ${team2}` : match.eventName || team1 || "Live Sports";

  if (status === "live") {
    return `🔴 LIVE NOW: Watch ${matchTitle}${league ? ` (${league})` : ""} free live stream in HD on AR Stream. Multi-server streaming, live score & real-time updates.`;
  }
  
  if (status === "finished" || status === "ended") {
    return `Match result & stream info for ${matchTitle}${league ? ` (${league})` : ""}. Highlights and stats coverage on AR Stream.`;
  }

  const dateStr = formatMatchScheduleDate(match.startTime);
  return `Watch ${matchTitle}${league ? ` - ${league}` : ""} live stream online. Starts ${dateStr}. HD multi-source broadcast on AR Stream.`;
}

/**
 * Auto-generate SEO search keywords
 */
export function generateMatchKeywords(match: Partial<Match>): string[] {
  const team1 = match.team1?.trim() || "";
  const team2 = match.team2?.trim() || "";
  const league = match.league?.trim() || match.tournament?.trim() || "";
  const category = match.category?.trim() || "sports";
  const eventName = match.eventName?.trim() || "";

  const list: string[] = [
    "AR Stream",
    "live sports stream",
    "watch live sports free",
    `${category} live stream`,
    "HD live streaming"
  ];

  if (team1 && team2) {
    list.push(
      `${team1} vs ${team2}`,
      `${team1} vs ${team2} live`,
      `${team1} vs ${team2} live stream`,
      `watch ${team1} vs ${team2} online`,
      `${team1} live`,
      `${team2} live`
    );
  } else if (team1) {
    list.push(`${team1} live stream`, `watch ${team1}`);
  }

  if (eventName) {
    list.push(eventName, `${eventName} live stream`);
  }

  if (league) {
    list.push(league, `${league} live stream`, `${league} matches today`);
    if (team1 && team2) {
      list.push(`${team1} vs ${team2} ${league}`);
    }
  }

  return Array.from(new Set(list));
}

/**
 * Generate dynamic page title for match
 */
export function generateMatchPageTitle(match: Partial<Match>): string {
  const team1 = match.team1?.trim() || "";
  const team2 = match.team2?.trim() || "";
  const league = match.league?.trim() || match.tournament?.trim() || "";
  const isLive = match.status === "live";

  const prefix = isLive ? "🔴 LIVE: " : "";
  const matchTitle = team1 && team2 ? `${team1} vs ${team2}` : match.eventName || team1 || "Live Match";
  const leagueSuffix = league ? ` — ${league}` : "";

  return `${prefix}${matchTitle}${leagueSuffix} | AR Stream`;
}

/**
 * Generate Schema.org SportsEvent JSON-LD structured data for Google Rich Results
 */
export function generateSportsEventSchema(match: Partial<Match>, appUrl: string = window.location.origin): object {
  const team1 = match.team1?.trim() || "Team 1";
  const team2 = match.team2?.trim() || "Team 2";
  const league = match.league?.trim() || match.tournament?.trim() || match.category || "Sports";
  const matchTitle = team1 && team2 ? `${team1} vs ${team2}` : match.eventName || team1;
  const description = match.description || match.metaDescription || generateMatchMetaDescription(match);

  let startDateIso = new Date().toISOString();
  try {
    if (match.startTime) {
      const d = typeof match.startTime === "object" && match.startTime?.seconds
        ? new Date(match.startTime.seconds * 1000)
        : new Date(match.startTime);
      if (!isNaN(d.getTime())) startDateIso = d.toISOString();
    }
  } catch {
    // fallback to current time
  }

  let eventStatus = "https://schema.org/EventScheduled";
  if (match.status === "live") {
    eventStatus = "https://schema.org/EventLive";
  } else if (match.status === "finished" || match.status === "ended") {
    eventStatus = "https://schema.org/EventCompleted";
  }

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${matchTitle} (${league})`,
    "description": description,
    "startDate": startDateIso,
    "eventStatus": eventStatus,
    "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
    "image": [
      match.team1Logo || `${appUrl}/logo.svg`,
      match.team2Logo || `${appUrl}/logo.svg`,
      match.leagueLogo || `${appUrl}/logo.svg`
    ].filter(Boolean),
    "sport": match.category || "Sports",
    "competitor": [
      {
        "@type": "SportsTeam",
        "name": team1,
        "image": match.team1Logo || undefined
      },
      {
        "@type": "SportsTeam",
        "name": team2,
        "image": match.team2Logo || undefined
      }
    ],
    "organizer": {
      "@type": "Organization",
      "name": league,
      "logo": match.leagueLogo || `${appUrl}/logo.svg`
    },
    "location": {
      "@type": "VirtualLocation",
      "url": window.location.href
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": window.location.href
    }
  };
}

export interface PageMetadataOptions {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  schemaJson?: object;
}

const DEFAULT_TITLE = "AR Stream — Liquid 4K Live Sports & IPTV";
const DEFAULT_DESC = "A premium sports streaming experience with real-time match updates, adaptive 4K HLS player, and global IPTV.";
const DEFAULT_IMAGE = "/logo.svg";

/**
 * Dynamically set or update DOM meta tags and LD-JSON scripts
 */
export function updatePageMetadata(options: PageMetadataOptions): () => void {
  if (typeof document === "undefined") return () => {};

  const originalTitle = document.title;

  // 1. Page Title
  if (options.title) {
    document.title = options.title;
  }

  // Helper to set meta attribute
  const setMetaTag = (attrName: "name" | "property", attrVal: string, content: string) => {
    let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  // 2. Standard Description & Keywords
  if (options.description) {
    setMetaTag("name", "description", options.description);
  }
  if (options.keywords && options.keywords.length > 0) {
    setMetaTag("name", "keywords", options.keywords.join(", "));
  }

  // 3. OpenGraph tags
  if (options.ogTitle || options.title) {
    setMetaTag("property", "og:title", options.ogTitle || options.title || DEFAULT_TITLE);
  }
  if (options.ogDescription || options.description) {
    setMetaTag("property", "og:description", options.ogDescription || options.description || DEFAULT_DESC);
  }
  if (options.ogImage) {
    setMetaTag("property", "og:image", options.ogImage);
  }
  setMetaTag("property", "og:url", options.ogUrl || (typeof window !== "undefined" ? window.location.href : ""));
  setMetaTag("property", "og:type", "video.other");

  // 4. Twitter tags
  if (options.ogTitle || options.title) {
    setMetaTag("name", "twitter:title", options.ogTitle || options.title || DEFAULT_TITLE);
  }
  if (options.ogDescription || options.description) {
    setMetaTag("name", "twitter:description", options.ogDescription || options.description || DEFAULT_DESC);
  }
  if (options.ogImage) {
    setMetaTag("name", "twitter:image", options.ogImage);
  }
  setMetaTag("name", "twitter:card", "summary_large_image");

  // 5. Schema.org JSON-LD Script
  let scriptEl = document.getElementById("schema-sports-event") as HTMLScriptElement | null;
  if (options.schemaJson) {
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = "schema-sports-event";
      scriptEl.type = "application/ld+json";
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(options.schemaJson, null, 2);
  } else if (scriptEl) {
    scriptEl.remove();
  }

  // Return cleanup function to reset on unmount
  return () => {
    document.title = originalTitle;
    setMetaTag("name", "description", DEFAULT_DESC);
    setMetaTag("property", "og:title", DEFAULT_TITLE);
    setMetaTag("property", "og:description", DEFAULT_DESC);
    setMetaTag("property", "og:image", DEFAULT_IMAGE);
    const existingScript = document.getElementById("schema-sports-event");
    if (existingScript) existingScript.remove();
  };
}

/**
 * React Hook for automatically syncing active match metadata with document head
 */
export function useMatchMetadata(match: Match | null | undefined, channel?: Channel | null, streamItem?: StreamItem | null) {
  useEffect(() => {
    if (!match && !channel && !streamItem) return;

    if (match) {
      const title = generateMatchPageTitle(match);
      const description = match.metaDescription || match.description || generateMatchMetaDescription(match);
      const keywords = match.keywords || generateMatchKeywords(match);
      const ogImage = match.team1Logo || match.leagueLogo || match.team2Logo || DEFAULT_IMAGE;
      const schemaJson = generateSportsEventSchema(match);

      const cleanup = updatePageMetadata({
        title,
        description,
        keywords,
        ogTitle: title,
        ogDescription: description,
        ogImage,
        ogUrl: window.location.href,
        schemaJson
      });

      return cleanup;
    }

    if (channel) {
      const title = `🔴 LIVE: ${channel.name} (${channel.group}) | AR Stream IPTV`;
      const description = `Watch ${channel.name} live broadcast online. Premium ${channel.group} direct IPTV stream with ultra-low latency on AR Stream.`;
      const keywords = [channel.name, `${channel.name} live`, `${channel.group} live stream`, "IPTV stream", "AR Stream"];
      const ogImage = channel.logo || DEFAULT_IMAGE;

      const cleanup = updatePageMetadata({
        title,
        description,
        keywords,
        ogTitle: title,
        ogDescription: description,
        ogImage,
        ogUrl: window.location.href
      });

      return cleanup;
    }

    if (streamItem) {
      const title = `${streamItem.title} | AR Stream`;
      const description = streamItem.description || `Watch ${streamItem.title} in HD quality on AR Stream.`;
      const keywords = streamItem.tags || [streamItem.title, "AR Stream"];
      const ogImage = streamItem.thumbnail || DEFAULT_IMAGE;

      const cleanup = updatePageMetadata({
        title,
        description,
        keywords,
        ogTitle: title,
        ogDescription: description,
        ogImage,
        ogUrl: window.location.href
      });

      return cleanup;
    }
  }, [
    match?.id, 
    match?.team1, 
    match?.team2, 
    match?.league, 
    match?.status, 
    match?.description, 
    match?.metaDescription,
    channel?.id,
    channel?.name,
    channel?.group,
    streamItem?.id,
    streamItem?.title
  ]);
}
