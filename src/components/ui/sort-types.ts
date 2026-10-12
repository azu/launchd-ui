export type SortDirection = "asc" | "desc"

export type SortState<TKey extends string = string> = {
  key: TKey
  direction: SortDirection
}