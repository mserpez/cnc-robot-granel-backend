export interface PrepareOrderItem {
  hopperId: string;
  weightGrams: number;
}

export interface PrepareOrderJobPayload {
  orderId: string;
  productId: string;
  hopperId: string;
  weightGrams: number;
}
