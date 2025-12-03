"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { QRCodeCanvas } from "qrcode.react";

type Attendee = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  eventId?: string;
  createdAt?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
};

type EventItem = {
  id: string;
  name: string;
};

type Exhibitor = {
  name: string;
  activationCode: string;
};

type ScanLog = {
  attendeeId: string | number;
  attendeeName?: string;
  attendeeEmail?: string;
  timestamp: string;
};

type BadgeDesign = {
  qrSizeMm: number;
  qrOffsetXMm: number;
  qrOffsetYMm: number;
  badgeWidthMm: number;
  badgeHeightMm: number;
  backgroundColor: string;
  accentColor: string;
  textColor: string;
  borderColor: string;
  borderRadiusMm: number;
  nameFontMm: number;
  companyFontMm: number;
  metaFontMm: number;
  frontLogoUrl: string;
  backLogoUrl: string;
  layoutMode: "single" | "double";
};

const DEFAULT_BADGE_WIDTH_MM = 86;
const DEFAULT_BADGE_HEIGHT_MM = 54;

const DEFAULT_BADGE_DESIGN: BadgeDesign = {
  qrSizeMm: 38, // ~1.5in
  qrOffsetXMm: 40,
  qrOffsetYMm: 10,
  badgeWidthMm: DEFAULT_BADGE_WIDTH_MM,
  badgeHeightMm: DEFAULT_BADGE_HEIGHT_MM,
  backgroundColor: "#ffffff",
  accentColor: "#0ea5e9",
  textColor: "#0f172a",
  borderColor: "#e5e7eb",
  borderRadiusMm: 4,
  nameFontMm: 5,
  companyFontMm: 3.2,
  metaFontMm: 2.8,
  frontLogoUrl: "",
  backLogoUrl: "",
  layoutMode: "single",
};

export default function CheckInPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [qrAttendeeId, setQrAttendeeId] = useState<string | null>(null); // which attendee to show QR for
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | checkedIn | notCheckedIn
  const [eventFilter, setEventFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [exhibitorSearch, setExhibitorSearch] = useState("");
  const [activeSection, setActiveSection] = useState<
    "badgeDesigner" | "checkin" | "exhibitors" | "leadRetrieval"
  >("checkin");
  const [printAttendee, setPrintAttendee] = useState<Attendee | null>(null);
  const [badgeDesign, setBadgeDesign] = useState<BadgeDesign>(DEFAULT_BADGE_DESIGN);
  const [draggingQr, setDraggingQr] = useState(false);
  const frontPreviewRef = useRef<HTMLDivElement | null>(null);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [editForm, setEditForm] = useState<Partial<Attendee>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  function exportCheckinCsv() {
    if (!attendees.length) return;

    const headers = [
      "Name",
      "Email",
      "Company",
      "EventId",
      "CheckedIn",
      "CheckedInAt",
      "ScannedViaQr",
      "LastScanAt",
      "Id",
    ];

    const escape = (value: string) => {
      const safe = (value || "").replace(/"/g, '""');
      return `"${safe}"`;
    };

    // Map attendeeId -> latest scan timestamp
    const latestScanById = new Map<string, string>();
    scanLogs.forEach((log) => {
      const id = String(log.attendeeId);
      const ts = log.timestamp || "";
      const existing = latestScanById.get(id);
      if (!existing || new Date(ts) > new Date(existing)) {
        latestScanById.set(id, ts);
      }
    });

    const rows = attendees.map((a) => {
      const fullName = `${a.firstName || ""} ${a.lastName || ""}`.trim();
      const lastScan = latestScanById.get(String(a.id)) || "";
      return [
        escape(fullName || ""),
        escape(a.email || ""),
        escape(a.company || ""),
        escape(a.eventId ? String(a.eventId) : ""),
        escape(a.checkedIn ? "Yes" : "No"),
        escape(a.checkedInAt || ""),
        escape(lastScan ? "Yes" : "No"),
        escape(lastScan),
        escape(String(a.id)),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hemisphere-checkins.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function loadAttendees() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/attendees", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Error loading attendees.");
        return;
      }

      const data = await res.json();
      setAttendees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load attendees error:", err);
      setError("Network error loading attendees.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load events error:", err);
    }
  }

  async function loadScanLogs() {
    try {
      const res = await fetch("/api/scanlog", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setScanLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load scan logs error:", err);
    }
  }

  async function loadExhibitors() {
    try {
      const res = await fetch("/api/exhibitors/list", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setExhibitors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load exhibitors error:", err);
    }
  }

  useEffect(() => {
    loadEvents();
    loadAttendees();
    loadScanLogs();
    loadExhibitors();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("hemisphere-badge-design");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setBadgeDesign((prev) => ({ ...prev, ...parsed }));
    } catch (err) {
      console.error("Badge design parse error:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("hemisphere-badge-design", JSON.stringify(badgeDesign));
  }, [badgeDesign]);

  const updateBadgeDesign = (partial: Partial<BadgeDesign>) => {
    setBadgeDesign((prev) => {
      const next = { ...prev, ...partial };
      const widthMm = Math.min(
        Math.max(50, next.badgeWidthMm || DEFAULT_BADGE_WIDTH_MM),
        120
      );
      const heightMm = Math.min(
        Math.max(40, next.badgeHeightMm || DEFAULT_BADGE_HEIGHT_MM),
        100
      );
      const maxQrSize = Math.max(
        12,
        Math.min(
          90,
          Math.min(widthMm, heightMm) - 8
        )
      );
      const qrSizeMm = Math.min(Math.max(12, next.qrSizeMm), maxQrSize);
      const maxOffsetX = Math.max(0, widthMm - qrSizeMm);
      const maxOffsetY = Math.max(0, heightMm - qrSizeMm);
      return {
        ...next,
        badgeWidthMm: widthMm,
        badgeHeightMm: heightMm,
        qrOffsetXMm: Math.min(Math.max(0, next.qrOffsetXMm), maxOffsetX),
        qrOffsetYMm: Math.min(Math.max(0, next.qrOffsetYMm), maxOffsetY),
        qrSizeMm,
        borderRadiusMm: Math.min(Math.max(0, next.borderRadiusMm), 10),
        nameFontMm: Math.min(Math.max(3, next.nameFontMm), 8),
        companyFontMm: Math.min(Math.max(2, next.companyFontMm), 6),
        metaFontMm: Math.min(Math.max(2, next.metaFontMm), 5),
      };
    });
  };

  const resetBadgeDesign = () => setBadgeDesign(DEFAULT_BADGE_DESIGN);

  const handleLogoUpload = (side: "front" | "back") => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      updateBadgeDesign(side === "front" ? { frontLogoUrl: url } : { backLogoUrl: url });
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = (side: "front" | "back") => {
    updateBadgeDesign(side === "front" ? { frontLogoUrl: "" } : { backLogoUrl: "" });
  };

  useEffect(() => {
    if (!printAttendee) return;
    const timer = setTimeout(() => {
      window.print();
    }, 150);

    return () => clearTimeout(timer);
  }, [printAttendee]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintAttendee(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  // Persisted check-in/uncheck via API with an optimistic state update
  async function handleCheckStatus(id: string, checkedIn: boolean) {
    setCheckingInId(id);
    setError("");

    // Optimistic UI update while request is in-flight
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              checkedIn,
              checkedInAt: checkedIn ? new Date().toISOString() : undefined,
            }
          : a
      )
    );

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, checkedIn }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error saving check-in status.");
      }

      const data = await res.json();

      // Reconcile with server response to ensure timestamps match what was written to disk
      if (data?.attendee) {
        setAttendees((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...data.attendee } : a))
        );
      } else {
        // If the shape isn't as expected, reload from disk
        await loadAttendees();
      }
    } catch (err: unknown) {
      console.error("Check-in error:", err);
      setError(
        err instanceof Error ? err.message : "Network error saving check-in status."
      );
      // Undo the optimistic update by reloading the latest state without clearing the error
      try {
        const res = await fetch("/api/attendees", { cache: "no-store" });
        if (res.ok) {
          const latest = await res.json();
          setAttendees(Array.isArray(latest) ? latest : []);
        }
      } catch (reloadErr) {
        console.error("Reload after failed check-in error:", reloadErr);
      }
    } finally {
      setCheckingInId(null);
    }
  }

  // Find the attendee we’re showing the QR for
  const qrAttendee = attendees.find((a) => a.id === qrAttendeeId) || null;
  // Include the hemisphere scheme so the mobile app scanner recognizes the payload
  const qrValue = qrAttendee ? `hemisphere:${qrAttendee.id}` : "";
  const printQrValue = printAttendee ? `hemisphere:${printAttendee.id}` : "";

  // Apply event + company filters first
  const baseFiltered = attendees.filter((a) => {
    const matchesEvent =
      eventFilter === "all" ||
      (a.eventId ? String(a.eventId) === eventFilter : true);
    const matchesCompany =
      companyFilter === "all" ||
      (a.company || "").toLowerCase() === companyFilter.toLowerCase();
    return matchesEvent && matchesCompany;
  });

  // Then apply search + status filter
  const filteredAttendees = baseFiltered.filter((a) => {
    const fullName = `${a.firstName || ""} ${a.lastName || ""}`.trim();
    const checked = !!a.checkedIn;

    const searchText = search.trim().toLowerCase();
    const matchesSearch =
      !searchText ||
      fullName.toLowerCase().includes(searchText) ||
      (a.email || "").toLowerCase().includes(searchText) ||
      (a.company || "").toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "checkedIn" && checked) ||
      (statusFilter === "notCheckedIn" && !checked);

    return matchesSearch && matchesStatus;
  });

  // Analytics derived from event/company filters (not search/status)
  const totalRegistrants = baseFiltered.length;
  const totalCheckedIn = baseFiltered.filter((a) => a.checkedIn).length;
  const totalNotCheckedIn = Math.max(totalRegistrants - totalCheckedIn, 0);
  const scannedIdSet = new Set(scanLogs.map((l) => String(l.attendeeId)));
  const totalScannedViaQr = baseFiltered.filter((a) =>
    scannedIdSet.has(String(a.id))
  ).length;
  const checkInRate =
    totalRegistrants === 0
      ? 0
      : Math.round((totalCheckedIn / totalRegistrants) * 100);

  const uniqueCompanies = Array.from(
    new Set(attendees.map((a) => (a.company || "").trim()).filter(Boolean))
  );

  const filteredExhibitors = exhibitors.filter((ex) => {
    const term = exhibitorSearch.trim().toLowerCase();
    if (!term) return true;
    return ex.name.toLowerCase().includes(term);
  });

  function copyToClipboard(value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).catch((err) => {
      console.error("Copy failed:", err);
    });
  }

  const startEdit = (attendee: Attendee) => {
    setEditingAttendee(attendee);
    setEditForm({
      firstName: attendee.firstName || "",
      lastName: attendee.lastName || "",
      email: attendee.email || "",
      company: attendee.company || "",
      eventId: attendee.eventId || "",
    });
    setEditError("");
  };

  const handleEditChange = (field: keyof Attendee, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveEdit = async () => {
    if (!editingAttendee) return;
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/attendees/${editingAttendee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error updating attendee");
      }

      const data = await res.json();
      if (data?.attendee) {
        setAttendees((prev) =>
          prev.map((a) => (a.id === editingAttendee.id ? { ...a, ...data.attendee } : a))
        );
      }
      setEditingAttendee(null);
    } catch (err) {
      console.error("Save edit error:", err);
      setEditError(err instanceof Error ? err.message : "Error updating attendee");
    } finally {
      setSavingEdit(false);
    }
  };

  const previewAttendee =
    qrAttendee ||
    attendees[0] || {
      id: "sample",
      firstName: "Sample",
      lastName: "Attendee",
      company: "Hemisphere Media Group",
      eventId: "EVT-001",
    };

  const designerQrValue = `hemisphere:${previewAttendee.id || "sample"}`;
  const maxQrOffsetX = Math.max(0, badgeDesign.badgeWidthMm - badgeDesign.qrSizeMm);
  const maxQrOffsetY = Math.max(0, badgeDesign.badgeHeightMm - badgeDesign.qrSizeMm);
  const mmToIn = (mm: number) => (mm / 25.4).toFixed(2);
  const badgeWidthInches = `${mmToIn(badgeDesign.badgeWidthMm)}in`;
  const badgeHeightInches = `${mmToIn(badgeDesign.badgeHeightMm)}in`;
  const badgeAspectRatio = `${badgeDesign.badgeWidthMm} / ${badgeDesign.badgeHeightMm}`;

  const updateQrFromPoint = (clientX: number, clientY: number) => {
    const el = frontPreviewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mmPerPxX = badgeDesign.badgeWidthMm / rect.width;
    const mmPerPxY = badgeDesign.badgeHeightMm / rect.height;
    const newX = (clientX - rect.left) * mmPerPxX - badgeDesign.qrSizeMm / 2;
    const newY = (clientY - rect.top) * mmPerPxY - badgeDesign.qrSizeMm / 2;
    updateBadgeDesign({ qrOffsetXMm: newX, qrOffsetYMm: newY });
  };

  const handlePreviewPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setDraggingQr(true);
    updateQrFromPoint(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePreviewPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingQr) return;
    updateQrFromPoint(e.clientX, e.clientY);
  };

  const handlePreviewPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingQr) return;
    setDraggingQr(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #badge-print-root, #badge-print-root * {
              visibility: visible !important;
            }
            #badge-print-root {
              display: flex !important;
              position: static !important;
              inset: auto !important;
              opacity: 1 !important;
              pointer-events: auto !important;
              width: 100% !important;
              padding: 24px !important;
              background: #f8fafc !important;
            }
          }
        `,
        }}
      />

      {printAttendee && (
        <div
          id="badge-print-root"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            position: "fixed",
            inset: 0,
            zIndex: -1,
            opacity: 0,
            pointerEvents: "none",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10mm", alignItems: "center" }}>
            {/* Front */}
            <div
              style={{
                width: badgeWidthInches,
                height: badgeHeightInches,
                maxWidth: "100%",
                position: "relative",
                borderRadius: `${badgeDesign.borderRadiusMm}mm`,
                backgroundColor: badgeDesign.backgroundColor,
                border: `1px solid ${badgeDesign.borderColor}`,
                boxSizing: "border-box",
                padding: "6mm",
                overflow: "hidden",
                color: badgeDesign.textColor,
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.16)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${badgeDesign.qrOffsetXMm}mm`,
                  top: `${badgeDesign.qrOffsetYMm}mm`,
                  width: `${badgeDesign.qrSizeMm}mm`,
                  height: `${badgeDesign.qrSizeMm}mm`,
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: "#ffffff",
                  border: `1px solid ${badgeDesign.borderColor}`,
                  borderRadius: 8,
                  boxShadow: "0 8px 16px rgba(15, 23, 42, 0.16)",
                }}
              >
                <QRCodeCanvas
                  value={printQrValue}
                  size={256}
                  includeMargin
                  bgColor="#ffffff"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4mm",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "4mm",
                  }}
                >
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: `${badgeDesign.metaFontMm}mm`,
                        letterSpacing: 1,
                        color: badgeDesign.accentColor,
                      }}
                    >
                      HEMISPHERE
                    </p>
                    <p style={{ margin: 0, fontSize: `${badgeDesign.metaFontMm}mm`, opacity: 0.7 }}>
                      Event badge
                    </p>
                  </div>
                  {badgeDesign.frontLogoUrl ? (
                    <img
                      src={badgeDesign.frontLogoUrl}
                      alt="Front logo"
                      style={{
                        width: "12mm",
                        height: "12mm",
                        borderRadius: "2mm",
                        objectFit: "contain",
                        backgroundColor: "#ffffff",
                        border: `1px solid ${badgeDesign.borderColor}`,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "12mm",
                        height: "12mm",
                        borderRadius: "3mm",
                        background: `linear-gradient(135deg, ${badgeDesign.accentColor}, ${badgeDesign.textColor})`,
                      }}
                    />
                  )}
                </div>

                <div style={{ marginTop: "2mm", maxWidth: "70%" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: `${badgeDesign.nameFontMm}mm`,
                      fontWeight: 700,
                      lineHeight: 1.05,
                    }}
                  >
                    {`${printAttendee.firstName || ""} ${printAttendee.lastName || ""}`.trim() ||
                      "Unknown attendee"}
                  </p>
                  <p style={{ margin: "1mm 0 0", fontSize: `${badgeDesign.companyFontMm}mm`, opacity: 0.8 }}>
                    {printAttendee.company || "Company TBC"}
                  </p>
                  {printAttendee.eventId && (
                    <p style={{ margin: "1mm 0 0", fontSize: `${badgeDesign.metaFontMm}mm`, opacity: 0.6 }}>
                      Event ID: {printAttendee.eventId}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: `${badgeDesign.metaFontMm}mm`,
                    color: "#475569",
                  }}
                >
                  <span>Badge ID: {printAttendee.id}</span>
                  <span style={{ color: badgeDesign.accentColor, fontWeight: 600 }}>
                    hemisphere:{printAttendee.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Back (only when 2-sided) */}
            {badgeDesign.layoutMode === "double" && (
              <div
                style={{
                  width: badgeWidthInches,
                  height: badgeHeightInches,
                  maxWidth: "100%",
                  borderRadius: `${badgeDesign.borderRadiusMm}mm`,
                  backgroundColor: badgeDesign.backgroundColor,
                  border: `1px solid ${badgeDesign.borderColor}`,
                  boxSizing: "border-box",
                  padding: "6mm",
                  overflow: "hidden",
                  color: badgeDesign.textColor,
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.16)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6mm",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: `${badgeDesign.metaFontMm}mm`, opacity: 0.7 }}>
                    Back of badge
                  </span>
                  {badgeDesign.backLogoUrl ? (
                    <img
                      src={badgeDesign.backLogoUrl}
                      alt="Back logo"
                      style={{
                        width: "14mm",
                        height: "14mm",
                        borderRadius: "2mm",
                        objectFit: "contain",
                        backgroundColor: "#ffffff",
                        border: `1px solid ${badgeDesign.borderColor}`,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "14mm",
                        height: "14mm",
                        borderRadius: "3mm",
                        background: `linear-gradient(135deg, ${badgeDesign.accentColor}, ${badgeDesign.textColor})`,
                      }}
                    />
                  )}
                </div>

                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(70, badgeDesign.qrSizeMm + 12)}mm`,
                      height: `${Math.min(70, badgeDesign.qrSizeMm + 12)}mm`,
                      display: "grid",
                      placeItems: "center",
                      backgroundColor: "#ffffff",
                      border: `1px solid ${badgeDesign.borderColor}`,
                      borderRadius: 10,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.22)",
                    }}
                  >
                    <QRCodeCanvas
                      value={printQrValue}
                      size={320}
                      includeMargin
                      bgColor="#ffffff"
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: `${badgeDesign.metaFontMm}mm`,
                  }}
                >
                  <span style={{ opacity: 0.7 }}>Scan with Hemisphere Leads</span>
                  <span style={{ color: badgeDesign.accentColor, fontWeight: 700 }}>
                    hemisphere:{printAttendee.id}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          maxWidth: 1220,
          backgroundColor: "#020617",
          borderRadius: 16,
          border: "1px solid #1f2937",
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          minHeight: 720,
          overflow: "hidden",
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #1f2937",
            padding: "18px 14px",
            backgroundColor: "#0b1224",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <img
              src="/hemisphere-logo.svg"
              alt="Hemisphere Media Group"
              style={{ width: "100%", maxWidth: 260, height: "auto", display: "block" }}
            />
          </div>
          <nav style={{ display: "grid", gap: 8 }}>
            {[
              { id: "badgeDesigner", label: "Badge Designer" },
              { id: "checkin", label: "Check-In" },
              { id: "exhibitors", label: "Exhibitors" },
              { id: "leadRetrieval", label: "Lead Retrieval" },
            ].map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as any)}
                  style={{
                    textAlign: "left",
                    borderRadius: 10,
                    padding: "10px 12px",
                    border: "1px solid #1f2937",
                    backgroundColor: active ? "#111827" : "transparent",
                    color: "#e5e7eb",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section style={{ padding: 18 }}>
          <header style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e5e7eb" }}>
              {activeSection === "badgeDesigner"
                ? "Badge Designer"
                : activeSection === "checkin"
                ? "Hemisphere Check-In"
                : activeSection === "exhibitors"
                ? "Exhibitors"
                : "Lead Retrieval"}
            </h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
              {activeSection === "badgeDesigner" &&
                `Design and position badges for ${mmToIn(badgeDesign.badgeWidthMm)}\" x ${mmToIn(
                  badgeDesign.badgeHeightMm
                )}\" cards, including QR placement, colors, and fonts.`}
              {activeSection === "checkin" &&
                "Filter attendees, check them in, and generate QR codes."}
              {activeSection === "exhibitors" &&
                "Browse exhibitors captured from lead scans with their activation codes."}
              {activeSection === "leadRetrieval" &&
                "Share activation codes with exhibitors so they can capture leads."}
            </p>
          </header>

          {activeSection === "checkin" && (
            <>
              {/* Analytics */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <AnalyticsCard
                  label="Total registrants"
                  value={totalRegistrants}
                  accent="#38bdf8"
                />
                <AnalyticsCard
                  label="Checked in"
                  value={totalCheckedIn}
                  accent="#22c55e"
                />
                <AnalyticsCard
                  label="Not checked in"
                  value={totalNotCheckedIn}
                  accent="#f97316"
                />
                <AnalyticsCard
                  label="Scanned via QR"
                  value={totalScannedViaQr}
                  accent="#0ea5e9"
                />
                <AnalyticsCard
                  label="Check-in rate"
                  value={`${checkInRate}%`}
                  accent="#a855f7"
                />
              </div>

              {/* Top controls row */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      style={{
                        borderRadius: 10,
                        padding: "6px 12px",
                        border: "1px solid #374151",
                        backgroundColor: "#020617",
                        color: "#e5e7eb",
                        fontSize: 13,
                        outline: "none",
                      }}
                    >
                      <option value="all">All events</option>
                      {events.map((evt) => (
                        <option key={evt.id} value={evt.id}>
                          {evt.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                      style={{
                        borderRadius: 10,
                        padding: "6px 12px",
                        border: "1px solid #374151",
                        backgroundColor: "#020617",
                        color: "#e5e7eb",
                        fontSize: 13,
                        outline: "none",
                      }}
                    >
                      <option value="all">All companies</option>
                      {uniqueCompanies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={loadAttendees}
                    disabled={loading}
                    style={{
                      borderRadius: 999,
                      padding: "6px 12px",
                      border: "1px solid #22c55e",
                      backgroundColor: "transparent",
                      color: "#22c55e",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {loading ? "Refreshing..." : "Refresh Attendees"}
                  </button>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      borderRadius: 999,
                      padding: "6px 12px",
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: 13,
                      outline: "none",
                    }}
                  >
                    <option value="all">All</option>
                    <option value="checkedIn">Checked in</option>
                    <option value="notCheckedIn">Not checked in</option>
                  </select>
                </div>

                {/* Search input */}
                <div style={{ minWidth: 220, flex: 1, maxWidth: 320 }}>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, or company..."
                    style={{
                      width: "100%",
                      borderRadius: 999,
                      padding: "6px 12px",
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={exportCheckinCsv}
                    style={{
                      borderRadius: 10,
                      padding: "8px 12px",
                      border: "1px solid #22c55e",
                      backgroundColor: "#0b1120",
                      color: "#22c55e",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Download Check-In CSV
                  </button>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    Showing{" "}
                    <span style={{ color: "#e5e7eb" }}>{filteredAttendees.length}</span>{" "}
                    of{" "}
                    <span style={{ color: "#e5e7eb" }}>{attendees.length}</span>
                  </span>
                </div>
              </div>

              {error && (
                <p
                  style={{
                    color: "#f87171",
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  {error}
                </p>
              )}

              {/* Main layout: left = table, right = QR for selected attendee */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.1fr)",
                  gap: 16,
                }}
              >
                {/* LEFT: Attendee table */}
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #1f2937",
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#0f172a",
                          borderBottom: "1px solid #1f2937",
                        }}
                      >
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Email</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendees.length === 0 && !loading && !error && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              padding: "10px 12px",
                              color: "#9ca3af",
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            No attendees match your filters. Try clearing the search
                            or status filter.
                          </td>
                        </tr>
                      )}

                      {filteredAttendees.map((a, index) => {
                        const fullName = `${a.firstName || ""} ${
                          a.lastName || ""
                        }`.trim();
                        const checked = !!a.checkedIn;

                        return (
                          <tr
                            key={a.id || index}
                            style={{
                              borderBottom: "1px solid #111827",
                              backgroundColor:
                                index % 2 === 0 ? "#020617" : "#030712",
                            }}
                          >
                            <td style={tdStyle}>{fullName || "Unknown"}</td>
                            <td style={tdStyle}>{a.email || "—"}</td>
                            <td style={tdStyle}>
                              {checked ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <span style={{ color: "#22c55e", fontSize: 12 }}>
                                    Checked in
                                  </span>
                                  {a.checkedInAt && (
                                    <span style={{ color: "#9ca3af", fontSize: 11 }}>
                                      {new Date(a.checkedInAt).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#f97316", fontSize: 12 }}>
                                  Not checked in
                                </span>
                              )}
                            </td>
                            <td style={tdStyle}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  flexWrap: "wrap",
                                }}
                              >
                                {!checked ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCheckStatus(a.id, true)}
                                    disabled={checkingInId === a.id}
                                    style={{
                                      borderRadius: 999,
                                      padding: "4px 10px",
                                      border: "none",
                                      backgroundColor: "#22c55e",
                                      color: "#020617",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {checkingInId === a.id ? "Checking..." : "Check In"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleCheckStatus(a.id, false)}
                                    disabled={checkingInId === a.id}
                                    style={{
                                      borderRadius: 999,
                                      padding: "4px 10px",
                                      border: "1px solid #fca5a5",
                                      backgroundColor: "#0b1120",
                                      color: "#fca5a5",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {checkingInId === a.id ? "Updating..." : "Undo Check-In"}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setQrAttendeeId(
                                      qrAttendeeId === a.id ? null : a.id
                                    )
                                  }
                                  style={{
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    border: "1px solid #38bdf8",
                                    backgroundColor:
                                      qrAttendeeId === a.id
                                        ? "#0b1120"
                                        : "transparent",
                                    color: "#38bdf8",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  {qrAttendeeId === a.id ? "Hide QR" : "Show QR"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setPrintAttendee({ ...a })}
                                  style={{
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    border: "1px solid #eab308",
                                    backgroundColor: "#0b1120",
                                    color: "#eab308",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Print Badge
                                </button>

                                <button
                                  type="button"
                                  onClick={() => startEdit(a)}
                                  style={{
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    border: "1px solid #a855f7",
                                    backgroundColor: "#0b1120",
                                    color: "#c084fc",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* RIGHT: QR code for selected attendee */}
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #1f2937",
                    padding: 12,
                    backgroundColor: "#020617",
                    minHeight: 260,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {!qrAttendee && (
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: 13,
                        textAlign: "center",
                        padding: "0 8px",
                      }}
                    >
                      Select an attendee in the table and click{" "}
                      <span style={{ color: "#38bdf8" }}>&quot;Show QR&quot;</span>{" "}
                      to generate a badge QR you can scan with the mobile app.
                    </p>
                  )}

                  {qrAttendee && (
                    <>
                      <h2
                        style={{
                          color: "#e5e7eb",
                          fontSize: 16,
                          fontWeight: 600,
                          marginBottom: 8,
                          textAlign: "center",
                        }}
                      >
                        Badge QR
                      </h2>
                      <p
                        style={{
                          color: "#9ca3af",
                          fontSize: 13,
                          marginBottom: 8,
                          textAlign: "center",
                        }}
                      >
                        {qrAttendee.firstName} {qrAttendee.lastName}
                        <br />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          ID: {qrAttendee.id}
                        </span>
                      </p>

                      <QRCodeCanvas
                        value={qrValue}
                        size={200}
                        includeMargin={true}
                        bgColor="#020617"
                        fgColor="#22c55e"
                      />

                      <p
                        style={{
                          marginTop: 10,
                          fontSize: 11,
                          color: "#6b7280",
                          textAlign: "center",
                          maxWidth: 260,
                        }}
                      >
                        Open your Hemisphere Leads app on your phone, choose the
                        scanner, and point it at this QR. The attendee&apos;s name
                        should pop up automatically.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <p
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                Check-ins now persist to{" "}
                <code style={{ color: "#bbf7d0" }}>data/attendees.json</code> via the{" "}
                <code style={{ color: "#bbf7d0" }}>/api/checkin</code> route.
              </p>
            </>
          )}

          {activeSection === "badgeDesigner" && (
            <section
              style={{
                border: "1px solid #1f2937",
                borderRadius: 12,
                padding: 16,
                backgroundColor: "#0b1120",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <p style={{ margin: 0, color: "#e5e7eb", fontWeight: 700, fontSize: 15 }}>
                    Badge Designer ({mmToIn(badgeDesign.badgeWidthMm)}&quot; x {mmToIn(badgeDesign.badgeHeightMm)}&quot;)
                  </p>
                  <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                    Adjust QR placement/size, fonts, logos, and pick 1- or 2-sided layouts. Settings save automatically.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={resetBadgeDesign}
                    style={{
                      borderRadius: 10,
                      padding: "6px 10px",
                      border: "1px solid #374151",
                      backgroundColor: "transparent",
                      color: "#e5e7eb",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Reset layout
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(320px, 1.1fr) minmax(280px, 0.9fr)",
                  gap: 12,
                  alignItems: "stretch",
                }}
              >
                {/* Preview */}
                <div
                  style={{
                    padding: 12,
                    border: "1px solid #1f2937",
                    borderRadius: 12,
                    backgroundColor: "#020617",
                  }}
                >
                  <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>
                    Live preview (badge scale) — click/drag QR to move it
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {/* Front preview */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: badgeAspectRatio,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid #1f2937",
                        backgroundColor: badgeDesign.backgroundColor,
                        boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
                        color: badgeDesign.textColor,
                      }}
                      ref={frontPreviewRef}
                      onPointerDown={handlePreviewPointerDown}
                      onPointerMove={handlePreviewPointerMove}
                      onPointerUp={handlePreviewPointerUp}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: `${badgeDesign.qrOffsetXMm}mm`,
                          top: `${badgeDesign.qrOffsetYMm}mm`,
                          width: `${badgeDesign.qrSizeMm}mm`,
                          height: `${badgeDesign.qrSizeMm}mm`,
                          display: "grid",
                          placeItems: "center",
                          backgroundColor: "#ffffff",
                          border: `1px solid ${badgeDesign.borderColor}`,
                          borderRadius: 8,
                          boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
                        }}
                      >
                        <QRCodeCanvas
                          value={designerQrValue}
                          size={240}
                          includeMargin
                          bgColor="#ffffff"
                          style={{ width: "100%", height: "100%" }}
                        />
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          padding: "8mm",
                          boxSizing: "border-box",
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: `${badgeDesign.metaFontMm}mm`,
                                letterSpacing: 1,
                                color: badgeDesign.accentColor,
                              }}
                            >
                              HEMISPHERE
                            </p>
                            <p
                              style={{
                                margin: 0,
                                fontSize: `${badgeDesign.metaFontMm}mm`,
                                opacity: 0.7,
                              }}
                            >
                              Event badge
                            </p>
                          </div>
                          {badgeDesign.frontLogoUrl ? (
                            <img
                              src={badgeDesign.frontLogoUrl}
                              alt="Front logo"
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                objectFit: "contain",
                                backgroundColor: "#ffffff",
                                border: `1px solid ${badgeDesign.borderColor}`,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: `linear-gradient(135deg, ${badgeDesign.accentColor}, ${badgeDesign.textColor})`,
                              }}
                            />
                          )}
                        </div>

                        <div style={{ maxWidth: "70%" }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: `${badgeDesign.nameFontMm}mm`,
                              fontWeight: 700,
                              lineHeight: 1.1,
                            }}
                          >
                            {`${previewAttendee.firstName || ""} ${
                              previewAttendee.lastName || ""
                            }`.trim() || "Sample Attendee"}
                          </p>
                          <p style={{ margin: "4px 0 0", fontSize: `${badgeDesign.companyFontMm}mm`, opacity: 0.8 }}>
                            {previewAttendee.company || "Your company"}
                          </p>
                          {previewAttendee.eventId && (
                            <p style={{ margin: "2px 0 0", fontSize: `${badgeDesign.metaFontMm}mm`, opacity: 0.6 }}>
                              Event ID: {previewAttendee.eventId}
                            </p>
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: "auto",
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: `${badgeDesign.metaFontMm}mm`,
                            color: "#475569",
                          }}
                        >
                          <span>Badge ID: {previewAttendee.id}</span>
                          <span style={{ color: badgeDesign.accentColor, fontWeight: 600 }}>
                            hemisphere:{previewAttendee.id}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          bottom: 6,
                          right: 8,
                          padding: "2px 8px",
                          backgroundColor: "rgba(15,23,42,0.6)",
                          color: "#e5e7eb",
                          fontSize: 11,
                          borderRadius: 999,
                          border: "1px solid #1f2937",
                        }}
                      >
                        Front • {mmToIn(badgeDesign.badgeWidthMm)}&quot; x{" "}
                        {mmToIn(badgeDesign.badgeHeightMm)}&quot; ({badgeDesign.badgeWidthMm} mm x{" "}
                        {badgeDesign.badgeHeightMm} mm)
                      </div>
                    </div>

                    {badgeDesign.layoutMode === "double" && (
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          aspectRatio: badgeAspectRatio,
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid #1f2937",
                          backgroundColor: badgeDesign.backgroundColor,
                          boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
                          color: badgeDesign.textColor,
                          display: "flex",
                          flexDirection: "column",
                          padding: "8mm",
                          boxSizing: "border-box",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ fontSize: `${badgeDesign.metaFontMm}mm`, opacity: 0.7 }}>
                            Back of badge
                          </span>
                          {badgeDesign.backLogoUrl ? (
                            <img
                              src={badgeDesign.backLogoUrl}
                              alt="Back logo"
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 10,
                                objectFit: "contain",
                                backgroundColor: "#ffffff",
                                border: `1px solid ${badgeDesign.borderColor}`,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                background: `linear-gradient(135deg, ${badgeDesign.accentColor}, ${badgeDesign.textColor})`,
                              }}
                            />
                          )}
                        </div>

                        <div style={{ display: "grid", placeItems: "center", flex: 1 }}>
                          <div
                            style={{
                              width: `${Math.min(70, badgeDesign.qrSizeMm + 12)}mm`,
                              height: `${Math.min(70, badgeDesign.qrSizeMm + 12)}mm`,
                              display: "grid",
                              placeItems: "center",
                              backgroundColor: "#ffffff",
                              border: `1px solid ${badgeDesign.borderColor}`,
                              borderRadius: 12,
                              boxShadow: "0 8px 20px rgba(0,0,0,0.22)",
                            }}
                          >
                            <QRCodeCanvas
                              value={designerQrValue}
                              size={280}
                              includeMargin
                              bgColor="#ffffff"
                              style={{ width: "100%", height: "100%" }}
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: `${badgeDesign.metaFontMm}mm`,
                            color: "#475569",
                          }}
                        >
                          <span>Scan with Hemisphere Leads</span>
                          <span style={{ color: badgeDesign.accentColor, fontWeight: 600 }}>
                            hemisphere:{previewAttendee.id}
                          </span>
                        </div>

                        <div
                          style={{
                            position: "absolute",
                            bottom: 6,
                            right: 8,
                            padding: "2px 8px",
                            backgroundColor: "rgba(15,23,42,0.6)",
                            color: "#e5e7eb",
                            fontSize: 11,
                            borderRadius: 999,
                            border: "1px solid #1f2937",
                          }}
                        >
                          Back • {mmToIn(badgeDesign.badgeWidthMm)}&quot; x{" "}
                          {mmToIn(badgeDesign.badgeHeightMm)}&quot; ({badgeDesign.badgeWidthMm} mm x{" "}
                          {badgeDesign.badgeHeightMm} mm)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div
                  style={{
                    padding: 12,
                    border: "1px solid #1f2937",
                    borderRadius: 12,
                    backgroundColor: "#0f172a",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      Layout
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      {[
                        { id: "single", label: "1-sided" },
                        { id: "double", label: "2-sided" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() =>
                            updateBadgeDesign({ layoutMode: option.id as "single" | "double" })
                          }
                          style={{
                            borderRadius: 10,
                            padding: "6px 10px",
                            border: "1px solid #374151",
                            backgroundColor:
                              badgeDesign.layoutMode === option.id ? "#111827" : "transparent",
                            color: "#e5e7eb",
                            fontSize: 12,
                            cursor: "pointer",
                            minWidth: 90,
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                        Badge width (mm)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={120}
                        step={1}
                        value={badgeDesign.badgeWidthMm}
                        onChange={(e) =>
                          updateBadgeDesign({ badgeWidthMm: Number(e.target.value) || 0 })
                        }
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          padding: "6px 8px",
                          backgroundColor: "#020617",
                          color: "#e5e7eb",
                          fontSize: 12,
                        }}
                      />
                      <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                        {mmToIn(badgeDesign.badgeWidthMm)} in
                      </p>
                    </div>
                    <div>
                      <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                        Badge height (mm)
                      </label>
                      <input
                        type="number"
                        min={40}
                        max={100}
                        step={1}
                        value={badgeDesign.badgeHeightMm}
                        onChange={(e) =>
                          updateBadgeDesign({ badgeHeightMm: Number(e.target.value) || 0 })
                        }
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          padding: "6px 8px",
                          backgroundColor: "#020617",
                          color: "#e5e7eb",
                          fontSize: 12,
                        }}
                      />
                      <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                        {mmToIn(badgeDesign.badgeHeightMm)} in
                      </p>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      QR size
                    </label>
                    <input
                      type="range"
                      min={12}
                      max={70}
                      value={badgeDesign.qrSizeMm}
                      onChange={(e) =>
                        updateBadgeDesign({ qrSizeMm: Number(e.target.value) || 0 })
                      }
                      style={{ width: "100%" }}
                    />
                    <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                      {badgeDesign.qrSizeMm} mm ({mmToIn(badgeDesign.qrSizeMm)} in)
                    </p>
                  </div>

                  <div>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      QR horizontal offset
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={maxQrOffsetX}
                      value={badgeDesign.qrOffsetXMm}
                      onChange={(e) =>
                        updateBadgeDesign({ qrOffsetXMm: Number(e.target.value) || 0 })
                      }
                      style={{ width: "100%" }}
                    />
                    <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                      {badgeDesign.qrOffsetXMm} mm from left ({mmToIn(badgeDesign.qrOffsetXMm)} in)
                    </p>
                  </div>

                  <div>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      QR vertical offset
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={maxQrOffsetY}
                      value={badgeDesign.qrOffsetYMm}
                      onChange={(e) =>
                        updateBadgeDesign({ qrOffsetYMm: Number(e.target.value) || 0 })
                      }
                      style={{ width: "100%" }}
                    />
                    <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                      {badgeDesign.qrOffsetYMm} mm from top ({mmToIn(badgeDesign.qrOffsetYMm)} in)
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                        Name font size
                      </label>
                      <input
                        type="range"
                        min={3}
                        max={8}
                        value={badgeDesign.nameFontMm}
                        onChange={(e) =>
                          updateBadgeDesign({ nameFontMm: Number(e.target.value) || 0 })
                        }
                        style={{ width: "100%" }}
                      />
                      <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                        {badgeDesign.nameFontMm} mm ({mmToIn(badgeDesign.nameFontMm)} in)
                      </p>
                    </div>
                    <div>
                      <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                        Company font size
                      </label>
                      <input
                        type="range"
                        min={2}
                        max={6}
                        value={badgeDesign.companyFontMm}
                        onChange={(e) =>
                          updateBadgeDesign({ companyFontMm: Number(e.target.value) || 0 })
                        }
                        style={{ width: "100%" }}
                      />
                      <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                        {badgeDesign.companyFontMm} mm ({mmToIn(badgeDesign.companyFontMm)} in)
                      </p>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      Meta font size (labels, IDs)
                    </label>
                    <input
                      type="range"
                      min={2}
                      max={5}
                      value={badgeDesign.metaFontMm}
                      onChange={(e) =>
                        updateBadgeDesign({ metaFontMm: Number(e.target.value) || 0 })
                      }
                      style={{ width: "100%" }}
                    />
                    <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                      {badgeDesign.metaFontMm} mm ({mmToIn(badgeDesign.metaFontMm)} in)
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                        Front logo
                      </label>
                      <input
                        type="text"
                        placeholder="Paste logo URL"
                        value={badgeDesign.frontLogoUrl}
                        onChange={(e) => updateBadgeDesign({ frontLogoUrl: e.target.value })}
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          padding: "6px 8px",
                          backgroundColor: "#020617",
                          color: "#e5e7eb",
                          fontSize: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload("front")}
                          style={{ color: "#9ca3af", fontSize: 12, flex: 1 }}
                        />
                        {badgeDesign.frontLogoUrl && (
                          <button
                            onClick={() => clearLogo("front")}
                            style={{
                              borderRadius: 8,
                              padding: "6px 8px",
                              border: "1px solid #374151",
                              backgroundColor: "transparent",
                              color: "#e5e7eb",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                        Back logo
                      </label>
                      <input
                        type="text"
                        placeholder="Paste logo URL"
                        value={badgeDesign.backLogoUrl}
                        onChange={(e) => updateBadgeDesign({ backLogoUrl: e.target.value })}
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          padding: "6px 8px",
                          backgroundColor: "#020617",
                          color: "#e5e7eb",
                          fontSize: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload("back")}
                          style={{ color: "#9ca3af", fontSize: 12, flex: 1 }}
                        />
                        {badgeDesign.backLogoUrl && (
                          <button
                            onClick={() => clearLogo("back")}
                            style={{
                              borderRadius: 8,
                              padding: "6px 8px",
                              border: "1px solid #374151",
                              backgroundColor: "transparent",
                              color: "#e5e7eb",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      Background
                      <input
                        type="color"
                        value={badgeDesign.backgroundColor}
                        onChange={(e) =>
                          updateBadgeDesign({ backgroundColor: e.target.value || "#ffffff" })
                        }
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          height: 36,
                          backgroundColor: "#020617",
                        }}
                      />
                    </label>

                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      Accent
                      <input
                        type="color"
                        value={badgeDesign.accentColor}
                        onChange={(e) =>
                          updateBadgeDesign({ accentColor: e.target.value || "#0ea5e9" })
                        }
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          height: 36,
                          backgroundColor: "#020617",
                        }}
                      />
                    </label>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      Text color
                      <input
                        type="color"
                        value={badgeDesign.textColor}
                        onChange={(e) =>
                          updateBadgeDesign({ textColor: e.target.value || "#0f172a" })
                        }
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          height: 36,
                          backgroundColor: "#020617",
                        }}
                      />
                    </label>

                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      Border color
                      <input
                        type="color"
                        value={badgeDesign.borderColor}
                        onChange={(e) =>
                          updateBadgeDesign({ borderColor: e.target.value || "#e5e7eb" })
                        }
                        style={{
                          width: "100%",
                          marginTop: 6,
                          border: "1px solid #374151",
                          borderRadius: 8,
                          height: 36,
                          backgroundColor: "#020617",
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                      Corner radius
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={badgeDesign.borderRadiusMm}
                      onChange={(e) =>
                        updateBadgeDesign({ borderRadiusMm: Number(e.target.value) || 0 })
                      }
                      style={{ width: "100%" }}
                    />
                    <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                      {badgeDesign.borderRadiusMm} mm ({mmToIn(badgeDesign.borderRadiusMm)} in)
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === "exhibitors" && (
            <section
              style={{
                border: "1px solid #1f2937",
                borderRadius: 12,
                padding: 16,
                backgroundColor: "#0f172a",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 12,
                  alignItems: "center",
                }}
              >
                <input
                  placeholder="Search exhibitors"
                  value={exhibitorSearch}
                  onChange={(e) => setExhibitorSearch(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 240,
                    borderRadius: 10,
                    border: "1px solid #374151",
                    padding: "10px 12px",
                    backgroundColor: "#0b1120",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                />
              </div>

              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#0b1120", borderBottom: "1px solid #1f2937" }}>
                      <th style={thStyle}>Exhibitor</th>
                      <th style={thStyle}>Activation code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExhibitors.length === 0 && (
                      <tr>
                        <td colSpan={2} style={tdStyle}>
                          No exhibitors found. Capture some leads to populate this list.
                        </td>
                      </tr>
                    )}
                    {filteredExhibitors.map((exh) => (
                      <tr
                        key={exh.name}
                        style={{
                          borderBottom: "1px solid #111827",
                          backgroundColor: "#0b1224",
                        }}
                      >
                        <td style={tdStyle}>{exh.name}</td>
                        <td style={tdStyle}>{exh.activationCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeSection === "leadRetrieval" && (
            <section
              style={{
                border: "1px solid #1f2937",
                borderRadius: 12,
                padding: 16,
                backgroundColor: "#0f172a",
              }}
            >
              <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12 }}>
                Share these activation codes with exhibitors so they can enable lead capture in their apps.
              </p>
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#0b1120", borderBottom: "1px solid #1f2937" }}>
                      <th style={thStyle}>Exhibitor</th>
                      <th style={thStyle}>Activation code</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExhibitors.length === 0 && (
                      <tr>
                        <td colSpan={3} style={tdStyle}>
                          No activation codes available yet.
                        </td>
                      </tr>
                    )}
                    {filteredExhibitors.map((exh) => (
                      <tr
                        key={exh.name}
                        style={{
                          borderBottom: "1px solid #111827",
                          backgroundColor: "#0b1224",
                        }}
                      >
                        <td style={tdStyle}>{exh.name}</td>
                        <td style={tdStyle}>{exh.activationCode}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => copyToClipboard(exh.activationCode)}
                            style={{
                              borderRadius: 8,
                              padding: "6px 10px",
                              border: "1px solid #38bdf8",
                              backgroundColor: "transparent",
                              color: "#38bdf8",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Copy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>

      {editingAttendee && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !savingEdit && setEditingAttendee(null)}
        >
          <div
            style={{
              backgroundColor: "#0b1120",
              border: "1px solid #1f2937",
              borderRadius: 14,
              padding: 18,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, color: "#e5e7eb", fontWeight: 700 }}>
                  Edit attendee
                </p>
                <p style={{ margin: "2px 0 0", color: "#9ca3af", fontSize: 12 }}>
                  Update registration details and save to disk.
                </p>
              </div>
              <button
                onClick={() => setEditingAttendee(null)}
                disabled={savingEdit}
                style={{
                  borderRadius: 8,
                  padding: "6px 8px",
                  border: "1px solid #374151",
                  backgroundColor: "transparent",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                  First name
                  <input
                    value={editForm.firstName || ""}
                    onChange={(e) => handleEditChange("firstName", e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      border: "1px solid #374151",
                      borderRadius: 10,
                      padding: "8px 10px",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: 13,
                    }}
                  />
                </label>
                <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                  Last name
                  <input
                    value={editForm.lastName || ""}
                    onChange={(e) => handleEditChange("lastName", e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 6,
                      border: "1px solid #374151",
                      borderRadius: 10,
                      padding: "8px 10px",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: 13,
                    }}
                  />
                </label>
              </div>

              <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                Email
                <input
                  value={editForm.email || ""}
                  onChange={(e) => handleEditChange("email", e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    border: "1px solid #374151",
                    borderRadius: 10,
                    padding: "8px 10px",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                />
              </label>

              <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                Company
                <input
                  value={editForm.company || ""}
                  onChange={(e) => handleEditChange("company", e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    border: "1px solid #374151",
                    borderRadius: 10,
                    padding: "8px 10px",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                />
              </label>

              <label style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>
                Event
                <select
                  value={editForm.eventId || ""}
                  onChange={(e) => handleEditChange("eventId", e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    border: "1px solid #374151",
                    borderRadius: 10,
                    padding: "8px 10px",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <option value="">Select event</option>
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name}
                    </option>
                  ))}
                </select>
              </label>

              {editError && (
                <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{editError}</p>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  onClick={() => setEditingAttendee(null)}
                  disabled={savingEdit}
                  style={{
                    borderRadius: 10,
                    padding: "8px 12px",
                    border: "1px solid #374151",
                    backgroundColor: "transparent",
                    color: "#e5e7eb",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  style={{
                    borderRadius: 10,
                    padding: "8px 12px",
                    border: "1px solid #22c55e",
                    backgroundColor: "#0b1120",
                    color: "#22c55e",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {savingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AnalyticsCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #1f2937",
        backgroundColor: "#0f172a",
        padding: "10px 12px",
      }}
    >
      <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>{label}</p>
      <p style={{ color: accent, fontSize: 22, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

const thStyle = {
  padding: "8px 10px",
  textAlign: "left",
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 600,
};

const tdStyle = {
  padding: "8px 10px",
  color: "#e5e7eb",
  fontSize: 13,
};
