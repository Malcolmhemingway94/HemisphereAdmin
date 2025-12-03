"use client";
// @ts-nocheck

import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    try {
      const res = await fetch("/api/scanlog", { cache: "no-store" });
      const data = await res.json();

      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setLogs(sorted);
    } catch (err) {
      console.error("Error loading scan logs", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  // ---- CSV DOWNLOAD (client-side) ----
  function handleDownloadCsv() {
    if (!logs || logs.length === 0) {
      alert("No scans to export yet.");
      return;
    }

    const headers = [
      "id",
      "attendeeId",
      "attendeeName",
      "attendeeEmail",
      "timestamp",
    ];

    const lines: string[] = [];
    lines.push(headers.join(",")); // header row

    for (const log of logs as any[]) {
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
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "scanlogs.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  // ---- Basic stats ----
  const totalScans = logs.length;
  const uniqueAttendees = new Set(logs.map((l: any) => l.attendeeId)).size;
  const lastScan = logs.length > 0 ? new Date(logs[0].timestamp) : null;

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const logsToday = logs.filter((log: any) =>
    (log.timestamp || "").startsWith(todayKey)
  );

  const scansToday = logsToday.length;

  const hourlyBuckets: { hour: number; count: number }[] = Array.from(
    { length: 24 },
    (_, i) => ({ hour: i, count: 0 })
  );

  for (const log of logsToday as any[]) {
    const d = new Date(log.timestamp);
    const h = d.getHours();
    hourlyBuckets[h].count += 1;
  }

  const maxBucket = Math.max(
    1,
    ...hourlyBuckets.map((b) => b.count)
  );

  function formatHour(h: number) {
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12} ${ampm}`;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hemisphere — Scanner Analytics</h1>
            <p className="text-sm text-slate-400">
              Overview of check-in activity based on QR scans.
            </p>
          </div>
          <a
            href="/admin"
            className="text-sm underline text-slate-300 hover:text-white"
          >
            ← Back to Admin
          </a>
        </header>

        {/* Refresh + CSV */}
        <section className="flex justify-end gap-2">
          <button
            onClick={loadLogs}
            className="px-3 py-1 rounded-full bg-slate-100 text-slate-900 text-xs font-semibold"
          >
            Refresh
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-3 py-1 rounded-full bg-emerald-500 text-slate-900 text-xs font-semibold hover:bg-emerald-400"
          >
            Download CSV
          </button>
        </section>

        {/* Summary cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400">Total Scans</p>
            <p className="text-2xl font-bold mt-2">{totalScans}</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400">Unique Attendees</p>
            <p className="text-2xl font-bold mt-2">{uniqueAttendees}</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400">Scans Today</p>
            <p className="text-2xl font-bold mt-2">{scansToday}</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-400">Last Scan</p>
            <p className="text-sm font-semibold mt-2">
              {lastScan ? lastScan.toLocaleTimeString() : "No scans yet"}
            </p>
            <p className="text-xs text-slate-500">
              {lastScan ? lastScan.toLocaleDateString() : ""}
            </p>
          </div>
        </section>

        {/* Activity by hour */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">Today’s Activity by Hour</h2>

          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : scansToday === 0 ? (
            <p className="text-sm text-slate-400">No scans today.</p>
          ) : (
            <div className="space-y-2 mt-3">
              {hourlyBuckets.map((bucket) =>
                bucket.count > 0 ? (
                  <div key={bucket.hour} className="flex items-center gap-3 text-xs">
                    <div className="w-16 text-slate-300">
                      {formatHour(bucket.hour)}
                    </div>
                    <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full bg-green-500"
                        style={{
                          width: `${
                            (bucket.count / maxBucket) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <div className="w-8 text-right text-slate-300">
                      {bucket.count}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-500 mt-3">
            Only hours with scans are shown.
          </p>
        </section>

        {/* Recent scans */}
        <section className="bg-slate-900 border border-slate-700 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-2">Recent Scans</h2>

          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-400">No scans recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.slice(0, 25).map((log: any) => {
                const d = new Date(log.timestamp);
                return (
                  <div
                    key={log.id}
                    className="flex justify-between items-center text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="font-semibold text-slate-100">
                        {log.attendeeName}
                      </p>
                      <p className="text-slate-400">{log.attendeeEmail}</p>
                    </div>
                    <div className="text-right text-slate-400">
                      <p>{d.toLocaleTimeString()}</p>
                      <p className="text-[11px]">ID: {log.attendeeId}</p>
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
