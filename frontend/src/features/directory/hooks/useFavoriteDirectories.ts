import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "rocket-session:favorite-dirs";

interface FavoriteDirectory {
  path: string;
  name: string;
}

function extractName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

function loadFavorites(): FavoriteDirectory[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useFavoriteDirectories() {
  const [favorites, setFavorites] =
    useState<FavoriteDirectory[]>(loadFavorites);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const isFavorite = useCallback(
    (path: string) => favorites.some((f) => f.path === path),
    [favorites],
  );

  const addFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.path === path)) return prev;
      return [...prev, { path, name: extractName(path) }];
    });
  }, []);

  const removeFavorite = useCallback((path: string) => {
    setFavorites((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.path === path)) {
        return prev.filter((f) => f.path !== path);
      }
      return [...prev, { path, name: extractName(path) }];
    });
  }, []);

  return { favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite };
}
