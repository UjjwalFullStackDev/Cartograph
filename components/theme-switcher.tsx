"use client";

import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "cartograph_theme";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" || (theme === "system" && getSystemPrefersDark());

  if (isDark) {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
}

function subscribeTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", callback);
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMediaChange = () => {
    const current = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
    if (current === "system") {
      applyTheme("system");
      callback();
    }
  };

  mediaQuery.addEventListener("change", handleMediaChange);
  return () => {
    window.removeEventListener("storage", callback);
    mediaQuery.removeEventListener("change", handleMediaChange);
  };
}

function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
}

function getThemeServerSnapshot(): Theme {
  return "system";
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  const selectTheme = (nextTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    // Dispatch storage event so all subscribers update
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div
      role="group"
      aria-label="Theme switcher"
      className="flex h-7 items-center rounded border border-zinc-200 bg-zinc-100 p-0.5 text-[11px] font-mono text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
    >
      <button
        type="button"
        onClick={() => selectTheme("system")}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          theme === "system"
            ? "bg-white font-medium text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
            : "hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
        title="Follow system appearance"
      >
        auto
      </button>
      <button
        type="button"
        onClick={() => selectTheme("light")}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          theme === "light"
            ? "bg-white font-medium text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
            : "hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
        title="Force light appearance"
      >
        light
      </button>
      <button
        type="button"
        onClick={() => selectTheme("dark")}
        className={`rounded px-1.5 py-0.5 transition-colors ${
          theme === "dark"
            ? "bg-white font-medium text-zinc-950 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
            : "hover:text-zinc-900 dark:hover:text-zinc-200"
        }`}
        title="Force dark appearance"
      >
        dark
      </button>
    </div>
  );
}
