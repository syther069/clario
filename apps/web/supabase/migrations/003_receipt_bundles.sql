-- Clario Multi-Transaction Receipt Bundles Schema Extension
-- Supabase Migration: 003_receipt_bundles.sql

-- 1. Receipt Bundles Table (Multi-Transaction Receipt Registry)
CREATE TABLE IF NOT EXISTS public.receipt_bundles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT,
  name TEXT NOT NULL DEFAULT 'Untitled Receipt',
  receipt_name TEXT,
  receipt_number TEXT NOT NULL,
  storage_path TEXT,
  file_hash TEXT NOT NULL,
  receipt_hash TEXT NOT NULL,
  transaction_count INT NOT NULL DEFAULT 1,
  total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  receipt_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  blockchain_network TEXT DEFAULT 'Monad Testnet',
  blockchain_status TEXT NOT NULL DEFAULT 'pending' CHECK (blockchain_status IN ('draft', 'uploading', 'hashing', 'pending', 'confirmed', 'failed')),
  blockchain_tx_hash TEXT,
  blockchain_contract_address TEXT,
  blockchain_chain_id BIGINT DEFAULT 10143,
  monad_block BIGINT,
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Link transactions to their parent receipt bundle
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS receipt_bundle_id TEXT;

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_receipt_bundles_user_id
  ON public.receipt_bundles (user_id);

CREATE INDEX IF NOT EXISTS idx_receipt_bundles_receipt_hash
  ON public.receipt_bundles (receipt_hash);

CREATE INDEX IF NOT EXISTS idx_receipt_bundles_blockchain_tx_hash
  ON public.receipt_bundles (blockchain_tx_hash);

CREATE INDEX IF NOT EXISTS idx_transactions_receipt_bundle_id
  ON public.transactions (receipt_bundle_id);
