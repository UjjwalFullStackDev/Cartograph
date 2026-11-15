import * as fs from "node:fs";
import * as path from "node:path";
import type { AnalysisResult } from "../lib/parser/types";
import { computeTransitiveWalk } from "../lib/graph/traversal";
import { computeInsights } from "../lib/graph/insights";
import { extractCategories, classifyFile } from "../lib/taxonomy";
import { foldGraph } from "../lib/graph/folding";

const dataPath = path.resolve("data/preview-analysis.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as AnalysisResult;

console.log("=========================================");
console.log("       PHASE 6 VERIFICATION CHECKS       ");
console.log("=========================================");

// 1. Transitive Walk Check
console.log("\n--- 1. Blast Radius & Dependency Chain ---");
const testFile = "src/stock/middlewares/auth.middleware.js";
const blast = computeTransitiveWalk(testFile, data.edges, "dependents", 2);
const chain = computeTransitiveWalk(testFile, data.edges, "dependencies", 2);
console.log(`File: ${testFile}`);
console.log(`Blast radius (2 levels): ${blast.totalCount} files affected`);
console.log(`Sample blast entries:`);
blast.items.slice(0, 3).forEach((item) => {
  console.log(`  - [hop ${item.depth}] ${item.path}`);
});
console.log(`Dependency chain (2 levels): ${chain.totalCount} files needed`);

// 2. Insights Check
console.log("\n--- 2. Repository Insights ---");
const insights = computeInsights(data.files, data.edges);
console.log(`Total findings: ${insights.totalFindings}`);

console.log(`\n(1) ${insights.unimported.title} (Count: ${insights.unimported.count})`);
console.log(`    Sentence: "${insights.unimported.sentence}"`);
const sampleUnimported = insights.unimported.files?.slice(0, 3).map((f) => f.path);
console.log(`    Sample entries:`, sampleUnimported);

// Verify that routes/pages with 0 fan-in are NOT in unimported
const zeroFanInRoutes = data.files.filter(
  (f) => f.fanIn === 0 && classifyFile(f.path).id === "routes"
);
const falsePositives = zeroFanInRoutes.filter((r) =>
  insights.unimported.files?.some((f) => f.path === r.path)
);
console.log(
  `    Routes with 0 fan-in properly excluded: ${zeroFanInRoutes.length - falsePositives.length}/${zeroFanInRoutes.length}`
);
if (falsePositives.length > 0) {
  console.error("    ERROR: Found routes incorrectly included in unimported:", falsePositives);
}

console.log(`\n(2) ${insights.unusualFanIn.title} (Count: ${insights.unusualFanIn.count})`);
console.log(`    Sentence: "${insights.unusualFanIn.sentence}"`);
insights.unusualFanIn.files?.slice(0, 3).forEach((f) => {
  console.log(`    - ${f.path} (${f.detail})`);
});

console.log(`\n(3) ${insights.cycles.title} (Count: ${insights.cycles.count})`);
console.log(`    Sentence: "${insights.cycles.sentence}"`);
insights.cycles.cycles?.forEach((c, idx) => {
  console.log(`    Cycle #${idx + 1}: ${c.chain.join(" -> ")}`);
});

console.log(`\n(4) ${insights.oversized.title} (Count: ${insights.oversized.count})`);
console.log(`    Sentence: "${insights.oversized.sentence}"`);
insights.oversized.files?.slice(0, 3).forEach((f) => {
  console.log(`    - ${f.path} (${f.detail})`);
});

// 3. Category Match Sum Check
console.log("\n--- 3. Category Rail & Panel Match Counts ---");
const folded = foldGraph(data.files, data.edges);
const categories = extractCategories(data.files);

let allMatched = true;
for (const cat of categories) {
  let panelSum = 0;
  for (const node of folded.nodes) {
    const nodeMatches = node.files.filter(
      (f) => classifyFile(f.path).id === cat.id
    ).length;
    panelSum += nodeMatches;
  }
  const ok = panelSum === cat.count;
  if (!ok) allMatched = false;
  console.log(
    `Category: ${cat.name.padEnd(12)} | Rail: ${String(cat.count).padStart(3)} | Panels Sum: ${String(panelSum).padStart(3)} | Match: ${ok}`
  );
}
console.log(`\nAll panel match counts sum precisely to rail numbers: ${allMatched}`);
console.log("=========================================\n");

