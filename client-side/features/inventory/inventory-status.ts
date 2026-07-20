export type InventoryStatus = "healthy" | "low" | "out" | "archived";
export type InventoryFilter =
  | "active"
  | "attention"
  | "healthy"
  | "low"
  | "out"
  | "archived"
  | "all";
export type InventorySort = "name-asc" | "stock-asc" | "stock-desc";

type StockState = Readonly<{
  isActive: boolean;
  stock: number;
  threshold: number;
}>;

export function inventoryStatus(state: StockState): InventoryStatus {
  if (!state.isActive) return "archived";
  if (state.stock === 0) return "out";
  if (state.stock <= state.threshold) return "low";
  return "healthy";
}

export function matchesInventoryFilter(
  state: StockState,
  filter: InventoryFilter,
): boolean {
  const status = inventoryStatus(state);

  if (filter === "all") return true;
  if (filter === "active") return status !== "archived";
  if (filter === "attention") return status === "low" || status === "out";
  return status === filter;
}

export function normalizeInventoryQuery(query: {
  q?: string;
  status?: string;
  sort?: string;
}): { q: string; status: InventoryFilter; sort: InventorySort } {
  const filters: readonly InventoryFilter[] = [
    "active",
    "attention",
    "healthy",
    "low",
    "out",
    "archived",
    "all",
  ];
  const sorts: readonly InventorySort[] = [
    "name-asc",
    "stock-asc",
    "stock-desc",
  ];

  return {
    q: query.q?.trim() ?? "",
    status: filters.includes(query.status as InventoryFilter)
      ? (query.status as InventoryFilter)
      : "active",
    sort: sorts.includes(query.sort as InventorySort)
      ? (query.sort as InventorySort)
      : "name-asc",
  };
}
