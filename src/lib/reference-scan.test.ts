import { describe, expect, it } from "vitest";
import { scanSkillReferences } from "./reference-scan";

describe("scanSkillReferences", () => {
  it("detects known reference paths", () => {
    const refs = scanSkillReferences(
      "Read `references/guide.md` then run scripts/check.py.",
    );

    expect(refs.map((ref) => ref.path)).toEqual([
      "references/guide.md",
      "scripts/check.py",
    ]);
    expect(refs.every((ref) => ref.status === "unknown")).toBe(true);
  });

  it("marks zip manifest presence", () => {
    const refs = scanSkillReferences("Use references/guide.md and assets/icon.png", [
      "references/guide.md",
    ]);

    expect(refs).toEqual([
      { path: "assets/icon.png", kind: "assets", status: "missing" },
      { path: "references/guide.md", kind: "references", status: "present" },
    ]);
  });
});
