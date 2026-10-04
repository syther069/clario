-- Clario Universal Financial Intelligence Platform Schema
-- Supabase Migration: 001_universal_financial_schema.sql

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, -- Privy user ID (did:privy:...) or wallet address
  email TEXT,
  display_name TEXT,
  active_mode TEXT NOT NULL DEFAULT 'personal' CHECK (active_mode IN ('personal', 'power_user', 'freelancer', 'family', 'business', 'crypto')),
  primary_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  is_system BOOLEAN NOT NULL DEFAULT true,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Financial Accounts Table (Checking, Savings, Card, Cash, Crypto Wallet)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'cash', 'crypto_wallet')),
  currency TEXT NOT NULL DEFAULT 'USD',
  balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  institution_name TEXT,
  wallet_address TEXT,
  chain_id BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Receipts Table
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Transactions Table (Universal Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(18, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  merchant TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  status TEXT NOT NULL DEFAULT 'cleared' CHECK (status IN ('pending', 'cleared', 'reconciled', 'disputed')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt_ocr', 'bank_import', 'onchain_monad', 'onchain_other')),
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  notes TEXT,
  version INT NOT NULL DEFAULT 1,
  commitment_hash TEXT,
  verification_state TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_state IN ('unverified', 'pending_anchor', 'anchored_onchain', 'verified', 'mismatch')),
  monad_tx_hash TEXT,
  monad_block BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount NUMERIC(18, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  last_payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  auto_detected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount_limit NUMERIC(18, 4) NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, category_id, period)
);

-- 8. Financial Goals Table
CREATE TABLE IF NOT EXISTS public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC(18, 4) NOT NULL,
  current_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'reached', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Record Versions Table (Immutable Revision History)
CREATE TABLE IF NOT EXISTS public.record_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type TEXT NOT NULL CHECK (record_type IN ('transaction', 'expense', 'invoice')),
  record_id UUID NOT NULL,
  version INT NOT NULL,
  previous_hash TEXT,
  new_hash TEXT NOT NULL,
  modified_by TEXT NOT NULL,
  reason TEXT,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (record_type, record_id, version)
);

-- 10. Proof Commitments Table (Monad Anchor Records)
CREATE TABLE IF NOT EXISTS public.proof_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL,
  record_type TEXT NOT NULL,
  version INT NOT NULL,
  canonical_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  commitment_hash TEXT NOT NULL,
  monad_tx_hash TEXT,
  monad_block BIGINT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Seed Default Categories
INSERT INTO public.categories (name, slug, icon, color) VALUES
  ('Food & Dining', 'food_dining', 'Utensils', '#f97316'),
  ('Transportation', 'transportation', 'Car', '#3b82f6'),
  ('Housing & Rent', 'housing', 'Home', '#6366f1'),
  ('Utilities & Bills', 'utilities', 'Zap', '#eab308'),
  ('Entertainment', 'entertainment', 'Film', '#ec4899'),
  ('Health & Medical', 'health', 'HeartPulse', '#ef4444'),
  ('Shopping & Retail', 'shopping', 'ShoppingBag', '#8b5cf6'),
  ('Education', 'education', 'GraduationCap', '#14b8a6'),
  ('Subscriptions', 'subscriptions', 'Repeat', '#06b6d4'),
  ('Salary & Income', 'income', 'ArrowDownLeft', '#10b981'),
  ('Investments & Crypto', 'investments', 'TrendingUp', '#84cc16'),
  ('Miscellaneous', 'other', 'HelpCircle', '#64748b')
ON CONFLICT (slug) DO NOTHING;
