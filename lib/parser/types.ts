/**
 * Core type definitions for the Cartograph repository parser.
 *
 * Design decision: The parser produces an immutable data contract describing
 * the repository's modules, edges, and coverage. Later phases, including database
 * persistence and visual layout, consume this exact shape without re-inspecting files.
 */

export type ImportKind = "import" | "re-export" | "dynamic-import";

export interface ParsedFile {
  /** Relative posix path from repository root, e.g. "app/page.tsx" */
  path: string;
  /** Relative posix directory path containing the file, e.g. "app" or "." for root */
  folder: string;
  /** Total number of lines in the source file */
  lineCount: number;
  /** Cryptographic content hash (SHA-256 hex digest) */
  hash: string;
  /** Number of unique repository files that import or re-export this file */
  fanIn: number;
  /** Number of unique repository files that this file imports or re-exports */
  fanOut: number;
}

export interface ParsedEdge {
  /** Relative path of the source file containing the import/re-export */
  sourcePath: string;
  /** Resolved relative path of the target file, or raw specifier if unresolved */
  targetPath: string;
  /** Literal module specifier written in the source code */
  specifier: string;
  /** Syntax mechanism that created this edge */
  kind: ImportKind;
  /** True when successfully resolved to a concrete file within the repository */
  isResolved: boolean;
  /** Explanation when resolution fails; null when resolved */
  unresolvedReason: string | null;
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface ImportFailure {
  sourcePath: string;
  specifier: string;
  kind: ImportKind;
  reason: string;
}

export interface ImportStats {
  totalImportsSeen: number;
  resolvedInternal: number;
  pointsOutside: number;
  deliberatelyExcluded: number;
  failed: number;
  reExportsFound: number;
  reExportsResolved: number;
}

export interface CoverageReport {
  filesFound: number;
  filesParsed: number;
  filesSkipped: number;
  /** Grouped list of skipped paths keyed by reason */
  skipReasons: Record<string, string[]>;
  importStats: ImportStats;
  /** Concrete examples of failed imports with full diagnostic context */
  failures: ImportFailure[];
}

export interface DiscoveredRoute {
  method: string;
  pattern: string;
}

export interface FileRole {
  role: string;
  confidence: number;
}

export interface AdapterContext {
  rootDir: string;
  files: ParsedFile[];
}

/**
 * Adapter interface separating framework-specific semantics from syntax parsing.
 * The parser contains zero framework branching; adapters provide framework roles/routes.
 */
export interface FrameworkAdapter {
  readonly name: string;
  detect(context: AdapterContext): boolean;
  identifyRole(file: ParsedFile, context: AdapterContext): FileRole | null;
  extractRoutes(file: ParsedFile, context: AdapterContext): DiscoveredRoute[];
}

export interface AnalysisResult {
  rootDir: string;
  files: ParsedFile[];
  edges: ParsedEdge[];
  /** Distinct folder paths present in the repository */
  folders: string[];
  coverage: CoverageReport;
}

export interface ParserOptions {
  /** Optional custom framework adapter; defaults to FallbackAdapter */
  adapter?: FrameworkAdapter;
  /** Additional directories to ignore besides default build/vcs artifacts */
  ignoreDirectories?: string[];
}

