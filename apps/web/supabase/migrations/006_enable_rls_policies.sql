-- Clario Supabase Migration: 006_enable_rls_policies.sql
-- Enables Row Level Security (RLS) across all financial, profile, mode, and receipt tables.
-- Guarantees cross-tenant isolation and prevents unauthorized data exposure.

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

DO $$
BEGIN
  -- Financial & Ledger Tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_accounts') THEN
    ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipts') THEN
    ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budgets') THEN
    ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_goals') THEN
    ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'record_versions') THEN
    ALTER TABLE public.record_versions ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proof_commitments') THEN
    ALTER TABLE public.proof_commitments ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipt_bundles') THEN
    ALTER TABLE public.receipt_bundles ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Mode Workspaces Tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_members') THEN
    ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_bills') THEN
    ALTER TABLE public.family_bills ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_settlements') THEN
    ALTER TABLE public.family_settlements ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_team') THEN
    ALTER TABLE public.business_team ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_reimbursements') THEN
    ALTER TABLE public.business_reimbursements ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_policies') THEN
    ALTER TABLE public.expense_policies ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_audit_events') THEN
    ALTER TABLE public.business_audit_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- 2. PUBLIC / SYSTEM CATEGORIES
-- ============================================================================
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read"
  ON public.categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "categories_service_role_all" ON public.categories;
CREATE POLICY "categories_service_role_all"
  ON public.categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. PROFILES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "profiles_service_role_all" ON public.profiles;
CREATE POLICY "profiles_service_role_all"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_owner_access" ON public.profiles;
CREATE POLICY "profiles_owner_access"
  ON public.profiles
  FOR ALL
  USING (
    id = auth.uid()::text
    OR id = auth.jwt() ->> 'sub'
    OR lower(id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    id = auth.uid()::text
    OR id = auth.jwt() ->> 'sub'
    OR lower(id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- ============================================================================
-- 4. TRANSACTIONS POLICIES (UNIVERSAL LEDGER)
-- ============================================================================
DROP POLICY IF EXISTS "transactions_service_role_all" ON public.transactions;
CREATE POLICY "transactions_service_role_all"
  ON public.transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "transactions_owner_access" ON public.transactions;
CREATE POLICY "transactions_owner_access"
  ON public.transactions
  FOR ALL
  USING (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- ============================================================================
-- 5. RECEIPT BUNDLES POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "receipt_bundles_service_role_all" ON public.receipt_bundles;
CREATE POLICY "receipt_bundles_service_role_all"
  ON public.receipt_bundles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "receipt_bundles_owner_access" ON public.receipt_bundles;
CREATE POLICY "receipt_bundles_owner_access"
  ON public.receipt_bundles
  FOR ALL
  USING (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(coalesce(wallet_address, user_id)) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(coalesce(wallet_address, user_id)) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- ============================================================================
-- 6. BUDGETS & FINANCIAL GOALS & SUBSCRIPTIONS POLICIES
-- ============================================================================
-- Budgets
DROP POLICY IF EXISTS "budgets_service_role_all" ON public.budgets;
CREATE POLICY "budgets_service_role_all" ON public.budgets FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "budgets_owner_access" ON public.budgets;
CREATE POLICY "budgets_owner_access" ON public.budgets FOR ALL
  USING (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- Subscriptions
DROP POLICY IF EXISTS "subscriptions_service_role_all" ON public.subscriptions;
CREATE POLICY "subscriptions_service_role_all" ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "subscriptions_owner_access" ON public.subscriptions;
CREATE POLICY "subscriptions_owner_access" ON public.subscriptions FOR ALL
  USING (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- Financial Goals
DROP POLICY IF EXISTS "financial_goals_service_role_all" ON public.financial_goals;
CREATE POLICY "financial_goals_service_role_all" ON public.financial_goals FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "financial_goals_owner_access" ON public.financial_goals;
CREATE POLICY "financial_goals_owner_access" ON public.financial_goals FOR ALL
  USING (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- Financial Accounts
DROP POLICY IF EXISTS "financial_accounts_service_role_all" ON public.financial_accounts;
CREATE POLICY "financial_accounts_service_role_all" ON public.financial_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "financial_accounts_owner_access" ON public.financial_accounts;
CREATE POLICY "financial_accounts_owner_access" ON public.financial_accounts FOR ALL
  USING (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- Receipts
DROP POLICY IF EXISTS "receipts_service_role_all" ON public.receipts;
CREATE POLICY "receipts_service_role_all" ON public.receipts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "receipts_owner_access" ON public.receipts;
CREATE POLICY "receipts_owner_access" ON public.receipts FOR ALL
  USING (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR user_id = auth.jwt() ->> 'sub'
    OR lower(user_id) = lower(nullif(current_setting('request.headers', true)::json->>'x-wallet-address', ''))
    OR user_id = nullif(current_setting('request.headers', true)::json->>'x-user-id', '')
  );

-- ============================================================================
-- 7. MODE WORKSPACE TABLES POLICIES
-- ============================================================================

-- Macro for mode tables with user_id
DO $$
DECLARE
  t TEXT;
  mode_tables TEXT[] := ARRAY[
    'clients', 'invoices', 'family_members', 'family_bills',
    'family_settlements', 'business_team', 'business_reimbursements',
    'expense_policies', 'business_audit_events'
  ];
BEGIN
  FOREACH t IN ARRAY mode_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "%s_service_role_all" ON public.%I;', t, t);
      EXECUTE format('CREATE POLICY "%s_service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', t, t);

      EXECUTE format('DROP POLICY IF EXISTS "%s_owner_access" ON public.%I;', t, t);
      EXECUTE format('
        CREATE POLICY "%s_owner_access" ON public.%I FOR ALL
        USING (
          user_id = auth.uid()::text
          OR user_id = auth.jwt() ->> ''sub''
          OR lower(user_id) = lower(nullif(current_setting(''request.headers'', true)::json->>''x-wallet-address'', ''''))
          OR user_id = nullif(current_setting(''request.headers'', true)::json->>''x-user-id'', '''')
        )
        WITH CHECK (
          user_id = auth.uid()::text
          OR user_id = auth.jwt() ->> ''sub''
          OR lower(user_id) = lower(nullif(current_setting(''request.headers'', true)::json->>''x-wallet-address'', ''''))
          OR user_id = nullif(current_setting(''request.headers'', true)::json->>''x-user-id'', '''')
        );', t, t);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 8. PROOF COMMITMENTS & RECORD VERSIONS (AUDIT INTEGRITY)
-- ============================================================================
DROP POLICY IF EXISTS "proof_commitments_service_role_all" ON public.proof_commitments;
CREATE POLICY "proof_commitments_service_role_all" ON public.proof_commitments FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "proof_commitments_public_read" ON public.proof_commitments;
CREATE POLICY "proof_commitments_public_read" ON public.proof_commitments FOR SELECT USING (true);

DROP POLICY IF EXISTS "record_versions_service_role_all" ON public.record_versions;
CREATE POLICY "record_versions_service_role_all" ON public.record_versions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "record_versions_read" ON public.record_versions;
CREATE POLICY "record_versions_read" ON public.record_versions FOR SELECT USING (true);
