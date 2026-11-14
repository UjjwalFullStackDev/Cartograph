import * as fs from "node:fs";
import * as path from "node:path";
import { parseRepository } from "./index";
import type { AnalysisResult } from "./types";

/**
 * Command-line runner for the Cartograph repository parser.
 */
export async function runCli(args: string[]): Promise<AnalysisResult> {
  let targetDir = ".";
  let outputPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      outputPath = args[++i];
    } else if (!arg.startsWith("-")) {
      targetDir = arg;
    }
  }

  const result = await parseRepository(targetDir);

  const { coverage, files, edges, folders } = result;
  const { filesFound, filesParsed, filesSkipped, skipReasons, importStats, failures } = coverage;

  console.log("\n=======================================================");
  console.log("             CARTOGRAPH PARSER REPORT                  ");
  console.log("=======================================================");
  console.log(`Repository:      ${path.resolve(targetDir)}`);
  console.log(`Files found:     ${filesFound}`);
  console.log(`Files parsed:    ${filesParsed} (${files.length} active node modules)`);
  console.log(`Files skipped:   ${filesSkipped}`);
  console.log(`Sum verified:    ${filesParsed + filesSkipped === filesFound ? "YES (parsed + skipped = found)" : "MISMATCH"}`);
  console.log(`Distinct folders: ${folders.length}`);
  console.log(`Internal edges:  ${edges.filter((e) => e.isResolved).length}`);
  console.log("-------------------------------------------------------");
  console.log("Skip reasons:");
  for (const [reason, paths] of Object.entries(skipReasons)) {
    console.log(`  - ${reason}: ${paths.length} file(s)`);
  }
  console.log("-------------------------------------------------------");
  console.log("Import Coverage:");
  console.log(`  Total imports seen:    ${importStats.totalImportsSeen}`);
  console.log(`  Resolved internal:     ${importStats.resolvedInternal}`);
  console.log(`  Points outside (npm):  ${importStats.pointsOutside}`);
  console.log(`  Deliberately excluded: ${importStats.deliberatelyExcluded}`);
  console.log(`  Failed / Unresolved:   ${importStats.failed}`);
  console.log("-------------------------------------------------------");
  console.log("Re-exports:");
  console.log(`  Re-exports found:      ${importStats.reExportsFound}`);
  console.log(`  Re-exports resolved:   ${importStats.reExportsResolved}`);
  console.log(`  Re-export gap:         ${importStats.reExportsFound - importStats.reExportsResolved}`);
  console.log("-------------------------------------------------------");

  if (failures.length > 0) {
    console.log("Failures / Unresolved Imports:");
    for (const f of failures) {
      console.log(`  [${f.kind}] ${f.sourcePath} -> '${f.specifier}'`);
      console.log(`    Reason: ${f.reason}`);
    }
    console.log("-------------------------------------------------------");
  }

  if (outputPath) {
    const fullOutputPath = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });
    const serialized = JSON.stringify(result, null, 2);
    fs.writeFileSync(fullOutputPath, serialized, "utf-8");
    console.log(`Wrote parsed output contract to: ${fullOutputPath}`);

    // Verify types hold on read-back
    const readBackRaw = fs.readFileSync(fullOutputPath, "utf-8");
    const readBack = JSON.parse(readBackRaw) as AnalysisResult;
    if (
      !Array.isArray(readBack.files) ||
      !Array.isArray(readBack.edges) ||
      !readBack.coverage ||
      typeof readBack.coverage.filesFound !== "number"
    ) {
      throw new Error("Serialized output failed type contract validation on read-back.");
    }
    console.log("Verified type contract on read-back: SUCCESS");
  }

  return result;
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("lib/parser/cli.ts")) {
  runCli(process.argv.slice(2)).catch((err) => {
    console.error("Parser failed:", err);
    process.exit(1);
  });
}
