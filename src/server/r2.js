import {
  S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand,
} from "@aws-sdk/client-s3";

const g = globalThis;

function envOrThrow(k) {
  const v = process.env[k];
  if (!v) throw new Error(`R2 config: ${k} belum diset`);
  return v;
}

function getClient() {
  if (g.__scaR2) return g.__scaR2;
  const accountId = envOrThrow("R2_ACCOUNT_ID");
  const accessKeyId = envOrThrow("R2_ACCESS_KEY_ID");
  const secretAccessKey = envOrThrow("R2_SECRET_ACCESS_KEY");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  g.__scaR2 = client;
  return client;
}

export function bucket() {
  return envOrThrow("R2_BUCKET_NAME");
}

export function publicUrlFor(key) {
  const base = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("R2_PUBLIC_URL belum diset");
  return `${base}/${key}`;
}

export async function putObject(key, body, contentType) {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: contentType || "application/octet-stream",
  }));
  return { key, publicUrl: publicUrlFor(key) };
}

export async function deleteObject(key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function getObjectStream(key) {
  const client = getClient();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res;
}

export function isR2Ready() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL);
}
