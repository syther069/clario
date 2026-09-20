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
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }

  if (
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development"
  ) {
    return "clario-development-session-secret-32-chars-min!";
  }

  throw new Error(
    "SESSION_SECRET environment variable is missing or less than 16 characters.",
  );
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
