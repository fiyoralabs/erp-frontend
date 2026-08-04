// Generic parent/child hierarchy helpers, shared by every Master Data
// entity that has a self-referencing parent field (Location.parentId,
// Category.parentCategoryId, and potentially others later). Extracted out
// of the first implementation (Locations) once Categories needed the exact
// same tree-build / filter / expand-all logic, just against a differently
// named parent field.

// Self-referential: TreeNode<T> already carries T's own fields, and its
// `children` are themselves full TreeNode<T>s (not just the bare
// `{children}` shape) -- getting this wrong makes every recursive access
// past the first level (node.children[0].code, etc.) fail to type-check.
export type TreeNode<T> = T & { children: TreeNode<T>[] };

export function buildTree<T extends { id: number }>(
  items: T[],
  getParentId: (item: T) => number | null,
  sortFn?: (a: T, b: T) => number
): TreeNode<T>[] {
  const byId = new Map<number, TreeNode<T>>();
  items.forEach((item) => byId.set(item.id, { ...item, children: [] }));

  const roots: TreeNode<T>[] = [];
  byId.forEach((node) => {
    const parentId = getParentId(node);
    const parent = parentId != null ? byId.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      // Also covers a parent id pointing outside the current set (e.g.
      // excluded by a filter, or a data integrity edge case) -- treat as a
      // root rather than silently dropping the node.
      roots.push(node);
    }
  });

  const sortRecursive = (nodes: TreeNode<T>[]) => {
    if (sortFn) nodes.sort(sortFn);
    nodes.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);
  return roots;
}

export function collectAllIds<T extends { id: number }>(nodes: TreeNode<T>[]): number[] {
  return nodes.flatMap((n) => [n.id, ...collectAllIds(n.children)]);
}

export type PrunedNode<T> = T & { children: PrunedNode<T>[]; selfMatches: boolean };

// Keeps a node if it matches the active filters itself, OR if any
// descendant matches -- so filtering doesn't orphan a matching child by
// hiding its non-matching parent.
export function filterTree<T extends { id: number }>(
  nodes: TreeNode<T>[],
  matches: (item: T) => boolean
): PrunedNode<T>[] {
  const result: PrunedNode<T>[] = [];
  for (const node of nodes) {
    const filteredChildren = filterTree(node.children, matches);
    const selfMatches = matches(node);
    if (selfMatches || filteredChildren.length > 0) {
      result.push({ ...node, children: filteredChildren, selfMatches });
    }
  }
  return result;
}

// Ids of a node and every one of its descendants -- used to stop a node
// from being re-parented under itself or one of its own children.
export function collectDescendantIds<T extends { id: number }>(
  items: T[],
  getParentId: (item: T) => number | null,
  rootId: number
): Set<number> {
  const excluded = new Set<number>([rootId]);
  const collect = (parentId: number) => {
    items
      .filter((item) => getParentId(item) === parentId)
      .forEach((child) => {
        excluded.add(child.id);
        collect(child.id);
      });
  };
  collect(rootId);
  return excluded;
}
