const COMPACT_LABEL_MAX_ITEMS = 3;

export function shortName(description: string): string {
  const first = description.split(",")[0]?.trim();
  return first ? first : "Item";
}

export function summarizeItems(
  items: { description: string }[],
  max = COMPACT_LABEL_MAX_ITEMS,
): { names: string[]; extra: number } {
  const names: string[] = [];
  const shown = new Set<string>();
  for (const item of items) {
    const name = shortName(item.description);
    const key = name.toLowerCase();
    if (shown.size >= max) break;
    if (!shown.has(key)) {
      shown.add(key);
      names.push(name);
    }
  }
  const extra = items.filter(
    (item) => !shown.has(shortName(item.description).toLowerCase()),
  ).length;
  return { names, extra };
}

const lowerFirst = (text: string) =>
  /\p{Lu}/u.test(text.slice(1)) ? text : text.charAt(0).toLowerCase() + text.slice(1);

export function headlineText(items: { description: string }[]): string {
  const { names, extra } = summarizeItems(items);
  const spoken = names.map((name, index) => (index === 0 ? name : lowerFirst(name)));
  if (extra > 0) return `${spoken.join(", ")} e mais ${extra}`;
  if (spoken.length <= 1) return spoken.join("");
  return `${spoken.slice(0, -1).join(", ")} e ${spoken[spoken.length - 1]}`;
}

export function drawerLabel(count: number): string {
  return count <= COMPACT_LABEL_MAX_ITEMS ? "Entendi isto" : `Entendi ${count} itens`;
}

export type DrawerView = { name: "compact" } | { name: "adjust" } | { name: "item"; index: number };

export type DrawerViewAction =
  | { type: "adjust" }
  | { type: "back" }
  | { type: "edit_item"; index: number }
  | { type: "done_item" };

export function drawerViewReducer(view: DrawerView, action: DrawerViewAction): DrawerView {
  switch (action.type) {
    case "adjust":
      return { name: "adjust" };
    case "edit_item":
      return { name: "item", index: action.index };
    case "done_item":
      return { name: "adjust" };
    case "back":
      return view.name === "adjust"
        ? { name: "compact" }
        : view.name === "item"
          ? { name: "adjust" }
          : view;
  }
}
