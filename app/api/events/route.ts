import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const eventsFile = path.join(process.cwd(), "data", "events.json");

export async function GET() {
  try {
    const file = await fs.promises.readFile(eventsFile, "utf8");
    const events = JSON.parse(file);
    return NextResponse.json(Array.isArray(events) ? events : []);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return NextResponse.json([]);
    }
    console.error("Events list API error:", err);
    return NextResponse.json({ error: "Error reading events" }, { status: 500 });
  }
}
