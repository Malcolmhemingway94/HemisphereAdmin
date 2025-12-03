import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const scanLogPath = path.join(process.cwd(), "data", "scanlogs.json");

// GET – get all logs
export async function GET() {
  try {
    const data = await fs.readFile(scanLogPath, "utf8");
    const logs = JSON.parse(data);
    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ error: "Cannot read scan logs" }, { status: 500 });
  }
}

// POST – add a log entry
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const method = body.method || "scan";

    const current = await fs.readFile(scanLogPath, "utf8");
    const logs = JSON.parse(current);

    const newLog = {
      id: Date.now(),
      attendeeId: body.attendeeId,
      attendeeName: body.attendeeName,
      attendeeEmail: body.attendeeEmail,
      method,
      timestamp: new Date().toISOString(),
    };

    logs.push(newLog);

    await fs.writeFile(scanLogPath, JSON.stringify(logs, null, 2));

    return NextResponse.json(newLog);
  } catch (err) {
    return NextResponse.json({ error: "Unable to save scan" }, { status: 500 });
  }
}
