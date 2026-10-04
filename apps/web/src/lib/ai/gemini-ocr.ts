export interface ExtractedReceiptItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
}

export interface ExtractedReceiptData {
  merchant: string;
  date: string;
  totalAmount: number;
  currency: string;
  taxAmount?: number;
  categorySlug: string;
  paymentMethod?: string;
  items: ExtractedReceiptItem[];
  confidenceScore: number;
  rawTextSummary?: string;
}

/**
 * Extracts structured financial fields from a receipt image or document
 * using Google Gemini 2.5 Flash multimodal vision.
 */
export async function extractReceiptWithGemini(
  fileBuffer: Buffer | ArrayBuffer,
  mimeType: string,
  apiKey?: string,
): Promise<{ success: boolean; data?: ExtractedReceiptData; error?: string }> {
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key || key === "your_gemini_api_key_here") {
    return {
      success: false,
      error: "GEMINI_API_KEY is not configured",
    };
  }

  try {
    const base64Data = Buffer.from(new Uint8Array(fileBuffer)).toString(
      "base64",
    );

    const prompt = `Analyze this financial receipt or invoice image.
Extract the following information accurately:
- merchant: The business or seller name
- date: Transaction date in ISO format (YYYY-MM-DD)
- totalAmount: Total numeric charge
- currency: ISO currency code (e.g. USD, EUR, GBP, MON)
- taxAmount: Tax or VAT if present
- categorySlug: Best category match from: ['housing', 'food_dining', 'transportation', 'utilities', 'healthcare', 'entertainment', 'shopping', 'travel', 'education', 'software_tools', 'office_expenses', 'other']
- paymentMethod: Payment method (e.g., 'Visa 1234', 'Cash', 'Apple Pay')
- items: List of line items with description, quantity, unitPrice, and total
- confidenceScore: Float from 0.0 to 1.0 indicating OCR clarity
- rawTextSummary: One sentence summary of the purchase

Output strictly valid JSON matching this schema with no markdown or formatting outside JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `Gemini API returned ${response.status}: ${errText}`,
      };
    }

    const resJson = await response.json();
    const candidate = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate) {
      return {
        success: false,
        error: "Gemini did not return any extraction output.",
      };
    }

    const parsed: ExtractedReceiptData = JSON.parse(candidate);
    return {
      success: true,
      data: parsed,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Receipt OCR error: ${message}`,
    };
  }
}
