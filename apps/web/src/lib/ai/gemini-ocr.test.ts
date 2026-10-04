import { describe, it, expect } from "vitest";
import { extractReceiptWithGemini } from "./gemini-ocr";

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
});
