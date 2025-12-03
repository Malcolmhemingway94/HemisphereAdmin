import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const dataFile = path.join(process.cwd(), "data", "attendees.json");

export async function GET(request, { params }) {
  try {
    const rawId = params.id;
    // Support QR values that include a prefix like "hemisphere:<id>"
    const id = String(rawId || "").split(":").pop();

    const file = await fs.promises.readFile(dataFile, "utf8");
    const attendees = JSON.parse(file);

    const attendee = attendees.find((a) => String(a.id) === String(id));

    if (!attendee) {
      return NextResponse.json(
        { error: "Attendee not found" },
        { status: 404 }
      );
    }

    const fullName = `${attendee.firstName || ""} ${attendee.lastName || ""}`.trim();

    return NextResponse.json({
      ...attendee,
      name: fullName || attendee.name || "", // Provide a single string name for clients that expect it
    });
  } catch (err) {
    console.error("Error reading attendee by ID:", err);
    return NextResponse.json(
      { error: "Error reading attendee" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const rawId = params.id;
    const id = String(rawId || "").split(":").pop();
    const payload = await request.json();

    const file = await fs.promises.readFile(dataFile, "utf8");
    const attendees = JSON.parse(file);

    const index = attendees.findIndex((a) => String(a.id) === String(id));
    if (index === -1) {
      return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
    }

    const fields = ["firstName", "lastName", "email", "company", "eventId"];
    const current = attendees[index];
    const updated = { ...current };

    fields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        updated[field] = payload[field];
      }
    });

    attendees[index] = updated;

    await fs.promises.writeFile(dataFile, JSON.stringify(attendees, null, 2), "utf8");

    const fullName = `${updated.firstName || ""} ${updated.lastName || ""}`.trim();

    return NextResponse.json({
      success: true,
      attendee: {
        ...updated,
        name: fullName || updated.name || "",
      },
    });
  } catch (err) {
    console.error("Attendee update error:", err);
    return NextResponse.json({ error: "Error updating attendee" }, { status: 500 });
  }
}
