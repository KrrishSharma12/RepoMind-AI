/**
 * Reads a unified diff ("patch") the way GitHub shows it. We need the line numbers
 * on the NEW side of the diff, because inline review comments can only be attached
 * to lines that appear in the diff. Pure functions with no imports.
 */

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function splitPatch(patch: string): string[] {
  return patch.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
}

/** Which new-side lines appear in the diff, and which of them were added. */
export function parsePatch(patch: string): { rightLines: Set<number>; addedLines: Set<number> } {
  const rightLines = new Set<number>();
  const addedLines = new Set<number>();
  let right = 0;
  let inHunk = false;

  for (const line of splitPatch(patch)) {
    const header = HUNK_HEADER.exec(line);
    if (header) {
      right = Number(header[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk || line.startsWith("\\")) continue; // "\ No newline at end of file"

    if (line.startsWith("+")) {
      rightLines.add(right);
      addedLines.add(right);
      right++;
    } else if (!line.startsWith("-")) {
      rightLines.add(right); // unchanged context line
      right++;
    }
  }
  return { rightLines, addedLines };
}

/** The diff with each new-side line labeled "L<number>", so the model can point at exact lines. */
export function annotatePatch(patch: string): string {
  const out: string[] = [];
  let right = 0;
  let inHunk = false;

  for (const line of splitPatch(patch)) {
    const header = HUNK_HEADER.exec(line);
    if (header) {
      right = Number(header[1]);
      inHunk = true;
      out.push(line);
      continue;
    }
    if (!inHunk || line.startsWith("\\")) continue;

    if (line.startsWith("+")) {
      out.push(`L${right} +${line.slice(1)}`);
      right++;
    } else if (line.startsWith("-")) {
      out.push(`     -${line.slice(1)}`);
    } else {
      out.push(`L${right}  ${line.slice(1)}`);
      right++;
    }
  }
  return out.join("\n");
}