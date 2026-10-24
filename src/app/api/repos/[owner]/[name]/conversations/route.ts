import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { findUserRepository, listConversations } from "@/lib/rag/conversations";
import { isValidRepoPart } from "@/lib/repo/validate";

/** The signed-in user's conversations for one repository. */
export async function GET(request: Request, { params }: { params: Promise<{ owner: string; name: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { owner, name } = await params;
  if (!isValidRepoPart(owner) || !isValidRepoPart(name)) return NextResponse.json({ error: "Invalid repository." }, { status: 400 });

  const repository = await findUserRepository(session.user.id, owner, name);
  const conversations = repository ? await listConversations(session.user.id, repository.id) : [];
  return NextResponse.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
}