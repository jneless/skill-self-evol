import type { SkillReference } from "./types";

const referencePattern =
  /(?:\]\(|["'`\s(])((?:\.\/)?(?:references|scripts|assets|templates)\/[A-Za-z0-9._/@%+\-=]+)(?:["'`)\s]|$)/g;

export function scanSkillReferences(
  content: string,
  manifestFiles?: string[],
): SkillReference[] {
  const normalizedManifest = new Set(
    (manifestFiles || []).map((file) => normalizePath(file)),
  );
  const paths = new Set<string>();

  for (const match of content.matchAll(referencePattern)) {
    const path = normalizePath(match[1]);
    if (path) {
      paths.add(path);
    }
  }

  return [...paths].sort().map((path) => ({
    path,
    kind: classifyReference(path),
    status: manifestFiles
      ? normalizedManifest.has(path)
        ? "present"
        : "missing"
      : "unknown",
  }));
}

function normalizePath(path: string) {
  return path
    .replace(/^\.\//, "")
    .replace(/\\/g, "/")
    .replace(/[.,;:!?]+$/, "");
}

function classifyReference(path: string): SkillReference["kind"] {
  if (path.startsWith("references/")) return "references";
  if (path.startsWith("scripts/")) return "scripts";
  if (path.startsWith("assets/")) return "assets";
  if (path.startsWith("templates/")) return "templates";
  return "other";
}
