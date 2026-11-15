import * as fs from "node:fs";
import * as path from "node:path";
import { foldGraph } from "../lib/graph/folding";
import type { AnalysisResult } from "../lib/parser/types";

const dataPath = path.resolve("data/preview-analysis.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as AnalysisResult;
const result = foldGraph(data.files, data.edges);

console.log("=========================================");
console.log("     PHASE 4 ACCEPTANCE NUMBERS CHECK    ");
console.log("=========================================");
console.log(`1. Node count: ${result.nodeCount} (threshold: ${result.thresholdUsed})`);
console.log(`   Ratio: ${(data.files.length / result.nodeCount).toFixed(1)} files per node`);
const minFiles = Math.min(...result.nodes.map((n) => n.fileCount));
console.log(`2. Single-file nodes: ${result.nodes.filter((n) => n.fileCount <= 1).length} (min files per node: ${minFiles})`);

const nodeIds = new Set(result.nodes.map((n) => n.id));
let invalidEdges = 0;
for (const edge of result.edges) {
  if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
    invalidEdges++;
  }
}
console.log(`3. Dangling edges: ${invalidEdges} (total edges: ${result.edges.length})`);
console.log("=========================================");
console.log("Nodes sample:");
for (const n of result.nodes.slice(0, 10)) {
  console.log(`  [${n.label}] (${n.id}): ${n.fileCount} files, fanIn=${n.fanIn}, fanOut=${n.fanOut}, height=${n.height}px, width=${n.width}px`);
}
console.log("=========================================");

