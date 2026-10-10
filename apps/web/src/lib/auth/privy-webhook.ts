import { createHmac, timingSafeEqual } from "node:crypto";

export interface PrivyWebhookVerificationResult {
  isValid: boolean;
  error?: string;
}

export interface PrivyWebhookHeaders {
  svixId?: string | null;
  svixTimestamp?: string | null;
  svixSignature?: string | null;
}

export interface PrivyWalletCreatedPayload {
  type: "user.wallet_created";
  data: {
    user?: {
      id?: string;
      linked_accounts?: Array<{
        type?: string;
        address?: string;
        email?: string;
      }>;
    };
    wallet?: {
      address?: string;
      chain_type?: string;
      wallet_client_type?: string;
    };
  };
}

export interface PrivyKeyExportedPayload {
  type:
    | "private_key.exported"
    | "user.key_exported"
    | "user.wallet_exported"
    | "wallet.private_key_export";
  data: {
    user?: {
      id?: string;
    };
    wallet?: {
      address?: string;
    };
    timestamp?: number | string;
  };
}

export interface PrivyWalletRestoredPayload {
  type: "wallet.restored";
  data: {
    user?: {
      id?: string;
    };
    wallet?: {
      address?: string;
    };
    timestamp?: number | string;
  };
}

export interface PrivyTransactionPayload {
  type:
    | "transaction.broadcasted"
    | "transaction.confirmed"
    | "transaction.execution_reverted"
    | "transaction.still_pending"
    | "transaction.failed"
    | "transaction.replaced"
    | "transaction.provider_error";
  data: {
    transaction_hash?: string;
    hash?: string;
    chain_id?: number | string;
    chainId?: number | string;
    wallet_address?: string;
    from?: string;
    to?: string;
    value?: string;
    block_number?: number | string;
    blockNumber?: number | string;
    error?: string;
    replacement_transaction_hash?: string;
    user_id?: string;
    user?: { id?: string };
    timestamp?: number | string;
  };
}

export type PrivyWebhookEvent =
  | PrivyWalletCreatedPayload
  | PrivyKeyExportedPayload
  | PrivyWalletRestoredPayload
  | PrivyTransactionPayload
  | { type: string; data?: unknown };

/**
 * Verifies a Privy webhook request payload using the Svix HMAC-SHA256 standard.
 *
 * Requirements:
 * - svix-id: Unique message ID
 * - svix-timestamp: Epoch seconds timestamp
 * - svix-signature: Space-separated signatures (e.g. "v1,signature1 v1,signature2")
 * - secret: The webhook signing key from the Privy dashboard (starts with "whsec_")
 *
 * Includes 5-minute replay attack window and timing-safe comparison.
 */
export function verifyPrivyWebhook(
  rawBody: string,
  headers: PrivyWebhookHeaders,
  secret?: string,
  options: { toleranceSeconds?: number; allowDevBypass?: boolean } = {},
): PrivyWebhookVerificationResult {
  const { svixId, svixTimestamp, svixSignature } = headers;

  // Development bypass if explicitly configured or secret not set locally
  if (!secret) {
    if (process.env.NODE_ENV !== "production" || options.allowDevBypass) {
      console.warn(
        "[Privy Webhook] PRIVY_WEBHOOK_SECRET is not configured. Allowing simulation in development.",
      );
      return { isValid: true };
    }
    return {
      isValid: false,
      error: "Missing PRIVY_WEBHOOK_SECRET on server.",
    };
  }

  if (!svixId || !svixTimestamp || !svixSignature) {
    return {
      isValid: false,
      error: "Missing required Svix webhook headers (svix-id, svix-timestamp, svix-signature).",
    };
  }

  // 1. Replay attack verification (5 min tolerance by default)
  const timestampNum = parseInt(svixTimestamp, 10);
  if (Number.isNaN(timestampNum)) {
    return { isValid: false, error: "Invalid svix-timestamp header format." };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - timestampNum) > tolerance) {
    return {
      isValid: false,
      error: `Webhook timestamp expired. Tolerance is ${tolerance}s (Replay attack guard).`,
    };
  }

  // 2. Secret parsing (base64 decode if whsec_ prefix)
  let secretKey: Buffer;
  try {
    if (secret.startsWith("whsec_")) {
      secretKey = Buffer.from(secret.slice(6), "base64");
    } else {
      secretKey = Buffer.from(secret, "base64");
      if (secretKey.length === 0) {
        secretKey = Buffer.from(secret, "utf-8");
      }
    }
  } catch {
    secretKey = Buffer.from(secret, "utf-8");
  }

  // 3. Compute HMAC-SHA256 signature
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const computedSignature = createHmac("sha256", secretKey)
    .update(toSign)
    .digest("base64");

  // 4. Compare with signatures in svix-signature header
  const signatureParts = svixSignature.split(" ");
  let matched = false;

  for (const part of signatureParts) {
    const [version, signature] = part.split(",");
    if (version === "v1" && signature) {
      const passedBuf = Buffer.from(signature);
      const computedBuf = Buffer.from(computedSignature);

      if (
        passedBuf.length === computedBuf.length &&
        timingSafeEqual(passedBuf, computedBuf)
      ) {
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    return {
      isValid: false,
      error: "Invalid webhook signature (HMAC-SHA256 mismatch).",
    };
  }

  return { isValid: true };
}
