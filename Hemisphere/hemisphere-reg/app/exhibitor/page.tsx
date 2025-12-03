"use client";
// @ts-nocheck

import { useEffect, useMemo, useRef, useState } from "react";

export default function ExhibitorLeadPage() {
  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(true);

  const [exhibitorName, setExhibitorName] = useState("");
  const [search, setSearch] = useState("");
  const [savingLeadId, setSavingLeadId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  // QR scanning state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScanningEnabled, setIsScanningEnabled] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "found" | "error">("idle");
  const [lastCode, setLastCode] = useState("");
  const [browserSupported, setBrowserSupported] = useState(true);

  // ---- Load attendees ----
  useEffect(() => {
    async function loadAttendees() {
      try {
        const res = await fetch("/api/register", { cache: "no-store" });
        const data = await res.json();
        setAttendees(data);
      } catch (err) {
        console.error("Error loading attendees", err);
      } finally {
        setLoadingAttendees(false);
      }
    }

    loadAttendees();
  }, []);

  const filteredAttendees = useMemo(() => {
    if (!search) return attendees;

    const lower = search.toLowerCase();
    return attendees.filter((a: any) => {
      return (
        (a.name && a.name.toLowerCase().includes(lower)) ||
        (a.email && a.email.toLowerCase().includes(lower))
      );
    });
  }, [attendees, search]);

  // ---- Capture lead (used by both search + scanner) ----
  async function captureLead(a: any) {
    if (!exhibitorName.trim()) {
      setMessage("Please enter your exhibitor/booth name first.");
      return;
    }

    setSavingLeadId(a.id);
    setMessage("");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  eventId: "evt_demo_001", // temp until we hook mobile activation
  attendeeId: a.id,
  attendeeName: a.name,
  attendeeEmail: a.email,
  exhibitor: exhibitorName.trim(),
  notes: "",
}),

      });

      if (!res.ok) {
        setMessage("Error saving lead. Try again.");
        return;
      }

      setMessage(`Lead captured: ${a.name} → ${exhibitorName}`);
    } catch (err) {
      console.error("Error capturing lead", err);
      setMessage("Error saving lead. Try again.");
    } finally {
      setSavingLeadId(null);
    }
  }

  // ---- QR scanning logic ----
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    async function startCameraAndScan() {
      try {
        if (!("BarcodeDetector" in window)) {
          setBrowserSupported(false);
          setScanState("error");
          setMessage(
            "Browser does not support camera QR scanning. Use Chrome on desktop or Android."
          );
          return;
        }

        setBrowserSupported(true);
        setScanState("scanning");
        setMessage("Point the attendee badge QR at the camera to capture a lead.");

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
              return; // stop until user re-enables scan
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
        cleanupPromise?.then?.((cleanup: any) => {
          if (typeof cleanup === "function") cleanup();
        });
      };
    }
  }, [isScanningEnabled, attendees, exhibitorName]);

  async function handleScanResult(raw: string) {
    setIsScanningEnabled(false); // pause scanning until user taps again
    setLastCode(raw);

    if (!exhibitorName.trim()) {
      setScanState("error");
      setMessage("Enter your exhibitor/booth name before scanning.");
      return;
    }

    // Expect format "hemisphere:<id>"
    if (!raw.startsWith("hemisphere:")) {
      setScanState("error");
      setMessage(`QR not recognized for Hemisphere badges: "${raw}"`);
      return;
    }

    const idPart = raw.split(":")[1];
    const idNum = Number(idPart);

    if (!idNum || Number.isNaN(idNum)) {
      setScanState("error");
      setMessage(`Could not read attendee ID from QR code: "${raw}"`);
      return;
    }

    const found = attendees.find((a: any) => a.id === idNum);

    if (!found) {
      setScanState("error");
      setMessage(`No attendee found for ID ${idNum}.`);
      return;
    }

    setScanState("found");
    setMessage(`Scanned: ${found.name} → capturing lead…`);

    // Capture the lead using same backend
    await captureLead(found);
  }

  function toggleScanning() {
    if (isScanningEnabled) {
      // turning camera off
      setIsScanningEnabled(false);
      setScanState("idle");
    } else {
      // turning camera on
      setScanState("scanning");
      setMessage("Point the attendee badge QR at the camera.");
      setIsScanningEnabled(true);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hemisphere — Exhibitor Leads</h1>
            <p className="text-sm text-slate-400">
              Exhibitors can search attendees or scan badges to capture leads.
            </p>
          </div>
          <a
            href="/admin"
            className="text-sm underline text-slate-300 hover:text-white"
          >
            ← Back to Admin
          </a>
        </header>

        {/* Exhibitor name + status */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
          <div>
            <label className="block text-slate-300 mb-1">
              Exhibitor / Booth Name
            </label>
            <input
              type="text"
              value={exhibitorName}
              onChange={(e) => setExhibitorName(e.target.value)}
              placeholder="e.g. Hemisphere Booth 101"
              className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-50"
            />
          </div>
          <p className="text-xs text-slate-500">
            This name will be saved on every lead you capture from this page.
          </p>
          {message && (
            <p className="text-xs text-emerald-400">
              {message}
            </p>
          )}
        </section>

        {/* QR Scanner section */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Badge Scanner</p>
              <p className="text-xs text-slate-500">
                Use the camera to scan Hemisphere QR badges and auto-capture leads.
              </p>
              {lastCode && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Last code: {lastCode}
                </p>
              )}
            </div>
            <button
              onClick={toggleScanning}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isScanningEnabled
                  ? "bg-red-500 text-slate-900 hover:bg-red-400"
                  : "bg-slate-100 text-slate-900 hover:bg-slate-200"
              }`}
            >
              {isScanningEnabled ? "Stop Scanner" : "Start Scanner"}
            </button>
          </div>

          {!browserSupported && (
            <p className="text-xs text-red-400 mt-2">
              This browser does not support camera QR scanning. Use Chrome or Edge on desktop/Android.
            </p>
          )}

          <div className="flex flex-col items-center mt-3">
            <div className="relative w-full max-w-sm aspect-[3/4] bg-black rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {/* QR frame */}
              <div className="absolute inset-10 border-2 border-emerald-400 rounded-xl pointer-events-none" />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-xs text-slate-500 mt-2">
              Hold the badge so the QR code sits inside the green frame.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Status:{" "}
              <span
                className={
                  scanState === "found"
                    ? "text-emerald-400"
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
                  ? "Attendee scanned"
                  : "Error"}
              </span>
            </p>
          </div>
        </section>

        {/* Search + attendee list (manual capture) */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 text-sm">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="flex-1">
              <label className="block text-slate-300 mb-1">
                Search Attendees (name or email)
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Start typing…"
                className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-50"
              />
            </div>
            <div className="text-xs text-slate-500">
              {loadingAttendees
                ? "Loading attendees…"
                : `${filteredAttendees.length} match(es)`}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto mt-3 space-y-2">
            {loadingAttendees ? (
              <p className="text-slate-400 text-sm">Loading attendees…</p>
            ) : filteredAttendees.length === 0 ? (
              <p className="text-slate-400 text-sm">
                No attendees match that search.
              </p>
            ) : (
              filteredAttendees.slice(0, 50).map((a: any) => (
                <div
                  key={a.id}
                  className="flex justify-between items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-100">{a.name}</p>
                    <p className="text-slate-400">{a.email}</p>
                    <p className="text-[11px] text-slate-500">ID: {a.id}</p>
                  </div>
                  <button
                    onClick={() => captureLead(a)}
                    disabled={savingLeadId === a.id}
                    className="px-3 py-1 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingLeadId === a.id ? "Saving..." : "Capture Lead"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

