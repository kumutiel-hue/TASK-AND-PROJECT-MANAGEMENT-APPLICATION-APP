import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_PROJECT_FILE_SIZE = 25 * 1024 * 1024;
const allowedContentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
]);
let cachedClient;
let cachedBucket;

export class StorageConfigurationError extends Error {
  constructor() {
    super("File storage is not configured. Set S3_BUCKET and S3_REGION.");
    this.name = "StorageConfigurationError";
  }
}

export function isAllowedProjectFileType(contentType) {
  return allowedContentTypes.has(contentType);
}

function getStorage() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim() || process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";
  if (!bucket || !region || Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new StorageConfigurationError();
  }

  if (!cachedClient || cachedBucket !== bucket) {
    cachedClient = new S3Client({
      region,
      ...(process.env.S3_ENDPOINT?.trim() ? { endpoint: process.env.S3_ENDPOINT.trim() } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      ...(accessKeyId
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    cachedBucket = bucket;
  }
  return { client: cachedClient, bucket };
}

export async function createProjectFileUploadUrl({ key, contentType, size }) {
  const { client, bucket } = getStorage();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: 300 },
  );
}

export async function verifyProjectFileUpload({ key }) {
  const { client, bucket } = getStorage();
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

export async function createProjectFileDownloadUrl({ key, name }) {
  const { client, bucket } = getStorage();
  const safeName = name.replace(/[\r\n"]/g, "_");
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    }),
    { expiresIn: 300 },
  );
}

export async function deleteProjectFileObject({ key }) {
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
