// @ts-nocheck
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const eventsPath = path.join(process.cwd(), "data", "events.json");

async function readEventsFile() {
  try {
    const raw = await fs.readFile(eventsPath, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = (body.code || "").trim();

    if (!code) {
      return NextResponse.json(
        { error: "Activation code is required" },
        { status: 400 }
      );
    }

    const events = await readEventsFile();

    const event = events.find(
      (evt: any) =>
        typeof evt.activationCode === "string" &&
        evt.activationCode.toLowerCase() === code.toLowerCase()
    );

    if (!event) {
      return NextResponse.json(
        { error: "Invalid activation code" },
        { status: 401 }
      );
    }

    // You could generate a token here later; for now just return event info
    return NextResponse.json({
      eventId: event.id,
      eventName: event.name,
    });
  } catch (err) {
    console.error("Error in /api/activate:", err);
    return NextResponse.json(
      { error: "Unable to validate activation code" },
      { status: 500 }
    );
  }
}
