export interface WorkspaceModeData {
  id: "personal" | "freelancer" | "family" | "business" | "crypto";
  name: string;
  promise: string;
  description: string;
  bestFor: string;
  useCases: string[];
  linkText: string;
  preview: {
    stat1: string;
    stat1Label: string;
    stat2: string;
    stat2Label: string;
    badge: string;
    recent: string;
    recentStatus: string;
  };
}

export const WORKSPACES_DATA: WorkspaceModeData[] = [
  {
    id: "personal",
    name: "Personal",
    promise: "See where your money goes with zero bank logins required.",
    description:
      "Track your cash, cards, and crypto expenses in one private place. Set monthly category targets and spot recurring subscriptions before they renew.",
    bestFor:
      "People who want to see where their money goes without linking a bank account.",
    useCases: [
      "You buy coffee or groceries and want to log the amount without sharing your bank credentials.",
      "A recurring software subscription is coming up. Clario flags it early so you can cancel or adjust.",
      "You hold both cash and crypto and want one private view of your monthly spending.",
    ],
    linkText: "Open in Personal mode",
    preview: {
      stat1: "$3,420.50",
      stat1Label: "Monthly Outflow",
      stat2: "14 Active",
      stat2Label: "Subscriptions Tracked",
      badge: "84% Budget Health",
      recent: "Whole Foods Organic Groceries — $124.80",
      recentStatus: "Saved on device",
    },
  },
  {
    id: "freelancer",
    name: "Freelancer",
    promise: "Bill clients for project expenses with instant, indisputable proof.",
    description:
      "Tag expenses to specific clients, organize your tax deductions, and send clean reimbursement links that prove payment without leaking personal invoice details.",
    bestFor:
      "Independent contractors, consultants, and creators billing project costs to clients.",
    useCases: [
      "A client asks what a $120 charge was. You send proof in one link, without exposing the receipt.",
      "Tax season arrives. All your deductible business purchases are already sorted in one list.",
      "You pay upfront for project software and get reimbursed immediately with clear proof.",
    ],
    linkText: "Open in Freelancer mode",
    preview: {
      stat1: "$8,950.00",
      stat1Label: "Unbilled Reimbursements",
      stat2: "$3,240.00",
      stat2Label: "Tax Deductions",
      badge: "6 Clients Active",
      recent: "Figma Team License (Acme) — $75.00",
      recentStatus: "Ready to bill",
    },
  },
  {
    id: "family",
    name: "Family",
    promise: "Share household expenses and settle balances without awkward math.",
    description:
      "Pool grocery runs, utility payments, and childcare costs across family members. Everyone sees what was spent and who is owed, with zero guesswork.",
    bestFor:
      "Couples, roommates, and households managing shared living costs together.",
    useCases: [
      "One partner buys $180 of groceries. Clario updates the shared balance in seconds.",
      "Monthly electric and internet bills arrive. The pool splits them fairly so no one pays twice.",
      "At the end of the month, one click shows exactly who sends what to square up.",
    ],
    linkText: "Open in Family mode",
    preview: {
      stat1: "$4,120.00",
      stat1Label: "Household Pool",
      stat2: "100% Balanced",
      stat2Label: "Settlement Status",
      badge: "4 Members",
      recent: "City Water & Power Utility — $142.50",
      recentStatus: "Split 50/50",
    },
  },
  {
    id: "business",
    name: "Business",
    promise: "Team expense management with real people approving payouts.",
    description:
      "Employees submit receipts, managers review with clear context, and treasury pays out on Monad. Smart contract guards guarantee no receipt is ever reimbursed twice.",
    bestFor:
      "Startups and teams that need fast reimbursements and strict duplicate controls.",
    useCases: [
      "An engineer buys cloud server credits. A manager approves, and payment goes out in seconds.",
      "An employee accidentally submits the same travel receipt twice. Clario blocks the duplicate automatically.",
      "Auditors ask for proof of last quarter's spend. You export a verified package that speaks for itself.",
    ],
    linkText: "Open in Business mode",
    preview: {
      stat1: "$42,800.00",
      stat1Label: "Team Monthly Burn",
      stat2: "3 Pending",
      stat2Label: "Approvals to Review",
      badge: "99.8% Policy Adherence",
      recent: "AWS Cloud Compute Clusters — $2,840.00",
      recentStatus: "Approved by Treasury",
    },
  },
  {
    id: "crypto",
    name: "Crypto",
    promise: "Track onchain payments, token outflows, and Monad proofs in one ledger.",
    description:
      "Ingest multi-chain transfers from Monad, Base, and Ethereum via Alchemy or direct RPC. Anchor immutable receipt commitments on Monad Testnet without exposing private data.",
    bestFor:
      "Crypto natives, protocol contributors, and DAOs tracking onchain token payments and gas.",
    useCases: [
      "You send USDC or MON on Monad Testnet and want verifiable expense records with explorer links.",
      "You import recent wallet transactions across chains without sharing private transaction context.",
      "You want zero duplicate reimbursements: smart contracts enforce payment uniqueness onchain.",
    ],
    linkText: "Open in Crypto mode",
    preview: {
      stat1: "1,240 MON",
      stat1Label: "Onchain Volume",
      stat2: "100% Anchored",
      stat2Label: "Monad Proof Status",
      badge: "Monad 10143",
      recent: "USDC Transfer to Contributor — 450.00 USDC",
      recentStatus: "Verified on Monad",
    },
  },
];
