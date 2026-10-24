import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getIndexState } from "@/lib/rag/index-state";
import { isValidRepoPart } from "@/lib/repo/validate";

/** Progress for the signed-in user's own repository. Reads only this user's rows. */
export async function GET(request: Request, { params }: { params: Promise<{ owner: string; name: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { owner, name } = await params;
  if (!isValidRepoPart(owner) || !isValidRepoPart(name)) return NextResponse.json({ error: "Invalid repository." }, { status: 400 });

  const state = await getIndexState(session.user.id, owner, name);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}