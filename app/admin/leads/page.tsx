"use client";
// @ts-nocheck

import { useEffect, useState } from "react";

export default function LeadsAdminPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadLeads() {
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      const data = await res.json();
    
      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setLeads(sorted);
    } catch (err) {
      console.error("Error loading leads", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  function downloadCsv() {
    if (!leads || leads.length === 0) {
      alert("No leads to export yet.");
      return;
    }

    const headers = [
      "id",
      "attendeeId",
      "attendeeName",
      "attendeeEmail",
      "exhibitor",
      "notes",
      "timestamp",
    ];

    const lines: string[] = [];
    lines.push(headers.join(","));

    for (const lead of leads as any[]) {
      const row = [
        lead.id ?? "",
        lead.attendeeId ?? "",
        lead.attendeeName ?? "",
        lead.attendeeEmail ?? "",
        lead.exhibitor ?? "",
        lead.notes ?? "",
        lead.timestamp ?? "",
      ].map((value) => {
        const str = String(value ?? "");
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      });

      lines.push(row.join(","));
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "exhibitor-leads.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hemisphere — Exhibitor Leads</h1>
            <p className="text-sm text-slate-400">
              All leads captured by exhibitors across the event.
            </p>
          </div>
          <a
            href="/admin"
            className="text-sm underline text-slate-300 hover:text-white"
          >
            ← Back to Admin
          </a>
        </header>

        <section className="flex justify-end gap-2">
          <button
            onClick={loadLeads}
            className="px-3 py-1 rounded-full bg-slate-100 text-slate-900 text-xs font-semibold"
          >
            Refresh
          </button>
          <button
            onClick={downloadCsv}
            className="px-3 py-1 rounded-full bg-emerald-500 text-slate-900 text-xs font-semibold hover:bg-emerald-400"
          >
            Download CSV
          </button>
        </section>

        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          {loading ? (
            <p className="text-sm text-slate-400">Loading leads…</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-slate-400">No leads captured yet.</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto text-xs">
              {leads.map((lead: any) => {
                const d = new Date(lead.timestamp);
                return (
                  <div
                    key={lead.id}
                    className="flex justify-between items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-100">
                        {lead.attendeeName}
                      </p>
                      <p className="text-slate-400">{lead.attendeeEmail}</p>
                      <p className="text-[11px] text-slate-500">
                        Attendee ID: {lead.attendeeId}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[11px] text-emerald-400">
                        Exhibitor: {lead.exhibitor}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {d.toLocaleDateString()} {d.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
