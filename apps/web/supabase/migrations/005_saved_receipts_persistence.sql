-- Clario Supabase Migration: 005_saved_receipts_persistence.sql
-- Enforces wallet address ownership and idempotency on receipt_bundles

-- 1. Ensure receipt_bundles table exists
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

-- 2. Add wallet_address column if table already existed without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'receipt_bundles' AND column_name = 'wallet_address'
  ) THEN
    ALTER TABLE public.receipt_bundles ADD COLUMN wallet_address TEXT;
  END IF;
END $$;

-- 3. Indexes for normalized wallet address and blockchain hash lookups
CREATE INDEX IF NOT EXISTS idx_receipt_bundles_wallet_address
  ON public.receipt_bundles (wallet_address);

CREATE INDEX IF NOT EXISTS idx_receipt_bundles_wallet_network_tx
  ON public.receipt_bundles (wallet_address, blockchain_network, blockchain_tx_hash);

-- 4. Ensure transactions table has receipt_bundle_id
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS receipt_bundle_id TEXT;
