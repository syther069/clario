import { NextResponse } from "next/server";
import { getSessionFromRequest, getSessionSecret } from "@/lib/auth/context";
import { getDatabaseClient } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const secret = getSessionSecret();
    const session = getSessionFromRequest(req, secret);

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    let workspaces: Array<{
      workspaceId: string;
      name: string;
      status: string;
    }> = [];

    try {
      const db = getDatabaseClient();
      const res = await db.query<{
        workspace_id: string;
        name: string;
        status: string;
      }>(
        `SELECT m.workspace_id, w.name, m.status
         FROM memberships m
         JOIN workspaces w ON m.workspace_id = w.workspace_id
         WHERE (m.user_id = $1 OR LOWER(m.address) = LOWER($2)) AND m.status = 'active';`,
        [session.userId, session.address.toLowerCase()],
      );

      workspaces = res.rows.map((r) => ({
        workspaceId: r.workspace_id,
        name: r.name,
        status: r.status,
      }));
    } catch {
      // In offline or testing mode, return empty workspaces
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          userId: session.userId,
          address: session.address,
          lastConfirmedAt: session.lastConfirmedAt,
        },
        csrfToken: session.csrfToken,
        workspaces,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
