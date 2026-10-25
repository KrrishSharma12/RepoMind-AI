import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The route talks to the database and starts the reviewer. Both are replaced so these
// tests check only the route's own decisions: who gets in, and what each event triggers.
const mocks = vi.hoisted(() => ({ deleteMany: vi.fn(), runReview: vi.fn(), after: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { installation: { deleteMany: mocks.deleteMany } } }));
vi.mock("@/lib/review/reviewer", () => ({ runPullRequestReview: mocks.runReview }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: mocks.after }));

import { POST } from "@/app/api/github/webhook/route";

const SECRET = "route-secret";
const sign = (body: string) => `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
const send = (body: string, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/github/webhook", { method: "POST", body, headers }));
const signed = (payload: unknown, event: string) => {
  const body = JSON.stringify(payload);
  return send(body, { "x-hub-signature-256": sign(body), "x-github-event": event });
};

beforeEach(() => {
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", SECRET);
  mocks.deleteMany.mockReset().mockResolvedValue({ count: 1 });
  mocks.runReview.mockReset();
  mocks.after.mockReset().mockImplementation((callback: () => unknown) => void callback());
});

describe("POST /api/github/webhook", () => {
  it("rejects requests that are unsigned, wrongly signed, or tampered with, and changes nothing", async () => {
    const body = JSON.stringify({ action: "deleted", installation: { id: 5 } });
    expect((await send(body, { "x-github-event": "installation" })).status).toBe(401);
    expect((await send(body, { "x-hub-signature-256": `sha256=${"0".repeat(64)}`, "x-github-event": "installation" })).status).toBe(401);
    expect((await send(`${body} `, { "x-hub-signature-256": sign(body), "x-github-event": "installation" })).status).toBe(401);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.runReview).not.toHaveBeenCalled();
  });

  it("answers a signed ping", async () => {
    const response = await signed({ zen: "hi" }, "ping");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 400 for signed but invalid JSON", async () => {
    const body = "not json {";
    expect((await send(body, { "x-hub-signature-256": sign(body), "x-github-event": "ping" })).status).toBe(400);
  });

  it("acknowledges and ignores events it does not review", async () => {
    const response = await signed({ action: "closed" }, "pull_request");
    expect(response.status).toBe(202);
    expect((await response.json()).ignored).toMatch(/not reviewed/);
    expect((await signed({ action: "labeled" }, "issues")).status).toBe(202);
    expect(mocks.runReview).not.toHaveBeenCalled();
  });

  it("removes only the uninstalled installation", async () => {
    expect((await signed({ action: "deleted", installation: { id: 31337 } }, "installation")).status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { githubInstallationId: 31337 } });
  });

  it("answers GitHub right away and starts the review in the background", async () => {
    const payload = {
      action: "opened",
      installation: { id: 777 },
      repository: { id: 42, name: "my-repo", full_name: "alice/my-repo", owner: { login: "alice" }, default_branch: "main", private: false },
      pull_request: { number: 7, title: "Add endpoint", body: "", state: "open", draft: false, html_url: "https://github.com/alice/my-repo/pull/7", head: { sha: "a".repeat(40) }, user: { type: "User" } },
      sender: { type: "User" },
    };
    const response = await signed(payload, "pull_request");
    expect(response.status).toBe(202);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.runReview).toHaveBeenCalledWith(expect.objectContaining({ installationId: 777, owner: "alice", repo: "my-repo", number: 7 }));
  });

  it("does not review a draft", async () => {
    await signed(
      {
        action: "opened",
        installation: { id: 777 },
        repository: { id: 42, name: "r", full_name: "a/r", owner: { login: "a" }, default_branch: "main" },
        pull_request: { number: 1, title: "t", state: "open", draft: true, html_url: "https://github.com/a/r/pull/1", head: { sha: "a".repeat(40) }, user: { type: "User" } },
      },
      "pull_request",
    );
    expect(mocks.runReview).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads and fails closed when no secret is configured", async () => {
    const big = JSON.stringify({ pad: "x".repeat(2 * 1024 * 1024 + 10) });
    expect((await send(big, { "x-hub-signature-256": sign(big), "x-github-event": "ping" })).status).toBe(413);

    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "");
    const body = "{}";
    expect((await send(body, { "x-hub-signature-256": sign(body) })).status).toBe(500);
  });
});
