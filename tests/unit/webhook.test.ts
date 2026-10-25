import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decideWebhookAction, verifyWebhookSignature } from "@/lib/github/webhook";

const secret = "my-webhook-secret";
const body = JSON.stringify({ hello: "wörld ✓" });
const sign = (payload: string, key = secret) => `sha256=${createHmac("sha256", key).update(payload).digest("hex")}`;

describe("verifyWebhookSignature", () => {
  it("accepts an exact, correctly signed body", () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body), secret)).toBe(true);
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it.each([
    ["a tampered body", () => verifyWebhookSignature(Buffer.from(`${body} `), sign(body), secret)],
    ["the wrong secret", () => verifyWebhookSignature(Buffer.from(body), sign(body, "other"), secret)],
    ["a missing header", () => verifyWebhookSignature(Buffer.from(body), null, secret)],
    ["the wrong scheme", () => verifyWebhookSignature(Buffer.from(body), sign(body).replace("sha256=", "sha1="), secret)],
    ["a short signature", () => verifyWebhookSignature(Buffer.from(body), "sha256=abc", secret)],
    ["a non-hex signature", () => verifyWebhookSignature(Buffer.from(body), `sha256=${"z".repeat(64)}`, secret)],
    ["an empty secret", () => verifyWebhookSignature(Buffer.from(body), sign(body), "")],
  ])("rejects %s", (_name, check) => {
    expect(check()).toBe(false);
  });
});

const sha = "a".repeat(40);
const payload = (over: Record<string, unknown> = {}, pr: Record<string, unknown> = {}, root: Record<string, unknown> = {}) => ({
  action: "opened",
  installation: { id: 777 },
  repository: { id: 42, name: "my-repo", full_name: "alice/my-repo", owner: { login: "alice" }, default_branch: "main", private: true },
  pull_request: {
    number: 7, title: "Add endpoint", body: "details", state: "open", draft: false,
    html_url: "https://github.com/alice/my-repo/pull/7", head: { sha }, user: { type: "User" }, changed_files: 3, ...pr,
  },
  sender: { type: "User" },
  ...root,
  ...over,
});

describe("decideWebhookAction", () => {
  it("answers pings", () => {
    expect(decideWebhookAction("ping", {})).toEqual({ kind: "ping" });
  });

  it("reviews an opened pull request and extracts what the reviewer needs", () => {
    const decision = decideWebhookAction("pull_request", payload());
    expect(decision.kind).toBe("review");
    if (decision.kind !== "review") return;
    expect(decision.pr).toMatchObject({
      installationId: 777, githubRepoId: 42, owner: "alice", repo: "my-repo", number: 7, headSha: sha, isPrivate: true, defaultBranch: "main",
    });
  });

  it.each(["synchronize", "reopened", "ready_for_review"])("also reviews on %s", (action) => {
    expect(decideWebhookAction("pull_request", payload({ action })).kind).toBe("review");
  });

  it.each(["closed", "labeled", "edited", "assigned"])("ignores %s", (action) => {
    expect(decideWebhookAction("pull_request", payload({ action })).kind).toBe("ignore");
  });

  it("ignores drafts, closed pull requests, and bots", () => {
    expect(decideWebhookAction("pull_request", payload({}, { draft: true })).kind).toBe("ignore");
    expect(decideWebhookAction("pull_request", payload({}, { state: "closed" })).kind).toBe("ignore");
    expect(decideWebhookAction("pull_request", payload({}, { user: { type: "Bot" } })).kind).toBe("ignore");
    expect(decideWebhookAction("pull_request", payload({}, {}, { sender: { type: "Bot" } })).kind).toBe("ignore");
  });

  it("ignores malformed payloads and unsafe names", () => {
    const bad = [
      payload({}, { head: { sha: "nothex" } }),
      payload({}, { number: -1 }),
      payload({}, { number: "7" }),
      payload({ installation: {} }),
      payload({ repository: { ...payload().repository, name: "../evil" } }),
      payload({ repository: { ...payload().repository, owner: { login: "a b" } } }),
    ];
    for (const p of bad) expect(decideWebhookAction("pull_request", p).kind).toBe("ignore");
    expect(decideWebhookAction("issues", payload()).kind).toBe("ignore");
    expect(decideWebhookAction("pull_request", null).kind).toBe("ignore");
    expect(decideWebhookAction("pull_request", [1]).kind).toBe("ignore");
  });

  it("caps very long titles and descriptions", () => {
    const decision = decideWebhookAction("pull_request", payload({}, { title: "t".repeat(900), body: "b".repeat(9000) }));
    if (decision.kind !== "review") throw new Error("expected a review decision");
    expect(decision.pr.title.length).toBeLessThanOrEqual(300);
    expect(decision.pr.body.length).toBeLessThanOrEqual(3000);
  });

  it("removes a saved installation only when GitHub says it was deleted", () => {
    expect(decideWebhookAction("installation", { action: "deleted", installation: { id: 9 } })).toEqual({ kind: "uninstall", installationId: 9 });
    expect(decideWebhookAction("installation", { action: "created", installation: { id: 9 } }).kind).toBe("ignore");
    expect(decideWebhookAction("installation", { action: "deleted", installation: { id: "9" } }).kind).toBe("ignore");
  });
});
