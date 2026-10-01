"use client";

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
  imageUrl?: string | null;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (
    item: Omit<CartItem, "quantity" | "note"> & {
      quantity?: number;
      note?: string;
    }
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateNote: (itemId: string, note: string) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: CartItem[] = [];

const cache = new Map<string, { raw: string | null; items: CartItem[] }>();

function storageKey(branchSlug: string) {
  return `cart:${branchSlug}`;
}

function readCart(branchSlug: string): CartItem[] {
  if (typeof window === "undefined") return EMPTY_CART;
  const key = storageKey(branchSlug);
  const raw = localStorage.getItem(key);
  const cached = cache.get(branchSlug);
  if (cached && cached.raw === raw) return cached.items;

  let items: CartItem[] = EMPTY_CART;
  if (raw) {
    try {
      items = JSON.parse(raw) as CartItem[];
    } catch {
      items = EMPTY_CART;
    }
  }
  cache.set(branchSlug, { raw, items });
  return items;
}

function writeCart(branchSlug: string, items: CartItem[]) {
  const key = storageKey(branchSlug);
  const raw = JSON.stringify(items);
  localStorage.setItem(key, raw);
  cache.set(branchSlug, { raw, items });
  window.dispatchEvent(new Event(`cart-change:${branchSlug}`));
}

function subscribeCart(branchSlug: string, onStoreChange: () => void) {
  const handler = () => onStoreChange();
  const key = `cart-change:${branchSlug}`;
  window.addEventListener(key, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(key, handler);
    window.removeEventListener("storage", handler);
  };
}

export function CartProvider({
  branchSlug,
  children,
}: {
  branchSlug: string;
  children: ReactNode;
}) {
  const items = useSyncExternalStore(
    (onStoreChange) => subscribeCart(branchSlug, onStoreChange),
    () => readCart(branchSlug),
    () => EMPTY_CART
  );

  const setItems = useCallback(
    (updater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
      const prev = readCart(branchSlug);
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCart(branchSlug, next);
    },
    [branchSlug]
  );

  const addItem = useCallback(
    (
      item: Omit<CartItem, "quantity" | "note"> & {
        quantity?: number;
        note?: string;
      }
    ) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.itemId === item.itemId);
        if (existing) {
          return prev.map((i) =>
            i.itemId === item.itemId
              ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
              : i
          );
        }
        return [
          ...prev,
          {
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            quantity: item.quantity ?? 1,
            note: item.note ?? "",
          },
        ];
      });
    },
    [setItems]
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setItems((prev) => prev.filter((i) => i.itemId !== itemId));
    },
    [setItems]
  );

  const updateQuantity = useCallback(
    (itemId: string, quantity: number) => {
      setItems((prev) => {
        if (quantity <= 0) return prev.filter((i) => i.itemId !== itemId);
        return prev.map((i) => (i.itemId === itemId ? { ...i, quantity } : i));
      });
    },
    [setItems]
  );

  const updateNote = useCallback(
    (itemId: string, note: string) => {
      setItems((prev) =>
        prev.map((i) => (i.itemId === itemId ? { ...i, note } : i))
      );
    },
    [setItems]
  );

  const clearCart = useCallback(() => setItems([]), [setItems]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items]
  );

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      updateNote,
      clearCart,
      total,
      count,
    }),
    [items, addItem, removeItem, updateQuantity, updateNote, clearCart, total, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
