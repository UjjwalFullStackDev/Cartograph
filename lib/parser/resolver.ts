import * as path from "node:path";
import * as fs from "node:fs";
import ts from "typescript";
import { normalizePath } from "./walker";

const ASSET_EXTENSIONS = new Set([
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".wasm",
  ".ttf",
  ".woff",
  ".woff2",
  ".eot",
  ".json",
]);

const NODE_BUILTIN_MODULES = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "stream/promises",
  "stream/consumers",
  "stream/web",
  "string_decoder",
  "timers",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

export interface ResolutionContext {
  rootDir: string;
  compilerOptions: ts.CompilerOptions;
  knownInternalFiles: Set<string>;
}

export type ResolutionStatus =
  | { type: "internal"; targetPath: string }
  | { type: "outside"; specifier: string }
  | { type: "excluded"; specifier: string; reason: string }
  | { type: "failed"; specifier: string; reason: string };

/**
 * Loads compiler options from tsconfig.json or jsconfig.json in the target repo.
 * Falls back to modern Bundler resolution if no config is found.
 */
export function loadCompilerOptions(rootDir: string): ts.CompilerOptions {
  const tsConfigPath = path.join(rootDir, "tsconfig.json");
  const jsConfigPath = path.join(rootDir, "jsconfig.json");

  let configPath: string | null = null;
  if (fs.existsSync(tsConfigPath)) {
    configPath = tsConfigPath;
  } else if (fs.existsSync(jsConfigPath)) {
    configPath = jsConfigPath;
  }

  if (configPath) {
    const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
    if (!readResult.error && readResult.config) {
      const parsed = ts.parseJsonConfigFileContent(
        readResult.config,
        ts.sys,
        rootDir
      );
      return parsed.options;
    }
  }

  return {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
  };
}

/**
 * Checks whether a module specifier matches path aliases configured in tsconfig.
 */
function matchesConfigPaths(specifier: string, paths?: ts.MapLike<string[]>): boolean {
  if (!paths) return false;
  for (const pattern of Object.keys(paths)) {
    if (pattern === specifier) return true;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (specifier === prefix || specifier.startsWith(prefix + "/")) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Type-safe extractor for TypeScript internal failedLookupLocations without casting.
 */
function extractFailedLookupLocations(resolution: unknown): string[] {
  if (
    typeof resolution === "object" &&
    resolution !== null &&
    "failedLookupLocations" in resolution &&
    Array.isArray(resolution.failedLookupLocations)
  ) {
    return resolution.failedLookupLocations.filter(
      (item): item is string => typeof item === "string"
    );
  }
  return [];
}

/**
 * Resolves a module specifier from a source file into one of four states:
 * 1. internal (resolved to a repo code module)
 * 2. outside (external npm package or node runtime built-in)
 * 3. excluded (deliberately skipped asset or non-code data file)
 * 4. failed (unresolvable internal reference with explicit diagnostics)
 */
export function resolveModuleSpecifier(
  specifier: string,
  sourceFilePath: string,
  context: ResolutionContext
): ResolutionStatus {
  // Built-in node packages (e.g. "fs", "node:crypto")
  if (specifier.startsWith("node:") || NODE_BUILTIN_MODULES.has(specifier)) {
    return { type: "outside", specifier };
  }

  // Non-code asset imports (e.g. "./globals.css", "@/assets/logo.svg")
  const ext = path.extname(specifier).toLowerCase();
  if (ASSET_EXTENSIONS.has(ext)) {
    return {
      type: "excluded",
      specifier,
      reason: `non-module asset import (${ext})`,
    };
  }

  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const isRootRelative = specifier.startsWith("/");
  const isAliased = matchesConfigPaths(specifier, context.compilerOptions.paths);

  const fullSourcePath = path.isAbsolute(sourceFilePath)
    ? sourceFilePath
    : path.join(context.rootDir, sourceFilePath);

  const resolution = ts.resolveModuleName(
    specifier,
    fullSourcePath,
    context.compilerOptions,
    ts.sys
  );

  const resolved = resolution.resolvedModule;

  if (resolved) {
    const resolvedPath = normalizePath(resolved.resolvedFileName);
    const relToRoot = normalizePath(path.relative(context.rootDir, resolvedPath));

    // If it resolved to node_modules, outside repository root, or marked external by TypeScript
    if (
      resolved.isExternalLibraryImport ||
      relToRoot.startsWith("node_modules/") ||
      relToRoot.includes("/node_modules/") ||
      relToRoot.startsWith("../") ||
      path.isAbsolute(relToRoot)
    ) {
      return { type: "outside", specifier };
    }

    // If it resolved to a known parseable code module
    if (context.knownInternalFiles.has(relToRoot)) {
      return { type: "internal", targetPath: relToRoot };
    }

    // Check if it's a declaration file inside the repo
    if (
      relToRoot.endsWith(".d.ts") ||
      relToRoot.endsWith(".d.mts") ||
      relToRoot.endsWith(".d.cts")
    ) {
      return {
        type: "excluded",
        specifier,
        reason: `resolved to type declaration file (${relToRoot})`,
      };
    }

    // Non-module asset or data file inside repo
    const resolvedExt = path.extname(relToRoot).toLowerCase();
    if (ASSET_EXTENSIONS.has(resolvedExt)) {
      return {
        type: "excluded",
        specifier,
        reason: `resolved to non-module file (${relToRoot})`,
      };
    }

    // If on disk within root but not in knownInternalFiles (e.g. non-code file or ignored dir)
    const absPath = path.resolve(context.rootDir, relToRoot);
    if (fs.existsSync(absPath)) {
      return {
        type: "excluded",
        specifier,
        reason: `resolved to excluded repository file (${relToRoot})`,
      };
    }
  }

  // Fallback: check manual direct resolution for extensionless or exact paths relative to source / root
  const containingDir = path.dirname(fullSourcePath);
  const directCandidate = isRootRelative
    ? path.resolve(context.rootDir, specifier.replace(/^\/+/, ""))
    : path.resolve(containingDir, specifier);

  for (const testExt of ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"]) {
    const probe = directCandidate + testExt;
    if (fs.existsSync(probe) && fs.statSync(probe).isFile()) {
      const relProbe = normalizePath(path.relative(context.rootDir, probe));
      if (
        !relProbe.startsWith("node_modules/") &&
        !relProbe.includes("/node_modules/") &&
        !relProbe.startsWith("../") &&
        !path.isAbsolute(relProbe)
      ) {
        if (context.knownInternalFiles.has(relProbe)) {
          return { type: "internal", targetPath: relProbe };
        }
        return {
          type: "excluded",
          specifier,
          reason: `resolved to excluded repository file (${relProbe})`,
        };
      }
    }
  }

  // If it's neither relative, root-relative, nor a tsconfig alias, it targets an external package
  if (!isRelative && !isRootRelative && !isAliased) {
    return { type: "outside", specifier };
  }

  // Failed resolution: construct helpful diagnostic message
  const failedLookups = extractFailedLookupLocations(resolution);
  const lookups = failedLookups.length > 0
    ? failedLookups.slice(0, 5).map((l) => normalizePath(path.relative(context.rootDir, l))).join(", ")
    : "no candidate paths found";

  return {
    type: "failed",
    specifier,
    reason: `Module not found: cannot resolve '${specifier}' from '${normalizePath(sourceFilePath)}'. Looked for: ${lookups}`,
  };
}
