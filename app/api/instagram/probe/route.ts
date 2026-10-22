import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { createInstagramContext } from "@/lib/instagram/provider";
import { getMetaGraphApiVersion } from "@/lib/env";

// Read-only scope probe: asks Graph for the account's content
// publishing limit, which exercises the content-publish permission
// without creating or publishing anything. GET so it can be opened
// directly in a browser tab while signed into the dashboard.
export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    accountId ?? null
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected." },
      { status: 400 }
    );
  }

  const ctx = await createInstagramContext(account);
  if (ctx.provider !== "META") {
    return NextResponse.json(
      { success: false, error: "Probe requires a Meta-connected account." },
      { status: 400 }
    );
  }

  const qs = new URLSearchParams({
    fields: "quota_usage",
    access_token: ctx.accessToken,
  }).toString();
  const url = `https://graph.instagram.com/${getMetaGraphApiVersion()}/${account.instagramId}/content_publishing_limit?${qs}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  return NextResponse.json({
    success: true,
    username: account.username,
    graphStatus: res.status,
    graphBody: json,
  });
}
