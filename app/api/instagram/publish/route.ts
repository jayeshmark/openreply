import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { createInstagramContext } from "@/lib/instagram/provider";
import { getMetaGraphApiVersion } from "@/lib/env";

function graphBase() {
  return `https://graph.instagram.com/${getMetaGraphApiVersion()}`;
}

async function graphPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${graphBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (json as { error?: { message?: string } })?.error?.message ||
        `Graph POST ${path} failed (${res.status})`
    );
  return json as { id: string };
}

async function graphGet(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${graphBase()}${path}?${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (json as { error?: { message?: string } })?.error?.message ||
        `Graph GET ${path} failed (${res.status})`
    );
  return json as { status_code?: string; permalink?: string };
}

// Two-step reel publishing, driven by the caller so no single request
// waits on Meta's video processing:
//   action "create"  -> creates the media container, returns containerId
//   action "publish" -> if the container is FINISHED, publishes it and
//                       returns the media id + permalink; otherwise
//                       returns published:false with the current status.
export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    instagramAccountId?: string;
    videoUrl?: string;
    caption?: string;
    locationId?: string;
    containerId?: string;
  };

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    body.instagramAccountId ?? null
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected." },
      { status: 400 }
    );
  }

  try {
    const ctx = await createInstagramContext(account);
    if (ctx.provider !== "META") {
      return NextResponse.json(
        { success: false, error: "Publishing requires a Meta-connected account." },
        { status: 400 }
      );
    }
    const token = ctx.accessToken;
    const igId = account.instagramId;

    if (body.action === "create") {
      if (!body.videoUrl || !body.caption) {
        return NextResponse.json(
          { success: false, error: "videoUrl and caption are required." },
          { status: 400 }
        );
      }
      const params: Record<string, string> = {
        media_type: "REELS",
        video_url: body.videoUrl,
        caption: body.caption,
        share_to_feed: "true",
        access_token: token,
      };
      if (body.locationId) params.location_id = body.locationId;
      const created = await graphPost(`/${igId}/media`, params);
      return NextResponse.json({ success: true, containerId: created.id });
    }

    if (body.action === "publish") {
      if (!body.containerId) {
        return NextResponse.json(
          { success: false, error: "containerId is required." },
          { status: 400 }
        );
      }
      const status = await graphGet(`/${body.containerId}`, {
        fields: "status_code,status",
        access_token: token,
      });
      if (status.status_code !== "FINISHED") {
        return NextResponse.json({
          success: true,
          published: false,
          status: status.status_code ?? "UNKNOWN",
        });
      }
      const published = await graphPost(`/${igId}/media_publish`, {
        creation_id: body.containerId,
        access_token: token,
      });
      const media = await graphGet(`/${published.id}`, {
        fields: "permalink",
        access_token: token,
      }).catch(() => ({}) as { permalink?: string });
      return NextResponse.json({
        success: true,
        published: true,
        mediaId: published.id,
        permalink: media.permalink ?? null,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[Instagram Publish] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Publish failed",
      },
      { status: 500 }
    );
  }
}
