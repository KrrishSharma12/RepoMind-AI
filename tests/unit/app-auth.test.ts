import { createVerify, generateKeyPairSync } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GithubAppError, createAppJwt, getInstallationToken, normalizePrivateKey } from "@/lib/github/app-auth";
import { bodyOf, jsonResponse, mockFetch } from "../helpers";

let privateKey: string;
let publicKey: string;

beforeAll(() => {
  ({ privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  }));
});

function inspectJwt(jwt: string) {
  const [header, payload, signature] = jwt.split(".");
  return {
    valid: createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature, "base64url")),
    header: JSON.parse(Buffer.from(header, "base64url").toString()),
    payload: JSON.parse(Buffer.from(payload, "base64url").toString()),
  };
}

beforeEach(() => {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", privateKey.trim().replace(/\n/g, "\\n"));
});

describe("createAppJwt", () => {
  it("makes a valid, short-lived RS256 token", () => {
    const now = 1_700_000_000;
    const { valid, header, payload } = inspectJwt(createAppJwt("12345", privateKey, now));
    expect(valid).toBe(true);
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(payload).toEqual({ iat: now - 60, exp: now + 540, iss: 12345 });
    expect(payload.exp - now).toBeLessThanOrEqual(600); // GitHub's limit
  });

  it("accepts a key stored on one line with \\n, as in a .env file", () => {
    const oneLine = privateKey.trim().replace(/\n/g, "\\n");
    expect(oneLine).not.toContain("\n");
    expect(normalizePrivateKey(oneLine)).toBe(privateKey.trim());
    expect(inspectJwt(createAppJwt("12345", oneLine)).valid).toBe(true);
  });

  it("keeps a client id as text and rejects a broken key", () => {
    expect(inspectJwt(createAppJwt("Iv1.abc", privateKey)).payload.iss).toBe("Iv1.abc");
    expect(() => createAppJwt("1", "not a key")).toThrow();
  });
});

describe("getInstallationToken", () => {
  const fresh = (token: string, ms = 3_600_000) => jsonResponse({ token, expires_at: new Date(Date.now() + ms).toISOString() }, 201);

  it("asks for a token limited to one repository and two permissions, then caches it", async () => {
    let n = 0;
    const fetchMock = mockFetch(() => fresh(`ghs_token${++n}`));

    const first = await getInstallationToken(101, ["my-repo"]);
    expect(first).toBe("ghs_token1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.github.com/app/installations/101/access_tokens");
    expect(init.method).toBe("POST");
    expect(inspectJwt(init.headers.Authorization.replace("Bearer ", "")).valid).toBe(true);
    expect(bodyOf(init)).toEqual({ repositories: ["my-repo"], permissions: { contents: "read", pull_requests: "write" } });

    expect(await getInstallationToken(101, ["my-repo"])).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getInstallationToken(101, ["other-repo"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes a token that is about to expire", async () => {
    mockFetch(() => fresh("ghs_soon", 60_000));
    await getInstallationToken(202, ["r"]);
    const fetchMock = mockFetch(() => fresh("ghs_fresh"));
    expect(await getInstallationToken(202, ["r"])).toBe("ghs_fresh");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, /rejected the app credentials/],
    [404, /uninstalled/],
    [422, /permissions/],
    [500, /status 500/],
  ])("explains HTTP %i without leaking the response", async (status, pattern) => {
    mockFetch(() => jsonResponse({ message: "secret detail ghs_LEAK" }, status));
    const error = await getInstallationToken(300 + status, ["r"]).catch((e: Error) => e);
    expect(error).toBeInstanceOf(GithubAppError);
    expect((error as GithubAppError).message).toMatch(pattern);
    expect((error as GithubAppError).message).not.toContain("LEAK");
    expect((error as GithubAppError).status).toBe(status);
  });

  it("reports missing or unreadable credentials without echoing them", async () => {
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    await expect(getInstallationToken(1, ["r"])).rejects.toThrow(/GITHUB_APP_PRIVATE_KEY is not set/);

    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "garbage");
    const error = await getInstallationToken(2, ["r"]).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/could not be read/);
    expect((error as Error).message).not.toContain("garbage");
  });
});
