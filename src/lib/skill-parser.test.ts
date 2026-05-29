import { describe, expect, it } from "vitest";
import { parseSkillMarkdown } from "./skill-parser";

describe("parseSkillMarkdown", () => {
  it("parses skill frontmatter", () => {
    const parsed = parseSkillMarkdown(`---
name: review
description: Use when reviewing code.
---

# Workflow`);

    expect(parsed.name).toBe("review");
    expect(parsed.description).toBe("Use when reviewing code.");
    expect(parsed.body).toContain("Workflow");
  });

  it("keeps content when frontmatter is invalid", () => {
    const parsed = parseSkillMarkdown(`---
name: [broken
---
body`);

    expect(parsed.parseError).toBeTruthy();
    expect(parsed.body).toContain("body");
  });
});
