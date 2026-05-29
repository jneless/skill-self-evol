import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getEnv } from "./env";

let client: S3Client | undefined;

export function getStorageClient() {
  if (!client) {
    const env = getEnv();
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function putTextObject(key: string, body: string) {
  const env = getEnv();
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/plain; charset=utf-8",
    }),
  );
}

export async function putJsonObject(key: string, value: unknown) {
  const env = getEnv();
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: "application/json; charset=utf-8",
    }),
  );
}

export async function putBinaryObject(
  key: string,
  body: Uint8Array,
  contentType = "application/octet-stream",
) {
  const env = getEnv();
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getTextObject(key: string) {
  const env = getEnv();
  const result = await getStorageClient().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
  return result.Body?.transformToString("utf-8");
}

export async function getJsonObject<T>(key: string, fallback: T): Promise<T> {
  try {
    const text = await getTextObject(key);
    return text ? (JSON.parse(text) as T) : fallback;
  } catch (error) {
    if (isMissingObjectError(error)) return fallback;
    throw error;
  }
}

export async function deleteObject(key: string) {
  const env = getEnv();
  await getStorageClient().send(
    new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
}

export async function objectExists(key: string) {
  const env = getEnv();
  try {
    await getStorageClient().send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    );
    return true;
  } catch (error) {
    if (isMissingObjectError(error)) return false;
    throw error;
  }
}

export async function listKeys(prefix: string) {
  const env = getEnv();
  const result = await getStorageClient().send(
    new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: prefix }),
  );
  return (result.Contents || []).map((item) => item.Key).filter(Boolean);
}

export async function updateIndex<T extends { id: string }>(
  key: string,
  item: T,
) {
  const existing = await getJsonObject<T[]>(key, []);
  const next = [item, ...existing.filter((entry) => entry.id !== item.id)];
  await putJsonObject(key, next);
  return next;
}

function isMissingObjectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    ("name" in error || "$metadata" in error) &&
    ((error as { name?: string }).name === "NoSuchKey" ||
      (error as { name?: string }).name === "NotFound" ||
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404)
  );
}
