import type { ParsedEdge } from "@/lib/parser/types";

export interface TransitiveWalkItem {
  path: string;
  depth: number;
}

export interface TransitiveWalkResult {
  items: TransitiveWalkItem[];
  totalCount: number;
}

/**
 * Transitive walk over the edge list with a direction argument and a depth limit.
 *
 * Design decision: Blast radius ("everything that breaks if this file changes",
 * following incoming edges) and Dependency chain ("everything this file needs",
 * following outgoing edges) are the same transitive BFS walk written once.
 * The depth limit defaults to 2 to avoid returning most of the repository.
 *
 * Graph calculation rule: Pure function over an edge list, runnable in any environment.
 */
export function computeTransitiveWalk(
  startFilePath: string,
  edges: ParsedEdge[],
  direction: "dependents" | "dependencies",
  maxDepth: number = 2
): TransitiveWalkResult {
  // Build adjacency list for resolved internal edges
  const adj = new Map<string, string[]>();

  for (const edge of edges) {
    if (!edge.isResolved) continue;

    // For dependents (blast radius): edge.targetPath is depended upon by edge.sourcePath
    // For dependencies (chain): edge.sourcePath depends upon edge.targetPath
    const from = direction === "dependents" ? edge.targetPath : edge.sourcePath;
    const to = direction === "dependents" ? edge.sourcePath : edge.targetPath;

    const list = adj.get(from);
    if (list) {
      list.push(to);
    } else {
      adj.set(from, [to]);
    }
  }

  // BFS with shortest depth tracking
  const visitedDepth = new Map<string, number>();
  visitedDepth.set(startFilePath, 0);

  const queue: Array<{ path: string; depth: number }> = [
    { path: startFilePath, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current.depth >= maxDepth) continue;

    const neighbors = adj.get(current.path) || [];
    for (const next of neighbors) {
      if (!visitedDepth.has(next)) {
        visitedDepth.set(next, current.depth + 1);
        queue.push({ path: next, depth: current.depth + 1 });
      }
    }
  }

  const items: TransitiveWalkItem[] = [];
  for (const [path, depth] of visitedDepth.entries()) {
    if (path !== startFilePath) {
      items.push({ path, depth });
    }
  }

  // Deterministic order: nearest depth first, then alphabetical by path
  items.sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));

  return {
    items,
    totalCount: items.length,
  };
}

