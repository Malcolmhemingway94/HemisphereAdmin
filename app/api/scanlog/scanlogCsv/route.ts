// @ts-nocheck
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "scanlogs.json");

    // Try to read scanlogs.json
    let raw;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      // If file doesn't exist yet, pretend it's empty
      raw = "[]";
    }

    let logs;
    try {
      logs = JSON.parse(raw);
    } catch {
      logs = [];
    }

    const headers = [
      "id",
      "attendeeId",
      "attendeeName",
      "attendeeEmail",
      "timestamp",
    ];

    const lines: string[] = [];
    // Header row
    lines.push(headers.join(","));

    // Data rows
    for (const log of logs) {
      const row = [
        log.id ?? "",
        log.attendeeId ?? "",
        log.attendeeName ?? "",
        log.attendeeEmail ?? "",
        log.timestamp ?? "",
      ].map((value) => {
        const str = String(value ?? "");
        const escaped = str.replace(/"/g, '""'); // escape quotes
        return `"${escaped}"`;
      });

      lines.push(row.join(","));
    }

    const csv = lines.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="scanlogs.csv"',
      },
    });
  } catch (err) {
    console.error("CSV error:", err);
    return new Response("Unable to generate CSV", { status: 500 });
  }
}

