import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";
import fs from "fs/promises";
import path from "path";
import { GeneratedItem } from "./types";

const ZSET_KEY = "items:sorted";
const inMemoryItems: GeneratedItem[] = [];

const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const hasKv =
  Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN);

export async function storeGeneratedFile(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (hasBlob) {
    const result = await put(`generated/${filename}`, buffer, {
      access: "public",
      contentType,
    });
    return result.url;
  }

  const publicPath = path.join(process.cwd(), "public", "generated", filename);
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.writeFile(publicPath, buffer);
  return `/generated/${filename}`;
}

export async function saveItem(item: GeneratedItem) {
  if (hasKv) {
    await kv.set(`item:${item.id}`, item);
    await kv.zadd(ZSET_KEY, {
      score: new Date(item.createdAt).getTime(),
      member: item.id,
    });
    return;
  }

  inMemoryItems.unshift(item);
}

export async function getItems(limit = 20): Promise<GeneratedItem[]> {
  if (hasKv) {
    const ids = await kv.zrange(ZSET_KEY, -limit, -1, { rev: true });
    if (!ids.length) return [];
    const items = await kv.mget<GeneratedItem>(
      ids.map((id) => `item:${id}`)
    );
    return items.filter((item): item is GeneratedItem => Boolean(item));
  }

  return inMemoryItems.slice(0, limit);
}
