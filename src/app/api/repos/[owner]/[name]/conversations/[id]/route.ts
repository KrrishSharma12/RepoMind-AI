import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { findUserRepository, getConversationMessages } from "@/lib/rag/conversations";
import { isValidRepoPart } from "@/lib/repo/validate";

/** Messages of one conversation. Returns 404 unless it belongs to the signed-in user. */
export async function GET(request: Request, { params }: { params: Promise<{ owner: string; name: string; id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { owner, name, id } = await params;
  if (!isValidRepoPart(owner) || !isValidRepoPart(name) || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const repository = await findUserRepository(session.user.id, owner, name);
  const messages = repository ? await getConversationMessages(session.user.id, repository.id, id) : null;
  if (!messages) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}