import { StreamItem } from "../types";

export const FEATURED_STREAMS: StreamItem[] = [
  {
    id: "tears-of-steel",
    title: "Tears of Steel: Quantum Nexus",
    subtitle: "Episode 1 &bull; Cyberpunk Dystopia",
    category: "Sci-Fi / Cyberpunk",
    description: "In a dystopian future, a specialized crew of tactical operatives and scientists explore an anomalous temporal distortion in the remnants of a futuristic megacity to prevent a global machine singularity.",
    thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80",
    backdropUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80",
    isLive: false,
    viewCount: 1428500,
    likesCount: 98400,
    qualityBadge: "4K ULTRA HD",
    audioCodec: "Dolby Atmos 5.1",
    rating: "9.8 / 10",
    duration: "12:14",
    releaseYear: "2026",
    tags: ["Cyberpunk", "HDR10+", "Spatial Audio", "60 FPS", "Cinema Glass"],
    servers: [
      {
        id: "srv-edge-us",
        name: "Liquid CDN - US Edge (Ultra Low Latency)",
        location: "Silicon Valley, USA",
        ping: 18,
        badge: "RECOMMENDED",
        protocol: "MP4",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
      },
      {
        id: "srv-edge-eu",
        name: "Nebula HyperNode - Frankfurt",
        location: "Frankfurt, Germany",
        ping: 34,
        badge: "HIGH BITRATE",
        protocol: "MP4",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
      },
      {
        id: "srv-edge-asia",
        name: "CyberCore CDN - Tokyo 10Gbps",
        location: "Tokyo, Japan",
        ping: 62,
        badge: "4K DEDICATED",
        protocol: "MP4",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
      },
      {
        id: "srv-hls-test",
        name: "Adaptive HLS Akamai Stream",
        location: "Global Edge Anycast",
        ping: 25,
        badge: "AUTO ABR",
        protocol: "HLS",
        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
      }
    ]
  },
  {
    id: "cyber-live-esports",
    title: "AR Apex Championship 2026 - World Grand Finals",
    subtitle: "Neon Dragons vs Cyber Pulse &bull; Map 5 Decider",
    category: "Live Esports",
    description: "The championship decider of the AR Apex League. Broadcast in ultra-crisp 60fps with real-time biometric stats, telemetry overlays, and spatial audio feedback.",
    thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    backdropUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1920&q=80",
    isLive: true,
    viewCount: 482930,
    likesCount: 124500,
    qualityBadge: "1080P 60FPS",
    audioCodec: "Spatial Audio Pro",
    rating: "LIVE EVENT",
    duration: "LIVE",
    releaseYear: "2026",
    tags: ["Esports", "Live Broadcast", "Interactive DVR", "Multiview", "Direct CDN"],
    servers: [
      {
        id: "srv-live-1",
        name: "Akamai Multi-Bitrate Edge (Primary Live)",
        location: "Direct Live Broadcast",
        ping: 12,
        badge: "LIVE 60FPS",
        protocol: "HLS",
        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
      },
      {
        id: "srv-live-2",
        name: "Cloudflare Warp Stream - Backup CDN",
        location: "Anycast Edge",
        ping: 28,
        badge: "LOW LATENCY",
        protocol: "HLS",
        url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8"
      },
      {
        id: "srv-live-mp4",
        name: "Direct MP4 High Bitrate Stream",
        location: "Global CDN",
        ping: 21,
        badge: "MAX QUALITY",
        protocol: "MP4",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      }
    ]
  },
  {
    id: "sintel-chronicles",
    title: "Sintel: The Dragon's Awakening",
    subtitle: "Remastered in 4K HDR & Spatial Acoustics",
    category: "Fantasy / Animation",
    description: "A lonely young warrior girl searches across snowbound mountain peaks and hostile ruins for a baby dragon companion she saved, culminating in a poignant and breathtaking discovery.",
    thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
    backdropUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80",
    isLive: false,
    viewCount: 890400,
    likesCount: 65100,
    qualityBadge: "4K HDR",
    audioCodec: "Dolby Atmos 7.1",
    rating: "9.6 / 10",
    duration: "14:48",
    releaseYear: "2026",
    tags: ["4K HDR", "Fantasy", "Dolby Atmos", "Cinema Experience"],
    servers: [
      {
        id: "srv-sintel-1",
        name: "Liquid CDN - Primary 4K Master",
        location: "Global Edge",
        ping: 15,
        badge: "BEST QUALITY",
        protocol: "MP4",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
      },
      {
        id: "srv-sintel-2",
        name: "Fastly CDN - Europe High Speed",
        location: "Amsterdam, Netherlands",
        ping: 32,
        badge: "FAST",
        protocol: "MP4",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
      }
    ]
  },
  {
    id: "elephants-dream",
    title: "Cosmic Odyssey: Subatomic Architecture",
    subtitle: "Chapter 3 &bull; Infinite Horizon",
    category: "Sci-Fi / Documentary",
    description: "An awe-inspiring journey through the quantum architecture of neural networks, cyber-organic structures, and the infinite fractal topology of deep space.",
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    backdropUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1920&q=80",
    isLive: false,
    viewCount: 642000,
    likesCount: 42000,
    qualityBadge: "4K ULTRA HD",
    audioCodec: "Spatial Audio Pro",
    rating: "9.4 / 10",
    duration: "10:53",
    releaseYear: "2026",
    tags: ["Documentary", "Quantum", "4K 60FPS", "Visual Spectacle"],
    servers: [
      {
        id: "srv-elephants-1",
        name: "CyberCore CDN - US West Master",
        location: "Oregon, USA",
        ping: 22,
        badge: "PRIMARY",
        protocol: "MP4",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
      }
    ]
  }
];
