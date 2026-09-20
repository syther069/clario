"use client";

import React, { useEffect, useState } from "react";
import { ExpenseDraftEditor } from "@/components/expense-draft-editor";
import { ExpenseList } from "@/components/expense-list";
import { NavRail } from "@/components/nav-rail";
import { ReviewQueueView } from "@/components/review-queue-view";
import { TreasuryQueueView } from "@/components/treasury-queue-view";
import { WorkspaceManager } from "@/components/workspace-manager";

export default function Home() {
  const [currentRoute, setCurrentRoute] = useState("workspace");
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null,
  );

  // In test or local demonstration mode, use mock account or session
  const dummyAccount = "0x1111111111111111111111111111111111111111";

  // Auto-load available workspaces if activeWsId not set
  useEffect(() => {
    let ignore = false;
    async function loadWorkspaces() {
      try {
        const res = await fetch("/api/workspaces");
        if (!res.ok) return;
        const data = (await res.json()) as {
          workspaces?: Array<{ workspaceId: string }>;
        };
        if (
          !ignore &&
          data.workspaces &&
          data.workspaces.length > 0 &&
          !activeWsId
        ) {
          setActiveWsId(data.workspaces[0]!.workspaceId);
        }
      } catch {
        // ignore
      }
    }
    loadWorkspaces();
    return () => {
      ignore = true;
    };
  }, [activeWsId]);

  return (
    <div className="app-shell">
      <NavRail
        currentRoute={currentRoute}
        onNavigate={(route) => {
          setCurrentRoute(route);
          if (route !== "expenses") {
            setSelectedExpenseId(null);
          }
        }}
        userAddress={dummyAccount}
        connectedChainId={31337}
        targetChainId={31337}
      />

      <main className="main-content" id="main-content">
        {currentRoute === "workspace" ? (
          <WorkspaceManager
            currentAccount={dummyAccount}
            connectedChainId={31337}
          />
        ) : currentRoute === "expenses" ? (
          activeWsId ? (
            selectedExpenseId ? (
              <ExpenseDraftEditor
                workspaceId={activeWsId}
                expenseId={selectedExpenseId}
                userAddress={dummyAccount}
                onBack={() => setSelectedExpenseId(null)}
                onDeleted={() => setSelectedExpenseId(null)}
              />
            ) : (
              <ExpenseList
                workspaceId={activeWsId}
                userAddress={dummyAccount}
                onSelectExpense={(expId) => setSelectedExpenseId(expId)}
              />
            )
          ) : (
            <div
              className="card"
              style={{ padding: "var(--space-12)", textAlign: "center" }}
            >
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: "0 0 var(--space-2)",
                }}
              >
                No Workspace Selected
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  maxWidth: "480px",
                  margin: "0 auto var(--space-6)",
                }}
              >
                You must select or create a team workspace before managing
                verifiable expense drafts.
              </p>
              <button
                onClick={() => setCurrentRoute("workspace")}
                className="btn btn-primary"
              >
                Go to Workspace Management
              </button>
            </div>
          )
        ) : currentRoute === "review" ? (
          activeWsId ? (
            <ReviewQueueView
              workspaceId={activeWsId}
              userAddress={dummyAccount}
            />
          ) : (
            <div
              className="card"
              style={{ padding: "var(--space-12)", textAlign: "center" }}
            >
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: "0 0 var(--space-2)",
                }}
              >
                No Workspace Selected
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  maxWidth: "480px",
                  margin: "0 auto var(--space-6)",
                }}
              >
                Select or create a workspace to access its authorized review
                queue.
              </p>
              <button
                onClick={() => setCurrentRoute("workspace")}
                className="btn btn-primary"
              >
                Go to Workspace Management
              </button>
            </div>
          )
        ) : currentRoute === "treasury" ? (
          activeWsId ? (
            <TreasuryQueueView
              workspaceId={activeWsId}
              userAddress={dummyAccount}
              connectedChainId={31337}
              onNavigateToExpense={(expId) => {
                setSelectedExpenseId(expId);
                setCurrentRoute("review");
              }}
            />
          ) : (
            <div
              className="card"
              style={{ padding: "var(--space-12)", textAlign: "center" }}
            >
              <h2
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: "0 0 var(--space-2)",
                }}
              >
                No Workspace Selected
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  maxWidth: "480px",
                  margin: "0 auto var(--space-6)",
                }}
              >
                Select or create a workspace to access its treasury settlement
                queue.
              </p>
              <button
                onClick={() => setCurrentRoute("workspace")}
                className="btn btn-primary"
              >
                Go to Workspace Management
              </button>
            </div>
          )
        ) : (
          <div
            className="card"
            style={{ padding: "var(--space-12)", textAlign: "center" }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                margin: "0 0 var(--space-2)",
              }}
            >
              {currentRoute.charAt(0).toUpperCase() + currentRoute.slice(1)}{" "}
              Ledger
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                maxWidth: "480px",
                margin: "0 auto var(--space-6)",
              }}
            >
              This section is configured to interact with Monad expense
              pipelines. Select <strong>Workspace</strong> or{" "}
              <strong>Expenses</strong> to manage verifiable records.
            </p>
            <button
              onClick={() => setCurrentRoute("expenses")}
              className="btn btn-primary"
            >
              Go to Expense Ledger
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
