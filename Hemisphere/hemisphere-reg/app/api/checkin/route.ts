import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const dataFile = path.join(process.cwd(), "data", "attendees.json");

export async function POST(request) {
  try {
    const { id, checkedIn = true } = await request.json();

    const file = await fs.promises.readFile(dataFile, "utf8");
    const attendees = JSON.parse(file);

    const index = attendees.findIndex(a => String(a.id) === String(id));

    if (index === -1) {
      return NextResponse.json(
        { error: "Attendee not found" },
        { status: 404 }
      );
    }

    if (checkedIn) {
      attendees[index].checkedIn = true;
      attendees[index].checkedInAt = new Date().toISOString();
    } else {
      attendees[index].checkedIn = false;
      delete attendees[index].checkedInAt;
    }

    await fs.promises.writeFile(
      dataFile,
      JSON.stringify(attendees, null, 2),
      "utf8"
    );

    return NextResponse.json({ success: true, attendee: attendees[index] });
  } catch (err) {
    console.error("Check-in error:", err);
    return NextResponse.json(
      { error: "Error saving check-in" },
      { status: 500 }
    );
  }
}
