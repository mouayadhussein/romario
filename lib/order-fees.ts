export type FeeInput = {
  orderType: "delivery" | "pickup" | "dine_in";
  subtotal: number;
  deliveryFee: number;
  minOrderAmount: number;
  freeDeliveryThreshold: number | null;
};

export type FeeResult = {
  subtotal: number;
  deliveryFee: number;
  total: number;
  freeDeliveryApplied: boolean;
  minOrderOk: boolean;
  minOrderShortfall: number;
};

/**
 * Server-side fee calculation. Delivery fee only for delivery orders.
 * Free delivery when subtotal >= threshold (if threshold set).
 */
export function calculateOrderFees(input: FeeInput): FeeResult {
  const subtotal = roundMoney(Math.max(0, input.subtotal));
  const configuredFee = roundMoney(Math.max(0, input.deliveryFee));
  const minOrder = roundMoney(Math.max(0, input.minOrderAmount));
  const threshold =
    input.freeDeliveryThreshold == null
      ? null
      : roundMoney(Math.max(0, input.freeDeliveryThreshold));

  let deliveryFee = 0;
  let freeDeliveryApplied = false;

  if (input.orderType === "delivery") {
    if (threshold != null && subtotal >= threshold) {
      deliveryFee = 0;
      freeDeliveryApplied = configuredFee > 0;
    } else {
      deliveryFee = configuredFee;
    }
  }

  const minOrderOk = subtotal >= minOrder;
  const minOrderShortfall = minOrderOk ? 0 : roundMoney(minOrder - subtotal);

  return {
    subtotal,
    deliveryFee,
    total: roundMoney(subtotal + deliveryFee),
    freeDeliveryApplied,
    minOrderOk,
    minOrderShortfall,
  };
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
