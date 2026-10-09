import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractReceiptWithGemini } from "@/lib/ai/gemini-ocr";
import { sanitizeErrorMessage } from "@/lib/security/safe-error";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = (formData.get("userId") as string) || "anonymous";

    if (!file) {
      return NextResponse.json(
        { error: "No file was provided in the upload request." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Compute SHA-256 hash for cryptographic proof anchoring
    const sha256Hash = createHash("sha256").update(buffer).digest("hex");

    // 2. Upload to Supabase Storage bucket 'receipts'
    const supabase = getSupabaseServerClient();
    const fileExt = file.name.split(".").pop() || "png";
    const storagePath = `${userId}/${sha256Hash}.${fileExt}`;

    const uploadedPath = storagePath;
    const { error: storageError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (storageError) {
      console.warn("Supabase storage upload warning:", storageError.message);
      // Fallback: we still proceed with OCR even if storage has bucket permission issues
    }

    // 3. Extract receipt data via Gemini OCR
    const ocrResult = await extractReceiptWithGemini(buffer, file.type);

    // 4. Try saving into Supabase 'receipts' table if it exists
    let dbRecordId: string | null = null;
    try {
      const { data: receiptRow, error: dbError } = await supabase
        .from("receipts")
        .insert({
          user_id: userId,
          storage_path: uploadedPath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          sha256_hash: sha256Hash,
          ocr_status: ocrResult.success ? "completed" : "failed",
          extracted_data: ocrResult.data || null,
        })
        .select("id")
        .single();

      if (!dbError && receiptRow) {
        dbRecordId = receiptRow.id;
      }
    } catch (e) {
      // Table might not be migrated yet; don't break the client response
      console.warn("Receipt DB table insert skipped:", e);
    }

    return NextResponse.json({
      success: true,
      receiptId: dbRecordId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      sha256Hash,
      storagePath: uploadedPath,
      extractedData: ocrResult.data || null,
      ocrError: ocrResult.error || null,
    });
  } catch (error: unknown) {
    const message = sanitizeErrorMessage(error, "Receipt processing failed.");
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
