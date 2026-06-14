import type { TargetId } from "@/types/db";
import { gasAdapter } from "./gas-adapter";
import type { DeploymentTarget } from "./types";

export * from "./types";
export * from "./router";
export { gasAdapter };

/**
 * Target registry. Only 'gas' is implemented — 'web-supabase' / 'static-web' are designed in
 * docs/WEB-TARGET.md but deferred (YAGNI, BUILDPLAN §J.6). Register a new adapter here to add a
 * target; nothing else in core needs to change.
 */
const REGISTRY: Partial<Record<TargetId, DeploymentTarget>> = {
  gas: gasAdapter,
};

/** Resolve a target adapter. Throws for a target that is documented but not built yet. */
export function getTarget(id: string): DeploymentTarget {
  const target = REGISTRY[id as TargetId];
  if (!target) throw new Error(`unsupported_target:${id}`);
  return target;
}

export function isTargetImplemented(id: string): boolean {
  return Boolean(REGISTRY[id as TargetId]);
}

export function listTargets(): DeploymentTarget[] {
  return Object.values(REGISTRY).filter(Boolean) as DeploymentTarget[];
}
