const PREFIX = "debbo:ignored-orders:";

export function loadIgnoredOrderIds(userId: string): Set<string> {
  try {
    if (typeof window === "undefined") return new Set();
    const raw = window.localStorage.getItem(PREFIX + userId);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function saveIgnoredOrderIds(userId: string, ids: Set<string>): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFIX + userId, JSON.stringify([...ids]));
  } catch {
    // private mode / quota — ignore
  }
}

export function ignoreOrderId(userId: string, orderId: string): Set<string> {
  const next = loadIgnoredOrderIds(userId);
  next.add(orderId);
  saveIgnoredOrderIds(userId, next);
  return next;
}
