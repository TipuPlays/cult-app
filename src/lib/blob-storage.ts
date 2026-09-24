import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

export type StoredBlob = {
  key: string;
  url: string;
  contentType: string;
  bytes: number;
};

export interface BlobStorageAdapter {
  put(
    bytes: Uint8Array,
    contentType: string,
    opts?: { prefix?: string },
  ): Promise<StoredBlob>;
  get(
    key: string,
  ): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

/**
 * Local disk adapter — ephemeral on Render free FS; swap for S3/R2 later.
 * Files under BLOB_STORAGE_DIR (default .data/blobs).
 */
export class LocalBlobStorageAdapter implements BlobStorageAdapter {
  constructor(private rootDir: string) {}

  private async ensureRoot() {
    await mkdir(this.rootDir, { recursive: true });
  }

  async put(
    bytes: Uint8Array,
    contentType: string,
    opts?: { prefix?: string },
  ): Promise<StoredBlob> {
    await this.ensureRoot();
    const ext =
      contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : contentType.includes("pdf")
            ? "pdf"
            : "jpg";
    const prefix = opts?.prefix ?? "receipts";
    const key = `${prefix}/${nanoid(16)}.${ext}`;
    const full = path.join(this.rootDir, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    // App-served URL (see /api/blobs/[...key])
    const url = `/api/blobs/${key}`;
    return { key, url, contentType, bytes: bytes.byteLength };
  }

  async get(
    key: string,
  ): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const safe = key.replace(/\.\./g, "");
    const full = path.join(this.rootDir, safe);
    try {
      const buf = await readFile(full);
      const ext = path.extname(full).toLowerCase();
      const contentType =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".pdf"
              ? "application/pdf"
              : "image/jpeg";
      return { bytes: new Uint8Array(buf), contentType };
    } catch {
      return null;
    }
  }
}

/** In-memory mock for tests */
export class MemoryBlobStorageAdapter implements BlobStorageAdapter {
  private store = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(
    bytes: Uint8Array,
    contentType: string,
    opts?: { prefix?: string },
  ): Promise<StoredBlob> {
    const key = `${opts?.prefix ?? "receipts"}/${nanoid(12)}`;
    this.store.set(key, { bytes, contentType });
    return {
      key,
      url: `/api/blobs/${key}`,
      contentType,
      bytes: bytes.byteLength,
    };
  }

  async get(key: string) {
    return this.store.get(key) ?? null;
  }
}

const root =
  process.env.BLOB_STORAGE_DIR ||
  path.join(process.cwd(), ".data", "blobs");

export const blobStorage: BlobStorageAdapter =
  process.env.BLOB_STORAGE === "memory"
    ? new MemoryBlobStorageAdapter()
    : new LocalBlobStorageAdapter(root);
