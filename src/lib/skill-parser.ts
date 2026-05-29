import matter from "gray-matter";
import type { ParsedSkillMetadata } from "./types";

export function parseSkillMarkdown(content: string): ParsedSkillMetadata {
  try {
    const parsed = matter(content);
    const frontmatter =
      parsed.data && typeof parsed.data === "object" ? parsed.data : {};

    return {
      name: asString(frontmatter.name),
      description: asString(frontmatter.description),
      frontmatter,
      body: parsed.content,
    };
  } catch (error) {
    return {
      frontmatter: {},
      body: content,
      parseError: error instanceof Error ? error.message : "Unknown parse error",
    };
  }
}

export function getSkillDisplayName(content: string) {
  const metadata = parseSkillMarkdown(content);
  return metadata.name || "未命名 skill";
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
