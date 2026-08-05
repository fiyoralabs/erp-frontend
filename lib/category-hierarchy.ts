import type { Category } from "@/lib/types/master";

export type HierarchicalCategory = {
  category: Category;
  depth: number;
  label: string;
};

export function categoryHierarchy(categories: Category[]): HierarchicalCategory[] {
  const active = categories.filter((category) => category.isActive);
  const byId = new Map(active.map((category) => [category.id, category]));
  const children = new Map<number | null, Category[]>();

  for (const category of active) {
    const parentId = category.parentCategoryId != null && byId.has(category.parentCategoryId)
      ? category.parentCategoryId
      : null;
    children.set(parentId, [...(children.get(parentId) ?? []), category]);
  }

  const sort = (rows: Category[]) => rows.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  const result: HierarchicalCategory[] = [];
  const seen = new Set<number>();
  const visit = (category: Category, path: string[], depth: number) => {
    if (seen.has(category.id)) return;
    seen.add(category.id);
    const nextPath = [...path, category.name];
    const indentation = "\u00a0\u00a0\u00a0\u00a0".repeat(depth);
    result.push({ category, depth, label: depth === 0 ? category.name : `${indentation}↳ ${category.name}` });
    for (const child of sort([...(children.get(category.id) ?? [])])) visit(child, nextPath, depth + 1);
  };

  for (const root of sort([...(children.get(null) ?? [])])) visit(root, [], 0);
  for (const orphan of sort(active.filter((category) => !seen.has(category.id)))) visit(orphan, [], 0);
  return result;
}

export function categoryAndDescendantIds(categories: Category[], selectedId: number): number[] {
  const active = categories.filter((category) => category.isActive);
  const ids = new Set<number>([selectedId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of active) {
      if (category.parentCategoryId != null && ids.has(category.parentCategoryId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return [...ids];
}
