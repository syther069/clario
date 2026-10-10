export interface DocSubsection {
  id: string;
  title: string;
}

export interface DocSection {
  id: string;
  slug: string;
  title: string;
  badge?: string;
  description: string;
  group: "Getting Started" | "Product & Modes" | "Architecture & Verification" | "Integrations" | "Security & Ops" | "Hackathon";
  subsections: DocSubsection[];
}

export const DOC_SECTIONS: DocSection[] = [
  // 1. Getting Started
  {
    id: "overview",
    slug: "overview",
    title: "Overview & Vision",
    badge: "Core",
    description: "What Clario is, the problem it solves, target audiences, and founder invariants.",
    group: "Getting Started",
    subsections: [
      { id: "what-is-clario", title: "What is Clario?" },
      { id: "the-problem", title: "The Problem Space" },
      { id: "who-is-clario-for", title: "Who is Clario For?" },
      { id: "core-pillars", title: "The Three Pillars" },
      { id: "founder-invariants", title: "The 6 Founder Invariants" },
    ],
  },
  {
    id: "quickstart",
    slug: "quickstart",
    title: "Developer Quickstart",
    badge: "Setup",
    description: "Install, configure environment variables, and run Clario locally in under 3 minutes.",
    group: "Getting Started",
    subsections: [
      { id: "prerequisites", title: "System Prerequisites" },
      { id: "clone-install", title: "Clone & Install" },
      { id: "environment-vars", title: "Environment Configuration" },
      { id: "local-dev-server", title: "Running Locally" },
      { id: "testing-verification", title: "Running Automated Tests" },
    ],
  },

  // 2. Product & Modes
  {
    id: "product-modes",
    slug: "product-modes",
    title: "Platform Modes",
    badge: "Product",
    description: "Detailed specification of the 4 core operating modes and unified ledger architecture.",
    group: "Product & Modes",
    subsections: [
      { id: "unified-ledger", title: "Unified Ledger Foundation" },
      { id: "mode-personal", title: "Personal Mode" },
      { id: "mode-freelancer", title: "Freelancer Mode" },
      { id: "mode-family", title: "Family Mode" },
      { id: "mode-business", title: "Business Mode" },
    ],
  },
  {
    id: "ai-copilot",
    slug: "ai-copilot",
    title: "AI & OCR Intelligence",
    badge: "AI",
    description: "Multimodal Gemini OCR receipt extraction, Copilot anomaly signals, and authority boundaries.",
    group: "Product & Modes",
    subsections: [
      { id: "ai-principles", title: "AI Has No Authority Invariant" },
      { id: "gemini-ocr", title: "Multimodal Gemini 2.5 Flash OCR" },
      { id: "anomaly-detection", title: "Rule 40 Anomaly Engine" },
      { id: "ai-privacy-boundary", title: "Encryption & Privacy Boundary" },
    ],
  },

  // 3. Architecture & Verification
  {
    id: "architecture",
    slug: "architecture",
    title: "System Architecture",
    badge: "Deep Dive",
    description: "High-level end-to-end data pipeline from user auth to Monad consensus.",
    group: "Architecture & Verification",
    subsections: [
      { id: "pipeline-overview", title: "End-to-End Pipeline" },
      { id: "component-stack", title: "Technology Infrastructure" },
      { id: "data-flow-diagram", title: "Visual Architecture Flow" },
      { id: "data-isolation", title: "State Separation & Vault Model" },
    ],
  },
  {
    id: "verification",
    slug: "verification",
    title: "Verification Engine",
    badge: "Cryptographic",
    description: "Canonical RFC 8785 JSON encoding, SHA-256 digests, Keccak-256 commitments, and offline verifier CLI.",
    group: "Architecture & Verification",
    subsections: [
      { id: "canonical-json", title: "Canonical JSON (RFC 8785)" },
      { id: "commitment-generation", title: "Commitment Hashing Algorithm" },
      { id: "bundling-lifecycle", title: "Multi-Tx Bundle Lifecycle" },
      { id: "independent-verifier", title: "Independent Verifier CLI" },
      { id: "verification-outcomes", title: "Verification State Machine" },
    ],
  },
  {
    id: "monad-integration",
    slug: "monad-integration",
    title: "Monad Integration",
    badge: "10,000 TPS",
    description: "Why Monad, sub-second finality, Testnet parameters, registry contracts, and USDC settlement.",
    group: "Architecture & Verification",
    subsections: [
      { id: "why-monad", title: "Why Monad?" },
      { id: "network-spec", title: "Testnet Provenance & Specs" },
      { id: "smart-contracts", title: "Deployed Smart Contracts" },
      { id: "onchain-vs-offchain", title: "Onchain Commitments vs Offchain Data" },
      { id: "settlement-asset", title: "Supported USDC Settlement Asset" },
    ],
  },

  // 4. Integrations
  {
    id: "privy-auth",
    slug: "privy-auth",
    title: "Privy Authentication & Embedded Wallets",
    badge: "Wallets & Signers",
    description: "Non-custodial identity, embedded wallets, 1-click session signing (delegated actions), native wallet funding onramp, passkeys, multi-wallet linking, and real-time security webhooks.",
    group: "Integrations",
    subsections: [
      { id: "auth-model", title: "Privy Identity & Embedded Wallets" },
      { id: "one-click-session-signing", title: "1-Click Session Signing (Delegated Actions)" },
      { id: "wallet-funding", title: "Native Wallet Funding (useFundWallet)" },
      { id: "custom-chain-injection", title: "Viem Monad Chain Injection" },
      { id: "passkeys-self-custody", title: "Passkeys, Recovery & Self-Custody" },
      { id: "progressive-account-linking", title: "Progressive Multi-Account Linking & Nicknames" },
      { id: "privy-webhooks", title: "Privy Webhooks & Security Audit Trail" },
    ],
  },
  {
    id: "alchemy-ingestion",
    slug: "alchemy-ingestion",
    title: "Alchemy Ingestion",
    badge: "Multi-Chain",
    description: "Multi-chain transaction retrieval via Alchemy Asset Transfers API across 8+ EVM networks.",
    group: "Integrations",
    subsections: [
      { id: "alchemy-role", title: "Role of Alchemy in Clario" },
      { id: "supported-networks", title: "Supported Networks & Priority" },
      { id: "ingestion-rules", title: "Strict 8 Ingestion Rules" },
      { id: "normalization-pipeline", title: "Data Normalization & Deduplication" },
    ],
  },
  {
    id: "supabase-schema",
    slug: "supabase-schema",
    title: "Database & Storage",
    badge: "Supabase",
    description: "PostgreSQL schema, Row Level Security (RLS), encrypted blob buckets, and relationships.",
    group: "Integrations",
    subsections: [
      { id: "database-overview", title: "Relational Data Model" },
      { id: "core-tables", title: "Core Tables & Types" },
      { id: "rls-policies", title: "Row Level Security Policies" },
      { id: "storage-buckets", title: "Private Receipt Storage Buckets" },
    ],
  },

  // 5. Security & Ops
  {
    id: "security",
    slug: "security",
    title: "Security & Threat Model",
    badge: "Hardened",
    description: "Envelope encryption, key management (DEK/KEK), zero private key exposure, and double-reimbursement prevention.",
    group: "Security & Ops",
    subsections: [
      { id: "threat-model", title: "Threat Model & Trust Boundaries" },
      { id: "envelope-encryption", title: "Envelope Encryption (DEK/KEK)" },
      { id: "double-spend-prevention", title: "Duplicate Reimbursement Prevention" },
      { id: "client-server-boundaries", title: "Client/Server Cryptographic Separation" },
    ],
  },
  {
    id: "environment-variables",
    slug: "environment-variables",
    title: "Environment Variables",
    badge: "Config",
    description: "Complete catalog of public client variables vs server-only secrets with safe placeholders.",
    group: "Security & Ops",
    subsections: [
      { id: "public-vars", title: "Public Client Variables (NEXT_PUBLIC_*)" },
      { id: "server-secrets", title: "Server-Only Secrets" },
      { id: "security-audits", title: "Secret Leak Prevention & Gitleaks" },
    ],
  },

  // 6. Hackathon
  {
    id: "metropolis-hackathon",
    slug: "metropolis-hackathon",
    title: "Metropolis Hackathon",
    badge: "Judges",
    description: "Hackathon submission evidence, track alignment, Monad integration audit, AI disclosure, and license.",
    group: "Hackathon",
    subsections: [
      { id: "track-problem-solution", title: "Track, Problem & Solution" },
      { id: "monad-evaluation", title: "Why Monad is Essential" },
      { id: "ai-disclosure", title: "AI Usage Disclosure" },
      { id: "open-source-license", title: "Open Source License & Attribution" },
      { id: "reproducibility-guide", title: "Judge Verification Guide" },
    ],
  },
];
