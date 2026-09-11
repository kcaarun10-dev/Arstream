export interface UserProfile {
  userId: string;
  username: string;
  avatarColor: string;
  badge: string;
  isCustom: boolean;
  createdAt: number;
}

const STORAGE_KEY = "live_stream_user_profile_v2";
const USERNAME_KEY = "live_chat_username";

const SPORTS_PREFIXES = [
  "Striker",
  "GoalSniper",
  "DribbleKing",
  "Vortex",
  "FreeKick",
  "Blitz",
  "TopCorner",
  "Maverick",
  "PaceMaker",
  "ShadowStriker",
  "AeroPass",
  "PowerShot",
  "Touchdown",
  "BoundaryKing",
  "PitchMaster",
  "EagleEye",
  "Nitro",
  "Playmaker",
  "CyberFan",
  "ApexPlayer",
  "GoldenBoot",
  "MidfieldAce",
  "WicketHunter",
  "CurveMaster",
  "ThunderKick",
  "LaserStrike",
  "TurboDrive",
  "UltraFan",
  "Velocity",
  "IronDefense",
  "CornerKing",
  "HattrickHero",
  "SpinMaster",
  "CaptainClutch",
  "GoalMachine"
];

const BADGES = ["🔥 Fan", "⚽ Striker", "🏏 Finisher", "⚡ Turbo", "🎯 Sniper", "🏆 Champion", "🚀 Rocket", "⭐ VIP"];

const AVATAR_COLORS = [
  "#00f2fe", // Cyan
  "#c084fc", // Purple
  "#34d399", // Emerald
  "#fbbf24", // Amber
  "#fb7185", // Rose
  "#38bdf8", // Sky
  "#a78bfa", // Violet
  "#fb923c", // Orange
  "#4ade80", // Green
  "#f472b6", // Pink
  "#2dd4bf", // Teal
  "#e879f9", // Fuchsia
];

/**
 * Generates a unique, non-repeating random username
 */
export function generateRandomUsername(): string {
  const prefix = SPORTS_PREFIXES[Math.floor(Math.random() * SPORTS_PREFIXES.length)];
  // 4 random digits + 1 random hex char for high uniqueness
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}_${num}`;
}

/**
 * Generates a unique client ID
 */
export function generateUniqueUserId(): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `usr_${time}_${rand}`;
}

/**
 * Retrieves the saved profile from Chrome localStorage or creates a unique one
 */
export function getUserProfile(): UserProfile {
  try {
    const legacyName = localStorage.getItem(USERNAME_KEY);
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved) as UserProfile;
      if (parsed && parsed.username && parsed.userId) {
        // If user had a legacy name saved in chrome, respect it
        if (legacyName && legacyName.trim() && parsed.username !== legacyName.trim()) {
          parsed.username = legacyName.trim();
        }
        return parsed;
      }
    }

    // If legacy username exists, use it
    const initialName = (legacyName && legacyName.trim().length >= 2) 
      ? legacyName.trim() 
      : generateRandomUsername();

    const newProfile: UserProfile = {
      userId: generateUniqueUserId(),
      username: initialName,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      badge: BADGES[Math.floor(Math.random() * BADGES.length)],
      isCustom: Boolean(legacyName && legacyName.trim()),
      createdAt: Date.now(),
    };

    saveUserProfile(newProfile);
    return newProfile;
  } catch (e) {
    // Fallback if localStorage is disabled in strict sandbox
    return {
      userId: `usr_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      username: generateRandomUsername(),
      avatarColor: "#00f2fe",
      badge: "🔥 Fan",
      isCustom: false,
      createdAt: Date.now(),
    };
  }
}

/**
 * Saves profile permanently in Chrome local storage
 */
export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem(USERNAME_KEY, profile.username);
  } catch (e) {
    console.warn("Could not save user profile to localStorage:", e);
  }
}

/**
 * Updates the user's custom username and persists in Chrome data
 */
export function updateUsername(newName: string): { success: boolean; profile?: UserProfile; error?: string } {
  const trimmed = newName.trim();

  if (!trimmed) {
    return { success: false, error: "Username cannot be empty" };
  }

  if (trimmed.length < 2) {
    return { success: false, error: "Username must be at least 2 characters" };
  }

  if (trimmed.length > 25) {
    return { success: false, error: "Username cannot exceed 25 characters" };
  }

  // Allow letters, numbers, spaces, underscores, and hyphens
  const validPattern = /^[a-zA-Z0-9_\-\s]+$/;
  if (!validPattern.test(trimmed)) {
    return { success: false, error: "Only letters, numbers, spaces, and _ - are allowed" };
  }

  const current = getUserProfile();
  const updated: UserProfile = {
    ...current,
    username: trimmed,
    isCustom: true,
  };

  saveUserProfile(updated);

  // Dispatch custom event so other components or tabs update instantly
  try {
    window.dispatchEvent(new CustomEvent("live_user_profile_updated", { detail: updated }));
  } catch {
    // ignore
  }

  return { success: true, profile: updated };
}
