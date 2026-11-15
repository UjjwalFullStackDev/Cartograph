import type { AdapterContext, FrameworkAdapter } from "../types";
import { NextJsAdapter } from "./nextjs";
import { ExpressAdapter } from "./express";

export { FallbackAdapter } from "./fallback";
export { NextJsAdapter } from "./nextjs";
export { ExpressAdapter } from "./express";

export const KNOWN_ADAPTERS: FrameworkAdapter[] = [
  new NextJsAdapter(),
  new ExpressAdapter(),
];

/**
 * Pure adapter detector: iterates through known adapters to determine if
 * repository structure matches a supported framework convention.
 * Returns the detected framework name or "None" if only fallback applies.
 */
export function detectFramework(context: AdapterContext): string {
  for (const adapter of KNOWN_ADAPTERS) {
    if (adapter.detect(context)) {
      return adapter.name;
    }
  }
  return "None";
}
