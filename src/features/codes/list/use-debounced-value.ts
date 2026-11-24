"use client";

import { useEffect, useState } from "react";

/** `value`, once it has stopped changing for `delay` ms (typing in a search box). */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return settled;
}
