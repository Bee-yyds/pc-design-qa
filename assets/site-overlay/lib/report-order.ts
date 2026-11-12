export type SortMode = "default" | "unrepaired";

type OrderedModule = { reviewOrder?: number; issues: { id: string }[] };
type RepairStates = Record<string, { repaired: boolean }>;

export function getOrderedModules<T extends OrderedModule>(modules: T[], mode: SortMode, states: RepairStates) {
  return modules.map((module, originalIndex) => ({ module, originalIndex })).sort((a, b) => {
    if (mode === "unrepaired") {
      const aOpen = a.module.issues.some((issue) => !states[issue.id]?.repaired);
      const bOpen = b.module.issues.some((issue) => !states[issue.id]?.repaired);
      if (aOpen !== bOpen) return Number(bOpen) - Number(aOpen);
    }
    const aOrder = Number.isSafeInteger(a.module.reviewOrder) && a.module.reviewOrder! > 0 ? a.module.reviewOrder! : a.originalIndex + 1;
    const bOrder = Number.isSafeInteger(b.module.reviewOrder) && b.module.reviewOrder! > 0 ? b.module.reviewOrder! : b.originalIndex + 1;
    return bOrder - aOrder || b.originalIndex - a.originalIndex;
  });
}

export function tabForHash(hash: string, batchKeys: string[]) {
  let key = "";
  try { key = decodeURIComponent(hash.replace(/^#/, "")); } catch { /* Invalid hashes use the first tab. */ }
  return batchKeys.includes(key) ? key : batchKeys[0];
}
