import type {
  FrameworkAdapter,
  AdapterContext,
  FileRole,
  DiscoveredRoute,
  ParsedFile,
} from "../types";

/**
 * Express framework adapter.
 * Detects conventional Express project structures with routes and controllers.
 */
export class ExpressAdapter implements FrameworkAdapter {
  readonly name = "Express";

  detect(context: AdapterContext): boolean {
    const hasRoutes = context.files.some((f) =>
      /(^|\/)routes?(\/|$)/i.test(f.path)
    );
    const hasControllers = context.files.some((f) =>
      /(^|\/)controllers?(\/|$)/i.test(f.path)
    );
    return hasRoutes && hasControllers;
  }

  identifyRole(file: ParsedFile): FileRole | null {
    if (/(^|\/)routes?(\/|$)/i.test(file.path)) {
      return { role: "route", confidence: 0.9 };
    }
    if (/(^|\/)controllers?(\/|$)/i.test(file.path)) {
      return { role: "controller", confidence: 0.9 };
    }
    return null;
  }

  extractRoutes(): DiscoveredRoute[] {
    return [];
  }
}

