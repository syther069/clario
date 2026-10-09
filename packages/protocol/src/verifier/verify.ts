import {
  computeExpenseCommitmentV1,
  hashCanonicalEvidenceManifestV1,
  hashCanonicalExpenseV1,
} from "../schema/v1/commitment.js";
import type {
  CanonicalEvidenceManifestV1,
  CanonicalExpenseV1,
} from "../schema/v1/types.js";
import { validateDeploymentManifest } from "../deploy/manifest.js";
import {
  computePackageFileHash,
  validateVerificationPackageManifestV1,
} from "../package/validate.js";
import { safeJsonReviver } from "./archive.js";
import type {
  VerificationCheckResult,
  VerificationCheckStatus,
  VerificationReport,
  VerifyPackageOptions,
} from "./types.js";

const LIMITATIONS = [
  "Verification proves integrity, onchain authority, ordering, and settlement matching; it does not prove that evidence is genuine.",
  "Verification does not establish business legitimacy, accounting treatment, tax eligibility, or legal compliance.",
  "Source-chain transaction facts are attributable claims unless independently checked against their source chain.",
] as const;

function text(value: unknown): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}

function equalHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function jsonFile(files: Map<string, Buffer>, path: string): unknown {
  const bytes = files.get(path);
  if (!bytes) throw new Error(`Missing package file: ${path}`);
  return JSON.parse(bytes.toString("utf8"), safeJsonReviver) as unknown;
}

function overallStatus(
  checks: readonly VerificationCheckResult[],
): VerificationCheckStatus {
  if (checks.some((check) => check.status === "FAILED")) return "FAILED";
  if (checks.some((check) => check.status === "UNVERIFIABLE"))
    return "UNVERIFIABLE";
  if (checks.some((check) => check.status === "VERIFIED_WITH_WARNINGS")) {
    return "VERIFIED_WITH_WARNINGS";
  }
  return "VERIFIED";
}

function failedReport(error: unknown): VerificationReport {
  return {
    schemaVersion: 1,
    overall: "FAILED",
    packageSchemaVersion: null,
    disclosureLevel: null,
    checks: [
      {
        id: "package.schema",
        label: "Package schema",
        status: "FAILED",
        explanation:
          error instanceof Error ? error.message : "Package validation failed.",
      },
    ],
    limitations: LIMITATIONS,
  };
}

/** Deterministically verifies a package using only package bytes and public-chain reads. */
export async function verifyPackage(
  options: VerifyPackageOptions,
): Promise<VerificationReport> {
  const checks: VerificationCheckResult[] = [];
  let manifest;
  try {
    manifest = validateVerificationPackageManifestV1(options.bundle.manifest);
    checks.push({
      id: "package.schema",
      label: "Package schema",
      status: "VERIFIED",
      explanation: "The package manifest uses supported schema version 1.",
      expected: "1",
      observed: text(manifest.schemaVersion),
    });
  } catch (error) {
    return failedReport(error);
  }

  const declaredPaths = new Set(manifest.files.map((entry) => entry.path));
  let filesValid = true;
  for (const entry of manifest.files) {
    const bytes = options.bundle.files.get(entry.path);
    if (entry.isRedacted) {
      const omitted =
        !bytes && entry.sizeBytes === 0 && entry.sha256 === "0".repeat(64);
      checks.push({
        id: `file.${entry.path}`,
        label: `File ${entry.path}`,
        status: omitted ? "UNVERIFIABLE" : "FAILED",
        explanation: omitted
          ? "The file was intentionally omitted by the redacted disclosure mode."
          : "A redacted entry has inconsistent metadata or unexpected bytes.",
      });
      if (!omitted) filesValid = false;
      continue;
    }
    const actualHash = bytes ? computePackageFileHash(bytes) : null;
    const valid =
      !!bytes &&
      bytes.length === entry.sizeBytes &&
      actualHash === entry.sha256;
    checks.push({
      id: `file.${entry.path}`,
      label: `File ${entry.path}`,
      status: valid ? "VERIFIED" : "FAILED",
      explanation: valid
        ? "The file size and SHA-256 digest match the signed manifest entry."
        : "The file is missing or its size/SHA-256 digest differs from the manifest.",
      expected: `${entry.sizeBytes} bytes; sha256:${entry.sha256}`,
      observed: bytes
        ? `${bytes.length} bytes; sha256:${actualHash}`
        : "missing",
    });
    if (!valid) filesValid = false;
  }
  const undeclared = [...options.bundle.files.keys()].filter(
    (path) => !declaredPaths.has(path),
  );
  checks.push({
    id: "package.undeclared-files",
    label: "Undeclared files",
    status: undeclared.length === 0 ? "VERIFIED" : "FAILED",
    explanation:
      undeclared.length === 0
        ? "Every archive payload is declared by the manifest."
        : `The archive contains undeclared files: ${undeclared.join(", ")}.`,
  });
  if (undeclared.length > 0) filesValid = false;

  let deployment;
  try {
    deployment = validateDeploymentManifest(
      jsonFile(options.bundle.files, "chain/deployment-manifest.json"),
    );
    const consistent =
      deployment.chainId === manifest.chainId &&
      equalHex(
        deployment.contracts.ClarioRegistry.address,
        manifest.registryAddress,
      );
    checks.push({
      id: "deployment.manifest",
      label: "Deployment manifest",
      status: consistent ? "VERIFIED" : "FAILED",
      explanation: consistent
        ? "The deployment manifest matches the package chain and root registry."
        : "The deployment manifest conflicts with the package chain or root registry.",
      expected: `${manifest.chainId}; ${manifest.registryAddress}`,
      observed: `${deployment.chainId}; ${deployment.contracts.ClarioRegistry.address}`,
    });
  } catch (error) {
    checks.push({
      id: "deployment.manifest",
      label: "Deployment manifest",
      status: "FAILED",
      explanation:
        error instanceof Error
          ? error.message
          : "Deployment manifest validation failed.",
    });
  }

  try {
    const policy = jsonFile(
      options.bundle.files,
      "workspace-policy.json",
    ) as Record<string, unknown>;
    const valid =
      policy.schemaVersion === 1 &&
      typeof policy.workspaceId === "string" &&
      policy.workspaceId.toLowerCase() === manifest.workspaceId.toLowerCase() &&
      typeof policy.policyVersion === "number" &&
      Number.isInteger(policy.policyVersion) &&
      policy.policyVersion > 0 &&
      Array.isArray(policy.roles);
    checks.push({
      id: "workspace.policy",
      label: "Workspace policy snapshot",
      status: valid ? "VERIFIED" : "FAILED",
      explanation: valid
        ? "The policy snapshot is versioned and bound to the package workspace."
        : "The policy snapshot is malformed or belongs to a different workspace.",
    });
  } catch (error) {
    checks.push({
      id: "workspace.policy",
      label: "Workspace policy snapshot",
      status: "FAILED",
      explanation:
        error instanceof Error
          ? error.message
          : "Policy snapshot validation failed.",
    });
  }

  try {
    const events = jsonFile(options.bundle.files, "chain/expected-events.json");
    if (!Array.isArray(events))
      throw new Error("Expected events must be an array.");
    const valid = events.every((event) => {
      if (typeof event !== "object" || event === null || Array.isArray(event)) {
        return false;
      }
      const item = event as Record<string, unknown>;
      return (
        typeof item.blockNumber === "string" &&
        /^(?:0|[1-9][0-9]*)$/.test(item.blockNumber) &&
        typeof item.blockHash === "string" &&
        /^0x[0-9a-fA-F]{64}$/.test(item.blockHash) &&
        item.blockHash !== `0x${"00".repeat(32)}` &&
        typeof item.transactionHash === "string" &&
        /^0x[0-9a-fA-F]{64}$/.test(item.transactionHash) &&
        typeof item.contractAddress === "string" &&
        /^0x[0-9a-fA-F]{40}$/.test(item.contractAddress) &&
        typeof item.eventName === "string" &&
        typeof item.logIndex === "number" &&
        Number.isInteger(item.logIndex) &&
        item.logIndex >= 0 &&
        typeof item.args === "object" &&
        item.args !== null
      );
    });
    checks.push({
      id: "chain.expected-events",
      label: "Expected event claims",
      status: valid ? "VERIFIED" : "FAILED",
      explanation: valid
        ? "Exported event claims have complete public provenance fields; RPC reads remain authoritative."
        : "At least one exported event claim has malformed or synthetic provenance.",
    });
  } catch (error) {
    checks.push({
      id: "chain.expected-events",
      label: "Expected event claims",
      status: "FAILED",
      explanation:
        error instanceof Error
          ? error.message
          : "Expected-event validation failed.",
    });
  }

  const chain = options.chainSource;
  if (!chain) {
    checks.push({
      id: "chain.source",
      label: "Public chain source",
      status: "UNVERIFIABLE",
      explanation:
        "No Monad RPC or independent chain source was supplied; onchain claims were not checked.",
    });
  } else {
    try {
      const observedChainId = await chain.getChainId();
      checks.push({
        id: "chain.identity",
        label: "Monad chain identity",
        status: observedChainId === manifest.chainId ? "VERIFIED" : "FAILED",
        explanation:
          observedChainId === manifest.chainId
            ? "The independent chain source reports the expected chain ID."
            : "The independent chain source reports a different chain ID.",
        expected: text(manifest.chainId),
        observed: text(observedChainId),
      });
    } catch (error) {
      checks.push({
        id: "chain.identity",
        label: "Monad chain identity",
        status: "UNVERIFIABLE",
        explanation:
          error instanceof Error
            ? error.message
            : "Chain ID could not be read.",
      });
    }
    try {
      const isRegistry = await chain.isRegistry(manifest.registryAddress);
      checks.push({
        id: "chain.registry",
        label: "Clario registry contract",
        status: isRegistry ? "VERIFIED" : "FAILED",
        explanation: isRegistry
          ? "The package registry address exposes the expected Clario registry directory."
          : "The package registry address is not the expected Clario registry contract.",
        expected: manifest.registryAddress,
        observed: isRegistry
          ? manifest.registryAddress
          : "incompatible contract or no code",
      });
    } catch (error) {
      checks.push({
        id: "chain.registry",
        label: "Clario registry contract",
        status: "UNVERIFIABLE",
        explanation:
          error instanceof Error
            ? error.message
            : "Registry contract could not be read.",
      });
    }
  }

  for (const expense of manifest.expenses) {
    const versions = [...expense.versions];
    const expectedVersions = Array.from(
      { length: expense.currentVersion },
      (_, index) => index + 1,
    );
    const contiguous =
      versions.length === expectedVersions.length &&
      versions.every((version, index) => version === expectedVersions[index]);
    checks.push({
      id: `expense.${expense.expenseId}.version-chain`,
      label: `Version chain for ${expense.expenseId}`,
      status: contiguous ? "VERIFIED" : "FAILED",
      explanation: contiguous
        ? "The package contains a contiguous version sequence through the declared current version."
        : "The package version sequence has a gap, duplicate, or inconsistent current version.",
      expected: expectedVersions.join(","),
      observed: versions.join(","),
    });

    let currentRecord: CanonicalExpenseV1 | null = null;
    let currentCommitment: string | null = null;
    let currentSubmitter: string | null = null;
    let currentDecisionStatus: VerificationCheckStatus | null = null;

    for (const version of versions) {
      const prefix = `expenses/${expense.expenseId}/v${version}`;
      const recordPath = `${prefix}/record.json`;
      const saltPath = `${prefix}/salt.txt`;
      const evidenceManifestPath = `${prefix}/evidence-manifest.json`;
      const recordBytes = options.bundle.files.get(recordPath);
      const saltBytes = options.bundle.files.get(saltPath);
      const evidenceManifestBytes =
        options.bundle.files.get(evidenceManifestPath);
      let record: CanonicalExpenseV1 | null = null;
      let evidenceManifest: CanonicalEvidenceManifestV1 | null = null;
      let recordHash: `0x${string}` | null = null;
      let evidenceManifestHash: `0x${string}` | null = null;

      if (!recordBytes || !saltBytes || !evidenceManifestBytes) {
        checks.push({
          id: `expense.${expense.expenseId}.v${version}.private-inputs`,
          label: `Private inputs for ${expense.expenseId} v${version}`,
          status:
            manifest.disclosureLevel === "REDACTED" ? "UNVERIFIABLE" : "FAILED",
          explanation:
            manifest.disclosureLevel === "REDACTED"
              ? "Record, salt, or evidence manifest was intentionally redacted; commitment reconstruction is unavailable."
              : "A FULL package is missing a record, salt, or evidence manifest.",
        });
      } else {
        try {
          record = JSON.parse(
            recordBytes.toString("utf8"),
            safeJsonReviver,
          ) as CanonicalExpenseV1;
          evidenceManifest = JSON.parse(
            evidenceManifestBytes.toString("utf8"),
            safeJsonReviver,
          ) as CanonicalEvidenceManifestV1;
          recordHash = hashCanonicalExpenseV1(record);
          evidenceManifestHash =
            hashCanonicalEvidenceManifestV1(evidenceManifest);
          const identifiersMatch =
            record.workspaceId.toLowerCase() ===
              manifest.workspaceId.toLowerCase() &&
            record.expenseId.toLowerCase() ===
              expense.expenseId.toLowerCase() &&
            record.version === version &&
            equalHex(record.evidenceManifestHash, evidenceManifestHash);
          checks.push({
            id: `expense.${expense.expenseId}.v${version}.canonical-record`,
            label: `Canonical record for ${expense.expenseId} v${version}`,
            status: identifiersMatch ? "VERIFIED" : "FAILED",
            explanation: identifiersMatch
              ? "The canonical record and evidence manifest hash bind to this package version."
              : "The canonical record identifiers or evidence-manifest hash do not match this package version.",
          });

          let evidenceValid = true;
          for (const evidence of evidenceManifest.entries) {
            const candidates = [...options.bundle.files.entries()].filter(
              ([path]) => path.startsWith(`evidence/${evidence.evidenceId}.`),
            );
            const candidate =
              candidates.length === 1 ? candidates[0] : undefined;
            const digest = candidate
              ? `0x${computePackageFileHash(candidate[1])}`
              : null;
            if (
              !candidate ||
              candidate[1].length !== evidence.sizeBytes ||
              !digest ||
              !equalHex(digest, evidence.plaintextHash)
            ) {
              evidenceValid = false;
            }
          }
          checks.push({
            id: `expense.${expense.expenseId}.v${version}.evidence`,
            label: `Evidence for ${expense.expenseId} v${version}`,
            status: evidenceValid ? "VERIFIED" : "FAILED",
            explanation: evidenceValid
              ? "Every disclosed evidence file matches its canonical size and SHA-256 digest."
              : "At least one evidence file is missing, ambiguous, or has a different size or SHA-256 digest.",
          });
        } catch (error) {
          checks.push({
            id: `expense.${expense.expenseId}.v${version}.canonical-record`,
            label: `Canonical record for ${expense.expenseId} v${version}`,
            status: "FAILED",
            explanation:
              error instanceof Error
                ? error.message
                : "Canonical record validation failed.",
          });
        }
      }

      let chainVersion = null;
      if (chain) {
        try {
          chainVersion = await chain.getExpenseVersion(
            manifest.registryAddress,
            manifest.workspaceId,
            expense.expenseId,
            version,
          );
          const expectedSuperseded = version < expense.currentVersion;
          const matches =
            !!chainVersion && chainVersion.isSuperseded === expectedSuperseded;
          if (chainVersion && version === expense.currentVersion) {
            currentCommitment = chainVersion.commitment;
            currentSubmitter = chainVersion.submitter;
          }
          checks.push({
            id: `expense.${expense.expenseId}.v${version}.onchain-version`,
            label: `Onchain version ${expense.expenseId} v${version}`,
            status: matches ? "VERIFIED" : "FAILED",
            explanation: matches
              ? "The version exists onchain with the expected supersession state."
              : "The version is missing onchain or its supersession state differs.",
          });
        } catch (error) {
          checks.push({
            id: `expense.${expense.expenseId}.v${version}.onchain-version`,
            label: `Onchain version ${expense.expenseId} v${version}`,
            status: "UNVERIFIABLE",
            explanation:
              error instanceof Error
                ? error.message
                : "Onchain version could not be read.",
          });
        }
      }

      if (
        record &&
        recordHash &&
        evidenceManifestHash &&
        saltBytes &&
        chainVersion
      ) {
        try {
          const computed = computeExpenseCommitmentV1({
            monadChainId: manifest.chainId,
            registryAddress: chainVersion.registryAddress as `0x${string}`,
            workspaceId: manifest.workspaceId as `0x${string}`,
            expenseId: expense.expenseId as `0x${string}`,
            version,
            privateRecordHash: recordHash,
            evidenceManifestHash,
            salt: saltBytes.toString("utf8").trim() as `0x${string}`,
          });
          const matches = equalHex(computed, chainVersion.commitment);
          checks.push({
            id: `expense.${expense.expenseId}.v${version}.commitment`,
            label: `Commitment for ${expense.expenseId} v${version}`,
            status: matches ? "VERIFIED" : "FAILED",
            explanation: matches
              ? "The disclosed canonical record, evidence manifest, salt, and domain reproduce the onchain commitment."
              : "The reconstructed commitment differs from the onchain commitment.",
            expected: chainVersion.commitment,
            observed: computed,
          });
        } catch (error) {
          checks.push({
            id: `expense.${expense.expenseId}.v${version}.commitment`,
            label: `Commitment for ${expense.expenseId} v${version}`,
            status: "FAILED",
            explanation:
              error instanceof Error
                ? error.message
                : "Commitment reconstruction failed.",
          });
        }
      } else {
        checks.push({
          id: `expense.${expense.expenseId}.v${version}.commitment`,
          label: `Commitment for ${expense.expenseId} v${version}`,
          status:
            manifest.disclosureLevel === "REDACTED" || !chain
              ? "UNVERIFIABLE"
              : "FAILED",
          explanation:
            manifest.disclosureLevel === "REDACTED"
              ? "Commitment reconstruction requires the intentionally redacted record, evidence manifest, and salt."
              : !chain
                ? "Commitment reconstruction cannot be compared without an independent chain source."
                : "Required disclosed or onchain commitment inputs are unavailable.",
        });
      }
      if (version === expense.currentVersion) currentRecord = record;
    }

    if (chain) {
      try {
        const observedCurrent = await chain.getCurrentVersion(
          manifest.registryAddress,
          manifest.workspaceId,
          expense.expenseId,
        );
        checks.push({
          id: `expense.${expense.expenseId}.current-version`,
          label: `Current version for ${expense.expenseId}`,
          status:
            observedCurrent === expense.currentVersion ? "VERIFIED" : "FAILED",
          explanation:
            observedCurrent === expense.currentVersion
              ? "The package current version matches the coordinator contract."
              : "The package current version is stale or belongs to a different chain state.",
          expected: text(expense.currentVersion),
          observed: text(observedCurrent),
        });
      } catch (error) {
        checks.push({
          id: `expense.${expense.expenseId}.current-version`,
          label: `Current version for ${expense.expenseId}`,
          status: "UNVERIFIABLE",
          explanation:
            error instanceof Error
              ? error.message
              : "Current version could not be read.",
        });
      }

      try {
        const decision = await chain.getDecision(
          manifest.registryAddress,
          manifest.workspaceId,
          expense.expenseId,
          expense.currentVersion,
        );
        if (!decision) {
          currentDecisionStatus = expense.isSettled
            ? "FAILED"
            : "VERIFIED_WITH_WARNINGS";
          checks.push({
            id: `expense.${expense.expenseId}.approval`,
            label: `Current approval for ${expense.expenseId}`,
            status: currentDecisionStatus,
            explanation: expense.isSettled
              ? "The package claims settlement but no decision exists for the current version."
              : "No current approval exists; the package remains an integrity record, not an approved expense.",
          });
        } else {
          const valid =
            decision.decision === "APPROVE" &&
            decision.reviewerWasAuthorized &&
            decision.isCurrentApprovalValid &&
            (!currentSubmitter ||
              !equalHex(decision.reviewer, currentSubmitter)) &&
            (!currentCommitment ||
              equalHex(decision.commitment, currentCommitment));
          currentDecisionStatus = valid ? "VERIFIED" : "FAILED";
          checks.push({
            id: `expense.${expense.expenseId}.approval`,
            label: `Current approval for ${expense.expenseId}`,
            status: currentDecisionStatus,
            explanation: valid
              ? "An authorized human approved the exact current commitment and the approval remains active."
              : "The decision is not an active exact-version approval by an authorized reviewer.",
            expected: currentCommitment ?? "current onchain commitment",
            observed: `${decision.decision}; ${decision.commitment}; reviewer ${decision.reviewer}`,
          });
        }
      } catch (error) {
        currentDecisionStatus = "UNVERIFIABLE";
        checks.push({
          id: `expense.${expense.expenseId}.approval`,
          label: `Current approval for ${expense.expenseId}`,
          status: "UNVERIFIABLE",
          explanation:
            error instanceof Error
              ? error.message
              : "Decision state could not be read.",
        });
      }

      try {
        const settlement = await chain.getSettlement(
          manifest.registryAddress,
          manifest.workspaceId,
          expense.expenseId,
          expense.currentVersion,
        );
        if (!expense.isSettled) {
          checks.push({
            id: `expense.${expense.expenseId}.settlement`,
            label: `Settlement for ${expense.expenseId}`,
            status: settlement ? "FAILED" : "VERIFIED",
            explanation: settlement
              ? "The chain contains a settlement that the package does not declare."
              : "Neither the package nor the chain reports a settlement for the current version.",
          });
        } else if (!settlement) {
          checks.push({
            id: `expense.${expense.expenseId}.settlement`,
            label: `Settlement for ${expense.expenseId}`,
            status: "FAILED",
            explanation:
              "The package claims settlement but no onchain settlement record exists.",
          });
        } else {
          const recordMatches = currentRecord
            ? equalHex(settlement.token, currentRecord.claimAsset) &&
              equalHex(settlement.recipient, currentRecord.recipient) &&
              settlement.amount.toString() === currentRecord.claimAmount
            : false;
          const deploymentTokenMatches = deployment
            ? equalHex(settlement.token, deployment.tokens.USDC.address)
            : false;
          const valid =
            currentDecisionStatus === "VERIFIED" &&
            !!currentCommitment &&
            equalHex(settlement.commitment, currentCommitment) &&
            recordMatches &&
            deploymentTokenMatches &&
            settlement.hasMatchingTokenTransfer &&
            settlement.conflictingSettlementCount === 0;
          checks.push({
            id: `expense.${expense.expenseId}.settlement`,
            label: `Settlement for ${expense.expenseId}`,
            status:
              !currentRecord && manifest.disclosureLevel === "REDACTED"
                ? "UNVERIFIABLE"
                : valid
                  ? "VERIFIED"
                  : "FAILED",
            explanation:
              !currentRecord && manifest.disclosureLevel === "REDACTED"
                ? "Token transfer and onchain settlement exist, but redacted record terms prevent an exact record-to-payment comparison."
                : valid
                  ? "The settlement and ERC-20 transfer match the approved current record, configured token, recipient, and amount."
                  : "The settlement conflicts with the approval, commitment, record terms, token transfer, or duplicate-settlement rule.",
          });
        }
      } catch (error) {
        checks.push({
          id: `expense.${expense.expenseId}.settlement`,
          label: `Settlement for ${expense.expenseId}`,
          status: "UNVERIFIABLE",
          explanation:
            error instanceof Error
              ? error.message
              : "Settlement state could not be read.",
        });
      }
    }
  }

  if (!filesValid) {
    // File failures are already explicit; this branch documents why later checks cannot rescue the package.
    checks.push({
      id: "package.integrity",
      label: "Package integrity",
      status: "FAILED",
      explanation:
        "One or more declared files failed manifest integrity validation.",
    });
  }

  return {
    schemaVersion: 1,
    overall: overallStatus(checks),
    packageSchemaVersion: manifest.schemaVersion,
    disclosureLevel: manifest.disclosureLevel,
    checks,
    limitations: LIMITATIONS,
  };
}
