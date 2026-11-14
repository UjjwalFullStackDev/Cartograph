import type { ParsedFile, ParsedEdge } from "./types";

/**
 * Pure function: calculates fan-in and fan-out metrics over file nodes and resolved edges.
 *
 * Design rule:
 * Fan-in and fan-out are computed after duplicate references between the same source
 * and target files are collapsed. Multiple imports or re-exports between file A and file B
 * represent one directed structural dependency.
 */
export function computeFanInOut(
  files: readonly ParsedFile[],
  edges: readonly ParsedEdge[]
): ParsedFile[] {
  // Set of unique directed file-to-file pairs: "sourcePath -> targetPath"
  const uniquePairs = new Set<string>();
  const fanInCounts = new Map<string, number>();
  const fanOutCounts = new Map<string, number>();

  for (const edge of edges) {
    if (!edge.isResolved) continue;
    // Don't count self-referential cycles as external fan-in/fan-out
    if (edge.sourcePath === edge.targetPath) continue;

    const pairKey = `${edge.sourcePath} -> ${edge.targetPath}`;
    if (!uniquePairs.has(pairKey)) {
      uniquePairs.add(pairKey);

      fanOutCounts.set(edge.sourcePath, (fanOutCounts.get(edge.sourcePath) ?? 0) + 1);
      fanInCounts.set(edge.targetPath, (fanInCounts.get(edge.targetPath) ?? 0) + 1);
    }
  }

  return files.map((file) => ({
    ...file,
    fanIn: fanInCounts.get(file.path) ?? 0,
    fanOut: fanOutCounts.get(file.path) ?? 0,
  }));
}

/**
 * Pure function: extracts the set of distinct folders from parsed files.
 */
export function extractDistinctFolders(files: readonly ParsedFile[]): string[] {
  const folders = new Set<string>();
  for (const file of files) {
    folders.add(file.folder);
  }
  return Array.from(folders).sort();
}

