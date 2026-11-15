import type { ParsedFile, ParsedEdge } from "@/lib/parser/types";
import { classifyFile } from "@/lib/taxonomy";

export interface CycleFinding {
  chain: string[];
  members: string[];
}

export interface InsightFileItem {
  path: string;
  detail?: string | number;
}

export interface InsightCategory {
  id: "unimported" | "unusual-fan-in" | "cycles" | "oversized";
  title: string;
  sentence: string;
  count: number;
  files?: InsightFileItem[];
  cycles?: CycleFinding[];
}

export interface RepositoryInsights {
  unimported: InsightCategory;
  unusualFanIn: InsightCategory;
  cycles: InsightCategory;
  oversized: InsightCategory;
  all: InsightCategory[];
  totalFindings: number;
}

/**
 * Identifies whether a file is an entry point or framework convention reached
 * outside of static ES imports (e.g. Next.js App Router, Pages, routes, layouts,
 * middleware, and configuration files).
 *
 * Design decision: A file nothing imports is not automatically an orphan.
 * Pages, routes, layouts, middleware and config are reached by the framework runtime,
 * and the static import graph cannot show that. Reporting them as unimported would be
 * the parser describing the limits of its own view as a defect in the code.
 */
export function isFrameworkReached(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();

  // Category-based check
  const category = classifyFile(filePath);
  if (category.id === "routes" || category.id === "middleware" || category.id === "config") {
    return true;
  }

  // Next.js App/Pages Router conventions: page, route, layout, template, loading, error, not-found
  if (
    /(^|\/)(app|pages|routes|api)\/(.*\/)?(page|route|routes|layout|template|loading|error|not-found|global-error)\.[jt]sx?$/i.test(
      normalized
    ) ||
    /\.(page|route|routes|layout)\.[jt]sx?$/i.test(normalized)
  ) {
    return true;
  }

  // Middleware and server runtime boundaries
  if (
    /(^|\/)middleware\.[jt]sx?$/i.test(normalized) ||
    /(^|\/)(middlewares?|guards?|interceptors?)(\/|$)/i.test(normalized) ||
    /\.(middleware|guard)\.[jt]sx?$/i.test(normalized)
  ) {
    return true;
  }

  // Configuration files and compiler manifests
  if (
    /(^|\/)(configs?|configurations?)(\/|$)/i.test(normalized) ||
    /\.(config|configuration)\.[mc]?[jt]sx?$/i.test(normalized) ||
    /(^|\/)(next|vite|tailwind|postcss|webpack|rollup|eslint|prettier|jest|vitest|playwright|cypress|tsconfig)\.[mc]?[jt]sx?$/i.test(
      normalized
    ) ||
    /tsconfig(\..*)?\.json$/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

/**
 * Iterative cycle detection using Tarjan's Strongly Connected Components.
 *
 * Design decision: Must be strictly iterative using an explicit call stack array.
 * A real-world repository with deep dependency trees will blow the native runtime call stack
 * if written recursively.
 */
export function detectCyclesIterative(edges: ParsedEdge[]): CycleFinding[] {
  const adj = new Map<string, string[]>();

  for (const edge of edges) {
    if (!edge.isResolved) continue;
    const list = adj.get(edge.sourcePath);
    if (list) {
      list.push(edge.targetPath);
    } else {
      adj.set(edge.sourcePath, [edge.targetPath]);
    }
  }

  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const sccStack: string[] = [];
  const multiNodeSccs: string[][] = [];

  // Iterate over all nodes with outgoing edges
  for (const startNode of adj.keys()) {
    if (indices.has(startNode)) continue;

    // Explicit iterative stack frame: { node, neighborIdx }
    const callStack: Array<{ node: string; neighborIdx: number }> = [
      { node: startNode, neighborIdx: 0 },
    ];

    indices.set(startNode, index);
    lowlinks.set(startNode, index);
    index++;
    sccStack.push(startNode);
    onStack.add(startNode);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      const u = frame.node;
      const neighbors = adj.get(u) || [];

      if (frame.neighborIdx < neighbors.length) {
        const v = neighbors[frame.neighborIdx];
        frame.neighborIdx++;

        if (!indices.has(v)) {
          indices.set(v, index);
          lowlinks.set(v, index);
          index++;
          sccStack.push(v);
          onStack.add(v);
          callStack.push({ node: v, neighborIdx: 0 });
        } else if (onStack.has(v)) {
          lowlinks.set(u, Math.min(lowlinks.get(u)!, indices.get(v)!));
        }
      } else {
        // Post-order processing for node u
        callStack.pop();

        if (callStack.length > 0) {
          const parent = callStack[callStack.length - 1].node;
          lowlinks.set(
            parent,
            Math.min(lowlinks.get(parent)!, lowlinks.get(u)!)
          );
        }

        if (lowlinks.get(u) === indices.get(u)) {
          const component: string[] = [];
          let w: string;
          do {
            w = sccStack.pop()!;
            onStack.delete(w);
            component.push(w);
          } while (w !== u);

          if (component.length > 1) {
            multiNodeSccs.push(component);
          } else if (neighbors.includes(u)) {
            // Self-referencing loop
            multiNodeSccs.push([u]);
          }
        }
      }
    }
  }

  // Extract elementary cycle paths for each SCC
  const findings: CycleFinding[] = [];

  for (const scc of multiNodeSccs) {
    const sccSet = new Set(scc);
    // Sort to ensure deterministic starting node
    const sorted = [...scc].sort();
    const start = sorted[0];

    // Check if start has a direct self-loop
    const startNeighbors = adj.get(start) || [];
    if (startNeighbors.includes(start)) {
      findings.push({ chain: [start, start], members: sorted });
      continue;
    }

    // Reconstruct simple cycle from start back to start using BFS predecessor mapping within the SCC
    const queue: string[] = [start];
    const parent = new Map<string, string>();
    let closingNode: string | null = null;

    while (queue.length > 0) {
      const u = queue.shift()!;
      const neighbors = (adj.get(u) || []).filter((n) => sccSet.has(n));

      for (const v of neighbors) {
        if (v === start) {
          closingNode = u;
          break;
        }
        if (!parent.has(v)) {
          parent.set(v, u);
          queue.push(v);
        }
      }
      if (closingNode !== null) break;
    }

    if (closingNode !== null) {
      const segment: string[] = [];
      let curr = closingNode;
      while (curr !== start) {
        segment.push(curr);
        curr = parent.get(curr)!;
      }
      segment.reverse();
      findings.push({
        chain: [start, ...segment, start],
        members: sorted,
      });
    } else {
      findings.push({
        chain: [...sorted, sorted[0]],
        members: sorted,
      });
    }
  }

  // Deterministic sorting of detected cycles
  findings.sort((a, b) => a.chain[0].localeCompare(b.chain[0]));

  return findings;
}

/**
 * Computes the four categories of insights as pure mathematical facts over the edge list.
 *
 * Constraints:
 * 1. No model involved. Sentences are fixed strings.
 * 2. Unimported files lead the list; cycles and oversized go underneath.
 * 3. Framework entry points are excluded from the unimported list.
 */
export function computeInsights(
  files: ParsedFile[],
  edges: ParsedEdge[]
): RepositoryInsights {
  // 1. Files nothing imports (excluding framework conventions)
  const unimportedFiles = files
    .filter((f) => f.fanIn === 0 && !isFrameworkReached(f.path))
    .sort((a, b) => b.fanOut - a.fanOut || a.path.localeCompare(b.path))
    .map((f) => ({
      path: f.path,
      detail: f.fanOut > 0 ? `fanOut ${f.fanOut}` : "leaf",
    }));

  // 2. Files an unusual number of things import (statistical outlier detection)
  const fanIns = files.map((f) => f.fanIn);
  const totalFiles = files.length;
  const meanFanIn =
    totalFiles > 0 ? fanIns.reduce((sum, v) => sum + v, 0) / totalFiles : 0;
  const varianceFanIn =
    totalFiles > 0
      ? fanIns.reduce((sum, v) => sum + Math.pow(v - meanFanIn, 2), 0) /
        totalFiles
      : 0;
  const stdDevFanIn = Math.sqrt(varianceFanIn);
  // An unusual number is at least 2 standard deviations above mean, minimum 5
  const fanInThreshold = Math.max(5, Math.round(meanFanIn + 2 * stdDevFanIn));

  const unusualFanInFiles = files
    .filter((f) => f.fanIn >= fanInThreshold)
    .sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path))
    .map((f) => ({
      path: f.path,
      detail: `↓${f.fanIn}`,
    }));

  // 3. Import cycles (iterative detection)
  const cycles = detectCyclesIterative(edges);

  // 4. Files that are simply too long (standard single-file size threshold)
  // Statistical or practical ceiling of 1000 lines
  const lines = files.map((f) => f.lineCount);
  const meanLines =
    totalFiles > 0 ? lines.reduce((sum, v) => sum + v, 0) / totalFiles : 0;
  const varianceLines =
    totalFiles > 0
      ? lines.reduce((sum, v) => sum + Math.pow(v - meanLines, 2), 0) /
        totalFiles
      : 0;
  const stdDevLines = Math.sqrt(varianceLines);
  const lineThreshold = Math.max(
    800,
    Math.min(1000, Math.round(meanLines + 2 * stdDevLines))
  );

  const oversizedFiles = files
    .filter((f) => f.lineCount >= lineThreshold)
    .sort((a, b) => b.lineCount - a.lineCount || a.path.localeCompare(b.path))
    .map((f) => ({
      path: f.path,
      detail: `${f.lineCount.toLocaleString()} lines`,
    }));

  const unimportedCategory: InsightCategory = {
    id: "unimported",
    title: "Files nothing imports",
    sentence: "No other files in the repository import this file.",
    count: unimportedFiles.length,
    files: unimportedFiles,
  };

  const unusualFanInCategory: InsightCategory = {
    id: "unusual-fan-in",
    title: "Frequently imported modules",
    sentence: "An unusually high number of files import this module.",
    count: unusualFanInFiles.length,
    files: unusualFanInFiles,
  };

  const cyclesCategory: InsightCategory = {
    id: "cycles",
    title: "Import cycles",
    sentence: "Part of an import cycle with other files in the repository.",
    count: cycles.length,
    cycles,
  };

  const oversizedCategory: InsightCategory = {
    id: "oversized",
    title: "Oversized files",
    sentence: "File length significantly exceeds the standard size.",
    count: oversizedFiles.length,
    files: oversizedFiles,
  };

  // Spec order: files nothing imports leads the list; cycles and oversized go underneath
  const all: InsightCategory[] = [
    unimportedCategory,
    unusualFanInCategory,
    cyclesCategory,
    oversizedCategory,
  ];

  const totalFindings =
    unimportedCategory.count +
    unusualFanInCategory.count +
    cyclesCategory.count +
    oversizedCategory.count;

  return {
    unimported: unimportedCategory,
    unusualFanIn: unusualFanInCategory,
    cycles: cyclesCategory,
    oversized: oversizedCategory,
    all,
    totalFindings,
  };
}

