import { useState, useEffect } from "react";

const STORAGE_KEY = "ar_stream_saved_watchlist";

export function getWatchlistIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleWatchlistId(id: string): boolean {
  try {
    const current = getWatchlistIds();
    let updated: string[];
    let added = false;
    if (current.includes(id)) {
      updated = current.filter(item => item !== id);
      added = false;
    } else {
      updated = [...current, id];
      added = true;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("watchlist-updated"));
    return added;
  } catch {
    return false;
  }
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(getWatchlistIds);

  useEffect(() => {
    const handleUpdate = () => {
      setWatchlist(getWatchlistIds());
    };
    window.addEventListener("watchlist-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("watchlist-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const toggle = (id: string) => {
    return toggleWatchlistId(id);
  };

  const isSaved = (id: string) => watchlist.includes(id);

  return { watchlist, toggle, isSaved };
}
