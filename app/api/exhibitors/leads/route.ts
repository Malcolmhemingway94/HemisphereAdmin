import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const tokensFile = path.join(process.cwd(), "data", "exhibitor_tokens.json");
const leadsFile = path.join(process.cwd(), "data", "leads.json");

type TokenRecord = {
  email: string;
  token: string;
  expiresAt: string;
};

async function readTokens(): Promise<TokenRecord[]> {
  try {
    const file = await fs.promises.readFile(tokensFile, "utf8");
    return JSON.parse(file);
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function readLeads() {
  try {
    const file = await fs.promises.readFile(leadsFile, "utf8");
    return JSON.parse(file);
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function isTokenValid(token: string, records: TokenRecord[]) {
  const now = Date.now();
  return records.find(
    (t) => t.token === token && new Date(t.expiresAt).getTime() > now
  );
}

export async function GET(request: Request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.split(" ")[1]
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const tokens = await readTokens();
    const valid = isTokenValid(token, tokens);

    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const leads = await readLeads();

    // Normalize for the exhibitor portal
    const normalized = leads.map((l: any) => ({
      id: l.id,
      attendeeId: l.attendeeId ?? "",
      attendeeName: l.attendeeName || "",
      attendeeEmail: l.attendeeEmail || "",
      exhibitor: l.exhibitor || "",
      notes: l.notes || "",
      timestamp: l.timestamp || "",
      eventId: l.eventId || "",
    }));

    return NextResponse.json({ leads: normalized, email: valid.email });
  } catch (err) {
    console.error("Error fetching exhibitor leads:", err);
    return NextResponse.json({ error: "Error fetching leads" }, { status: 500 });
  }
}
