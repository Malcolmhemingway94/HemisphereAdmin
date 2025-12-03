import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const attendeesFile = path.join(process.cwd(), "data", "attendees.json");

async function readAttendees() {
  try {
    const file = await fs.promises.readFile(attendeesFile, "utf8");
    return JSON.parse(file);
  } catch (err) {
    // If file doesn't exist yet, start with empty array
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeAttendees(attendees) {
  await fs.promises.writeFile(
    attendeesFile,
    JSON.stringify(attendees, null, 2),
    "utf8"
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, company } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "firstName, lastName, and email are required" },
        { status: 400 }
      );
    }

    const attendees = await readAttendees();

    // Enforce one registration per email (case-insensitive, trimmed)
    const normalizedEmail = String(email).trim().toLowerCase();
    const duplicate = attendees.find(
      (a) => String(a.email || "").trim().toLowerCase() === normalizedEmail
    );
    if (duplicate) {
      return NextResponse.json(
        { error: "An attendee with this email is already registered." },
        { status: 409 }
      );
    }

    // Simple unique ID: current timestamp
    const id = String(Date.now());

    const newAttendee = {
      id,
      firstName,
      lastName,
      email: normalizedEmail,
      company: company || "",
      createdAt: new Date().toISOString(),
    };

    attendees.push(newAttendee);
    await writeAttendees(attendees);

    const qrValue = `hemisphere:${id}`;

    return NextResponse.json(
      {
        attendee: newAttendee,
        qrValue, // this is what goes on the badge QR
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { error: "Server error while registering attendee" },
      { status: 500 }
    );
  }
}
