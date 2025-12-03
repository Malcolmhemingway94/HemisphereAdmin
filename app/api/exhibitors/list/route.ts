import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const leadsFile = path.join(process.cwd(), "data", "leads.json");

async function readLeads() {
  try {
    const file = await fs.promises.readFile(leadsFile, "utf8");
    return JSON.parse(file);
  } catch (err: any) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function makeActivationCode(name: string) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "EXHIBITOR";
  const hash = crypto.createHash("sha256").update(base).digest("hex").slice(0, 6).toUpperCase();
  return `${base.slice(0, 6)}-${hash}`;
}

export async function GET() {
  try {
    const leads = await readLeads();
    const names = new Set<string>();
    leads.forEach((l: any) => {
      if (l?.exhibitor) {
        names.add(String(l.exhibitor).trim());
      }
    });

    const exhibitors = Array.from(names).map((name) => ({
      name,
      activationCode: makeActivationCode(name),
    }));

    return NextResponse.json(exhibitors);
  } catch (err) {
    console.error("Error reading exhibitors list:", err);
    return NextResponse.json({ error: "Error reading exhibitors" }, { status: 500 });
  }
}
