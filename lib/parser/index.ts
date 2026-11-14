import * as fs from "node:fs";
import * as path from "node:path";
import type {
  AnalysisResult,
  CoverageReport,
  ImportFailure,
  ImportStats,
  ParsedEdge,
  ParserOptions,
} from "./types";
import { walkRepository } from "./walker";
import { loadCompilerOptions, resolveModuleSpecifier } from "./resolver";
import { extractFileReferences } from "./ast";
import { computeFanInOut, extractDistinctFolders } from "./graph";
import { FallbackAdapter } from "./adapters/fallback";

export * from "./types";
export * from "./walker";
export * from "./resolver";
export * from "./ast";
export * from "./graph";
export * from "./adapters";

/**
 * Main parser entry point.
 * Reads a directory from disk and produces structured modules, edges, and coverage.
 *
 * Constraints:
 * - Standalone: does not import Next, React, or database clients.
 * - Framework agnostic: zero framework branching; adapters supply any framework semantics.
 * - Deterministic: all edges correspond to verified module resolution.
 */
export async function parseRepository(
  targetDir: string,
  options: ParserOptions = {}
): Promise<AnalysisResult> {
  const rootDir = path.resolve(targetDir);

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`Target path does not exist or is not a directory: ${targetDir}`);
  }

  // 1. Walk repository: categorize parseable code modules vs non-code files
  const { parseableFiles, skippedFiles, totalFound } = walkRepository(
    rootDir,
    options.ignoreDirectories
  );

  const knownInternalFiles = new Set(parseableFiles.map((f) => f.path));
  const compilerOptions = loadCompilerOptions(rootDir);

  const resolutionContext = {
    rootDir,
    compilerOptions,
    knownInternalFiles,
  };

  const edges: ParsedEdge[] = [];
  const failures: ImportFailure[] = [];

  const importStats: ImportStats = {
    totalImportsSeen: 0,
    resolvedInternal: 0,
    pointsOutside: 0,
    deliberatelyExcluded: 0,
    failed: 0,
    reExportsFound: 0,
    reExportsResolved: 0,
  };

  // 2. Parse each code file with AST and resolve imports
  for (const file of parseableFiles) {
    const fullPath = path.join(rootDir, file.path);
    const content = fs.readFileSync(fullPath, "utf-8");
    const references = extractFileReferences(file.path, content);

    for (const ref of references) {
      importStats.totalImportsSeen++;

      if (ref.kind === "re-export") {
        importStats.reExportsFound++;
      }

      if (!ref.isLiteral) {
        // Dynamic import with non-literal expression (e.g. import(varName))
        const reason = `Dynamic import with non-literal expression: ${ref.specifier}`;
        importStats.failed++;
        failures.push({
          sourcePath: file.path,
          specifier: ref.specifier,
          kind: ref.kind,
          reason,
        });
        edges.push({
          sourcePath: file.path,
          targetPath: ref.specifier,
          specifier: ref.specifier,
          kind: ref.kind,
          isResolved: false,
          unresolvedReason: reason,
        });
        continue;
      }

      const status = resolveModuleSpecifier(
        ref.specifier,
        file.path,
        resolutionContext
      );

      switch (status.type) {
        case "internal": {
          importStats.resolvedInternal++;
          if (ref.kind === "re-export") {
            importStats.reExportsResolved++;
          }
          edges.push({
            sourcePath: file.path,
            targetPath: status.targetPath,
            specifier: ref.specifier,
            kind: ref.kind,
            isResolved: true,
            unresolvedReason: null,
          });
          break;
        }

        case "outside": {
          importStats.pointsOutside++;
          break;
        }

        case "excluded": {
          importStats.deliberatelyExcluded++;
          break;
        }

        case "failed": {
          importStats.failed++;
          failures.push({
            sourcePath: file.path,
            specifier: ref.specifier,
            kind: ref.kind,
            reason: status.reason,
          });
          edges.push({
            sourcePath: file.path,
            targetPath: ref.specifier,
            specifier: ref.specifier,
            kind: ref.kind,
            isResolved: false,
            unresolvedReason: status.reason,
          });
          break;
        }
      }
    }
  }

  // 3. Graph metrics: compute fan-in and fan-out arithmetic over deduplicated edges
  const filesWithMetrics = computeFanInOut(parseableFiles, edges);
  const folders = extractDistinctFolders(filesWithMetrics);

  // 4. Group skip reasons
  const skipReasons: Record<string, string[]> = {};
  for (const skipped of skippedFiles) {
    if (!skipReasons[skipped.reason]) {
      skipReasons[skipped.reason] = [];
    }
    skipReasons[skipped.reason].push(skipped.path);
  }

  // 5. Framework adapter delegation (defaults to FallbackAdapter)
  const adapter = options.adapter ?? new FallbackAdapter();
  adapter.detect({ rootDir, files: filesWithMetrics });

  const coverage: CoverageReport = {
    filesFound: totalFound,
    filesParsed: filesWithMetrics.length,
    filesSkipped: skippedFiles.length,
    skipReasons,
    importStats,
    failures,
  };

  return {
    rootDir,
    files: filesWithMetrics,
    edges,
    folders,
    coverage,
  };
}

