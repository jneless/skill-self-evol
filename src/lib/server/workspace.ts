import JSZip from "jszip";
import { parseSkillMarkdown } from "../skill-parser";
import { scanSkillReferences } from "../reference-scan";
import type { CurrentSkill, ZipManifest } from "../types";
import { getEnv } from "./env";
import {
  getJsonObject,
  getTextObject,
  objectExists,
  putBinaryObject,
  putJsonObject,
  putTextObject,
} from "./storage";

const skillKey = "workspace/current-skill.md";
const metadataKey = "workspace/current-skill-metadata.json";
const sourceZipKey = "workspace/source.zip";
const manifestKey = "workspace/manifest.json";

export async function getCurrentSkill(): Promise<CurrentSkill> {
  const content = (await safeGetText(skillKey)) || "";
  const metadata = parseSkillMarkdown(content);
  const manifest = await getJsonObject<ZipManifest | null>(manifestKey, null);
  const stored = await getJsonObject<Partial<CurrentSkill>>(metadataKey, {});

  return {
    content,
    metadata,
    references: scanSkillReferences(content, manifest?.files),
    sourceType: stored.sourceType || (content ? "paste" : "empty"),
    sourceFileName: stored.sourceFileName,
    updatedAt: stored.updatedAt,
  };
}

export async function saveCurrentSkill(
  content: string,
  sourceType: CurrentSkill["sourceType"] = "paste",
  sourceFileName?: string,
) {
  enforceSkillSize(content);
  const metadata = parseSkillMarkdown(content);
  const manifest = await getJsonObject<ZipManifest | null>(manifestKey, null);
  const now = new Date().toISOString();
  const current: CurrentSkill = {
    content,
    metadata,
    references: scanSkillReferences(content, manifest?.files),
    sourceType,
    sourceFileName,
    updatedAt: now,
  };

  await putTextObject(skillKey, content);
  await putJsonObject(metadataKey, {
    metadata,
    references: current.references,
    sourceType,
    sourceFileName,
    updatedAt: now,
  });

  return current;
}

export async function saveUploadedMarkdown(file: File) {
  const content = await file.text();
  return saveCurrentSkill(content, "md_upload", file.name);
}

export async function saveUploadedZip(file: File) {
  const env = getEnv();
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.byteLength > env.MAX_SOURCE_ZIP_BYTES) {
    throw new Error("zip 文件超过大小限制");
  }

  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
  const skillFile = zip.file("SKILL.md");
  if (!skillFile) {
    throw new Error("zip 根目录必须包含 SKILL.md");
  }

  const content = await skillFile.async("string");
  enforceSkillSize(content);
  const manifest: ZipManifest = {
    sourceType: "zip",
    skillMdPath: "SKILL.md",
    files,
    extractedAt: new Date().toISOString(),
  };

  await putBinaryObject(sourceZipKey, buffer, "application/zip");
  await putJsonObject(manifestKey, manifest);
  return saveCurrentSkill(content, "zip_upload", file.name);
}

export async function getSourceManifest() {
  return getJsonObject<ZipManifest | null>(manifestKey, null);
}

export async function hasSourceZip() {
  return objectExists(sourceZipKey);
}

function enforceSkillSize(content: string) {
  const env = getEnv();
  if (new TextEncoder().encode(content).byteLength > env.MAX_SKILL_MD_BYTES) {
    throw new Error("SKILL.md 超过大小限制");
  }
}

async function safeGetText(key: string) {
  try {
    return await getTextObject(key);
  } catch {
    return undefined;
  }
}
