import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const dataFile = path.join(process.cwd(), "data", "attendees.json");

export async function GET() {
  try {
    const file = await fs.promises.readFile(dataFile, "utf8");
    const attendees = JSON.parse(file);

    // Sort newest first if createdAt exists
    const sorted = [...attendees].sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return NextResponse.json(sorted);
  } catch (err) {
    if (err.code === "ENOENT") {
      // No attendees file yet → just return empty array
      return NextResponse.json([]);
    }
    console.error("Attendees list API error:", err);
    return NextResponse.json(
      { error: "Error reading attendees" },
      { status: 500 }
    );
  }
}
