import { useState, useMemo, useEffect } from "react";

export function useListState<T>(
  items: T[],
  filterFn: (item: T, query: string) => boolean,
  pageSize = 25
) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => items.filter((item) => filterFn(item, query)),
    [items, query, filterFn]
  );
  
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { 
    setPage(1); 
  }, [query]);

  return { query, setQuery, page, setPage, filtered, paginated, totalPages };
}
