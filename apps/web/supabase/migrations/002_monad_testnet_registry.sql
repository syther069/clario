-- Clario Monad Testnet Transaction Registry Schema Extension
-- Supabase Migration: 002_monad_testnet_registry.sql

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS blockchain_network TEXT DEFAULT 'Monad Testnet',
  ADD COLUMN IF NOT EXISTS blockchain_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_contract_address TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_chain_id BIGINT DEFAULT 10143,
  ADD COLUMN IF NOT EXISTS blockchain_data_hash TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_timestamp TIMESTAMPTZ;

-- Index for speedy lookups by blockchain transaction hash and data commitment
CREATE INDEX IF NOT EXISTS idx_transactions_blockchain_tx_hash
  ON public.transactions (blockchain_tx_hash);

CREATE INDEX IF NOT EXISTS idx_transactions_blockchain_data_hash
  ON public.transactions (blockchain_data_hash);
