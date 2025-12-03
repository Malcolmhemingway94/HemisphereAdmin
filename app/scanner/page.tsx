"use client";

import { useEffect, useRef, useState } from "react";

type Attendee = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  company?: string;
  checkedIn?: boolean;
};

type ScanState = "idle" | "scanning" | "found" | "error";

const successSound =
  typeof Audio !== "undefined" ? new Audio("/success.mp3") : null;

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [message, setMessage] = useState<string>("");
  const [lastValue, setLastValue] = useState<string>("");
  const [lastMethod, setLastMethod] = useState<"" | "scan" | "manual">("");
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [browserSupported, setBrowserSupported] = useState<boolean>(true);
  const [isScanningEnabled, setIsScanningEnabled] = useState<boolean>(true);
  const [manualName, setManualName] = useState<string>("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    async function startCameraAndScan() {
      try {
        if (!("BarcodeDetector" in window)) {
          setBrowserSupported(false);
          setScanState("error");
          setMessage(
            "This browser does not support camera QR scanning. Try Chrome on desktop."
          );
          return;
        }

        setBrowserSupported(true);
        setScanState("scanning");
        setMessage("Point a Hemisphere badge QR code at the camera.");

        // Start camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const AnyWindow = window as any;
        const detector = new AnyWindow.BarcodeDetector({
          formats: ["qr_code"],
        });

        async function scanFrame() {
          if (!isScanningEnabled) {
            return;
          }

          if (!videoRef.current || !canvasRef.current) {
            animationFrameId = requestAnimationFrame(scanFrame);
            return;
          }

          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            animationFrameId = requestAnimationFrame(scanFrame);
            return;
          }

          if (video.readyState !== 4) {
            animationFrameId = requestAnimationFrame(scanFrame);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0) {
              const raw = barcodes[0].rawValue || "";
              await handleScanResult(raw);
              return; // stop until "Scan Again"
            }
          } catch (err) {
            console.error("Error detecting barcode:", err);
          }

          animationFrameId = requestAnimationFrame(scanFrame);
        }

        animationFrameId = requestAnimationFrame(scanFrame);
      } catch (err) {
        console.error("Error starting camera:", err);
        setScanState("error");
        setMessage(
          "Unable to access camera. Check permissions or try a different browser."
        );
      }

      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
      };
    }

    if (isScanningEnabled) {
      const cleanupPromise = startCameraAndScan();
      return () => {
        cleanupPromise.then((cleanup) => {
          if (typeof cleanup === "function") cleanup();
        });
      };
    }
  }, [isScanningEnabled]);

  async function handleScanResult(raw: string) {
    setIsScanningEnabled(false); // pause scanning
    setLastValue(raw);
    setLastMethod("scan");

    const trimmed = raw.trim();
    const normalized = trimmed.toLowerCase().startsWith("hemisphere:")
      ? trimmed
      : `hemisphere:${trimmed}`;
    const id = normalized.split(":").pop() || "";

    if (!id) {
      setScanState("error");
      setMessage(`Could not read attendee ID from code: "${raw}"`);
      setAttendee(null);
      return;
    }

    try {
      // Look up attendee by ID (API accepts either "id" or "hemisphere:id")
      let found: Attendee | null = null;
      try {
        const res = await fetch(`/api/attendees/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (res.ok) {
          found = await res.json();
        }
      } catch (singleErr) {
        console.error("Single attendee lookup failed:", singleErr);
      }

      // Fallback: load full list from attendees API if direct lookup fails
      if (!found) {
        try {
          const listRes = await fetch("/api/attendees", { cache: "no-store" });
          if (listRes.ok) {
            const all: Attendee[] = await listRes.json();
            found = all.find((a) => String(a.id) === String(id)) || null;
          }
        } catch (listErr) {
          console.error("Fallback attendees lookup failed:", listErr);
        }
      }

      if (!found) {
        setScanState("error");
        setMessage(`No attendee found for ID ${id}.`);
        setAttendee(null);
        return;
      }
      const displayName =
        found.name ||
        `${found.firstName || ""} ${found.lastName || ""}`.trim() ||
        "Attendee";

      if (!found) {
        setScanState("error");
        setMessage(`No attendee found for ID ${idNum}.`);
        setAttendee(null);
        return;
      }

      // 🔁 DUPLICATE CHECK: already checked in?
      if (found.checkedIn) {
        setAttendee({ ...found, name: displayName });
        setScanState("found");
        setMessage(`Already checked in: ${displayName}`);

        if (successSound) {
          successSound.currentTime = 0;
          successSound.play().catch(() => {});
        }

        // Still log the scan (optional)
        await fetch("/api/scanlog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendeeId: found.id,
            attendeeName: displayName,
            attendeeEmail: found.email,
            method: "scan",
          }),
        });

        return;
      }

      // ✅ FIRST-TIME CHECK-IN
      await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checkedIn: true }),
      });

      setAttendee({ ...found, name: displayName });
      setScanState("found");
      setMessage(`Checked in: ${displayName}`);

      if (successSound) {
        successSound.currentTime = 0;
        successSound.play().catch(() => {});
      }

      // Save scan log
      await fetch("/api/scanlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeId: found.id,
          attendeeName: displayName,
          attendeeEmail: found.email,
          method: "scan",
        }),
      });
    } catch (err) {
      console.error("Error during scan lookup/check-in:", err);
      setScanState("error");
      setMessage("Error checking in attendee. Try again.");
      setAttendee(null);
    }
  }

  async function handleManualCheckin() {
    const term = manualName.trim();
    if (!term) {
      setMessage("Please type a name before checking in manually.");
      return;
    }

    setIsScanningEnabled(false);
    setLastValue(term);
    setLastMethod("manual");
    setScanState("scanning");
    setAttendee(null);
    setMessage(`Searching for "${term}"...`);

    try {
      const res = await fetch("/api/attendees", { cache: "no-store" });
      if (!res.ok) {
        setScanState("error");
        setMessage("Could not load attendees. Try again.");
        return;
      }
      const list: Attendee[] = await res.json();
      const lower = term.toLowerCase();
      const found =
        list.find((a) => {
          const fullName = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
          return fullName.includes(lower);
        }) || null;

      if (!found) {
        setScanState("error");
        setMessage(`No attendee found matching "${term}".`);
        return;
      }

      const displayName =
        found.name ||
        `${found.firstName || ""} ${found.lastName || ""}`.trim() ||
        "Attendee";

      // If already checked in, just show info
      if (found.checkedIn) {
        setAttendee({ ...found, name: displayName });
        setScanState("found");
        setMessage(`Already checked in: ${displayName}`);

        await fetch("/api/scanlog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attendeeId: found.id,
            attendeeName: displayName,
            attendeeEmail: found.email,
            method: "manual",
          }),
        });
        return;
      }

      await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: found.id, checkedIn: true }),
      });

      setAttendee({ ...found, name: displayName });
      setScanState("found");
      setMessage(`Checked in (manual): ${displayName}`);

      await fetch("/api/scanlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeId: found.id,
          attendeeName: displayName,
          attendeeEmail: found.email,
          method: "manual",
        }),
      });
    } catch (err) {
      console.error("Error during manual lookup/check-in:", err);
      setScanState("error");
      setMessage("Error checking in manually. Try again.");
    }
  }

  function handleScanAgain() {
    setScanState("scanning");
    setMessage("Point a Hemisphere badge QR code at the camera.");
    setAttendee(null);
    setIsScanningEnabled(true);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hemisphere — Scanner</h1>
            <p className="text-sm text-slate-400">
              Use your camera to scan Hemisphere QR badges and auto check-in
              attendees.
            </p>
          </div>
          <a
            href="/admin"
            className="text-sm underline text-slate-300 hover:text-white"
          >
            ← Back to Admin
          </a>
        </header>

        {/* Status */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm flex justify-between items-center">
          <div>
            <p className="font-semibold">
              Status:{" "}
              <span
                className={
                  scanState === "found"
                    ? "text-green-400"
                    : scanState === "error"
                    ? "text-red-400"
                    : "text-slate-200"
                }
              >
                {scanState === "idle"
                  ? "Idle"
                  : scanState === "scanning"
                  ? "Scanning…"
                  : scanState === "found"
                  ? "Attendee found"
                  : "Error"}
              </span>
            </p>
            <p className="text-slate-400 mt-1">{message}</p>
            {lastValue && (
              <p className="text-[11px] text-slate-500 mt-1">
                Last entry: {lastValue} {lastMethod ? `(${lastMethod})` : ""}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleScanAgain}
              className="px-3 py-1 rounded bg-slate-100 text-slate-900 text-xs font-semibold"
            >
              Scan Again
            </button>
          </div>
        </section>

        {/* Video + overlay */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col items-center">
          {!browserSupported && (
            <p className="text-sm text-red-400 mb-3">
              Browser does not support BarcodeDetector. Try Chrome or Edge.
            </p>
          )}
          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {/* Scan frame */}
            <div className="absolute inset-10 border-2 border-green-400 rounded-xl pointer-events-none" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <p className="text-xs text-slate-500 mt-3">
            Tip: Hold the badge steady so the QR is inside the green frame.
          </p>
        </section>

        {/* Manual check-in */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Manual check-in</p>
              <p className="text-xs text-slate-500">
                If someone can’t scan, type their name to check them in (logged as manual).
              </p>
            </div>
            <button
              onClick={() => setIsScanningEnabled((v) => !v)}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-900 hover:bg-slate-200"
            >
              {isScanningEnabled ? "Pause Scanner" : "Resume Scanner"}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Enter attendee name"
              className="flex-1 rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-50"
            />
            <button
              onClick={handleManualCheckin}
              className="px-4 py-2 rounded bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 text-sm"
            >
              Check in by name
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Note: Manual check-ins are tracked separately from QR scans so you can see who typed vs. scanned.
          </p>
        </section>

        {/* Attendee Info */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm">
          <h2 className="text-base font-semibold mb-2">Last Attendee</h2>
          {attendee ? (
            (() => {
              const displayName =
                attendee.name ||
                `${attendee.firstName || ""} ${attendee.lastName || ""}`.trim() ||
                "Attendee";
              return (
            <div className="space-y-1">
              <p>
                <span className="text-slate-400">Name:</span> {displayName}
              </p>
              <p>
                <span className="text-slate-400">Email:</span> {attendee.email || "—"}
              </p>
              <p>
                <span className="text-slate-400">ID:</span> {attendee.id}
              </p>
              <p className="text-green-400 text-xs mt-1">
                {attendee.checkedIn
                  ? "This attendee has already been checked in."
                  : "This attendee has been marked as checked in."}
              </p>
            </div>
              );
            })()
          ) : (
            <p className="text-slate-500">
              Scan a badge to see attendee details here.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
