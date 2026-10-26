export type CategoryOption = { id: string; name: string; parentId: string | null };

/** Renders categories with subcategories indented under their parent. */
export function CategoryOptions({ categories }: { categories: CategoryOption[] }) {
  const roots = categories.filter((c) => !c.parentId);
  return (
    <>
      {roots.map((r) => [
        <option key={r.id} value={r.id}>
          {r.name}
        </option>,
        ...categories
          .filter((c) => c.parentId === r.id)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {"   "}
              {c.name}
            </option>
          )),
      ])}
    </>
  );
}
