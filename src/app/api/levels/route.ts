import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { levels } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(levels).orderBy(asc(levels.rank));
  return NextResponse.json({ levels: rows });
}
