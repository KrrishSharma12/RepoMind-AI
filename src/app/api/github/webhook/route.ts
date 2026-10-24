import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decideWebhookAction, verifyWebhookSignature } from "@/lib/github/webhook";
import { runPullRequestReview } from "@/lib/review/reviewer";

const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Receives events from GitHub. The first thing it does is check the signature, so a
 * request that was not signed with our secret is rejected before anything is read.
 */
export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });

  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > MAX_PAYLOAD_BYTES) return NextResponse.json({ error: "Payload too large." }, { status: 413 });

  if (!verifyWebhookSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const decision = decideWebhookAction(request.headers.get("x-github-event"), payload);

  switch (decision.kind) {
    case "ping":
      return NextResponse.json({ ok: true });

    case "uninstall":
      // The app was removed on GitHub, so forget the saved installation.
      await db.installation.deleteMany({ where: { githubInstallationId: decision.installationId } });
      return NextResponse.json({ ok: true });

    case "review":
      // Answer GitHub right away. The review continues in the background.
      after(() => runPullRequestReview(decision.pr));
      return NextResponse.json({ accepted: true }, { status: 202 });

    default:
      return NextResponse.json({ ignored: decision.reason }, { status: 202 });
  }
}