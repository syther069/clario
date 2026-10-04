-- Clario Platform Mode Workspaces Schema
-- Supabase Migration: 004_mode_workspaces_schema.sql
-- Supports Freelancer, Family, and Business modes on the shared financial engine

-- 1. Extend Transactions with mode tagging and categorization
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_deductible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_category TEXT;

-- 2. Freelancer: Clients CRM
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  rate_currency TEXT NOT NULL DEFAULT 'USD',
  hourly_rate NUMERIC(18, 2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lead')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients (user_id);

-- 3. Freelancer: Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  tax_amount NUMERIC(18, 2) DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_received_date DATE,
  transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);

-- 4. Family: Household Members & Roles
CREATE TABLE IF NOT EXISTS public.family_members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
  avatar_color TEXT DEFAULT '#836EF9',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_family_members_household ON public.family_members (household_id);

-- 5. Family: Bills & Shared Recurring
CREATE TABLE IF NOT EXISTS public.family_bills (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  due_date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT 'utilities',
  paid_by_member_id TEXT,
  paid_by_name TEXT,
  is_recurring BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_family_bills_household ON public.family_bills (household_id);

-- 6. Family: Settlements (Who owes whom)
CREATE TABLE IF NOT EXISTS public.family_settlements (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  from_member_id TEXT NOT NULL,
  from_member_name TEXT NOT NULL,
  to_member_id TEXT NOT NULL,
  to_member_name TEXT NOT NULL,
  amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_family_settlements_household ON public.family_settlements (household_id);

-- 7. Business: Team & Roles
CREATE TABLE IF NOT EXISTS public.business_team_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'finance', 'manager', 'employee', 'viewer')),
  department TEXT NOT NULL DEFAULT 'General',
  spending_limit_monthly NUMERIC(18, 2) NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_business_team_org ON public.business_team_members (org_id);

-- 8. Business: Reimbursement Claims
CREATE TABLE IF NOT EXISTS public.business_reimbursements (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL DEFAULT 'General',
  department TEXT NOT NULL DEFAULT 'General',
  expense_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'paid')),
  receipt_url TEXT,
  receipt_hash TEXT,
  notes TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  monad_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reimbursements_org ON public.business_reimbursements (org_id);
CREATE INDEX IF NOT EXISTS idx_reimbursements_status ON public.business_reimbursements (status);

-- 9. Business: Expense Policies
CREATE TABLE IF NOT EXISTS public.expense_policies (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  max_single_amount NUMERIC(18, 2) NOT NULL DEFAULT 500,
  monthly_budget NUMERIC(18, 2) NOT NULL DEFAULT 5000,
  requires_receipt_above NUMERIC(18, 2) NOT NULL DEFAULT 25,
  requires_approval_above NUMERIC(18, 2) NOT NULL DEFAULT 250,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_policies_org ON public.expense_policies (org_id);

-- 10. Business: Audit Events
CREATE TABLE IF NOT EXISTS public.business_audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'alert')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org ON public.business_audit_events (org_id);
