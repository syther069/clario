import { Money } from "../value-objects/Money";
import type {
  Transaction as StorageTransaction,
  TransactionType,
  TransactionSource,
  VerificationState,
} from "@/lib/supabase/types";

export type { TransactionType, TransactionSource, VerificationState };
export type BlockchainStatus = "unverified" | "pending" | "confirmed" | "failed" | null;

/**
 * Clean Architecture - Domain Layer
 * Entity: TransactionEntity
 * Encapsulates core transaction invariants and domain behavior.
 */
export class TransactionEntity {
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _type: TransactionType;
  private readonly _money: Money;
  private readonly _merchant: string;
  private readonly _description: string;
  private readonly _category: string;
  private readonly _date: string;
  private readonly _timestamp: string;
  private readonly _paymentMethod: string;
  private readonly _verificationState: VerificationState;
  private readonly _blockchainStatus: BlockchainStatus;
  private readonly _blockchainNetwork: string;
  private readonly _blockchainChainId: number | null;
  private readonly _blockchainTxHash: string | null;
  private readonly _source: TransactionSource;
  private readonly _receiptBundleId: string | null;
  private readonly _createdAt: string;
  private readonly _updatedAt: string;

  public constructor(props: {
    id: string;
    userId: string;
    type?: TransactionType | undefined;
    amount: number | Money;
    currency?: string | undefined;
    merchant?: string | undefined;
    description?: string | undefined;
    category?: string | undefined;
    date?: string | undefined;
    timestamp?: string | undefined;
    paymentMethod?: string | undefined;
    verificationState?: VerificationState | undefined;
    blockchainStatus?: BlockchainStatus | undefined;
    blockchainNetwork?: string | undefined;
    blockchainChainId?: number | null | undefined;
    blockchainTxHash?: string | null | undefined;
    source?: TransactionSource | undefined;
    receiptBundleId?: string | null | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  }) {
    if (!props.id || !props.id.trim()) {
      throw new Error("TransactionEntity requires a valid non-empty id");
    }

    this._id = props.id.trim();
    this._userId = (props.userId || "user_default").trim().toLowerCase();
    this._type = props.type || "expense";
    this._money =
      props.amount instanceof Money
        ? props.amount
        : Money.create(props.amount, props.currency || "USD");
    this._merchant = props.merchant || props.description || "Expense";
    this._description = props.description || props.merchant || "Expense";
    this._category = props.category || "other";
    this._date = props.date || new Date().toISOString().slice(0, 10);
    this._timestamp = props.timestamp || props.date || new Date().toISOString();
    this._paymentMethod = props.paymentMethod || "Card";
    this._verificationState = props.verificationState || "unverified";
    this._blockchainStatus = props.blockchainStatus ?? null;
    this._blockchainNetwork = props.blockchainNetwork || "Monad Testnet";
    this._blockchainChainId = props.blockchainChainId ?? 10143;
    this._blockchainTxHash = props.blockchainTxHash || null;
    this._source = props.source || "manual";
    this._receiptBundleId = props.receiptBundleId || null;
    this._createdAt = props.createdAt || new Date().toISOString();
    this._updatedAt = props.updatedAt || this._createdAt;
  }

  public get id(): string {
    return this._id;
  }

  public get userId(): string {
    return this._userId;
  }

  public get type(): TransactionType {
    return this._type;
  }

  public get money(): Money {
    return this._money;
  }

  public get amount(): number {
    return this._money.amount;
  }

  public get currency(): string {
    return this._money.currency;
  }

  public get merchant(): string {
    return this._merchant;
  }

  public get description(): string {
    return this._description;
  }

  public get category(): string {
    return this._category;
  }

  public get date(): string {
    return this._date;
  }

  public get timestamp(): string {
    return this._timestamp;
  }

  public get paymentMethod(): string {
    return this._paymentMethod;
  }

  public get verificationState(): VerificationState {
    return this._verificationState;
  }

  public get blockchainStatus(): BlockchainStatus {
    return this._blockchainStatus;
  }

  public get blockchainNetwork(): string {
    return this._blockchainNetwork;
  }

  public get blockchainChainId(): number | null {
    return this._blockchainChainId;
  }

  public get blockchainTxHash(): string | null {
    return this._blockchainTxHash;
  }

  public get source(): TransactionSource {
    return this._source;
  }

  public get receiptBundleId(): string | null {
    return this._receiptBundleId;
  }

  public get createdAt(): string {
    return this._createdAt;
  }

  public get updatedAt(): string {
    return this._updatedAt;
  }

  public isConfirmedOnchain(): boolean {
    return this._blockchainStatus === "confirmed" && Boolean(this._blockchainTxHash);
  }

  /**
   * Adapts the domain entity to the storage contract DTO for backward compatibility.
   */
  public toDTO(): StorageTransaction {
    return {
      id: this._id,
      user_id: this._userId,
      type: this._type,
      amount: this._money.amount,
      currency: this._money.currency,
      merchant: this._merchant,
      description: this._description,
      category: this._category,
      category_id: this._category,
      date: this._date,
      timestamp: this._timestamp,
      payment_method: this._paymentMethod,
      verification_state: this._verificationState,
      verification_status: this._verificationState,
      blockchain_status: this._blockchainStatus,
      blockchain_network: this._blockchainNetwork,
      blockchain_chain_id: this._blockchainChainId,
      blockchain_contract_address: null,
      blockchain_tx_hash: this._blockchainTxHash,
      monad_tx_hash: this._blockchainTxHash,
      monad_block: null,
      blockchain_data_hash: null,
      receipt_bundle_id: this._receiptBundleId,
      status: "cleared",
      source: this._source,
      version: 1,
      created_at: this._createdAt,
      updated_at: this._updatedAt,
    };
  }

  public static fromDTO(dto: StorageTransaction): TransactionEntity {
    const rawCategory = dto.category;
    const categoryStr =
      typeof rawCategory === "string"
        ? rawCategory
        : rawCategory && typeof rawCategory === "object"
          ? rawCategory.name || rawCategory.slug || "other"
          : dto.category_id || "other";

    return new TransactionEntity({
      id: dto.id,
      userId: dto.user_id,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency,
      merchant: dto.merchant || dto.description,
      description: dto.description || dto.merchant,
      category: categoryStr,
      date: dto.date,
      timestamp: dto.timestamp || dto.date,
      paymentMethod: dto.payment_method || "Card",
      verificationState: (dto.verification_state || "unverified") as VerificationState,
      blockchainStatus: dto.blockchain_status || null,
      blockchainNetwork: dto.blockchain_network || "Monad Testnet",
      blockchainChainId: dto.blockchain_chain_id ?? 10143,
      blockchainTxHash: dto.blockchain_tx_hash || dto.monad_tx_hash || null,
      source: dto.source || "manual",
      receiptBundleId: dto.receipt_bundle_id || null,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
    });
  }
}
