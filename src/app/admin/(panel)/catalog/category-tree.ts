import { textOf, type Schemas } from "@/lib/api/types";

export type Category = Schemas["CategoryResponse"];
export type CategoryNode = Category & { children: CategoryNode[]; depth: number };

export function categoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }

  const build = (parentId: string | null, depth: number): CategoryNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
      .map((c) => ({ ...c, depth, children: build(c.id, depth + 1) }));

  return build(null, 0);
}

export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

export function categoryOptions(categories: Category[]) {
  return flattenTree(categoryTree(categories)).map((c) => ({ value: c.id, label: `${"— ".repeat(c.depth)}${textOf(c.name)}` }));
}
