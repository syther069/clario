import { ProtocolError } from "@clario/protocol";
import type { DatabaseClient } from "@clario/database";
import {
  parseSessionCookie,
  verifyCsrfToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";
import {
  AuthorizationPolicy,
  type AuthContext,
  type WorkspaceMembershipInfo,
} from "./policy";
import type { WorkspaceRole } from "@clario/protocol";

export function getSessionSecret(): string {
  const secret = process.env.CLARIO_SESSION_SECRET || process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }

  if (
    process.env.PRIVY_APP_SECRET &&
    process.env.PRIVY_APP_SECRET.length >= 32
  ) {
    return process.env.PRIVY_APP_SECRET;
  }

  // In production, NEVER permit fallback secrets - fail closed immediately!
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL SECURITY CONFIGURATION: CLARIO_SESSION_SECRET or SESSION_SECRET must be set and contain at least 32 characters in production.",
    );
  }

  // In non-production test or dev environments, accept valid developer secrets
  if (secret && secret.length >= 16) {
    return secret;
  }

  if (
    process.env.PRIVY_APP_SECRET &&
    process.env.PRIVY_APP_SECRET.length >= 16
  ) {
    return process.env.PRIVY_APP_SECRET;
  }

  return "clario-development-only-session-secret-32-chars-minimum!";
}

/**
 * Extracts and verifies the session from an incoming Request.
 * Returns null if no valid session cookie is present or if the token is invalid/expired.
 */
export function getSessionFromRequest(
  req: Request,
  secret = getSessionSecret(),
): SessionPayload | null {
  const cookieHeader = req.headers.get("cookie");
  const token = parseSessionCookie(cookieHeader);
  if (!token) {
    return null;
  }

  try {
    return verifySessionToken(token, secret);
  } catch {
    return null;
  }
}

export interface AuthOptions {
  secret?: string | undefined;
  skipCsrf?: boolean | undefined;
}

export interface WorkspaceAccessOptions extends AuthOptions {
  requiredRole?: WorkspaceRole | undefined;
  scope?: string | undefined;
}

/**
 * Asserts that the request contains a valid, authenticated session.
 * For mutating HTTP methods (POST, PUT, PATCH, DELETE), also enforces CSRF verification.
 */
export function requireAuth(req: Request, options?: AuthOptions): AuthContext {
  const secret = options?.secret ?? getSessionSecret();
  const session = getSessionFromRequest(req, secret);

  if (!session) {
    throw new ProtocolError("UNAUTHORIZED", {
      message: "Authentication required. Please sign in with your wallet.",
    });
  }

  // Enforce CSRF defense on cookie-authenticated mutations
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    req.method.toUpperCase(),
  );

  if (isMutation && !options?.skipCsrf) {
    const csrfHeader = req.headers.get("x-csrf-token");
    if (!verifyCsrfToken(session, csrfHeader)) {
      throw new ProtocolError("UNAUTHORIZED", {
        message: "Invalid or missing CSRF token.",
      });
    }
  }

  return {
    userId: session.userId,
    address: session.address,
    session,
  };
}

/**
 * Convenience helper to authenticate request and verify workspace membership and optional role.
 */
export async function requireWorkspaceAccess(
  db: DatabaseClient,
  req: Request,
  workspaceId: string,
  options?: WorkspaceAccessOptions,
): Promise<{
  context: AuthContext;
  policy: AuthorizationPolicy;
  membership: WorkspaceMembershipInfo;
}> {
  const context = requireAuth(req, options);

  const policy = new AuthorizationPolicy(db);
  const membership = await policy.getMembership(workspaceId, context);

  if (options?.requiredRole) {
    policy.assertRole(
      membership,
      options.requiredRole,
      options.scope,
      `accessing workspace ${workspaceId}`,
    );
  }

  return { context, policy, membership };
}
