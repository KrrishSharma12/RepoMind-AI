import { describe, expect, it } from "vitest";
import { linkifyCitations } from "@/lib/chat/linkify";
import { readEvents } from "@/lib/chat/stream-client";
import type { StreamEvent } from "@/lib/chat/types";
import { streamOf } from "../helpers";

describe("linkifyCitations", () => {
  const href = (p: string) => `/r?path=${encodeURIComponent(p)}`;

  it("links only files that were really retrieved", () => {
    const out = linkifyCitations("See [src/auth.ts:10-20] and [src/ghost.ts:1-2] and [src/auth.ts:7].", ["src/auth.ts"], href);
    expect(out).toContain("[src/auth.ts:10-20](/r?path=src%2Fauth.ts)");
    expect(out).toContain("[src/auth.ts:7](");
    expect(out).toContain("[src/ghost.ts:1-2]");
    expect(out).not.toContain("ghost.ts:1-2](");
  });

  it("escapes brackets in link text and parentheses in the URL", () => {
    const withBrackets = linkifyCitations("[src/app/[owner]/p.tsx:3-4]", ["src/app/[owner]/p.tsx"], (p) => `/x?path=${encodeURIComponent(p)}`);
    expect(withBrackets.startsWith("[src/app/\\[owner\\]/p.tsx:3-4](/x?path=")).toBe(true);

    const withParens = linkifyCitations("[a(1).ts:1-2]", ["a(1).ts"], (p) => `/x?path=${p}`);
    expect(withParens).toContain("%28");
  });
});

describe("readEvents", () => {
  it("rebuilds events split across network chunks and skips bad ones", async () => {
    const wire = [
      `data: ${JSON.stringify({ type: "meta", conversationId: "c1", sources: [] })}\n\n`,
      `data: ${JSON.stringify({ type: "delta", text: "Hel" })}\n\n`,
      "data: not json\n\n",
      `data: ${JSON.stringify({ type: "bogus" })}\n\n`,
      `data: ${JSON.stringify({ type: "delta", text: "lo" })}\r\n\r\n`,
      `data: ${JSON.stringify({ type: "done", sources: [] })}\n\n`,
    ].join("");
    const pieces = [wire.slice(0, 17), wire.slice(17, 90), wire.slice(90, 91), wire.slice(91)];

    const events: StreamEvent[] = [];
    for await (const event of readEvents(streamOf(pieces))) events.push(event);

    expect(events.map((e) => e.type)).toEqual(["meta", "delta", "delta", "done"]);
    expect(events.filter((e): e is Extract<StreamEvent, { type: "delta" }> => e.type === "delta").map((e) => e.text).join("")).toBe("Hello");
  });
});
