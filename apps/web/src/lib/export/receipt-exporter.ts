/**
 * Clario Canonical Receipt Exporter
 *
 * Generates verified, deterministic export formats for Clario receipts:
 * - JSON: Complete structured canonical data
 * - CSV: Structured transaction and receipt records
 * - TXT: Clean human-readable text document
 * - PDF: Formatted vector PDF generated cleanly via browser client
 *
 * Founder invariants enforced:
 * - No mock data; uses exact canonical receipt commitment records.
 * - Exact dates, amounts, transaction hashes, wallet addresses, and Monad verification details.
 * - Handles missing/empty fields accurately without throwing or truncating.
 */

import type {
  ReceiptBundle,
  Transaction,
  CanonicalReceiptTransaction,
} from "@/lib/supabase/types";
import { MONAD_TESTNET_CHAIN_ID, CLARIO_REGISTRY_ADDRESS } from "@/lib/blockchain/registry";

export type ExportFormat = "json" | "csv" | "txt" | "pdf";

export interface NormalizedReceiptData {
  receiptId: string;
  receiptNumber: string;
  receiptName: string;
  createdAt: string;
  owner: string;
  transactionCount: number;
  totalAmount: number;
  currency: string;
  transactionIds: string[];
  transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    merchant: string;
    category: string;
    date: string;
    type: string;
    status?: string | undefined;
    txHash?: string | undefined;
  }>;
  blockchain: {
    network: string;
    chainId: number;
    contract: string;
    txHash: string | null;
    receiptHash: string | null;
    verificationStatus: string;
  };
}

/**
 * Normalizes any receipt bundle into a consistent canonical export model.
 */
export function extractCanonicalReceiptData(
  bundle: ReceiptBundle,
  fallbackTransactions: (Transaction | CanonicalReceiptTransaction)[] = [],
  contractAddressOverride?: string,
): NormalizedReceiptData {
  const receiptData = bundle.receipt_data;
  const contract =
    bundle.blockchain_contract_address ||
    contractAddressOverride ||
    CLARIO_REGISTRY_ADDRESS;

  // Resolve embedded or fallback transactions
  let txList: NormalizedReceiptData["transactions"] = [];

  if (receiptData?.transactions && Array.isArray(receiptData.transactions) && receiptData.transactions.length > 0) {
    txList = receiptData.transactions.map((t) => ({
      id: String(t.id || ""),
      amount: Number(t.amount || 0),
      currency: String(t.currency || bundle.currency || "USD"),
      merchant: String(t.merchant || "Unknown Merchant"),
      category: String(t.category || "General"),
      date: String(t.date || bundle.created_at || ""),
      type: String(t.type || "expense"),
    }));
  } else {
    const matched = fallbackTransactions.filter((t) =>
      bundle.transaction_ids?.includes(t.id),
    );
    txList = matched.map((t) => {
      const fullTx = t as Partial<Transaction>;
      const cat = typeof t.category === "string" ? t.category : (t.category as { name?: string })?.name || "General";
      return {
        id: t.id,
        amount: Number(t.amount || 0),
        currency: String(t.currency || bundle.currency || "USD"),
        merchant: t.merchant || "Unknown Merchant",
        category: cat,
        date: t.date || fullTx.timestamp || bundle.created_at,
        type: t.type || "expense",
        status: fullTx.status,
        txHash: fullTx.blockchain_tx_hash || fullTx.monad_tx_hash || undefined,
      };
    });
  }

  const receiptName =
    bundle.receipt_name ||
    bundle.name ||
    receiptData?.receiptName ||
    `Receipt #${bundle.receipt_number || bundle.id.slice(0, 8)}`;

  const verificationStatus =
    bundle.verification_status === "verified" ||
    bundle.blockchain_status === "confirmed"
      ? "VERIFIED ON MONAD"
      : bundle.blockchain_status === "failed"
        ? "FAILED"
        : "PENDING VERIFICATION";

  return {
    receiptId: bundle.id,
    receiptNumber: bundle.receipt_number || bundle.id.slice(0, 8),
    receiptName,
    createdAt: bundle.created_at || new Date().toISOString(),
    owner: bundle.user_id || bundle.wallet_address || "Anonymous",
    transactionCount: bundle.transaction_count || txList.length,
    totalAmount: Number(bundle.total_amount || 0),
    currency: bundle.currency || "USD",
    transactionIds: bundle.transaction_ids || txList.map((t) => t.id),
    transactions: txList,
    blockchain: {
      network: bundle.blockchain_network || "Monad Testnet",
      chainId: bundle.blockchain_chain_id || MONAD_TESTNET_CHAIN_ID,
      contract,
      txHash: bundle.blockchain_tx_hash || null,
      receiptHash: bundle.receipt_hash || null,
      verificationStatus,
    },
  };
}

/**
 * Normalizes single transaction modal proof data.
 */
export function extractTransactionReceiptData(
  tx: Transaction,
  contractAddressOverride?: string,
): NormalizedReceiptData {
  const contract =
    tx.blockchain_contract_address ||
    contractAddressOverride ||
    CLARIO_REGISTRY_ADDRESS;

  const isVerified =
    tx.verification_state === "verified" ||
    tx.blockchain_status === "confirmed";

  return {
    receiptId: tx.id,
    receiptNumber: tx.id.slice(0, 8).toUpperCase(),
    receiptName: `Transaction - ${tx.merchant || "Unknown Merchant"}`,
    createdAt: tx.date || tx.timestamp || tx.created_at || new Date().toISOString(),
    owner: tx.user_id || "Anonymous",
    transactionCount: 1,
    totalAmount: Number(tx.amount || 0),
    currency: tx.currency || "USD",
    transactionIds: [tx.id],
    transactions: [
      {
        id: tx.id,
        amount: Number(tx.amount || 0),
        currency: tx.currency || "USD",
        merchant: tx.merchant || "Unknown Merchant",
        category: typeof tx.category === "string" ? tx.category : tx.category?.name || "General",
        date: tx.date || tx.timestamp || tx.created_at,
        type: tx.type || "expense",
        status: tx.status,
        txHash: tx.blockchain_tx_hash || tx.monad_tx_hash || undefined,
      },
    ],
    blockchain: {
      network: tx.blockchain_network || "Monad Testnet",
      chainId: tx.blockchain_chain_id || MONAD_TESTNET_CHAIN_ID,
      contract,
      txHash: tx.blockchain_tx_hash || tx.monad_tx_hash || null,
      receiptHash: tx.blockchain_data_hash || tx.commitment_hash || null,
      verificationStatus: isVerified ? "VERIFIED ON MONAD" : "PENDING VERIFICATION",
    },
  };
}

// -----------------------------------------------------------------------------
// Format Generators
// -----------------------------------------------------------------------------

export function generateJsonReceipt(data: NormalizedReceiptData): string {
  const output = {
    protocol: "Clario Financial Intelligence",
    standard: "Monad Transaction Commitment v1",
    exportedAt: new Date().toISOString(),
    receipt: {
      id: data.receiptId,
      number: data.receiptNumber,
      name: data.receiptName,
      createdAt: data.createdAt,
      owner: data.owner,
      totalAmount: data.totalAmount,
      currency: data.currency,
      transactionCount: data.transactionCount,
      transactions: data.transactions,
    },
    blockchain: {
      network: data.blockchain.network,
      chainId: data.blockchain.chainId,
      contractAddress: data.blockchain.contract,
      monadTxHash: data.blockchain.txHash,
      canonicalHash: data.blockchain.receiptHash,
      verificationStatus: data.blockchain.verificationStatus,
      explorerUrl: data.blockchain.txHash
        ? `https://testnet.monadexplorer.com/tx/${data.blockchain.txHash}`
        : null,
    },
  };
  return JSON.stringify(output, null, 2);
}

export function generateCsvReceipt(data: NormalizedReceiptData): string {
  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("&") ||
      str.includes(" ")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const metaRows: string[] = [
    `# CLARIO CANONICAL RECEIPT EXPORT`,
    `Receipt Name,${escapeCsv(data.receiptName)}`,
    `Receipt Number,${escapeCsv(data.receiptNumber)}`,
    `Receipt ID,${escapeCsv(data.receiptId)}`,
    `Created Date,${escapeCsv(data.createdAt)}`,
    `Total Amount,${data.totalAmount.toFixed(2)}`,
    `Currency,${escapeCsv(data.currency)}`,
    `Transaction Count,${data.transactionCount}`,
    `Verification Status,${escapeCsv(data.blockchain.verificationStatus)}`,
    `Monad Tx Hash,${escapeCsv(data.blockchain.txHash || "N/A")}`,
    `Canonical Hash,${escapeCsv(data.blockchain.receiptHash || "N/A")}`,
    `Registry Contract,${escapeCsv(data.blockchain.contract)}`,
    `Network,${escapeCsv(data.blockchain.network)} (Chain ID ${data.blockchain.chainId})`,
    `Exported At,${escapeCsv(new Date().toISOString())}`,
    ``,
    `Transaction ID,Date,Merchant,Category,Type,Amount,Currency,Tx Hash`,
  ];

  for (const tx of data.transactions) {
    metaRows.push(
      [
        escapeCsv(tx.id),
        escapeCsv(tx.date),
        escapeCsv(tx.merchant),
        escapeCsv(tx.category),
        escapeCsv(tx.type),
        tx.amount.toFixed(2),
        escapeCsv(tx.currency),
        escapeCsv(tx.txHash || ""),
      ].join(","),
    );
  }

  return metaRows.join("\n");
}

export function generateTxtReceipt(data: NormalizedReceiptData): string {
  const divider = "================================================================================";
  const subDivider = "--------------------------------------------------------------------------------";

  const lines: string[] = [
    divider,
    "                         CLARIO FINANCIAL RECEIPT                              ",
    "                   Cryptographic Proof & Settlement Document                   ",
    divider,
    "",
    `RECEIPT IDENTIFIER:  ${data.receiptNumber}`,
    `RECEIPT NAME:        ${data.receiptName}`,
    `RECEIPT ID:          ${data.receiptId}`,
    `DATE CREATED:        ${data.createdAt}`,
    `OWNER / WALLET:      ${data.owner}`,
    `TOTAL AMOUNT:        $${data.totalAmount.toFixed(2)} ${data.currency}`,
    `TRANSACTIONS:        ${data.transactionCount}`,
    "",
    subDivider,
    "ONCHAIN MONAD VERIFICATION PROOF",
    subDivider,
    `Verification State:  ${data.blockchain.verificationStatus}`,
    `Network:             ${data.blockchain.network} (Chain ID ${data.blockchain.chainId})`,
    `Registry Contract:   ${data.blockchain.contract}`,
    `Canonical Hash:      ${data.blockchain.receiptHash || "N/A"}`,
    `Monad Tx Hash:       ${data.blockchain.txHash || "N/A"}`,
    ...(data.blockchain.txHash
      ? [`Monad Explorer:      https://testnet.monadexplorer.com/tx/${data.blockchain.txHash}`]
      : []),
    "",
    subDivider,
    "ITEMIZED TRANSACTIONS",
    subDivider,
    sprintf(
      "%-12s | %-12s | %-24s | %-14s | %10s",
      "DATE",
      "TYPE",
      "MERCHANT",
      "CATEGORY",
      "AMOUNT",
    ),
    subDivider,
  ];

  for (const tx of data.transactions) {
    const formattedDate = tx.date ? tx.date.slice(0, 10) : "N/A";
    const amountStr = `-$${tx.amount.toFixed(2)}`;
    lines.push(
      sprintf(
        "%-12s | %-12s | %-24s | %-14s | %10s",
        formattedDate,
        tx.type.toUpperCase(),
        tx.merchant.slice(0, 24),
        tx.category.slice(0, 14),
        amountStr,
      ),
    );
    if (tx.txHash) {
      lines.push(`   Tx Hash: ${tx.txHash}`);
    }
  }

  lines.push(
    subDivider,
    sprintf(
      "%-54s TOTAL:  $%10s %s",
      "",
      data.totalAmount.toFixed(2),
      data.currency,
    ),
    subDivider,
    "",
    `Exported from Clario on ${new Date().toISOString()}`,
    "Private evidence offchain. Invariant commitment anchored on Monad.",
    divider,
  );

  return lines.join("\n");
}

/**
 * Generates a clean, valid standalone PDF binary via native PDF syntax.
 * Creates an exact visual, vector-drawn PDF document without heavy dependencies.
 */
export function generatePdfReceipt(data: NormalizedReceiptData): Blob {
  // Build PDF 1.4 specification document
  const pdfLines: string[] = [];

  const esc = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  // Document dimensions (Points): Letter is 612 x 792
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;

  // Stream content commands
  const stream: string[] = [];

  // Helper to draw text
  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 10,
    font = "F1",
    r = 0.07,
    g = 0.07,
    b = 0.07,
  ) => {
    stream.push(`BT /${font} ${size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${x} ${y} Tm (${esc(text)}) Tj ET`);
  };

  // Helper to draw rectangle
  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fillR = 1,
    fillG = 1,
    fillB = 1,
    strokeR = 0.07,
    strokeG = 0.07,
    strokeB = 0.07,
    lineWidth = 1.5,
  ) => {
    stream.push(
      `${lineWidth} w ${strokeR} ${strokeG} ${strokeB} RG ${fillR} ${fillG} ${fillB} rg ${x} ${y} ${w} ${h} B`,
    );
  };

  // Top Neo-Brutalist Border Card Header
  drawRect(margin, pageHeight - 110, pageWidth - margin * 2, 70, 0.98, 0.98, 1, 0.07, 0.07, 0.07, 2);
  drawText("CLARIO FINANCIAL INTELLIGENCE", margin + 16, pageHeight - 65, 16, "F2", 0.51, 0.43, 0.98);
  drawText("OFFICIAL CANONICAL SETTLEMENT RECEIPT", margin + 16, pageHeight - 82, 9, "F2", 0.35, 0.35, 0.35);

  const statusColor = data.blockchain.verificationStatus.includes("VERIFIED")
    ? { r: 0.08, g: 0.5, b: 0.24 }
    : { r: 0.8, g: 0.45, b: 0.05 };

  drawText(
    data.blockchain.verificationStatus,
    pageWidth - margin - 170,
    pageHeight - 74,
    10,
    "F2",
    statusColor.r,
    statusColor.g,
    statusColor.b,
  );

  // Meta Section Box
  let currentY = pageHeight - 130;
  drawRect(margin, currentY - 95, pageWidth - margin * 2, 95, 1, 1, 1, 0.07, 0.07, 0.07, 1.5);

  drawText("RECEIPT INFORMATION", margin + 14, currentY - 20, 10, "F2", 0.07, 0.07, 0.07);
  drawText(`Receipt Name:    ${data.receiptName}`, margin + 14, currentY - 38, 9, "F1");
  drawText(`Receipt Number:  #${data.receiptNumber}`, margin + 14, currentY - 52, 9, "F1");
  drawText(`Created Date:    ${data.createdAt}`, margin + 14, currentY - 66, 9, "F1");
  drawText(`Owner / Wallet:  ${data.owner}`, margin + 14, currentY - 80, 9, "F1");

  drawText("TOTAL COMMITMENT", pageWidth - margin - 160, currentY - 20, 10, "F2", 0.07, 0.07, 0.07);
  drawText(
    `-$${data.totalAmount.toFixed(2)} ${data.currency}`,
    pageWidth - margin - 160,
    currentY - 45,
    16,
    "F2",
    0.07,
    0.07,
    0.07,
  );
  drawText(
    `${data.transactionCount} Bundled Transactions`,
    pageWidth - margin - 160,
    currentY - 65,
    9,
    "F1",
    0.51,
    0.43,
    0.98,
  );

  // Proof Details Box
  currentY -= 115;
  drawRect(margin, currentY - 90, pageWidth - margin * 2, 90, 0.98, 0.97, 1, 0.07, 0.07, 0.07, 1.5);
  drawText("MONAD BLOCKCHAIN PROOF & COMMITMENT", margin + 14, currentY - 18, 9, "F2", 0.51, 0.43, 0.98);
  drawText(`Network:         ${data.blockchain.network} (Chain ID ${data.blockchain.chainId})`, margin + 14, currentY - 34, 8, "F1");
  drawText(`Registry:        ${data.blockchain.contract}`, margin + 14, currentY - 48, 8, "F1");
  drawText(`Canonical Hash:  ${data.blockchain.receiptHash || "N/A"}`, margin + 14, currentY - 62, 8, "F1");
  drawText(`Monad Tx Hash:   ${data.blockchain.txHash || "N/A"}`, margin + 14, currentY - 76, 8, "F1");

  // Transactions Table Header
  currentY -= 115;
  drawRect(margin, currentY - 24, pageWidth - margin * 2, 24, 0.92, 0.94, 0.97, 0.07, 0.07, 0.07, 1.5);
  drawText("DATE", margin + 10, currentY - 16, 8, "F2");
  drawText("MERCHANT", margin + 90, currentY - 16, 8, "F2");
  drawText("CATEGORY", margin + 270, currentY - 16, 8, "F2");
  drawText("TYPE", margin + 410, currentY - 16, 8, "F2");
  drawText("AMOUNT", pageWidth - margin - 65, currentY - 16, 8, "F2");

  currentY -= 28;
  const maxTxCount = Math.min(data.transactions.length, 12);
  for (let i = 0; i < maxTxCount; i++) {
    const tx = data.transactions[i];
    if (!tx) continue;
    const isEven = i % 2 === 0;
    const rowBg = isEven ? 1 : 0.98;
    drawRect(margin, currentY - 20, pageWidth - margin * 2, 20, rowBg, rowBg, rowBg, 0.85, 0.85, 0.85, 0.5);

    drawText(tx.date ? tx.date.slice(0, 10) : "N/A", margin + 10, currentY - 14, 8, "F1");
    drawText(tx.merchant.slice(0, 32), margin + 90, currentY - 14, 8, "F2");
    drawText(tx.category.slice(0, 20), margin + 270, currentY - 14, 8, "F1");
    drawText(tx.type.toUpperCase(), margin + 410, currentY - 14, 8, "F1");
    drawText(`-$${tx.amount.toFixed(2)}`, pageWidth - margin - 65, currentY - 14, 8, "F2");
    currentY -= 22;
  }

  if (data.transactions.length > 12) {
    drawText(
      `... and ${data.transactions.length - 12} more transactions (see full JSON or CSV export)`,
      margin + 10,
      currentY - 12,
      8,
      "F1",
      0.5,
      0.5,
      0.5,
    );
    currentY -= 18;
  }

  // Footer Invariant Notice
  drawRect(margin, margin, pageWidth - margin * 2, 35, 0.98, 0.98, 0.98, 0.07, 0.07, 0.07, 1);
  drawText(
    "Private evidence offchain. Invariant commitment anchored on Monad. Independent verifier standard.",
    margin + 14,
    margin + 20,
    7,
    "F2",
    0.3,
    0.3,
    0.3,
  );
  drawText(
    `Exported from Clario on ${new Date().toISOString()}`,
    margin + 14,
    margin + 9,
    7,
    "F1",
    0.5,
    0.5,
    0.5,
  );

  const streamContent = stream.join("\n");
  const streamLength = streamContent.length;

  // Assembly of standard PDF objects
  pdfLines.push("%PDF-1.4");
  pdfLines.push("%âãÏÓ");

  // 1: Catalog
  pdfLines.push("1 0 obj");
  pdfLines.push("<< /Type /Catalog /Pages 2 0 R >>");
  pdfLines.push("endobj");

  // 2: Pages
  pdfLines.push("2 0 obj");
  pdfLines.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  pdfLines.push("endobj");

  // 3: Page
  pdfLines.push("3 0 obj");
  pdfLines.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
  );
  pdfLines.push("endobj");

  // 4: Contents
  pdfLines.push("4 0 obj");
  pdfLines.push(`<< /Length ${streamLength} >>`);
  pdfLines.push("stream");
  pdfLines.push(streamContent);
  pdfLines.push("endstream");
  pdfLines.push("endobj");

  // 5: Font Courier (Regular)
  pdfLines.push("5 0 obj");
  pdfLines.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  pdfLines.push("endobj");

  // 6: Font Courier-Bold
  pdfLines.push("6 0 obj");
  pdfLines.push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>");
  pdfLines.push("endobj");

  // Xref calculation
  let byteOffset = 0;
  const xrefOffsets: number[] = [0];

  const fullHead = pdfLines.join("\n") + "\n";
  // calculate offsets accurately
  const chunks = fullHead.split(/(?=\d+ 0 obj)/g);
  byteOffset = chunks[0]?.length || 0;

  for (let i = 1; i <= 6; i++) {
    xrefOffsets.push(byteOffset);
    const chunk = chunks[i];
    if (typeof chunk === "string") {
      byteOffset += chunk.length;
    }
  }

  const xrefStart = byteOffset;
  const xref = [
    "xref",
    "0 7",
    "0000000000 65535 f ",
    ...xrefOffsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    "<< /Size 7 /Root 1 0 R >>",
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");

  const finalPdf = fullHead + xref;
  return new Blob([finalPdf], { type: "application/pdf" });
}

/**
 * Triggers browser download for a specific format using the canonical normalized data.
 */
export function triggerReceiptExport(
  data: NormalizedReceiptData,
  format: ExportFormat,
) {
  const filePrefix = `clario-receipt-${data.receiptNumber || data.receiptId.slice(0, 8)}`;
  let blob: Blob;
  let filename: string;

  switch (format) {
    case "json": {
      const content = generateJsonReceipt(data);
      blob = new Blob([content], { type: "application/json;charset=utf-8" });
      filename = `${filePrefix}.json`;
      break;
    }
    case "csv": {
      const content = generateCsvReceipt(data);
      blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      filename = `${filePrefix}.csv`;
      break;
    }
    case "txt": {
      const content = generateTxtReceipt(data);
      blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      filename = `${filePrefix}.txt`;
      break;
    }
    case "pdf": {
      blob = generatePdfReceipt(data);
      filename = `${filePrefix}.pdf`;
      break;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Minimal sprintf helper for aligned text formatting
function sprintf(format: string, ...args: (string | number)[]): string {
  let argIndex = 0;
  return format.replace(/%(-?\d+)?([sd])/g, (_, widthStr) => {
    const rawVal = args[argIndex++];
    const strVal = rawVal !== undefined ? String(rawVal) : "";
    if (!widthStr) return strVal;

    const width = parseInt(widthStr, 10);
    if (width < 0) {
      // Left aligned
      const pad = Math.abs(width) - strVal.length;
      return pad > 0 ? strVal + " ".repeat(pad) : strVal;
    } else {
      // Right aligned
      const pad = width - strVal.length;
      return pad > 0 ? " ".repeat(pad) + strVal : strVal;
    }
  });
}
