import { describe, it, expect } from "vitest";
import {
  extractReceiptWithGemini,
  sanitizeAndEnrichReceiptData,
  generateFallbackOcrResult,
  type ExtractedReceiptData,
} from "./gemini-ocr";

describe("Gemini Multimodal OCR Service", () => {
  it("fails honestly with an explicit error when no live API key is configured", async () => {
    const dummyBuffer = Buffer.from("fake image bytes");
    const result = await extractReceiptWithGemini(dummyBuffer, "image/png", "");

    expect(result.success).toBe(false);
    expect(result.error).toBe("GEMINI_API_KEY is not configured");
    expect(result.data).toBeUndefined();
  });

  it("fails honestly when placeholder API key is provided", async () => {
    const dummyBuffer = Buffer.from("fake image bytes");
    const result = await extractReceiptWithGemini(
      dummyBuffer,
      "image/png",
      "your_gemini_api_key_here",
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("GEMINI_API_KEY is not configured");
    expect(result.data).toBeUndefined();
  });

  it("provides intelligent structured fallback when explicitly allowed", async () => {
    const dummyBuffer = Buffer.from("fake image bytes");
    const result = await extractReceiptWithGemini(
      dummyBuffer,
      "image/png",
      "",
      { allowFallback: true },
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.merchant).toBe("Monad Cloud Infrastructure");
    expect(result.data?.totalAmount).toBe(249.5);
    expect(result.data?.fieldConfidences?.merchant).toBeGreaterThan(0.9);
    expect(result.data?.items.length).toBeGreaterThan(0);
  });

  it("detects mathematical discrepancy between subtotal, tax, and total amount", () => {
    const rawData: ExtractedReceiptData = {
      merchant: "DevOps Superstore",
      date: "2026-10-09",
      subtotal: 100.0,
      taxAmount: 8.5,
      totalAmount: 120.0, // Expected: 108.50, Mismatch: $11.50
      currency: "USD",
      categorySlug: "software_tools",
      items: [],
      confidenceScore: 0.95,
    };

    const enriched = sanitizeAndEnrichReceiptData(rawData);
    expect(enriched.anomalies).toBeDefined();
    expect(enriched.anomalies?.length).toBe(1);
    expect(enriched.anomalies?.[0]?.field).toBe("totalAmount");
    expect(enriched.anomalies?.[0]?.severity).toBe("medium");
    expect(enriched.anomalies?.[0]?.issue).toContain("equals $108.50, differing from total ($120.00)");
  });

  it("defaults field confidences reasonably when not provided by vision parser", () => {
    const rawData: ExtractedReceiptData = {
      merchant: "Corner Coffee",
      date: "2026-10-09",
      totalAmount: 5.75,
      currency: "USD",
      categorySlug: "food_dining",
      items: [],
      confidenceScore: 0.88,
    };

    const enriched = sanitizeAndEnrichReceiptData(rawData);
    expect(enriched.fieldConfidences?.merchant).toBe(0.88);
    expect(enriched.fieldConfidences?.date).toBe(0.98);
    expect(enriched.fieldConfidences?.totalAmount).toBe(0.88);
    expect(enriched.anomalies).toEqual([]);
  });
});
