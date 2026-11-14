import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { ParsedFile, SkippedFile } from "./types";

export const DEFAULT_IGNORED_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "out",
];

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

export interface WalkResult {
  parseableFiles: ParsedFile[];
  skippedFiles: SkippedFile[];
  totalFound: number;
}

/**
 * Normalizes relative paths to forward-slash POSIX representation.
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Categorizes why a non-module file was skipped so that every skipped file
 * is fully accounted for without silent omission.
 */
export function classifySkipReason(filePath: string): string {
  const normalized = normalizePath(filePath);
  const base = path.basename(normalized);
  const ext = path.extname(normalized).toLowerCase();

  if (normalized.endsWith(".d.ts") || normalized.endsWith(".d.mts") || normalized.endsWith(".d.cts")) {
    return "type declaration file (.d.ts)";
  }

  if (base.endsWith(".min.js") || base.endsWith(".min.mjs") || base.endsWith(".min.cjs")) {
    return "minified bundle (*.min.js)";
  }

  if (base.startsWith(".env") || ext === ".local") {
    return "environment configuration file";
  }

  if (base === ".gitignore" || base === ".npmignore" || base === ".editorconfig" || base === ".prettierignore") {
    return `project config dotfile (${base})`;
  }

  switch (ext) {
    case ".md":
    case ".markdown":
    case ".mdx":
      return `documentation (${ext})`;
    case ".json":
      return "data file (.json)";
    case ".yaml":
    case ".yml":
      return `configuration (${ext})`;
    case ".svg":
      return "vector asset (.svg)";
    case ".ico":
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".webp":
      return `image asset (${ext})`;
    case ".css":
    case ".scss":
    case ".sass":
    case ".less":
      return `stylesheet asset (${ext})`;
    case ".sql":
      return "database script (.sql)";
    case ".tsbuildinfo":
      return "typescript build cache (.tsbuildinfo)";
    default:
      return ext ? `unsupported file extension (${ext})` : `non-source file (${base})`;
  }
}

/**
 * Recursively walks the repository filesystem, structurally selecting code modules
 * while logging precise skip reasons for all non-code files.
 */
export function walkRepository(
  rootDir: string,
  ignoredDirectories: string[] = DEFAULT_IGNORED_DIRECTORIES
): WalkResult {
  const ignoredSet = new Set(ignoredDirectories);
  const parseableFiles: ParsedFile[] = [];
  const skippedFiles: SkippedFile[] = [];

  function traverse(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignoredSet.has(entry.name)) {
          continue;
        }
        traverse(path.join(currentDir, entry.name));
      } else if (entry.isFile()) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = normalizePath(path.relative(rootDir, fullPath));
        const ext = path.extname(entry.name).toLowerCase();

        const isDeclaration =
          entry.name.endsWith(".d.ts") ||
          entry.name.endsWith(".d.mts") ||
          entry.name.endsWith(".d.cts");

        if (CODE_EXTENSIONS.has(ext) && !isDeclaration) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lineCount = content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length;
          const hash = crypto.createHash("sha256").update(content).digest("hex");
          const folder = normalizePath(path.dirname(relPath));

          parseableFiles.push({
            path: relPath,
            folder,
            lineCount,
            hash,
            fanIn: 0,
            fanOut: 0,
          });
        } else {
          skippedFiles.push({
            path: relPath,
            reason: classifySkipReason(relPath),
          });
        }
      }
    }
  }

  traverse(rootDir);

  return {
    parseableFiles,
    skippedFiles,
    totalFound: parseableFiles.length + skippedFiles.length,
  };
}

