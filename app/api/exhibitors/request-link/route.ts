import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const tokensFile = path.join(process.cwd(), "data", "exhibitor_tokens.json");

type TokenRecord = {
  email: string;
  token: string;
  expiresAt: string; // ISO string
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

async function writeTokens(tokens: TokenRecord[]) {
  await fs.promises.writeFile(tokensFile, JSON.stringify(tokens, null, 2), "utf8");
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Email is required to request a login link." },
        { status: 400 }
      );
    }

    const tokens = await readTokens();

    // Remove expired tokens first
    const now = Date.now();
    const validTokens = tokens.filter((t) => new Date(t.expiresAt).getTime() > now);

    const token = crypto.randomUUID();
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString(); // 1 hour

    validTokens.push({
      email: normalizedEmail,
      token,
      expiresAt,
    });

    await writeTokens(validTokens);

    // Relative link so it works locally and in prod
    const loginPath = `/exhibitors?token=${token}`;

    return NextResponse.json({
      success: true,
      loginUrl: loginPath,
      expiresAt,
      email: normalizedEmail,
      note:
        "Send this login link to the exhibitor. It is valid for 1 hour and can only be used with this email.",
    });
  } catch (err) {
    console.error("Error issuing exhibitor login link:", err);
    return NextResponse.json(
      { error: "Error issuing login link" },
      { status: 500 }
    );
  }
}
