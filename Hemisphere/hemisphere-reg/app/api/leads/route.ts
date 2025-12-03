// @ts-nocheck
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const leadsPath = path.join(process.cwd(), "data", "leads.json");

// helper: read leads from file safely
async function readLeadsFile() {
  try {
    const raw = await fs.readFile(leadsPath, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    // file might not exist yet – treat as empty
    return [];
  }
}

// helper: write leads to file
async function writeLeadsFile(leads: any[]) {
  await fs.writeFile(leadsPath, JSON.stringify(leads, null, 2));
}

// GET - return all leads
export async function GET() {
  try {
    const leads = await readLeadsFile();
    return NextResponse.json(leads);
  } catch (err) {
    console.error("Error reading leads:", err);
    return NextResponse.json({ error: "Cannot read leads" }, { status: 500 });
  }
}

// POST - add a new lead
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const leads = await readLeadsFile();

  const newLead = {
  id: Date.now(),
  eventId: body.eventId || "unknown_event",
  attendeeId: body.attendeeId,
  attendeeName: body.attendeeName,
  attendeeEmail: body.attendeeEmail,
  exhibitor: body.exhibitor || "Unknown Exhibitor",
  notes: body.notes || "",
  timestamp: new Date().toISOString(),
};


    leads.push(newLead);

    await writeLeadsFile(leads);

    return NextResponse.json(newLead, { status: 201 });
  } catch (err) {
    console.error("Error saving lead:", err);
    return NextResponse.json({ error: "Unable to save lead" }, { status: 500 });
  }
}
