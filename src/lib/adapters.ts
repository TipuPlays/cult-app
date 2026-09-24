/** Integration surfaces — swap mock → real without changing callers. */

export type PosOrder = {
  externalId: string;
  amountCents: number;
  merchant: string;
  purchasedAt: string;
  lineItems: { name: string; qty: number; amountCents: number }[];
};

export type OcrResult = {
  amountCents: number | null;
  merchant: string | null;
  purchasedAt: string | null;
  rawText: string;
  confidence: number;
};

export interface PosAdapter {
  lookupOrder(externalId: string): Promise<PosOrder | null>;
}

export interface OcrAdapter {
  parseReceipt(imageBytes: Uint8Array, mimeType: string): Promise<OcrResult>;
}

export interface NotifyAdapter {
  send(
    userId: string,
    template: string,
    data: Record<string, unknown>,
  ): Promise<void>;
}

export class MockPosAdapter implements PosAdapter {
  async lookupOrder(externalId: string): Promise<PosOrder | null> {
    if (!externalId.startsWith("CULT-")) return null;
    return {
      externalId,
      amountCents: 1250,
      merchant: "CULT Flagship",
      purchasedAt: new Date().toISOString(),
      lineItems: [
        { name: "Ceremonial Matcha", qty: 1, amountCents: 750 },
        { name: "Single Origin Espresso", qty: 1, amountCents: 500 },
      ],
    };
  }
}

export class MockOcrAdapter implements OcrAdapter {
  async parseReceipt(): Promise<OcrResult> {
    return {
      amountCents: 1250,
      merchant: "CULT",
      purchasedAt: new Date().toISOString(),
      rawText: "MOCK RECEIPT\nCULT\nTOTAL 12.50",
      confidence: 0.82,
    };
  }
}

export class ConsoleNotifyAdapter implements NotifyAdapter {
  async send(
    userId: string,
    template: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    console.info("[notify:mock]", { userId, template, data });
  }
}

export const posAdapter: PosAdapter = new MockPosAdapter();
export const ocrAdapter: OcrAdapter = new MockOcrAdapter();
export const notifyAdapter: NotifyAdapter = new ConsoleNotifyAdapter();

/** Simple fraud heuristic for Phase 1. */
export function scoreReceiptFraud(input: {
  amountCents: number | null;
  contentHash: string | null;
  duplicateHashToday: boolean;
  confidence: number;
  sameDaySameAmount?: boolean;
}): number {
  let score = 0;
  if (input.amountCents == null) score += 30;
  if ((input.amountCents ?? 0) > 20000) score += 25;
  if (input.duplicateHashToday) score += 40;
  if (input.sameDaySameAmount) score += 25;
  if (input.confidence < 0.5) score += 20;
  return Math.min(100, score);
}
