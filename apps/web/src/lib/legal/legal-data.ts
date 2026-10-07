export interface LegalCalloutData {
  type: "info" | "warning" | "important" | "tip";
  title: string;
  badge: string;
  content: string | string[];
}

export interface LegalTableRow {
  cells: (string | { text: string; mono?: boolean; status?: "built" | "partial" | "planned" | "not_available" })[];
}

export interface LegalTableData {
  caption?: string;
  headers: string[];
  rows: LegalTableRow[];
}

export interface LegalSubSectionData {
  id: string;
  number: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: LegalCalloutData;
  table?: LegalTableData;
  twoColumn?: {
    leftTitle: string;
    leftItems: string[];
    rightTitle: string;
    rightItems: string[];
  };
}

export interface LegalSectionData {
  id: string;
  number: string;
  title: string;
  description?: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: LegalCalloutData;
  table?: LegalTableData;
  twoColumn?: {
    leftTitle: string;
    leftItems: string[];
    rightTitle: string;
    rightItems: string[];
  };
  subsections?: LegalSubSectionData[];
}

export interface LegalDocumentData {
  slug: "privacy" | "terms" | "security" | "disclosure";
  title: string;
  subtitle: string;
  summary: string[];
  version: string;
  lastUpdated: string;
  isDraft: boolean;
  draftNotice?: string;
  sections: LegalSectionData[];
}

// =========================================================================
// 1. PRIVACY POLICY DATA
// =========================================================================

export const PRIVACY_POLICY_DATA: LegalDocumentData = {
  slug: "privacy",
  title: "Privacy Policy",
  subtitle:
    "How Clario processes data across your local device, connected services, and the Monad blockchain.",
  summary: [
    "Most of your financial data, expense drafts, notes, and receipt images remain in your browser's local vault on your device.",
    "When you use optical character recognition (OCR) or the AI copilot, data is processed by third-party model providers (Google Gemini or Groq).",
    "Onchain commitments published to Monad Testnet are 32-byte cryptographic hashes with salt, not readable receipts. Blockchain entries are public and permanent.",
    "Clario runs zero advertising trackers, zero analytics scripts, and zero third-party marketing cookies.",
  ],
  version: "1.0-draft",
  lastUpdated: "[CONFIRM: date]",
  isDraft: true,
  draftNotice: "Draft for testnet preview. Pending legal review.",
  sections: [
    {
      id: "who-we-are",
      number: "01",
      title: "Who We Are",
      paragraphs: [
        "This Privacy Policy explains how Clario (\"we\", \"us\", or \"our\"), operated by [CONFIRM: legal entity name], processes information through the Clario web application and associated protocol interfaces.",
        "Clario is a decentralized financial operations and cryptographic receipt verification platform. If you have questions about this policy or your data, contact us at [CONFIRM: privacy contact email] or write to [CONFIRM: registered address].",
      ],
    },
    {
      id: "data-collection-tiers",
      number: "02",
      title: "What We Collect, What Stays Local, and What We Never Receive",
      paragraphs: [
        "Clario operates under a strict data-separation model. To understand your privacy, you must understand the three distinct tiers where data exists:",
      ],
      subsections: [
        {
          id: "tier-local-vault",
          number: "02.1",
          title: "Tier A: Stored Exclusively in Your Browser Vault",
          paragraphs: [
            "Unless you explicitly submit an expense or utilize cloud sync, the following information is stored entirely inside your local browser storage (localStorage) and never leaves your computer:",
          ],
          bullets: [
            "Unsubmitted receipt images, scans, and invoice files.",
            "Draft expense records, line items, merchant names, and private notes.",
            "Personal household budgets, recurring subscriptions, and financial goal progress.",
            "Freelancer client registries and custom invoice line items.",
            "Family member rosters, split percentages, and internal household IOUs.",
            "Local wallet display nicknames and UI preferences.",
          ],
        },
        {
          id: "tier-server-egress",
          number: "02.2",
          title: "Tier B: Data Sent to Hosted Services or APIs",
          paragraphs: [
            "When you choose to use specific online features, data leaves your browser as follows:",
          ],
          bullets: [
            "Receipt OCR: When you upload a receipt photo for scanning, the image binary is sent over HTTPS to the Google Gemini API (gemini-2.5-flash). Google extracts merchant, amount, date, and line items. We do not use your receipt photos to train public models.",
            "Financial Copilot: If you ask questions in the Copilot drawer and live AI generation is configured, a redacted summary of your ledger is transmitted to Groq (llama-3.3-70b-versatile) or Google Gemini. EVM wallet addresses are masked (e.g., 0x1234...abcd) and client/member names are replaced with anonymous aliases prior to transmission. If API keys are not configured, Copilot runs locally using rule-based algorithms with zero external transmission.",
            "Workspace Database Sync: If you use an authenticated multi-user workspace backed by Supabase, structured records are stored in PostgreSQL. For corporate evidence files, documents are encrypted before storage using AES-256-GCM envelope encryption.",
            "Multi-Chain Transaction Lookup: When you connect a wallet or search a transaction hash, your public wallet address or the hash is queried against Alchemy API or public RPC endpoints.",
          ],
        },
        {
          id: "tier-onchain-published",
          number: "02.3",
          title: "Tier C: Published Onchain (Public and Permanent)",
          paragraphs: [
            "When you anchor an expense, record an approver decision, or execute a testnet reimbursement, the resulting transaction writes data directly to the public Monad Testnet blockchain. This data is permanently visible to anyone in the world and cannot be altered or deleted by anyone.",
          ],
          bullets: [
            "Your public EVM wallet address (as transaction sender or recipient).",
            "A 32-byte cryptographic commitment hash (computed via SHA-256 over canonical RFC 8785 JSON plus a random 32-byte salt).",
            "Expense version numbers and predecessor commitment hashes.",
            "32-byte reason commitment hashes for rejected expenses.",
            "Reimbursement token contract addresses and base-unit payment amounts.",
            "Transaction hashes, block heights, and block timestamps.",
          ],
          callout: {
            type: "important",
            title: "CRITICAL PRIVACY INVARIANT",
            badge: "ZERO CLEAR TEXT ONCHAIN",
            content:
              "Cleartext invoice files, merchant names, passenger names, flight routes, and detailed notes are NEVER published onchain. The public blockchain only receives 32-byte hashes.",
          },
        },
      ],
    },
    {
      id: "blockchain-immutability",
      number: "03",
      title: "Public Blockchain Immutability",
      paragraphs: [
        "Public distributed blockchains are decentralized, immutable ledgers. When you sign a transaction on Monad Testnet, the transaction hash, caller address, and cryptographic commitments become permanent public records.",
        "Neither Clario, nor its operators, nor any third party has the technical ability to modify, erase, roll back, or hide transactions written to the Monad network. If you do not want an address or hash associated with your identity, do not broadcast transactions from that wallet.",
      ],
    },
    {
      id: "ai-and-ocr-processing",
      number: "04",
      title: "AI & Multimodal Processing",
      paragraphs: [
        "Clario integrates machine learning models strictly as advisory drafting tools. They operate under strict boundaries:",
      ],
      bullets: [
        "Google Gemini 2.5 Flash: Used for optical character recognition of receipt images into structured fields. The API is called with explicit schema constraints.",
        "Groq / Llama 3.3: Used for answering conversational questions in the Copilot drawer when enabled.",
        "Local Fallback: If external API keys are omitted in the application configuration, the Copilot executes 100% locally on your machine using deterministic TypeScript financial calculations.",
        "No Autonomous Authority: AI models in Clario hold zero private keys, cannot sign blockchain transactions, cannot move funds, and cannot approve or reject expense claims.",
      ],
    },
    {
      id: "cookies-and-tracking",
      number: "05",
      title: "Cookies, Local Storage, and Analytics",
      paragraphs: [
        "We believe privacy policies should state what is not tracked as clearly as what is:",
      ],
      bullets: [
        "Tracking Cookies: Clario uses zero marketing cookies, zero ad trackers, and zero cross-site behavioral tracking scripts.",
        "Analytics Software: Clario does NOT run Google Analytics, PostHog, Mixpanel, Segment, Hotjar, or Meta Pixel.",
        "Error Monitoring: There are no third-party error trackers (such as Sentry or Datadog) bundled into the active web interface.",
        "Session Cookie: We use a single, secure, HTTP-only session cookie (clario_session) sealed with HMAC-SHA256 solely to authenticate your signed wallet session when using server-side features.",
        "Local Storage: Browser localStorage is used strictly for core app functionality (saving UI theme, active workspace mode, and local draft records).",
      ],
    },
    {
      id: "third-party-services",
      number: "06",
      title: "Third-Party Service Providers",
      paragraphs: [
        "To deliver web access, onchain connectivity, and AI extraction, Clario interacts with the following external infrastructure providers:",
      ],
      table: {
        caption: "Third-Party Providers & Data Flow",
        headers: ["Provider", "Purpose", "Data Transmitted", "Storage Location"],
        rows: [
          {
            cells: [
              { text: "Google AI (Gemini)" },
              { text: "Receipt OCR Extraction" },
              { text: "Receipt image binary" },
              { text: "United States (per Google API terms)" },
            ],
          },
          {
            cells: [
              { text: "Groq Inc." },
              { text: "Copilot LLM Inference (Optional)" },
              { text: "Masked financial prompt context" },
              { text: "United States (per Groq terms)" },
            ],
          },
          {
            cells: [
              { text: "Alchemy Insights" },
              { text: "Asset transfer lookups & Monad RPC" },
              { text: "Wallet address & query params" },
              { text: "United States" },
            ],
          },
          {
            cells: [
              { text: "DeFiLlama" },
              { text: "Historical token USD pricing" },
              { text: "Token contract address & timestamp" },
              { text: "Public API (no user data)" },
            ],
          },
          {
            cells: [
              { text: "Monad RPC Nodes" },
              { text: "Testnet transaction broadcast & reads" },
              { text: "Signed transactions & address queries" },
              { text: "Decentralized / Monad network" },
            ],
          },
          {
            cells: [
              { text: "Supabase Inc." },
              { text: "Cloud relational database (Optional)" },
              { text: "Encrypted evidence & workspace metadata" },
              { text: "[CONFIRM: hosting region, e.g. AWS us-east-1]" },
            ],
          },
          {
            cells: [
              { text: "Hosting Provider" },
              { text: "Web application hosting" },
              { text: "Standard HTTP request logs & IP address" },
              { text: "[CONFIRM: hosting provider, e.g. Vercel]" },
            ],
          },
        ],
      },
    },
    {
      id: "data-retention-and-deletion",
      number: "07",
      title: "Data Retention and Deletion",
      paragraphs: [
        "Your control over data depends on where that data resides:",
      ],
      bullets: [
        "Your Local Browser Vault: You have complete control. You can delete individual drafts, receipts, or invoices inside the app at any time. If you clear your browser site data or cookies, all locally stored plaintext records are erased immediately.",
        "Server Database Records: If you maintain an account on our hosted database, you may request deletion of your workspace data by contacting [CONFIRM: privacy contact email]. We will purge associated records within 30 days, except where retention is required by law.",
        "Public Blockchain Records: Because blockchain transactions are immutable, commitments, hashes, addresses, and timestamps written to Monad Testnet CANNOT be deleted or amended by anyone.",
      ],
      callout: {
        type: "warning",
        title: "NO AUTOMATED CLOUD BACKUP FOR LOCAL VAULT",
        badge: "USER RESPONSIBILITY",
        content:
          "If you clear your browser cache or lose your computer without downloading an exported ZIP backup package, your locally stored receipt files cannot be recovered by Clario.",
      },
    },
    {
      id: "user-rights",
      number: "08",
      title: "User Rights and Data Requests",
      paragraphs: [
        "Depending on your location, you may have rights under applicable privacy laws (such as the right to access, rectify, or request deletion of personal information).",
        "Clario includes built-in offline export tools: you can generate and download a complete cryptographic ZIP verification package of your workspace at any time without asking our permission.",
        "To submit a data access or deletion request for data stored on our servers, email [CONFIRM: privacy contact email]. Note that we cannot modify or erase onchain blockchain records. Legal basis for processing is subject to [CONFIRM: governing data protection framework].",
      ],
    },
    {
      id: "childrens-privacy",
      number: "09",
      title: "Children's Privacy",
      paragraphs: [
        "Clario is designed for business operators, freelancers, and individuals managing expenses. It is not intended for use by individuals under [CONFIRM: minimum age, e.g. 18 years of age]. We do not knowingly collect personal information from children.",
      ],
    },
    {
      id: "policy-changes",
      number: "10",
      title: "Changes to This Privacy Policy",
      paragraphs: [
        "We may update this policy periodically to reflect software releases or regulatory changes. When updates occur, we will update the \"Last updated\" date at the top of this page. Material revisions will be highlighted on our official communication channels.",
      ],
    },
  ],
};

// =========================================================================
// 2. TERMS OF SERVICE DATA
// =========================================================================

export const TERMS_OF_SERVICE_DATA: LegalDocumentData = {
  slug: "terms",
  title: "Terms of Service",
  subtitle:
    "Terms and conditions governing use of the Clario application, protocol contracts, and verification tools.",
  summary: [
    "Clario is a technical software tool for recording and verifying expense evidence. It is not a bank, custodian, tax advisor, or payment processor.",
    "The software operates currently on Monad Testnet for demonstration. Tokens and balances have no real-world monetary value.",
    "You are solely responsible for your wallet keys, local data backups, and compliance with your local tax and accounting laws.",
    "Onchain transactions and cryptographic commitments are final and irreversible once confirmed by the network.",
  ],
  version: "1.0-draft",
  lastUpdated: "[CONFIRM: date]",
  isDraft: true,
  draftNotice: "Draft for testnet preview. Pending legal review.",
  sections: [
    {
      id: "nature-of-service",
      number: "01",
      title: "What Clario Is and Is Not",
      paragraphs: [
        "These Terms of Service (\"Terms\") form a binding agreement between you and [CONFIRM: legal entity name] (\"Clario\", \"we\", \"us\"). By accessing or using the Clario web application, smart contracts, or offline verification tools, you agree to these Terms.",
        "Clario is a non-custodial software application that enables users to organize receipt evidence, compute cryptographic commitments, and verify records against EVM-compatible registries.",
      ],
      subsections: [
        {
          id: "service-boundaries",
          number: "01.1",
          title: "Service Boundaries & Exclusions",
          paragraphs: [
            "For the avoidance of doubt, Clario explicitly states what it is NOT:",
          ],
          bullets: [
            "NOT a Bank or Financial Institution: Clario does not take deposits, extend credit, issue loans, or manage customer balances.",
            "NOT a Custodian or Wallet Provider: Clario never possesses or controls your private keys, seed phrases, or funds.",
            "NOT a Money Transmitter or Payment Processor: Clario does not transmit fiat money or execute regulated payment settlements.",
            "NOT a Certified Accountant or Tax Advisor: Clario does not provide accounting, audit, tax, or legal advice. Cryptographic hashes demonstrate mathematical integrity of records, not statutory tax compliance.",
          ],
        },
      ],
    },
    {
      id: "testnet-status",
      number: "02",
      title: "Testnet Preview & Experimental Status",
      paragraphs: [
        "Clario is currently deployed on Monad Testnet (Chain ID 10143) as experimental software for hackathon demonstration and community preview.",
      ],
      bullets: [
        "No Real Monetary Value: All tokens, testnet MON, and testnet USDC displayed in the interface are faucet or test assets without economic value. Do not attempt to send real mainnet funds to testnet contract addresses.",
        "No Uptime Guarantees: The testnet software may be reset, paused, upgraded, or discontinued at any time without notice. Data loss may occur.",
        "Unaudited Code: The protocol smart contracts have not yet undergone a third-party security audit. You use the software at your own risk.",
      ],
    },
    {
      id: "eligibility-and-acceptable-use",
      number: "03",
      title: "Eligibility and Acceptable Use",
      paragraphs: [
        "You represent and warrant that you are at least [CONFIRM: minimum age, e.g. 18 years of age] and have full legal capacity to enter into these Terms in your jurisdiction.",
        "You agree NOT to use Clario to:",
      ],
      bullets: [
        "Violate any applicable local, national, or international law, sanction, or regulation.",
        "Submit fraudulent, forged, or counterfeit receipts, invoices, or expense claims.",
        "Upload receipt evidence or personal data belonging to third parties without their explicit consent.",
        "Attempt to circumvent, exploit, or bypass onchain duplicate settlement checks or self-approval restrictions.",
        "Interfere with, overload, or disrupt the application, server infrastructure, or Monad RPC endpoints.",
        "Engage in money laundering, terrorist financing, fraud, or sanctions evasion.",
      ],
    },
    {
      id: "wallet-and-keys",
      number: "04",
      title: "Your Wallet, Your Keys, Your Responsibility",
      paragraphs: [
        "Clario is strictly non-custodial. You connect to the application using a self-custodial browser wallet (such as MetaMask, Rabby, or Privy).",
      ],
      bullets: [
        "Key Custody: You alone hold the private keys and seed phrases to your wallets. Clario has no access to your credentials.",
        "No Recovery: If you lose access to your private key or seed phrase, Clario cannot recover your wallet, reverse your transactions, or restore your funds.",
        "Local Vault Loss: If you delete your browser data or experience a hardware failure without saving an exported backup ZIP, Clario cannot restore your local data.",
        "Signing Authorization: Clario cannot execute transactions on your behalf. Every onchain action requires explicit approval inside your wallet extension.",
      ],
    },
    {
      id: "backups-and-compliance",
      number: "05",
      title: "User Responsibility for Backups and Tax Compliance",
      paragraphs: [
        "You are solely responsible for maintaining adequate offline backups of all receipts, tax documentation, and export packages necessary for your personal or business accounting needs.",
        "You acknowledge that cryptographic proof of an expense does not automatically guarantee acceptance by government tax authorities, auditors, or revenue services in your jurisdiction. You remain solely responsible for determining your tax obligations.",
      ],
    },
    {
      id: "finality-of-transactions",
      number: "06",
      title: "Finality of Onchain Actions",
      paragraphs: [
        "Transactions broadcast to the Monad network are validated and executed by independent network validators. Once a block containing your transaction is finalized, that transaction is permanent and irreversible.",
        "Clario cannot modify, reverse, refund, or cancel any onchain expense submission, approval record, or reimbursement payment.",
      ],
    },
    {
      id: "ai-advisory-role",
      number: "07",
      title: "AI Features Suggest Only; Humans Approve",
      paragraphs: [
        "Optical character recognition (OCR) and Financial Copilot features utilize probabilistic artificial intelligence models (Google Gemini and Groq).",
      ],
      bullets: [
        "Advisory Only: AI suggestions, extracted amounts, merchant names, and anomaly warnings are preliminary suggestions for human review.",
        "No Autonomous Authority: AI models cannot execute financial transactions, alter approved records, or sign commitments.",
        "Verification Obligation: You must inspect and verify all AI-extracted information before submitting or approving an expense.",
      ],
    },
    {
      id: "intellectual-property",
      number: "08",
      title: "Intellectual Property & Open Source",
      paragraphs: [
        "The Clario smart contracts and open-source packages are distributed under the [CONFIRM: open-source license, e.g. MIT License]. You retain full ownership and intellectual property rights in the receipt evidence, images, and documents you upload.",
        "By submitting feedback or suggestions, you grant Clario a royalty-free, perpetual license to use that feedback to improve the platform.",
      ],
    },
    {
      id: "disclaimers-and-liability",
      number: "09",
      title: "Disclaimers and Limitation of Liability",
      paragraphs: [
        "CLARIO IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\", WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR NON-INFRINGEMENT.",
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL CLARIO, ITS FOUNDERS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, USE, GOODWILL, OR ASSETS RESULTING FROM: (A) YOUR USE OF OR INABILITY TO USE THE SERVICE; (B) SMART CONTRACT DEFECTS OR TESTNET BUGS; (C) UNAUTHORIZED ACCESS TO YOUR DEVICE OR WALLET; (D) BLOCKCHAIN NETWORK DOWNTIME OR REORGS; OR (E) LOSS OF UNBACKED LOCAL BROWSER DATA.",
      ],
    },
    {
      id: "governing-law",
      number: "10",
      title: "Governing Law and Dispute Resolution",
      paragraphs: [
        "These Terms shall be governed by and construed in accordance with the laws of [CONFIRM: governing law and jurisdiction], without regard to its conflict of law principles.",
        "Any dispute arising under or in connection with these Terms shall be resolved exclusively in the courts of [CONFIRM: venue and dispute forum].",
      ],
    },
    {
      id: "contact-terms",
      number: "11",
      title: "Contact Information",
      paragraphs: [
        "If you have questions regarding these Terms of Service, please contact [CONFIRM: legal entity name] at [CONFIRM: legal contact email].",
      ],
    },
  ],
};

// =========================================================================
// 3. SECURITY DETAILS DATA
// =========================================================================

export const SECURITY_DATA: LegalDocumentData = {
  slug: "security",
  title: "Security Details",
  subtitle:
    "Cryptographic mechanisms, storage architecture, access controls, and verified boundaries built into Clario.",
  summary: [
    "Clario anchors expense commitments using SHA-256 over RFC 8785 canonical JSON with 32-byte salts; cleartext data is never written onchain.",
    "Corporate evidence files are protected with AES-256-GCM envelope encryption using unique 256-bit data encryption keys (DEKs).",
    "Duplicate reimbursement prevention is enforced both onchain (reverting transactions) and in the database layer.",
    "The software is currently unaudited and operates on Monad Testnet; no third-party audit report currently exists.",
  ],
  version: "1.0-draft",
  lastUpdated: "[CONFIRM: date]",
  isDraft: false,
  sections: [
    {
      id: "cryptographic-commitments",
      number: "01",
      title: "Cryptographic Commitments & Data Integrity",
      paragraphs: [
        "Clario solves the expense integrity problem by decoupling private financial evidence from public onchain validation. We achieve this using deterministic cryptographic commitments:",
      ],
      bullets: [
        "RFC 8785 JSON Canonicalization: Expense manifests are normalized using the IETF RFC 8785 JSON Canonicalization Scheme (JCS). This guarantees identical byte representations across TypeScript, Go, Python, and smart contract parsers regardless of key ordering or whitespace.",
        "SHA-256 Pre-Image Commitments: The canonical expense record is concatenated with a cryptographically secure 32-byte random salt and hashed using SHA-256. This commitment hash (bytes32) is what gets published to the blockchain.",
        "Rainbow Table Defense: The 32-byte random salt prevents dictionary attacks and brute-force guessing of common invoice amounts, vendor names, or dates.",
        "Note on Terminology: Clario uses SHA-256 pre-image commitments, NOT zero-knowledge proofs (ZKPs). We make no zero-knowledge claims.",
      ],
    },
    {
      id: "evidence-encryption",
      number: "02",
      title: "Evidence Storage & Envelope Encryption",
      paragraphs: [
        "When private evidence files (receipt scans, flight tickets, tax invoices) are submitted to corporate workspace storage, they are encrypted using an AES-256-GCM envelope encryption engine (apps/web/src/lib/evidence/crypto.ts):",
      ],
      bullets: [
        "Data Encryption Key (DEK): For every uploaded file, a unique 256-bit cryptographically random DEK is generated using node:crypto randomBytes.",
        "AES-256-GCM: The file payload is encrypted with AES-256-GCM using a unique 96-bit random initialization vector (IV) and producing a 128-bit authentication tag.",
        "Authenticated Associated Data (AAD): The workspace ID, expense ID, version number, and evidence ID are canonicalized and bound to the cipher as AAD. This guarantees that an encrypted object cannot be transplanted into another expense or workspace.",
        "Key Wrapping: The DEK is encrypted (wrapped) with a master 256-bit Key Encryption Key (KEK) loaded from the server's secure environment (CLARIO_EVIDENCE_KEK).",
        "Storage Isolation: Files are saved on disk as opaque .enc files under sanitized paths (evidence/{workspaceId}/{evidenceId}.enc) that contain zero merchant names, amounts, or filenames.",
      ],
    },
    {
      id: "duplicate-prevention",
      number: "03",
      title: "Duplicate Settlement & Fraud Prevention",
      paragraphs: [
        "Reimbursing the same expense twice is a major financial risk in corporate ledgers. Clario enforces duplicate protection across three independent layers:",
      ],
      bullets: [
        "Smart Contract Layer: ClarioSettlementRegistryV1 maintains an internal mapping (_isSettled[workspaceId][expenseId]). If a reimbursement transaction is attempted for an expense that was already settled, the contract reverts immediately.",
        "Database Layer: A partial unique index (idx_reimbursements_active_unique) enforces that only one active settlement can exist per expense. Furthermore, source transaction claims enforce slot uniqueness.",
        "Local Ingestion Layer: During onchain receipt indexing, getReceiptUniqueKey deduplicates incoming receipts based on normalized wallet address, chain ID, and transaction hash.",
      ],
    },
    {
      id: "approvals-and-versioning",
      number: "04",
      title: "Approval Lineage & Immutability Invariants",
      paragraphs: [
        "Clario guarantees that financial records cannot be modified retroactively without leaving a permanent audit trail:",
      ],
      bullets: [
        "Monotonic Version Progression: Version 1 requires previousCommitment == 0x0. Every subsequent version (V_n) must be strictly version == currentVersion + 1 and must bind to the exact hash of the predecessor.",
        "Approval Binding: An approval signature or decision binds to an exact version number and an exact 32-byte commitment hash. If a user edits an expense after approval, the commitment changes, and the approval is immediately invalidated.",
        "Self-Approval Prevention: Both the smart contract (ClarioDecisionRegistryV1) and server-side policy layer enforce SelfApprovalNotAllowed. Users cannot approve their own expense submissions.",
        "Mandatory Rejection Reasons: Rejecting or requesting changes on an expense requires submitting a deterministic 32-byte reason commitment hash.",
      ],
    },
    {
      id: "ai-authority-boundary",
      number: "05",
      title: "AI Authority & Access Restrictions",
      paragraphs: [
        "Artificial intelligence models (Google Gemini 2.5 Flash, Groq Llama 3.3) are architecturally isolated from privileged system actions:",
      ],
      bullets: [
        "No Private Keys: AI services hold zero signing keys and have no programmatic capability to sign messages or transactions.",
        "No Fund Movement: AI models cannot initiate, approve, or execute payments or contract calls.",
        "Advisory Only: AI responses populate suggested draft form fields only. Changes require explicit human submission.",
      ],
    },
    {
      id: "protection-matrix",
      number: "06",
      title: "What Clario Protects Against vs. What It Does Not",
      paragraphs: [
        "Security engineering requires transparency about technical boundaries. Here is an honest comparison:",
      ],
      twoColumn: {
        leftTitle: "What Clario Protects You From",
        leftItems: [
          "Retroactive tampering with submitted receipts without detection.",
          "Double reimbursement of the same expense or transaction.",
          "Self-approval of expenses by submitting users.",
          "Public onchain exposure of receipt images, merchant names, or passenger lists.",
          "Unauthorized modifications to approved expense commitments.",
          "Automated unauthorized fund movement by AI models.",
          "Cross-tenant access to private evidence files.",
        ],
        rightTitle: "What Clario Does NOT Protect You From",
        rightItems: [
          "Compromised user devices, keyloggers, or malicious browser extensions.",
          "Lost wallet private keys or forgotten seed phrases.",
          "Loss of local data if browser storage is cleared without ZIP export.",
          "Fraudulent or forged original documents uploaded by authorized humans.",
          "Network downtime or reorgs on the underlying Monad Testnet.",
          "Zero-day smart contract bugs in currently unaudited testnet contracts.",
          "Public visibility of wallet addresses and transaction timestamps on Monad.",
        ],
      },
    },
    {
      id: "smart-contract-details",
      number: "07",
      title: "Smart Contract Registry Details",
      paragraphs: [
        "The following smart contract is deployed on Monad Testnet (Chain ID 10143):",
      ],
      table: {
        caption: "Monad Testnet Protocol Registries",
        headers: ["Contract Name", "Network", "Address", "Explorer"],
        rows: [
          {
            cells: [
              { text: "ClarioRegistry (Coordinator)" },
              { text: "Monad Testnet (10143)" },
              { text: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87", mono: true },
              { text: "View on MonadExplorer" },
            ],
          },
        ],
      },
      bullets: [
        "Source Code: Publicly inspectable in the contracts/ directory of our GitHub repository (https://github.com/syther069/Clario).",
        "Explorer Link: https://testnet.monadexplorer.com/address/0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
      ],
    },
    {
      id: "security-status-table",
      number: "08",
      title: "Current Security Status Matrix",
      paragraphs: [
        "A verifiable inventory of Clario's current security features and limitations as built today:",
      ],
      table: {
        caption: "Feature Implementation & Audit State",
        headers: ["Security Feature", "Status", "Technical Details"],
        rows: [
          {
            cells: [
              { text: "RFC 8785 Canonical JSON Hashing" },
              { text: "Built", status: "built" },
              { text: "Verified across TypeScript fixtures and Foundry tests" },
            ],
          },
          {
            cells: [
              { text: "AES-256-GCM Envelope Encryption" },
              { text: "Built", status: "built" },
              { text: "Per-file 256-bit DEK with server KEK wrapping" },
            ],
          },
          {
            cells: [
              { text: "Onchain Monad Testnet Registries" },
              { text: "Built", status: "built" },
              { text: "Workspace, Expense, Decision, and Settlement contracts" },
            ],
          },
          {
            cells: [
              { text: "Duplicate Settlement Prevention" },
              { text: "Built", status: "built" },
              { text: "Enforced by contract revert and database unique constraints" },
            ],
          },
          {
            cells: [
              { text: "Self-Approval Prevention" },
              { text: "Built", status: "built" },
              { text: "Blocked onchain and in server authorization policies" },
            ],
          },
          {
            cells: [
              { text: "Offline Standalone Verifier CLI" },
              { text: "Built", status: "built" },
              { text: "Deterministic verification tool (pnpm verify:package)" },
            ],
          },
          {
            cells: [
              { text: "In-Memory Auth Rate Limiting" },
              { text: "Built", status: "built" },
              { text: "Sliding window on challenge and verify endpoints" },
            ],
          },
          {
            cells: [
              { text: "Third-Party Security Audit" },
              { text: "Not Available", status: "not_available" },
              { text: "Unaudited testnet preview; audit planned before mainnet" },
            ],
          },
          {
            cells: [
              { text: "Bug Bounty Program" },
              { text: "Not Available", status: "not_available" },
              { text: "No paid bounty program currently active" },
            ],
          },
          {
            cells: [
              { text: "Native Mobile Apps" },
              { text: "Not Available", status: "not_available" },
              { text: "Responsive web application only" },
            ],
          },
          {
            cells: [
              { text: "Centralized Account Recovery" },
              { text: "Not Available", status: "not_available" },
              { text: "Non-custodial by design; user controls private keys" },
            ],
          },
          {
            cells: [
              { text: "Accounting ERP Integrations" },
              { text: "Planned", status: "planned" },
              { text: "Direct sync with QuickBooks / Xero on roadmap" },
            ],
          },
        ],
      },
    },
    {
      id: "vulnerability-reporting",
      number: "09",
      title: "Vulnerability Reporting",
      paragraphs: [
        "We welcome responsible disclosure from security researchers. If you discover a vulnerability in Clario's smart contracts, backend APIs, or web application:",
      ],
      bullets: [
        "Reporting Contact: Email security findings to [CONFIRM: security contact email].",
        "What to Include: Detailed reproduction steps, proof of concept, affected contracts or routes, and potential impact assessment.",
        "Good Faith: We ask researchers to allow reasonable time for remediation prior to public disclosure, avoid disrupting services, and refrain from accessing user data without permission.",
        "Bounty Notice: As an early-stage hackathon preview on testnet, Clario does NOT currently offer paid financial bug bounties.",
      ],
    },
  ],
};

// =========================================================================
// 4. DISCLOSURE DATA (RISK & TRANSPARENCY)
// =========================================================================

export const DISCLOSURE_DATA: LegalDocumentData = {
  slug: "disclosure",
  title: "Disclosure",
  subtitle:
    "Risk disclosures, experimental software notice, technical limitations, and affiliation statements.",
  summary: [
    "Clario is experimental software deployed on Monad Testnet for demonstration. Do not use it with real funds.",
    "The smart contracts and web code are unaudited and may contain defects, vulnerabilities, or experience downtime.",
    "Cryptographic proofs attest to the mathematical integrity of records, not their legal, accounting, or tax validity.",
    "Network performance claims (such as Monad TPS or finality) reflect Monad's published specifications, not Clario guarantees.",
  ],
  version: "1.0-draft",
  lastUpdated: "[CONFIRM: date]",
  isDraft: false,
  sections: [
    {
      id: "testnet-notice",
      number: "01",
      title: "Experimental Software & Testnet Notice",
      paragraphs: [
        "Clario is experimental software developed for community testing and hackathon demonstration on Monad Testnet (Chain ID 10143).",
        "The application has not completed third-party security audits. Smart contracts may be upgraded, paused, or redeployed, and testnet data may be wiped or reset at any time. Under no circumstances should you attempt to deposit or transact real monetary assets, mainnet crypto assets, or sensitive legal files.",
      ],
      callout: {
        type: "important",
        title: "TESTNET ONLY — ZERO FINANCIAL VALUE",
        badge: "DO NOT USE REAL FUNDS",
        content:
          "All tokens (MON, testnet USDC) are testnet faucet assets. They have zero monetary value. Clario is not liable for any real assets sent to testnet contract addresses.",
      },
    },
    {
      id: "risk-factors",
      number: "02",
      title: "Technical and Operational Risk Factors",
      paragraphs: [
        "Users and evaluators should understand the inherent risks associated with using Clario:",
      ],
      bullets: [
        "Smart Contract Risk: Smart contracts deployed on public blockchains are subject to potential coding bugs, EVM compatibility edge cases, compiler vulnerabilities, and execution errors. Our contracts have not undergone a professional audit.",
        "Network and RPC Availability: Clario relies on the Monad Testnet and RPC node providers (such as Alchemy). RPC latency, node downtime, network reorgs, or validator halts can cause delayed transactions or temporary display errors.",
        "Browser Storage Risk: Plaintext drafts and local receipts reside in your browser's localStorage. If your browser storage is cleared, corrupted, or evicted due to disk space limits, all unexported local data will be permanently lost.",
        "Non-Custodial Key Risk: If you lose your wallet private key, recovery phrase, or device access, Clario cannot recover your identity or sign transactions for you.",
        "Human Error & Inaccurate Receipts: Cryptographic hashing proves that an expense record has not been altered since submission. It CANNOT verify whether the human submitter entered truthful financial information. A cryptographic commitment of an erroneous receipt is simply a cryptographically verified erroneous receipt.",
        "Public Onchain Footprint: Wallet addresses, commitment hashes, token addresses, and block timestamps are permanently public on the Monad blockchain. While cleartext invoices remain offchain, correlation analysis between wallet addresses is publicly possible.",
        "AI OCR Imperfections: Multimodal receipt extraction using Google Gemini 2.5 Flash is probabilistic. Numbers, dates, merchant names, and currencies can be misread or misclassified. Users are required to inspect and confirm all extracted fields.",
      ],
    },
    {
      id: "no-professional-advice",
      number: "03",
      title: "No Financial, Legal, Tax, or Accounting Advice",
      paragraphs: [
        "The information, tools, calculations, and cryptographic outputs provided by Clario are for informational, record-keeping, and demonstration purposes only.",
        "Clario does NOT provide financial advice, legal advice, investment advice, accounting services, or tax counsel. Cryptographic hashes and ZIP verification packages demonstrate data provenance and tamper-evidence; they do not constitute statutory tax receipts, regulatory filings, or certified audit certificates in any jurisdiction.",
        "You must consult a qualified accountant, legal advisor, or tax professional to ensure compliance with laws applicable to your personal or business affairs.",
      ],
    },
    {
      id: "network-performance",
      number: "04",
      title: "Network Performance Statements",
      paragraphs: [
        "Statements regarding Monad throughput (such as 10,000 transactions per second), 1-second block times, or pipelined consensus finality describe technical specifications and targets published by Monad Labs regarding the Monad blockchain network.",
        "They are not technical warranties, representations, or performance guarantees provided by Clario. Actual transaction confirmation speeds depend on network conditions, testnet gas pricing, and validator operation.",
      ],
    },
    {
      id: "third-party-dependencies",
      number: "05",
      title: "Third-Party Dependencies & Open-Source Software",
      paragraphs: [
        "Clario builds upon open-source software and external cloud services, including:",
      ],
      bullets: [
        "Open-Source Libraries: Viem, Wagmi, React, Next.js, Tailwind CSS, Motion, Lucide icons, and OpenZeppelin smart contract libraries.",
        "External Services: Google Cloud / Gemini API (OCR), Groq Inc. (LLM), Alchemy Insights (RPC and transfer lookups), DeFiLlama (historical pricing), Privy (wallet connection), and Supabase (database).",
        "Third-Party Outages: Clario is not responsible for interruptions, failures, rate limits, or changes in policy by third-party API providers.",
      ],
    },
    {
      id: "affiliations-and-funding",
      number: "06",
      title: "Affiliations, Grants, and Hackathon Disclosure",
      paragraphs: [
        "Clario is an independent software project created for the Monad Hackathon community. Clario is NOT an official product of Monad Labs, the Monad Foundation, or any associated entity.",
        "Hackathon Status: [CONFIRM: hackathon participation details, grant status, or funding disclosures].",
      ],
    },
    {
      id: "latest-information",
      number: "07",
      title: "Where to Find the Latest Information",
      paragraphs: [
        "For additional technical and operational information, consult our governing documentation:",
      ],
      bullets: [
        "Protocol Documentation: Visit /docs for the comprehensive technical specification and contract architecture.",
        "Security Overview: Visit /security for cryptographic algorithms, duplicate guards, and status matrices.",
        "Source Code: Public GitHub repository at https://github.com/syther069/Clario.",
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<string, LegalDocumentData> = {
  privacy: PRIVACY_POLICY_DATA,
  terms: TERMS_OF_SERVICE_DATA,
  security: SECURITY_DATA,
  disclosure: DISCLOSURE_DATA,
};
