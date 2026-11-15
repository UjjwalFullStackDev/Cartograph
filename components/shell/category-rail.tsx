import type { FileCategory } from "@/lib/taxonomy";

interface CategoryRailProps {
  categories: FileCategory[];
  totalFiles: number;
}

export function CategoryRail({ categories, totalFiles }: CategoryRailProps) {
  return (
    <aside className="w-52 shrink-0 border-r border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40 flex flex-col justify-between overflow-hidden select-none">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="h-9 px-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold shrink-0">
          <span>Categories</span>
          <span className="text-[10px] text-zinc-400 font-normal tabular-nums">
            {totalFiles} files
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between px-2 py-1 rounded text-[11px] font-mono text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-xs shrink-0"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{category.name}</span>
              </div>
              <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500 font-mono">
                {category.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

