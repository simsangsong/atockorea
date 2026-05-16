/**
 * URL-based cart state for the itinerary builder.
 *
 * Cart is encoded in the `pois` query param as a comma-separated list of
 * `poi_key` values, in user-chosen order. Keeping state in the URL means
 * itineraries are share-able (D5 2026-05-16: no auth, URL params carry state).
 *
 * Example: `/itinerary-builder/busan?pois=haedong_yonggungsa,jagalchi_market&date=2026-05-20&party=4`
 */

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const CART_QUERY_PARAM = "pois";

export function parseCart(searchParams: URLSearchParams | null): string[] {
  if (!searchParams) return [];
  const raw = searchParams.get(CART_QUERY_PARAM) || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function serializeCart(cart: string[], base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base);
  if (cart.length === 0) next.delete(CART_QUERY_PARAM);
  else next.set(CART_QUERY_PARAM, cart.join(","));
  return next;
}

/**
 * Client hook: read + mutate the cart via URL params.
 * - `cart`: ordered array of poi_keys
 * - `add(key)` / `remove(key)` / `reorder(nextOrder)` / `clear()`
 * - mutations use `router.replace({ scroll: false })` so the page doesn't jump
 */
export function useCart() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const cart = useMemo(() => parseCart(searchParams), [searchParams]);

  const pushUrl = useCallback(
    (next: string[]) => {
      const sp = serializeCart(next, searchParams ?? new URLSearchParams());
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const add = useCallback(
    (key: string) => {
      if (cart.includes(key)) return;
      pushUrl([...cart, key]);
    },
    [cart, pushUrl]
  );

  const remove = useCallback(
    (key: string) => {
      pushUrl(cart.filter((k) => k !== key));
    },
    [cart, pushUrl]
  );

  const reorder = useCallback(
    (next: string[]) => {
      pushUrl(next);
    },
    [pushUrl]
  );

  const clear = useCallback(() => {
    pushUrl([]);
  }, [pushUrl]);

  return { cart, add, remove, reorder, clear, has: (k: string) => cart.includes(k) };
}
