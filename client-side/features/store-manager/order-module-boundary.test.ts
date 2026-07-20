import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Vitest runs from the client-side root.
const CLIENT_ROOT = process.cwd();

const SCANNED_DIRECTORIES = [
  "features/orders",
  "features/payments",
  "features/store-manager",
  "app/store-manager",
  "app/pay",
  "app/api/webhooks/dodo",
];

const DODO_ALLOWED = new Set([
  "features/payments/providers/dodo.ts",
  "features/payments/providers/dodo.test.ts",
]);

function listFiles(relativeDir: string): string[] {
  const absolute = join(CLIENT_ROOT, relativeDir);
  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const childRelative = `${relativeDir}/${entry}`;
    const childAbsolute = join(CLIENT_ROOT, childRelative);
    if (statSync(childAbsolute).isDirectory()) {
      return listFiles(childRelative);
    }
    return /\.(ts|tsx)$/u.test(entry) ? [childRelative] : [];
  });
}

const allFiles = SCANNED_DIRECTORIES.flatMap(listFiles);

function importLines(contents: string): string[] {
  return contents
    .split("\n")
    .filter((line) => /\b(import|export)\b.*\bfrom\b|import\(/u.test(line));
}

describe("store-manager order module boundary", () => {
  it("scans a non-empty set of module files", () => {
    expect(allFiles.length).toBeGreaterThan(10);
  });

  it("never imports student or dashboard modules", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const contents = readFileSync(join(CLIENT_ROOT, file), "utf8");
      for (const line of importLines(contents)) {
        if (
          /["'`][^"'`]*\/student(\/|["'`])/u.test(line) ||
          /features\/student/u.test(line) ||
          /app\/dashboard/u.test(line)
        ) {
          offenders.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("imports the Dodo SDK only inside the Dodo adapter", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      if (DODO_ALLOWED.has(file)) continue;
      const contents = readFileSync(join(CLIENT_ROOT, file), "utf8");
      if (/from\s+["'`]dodopayments["'`]/u.test(contents)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
