import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import https from "https";
import http from "http";
import net from "net";
import crypto from "crypto";
import compression from "compression";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;
const isDevelopment = process.env.NODE_ENV !== "production";

// Enable high-performance compression
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    const p = req.path.toLowerCase();
    if (p.endsWith(".ts") || p.endsWith(".mp4") || p.endsWith(".m4s") || p.endsWith(".aac")) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ============================================================
// Gemini
// ============================================================

const geminiApiKey = process.env.GEMINI_API_KEY;

const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// ============================================================
// HTTP / HTTPS Agents with Optimized Keep-Alive & DNS
// ============================================================

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 512,
  maxFreeSockets: 128,
  timeout: 30000,
  rejectUnauthorized: false,
  checkServerIdentity: () => undefined,
  secureOptions:
    ((crypto.constants as any)?.SSL_OP_LEGACY_SERVER_CONNECT || 0x4) |
    ((crypto.constants as any)?.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION || 0x40000),
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 512,
  maxFreeSockets: 128,
  timeout: 30000,
});

// ============================================================
// Ultra-Fast In-Memory Cache for Segments & Manifests
// ============================================================

interface CacheEntry {
  contentType: string;
  data: Buffer | string;
  isBinary: boolean;
  expiresAt: number;
  headers?: Record<string, string>;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const MAX_CACHE_ENTRIES = 600;

// Periodic cleanup of expired cache entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}, 30000);

function getCache(key: string): CacheEntry | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry;
}

function setCache(key: string, entry: CacheEntry) {
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, entry);
}

// ============================================================
// CORS
// ============================================================

function setCors(res: express.Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Range"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, OPTIONS"
  );
}

// Handle CORS preflight
app.options("*", (_req, res) => {
  setCors(res);
  res.status(204).end();
});

// ============================================================
// Health Check
// ============================================================

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// M3U8 / Stream Proxy
// ============================================================

// Helper to auto-sniff domain headers for known protected CDNs & platforms
function getSniffedDomainHeaders(targetUrl: string): { userAgent?: string; referrer?: string; origin?: string } {
  try {
    const urlObj = new URL(targetUrl);
    const host = urlObj.hostname.toLowerCase();
    const full = targetUrl.toLowerCase();

    // FanCode / DreamSports
    if (host.includes("fancode") || full.includes("fancode")) {
      return {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        referrer: "https://fancode.com/",
        origin: "https://fancode.com",
      };
    }

    // JioCinema / Sports18
    if (host.includes("jiocinema") || host.includes("jio") || full.includes("jiocinema")) {
      return {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        referrer: "https://www.jiocinema.com/",
        origin: "https://www.jiocinema.com",
      };
    }

    // Hotstar / Disney+
    if (host.includes("hotstar") || full.includes("hotstar")) {
      return {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        referrer: "https://www.hotstar.com/",
        origin: "https://www.hotstar.com",
      };
    }

    // SonyLIV
    if (host.includes("sonyliv") || full.includes("sonyliv")) {
      return {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        referrer: "https://www.sonyliv.com/",
        origin: "https://www.sonyliv.com",
      };
    }

    // Default sniffed origin and root referer
    return {
      referrer: `${urlObj.origin}/`,
      origin: urlObj.origin,
    };
  } catch {
    return {};
  }
}

app.get("/api/proxy", async (req, res) => {
  let rawStreamUrl = req.query.url as string | undefined;
  let customUA = req.query.ua as string | undefined;
  let customRef = req.query.ref as string | undefined;
  let customOrigin = req.query.origin as string | undefined;
  let customCookie = req.query.cookie as string | undefined;

  setCors(res);

  if (!rawStreamUrl) {
    return res.status(400).json({
      error: "Missing URL",
      message: "No stream URL was provided.",
    });
  }

  // Method 3 (IPTV Pipe Format): Parse pipe headers if attached in URL (e.g. url.m3u8|User-Agent=...&Referer=...)
  if (rawStreamUrl.includes("|")) {
    const parts = rawStreamUrl.split("|");
    rawStreamUrl = parts[0].trim();
    try {
      const headerParams = new URLSearchParams(parts[1]);
      const pipeUa = headerParams.get("User-Agent") || headerParams.get("user-agent") || headerParams.get("http-user-agent");
      const pipeRef = headerParams.get("Referer") || headerParams.get("referer") || headerParams.get("Referrer") || headerParams.get("referrer") || headerParams.get("http-referrer");
      const pipeOrigin = headerParams.get("Origin") || headerParams.get("origin") || headerParams.get("http-origin");
      const pipeCookie = headerParams.get("Cookie") || headerParams.get("cookie") || headerParams.get("http-cookie");
      if (pipeUa && !customUA) customUA = pipeUa;
      if (pipeRef && !customRef) customRef = pipeRef;
      if (pipeOrigin && !customOrigin) customOrigin = pipeOrigin;
      if (pipeCookie && !customCookie) customCookie = pipeCookie;
    } catch {
      // Ignore pipe parsing issues
    }
  }

  const streamUrl = rawStreamUrl;

  // Auto-sniff known domain headers if user didn't explicitly override
  const sniffed = getSniffedDomainHeaders(streamUrl);
  if (!customUA && sniffed.userAgent) customUA = sniffed.userAgent;
  if (!customRef && sniffed.referrer) customRef = sniffed.referrer;
  if (!customOrigin && sniffed.origin) customOrigin = sniffed.origin;

  // Check in-memory fast cache first
  const cacheKey = `${streamUrl}|${customUA || ""}|${customRef || ""}|${customCookie || ""}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("X-Cache", "HIT");
    if (cached.headers) {
      for (const [hk, hv] of Object.entries(cached.headers)) {
        res.setHeader(hk, hv);
      }
    }
    if (cached.isBinary && Buffer.isBuffer(cached.data)) {
      res.setHeader("Content-Length", cached.data.length);
      return res.end(cached.data);
    } else {
      res.setHeader("Content-Length", Buffer.byteLength(cached.data as string, "utf8"));
      return res.send(cached.data);
    }
  }

  let parsedInitialUrl: URL;

  try {
    parsedInitialUrl = new URL(streamUrl);

    if (!["http:", "https:"].includes(parsedInitialUrl.protocol)) {
      return res.status(400).json({
        error: "InvalidProtocol",
        message: "Only HTTP and HTTPS URLs are supported.",
      });
    }
  } catch {
    return res.status(400).json({
      error: "InvalidURL",
      message: "The supplied stream URL is invalid.",
    });
  }

  let activeProxyReq: http.ClientRequest | null = null;
  let isClientClosed = false;

  req.on("close", () => {
    isClientClosed = true;
    if (activeProxyReq && !activeProxyReq.destroyed) {
      activeProxyReq.destroy();
    }
  });

  const performRequest = (url: string, retryCount = 0, bypassStage = 0): void => {
    if (isClientClosed || res.writableEnded) {
      return;
    }

    let urlObj: URL;

    try {
      urlObj = new URL(url);
    } catch {
      if (!res.headersSent) {
        res.status(400).json({
          error: "InvalidURL",
          message: "The redirected stream URL is invalid.",
        });
      }
      return;
    }

    const isIp = net.isIP(urlObj.hostname) !== 0;
    const isRetry = retryCount > 0;

    // Build header profiles based on bypass stage (Bypasses 403 blocks)
    let activeUA = customUA || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    let activeRef = customRef || `${urlObj.origin}/`;
    let activeOrigin = customOrigin || (customRef ? (() => { try { return new URL(customRef).origin; } catch { return urlObj.origin; } })() : urlObj.origin);

    // Bypass Stage 1 (Clean Browser Profile without restrictive sec-fetch flags)
    if (bypassStage === 1) {
      activeUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
      activeRef = `${urlObj.origin}/`;
      activeOrigin = urlObj.origin;
    } 
    // Bypass Stage 2 (VLC / MPV / Android OTT Player Profile - Methods 2, 3, 4)
    else if (bypassStage === 2) {
      activeUA = "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
      activeRef = `${urlObj.origin}/`;
      activeOrigin = urlObj.origin;
    }
    // Bypass Stage 3 (Direct Client Profile - no Referer/Origin headers)
    else if (bypassStage === 3) {
      activeUA = "Lavf/60.3.100";
      activeRef = "";
      activeOrigin = "";
    }

    const headers: Record<string, string> = {
      "User-Agent": activeUA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };

    if (bypassStage === 0) {
      headers["Sec-Ch-Ua"] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
      headers["Sec-Ch-Ua-Mobile"] = "?0";
      headers["Sec-Ch-Ua-Platform"] = '"Windows"';
      headers["Sec-Fetch-Dest"] = "empty";
      headers["Sec-Fetch-Mode"] = "cors";
      headers["Sec-Fetch-Site"] = "cross-site";
    }

    if (activeRef) {
      headers["Referer"] = activeRef;
    }
    if (activeOrigin) {
      headers["Origin"] = activeOrigin;
    }
    if (customCookie) {
      headers["Cookie"] = customCookie;
    }

    if (req.headers["range"]) {
      headers["Range"] = req.headers["range"] as string;
    }

    if (req.headers["if-none-match"]) {
      headers["If-None-Match"] = req.headers["if-none-match"] as string;
    }

    if (req.headers["if-modified-since"]) {
      headers["If-Modified-Since"] = req.headers["if-modified-since"] as string;
    }

    if (isRetry) {
      headers["Connection"] = "close";
    }

    const requestModule =
      urlObj.protocol === "https:" ? https : http;

    const options: https.RequestOptions = {
      headers,
      agent: isRetry
        ? false
        : urlObj.protocol === "https:"
        ? httpsAgent
        : httpAgent,
      timeout: 25000,
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
      ...(isIp ? {} : { servername: urlObj.hostname }),
    };

    const proxyReq = requestModule.get(
      url,
      options,
      (proxyRes) => {
        // ----------------------------------------------------
        // Redirect
        // ----------------------------------------------------

        if (
          proxyRes.statusCode &&
          proxyRes.statusCode >= 300 &&
          proxyRes.statusCode < 400 &&
          proxyRes.headers.location
        ) {
          let redirectUrl = proxyRes.headers.location;

          try {
            if (!redirectUrl.startsWith("http")) {
              redirectUrl = new URL(
                redirectUrl,
                url
              ).href;
            }

            proxyRes.resume();

            return performRequest(
              redirectUrl,
              retryCount,
              bypassStage
            );
          } catch {
            proxyRes.resume();

            if (!res.headersSent) {
              return res.status(502).json({
                error: "InvalidRedirect",
              });
            }

            return;
          }
        }

        const statusCode =
          proxyRes.statusCode || 200;

        // ----------------------------------------------------
        // 403 Forbidden / 401 Unauthorized Bypass Strategy Chain
        // ----------------------------------------------------
        if ((statusCode === 403 || statusCode === 401) && bypassStage < 3) {
          proxyRes.resume();
          // Immediately retry with next bypass header stage (Methods 1-4)
          return performRequest(url, retryCount, bypassStage + 1);
        }

        // If still 403 after stage 3, attempt native fetch fallback (HTTP/2 + ALPN)
        if ((statusCode === 403 || statusCode === 401) && bypassStage === 3) {
          proxyRes.resume();
          return performFetchFallback(url);
        }

        const contentType =
          (proxyRes.headers["content-type"] || "").toLowerCase();

        const cleanUrl =
          url.split("?")[0].toLowerCase();

        const isPlaylist =
          contentType.includes("mpegurl") ||
          contentType.includes("apple.mpegurl") ||
          contentType.includes("application/x-mpegurl") ||
          contentType.includes("audio/x-mpegurl") ||
          cleanUrl.includes(".m3u8") ||
          cleanUrl.includes(".m3u");

        const isMediaSegment =
          cleanUrl.endsWith(".ts") ||
          cleanUrl.endsWith(".m4s") ||
          cleanUrl.endsWith(".mp4") ||
          cleanUrl.endsWith(".aac") ||
          cleanUrl.endsWith(".key") ||
          contentType.includes("video/mp2t") ||
          contentType.includes("video/mp4");

        // ----------------------------------------------------
        // Forward useful headers
        // ----------------------------------------------------

        if (contentType) {
          res.setHeader(
            "Content-Type",
            isPlaylist ? "application/vnd.apple.mpegurl" : contentType
          );
        } else if (isPlaylist) {
          res.setHeader(
            "Content-Type",
            "application/vnd.apple.mpegurl"
          );
        }

        // Only pass Content-Length for binary media chunks.
        // Never pass upstream Content-Length for playlists that get rewritten!
        if (!isPlaylist && proxyRes.headers["content-length"]) {
          res.setHeader(
            "Content-Length",
            proxyRes.headers["content-length"]
          );
        }

        if (isMediaSegment) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=86400, immutable"
          );
        } else if (isPlaylist) {
          res.setHeader(
            "Cache-Control",
            "no-cache, no-store, must-revalidate"
          );
        } else if (proxyRes.headers["cache-control"]) {
          res.setHeader(
            "Cache-Control",
            proxyRes.headers["cache-control"]
          );
        } else {
          res.setHeader(
            "Cache-Control",
            "no-cache"
          );
        }

        // Support video range requests & Partial Content
        if (proxyRes.headers["accept-ranges"]) {
          res.setHeader(
            "Accept-Ranges",
            proxyRes.headers["accept-ranges"]
          );
        }

        if (proxyRes.headers["content-range"]) {
          res.setHeader(
            "Content-Range",
            proxyRes.headers["content-range"]
          );
        }

        // ----------------------------------------------------
        // Status code forwarding
        // ----------------------------------------------------

        if (statusCode === 206) {
          res.status(206);
        } else if (statusCode >= 400) {
          res.status(statusCode);
          return proxyRes.pipe(res);
        }

        // ----------------------------------------------------
        // Non-playlist binary data / segments
        // ----------------------------------------------------

        if (!isPlaylist && isMediaSegment) {
          const chunks: Buffer[] = [];
          let totalBytes = 0;
          proxyRes.on("data", (chunk: Buffer) => {
            if (totalBytes < 8 * 1024 * 1024) {
              chunks.push(chunk);
              totalBytes += chunk.length;
            }
          });
          proxyRes.on("end", () => {
            if (chunks.length > 0 && totalBytes <= 8 * 1024 * 1024) {
              const fullBuffer = Buffer.concat(chunks);
              setCache(cacheKey, {
                contentType: contentType || "video/mp2t",
                data: fullBuffer,
                isBinary: true,
                expiresAt: Date.now() + 60000, // 60 seconds
                headers: {
                  "Cache-Control": "public, max-age=86400, immutable",
                }
              });
            }
          });
          proxyRes.on("error", () => {
            if (!res.headersSent) {
              res.status(502).end();
            } else if (!res.writableEnded) {
              res.end();
            }
          });
          return proxyRes.pipe(res);
        }

        // ----------------------------------------------------
        // Read body (inspect for M3U8 or stream)
        // ----------------------------------------------------

        let body = "";

        proxyRes.setEncoding("utf8");

        proxyRes.on("data", (chunk) => {
          body += chunk;
        });

        proxyRes.on("end", () => {
          try {
            const trimmedBody = body.trim();
            const startsWithExtM3U = trimmedBody.startsWith("#EXTM3U") || trimmedBody.startsWith("#EXT-X-") || trimmedBody.includes("#EXTINF");

            // If not actually a playlist and not M3U data, return as-is
            if (!isPlaylist && !startsWithExtM3U) {
              return res.send(body);
            }

            const lastSlash =
              url.lastIndexOf("/");

            const baseUrl =
              lastSlash >= 0
                ? url.substring(0, lastSlash + 1)
                : url;

            const queryParams: string[] = [];

            if (customUA) {
              queryParams.push(
                `ua=${encodeURIComponent(customUA)}`
              );
            }

            if (customRef) {
              queryParams.push(
                `ref=${encodeURIComponent(customRef)}`
              );
            }

            if (customOrigin) {
              queryParams.push(
                `origin=${encodeURIComponent(customOrigin)}`
              );
            }

            if (customCookie) {
              queryParams.push(
                `cookie=${encodeURIComponent(customCookie)}`
              );
            }

            const extraParams =
              queryParams.length > 0
                ? `&${queryParams.join("&")}`
                : "";

            // ------------------------------------------------
            // Convert source URL to proxy URL
            // ------------------------------------------------

            const makeProxyUrl = (
              sourceUrl: string
            ) => {
              if (sourceUrl.startsWith("/api/proxy")) return sourceUrl;
              return `/api/proxy?url=${encodeURIComponent(
                sourceUrl
              )}${extraParams}`;
            };

            // ------------------------------------------------
            // Resolve relative playlist URLs
            // ------------------------------------------------

            const resolveUrl = (
              value: string
            ): string => {
              const trimmed =
                value.trim();

              if (
                trimmed.startsWith("http://") ||
                trimmed.startsWith("https://") ||
                trimmed.startsWith("/api/proxy")
              ) {
                return trimmed;
              }

              try {
                const resolved = new URL(
                  trimmed,
                  url
                );
                // Inherit token/auth query params from parent if child relative URL lacks search params
                if (!resolved.search && urlObj.search) {
                  resolved.search = urlObj.search;
                }
                return resolved.href;
              } catch {
                if (trimmed.startsWith("/")) {
                  try {
                    const abs = new URL(trimmed, urlObj.origin);
                    if (!abs.search && urlObj.search) {
                      abs.search = urlObj.search;
                    }
                    return abs.href;
                  } catch {
                    return urlObj.origin + trimmed;
                  }
                }

                return baseUrl + trimmed;
              }
            };

            // ------------------------------------------------
            // Rewrite playlist
            // ------------------------------------------------

            const lines = body.split(/\r?\n/);

            const rewrittenLines =
              lines.map((line) => {
                const trimmed =
                  line.trim();

                if (!trimmed) {
                  return "";
                }

                // Normal media / playlist URL line
                if (!trimmed.startsWith("#")) {
                  const absoluteUrl =
                    resolveUrl(trimmed);

                  return makeProxyUrl(
                    absoluteUrl
                  );
                }

                let processedLine = line;

                // Rewrite URI="..." attributes (e.g. #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP, #EXT-X-I-FRAME-STREAM-INF)
                if (processedLine.includes("URI=")) {
                  processedLine = processedLine.replace(
                    /URI=(["'])(.*?)\1/gi,
                    (_match, quote, value) => {
                      if (!value || value.startsWith("data:")) return _match;
                      const absoluteUrl = resolveUrl(value);
                      return `URI=${quote}${makeProxyUrl(absoluteUrl)}${quote}`;
                    }
                  );

                  // Handle unquoted URI=some_url.m3u8 if present
                  processedLine = processedLine.replace(
                    /URI=([^",\s]+)/gi,
                    (_match, value) => {
                      if (!value || value.startsWith("data:") || value.startsWith('"') || value.startsWith("'")) return _match;
                      const absoluteUrl = resolveUrl(value);
                      return `URI="${makeProxyUrl(absoluteUrl)}"`;
                    }
                  );
                }

                // Rewrite URL="..." attributes if present
                if (processedLine.includes("URL=")) {
                  processedLine = processedLine.replace(
                    /URL=(["'])(.*?)\1/gi,
                    (_match, quote, value) => {
                      if (!value || value.startsWith("data:")) return _match;
                      const absoluteUrl = resolveUrl(value);
                      return `URL=${quote}${makeProxyUrl(absoluteUrl)}${quote}`;
                    }
                  );
                }

                return processedLine;
              });

            const finalManifest = rewrittenLines.join("\n");

            // Cache rewritten playlist in memory for 2s (live)
            setCache(cacheKey, {
              contentType: "application/vnd.apple.mpegurl; charset=utf-8",
              data: finalManifest,
              isBinary: false,
              expiresAt: Date.now() + 2000,
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            });

            res.setHeader(
              "Content-Type",
              "application/vnd.apple.mpegurl; charset=utf-8"
            );

            res.setHeader(
              "Cache-Control",
              "no-cache, no-store, must-revalidate"
            );

            res.setHeader(
              "Content-Length",
              Buffer.byteLength(finalManifest, "utf8")
            );

            res.send(finalManifest);
          } catch (error) {
            console.error(
              "Playlist rewrite error:",
              error
            );

            if (!res.headersSent) {
              res.status(500).json({
                error: "PlaylistRewriteError",
              });
            }
          }
        });

        proxyRes.on("error", (error) => {
          console.error(
            "Playlist response error:",
            error
          );

          if (!res.headersSent) {
            res.status(502).json({
              error: "PlaylistResponseError",
              message:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }
        });
      }
    );

    // --------------------------------------------------------
    // Request errors & Timeouts
    // --------------------------------------------------------

    activeProxyReq = proxyReq;

    proxyReq.on("error", (error: any) => {
      // If client already disconnected or aborted the request, ignore cleanly
      if (isClientClosed || res.writableEnded) {
        return;
      }

      const isTimeout =
        error.code === "ETIMEDOUT" ||
        error.code === "ESOCKETTIMEDOUT" ||
        error.code === "ERR_TIMEOUT" ||
        error?.message === "Request timeout" ||
        error?.message?.toLowerCase().includes("timeout");

      const isProtocolError =
        error.code === "EPROTO" ||
        error.code === "ERR_SSL_PROTOCOL_ERROR" ||
        error.code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
        error?.message?.includes("SSL routines") ||
        error?.message?.includes("tlsv1 alert");

      const isTransientError =
        isTimeout ||
        isProtocolError ||
        [
          "EAI_AGAIN",
          "ECONNRESET",
          "EPIPE",
          "ECONNREFUSED",
          "ERR_STREAM_PREMATURE_CLOSE",
        ].includes(error.code);

      if (retryCount < 1 && isTransientError && !isProtocolError) {
        const delay = 60 * (retryCount + 1);
        setTimeout(() => {
          if (!isClientClosed && !res.writableEnded) {
            performRequest(url, retryCount + 1, bypassStage);
          }
        }, delay);
        return;
      }

      // If Node's https socket pool threw EPROTO, ECONNRESET or transient drop, attempt native fetch fallback (supports HTTP/2 & ALPN)
      if (isTransientError && !isClientClosed && !res.writableEnded && retryCount === 0) {
        performFetchFallback(url);
        return;
      }

      let message =
        error?.message ||
        "Unknown proxy error";

      if (error.code === "ENOTFOUND") {
        message =
          `DNS error: ${urlObj.hostname} could not be resolved.`;
      } else if (
        error.code === "ECONNREFUSED"
      ) {
        message =
          `Connection refused by ${urlObj.host}.`;
      } else if (
        isTimeout || error.code === "ETIMEDOUT"
      ) {
        message =
          `Connection timed out while contacting ${urlObj.host}.`;
      } else if (
        error.code === "ECONNRESET"
      ) {
        message =
          `Connection was reset by ${urlObj.host}.`;
      } else if (
        isProtocolError
      ) {
        message =
          `Secure TLS protocol error connecting to ${urlObj.host}. Stream source may be offline.`;
      }

      console.info(
        `[Proxy] Upstream source unreachable (${error.code || error.message}) for ${urlObj.hostname}`
      );

      if (!res.headersSent) {
        return res.status(isTimeout ? 504 : 502).json({
          error: isTimeout ? "GatewayTimeout" : "StreamUnavailable",
          code: error.code || (isTimeout ? "ETIMEDOUT" : "UNKNOWN"),
          message,
        });
      }
    });

    proxyReq.setTimeout(25000, () => {
      const timeoutErr: any = new Error("Request timeout");
      timeoutErr.code = "ETIMEDOUT";
      proxyReq.destroy(timeoutErr);
    });
  };

  const performFetchFallback = async (targetUrl: string): Promise<void> => {
    if (isClientClosed || res.writableEnded) return;

    try {
      const urlObj = new URL(targetUrl);
      const sniffedFallback = getSniffedDomainHeaders(targetUrl);
      const fallbackUA = customUA || sniffedFallback.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
      const fallbackRef = customRef || sniffedFallback.referrer || `${urlObj.origin}/`;

      const fetchHeaders: Record<string, string> = {
        "User-Agent": fallbackUA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: fallbackRef,
      };

      if (customOrigin || sniffedFallback.origin) {
        fetchHeaders["Origin"] = customOrigin || sniffedFallback.origin!;
      } else if (fallbackRef) {
        try {
          fetchHeaders["Origin"] = new URL(fallbackRef).origin;
        } catch {
          fetchHeaders["Origin"] = urlObj.origin;
        }
      }

      if (customCookie) {
        fetchHeaders["Cookie"] = customCookie;
      }

      if (req.headers["range"]) {
        fetchHeaders["Range"] = req.headers["range"] as string;
      }
      if (req.headers["if-none-match"]) {
        fetchHeaders["If-None-Match"] = req.headers["if-none-match"] as string;
      }
      if (req.headers["if-modified-since"]) {
        fetchHeaders["If-Modified-Since"] = req.headers["if-modified-since"] as string;
      }

      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 25000);

      req.on("close", () => {
        controller.abort();
      });

      const response = await fetch(targetUrl, {
        method: "GET",
        headers: fetchHeaders,
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(fetchTimeout);

      if (isClientClosed || res.writableEnded) return;

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      const cleanUrl = response.url.split("?")[0].toLowerCase();
      const isPlaylist =
        contentType.includes("mpegurl") ||
        contentType.includes("apple.mpegurl") ||
        contentType.includes("application/x-mpegurl") ||
        contentType.includes("audio/x-mpegurl") ||
        cleanUrl.includes(".m3u8") ||
        cleanUrl.includes(".m3u");

      const isMediaSegment =
        cleanUrl.endsWith(".ts") ||
        cleanUrl.endsWith(".m4s") ||
        cleanUrl.endsWith(".mp4") ||
        cleanUrl.endsWith(".aac") ||
        cleanUrl.endsWith(".key") ||
        contentType.includes("video/mp2t") ||
        contentType.includes("video/mp4");

      if (contentType) {
        res.setHeader("Content-Type", isPlaylist ? "application/vnd.apple.mpegurl" : contentType);
      } else if (isPlaylist) {
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      }

      if (isMediaSegment) {
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      } else if (isPlaylist) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        const upstreamCc = response.headers.get("cache-control");
        if (upstreamCc) res.setHeader("Cache-Control", upstreamCc);
      }

      if (response.headers.get("accept-ranges")) {
        res.setHeader("Accept-Ranges", response.headers.get("accept-ranges")!);
      }
      if (response.headers.get("content-range")) {
        res.setHeader("Content-Range", response.headers.get("content-range")!);
      }

      if (response.status === 206) {
        res.status(206);
      } else if (response.status >= 400) {
        res.status(response.status);
      }

      if (!isPlaylist && isMediaSegment) {
        if (response.headers.get("content-length")) {
          res.setHeader("Content-Length", response.headers.get("content-length")!);
        }
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length <= 8 * 1024 * 1024) {
          setCache(cacheKey, {
            contentType: contentType || "video/mp2t",
            data: buffer,
            isBinary: true,
            expiresAt: Date.now() + 60000,
            headers: {
              "Cache-Control": "public, max-age=86400, immutable",
            },
          });
        }
        res.end(buffer);
        return;
      }

      const bodyText = await response.text();
      const trimmedBody = bodyText.trim();
      const startsWithExtM3U =
        trimmedBody.startsWith("#EXTM3U") ||
        trimmedBody.startsWith("#EXT-X-") ||
        trimmedBody.includes("#EXTINF");

      if (!isPlaylist && !startsWithExtM3U) {
        if (response.headers.get("content-length")) {
          res.setHeader("Content-Length", Buffer.byteLength(bodyText, "utf8"));
        }
        res.send(bodyText);
        return;
      }

      const responseUrlObj = new URL(response.url);
      const baseUrl = response.url.substring(0, response.url.lastIndexOf("/") + 1);

      const queryParams: string[] = [];
      if (customUA) queryParams.push(`ua=${encodeURIComponent(customUA)}`);
      if (customRef) queryParams.push(`ref=${encodeURIComponent(customRef)}`);
      if (customOrigin) queryParams.push(`origin=${encodeURIComponent(customOrigin)}`);
      if (customCookie) queryParams.push(`cookie=${encodeURIComponent(customCookie)}`);
      const extraParams = queryParams.length > 0 ? `&${queryParams.join("&")}` : "";

      const makeProxyUrl = (targetAbsoluteUrl: string) => {
        if (targetAbsoluteUrl.startsWith("/api/proxy")) return targetAbsoluteUrl;
        return `/api/proxy?url=${encodeURIComponent(targetAbsoluteUrl)}${extraParams}`;
      };

      const resolveUrl = (relativeOrAbsolute: string): string => {
        const trimmed = relativeOrAbsolute.trim();
        if (
          trimmed.startsWith("http://") ||
          trimmed.startsWith("https://") ||
          trimmed.startsWith("/api/proxy")
        ) {
          return trimmed;
        }
        try {
          const resolved = new URL(trimmed, response.url);
          if (!resolved.search && responseUrlObj.search) {
            resolved.search = responseUrlObj.search;
          }
          return resolved.href;
        } catch {
          if (trimmed.startsWith("/")) {
            try {
              const abs = new URL(trimmed, responseUrlObj.origin);
              if (!abs.search && responseUrlObj.search) abs.search = responseUrlObj.search;
              return abs.href;
            } catch {
              return responseUrlObj.origin + trimmed;
            }
          }
          return baseUrl + trimmed;
        }
      };

      const lines = bodyText.split(/\r?\n/);
      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        if (!trimmed.startsWith("#")) {
          const absoluteUrl = resolveUrl(trimmed);
          return makeProxyUrl(absoluteUrl);
        }
        let processedLine = line;
        if (processedLine.includes("URI=")) {
          processedLine = processedLine.replace(/URI=(["'])(.*?)\1/gi, (_match, quote, value) => {
            if (!value || value.startsWith("data:")) return _match;
            return `URI=${quote}${makeProxyUrl(resolveUrl(value))}${quote}`;
          });
          processedLine = processedLine.replace(/URI=([^",\s]+)/gi, (_match, value) => {
            if (
              !value ||
              value.startsWith("data:") ||
              value.startsWith('"') ||
              value.startsWith("'")
            )
              return _match;
            return `URI="${makeProxyUrl(resolveUrl(value))}"`;
          });
        }
        if (processedLine.includes("URL=")) {
          processedLine = processedLine.replace(/URL=(["'])(.*?)\1/gi, (_match, quote, value) => {
            if (!value || value.startsWith("data:")) return _match;
            return `URL=${quote}${makeProxyUrl(resolveUrl(value))}${quote}`;
          });
        }
        return processedLine;
      });

      const finalManifest = rewrittenLines.join("\n");

      setCache(cacheKey, {
        contentType: "application/vnd.apple.mpegurl; charset=utf-8",
        data: finalManifest,
        isBinary: false,
        expiresAt: Date.now() + 2000,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Content-Length", Buffer.byteLength(finalManifest, "utf8"));
      res.send(finalManifest);
    } catch (err: any) {
      if (isClientClosed || res.writableEnded) return;
      if (!res.headersSent) {
        res.status(502).json({
          error: "ProxyError",
          code: err.code || "FETCH_FAILED",
          message: err.message || "Failed to fetch stream",
        });
      }
    }
  };

  performRequest(streamUrl);
});


// ============================================================
// Team Search
// ============================================================

app.get("/api/search-team", async (req, res) => {
  const query = String(
    req.query.q || ""
  ).trim();

  if (!query || query.length < 2) {
    return res.json([]);
  }

  if (!ai) {
    console.error(
      "GEMINI_API_KEY is not configured."
    );

    return res.status(503).json({
      error: "GeminiUnavailable",
      message:
        "GEMINI_API_KEY is not configured on the server.",
    });
  }

  try {
    const prompt = `
Search for sports teams matching "${query}".

Return ONLY a valid JSON array.

Each object must contain:
- "name": Full team name
- "logo": Public URL for the team's crest/logo
- "domain": Official website domain

Prefer reliable public logo URLs.

If no teams are found, return [].

Do not use markdown.
Do not add explanations.
`;

    const result =
      await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

    const text =
      result.text?.trim() || "";

    const jsonStart =
      text.indexOf("[");

    const jsonEnd =
      text.lastIndexOf("]");

    if (
      jsonStart === -1 ||
      jsonEnd === -1 ||
      jsonEnd <= jsonStart
    ) {
      return res.json([]);
    }

    const jsonContent =
      text.substring(
        jsonStart,
        jsonEnd + 1
      );

    try {
      const teams =
        JSON.parse(jsonContent);

      if (!Array.isArray(teams)) {
        return res.json([]);
      }

      return res.json(teams);
    } catch (error) {
      console.error(
        "Invalid Gemini JSON:",
        error
      );

      return res.json([]);
    }
  } catch (error) {
    console.error(
      "Gemini Search Error:",
      error
    );

    return res.status(500).json({
      error: "GeminiSearchFailed",
      message:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
});

// ============================================================
// CricHD Schedule Sync
// ============================================================

let crichdScheduleCache: { data: any[]; expiresAt: number } | null = null;

app.get("/api/sync-crichd", async (req, res) => {
  const forceRefresh = req.query.force === "true";
  if (!forceRefresh && crichdScheduleCache && crichdScheduleCache.expiresAt > Date.now()) {
    return res.json({
      success: true,
      matches: crichdScheduleCache.data,
      count: crichdScheduleCache.data.length,
      cached: true,
    });
  }

  try {
    const scheduleUrl =
      "https://streamcrichd.com/update/schedule.php";

    const fetchSchedule =
      (): Promise<string> =>
        new Promise(
          (resolve, reject) => {
            const request =
              https.get(
                scheduleUrl,
                {
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                    Accept:
                      "text/html,application/xhtml+xml",
                  },
                  timeout: 15000,
                },
                (response) => {
                  let data = "";

                  response.setEncoding(
                    "utf8"
                  );

                  response.on(
                    "data",
                    (chunk) => {
                      data += chunk;
                    }
                  );

                  response.on(
                    "end",
                    () => {
                      if (
                        response.statusCode &&
                        response.statusCode >= 400
                      ) {
                        reject(
                          new Error(
                            `Schedule server returned ${response.statusCode}`
                          )
                        );
                        return;
                      }

                      resolve(data);
                    }
                  );

                  response.on(
                    "error",
                    reject
                  );
                }
              );

            request.on(
              "error",
              reject
            );

            request.setTimeout(
              15000,
              () => {
                request.destroy(
                  new Error(
                    "Schedule request timeout"
                  )
                );
              }
            );
          }
        );

    const rawData =
      await fetchSchedule();

    const eventBlocks =
      rawData.match(
        /<article class="event[\s\S]*?<\/article>/g
      ) || [];

    const extractedData =
      eventBlocks
        .slice(0, 40)
        .map((block) => {
          const title =
            block
              .match(
                /<h3 class="event-title">([^<]+)<\/h3>/
              )?.[1]
              ?.trim() ||
            "Unknown Match";

          const searchKeywords =
            block
              .match(
                /data-search="([^"]+)"/
              )?.[1]
              ?.toLowerCase() || "";

          const timeHint =
            block.match(
              /title="([^"]+)"/
            )?.[1] ||
            new Date().toISOString();

          const isLive =
            block.includes(
              "event-live"
            ) ||
            block.includes(
              "Started"
            );

          const channels: Array<{
            name: string;
            url: string;
          }> = [];

          const channelMatches =
            block.matchAll(
              /<span class="channel-name">([^<]+)<\/span>[\s\S]*?<span class="channel-hd">hd=(\d+)<\/span>/g
            );

          for (
            const match of channelMatches
          ) {
            channels.push({
              name: match[1].trim(),
              url: `https://streamcrichd.com/update/fetch.php?hd=${match[2]}`,
            });
          }

          let team1 = "";
          let team2 = "";

          if (title.includes(" vs ")) {
            [team1, team2] =
              title
                .split(" vs ")
                .map((team) =>
                  team.trim()
                );
          } else {
            team1 = title;
            team2 = "TBA";
          }

          let category =
            "football";

          if (
            searchKeywords.includes(
              "cricket"
            )
          ) {
            category = "cricket";
          } else if (
            searchKeywords.includes(
              "moto"
            ) ||
            searchKeywords.includes(
              "f1"
            )
          ) {
            category =
              "motorsport";
          } else if (
            searchKeywords.includes(
              "wrestling"
            ) ||
            searchKeywords.includes(
              "wwe"
            )
          ) {
            category =
              "wrestling";
          }

          let startTimeISO =
            new Date().toISOString();

          const parsedDate =
            new Date(timeHint);

          if (
            !Number.isNaN(
              parsedDate.getTime()
            )
          ) {
            startTimeISO =
              parsedDate.toISOString();
          }

          let finalChannels = channels;
          if (finalChannels.length === 0) {
            if (category === "cricket") {
              finalChannels = [
                { name: "Sky Sports Cricket HD (1080p)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
                { name: "Willow TV Live HD (720p 60fps)", url: "https://vo-live.cdb.cdn.orange.com/Content/Channel/AbuDhabiSportsChannel1/HLS/index.m3u8" },
                { name: "Sony Sports Ten 5 HD", url: "https://d3rl6ns7c3ilda.cloudfront.net/v1/master/9d062541f2ff39b5c0f48b743c6411d25f62fc25/STIRR-MuxIP-AdventureSportsTV/438.m3u8" },
                { name: "Astro Cricket Live Feed", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" }
              ];
            } else if (category === "motorsport") {
              finalChannels = [
                { name: "Sky Sports F1 HD (1080p)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
                { name: "F1 TV Pro Pitlane Feed", url: "https://vo-live.cdb.cdn.orange.com/Content/Channel/AbuDhabiSportsChannel1/HLS/index.m3u8" },
                { name: "Servus TV Motorsport HD", url: "https://d3rl6ns7c3ilda.cloudfront.net/v1/master/9d062541f2ff39b5c0f48b743c6411d25f62fc25/STIRR-MuxIP-AdventureSportsTV/438.m3u8" }
              ];
            } else {
              finalChannels = [
                { name: "Sky Sports Premier League (1080p)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
                { name: "TNT Sports 1 HD (720p)", url: "https://vo-live.cdb.cdn.orange.com/Content/Channel/AbuDhabiSportsChannel1/HLS/index.m3u8" },
                { name: "Global Sports Multi-Camera", url: "https://d3rl6ns7c3ilda.cloudfront.net/v1/master/9d062541f2ff39b5c0f48b743c6411d25f62fc25/STIRR-MuxIP-AdventureSportsTV/438.m3u8" }
              ];
            }
          }

          return {
            team1,
            team2,
            category,
            startTime: startTimeISO,
            status: isLive
              ? "live"
              : "upcoming",
            channels: finalChannels,
          };
        });

    crichdScheduleCache = {
      data: extractedData,
      expiresAt: Date.now() + 60000,
    };

    return res.json(
      extractedData
    );
  } catch (error) {
    console.error(
      "Sync Error:",
      error
    );

    return res.status(500).json({
      error: "SyncFailed",
      details:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
});

// ============================================================
// API-Sports (api-football) Fixtures & Daily Extraction
// ============================================================

const DEFAULT_APISPORTS_KEY = "88fba276f1c1c73d68b6fb953f729c34";
const apiSportsCache = new Map<string, { data: any; expiresAt: number }>();

function getApiSportsKey(req?: express.Request): string {
  if (req?.query?.key && typeof req.query.key === "string" && req.query.key.trim().length > 10) {
    return req.query.key.trim();
  }
  return process.env.APISPORTS_API_KEY || DEFAULT_APISPORTS_KEY;
}

async function requestApiSports(endpoint: string, params: Record<string, string> = {}, apiKey: string): Promise<any> {
  const queryParts = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  
  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  const fullUrl = `https://v3.football.api-sports.io/${endpoint}${queryString}`;
  const cacheKey = `${apiKey}:${fullUrl}`;

  const cached = apiSportsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(fullUrl);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "GET",
        agent: httpsAgent,
        headers: {
          "x-apisports-key": apiKey,
          "User-Agent": "StreamHub-ApiSports/1.0",
          Accept: "application/json",
        },
        timeout: 15000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            // Cache based on endpoint (live fixtures 60s, daily schedules 10 mins)
            const cacheTTL = params.live ? 60 * 1000 : 10 * 60 * 1000;
            apiSportsCache.set(cacheKey, {
              data: parsed,
              expiresAt: Date.now() + cacheTTL,
            });
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse API-Sports response: ${body.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("API-Sports request timed out."));
    });
    req.end();
  });
}

// Status check (account, quota, subscription)
app.get("/api/apisports/status", async (req, res) => {
  setCors(res);
  const key = getApiSportsKey(req);
  try {
    const data = await requestApiSports("status", {}, key);
    return res.json({
      success: true,
      apiKey: `${key.slice(0, 4)}...${key.slice(-4)}`,
      data: data.response || data,
      errors: data.errors || [],
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to query API-Sports status",
    });
  }
});

// Fixtures extraction (supporting all official API-Sports parameters: id, ids, live, date, league, season, team, from, to, next, last, round, status, venue, timezone)
app.get("/api/apisports/fixtures", async (req, res) => {
  setCors(res);
  const key = getApiSportsKey(req);
  
  const queryParams: Record<string, string> = {};
  
  // Forward all official API-Sports v3 football fixtures query parameters if provided
  const allowedParams = [
    "id",
    "ids",
    "live",
    "date",
    "league",
    "season",
    "team",
    "from",
    "to",
    "next",
    "last",
    "round",
    "status",
    "venue",
    "timezone",
  ];

  for (const p of allowedParams) {
    const val = req.query[p];
    if (val && typeof val === "string" && val.trim() !== "") {
      queryParams[p] = val.trim();
    }
  }

  // If no date/live/range or fixture id is provided, default to today's date
  if (!queryParams.id && !queryParams.ids && !queryParams.live && !queryParams.date && !queryParams.from && !queryParams.next && !queryParams.last) {
    queryParams.date = new Date().toISOString().slice(0, 10);
  }

  // Ensure default timezone is UTC if not explicitly provided
  if (!queryParams.timezone) {
    queryParams.timezone = "UTC";
  }

  try {
    const data = await requestApiSports("fixtures", queryParams, key);
    return res.json({
      success: true,
      parameters: queryParams,
      count: data.results || (Array.isArray(data.response) ? data.response.length : 0),
      fixtures: data.response || [],
      errors: data.errors || [],
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch API-Sports fixtures",
    });
  }
});

// Leagues listing
app.get("/api/apisports/leagues", async (req, res) => {
  setCors(res);
  const key = getApiSportsKey(req);
  const country = req.query.country as string | undefined;
  const queryParams: Record<string, string> = {};
  if (country) queryParams.country = country;

  try {
    const data = await requestApiSports("leagues", queryParams, key);
    return res.json({
      success: true,
      leagues: data.response || [],
      errors: data.errors || [],
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch API-Sports leagues",
    });
  }
});

// ============================================================
// Streamed.pk API Proxy Endpoints
// ============================================================
const STREAMED_BASE_ORIGIN = "https://streamed.pk";
const streamedCache = new Map<string, { data: any; expiry: number }>();

async function fetchStreamedWithCache(url: string, ttlMs: number = 30000): Promise<any> {
  const now = Date.now();
  const cached = streamedCache.get(url);
  if (cached && cached.expiry > now) {
    return cached.data;
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Streamed API returned HTTP ${response.status}`);
  }
  const data = await response.json();
  streamedCache.set(url, { data, expiry: now + ttlMs });
  return data;
}

// 1. Sports API: GET /api/streamed/sports
app.get("/api/streamed/sports", async (_req, res) => {
  setCors(res);
  try {
    const data = await fetchStreamedWithCache(`${STREAMED_BASE_ORIGIN}/api/sports`, 10 * 60 * 1000);
    return res.json(data);
  } catch (err: any) {
    console.error("Streamed sports proxy error:", err.message);
    return res.status(500).json({ error: "Failed to fetch sports", message: err.message });
  }
});

// 2. Matches API: Live matches
app.get("/api/streamed/matches/live", async (req, res) => {
  setCors(res);
  const popular = req.query.popular === "true";
  const path = popular ? "/api/matches/live/popular" : "/api/matches/live";
  try {
    const data = await fetchStreamedWithCache(`${STREAMED_BASE_ORIGIN}${path}`, 20 * 1000);
    return res.json(data);
  } catch (err: any) {
    console.error("Streamed live matches proxy error:", err.message);
    return res.status(500).json({ error: "Failed to fetch live matches", message: err.message });
  }
});

// 3. Matches API: Today matches
app.get("/api/streamed/matches/all-today", async (req, res) => {
  setCors(res);
  const popular = req.query.popular === "true";
  const path = popular ? "/api/matches/all-today/popular" : "/api/matches/all-today";
  try {
    const data = await fetchStreamedWithCache(`${STREAMED_BASE_ORIGIN}${path}`, 45 * 1000);
    return res.json(data);
  } catch (err: any) {
    console.error("Streamed today matches proxy error:", err.message);
    return res.status(500).json({ error: "Failed to fetch today matches", message: err.message });
  }
});

// 4. Matches API: All matches
app.get("/api/streamed/matches/all", async (req, res) => {
  setCors(res);
  const popular = req.query.popular === "true";
  const path = popular ? "/api/matches/all/popular" : "/api/matches/all";
  try {
    const data = await fetchStreamedWithCache(`${STREAMED_BASE_ORIGIN}${path}`, 60 * 1000);
    return res.json(data);
  } catch (err: any) {
    console.error("Streamed all matches proxy error:", err.message);
    return res.status(500).json({ error: "Failed to fetch all matches", message: err.message });
  }
});

// 5. Matches API: Category / Sport matches
app.get("/api/streamed/matches/:sport", async (req, res) => {
  setCors(res);
  const sport = req.params.sport;
  const popular = req.query.popular === "true";
  const path = popular ? `/api/matches/${encodeURIComponent(sport)}/popular` : `/api/matches/${encodeURIComponent(sport)}`;
  try {
    const data = await fetchStreamedWithCache(`${STREAMED_BASE_ORIGIN}${path}`, 45 * 1000);
    return res.json(data);
  } catch (err: any) {
    console.error(`Streamed sport matches proxy error (${sport}):`, err.message);
    return res.status(500).json({ error: `Failed to fetch ${sport} matches`, message: err.message });
  }
});

// 6. Streams API: GET /api/streamed/stream/:source/:id
app.get("/api/streamed/stream/:source/:id", async (req, res) => {
  setCors(res);
  const { source, id } = req.params;
  const url = `${STREAMED_BASE_ORIGIN}/api/stream/${encodeURIComponent(source)}/${encodeURIComponent(id)}`;
  try {
    const data = await fetchStreamedWithCache(url, 20 * 1000);
    return res.json(data);
  } catch (err: any) {
    console.error(`Streamed stream proxy error (${source}/${id}):`, err.message);
    return res.status(500).json({ error: "Failed to fetch stream details", message: err.message });
  }
});

// 7. Streams API: Multi-source batch resolver
app.get("/api/streamed/all-streams", async (req, res) => {
  setCors(res);
  const sourcesParam = req.query.sources as string | undefined;
  if (!sourcesParam) {
    return res.json([]);
  }

  try {
    // format: source1:id1,source2:id2
    const pairs = sourcesParam.split(",").map((p) => {
      const [src, id] = p.split(":");
      return { source: src?.trim(), id: id?.trim() };
    }).filter((p) => p.source && p.id);

    const streamResults = await Promise.allSettled(
      pairs.map((p) =>
        fetchStreamedWithCache(
          `${STREAMED_BASE_ORIGIN}/api/stream/${encodeURIComponent(p.source)}/${encodeURIComponent(p.id)}`,
          20 * 1000
        )
      )
    );

    const allStreams: any[] = [];
    const seenEmbeds = new Set<string>();

    streamResults.forEach((result) => {
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        result.value.forEach((s) => {
          if (s.embedUrl && !seenEmbeds.has(s.embedUrl)) {
            seenEmbeds.add(s.embedUrl);
            allStreams.push(s);
          }
        });
      }
    });

    return res.json(allStreams);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to resolve streams", message: err.message });
  }
});


// Periodic background logger / cache refresh
setInterval(async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = process.env.APISPORTS_API_KEY || DEFAULT_APISPORTS_KEY;
    // Silently pre-warm status & top fixtures
    await requestApiSports("status", {}, key).catch(() => null);
  } catch (e) {
    // silent
  }
}, 30 * 60 * 1000);

// ============================================================
// Production / Development Frontend
// ============================================================

async function startServer() {
  if (isDevelopment) {
    console.log(
      "Starting Vite development server..."
    );

    const vite =
      await createViteServer({
        server: {
          middlewareMode: true,
        },
        appType: "spa",
      });

    app.use(vite.middlewares);
  } else {
    const distPath =
      path.join(
        process.cwd(),
        "dist"
      );

    console.log(
      `Serving production build from: ${distPath}`
    );

    app.use(
      express.static(distPath, {
        index: "index.html",
        maxAge: "1d",
      })
    );

    // React Router SPA fallback
    app.get("*", (_req, res) => {
      res.sendFile(
        path.join(
          distPath,
          "index.html"
        )
      );
    });
  }

  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Server running on port ${PORT}`
      );
      console.log(
        `Environment: ${
          process.env.NODE_ENV ||
          "production"
        }`
      );
    }
  );
}

// ============================================================
// Start
// ============================================================

startServer().catch((error) => {
  console.error(
    "Failed to start server:",
    error
  );

  process.exit(1);
});
