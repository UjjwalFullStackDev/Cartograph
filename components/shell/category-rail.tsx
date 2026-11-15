"use client";

import React from "react";
import type { FileCategory } from "@/lib/taxonomy";

interface CategoryRailProps {
  categories: FileCategory[];
  totalFiles: number;
  activeCategoryId: string | null;
  onSelectCategory: (id: string) => void;
}

export function CategoryRail({
  categories,
  totalFiles,
  activeCategoryId,
  onSelectCategory,
}: CategoryRailProps) {
  return (
    <aside className="w-52 shrink-0 border-r border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40 flex flex-col justify-between overflow-hidden select-none">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="h-9 px-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold shrink-0">
          <span>Categories</span>
          <div className="flex items-center gap-1.5">
            {activeCategoryId && (
              <button
                type="button"
                onClick={() => onSelectCategory(activeCategoryId)}
                className="text-[9px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer lowercase"
                title="Clear category filter"
              >
                clear
              </button>
            )}
            <span className="text-[10px] text-zinc-400 font-normal tabular-nums">
              {totalFiles} files
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {categories.map((category) => {
            const isActive = activeCategoryId === category.id;
            const isAnyActive = activeCategoryId !== null;

            return (
              <button
                type="button"
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-mono transition-all cursor-pointer text-left ${
                  isActive
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 font-medium ring-1 ring-zinc-400/50 shadow-xs"
                    : isAnyActive
                      ? "text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-700 dark:hover:text-zinc-300"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
                title={`Filter by ${category.name} (${category.count} files)`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2 w-2 rounded-xs shrink-0 transition-transform ${
                      isActive ? "scale-125" : ""
                    }`}
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{category.name}</span>
                </div>
                <span
                  className={`text-[10px] tabular-nums font-mono ${
                    isActive
                      ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {category.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
