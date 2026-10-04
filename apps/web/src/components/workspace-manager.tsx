"use client";

import React, { useState, useEffect, useCallback } from "react";
import type {
  PreparedTransactionIntent,
  WorkspaceMemberDetails,
  WorkspaceSummary,
} from "@/lib/workspace/types";
import { IntentDialog, type TransactionLifecycleStatus } from "./intent-dialog";
import { X, CheckCircle2 } from "lucide-react";

export interface WorkspaceManagerProps {
  currentAccount?: string | undefined;
  connectedChainId?: number | undefined;
  csrfToken?: string | undefined;
}

export function WorkspaceManager({
  currentAccount,
  connectedChainId = 31337,
  csrfToken,
}: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");

  const [isGrantRoleOpen, setIsGrantRoleOpen] = useState(false);
  const [grantAccount, setGrantAccount] = useState("");
  const [grantRole, setGrantRole] = useState("APPROVER_ROLE");
  const [grantScope, setGrantScope] = useState(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  );

  // Intent Review
  const [isIntentOpen, setIsIntentOpen] = useState(false);
  const [preparedIntent, setPreparedIntent] =
    useState<PreparedTransactionIntent | null>(null);
  const [txStatus, setTxStatus] =
    useState<TransactionLifecycleStatus>("preparing");
  const [activeTxHash, setActiveTxHash] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<{
    action: "grant" | "revoke";
    account: `0x${string}`;
    role: string;
    scope: string;
  } | null>(null);

  const reloadWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to load workspaces.");
      const data = (await res.json()) as { workspaces: WorkspaceSummary[] };
      setWorkspaces(data.workspaces || []);
      if (data.workspaces?.length && !selectedWsId) {
        setSelectedWsId(data.workspaces[0]!.workspaceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading workspaces");
    } finally {
      setLoading(false);
    }
  }, [selectedWsId]);

  const reloadMembers = useCallback(async (wsId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${wsId}`);
      if (!res.ok) throw new Error("Failed to load members.");
      const data = (await res.json()) as { members: WorkspaceMemberDetails[] };
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/workspaces");
        if (!res.ok) return;
        const data = (await res.json()) as { workspaces: WorkspaceSummary[] };
        if (!ignore) {
          setWorkspaces(data.workspaces || []);
          if (data.workspaces?.length) {
            setSelectedWsId((prev) => prev ?? data.workspaces[0]!.workspaceId);
          }
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWsId) return;
    let ignore = false;
    async function load(wsId: string) {
      try {
        const res = await fetch(`/api/workspaces/${wsId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          members: WorkspaceMemberDetails[];
        };
        if (!ignore) {
          setMembers(data.members || []);
        }
      } catch {
        // ignore
      }
    }
    load(selectedWsId);
    return () => {
      ignore = true;
    };
  }, [selectedWsId]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      setLoading(true);
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ name: newWsName }),
      });

      if (!res.ok) {
        const errJson = (await res.json()) as { error?: { message?: string } };
        throw new Error(
          errJson.error?.message || "Failed to create workspace.",
        );
      }

      const created = (await res.json()) as {
        workspaceId: string;
        preparedTransaction: PreparedTransactionIntent;
      };

      setNewWsName("");
      setIsCreateWsOpen(false);
      await reloadWorkspaces();
      setSelectedWsId(created.workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Workspace creation error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWsId || !grantAccount.trim()) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${selectedWsId}/roles/prepare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          action: "grant",
          account: grantAccount,
          role: grantRole,
          scope: grantScope,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: { message?: string } };
        throw new Error(errData.error?.message || "Role preparation failed.");
      }

      const data = (await res.json()) as {
        preparedTransaction: PreparedTransactionIntent;
      };

      setPreparedIntent(data.preparedTransaction);
      setPendingAction({
        action: "grant",
        account: grantAccount as `0x${string}`,
        role: grantRole,
        scope: grantScope,
      });
      setTxStatus("awaiting_signature");
      setIsGrantRoleOpen(false);
      setIsIntentOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grant preparation error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareRevoke = async (
    account: string,
    role: string,
    scope: string,
  ) => {
    if (!selectedWsId) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${selectedWsId}/roles/prepare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          action: "revoke",
          account,
          role,
          scope,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json()) as { error?: { message?: string } };
        throw new Error(errData.error?.message || "Revoke preparation failed.");
      }

      const data = (await res.json()) as {
        preparedTransaction: PreparedTransactionIntent;
      };

      setPreparedIntent(data.preparedTransaction);
      setPendingAction({
        action: "revoke",
        account: account as `0x${string}`,
        role,
        scope,
      });
      setTxStatus("awaiting_signature");
      setIsIntentOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke preparation error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmIntent = async () => {
    if (!preparedIntent || !selectedWsId || !pendingAction) return;

    try {
      // Simulate wallet signing and onchain broadcast in local environment
      setTxStatus("submitted");
      const dummyTxHash = ("0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join("")) as `0x${string}`;
      setActiveTxHash(dummyTxHash);
      setTxStatus("confirming");

      // Reconcile with server once confirmed
      const reconcileRes = await fetch(
        `/api/workspaces/${selectedWsId}/roles/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify({
            action: pendingAction.action,
            account: pendingAction.account,
            role: pendingAction.role,
            scope: pendingAction.scope,
            txHash: dummyTxHash,
          }),
        },
      );

      if (!reconcileRes.ok) {
        throw new Error("Failed to reconcile confirmed transaction.");
      }

      setTxStatus("confirmed");
      await reloadMembers(selectedWsId);
    } catch (err) {
      setTxStatus("failed");
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  const activeWs = workspaces.find((w) => w.workspaceId === selectedWsId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Top Header & Workspace Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            Workspace & Roles
          </h1>
          <p
            style={{
              margin: "var(--space-1) 0 0",
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
            }}
          >
            Manage verifiable team authority and scoped permissions anchored on
            Monad.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            alignItems: "center",
          }}
        >
          {workspaces.length > 0 && (
            <select
              className="form-select"
              value={selectedWsId ?? ""}
              onChange={(e) => setSelectedWsId(e.target.value)}
              aria-label="Select Workspace"
            >
              {workspaces.map((w) => (
                <option key={w.workspaceId} value={w.workspaceId}>
                  {w.name} {w.isOwner ? " (Owner)" : ""}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsCreateWsOpen(true)}
            className="btn btn-primary"
          >
            + New Workspace
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            backgroundColor: "var(--danger-soft)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-md)",
            color: "var(--danger)",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="btn btn-ghost btn-sm"
            style={{ padding: 0 }}
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Workspace Overview Card */}
      {activeWs ? (
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                  {activeWs.name}
                </h2>
                {activeWs.isOwner && (
                  <span className="badge badge-warning">Owner</span>
                )}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                ID: {activeWs.workspaceId}
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-6)" }}>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Members
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                >
                  {activeWs.memberCount}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Active Roles
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                >
                  {activeWs.activeRoles.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="card"
          style={{ textAlign: "center", padding: "var(--space-12)" }}
        >
          <p
            style={{
              color: "var(--text-secondary)",
              margin: "0 0 var(--space-4)",
            }}
          >
            No workspace selected. Create a new workspace to begin.
          </p>
          <button
            onClick={() => setIsCreateWsOpen(true)}
            className="btn btn-primary"
          >
            Create Workspace
          </button>
        </div>
      )}

      {/* Members & Scoped Roles Table */}
      {selectedWsId && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
              Team Members & Authorized Roles
            </h3>
            <button
              onClick={() => setIsGrantRoleOpen(true)}
              className="btn btn-secondary btn-sm"
            >
              + Grant Role
            </button>
          </div>

          <div className="table-container">
            <table
              className="ledger-table"
              aria-label="Team Members and Scoped Roles"
            >
              <thead>
                <tr>
                  <th>Member Address</th>
                  <th>Status</th>
                  <th>Active Scoped Roles</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: "center",
                        color: "var(--text-muted)",
                        padding: "var(--space-8)",
                      }}
                    >
                      {loading ? "Loading team roster..." : "No members found."}
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const isSelf =
                      currentAccount &&
                      m.address.toLowerCase() === currentAccount.toLowerCase();

                    return (
                      <tr key={m.membershipId}>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-2)",
                            }}
                          >
                            <span className="font-mono" title={m.address}>
                              {m.address.slice(0, 8)}...{m.address.slice(-6)}
                            </span>
                            {isSelf && (
                              <span
                                className="badge badge-info"
                                style={{ fontSize: "0.6875rem" }}
                              >
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-success inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Active</span>
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "var(--space-2)",
                            }}
                          >
                            {m.roles.length === 0 ? (
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "0.8125rem",
                                }}
                              >
                                Submitter (default)
                              </span>
                            ) : (
                              m.roles.map((r) => {
                                const isGlobal =
                                  r.scope ===
                                  "0x0000000000000000000000000000000000000000000000000000000000000000";
                                return (
                                  <div
                                    key={r.grantId}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "var(--space-1)",
                                      backgroundColor:
                                        "var(--background-secondary)",
                                      padding: "2px var(--space-2)",
                                      borderRadius: "var(--radius-sm)",
                                      fontSize: "0.75rem",
                                      border: "1px solid var(--border-subtle)",
                                    }}
                                  >
                                    <span style={{ fontWeight: 600 }}>
                                      {r.roleName}
                                    </span>
                                    <span
                                      style={{
                                        color: "var(--text-muted)",
                                        fontSize: "0.6875rem",
                                      }}
                                    >
                                      (
                                      {isGlobal
                                        ? "Global"
                                        : r.scope.slice(0, 8) + "..."}
                                      )
                                    </span>
                                    <button
                                      onClick={() =>
                                        handlePrepareRevoke(
                                          m.address,
                                          r.role,
                                          r.scope,
                                        )
                                      }
                                      className="btn btn-ghost btn-sm"
                                      title="Revoke role"
                                      aria-label="Revoke role"
                                      style={{
                                        padding: "0 2px",
                                        height: 18,
                                        minWidth: 16,
                                        color: "var(--danger)",
                                      }}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            onClick={() => {
                              setGrantAccount(m.address);
                              setIsGrantRoleOpen(true);
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            + Assign Role
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {isCreateWsOpen && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="dialog-panel"
            role="dialog"
            aria-labelledby="create-ws-title"
          >
            <h3
              id="create-ws-title"
              style={{
                margin: "0 0 var(--space-4)",
                fontSize: "1.25rem",
                fontWeight: 700,
              }}
            >
              Create Monad Workspace
            </h3>
            <form onSubmit={handleCreateWorkspace}>
              <div className="form-group">
                <label className="form-label" htmlFor="ws-name-input">
                  Workspace Name
                </label>
                <input
                  id="ws-name-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Research Lab"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "var(--space-3)",
                  marginTop: "var(--space-6)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateWsOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !newWsName.trim()}
                >
                  {loading ? "Creating..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Role Modal */}
      {isGrantRoleOpen && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="dialog-panel"
            role="dialog"
            aria-labelledby="grant-role-title"
          >
            <h3
              id="grant-role-title"
              style={{
                margin: "0 0 var(--space-4)",
                fontSize: "1.25rem",
                fontWeight: 700,
              }}
            >
              Grant Scoped Role
            </h3>
            <form onSubmit={handlePrepareGrant}>
              <div className="form-group">
                <label className="form-label" htmlFor="grant-account-input">
                  Member Wallet Address
                </label>
                <input
                  id="grant-account-input"
                  type="text"
                  className="form-input font-mono"
                  placeholder="0x..."
                  value={grantAccount}
                  onChange={(e) => setGrantAccount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="grant-role-select">
                  Role
                </label>
                <select
                  id="grant-role-select"
                  className="form-select"
                  value={grantRole}
                  onChange={(e) => setGrantRole(e.target.value)}
                >
                  <option value="APPROVER_ROLE">Expense Approver</option>
                  <option value="TREASURY_ROLE">Treasury Manager</option>
                  <option value="AUDITOR_ROLE">Auditor</option>
                  <option value="ADMIN_ROLE">Administrator</option>
                  <option value="OWNER_ROLE">Workspace Owner</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="grant-scope-input">
                  Scope (bytes32 hex, 0x0...0 for Global)
                </label>
                <input
                  id="grant-scope-input"
                  type="text"
                  className="form-input font-mono"
                  value={grantScope}
                  onChange={(e) => setGrantScope(e.target.value)}
                  required
                />
                <span
                  style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                >
                  Global scope allows decision/action across all workspace
                  categories.
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "var(--space-3)",
                  marginTop: "var(--space-6)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsGrantRoleOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !grantAccount.trim()}
                >
                  {loading ? "Preparing..." : "Review Intent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Intent Dialog */}
      <IntentDialog
        isOpen={isIntentOpen}
        intent={preparedIntent}
        status={txStatus}
        txHash={activeTxHash}
        connectedChainId={connectedChainId}
        onConfirm={handleConfirmIntent}
        onCancel={() => {
          setIsIntentOpen(false);
          setPreparedIntent(null);
          setTxStatus("preparing");
        }}
      />
    </div>
  );
}
