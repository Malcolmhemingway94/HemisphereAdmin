"use client";

import { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { attendee, qrValue }

  const qrRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!firstName || !lastName || !email) {
      setError("First name, last name, and email are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, company }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error registering attendee.");
        return;
      }

      const data = await res.json();
      setResult(data);

      // Clear the form
      setFirstName("");
      setLastName("");
      setEmail("");
      setCompany("");
    } catch (err) {
      console.error("Register error:", err);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadQR() {
    if (!result || !qrRef.current) return;

    // qrRef.current is the <canvas> element from QRCodeCanvas
    const canvas = qrRef.current;
    const pngUrl = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = pngUrl;
    const id = result.attendee?.id || "badge";
    link.download = `hemisphere-badge-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#020617",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          backgroundColor: "#020617",
          borderRadius: 16,
          border: "1px solid #1f2937",
          padding: 20,
        }}
      >
        <h1
          style={{
            fontSize: 24,
            color: "#e5e7eb",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Hemisphere Registration
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#9ca3af",
            marginBottom: 20,
          }}
        >
          Enter your info to register for the event. We&apos;ll generate a QR
          code for your badge that your lead retrieval app can scan.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
              display: "block",
            }}
          >
            First Name
          </label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            style={inputStyle}
          />

          <label
            style={{
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
              marginTop: 8,
              display: "block",
            }}
          >
            Last Name
          </label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            style={inputStyle}
          />

          <label
            style={{
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
              marginTop: 8,
              display: "block",
            }}
          >
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />

          <label
            style={{
              fontSize: 13,
              color: "#e5e7eb",
              marginBottom: 4,
              marginTop: 8,
              display: "block",
            }}
          >
            Company (optional)
          </label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company name"
            style={inputStyle}
          />

          {error && (
            <p
              style={{
                color: "#f87171",
                fontSize: 12,
                marginTop: 8,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 16,
              width: "100%",
              borderRadius: 999,
              padding: "10px 12px",
              border: "none",
              backgroundColor: "#22c55e",
              color: "#020617",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        {result && (
          <div
            style={{
              marginTop: 20,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #1f2937",
              backgroundColor: "#0f172a",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                color: "#e5e7eb",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Registration Complete
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>
              Attendee:{" "}
              <span style={{ color: "#e5e7eb" }}>
                {result.attendee.firstName} {result.attendee.lastName}
              </span>
              <br />
              Email:{" "}
              <span style={{ color: "#e5e7eb" }}>
                {result.attendee.email}
              </span>
            </p>

            <p
              style={{
                color: "#9ca3af",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              QR code value for badge:
            </p>
            <div
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: "#020617",
                border: "1px dashed #374151",
                marginBottom: 12,
              }}
            >
              <code
                style={{
                  color: "#bbf7d0",
                  fontSize: 13,
                  wordBreak: "break-all",
                }}
              >
                {result.qrValue}
              </code>
            </div>

            {/* QR IMAGE */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <QRCodeCanvas
                value={result.qrValue}
                size={180}
                includeMargin={true}
                bgColor="#020617"
                fgColor="#22c55e"
                ref={qrRef}
              />
              <p
                style={{
                  color: "#6b7280",
                  fontSize: 11,
                  textAlign: "center",
                  maxWidth: 260,
                }}
              >
                This QR can be printed on a badge or scanned directly by your
                Hemisphere Leads app.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadQR}
              style={{
                width: "100%",
                borderRadius: 999,
                padding: "8px 10px",
                border: "1px solid #38bdf8",
                backgroundColor: "transparent",
                color: "#38bdf8",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Download Badge QR (PNG)
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  backgroundColor: "#020617",
  borderRadius: 12,
  border: "1px solid #374151",
  padding: "8px 10px",
  color: "#e5e7eb",
  fontSize: 14,
  outline: "none",
};
