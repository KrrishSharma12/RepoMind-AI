import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks that a webhook really came from GitHub: GitHub signs the exact bytes of the
 * request body with our shared secret. Compared in constant time.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;

  const given = signatureHeader.slice(prefix.length);
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(given, "hex"));
}

export interface PullRequestEvent {
  action: string;
  installationId: number;
  githubRepoId: number;
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  number: number;
  title: string;
  body: string;
  headSha: string;
  url: string;
  changedFiles: number;
}

export type WebhookDecision =
  | { kind: "ping" }
  | { kind: "ignore"; reason: string }
  | { kind: "uninstall"; installationId: number }
  | { kind: "review"; pr: PullRequestEvent };

const REVIEW_ACTIONS = new Set(["opened", "synchronize", "reopened", "ready_for_review"]);
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/i;
const MAX_BODY_CHARS = 3000;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
const positiveInt = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** Decides what to do with a verified webhook. Pure: no database, no network. */
export function decideWebhookAction(event: string | null, payload: unknown): WebhookDecision {
  if (event === "ping") return { kind: "ping" };

  const root = record(payload);
  if (!root) return { kind: "ignore", reason: "payload is not an object" };

  if (event === "installation") {
    const id = record(root.installation)?.id;
    if (root.action === "deleted" && positiveInt(id)) return { kind: "uninstall", installationId: id };
    return { kind: "ignore", reason: "installation event needs no action" };
  }

  if (event !== "pull_request") return { kind: "ignore", reason: `event "${event}" is not handled` };

  const action = text(root.action);
  if (!action || !REVIEW_ACTIONS.has(action)) return { kind: "ignore", reason: `action "${action}" is not reviewed` };

  const installationId = record(root.installation)?.id;
  const repository = record(root.repository);
  const pr = record(root.pull_request);
  if (!positiveInt(installationId) || !repository || !pr) return { kind: "ignore", reason: "missing installation, repository, or pull request" };

  const owner = text(record(repository.owner)?.login);
  const repo = text(repository.name);
  const fullName = text(repository.full_name);
  const defaultBranch = text(repository.default_branch);
  if (!owner || !repo || !fullName || !defaultBranch || !NAME.test(owner) || !NAME.test(repo) || !positiveInt(repository.id)) {
    return { kind: "ignore", reason: "invalid repository" };
  }

  const head = record(pr.head);
  const headSha = text(head?.sha);
  const title = text(pr.title);
  const url = text(pr.html_url);
  if (!positiveInt(pr.number) || !headSha || !SHA.test(headSha) || title === null || !url) {
    return { kind: "ignore", reason: "invalid pull request" };
  }

  if (pr.state !== "open") return { kind: "ignore", reason: "pull request is not open" };
  if (pr.draft === true) return { kind: "ignore", reason: "draft pull request" };
  if (text(record(pr.user)?.type) === "Bot") return { kind: "ignore", reason: "pull request opened by a bot" };
  if (text(record(root.sender)?.type) === "Bot") return { kind: "ignore", reason: "change made by a bot" };

  return {
    kind: "review",
    pr: {
      action,
      installationId,
      githubRepoId: repository.id,
      owner,
      repo,
      fullName,
      defaultBranch,
      isPrivate: repository.private === true,
      number: pr.number,
      title: title.slice(0, 300),
      body: (text(pr.body) ?? "").slice(0, MAX_BODY_CHARS),
      headSha,
      url,
      changedFiles: typeof pr.changed_files === "number" ? pr.changed_files : 0,
    },
  };
}