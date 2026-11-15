import type {
  FrameworkAdapter,
  AdapterContext,
  FileRole,
  DiscoveredRoute,
  ParsedFile,
} from "../types";

/**
 * Next.js framework adapter.
 * Detects App Router and Pages Router project structures.
 */
export class NextJsAdapter implements FrameworkAdapter {
  readonly name = "Next.js";

  detect(context: AdapterContext): boolean {
    return context.files.some(
      (f) =>
        /(^|\/)(app|pages)\/.*(page|route|layout)\.[jt]sx?$/i.test(f.path) ||
        /^next\.config\.[mc]?[jt]s$/i.test(f.path)
    );
  }

  identifyRole(file: ParsedFile): FileRole | null {
    if (/(^|\/)(app|pages)\/.*(page|route)\.[jt]sx?$/i.test(file.path)) {
      return { role: "route", confidence: 1.0 };
    }
    return null;
  }

  extractRoutes(): DiscoveredRoute[] {
    return [];
  }
}

