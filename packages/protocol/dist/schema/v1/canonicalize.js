const ADDRESS_REGEX = /^0x[0-9a-f]{40}$/;
const BYTES32_REGEX = /^0x[0-9a-f]{64}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const AMOUNT_REGEX = /^(0|[1-9]\d*)$/;
/**
 * Deterministically canonicalizes a JSON-compatible value according to RFC 8785 (JCS).
 * - Object properties are sorted by UTF-16 code units (ASCII lexicographical).
 * - Whitespace outside quotes is eliminated.
 * - Standard JSON primitive serialization without locale dependency.
 */
export function canonicalizeJson(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        const items = value.map((item) => canonicalizeJson(item));
        return `[${items.join(",")}]`;
    }
    const obj = value;
    const sortedKeys = Object.keys(obj).sort();
    const pairs = [];
    for (const key of sortedKeys) {
        if (obj[key] !== undefined) {
            pairs.push(`${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`);
        }
    }
    return `{${pairs.join(",")}}`;
}
/**
 * Validates that a string is strictly normalized to Unicode Normalization Form C (NFC).
 */
export function assertNfcNormalized(str, fieldName) {
    if (str !== str.normalize("NFC")) {
        throw new Error(`Field '${fieldName}' is not normalized to Unicode Normalization Form C (NFC).`);
    }
}
/**
 * Validates and normalizes an input object against CanonicalExpenseV1 rules.
 */
export function validateCanonicalExpenseV1(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("CanonicalExpenseV1 must be a non-null object.");
    }
    const record = input;
    if (record.schemaVersion !== 1) {
        throw new Error("schemaVersion must be integer 1.");
    }
    if (typeof record.workspaceId !== "string" ||
        !BYTES32_REGEX.test(record.workspaceId)) {
        throw new Error("workspaceId must be a 0x-prefixed 64-character lowercase hex string.");
    }
    if (typeof record.expenseId !== "string" ||
        !BYTES32_REGEX.test(record.expenseId)) {
        throw new Error("expenseId must be a 0x-prefixed 64-character lowercase hex string.");
    }
    if (typeof record.version !== "number" ||
        !Number.isInteger(record.version) ||
        record.version < 1) {
        throw new Error("version must be a positive integer.");
    }
    if (typeof record.title !== "string" ||
        record.title.length === 0 ||
        record.title.length > 200) {
        throw new Error("title must be a non-empty string up to 200 characters.");
    }
    assertNfcNormalized(record.title, "title");
    if (typeof record.businessPurpose !== "string" ||
        record.businessPurpose.length === 0 ||
        record.businessPurpose.length > 4000) {
        throw new Error("businessPurpose must be a non-empty string up to 4000 characters.");
    }
    assertNfcNormalized(record.businessPurpose, "businessPurpose");
    if (typeof record.category !== "string" ||
        record.category.length === 0 ||
        record.category.length > 100) {
        throw new Error("category must be a non-empty string up to 100 characters.");
    }
    assertNfcNormalized(record.category, "category");
    if (typeof record.project !== "string" ||
        record.project.length === 0 ||
        record.project.length > 100) {
        throw new Error("project must be a non-empty string up to 100 characters.");
    }
    assertNfcNormalized(record.project, "project");
    if (typeof record.merchant !== "string" ||
        record.merchant.length === 0 ||
        record.merchant.length > 200) {
        throw new Error("merchant must be a non-empty string up to 200 characters.");
    }
    assertNfcNormalized(record.merchant, "merchant");
    if (typeof record.expenseDate !== "string" ||
        !DATE_REGEX.test(record.expenseDate)) {
        throw new Error("expenseDate must be in YYYY-MM-DD format.");
    }
    if (typeof record.claimAmount !== "string" ||
        !AMOUNT_REGEX.test(record.claimAmount)) {
        throw new Error("claimAmount must be an unsigned integer decimal string in token base units.");
    }
    if (typeof record.claimAsset !== "string" ||
        !ADDRESS_REGEX.test(record.claimAsset)) {
        throw new Error("claimAsset must be a 0x-prefixed 40-character lowercase hex address.");
    }
    if (typeof record.recipient !== "string" ||
        !ADDRESS_REGEX.test(record.recipient)) {
        throw new Error("recipient must be a 0x-prefixed 40-character lowercase hex address.");
    }
    const validSources = ["imported_transaction", "transaction_hash", "manual"];
    if (typeof record.paymentSource !== "string" ||
        !validSources.includes(record.paymentSource)) {
        throw new Error(`paymentSource must be one of: ${validSources.join(", ")}.`);
    }
    if (record.paymentSource === "manual") {
        if (record.sourceChainId !== null ||
            record.sourceTransactionHash !== null) {
            throw new Error("sourceChainId and sourceTransactionHash must be null for manual paymentSource.");
        }
    }
    else {
        if (typeof record.sourceChainId !== "number" ||
            !Number.isInteger(record.sourceChainId) ||
            record.sourceChainId < 1) {
            throw new Error("sourceChainId must be a positive integer for imported source.");
        }
        if (typeof record.sourceTransactionHash !== "string" ||
            !BYTES32_REGEX.test(record.sourceTransactionHash)) {
            throw new Error("sourceTransactionHash must be a 0x-prefixed 64-character lowercase hex string.");
        }
    }
    if (typeof record.evidenceManifestHash !== "string" ||
        !BYTES32_REGEX.test(record.evidenceManifestHash)) {
        throw new Error("evidenceManifestHash must be a 0x-prefixed 64-character lowercase hex string.");
    }
    if (typeof record.submittedBy !== "string" ||
        !ADDRESS_REGEX.test(record.submittedBy)) {
        throw new Error("submittedBy must be a 0x-prefixed 40-character lowercase hex address.");
    }
    if (typeof record.submittedAt !== "string" ||
        !TIMESTAMP_REGEX.test(record.submittedAt)) {
        throw new Error("submittedAt must be in ISO 8601 UTC format (YYYY-MM-DDTHH:MM:SSZ).");
    }
    // Optional string fields
    for (const optField of [
        "client",
        "invoiceNumber",
        "location",
        "notes",
    ]) {
        const val = record[optField];
        if (val !== null && typeof val !== "string") {
            throw new Error(`${optField} must be a string or null.`);
        }
        if (typeof val === "string") {
            assertNfcNormalized(val, optField);
        }
    }
    // Tags array
    if (!Array.isArray(record.tags)) {
        throw new Error("tags must be an array of strings.");
    }
    for (const tag of record.tags) {
        if (typeof tag !== "string") {
            throw new Error("Every tag must be a string.");
        }
        assertNfcNormalized(tag, "tag");
    }
    // Verify tags are sorted and deduplicated
    const sortedTags = [...new Set(record.tags)].sort();
    if (record.tags.length !== sortedTags.length ||
        record.tags.some((t, i) => t !== sortedTags[i])) {
        throw new Error("tags must be sorted lexicographically and deduplicated.");
    }
    return record;
}
/**
 * Validates and normalizes an input object against CanonicalEvidenceManifestV1 rules.
 */
export function validateCanonicalEvidenceManifestV1(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("CanonicalEvidenceManifestV1 must be a non-null object.");
    }
    const manifest = input;
    if (manifest.manifestVersion !== 1) {
        throw new Error("manifestVersion must be integer 1.");
    }
    if (manifest.previousManifestHash !== null &&
        (typeof manifest.previousManifestHash !== "string" ||
            !BYTES32_REGEX.test(manifest.previousManifestHash))) {
        throw new Error("previousManifestHash must be null or a 0x-prefixed 64-character lowercase hex string.");
    }
    if (!Array.isArray(manifest.entries)) {
        throw new Error("entries must be an array of EvidenceEntry objects.");
    }
    const allowedMime = ["application/pdf", "image/png", "image/jpeg"];
    let prevId = "";
    for (let i = 0; i < manifest.entries.length; i++) {
        const entry = manifest.entries[i];
        if (!entry || typeof entry !== "object") {
            throw new Error(`Entry at index ${i} must be a non-null object.`);
        }
        if (typeof entry.evidenceId !== "string" ||
            entry.evidenceId.length === 0 ||
            entry.evidenceId.length > 64) {
            throw new Error(`Entry at index ${i}: evidenceId must be 1-64 characters.`);
        }
        if (i > 0 && entry.evidenceId <= prevId) {
            throw new Error("entries must be strictly sorted by ascending evidenceId.");
        }
        prevId = entry.evidenceId;
        if (!allowedMime.includes(entry.mimeType)) {
            throw new Error(`Entry at index ${i}: mimeType must be one of: ${allowedMime.join(", ")}.`);
        }
        if (typeof entry.sizeBytes !== "number" ||
            !Number.isInteger(entry.sizeBytes) ||
            entry.sizeBytes < 1 ||
            entry.sizeBytes > 26_214_400) {
            throw new Error(`Entry at index ${i}: sizeBytes must be between 1 and 26,214,400 bytes.`);
        }
        if (typeof entry.plaintextHash !== "string" ||
            !BYTES32_REGEX.test(entry.plaintextHash)) {
            throw new Error(`Entry at index ${i}: plaintextHash must be 0x-prefixed 64-char lowercase hex.`);
        }
        if (typeof entry.ciphertextHash !== "string" ||
            !BYTES32_REGEX.test(entry.ciphertextHash)) {
            throw new Error(`Entry at index ${i}: ciphertextHash must be 0x-prefixed 64-char lowercase hex.`);
        }
        if (typeof entry.uploadedAt !== "string" ||
            !TIMESTAMP_REGEX.test(entry.uploadedAt)) {
            throw new Error(`Entry at index ${i}: uploadedAt must be in ISO 8601 UTC format.`);
        }
    }
    return manifest;
}
//# sourceMappingURL=canonicalize.js.map