import { NextRequest } from "next/server";
import { createItem, getItems } from "@/lib/items";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

  const items = await getItems(Number.isNaN(limit) ? 20 : limit);
  return Response.json(items);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return Response.json({ error: "audio file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    if (buffer.length === 0) {
      return Response.json({ error: "audio file is empty" }, { status: 400 });
    }

    const item = await createItem(buffer);

    return Response.json(item, { status: 201 });
  } catch (error) {
    console.error("[POST /api/items] error", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
