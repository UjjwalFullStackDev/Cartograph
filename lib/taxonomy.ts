/**
 * Rail taxonomy and file category classifier.
 *
 * Design decision: The taxonomy is decoupled from framework adapters and the parser
 * so client components can inspect categories and render swatches without pulling
 * AST parsing or filesystem dependencies into the client bundle.
 */

export interface FileCategory {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface CategoryDefinition {
  id: string;
  name: string;
  color: string;
  order: number;
  matcher: (normalizedPath: string) => boolean;
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "routes",
    name: "Routes",
    color: "#3b82f6", // Blue
    order: 1,
    matcher: (p) =>
      /(^|\/)(routes?|api|pages?)(\/|$)/i.test(p) ||
      /\.(route|routes|page)\.[jt]sx?$/i.test(p),
  },
  {
    id: "controllers",
    name: "Controllers",
    color: "#8b5cf6", // Violet
    order: 2,
    matcher: (p) =>
      /(^|\/)(controllers?|handlers?)(\/|$)/i.test(p) ||
      /\.(controller|handler)\.[jt]sx?$/i.test(p),
  },
  {
    id: "services",
    name: "Services",
    color: "#06b6d4", // Cyan
    order: 3,
    matcher: (p) =>
      /(^|\/)(services?)(\/|$)/i.test(p) ||
      /\.service\.[jt]sx?$/i.test(p),
  },
  {
    id: "models",
    name: "Models",
    color: "#10b981", // Emerald
    order: 4,
    matcher: (p) =>
      /(^|\/)(models?|schemas?|entities?)(\/|$)/i.test(p) ||
      /\.(model|schema|entity)\.[jt]sx?$/i.test(p),
  },
  {
    id: "components",
    name: "Components",
    color: "#ec4899", // Pink
    order: 5,
    matcher: (p) =>
      /(^|\/)(components?|views?|ui)(\/|$)/i.test(p) ||
      /\.(component|view)\.[jt]sx?$/i.test(p),
  },
  {
    id: "middleware",
    name: "Middleware",
    color: "#f59e0b", // Amber
    order: 6,
    matcher: (p) =>
      /(^|\/)(middlewares?|guards?|interceptors?)(\/|$)/i.test(p) ||
      /\.(middleware|guard)\.[jt]sx?$/i.test(p),
  },
  {
    id: "utilities",
    name: "Utilities",
    color: "#6366f1", // Indigo
    order: 7,
    matcher: (p) =>
      /(^|\/)(utils?|helpers?|lib)(\/|$)/i.test(p) ||
      /\.(util|helper)\.[jt]sx?$/i.test(p),
  },
  {
    id: "config",
    name: "Config",
    color: "#f97316", // Orange
    order: 8,
    matcher: (p) =>
      /(^|\/)(configs?|configurations?)(\/|$)/i.test(p) ||
      /\.(config|configuration)\.[jt]sx?$/i.test(p),
  },
];

const FALLBACK_CATEGORY = {
  id: "modules",
  name: "Modules",
  color: "#71717a", // Zinc
  order: 9,
};

export function classifyFile(filePath: string): { id: string; name: string; color: string } {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  for (const def of CATEGORY_DEFINITIONS) {
    if (def.matcher(normalized)) {
      return { id: def.id, name: def.name, color: def.color };
    }
  }
  return {
    id: FALLBACK_CATEGORY.id,
    name: FALLBACK_CATEGORY.name,
    color: FALLBACK_CATEGORY.color,
  };
}

export function isUnidentifiedByConvention(filePath: string): boolean {
  return classifyFile(filePath).id === FALLBACK_CATEGORY.id;
}

export function extractCategories(files: { path: string }[]): FileCategory[] {
  const counts: Record<string, number> = {};

  for (const file of files) {
    const category = classifyFile(file.path);
    counts[category.id] = (counts[category.id] || 0) + 1;
  }

  const result: FileCategory[] = [];

  for (const def of CATEGORY_DEFINITIONS) {
    const count = counts[def.id] || 0;
    if (count > 0) {
      result.push({
        id: def.id,
        name: def.name,
        color: def.color,
        count,
      });
    }
  }

  const fallbackCount = counts[FALLBACK_CATEGORY.id] || 0;
  if (fallbackCount > 0) {
    result.push({
      id: FALLBACK_CATEGORY.id,
      name: FALLBACK_CATEGORY.name,
      color: FALLBACK_CATEGORY.color,
      count: fallbackCount,
    });
  }

  return result;
}

