import type {
  Transaction,
  Subscription,
  Budget,
  Client,
  Invoice,
  FamilyMember,
  FamilyBill,
  FamilySettlement,
  BusinessTeamMember,
  BusinessReimbursement,
  ExpensePolicy,
  BusinessAuditEvent,
} from "@/lib/supabase/types";

export interface CopilotContext {
  transactions: Transaction[];
  subscriptions: Subscription[];
  budgets: Budget[];
  activeMode: string;
  userName?: string;
  // Mode Specific Grounded Data
  clients?: Client[];
  invoices?: Invoice[];
  familyMembers?: FamilyMember[];
  familyBills?: FamilyBill[];
  familySettlements?: FamilySettlement[];
  businessTeam?: BusinessTeamMember[];
  businessClaims?: BusinessReimbursement[];
  businessPolicies?: ExpensePolicy[];
  businessAuditEvents?: BusinessAuditEvent[];
}

export interface CopilotMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CopilotInsight {
  id: string;
  type: "warning" | "opportunity" | "info" | "compliance";
  title: string;
  message: string;
  mode: "personal" | "freelancer" | "family" | "business" | "all";
  actionPrompt?: string;
}

/**
 * Detects real cross-mode financial anomalies and actionable intelligence signals (Rule 40: Zero mock data).
 */
export function detectFinancialAnomalies(
  ctx: CopilotContext,
): CopilotInsight[] {
  const insights: CopilotInsight[] = [];

  // 1. Budget Overrun / High Capacity Check
  ctx.budgets.forEach((b) => {
    const limit = Number(b.amount_limit || 0);
    const spent = Number(b.spent_amount || 0);
    if (limit > 0 && spent >= limit) {
      insights.push({
        id: `budget-exceeded-${b.id}`,
        type: "warning",
        title: `Budget Exceeded: ${b.category_id || "Category"}`,
        message: `Current spending ($${spent.toFixed(2)}) has exceeded the $${limit.toFixed(2)} limit.`,
        mode: "personal",
        actionPrompt: `How can I reduce spending in my ${b.category_id || "general"} budget?`,
      });
    } else if (limit > 0 && spent / limit >= 0.85) {
      insights.push({
        id: `budget-warn-${b.id}`,
        type: "warning",
        title: `Budget Near Limit: ${b.category_id || "Category"}`,
        message: `At ${Math.round((spent / limit) * 100)}% capacity ($${spent.toFixed(2)} / $${limit.toFixed(2)}).`,
        mode: "personal",
        actionPrompt: `Analyze my ${b.category_id || "category"} budget spending velocity.`,
      });
    }
  });

  // 2. Freelancer: Outstanding Unpaid Invoices
  if (ctx.invoices && ctx.invoices.length > 0) {
    const unpaid = ctx.invoices.filter(
      (i) => i.status === "sent" || i.status === "overdue",
    );
    const overdue = ctx.invoices.filter((i) => i.status === "overdue");
    const unpaidTotal = unpaid.reduce(
      (sum, i) => sum + Number(i.total_amount || 0),
      0,
    );

    if (overdue.length > 0) {
      insights.push({
        id: "freelancer-overdue-invoices",
        type: "warning",
        title: `${overdue.length} Overdue Client Invoice(s)`,
        message: `Action needed on past-due invoices totaling $${unpaidTotal.toFixed(2)}.`,
        mode: "freelancer",
        actionPrompt:
          "Summarize my overdue client invoices and draft a polite payment reminder.",
      });
    } else if (unpaid.length > 0) {
      insights.push({
        id: "freelancer-unpaid-invoices",
        type: "opportunity",
        title: `${unpaid.length} Pending Invoices ($${unpaidTotal.toFixed(2)})`,
        message: `Outstanding client balances awaiting payment.`,
        mode: "freelancer",
        actionPrompt:
          "Summarize my unpaid client invoices and payment due dates.",
      });
    }
  }

  // 3. Family: Unpaid Bills & Settlements
  if (ctx.familyBills && ctx.familyBills.length > 0) {
    const unpaidBills = ctx.familyBills.filter((b) => b.status !== "paid");
    const unpaidTotal = unpaidBills.reduce(
      (sum, b) => sum + Number(b.amount || 0),
      0,
    );
    if (unpaidBills.length > 0) {
      insights.push({
        id: "family-unpaid-bills",
        type: "warning",
        title: `${unpaidBills.length} Household Bill(s) Due`,
        message: `Pending bills totaling $${unpaidTotal.toFixed(2)} requiring settlement.`,
        mode: "family",
        actionPrompt:
          "Which household bills are due soon and what are their amounts?",
      });
    }
  }

  if (ctx.familySettlements && ctx.familySettlements.length > 0) {
    const pendingSettlements = ctx.familySettlements.filter(
      (s) => s.status === "pending",
    );
    const pendingTotal = pendingSettlements.reduce(
      (sum, s) => sum + Number(s.amount || 0),
      0,
    );
    if (pendingSettlements.length > 0) {
      insights.push({
        id: "family-pending-settlements",
        type: "info",
        title: `${pendingSettlements.length} Pending Household Settlement(s)`,
        message: `$${pendingTotal.toFixed(2)} in shared expense reimbursements.`,
        mode: "family",
        actionPrompt:
          "Who owes money in our household settlements and what are the amounts?",
      });
    }
  }

  // 4. Business: Pending Approvals & Policy Checks
  if (ctx.businessClaims && ctx.businessClaims.length > 0) {
    const pendingClaims = ctx.businessClaims.filter(
      (c) => c.status === "submitted" || c.status === "under_review",
    );
    const pendingTotal = pendingClaims.reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0,
    );
    if (pendingClaims.length > 0) {
      insights.push({
        id: "business-pending-claims",
        type: "compliance",
        title: `${pendingClaims.length} Reimbursement Claim(s) Awaiting Review`,
        message: `$${pendingTotal.toFixed(2)} in corporate expenses requiring approval.`,
        mode: "business",
        actionPrompt:
          "Review pending corporate reimbursement claims and verify policy compliance.",
      });
    }

    // Policy violation check
    if (ctx.businessPolicies && ctx.businessPolicies.length > 0) {
      const violatedClaims = pendingClaims.filter((c) => {
        const policy = ctx.businessPolicies?.find(
          (p) => p.category.toLowerCase() === (c.category || "").toLowerCase(),
        );
        return policy && Number(c.amount) > Number(policy.max_single_amount);
      });

      if (violatedClaims.length > 0) {
        insights.push({
          id: "business-policy-violation",
          type: "warning",
          title: `Policy Cap Exceeded: ${violatedClaims.length} Claim(s)`,
          message: `One or more claims exceed the single transaction cap for their category.`,
          mode: "business",
          actionPrompt:
            "Check for any expense policy violations across our corporate claims.",
        });
      }
    }
  }

  // 5. Subscription Outflow Audit (All Modes)
  if (ctx.subscriptions && ctx.subscriptions.length > 0) {
    const activeSubs = ctx.subscriptions.filter((s) => s.status === "active");
    const subTotal = activeSubs.reduce(
      (sum, s) => sum + Number(s.amount || 0),
      0,
    );
    const totalExpense = ctx.transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    if (totalExpense > 0 && subTotal / totalExpense >= 0.25) {
      insights.push({
        id: "high-subscription-load",
        type: "opportunity",
        title: "High Subscription Load",
        message: `Recurring subscriptions represent ${Math.round((subTotal / totalExpense) * 100)}% of expenses ($${subTotal.toFixed(2)}/mo).`,
        mode: "personal",
        actionPrompt:
          "Analyze my recurring subscriptions and suggest ways to optimize.",
      });
    }
  }

  return insights;
}

/**
 * Anonymizes PII (person names, client names, invoice identifiers, emails, wallet addresses)
 * before transmission to external AI model providers (Groq/Gemini).
 */
export function anonymizeCopilotContext(ctx: CopilotContext): CopilotContext {
  const anonUserName = "User";

  const clientNameMap = new Map<string, string>();
  let clientIndex = 1;
  const getAnonClientName = (original?: string | null) => {
    if (!original) return "Client";
    if (!clientNameMap.has(original)) {
      clientNameMap.set(
        original,
        `Client ${String.fromCharCode(64 + (((clientIndex - 1) % 26) + 1))}`,
      );
      clientIndex++;
    }
    return clientNameMap.get(original)!;
  };

  const memberNameMap = new Map<string, string>();
  let memberIndex = 1;
  const getAnonMemberName = (original?: string | null) => {
    if (!original) return "Member";
    if (!memberNameMap.has(original)) {
      memberNameMap.set(original, `Member ${memberIndex++}`);
    }
    return memberNameMap.get(original)!;
  };

  const sanitizeText = (text?: string | null): string => {
    if (!text) return "";
    return (
      text
        // Mask EVM / Hex addresses
        .replace(
          /0x[a-fA-F0-9]{40}/g,
          (match) => `${match.slice(0, 6)}...${match.slice(-4)}`,
        )
        // Mask email addresses
        .replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          "[REDACTED_EMAIL]",
        )
        // Mask credit card numbers
        .replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, "[REDACTED_CARD]")
        // Mask phone numbers
        .replace(
          /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
          "[REDACTED_PHONE]",
        )
    );
  };

  // 1. Anonymize Transactions
  const anonTransactions: Transaction[] = ctx.transactions.map((tx) => {
    const sanitized: Transaction = {
      ...tx,
      merchant: sanitizeText(tx.merchant),
    };
    if (tx.description !== undefined) {
      sanitized.description = sanitizeText(tx.description);
    }
    if (tx.notes !== undefined) {
      sanitized.notes = tx.notes ? sanitizeText(tx.notes) : tx.notes;
    }
    return sanitized;
  });

  // 2. Anonymize Clients
  const anonClients: Client[] | undefined = ctx.clients?.map((c) => {
    const client: Client = {
      ...c,
      name: getAnonClientName(c.name),
    };
    if (c.company !== undefined) {
      client.company = c.company
        ? `Company ${c.company.slice(0, 2).toUpperCase()}***`
        : c.company;
    }
    if (c.email !== undefined) {
      client.email = c.email ? "[REDACTED_EMAIL]" : c.email;
    }
    if (c.notes !== undefined) {
      client.notes = c.notes ? sanitizeText(c.notes) : c.notes;
    }
    return client;
  });

  // 3. Anonymize Invoices
  const anonInvoices: Invoice[] | undefined = ctx.invoices?.map((i) => {
    const rawNum = i.invoice_number || "";
    const maskedNum = rawNum.replace(/\d{4,}/g, (m) => `***${m.slice(-2)}`);
    const invoice: Invoice = {
      ...i,
      invoice_number: maskedNum || `INV-***`,
      client_name: getAnonClientName(i.client_name),
    };
    if (i.notes !== undefined) {
      invoice.notes = i.notes ? sanitizeText(i.notes) : i.notes;
    }
    return invoice;
  });

  // 4. Anonymize Family
  const anonFamilyMembers: FamilyMember[] | undefined = ctx.familyMembers?.map(
    (m) => ({
      ...m,
      name: getAnonMemberName(m.name),
    }),
  );

  const anonFamilyBills: FamilyBill[] | undefined = ctx.familyBills?.map(
    (b) => {
      const bill: FamilyBill = {
        ...b,
        name: sanitizeText(b.name),
      };
      if (b.paid_by_name !== undefined) {
        bill.paid_by_name = b.paid_by_name
          ? getAnonMemberName(b.paid_by_name)
          : b.paid_by_name;
      }
      return bill;
    },
  );

  const anonFamilySettlements: FamilySettlement[] | undefined =
    ctx.familySettlements?.map((s) => ({
      ...s,
      from_member_name: getAnonMemberName(s.from_member_name),
      to_member_name: getAnonMemberName(s.to_member_name),
    }));

  // 5. Anonymize Business
  const anonBusinessTeam: BusinessTeamMember[] | undefined =
    ctx.businessTeam?.map((m) => ({
      ...m,
      name: getAnonMemberName(m.name),
    }));

  const anonBusinessClaims: BusinessReimbursement[] | undefined =
    ctx.businessClaims?.map((c) => {
      const claim: BusinessReimbursement = {
        ...c,
        title: sanitizeText(c.title),
        employee_name: getAnonMemberName(c.employee_name),
      };
      if (c.reviewed_by !== undefined) {
        claim.reviewed_by = c.reviewed_by
          ? getAnonMemberName(c.reviewed_by)
          : c.reviewed_by;
      }
      if (c.review_notes !== undefined) {
        claim.review_notes = c.review_notes
          ? sanitizeText(c.review_notes)
          : c.review_notes;
      }
      if (c.notes !== undefined) {
        claim.notes = c.notes ? sanitizeText(c.notes) : c.notes;
      }
      return claim;
    });

  const result: CopilotContext = {
    ...ctx,
    userName: anonUserName,
    transactions: anonTransactions,
  };

  if (anonClients !== undefined) {
    result.clients = anonClients;
  }
  if (anonInvoices !== undefined) {
    result.invoices = anonInvoices;
  }
  if (anonFamilyMembers !== undefined) {
    result.familyMembers = anonFamilyMembers;
  }
  if (anonFamilyBills !== undefined) {
    result.familyBills = anonFamilyBills;
  }
  if (anonFamilySettlements !== undefined) {
    result.familySettlements = anonFamilySettlements;
  }
  if (anonBusinessTeam !== undefined) {
    result.businessTeam = anonBusinessTeam;
  }
  if (anonBusinessClaims !== undefined) {
    result.businessClaims = anonBusinessClaims;
  }

  return result;
}

/**
 * Builds grounded system prompt providing real financial numbers so the AI never hallucinates.
 */
export function buildGroundedSystemPrompt(ctx: CopilotContext): string {
  const totalIncome = ctx.transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = ctx.transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlySubs = ctx.subscriptions
    .filter((s) => s.status === "active")
    .map((s) => `- ${s.name}: $${Number(s.amount).toFixed(2)} (${s.frequency})`)
    .join("\n");

  const recentTx = ctx.transactions
    .slice(0, 15)
    .map(
      (t) =>
        `- ${t.date || t.timestamp}: ${t.description || t.merchant} | $${Number(t.amount).toFixed(2)} [${t.type}] | Category: ${typeof t.category === "string" ? t.category : t.category?.name || t.category_id || "General"}`,
    )
    .join("\n");

  const budgetSummary = ctx.budgets
    .map(
      (b) =>
        `- ${b.period} limit: $${Number(b.amount_limit).toFixed(2)} (Spent: $${Number(b.spent_amount || 0).toFixed(2)})`,
    )
    .join("\n");

  // Mode Specific Grounded Prompts
  let modeSpecificPrompt = "";

  if (ctx.activeMode === "freelancer") {
    const clientsList = (ctx.clients || [])
      .map(
        (c) =>
          `- ${c.name} (${c.company || "Independent"}): Status ${c.status}${c.hourly_rate ? `, Rate: $${c.hourly_rate}/hr` : ""}`,
      )
      .join("\n");
    const invoicesList = (ctx.invoices || [])
      .map(
        (i) =>
          `- Invoice #${i.invoice_number} to ${i.client_name}: $${Number(i.total_amount).toFixed(2)} [${i.status.toUpperCase()}] Due: ${i.due_date || "N/A"}`,
      )
      .join("\n");
    const deductibleTotal = ctx.transactions
      .filter((t) => t.type === "expense" && t.tax_deductible)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    modeSpecificPrompt = `
FREELANCER DATA:
- Total Deductible Business Expenses: $${deductibleTotal.toFixed(2)}
- Registered Clients:
${clientsList || "No clients recorded yet."}
- Invoices:
${invoicesList || "No invoices created yet."}
`;
  } else if (ctx.activeMode === "family") {
    const membersList = (ctx.familyMembers || [])
      .map((m) => `- ${m.name} (${m.role})`)
      .join("\n");
    const billsList = (ctx.familyBills || [])
      .map(
        (b) =>
          `- ${b.name}: $${Number(b.amount).toFixed(2)} due ${b.due_date} [${b.status.toUpperCase()}]`,
      )
      .join("\n");
    const settlementsList = (ctx.familySettlements || [])
      .map(
        (s) =>
          `- Settlement: ${s.from_member_name} owes ${s.to_member_name} $${Number(s.amount).toFixed(2)} [${s.status.toUpperCase()}]`,
      )
      .join("\n");

    modeSpecificPrompt = `
FAMILY & HOUSEHOLD DATA:
- Household Members:
${membersList || "No family members recorded."}
- Recurring Household Bills:
${billsList || "No bills recorded."}
- Settlements & Reimbursements:
${settlementsList || "No settlements recorded."}
`;
  } else if (ctx.activeMode === "business") {
    const teamList = (ctx.businessTeam || [])
      .map(
        (m) =>
          `- ${m.name} (${m.role}, ${m.department}): Monthly Limit $${Number(m.spending_limit_monthly || 0).toFixed(2)}`,
      )
      .join("\n");
    const claimsList = (ctx.businessClaims || [])
      .map(
        (c) =>
          `- Claim: ${c.title} by ${c.employee_name}: $${Number(c.amount).toFixed(2)} [${c.status.toUpperCase()}] Department: ${c.department}`,
      )
      .join("\n");
    const policiesList = (ctx.businessPolicies || [])
      .map(
        (p) =>
          `- Policy [${p.category}]: Max Single $${Number(p.max_single_amount).toFixed(2)}, Monthly $${Number(p.monthly_budget).toFixed(2)}, Receipt Req: $${Number(p.requires_receipt_above).toFixed(2)}`,
      )
      .join("\n");

    modeSpecificPrompt = `
CORPORATE BUSINESS DATA:
- Team Roster:
${teamList || "No team members recorded."}
- Reimbursement Claims:
${claimsList || "No claims submitted."}
- Spend Policies:
${policiesList || "No policies defined."}
`;
  }

  return `You are Clario, an ultra-precise, intelligent financial copilot and expense analyst.
Current Mode: ${ctx.activeMode}
User Name: ${ctx.userName || "Valued User"}

GROUNDED FINANCIAL DATA FOR THIS USER:
- Total Inflows: $${totalIncome.toFixed(2)}
- Total Outflows: $${totalExpense.toFixed(2)}
- Net Cash Flow: $${(totalIncome - totalExpense).toFixed(2)}
- Active Subscriptions:
${monthlySubs || "No active subscriptions recorded."}
- Recent Transactions (up to 15):
${recentTx || "No recent transactions found."}
- Budgets:
${budgetSummary || "No budgets set."}
${modeSpecificPrompt}

RULES:
1. Ground all answers strictly in the data above. If data is missing, clearly state that rather than making up numbers.
2. Be concise, actionable, and helpful.
3. Suggest smart optimizations (e.g. redundant subscriptions, high-expense categories, tax-deductible items, pending approvals).
4. Maintain a modern, confident, fintech advisor tone.`;
}

/**
 * Executes Copilot query through Groq or Gemini with local deterministic fallback.
 */
export async function queryClarioCopilot(
  messages: CopilotMessage[],
  ctx: CopilotContext,
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const safeCtx = anonymizeCopilotContext(ctx);
  const systemPrompt = buildGroundedSystemPrompt(safeCtx);

  // 1. Try Groq (ultra-fast Llama-3.3-70b)
  if (groqKey && groqKey !== "your_groq_api_key_here") {
    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        },
      );

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (e) {
      console.warn("Groq copilot call failed, falling back to Gemini:", e);
    }
  }

  // 2. Try Gemini (gemini-2.5-flash)
  if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
    try {
      const contents = [
        {
          role: "user",
          parts: [{ text: `System Context:\n${systemPrompt}` }],
        },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
        },
      );

      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      console.warn("Gemini copilot call failed:", e);
    }
  }

  // 3. Grounded local deterministic fallback
  const lastUserMsg =
    messages[messages.length - 1]?.content.toLowerCase() || "";
  const totalExpense = ctx.transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalIncome = ctx.transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Freelancer specific queries
  if (
    lastUserMsg.includes("invoice") ||
    lastUserMsg.includes("unpaid") ||
    lastUserMsg.includes("billed")
  ) {
    const invoices = ctx.invoices || [];
    const unpaid = invoices.filter(
      (i) => i.status === "sent" || i.status === "overdue",
    );
    const unpaidTotal = unpaid.reduce(
      (sum, i) => sum + Number(i.total_amount || 0),
      0,
    );
    const paid = invoices.filter((i) => i.status === "paid");
    const paidTotal = paid.reduce(
      (sum, i) => sum + Number(i.total_amount || 0),
      0,
    );

    return `You have ${invoices.length} total invoice(s) recorded. Outstanding unpaid receivables: $${unpaidTotal.toFixed(2)} across ${unpaid.length} invoice(s). Total collected YTD: $${paidTotal.toFixed(2)}. ${
      unpaid.length > 0
        ? `Unpaid invoices include: ${unpaid.map((i) => `#${i.invoice_number} to ${i.client_name} ($${Number(i.total_amount).toFixed(2)})`).join(", ")}.`
        : "All issued client invoices have been cleared."
    }`;
  }

  if (
    lastUserMsg.includes("tax") ||
    lastUserMsg.includes("deduct") ||
    lastUserMsg.includes("write-off")
  ) {
    const deductibleTotal = ctx.transactions
      .filter((t) => t.type === "expense" && t.tax_deductible)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const estimatedTaxRate = 0.25;
    const estimatedSavings = deductibleTotal * estimatedTaxRate;

    return `Your deductible business expenses currently total $${deductibleTotal.toFixed(2)}. At an estimated 25% tax bracket, these deductions reduce your estimated tax liability by approximately $${estimatedSavings.toFixed(2)}. Ensure you retain receipt proofs anchored on Monad for complete audit compliance.`;
  }

  // Family specific queries
  if (
    lastUserMsg.includes("household") ||
    lastUserMsg.includes("bill") ||
    lastUserMsg.includes("owe") ||
    lastUserMsg.includes("settle")
  ) {
    const bills = ctx.familyBills || [];
    const unpaidBills = bills.filter((b) => b.status !== "paid");
    const unpaidBillsTotal = unpaidBills.reduce(
      (sum, b) => sum + Number(b.amount || 0),
      0,
    );
    const settlements = ctx.familySettlements || [];
    const pendingSettlements = settlements.filter(
      (s) => s.status === "pending",
    );

    return `Household Status: You have ${unpaidBills.length} unpaid bill(s) totaling $${unpaidBillsTotal.toFixed(2)}${
      unpaidBills.length > 0
        ? ` (${unpaidBills.map((b) => `${b.name}: $${Number(b.amount).toFixed(2)}`).join(", ")})`
        : ""
    }. There are ${pendingSettlements.length} pending settlement(s) across household members.`;
  }

  // Business specific queries
  if (
    lastUserMsg.includes("reimburse") ||
    lastUserMsg.includes("claim") ||
    lastUserMsg.includes("policy") ||
    lastUserMsg.includes("corporate")
  ) {
    const claims = ctx.businessClaims || [];
    const pending = claims.filter(
      (c) => c.status === "submitted" || c.status === "under_review",
    );
    const pendingTotal = pending.reduce(
      (sum, c) => sum + Number(c.amount || 0),
      0,
    );
    const policies = ctx.businessPolicies || [];

    return `Corporate Claims Overview: ${pending.length} claim(s) pending review totaling $${pendingTotal.toFixed(2)}. Total policies active: ${policies.length}. ${
      pending.length > 0
        ? `Pending items: ${pending.map((c) => `"${c.title}" by ${c.employee_name} ($${Number(c.amount).toFixed(2)})`).join(", ")}.`
        : "No pending claims require manager or finance approval at this time."
    }`;
  }

  // Subscription queries
  if (lastUserMsg.includes("sub") || lastUserMsg.includes("recurring")) {
    const subTotal = ctx.subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + Number(s.amount), 0);
    return `You have ${ctx.subscriptions.length} recurring subscriptions recorded ($${subTotal.toFixed(2)}/mo total). Ensure you audit services you don't use regularly to free up monthly cash flow. (Note: Add your GROQ_API_KEY or GEMINI_API_KEY in apps/web/.env.local for full multi-turn conversational intelligence).`;
  }

  // Budget queries
  if (lastUserMsg.includes("budget") || lastUserMsg.includes("limit")) {
    const totalLimit = ctx.budgets.reduce(
      (sum, b) => sum + Number(b.amount_limit),
      0,
    );
    const totalSpent = ctx.budgets.reduce(
      (sum, b) => sum + Number(b.spent_amount || 0),
      0,
    );
    return `You have ${ctx.budgets.length} budget category limits set. Total budget allocated: $${totalLimit.toFixed(2)}, with $${totalSpent.toFixed(2)} spent so far.`;
  }

  // General spending queries
  if (
    lastUserMsg.includes("spend") ||
    lastUserMsg.includes("expense") ||
    lastUserMsg.includes("total")
  ) {
    return `Your recorded expenses currently total $${totalExpense.toFixed(2)}. ${
      ctx.transactions.length === 0
        ? "No transactions have been recorded yet. You can upload a receipt or add a transaction to begin tracking."
        : `Tracking across ${ctx.transactions.length} recorded items.`
    }`;
  }

  // Cash flow queries
  if (
    lastUserMsg.includes("cash flow") ||
    lastUserMsg.includes("net") ||
    lastUserMsg.includes("income") ||
    lastUserMsg.includes("inflow")
  ) {
    const net = totalIncome - totalExpense;
    return `Net Cash Flow: $${net.toFixed(2)} (Total Inflows: $${totalIncome.toFixed(2)} vs Total Outflows: $${totalExpense.toFixed(2)}). Your cash flow is currently ${net >= 0 ? "positive and healthy" : "negative, with expenses exceeding inflows"}.`;
  }

  // Monad / Proof verification queries
  if (
    lastUserMsg.includes("proof") ||
    lastUserMsg.includes("monad") ||
    lastUserMsg.includes("verify") ||
    lastUserMsg.includes("onchain") ||
    lastUserMsg.includes("hash")
  ) {
    const anchoredTx = ctx.transactions.filter(
      (t) => t.verification_state === "anchored_onchain" || t.receipt_bundle_id,
    );
    return `Clario Cryptographic Verification: Tracking ${anchoredTx.length} verified transaction(s) and receipt bundles anchored on Monad Testnet (Chain ID 10143). Merkle roots and deterministic receipts can be verified without trusting any central server.`;
  }

  return `I am your Clario Financial Copilot. Mode: ${ctx.activeMode.toUpperCase()}. I analyze your cash flows, track subscriptions, inspect OCR receipt breakdowns, and ensure your ledger entries are anchored cryptographically. How can I help you organize your finances today? (To enable live LLM generation, set GROQ_API_KEY or GEMINI_API_KEY in apps/web/.env.local).`;
}
