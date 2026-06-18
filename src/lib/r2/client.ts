import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const BUCKET = () => requireEnv("R2_BUCKET_NAME");

let _r2: S3Client | null = null;

export function getR2(): S3Client {
  if (!_r2) {
    _r2 = new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return _r2;
}

const R2_CONFIGURED = Boolean(process.env.R2_ACCOUNT_ID);

export async function presignPut(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    getR2(),
    new PutObjectCommand({ Bucket: BUCKET(), Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
}

export async function presignGet(key: string): Promise<string> {
  if (!R2_CONFIGURED) {
    const seed = key.replace(/[^a-zA-Z0-9]/g, "-");
    return `https://picsum.photos/seed/${seed}/800/600`;
  }
  return getSignedUrl(
    getR2(),
    new GetObjectCommand({ Bucket: BUCKET(), Key: key }),
    { expiresIn: 86400 }
  );
}

export async function deleteObject(key: string): Promise<void> {
  await getR2().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}
