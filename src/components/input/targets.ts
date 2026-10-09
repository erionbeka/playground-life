export const TARGET_SELECTOR = [
  "button:not([disabled])",
  '[role="button"]:not([disabled])',
  "a[href]",
  "[data-input-target]:not([data-input-ignore])",
].join(", ");

export interface RegionRegistration {
  name: string;
  priority: number;
  element: HTMLElement | null;
}

function isVisible(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden")) return false;
  const anyEl = el as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof anyEl.checkVisibility === "function") {
    try {
      return anyEl.checkVisibility();
    } catch {
      /* fall through to computed style */
    }
  }
  const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

export function isEligibleTarget(el: Element | null | undefined): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.matches("[data-input-ignore]")) return false;
  if (el.hasAttribute("disabled")) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return isVisible(el);
}

export function collectTargets(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(TARGET_SELECTOR)).filter(isEligibleTarget);
  return nodes.filter((el) => !nodes.some((other) => other !== el && el.contains(other)));
}

export function resolveActiveTargets(regions: RegionRegistration[]): HTMLElement[] {
  const withTargets = regions
    .map((region) => ({ region, targets: collectTargets(region.element) }))
    .filter((entry) => entry.targets.length > 0);
  const dialogs = withTargets.filter((entry) => entry.region.name === "dialog");
  const active = dialogs.length > 0 ? dialogs : withTargets.filter((entry) => entry.region.name !== "dialog");
  return active
    .slice()
    .sort((a, b) => b.region.priority - a.region.priority)
    .flatMap((entry) => entry.targets);
}
