import type {
  FrameworkAdapter,
  FileRole,
  DiscoveredRoute,
} from "../types";

/**
 * Fallback adapter when no specific framework is detected or configured.
 * Assumes pure TypeScript/JavaScript with no framework-inferred routes or roles.
 */
export class FallbackAdapter implements FrameworkAdapter {
  readonly name = "fallback";

  detect(): boolean {
    return true;
  }

  identifyRole(): FileRole | null {
    return null;
  }

  extractRoutes(): DiscoveredRoute[] {
    return [];
  }
}
