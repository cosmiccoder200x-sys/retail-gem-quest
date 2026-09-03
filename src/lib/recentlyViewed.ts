import { useEffect, useState, useCallback } from "react";

const KEY = "recently_viewed";
const MAX = 8;

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    // ignore
  }
}

export function useRecentlyViewed(productId?: string) {
  const [ids, setIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return readIds();
  });

  useEffect(() => {
    if (!productId) return;
    const current = readIds();
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, MAX);
    if (next.join(",") !== current.join(",")) {
      writeIds(next);
      setIds(next);
    }
  }, [productId]);

  const clear = useCallback(() => {
    writeIds([]);
    setIds([]);
  }, []);

  return { ids, clear };
}

export function getRecentlyViewedIds(excludeId?: string): string[] {
  const ids = readIds();
  return excludeId ? ids.filter((id) => id !== excludeId) : ids;
}
