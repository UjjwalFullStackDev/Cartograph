import type { ParsedFile, ParsedEdge } from "../parser/types";
import { classifyFile } from "../taxonomy";
import type {
  FoldedFolderNode,
  FoldedNodeFile,
  GraphEdge,
  FoldedGraphResult,
} from "./types";

/**
 * Pure graph calculations for Cartograph.
 *
 * Rules from phase-04.md:
 * 1. Every directory starts as its own node.
 * 2. Working deepest-first, any directory holding fewer than `threshold` files merges into parent.
 * 3. Each pass is computed fresh from the original file list.
 * 4. Stop at lowest threshold landing under roughly two dozen nodes (~24).
 * 5. Shortest unique labels.
 * 6. Node height carries fan-in; width comes from label length.
 */

function getParentDir(dir: string): string | null {
  const normalized = dir.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  if (normalized === "." || normalized === "") return null;
  const parts = normalized.split("/");
  if (parts.length <= 1) return ".";
  parts.pop();
  return parts.join("/");
}

function getDirDepth(dir: string): number {
  const normalized = dir.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  if (normalized === "." || normalized === "") return 0;
  return normalized.split("/").length;
}

export function computeShortestUniqueLabels(
  dirPaths: string[]
): Map<string, string> {
  const result = new Map<string, string>();

  for (const dir of dirPaths) {
    const norm = dir.replace(/\\/g, "/").replace(/^\.\//, "").trim();
    if (norm === "." || norm === "") {
      result.set(dir, "root");
      continue;
    }

    const parts = norm.split("/");
    let uniqueLabel = norm;

    for (let len = 1; len <= parts.length; len++) {
      const candidate = parts.slice(-len).join("/");
      const candidateLower = candidate.toLowerCase();

      // Check against all other directories in this pass
      let collision = false;
      for (const other of dirPaths) {
        if (other === dir) continue;
        const otherNorm = other.replace(/\\/g, "/").replace(/^\.\//, "").trim();
        if (otherNorm === "." || otherNorm === "") continue;
        const otherParts = otherNorm.split("/");
        const otherCandidate = otherParts.slice(-len).join("/").toLowerCase();
        if (otherCandidate === candidateLower) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        uniqueLabel = candidate;
        break;
      }
    }

    result.set(dir, uniqueLabel);
  }

  return result;
}

export function foldGraph(
  files: ParsedFile[],
  edges: ParsedEdge[],
  targetNodeCount = 24
): FoldedGraphResult {
  // Step 1: Group files by their direct containing folder
  const initialDirFiles = new Map<string, ParsedFile[]>();
  for (const file of files) {
    const rawFolder = file.folder ? file.folder.replace(/\\/g, "/") : ".";
    const folder = rawFolder.replace(/^\.\//, "").trim() || ".";
    const existing = initialDirFiles.get(folder) || [];
    existing.push(file);
    initialDirFiles.set(folder, existing);
  }

  // Pre-collect all directory ancestors
  const allDirsSet = new Set<string>(initialDirFiles.keys());
  for (const dir of initialDirFiles.keys()) {
    let curr: string | null = dir;
    while (curr && curr !== ".") {
      curr = getParentDir(curr);
      if (curr) allDirsSet.add(curr);
    }
    allDirsSet.add(".");
  }

  // Group directory paths by depth descending
  const dirsByDepth = new Map<number, string[]>();
  for (const dir of allDirsSet) {
    const depth = getDirDepth(dir);
    const list = dirsByDepth.get(depth) || [];
    list.push(dir);
    dirsByDepth.set(depth, list);
  }

  const depths = Array.from(dirsByDepth.keys()).sort((a, b) => b - a);

  let bestThreshold = 2;
  let foldedDirsMap = new Map<string, ParsedFile[]>();

  // Pass-based threshold search: start at 2 and raise until under targetNodeCount
  for (let threshold = 2; threshold <= 100; threshold++) {
    // Each pass is computed fresh
    const current = new Map<string, ParsedFile[]>();
    for (const [dir, fileList] of initialDirFiles.entries()) {
      current.set(dir, [...fileList]);
    }

    // Deepest first
    for (const depth of depths) {
      if (depth === 0) continue; // Don't merge root into anything
      const dirsAtDepth = dirsByDepth.get(depth) || [];

      for (const dir of dirsAtDepth) {
        const dirFiles = current.get(dir) || [];
        if (dirFiles.length < threshold && dir !== ".") {
          const parent = getParentDir(dir) || ".";
          const parentFiles = current.get(parent) || [];
          current.set(parent, parentFiles.concat(dirFiles));
          current.delete(dir);
        }
      }
    }

    // Acceptance rule 2: Every node holds more than one file.
    // If root holds <= 1 file, merge root files into its largest child node
    const activeNodes = Array.from(current.entries()).filter(
      ([, fList]) => fList.length > 0
    );

    const rootFiles = current.get(".") || [];
    if (rootFiles.length === 1 && activeNodes.length > 1) {
      // Absorb root file into the largest active child node
      let largestChildDir = "";
      let maxCount = -1;
      for (const [d, fList] of activeNodes) {
        if (d !== "." && fList.length > maxCount) {
          maxCount = fList.length;
          largestChildDir = d;
        }
      }
      if (largestChildDir) {
        current.set(
          largestChildDir,
          (current.get(largestChildDir) || []).concat(rootFiles)
        );
        current.delete(".");
      }
    }

    const remainingCount = Array.from(current.entries()).filter(
      ([, fList]) => fList.length > 0
    ).length;

    bestThreshold = threshold;
    foldedDirsMap = current;

    if (remainingCount <= targetNodeCount) {
      break;
    }
  }

  // Filter down to non-empty folded nodes
  const activeEntries = Array.from(foldedDirsMap.entries()).filter(
    ([, fList]) => fList.length > 0
  );

  // Map each file path to its containing folder node id
  const fileToNodeId = new Map<string, string>();
  for (const [nodeId, fileList] of activeEntries) {
    for (const f of fileList) {
      fileToNodeId.set(f.path, nodeId);
    }
  }

  // Shortest unique labels for on-screen nodes
  const dirPaths = activeEntries.map(([dir]) => dir);
  const labelsMap = computeShortestUniqueLabels(dirPaths);

  // Compute folder-level fan-in and fan-out
  // Fan-in: count of unique external repository files that import files inside this folder
  // Fan-out: count of unique external repository files that this folder imports
  const folderFanInSet = new Map<string, Set<string>>();
  const folderFanOutSet = new Map<string, Set<string>>();

  for (const [nodeId] of activeEntries) {
    folderFanInSet.set(nodeId, new Set<string>());
    folderFanOutSet.set(nodeId, new Set<string>());
  }

  const resolvedEdges = edges.filter((e) => e.isResolved);
  const graphEdges: GraphEdge[] = [];

  for (let i = 0; i < resolvedEdges.length; i++) {
    const edge = resolvedEdges[i];
    const srcNode = fileToNodeId.get(edge.sourcePath);
    const tgtNode = fileToNodeId.get(edge.targetPath);

    if (srcNode && tgtNode) {
      if (srcNode !== tgtNode) {
        folderFanOutSet.get(srcNode)?.add(edge.targetPath);
        folderFanInSet.get(tgtNode)?.add(edge.sourcePath);
      }

      graphEdges.push({
        id: `e-${i}-${srcNode}-${tgtNode}`,
        sourceNodeId: srcNode,
        targetNodeId: tgtNode,
        sourceFilePath: edge.sourcePath,
        targetFilePath: edge.targetPath,
        specifier: edge.specifier,
        kind: edge.kind,
      });
    }
  }

  // Build final FoldedFolderNode objects
  const nodes: FoldedFolderNode[] = activeEntries.map(([nodeId, fileList]) => {
    const label = labelsMap.get(nodeId) || nodeId;
    const fanIn = folderFanInSet.get(nodeId)?.size || 0;
    const fanOut = folderFanOutSet.get(nodeId)?.size || 0;

    // Spec: A node's height carries how many things depend on it (fan-in).
    // Width comes from the label length so long names don't read as important.
    const height = Math.max(48, Math.min(160, 48 + Math.round(fanIn * 1.8)));
    const width = Math.max(160, Math.min(280, label.length * 9 + 48));

    const nodeFiles: FoldedNodeFile[] = fileList.map((f) => {
      const cat = classifyFile(f.path);
      const fileName = f.path.split("/").pop() || f.path;
      return {
        path: f.path,
        name: fileName,
        category: cat.name,
        color: cat.color,
        lineCount: f.lineCount,
        fanIn: f.fanIn,
        fanOut: f.fanOut,
      };
    });

    return {
      id: nodeId,
      label,
      fullPath: nodeId,
      files: nodeFiles,
      fileCount: nodeFiles.length,
      fanIn,
      fanOut,
      height,
      width,
      isOpen: false,
    };
  });

  // Sort nodes deterministically for consistent layout
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  return {
    nodes,
    edges: graphEdges,
    thresholdUsed: bestThreshold,
    nodeCount: nodes.length,
    fileCount: files.length,
    edgeCount: graphEdges.length,
  };
}

