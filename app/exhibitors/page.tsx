"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Lead = {
  id: string;
  attendeeId: string | number;
  attendeeName: string;
  attendeeEmail: string;
  exhibitor: string;
  notes: string;
  timestamp: string;
  eventId?: string;
};

type Exhibitor = {
  name: string;
  activationCode: string;
};

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function toCsv(rows: Lead[]) {
  const headers = [
    "id",
    "attendeeId",
    "attendeeName",
    "attendeeEmail",
    "exhibitor",
    "notes",
    "timestamp",
    "eventId",
  ];
  const escape = (v: any) => {
    const str = String(v ?? "");
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape((row as any)[h])).join(",")),
  ];
  return lines.join("\n");
}

export default function ExhibitorPortal() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | name | exhibitor
  const [search, setSearch] = useState("");

  // Pull token from URL or localStorage on first load
  useEffect(() => {
    const urlToken = searchParams.get("token");
    const stored = typeof window !== "undefined" ? localStorage.getItem("exhibitorToken") : null;
    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem("exhibitorToken", urlToken);
      // Clean the URL so the token isn't visible after first load
      router.replace("/exhibitors");
    } else if (stored) {
      setToken(stored);
    }
  }, [router, searchParams]);

  useEffect(() => {
    async function loadExhibitors() {
      setLoadingExhibitors(true);
      try {
        const res = await fetch("/api/exhibitors/list", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setExhibitors(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Load exhibitors error:", err);
      } finally {
        setLoadingExhibitors(false);
      }
    }
    loadExhibitors();
  }, []);

  useEffect(() => {
    if (!token) {
      setLeads([]);
      return;
    }

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/exhibitors/leads", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Unable to fetch leads.");
        }
        setLeads(Array.isArray(data.leads) ? data.leads : []);
        setInfo(`Signed in as ${data.email}`);
      } catch (err: any) {
        console.error("Load leads error:", err);
        setError(err?.message || "Network error loading leads.");
        setToken(null);
        localStorage.removeItem("exhibitorToken");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  async function requestLink() {
    setRequesting(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/exhibitors/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not send magic link.");
      }
      setInfo(
        `Magic link ready. Share this URL with the exhibitor: ${data.loginUrl}`
      );
    } catch (err: any) {
      setError(err?.message || "Network error requesting link.");
    } finally {
      setRequesting(false);
    }
  }

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = leads.filter((l) => {
      if (!term) return true;
      return (
        l.attendeeName.toLowerCase().includes(term) ||
        l.attendeeEmail.toLowerCase().includes(term) ||
        (l.exhibitor || "").toLowerCase().includes(term) ||
        (l.notes || "").toLowerCase().includes(term)
      );
    });

    if (sortBy === "name") {
      rows = [...rows].sort((a, b) => a.attendeeName.localeCompare(b.attendeeName));
    } else if (sortBy === "exhibitor") {
      rows = [...rows].sort((a, b) => (a.exhibitor || "").localeCompare(b.exhibitor || ""));
    } else {
      rows = [...rows].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
    return rows;
  }, [leads, search, sortBy]);

  const filteredExhibitors = useMemo(() => {
    const term = exhibitorSearch.trim().toLowerCase();
    if (!term) return exhibitors;
    return exhibitors.filter((e) => e.name.toLowerCase().includes(term));
  }, [exhibitors, exhibitorSearch]);

  function downloadCsv() {
    const csv = toCsv(filteredLeads);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "hemisphere-leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function signOut() {
    setToken(null);
    localStorage.removeItem("exhibitorToken");
    setLeads([]);
    setInfo("");
  }

  function copyToClipboard(value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(value).catch((err) => {
      console.error("Copy failed:", err);
    });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050b1a 0%, #0c1329 100%)",
        color: "#e5e7eb",
        display: "flex",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          backgroundColor: "#0b1224",
          border: "1px solid #1f2937",
          borderRadius: 16,
          padding: 0,
          boxShadow: "0 20px 80px rgba(0,0,0,0.35)",
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          minHeight: 720,
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #1f2937",
            padding: "20px 16px",
            backgroundColor: "#0f172a",
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            Exhibitor Portal
          </h1>
          <nav style={{ display: "grid", gap: 8 }}>
            {[
              { id: "leads", label: "Leads" },
              { id: "exhibitors", label: "Exhibitors" },
              { id: "leadRetrieval", label: "Lead Retrieval" },
            ].map((item) => {
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id as any)}
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

          {token && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>
                Session
              </p>
              <button
                onClick={signOut}
                style={{
                  borderRadius: 10,
                  padding: "8px 12px",
                  border: "1px solid #374151",
                  backgroundColor: "transparent",
                  color: "#e5e7eb",
                  fontSize: 13,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </aside>

        <section
          style={{
            padding: 24,
            borderTopRightRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <header
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                {activePage === "leads"
                  ? "Lead List"
                  : activePage === "exhibitors"
                  ? "Exhibitors"
                  : "Lead Retrieval"}
              </h2>
              <p style={{ color: "#9ca3af", fontSize: 13 }}>
                {activePage === "leads" &&
                  "Request a magic link, sign in, filter leads, and download CSV."}
                {activePage === "exhibitors" &&
                  "Browse exhibitors tied to your event activity."}
                {activePage === "leadRetrieval" &&
                  "Share activation codes with exhibitors to enable lead capture."}
              </p>
            </div>
          </header>

          {(error || info) && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${error ? "#f87171" : "#22c55e"}`,
                backgroundColor: error ? "#2b0f13" : "#0f172a",
                color: error ? "#fecdd3" : "#bbf7d0",
                fontSize: 13,
              }}
            >
              {error || info}
            </div>
          )}

          {activePage === "leads" && (
            <>
              {!token && (
                <section
                  style={{
                    marginBottom: 20,
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  }}
                >
                  <div
                    style={{
                      border: "1px solid #1f2937",
                      borderRadius: 12,
                      padding: 16,
                      backgroundColor: "#0f172a",
                    }}
                  >
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                      Send a magic link
                    </h3>
                    <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>
                      Enter an exhibitor email. We generate a one-hour login link you can share.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="email"
                        placeholder="exhibitor@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 220,
                          borderRadius: 10,
                          border: "1px solid #374151",
                          padding: "10px 12px",
                          backgroundColor: "#0b1120",
                          color: "#e5e7eb",
                          fontSize: 14,
                        }}
                      />
                      <button
                        onClick={requestLink}
                        disabled={requesting || !email}
                        style={{
                          borderRadius: 10,
                          padding: "10px 16px",
                          border: "none",
                          background:
                            "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                          color: "#04101f",
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: requesting ? "default" : "pointer",
                          opacity: requesting || !email ? 0.8 : 1,
                        }}
                      >
                        {requesting ? "Sending..." : "Generate Link"}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid #1f2937",
                      borderRadius: 12,
                      padding: 16,
                      backgroundColor: "#0f172a",
                    }}
                  >
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                      Already have a link?
                    </h3>
                    <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 10 }}>
                      Paste the tokenized URL in your browser. We store your session locally.
                    </p>
                    <p style={{ color: "#9ca3af", fontSize: 13 }}>
                      Example: <code style={{ color: "#bbf7d0" }}>/exhibitors?token=...</code>
                    </p>
                  </div>
                </section>
              )}

              {token && (
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
                      flexWrap: "wrap",
                      gap: 10,
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                      <input
                        placeholder="Search by name, email, or exhibitor"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: 220,
                          borderRadius: 10,
                          border: "1px solid #374151",
                          padding: "8px 12px",
                          backgroundColor: "#0b1120",
                          color: "#e5e7eb",
                          fontSize: 13,
                        }}
                      />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{
                          borderRadius: 10,
                          border: "1px solid #374151",
                          padding: "8px 12px",
                          backgroundColor: "#0b1120",
                          color: "#e5e7eb",
                          fontSize: 13,
                        }}
                      >
                        <option value="newest">Newest first</option>
                        <option value="name">Name A–Z</option>
                        <option value="exhibitor">Exhibitor A–Z</option>
                      </select>
                    </div>
                    <button
                      onClick={downloadCsv}
                      disabled={filteredLeads.length === 0}
                      style={{
                        borderRadius: 10,
                        padding: "10px 14px",
                        border: "1px solid #22c55e",
                        backgroundColor: filteredLeads.length === 0 ? "#1f2937" : "transparent",
                        color: "#22c55e",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: filteredLeads.length === 0 ? "default" : "pointer",
                      }}
                    >
                      Download CSV
                    </button>
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
                          <th style={thStyle}>Name</th>
                          <th style={thStyle}>Email</th>
                          <th style={thStyle}>Exhibitor</th>
                          <th style={thStyle}>Scanned</th>
                          <th style={thStyle}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && (
                          <tr>
                            <td colSpan={5} style={tdStyle}>
                              Loading leads...
                            </td>
                          </tr>
                        )}
                        {!loading && filteredLeads.length === 0 && (
                          <tr>
                            <td colSpan={5} style={tdStyle}>
                              No leads found. Adjust your filters or ask attendees to register.
                            </td>
                          </tr>
                        )}
                        {!loading &&
                          filteredLeads.map((lead) => (
                            <tr
                              key={lead.id}
                              style={{
                                borderBottom: "1px solid #111827",
                                backgroundColor: "#0b1224",
                              }}
                            >
                              <td style={tdStyle}>{lead.attendeeName || "Unknown"}</td>
                              <td style={tdStyle}>{lead.attendeeEmail || "—"}</td>
                              <td style={tdStyle}>{lead.exhibitor || "—"}</td>
                              <td style={tdStyle}>{formatDate(lead.timestamp)}</td>
                              <td style={tdStyle}>
                                {lead.notes ? (
                                  <span style={{ color: "#9ca3af" }}>{lead.notes}</span>
                                ) : (
                                  <span style={{ color: "#6b7280" }}>—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {activePage === "exhibitors" && (
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
                    {loadingExhibitors && (
                      <tr>
                        <td colSpan={2} style={tdStyle}>
                          Loading exhibitors...
                        </td>
                      </tr>
                    )}
                    {!loadingExhibitors && filteredExhibitors.length === 0 && (
                      <tr>
                        <td colSpan={2} style={tdStyle}>
                          No exhibitors found. Capture some leads to populate this list.
                        </td>
                      </tr>
                    )}
                    {!loadingExhibitors &&
                      filteredExhibitors.map((exh) => (
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

          {activePage === "leadRetrieval" && (
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
                    {loadingExhibitors && (
                      <tr>
                        <td colSpan={3} style={tdStyle}>
                          Loading activation codes...
                        </td>
                      </tr>
                    )}
                    {!loadingExhibitors && filteredExhibitors.length === 0 && (
                      <tr>
                        <td colSpan={3} style={tdStyle}>
                          No activation codes available yet.
                        </td>
                      </tr>
                    )}
                    {!loadingExhibitors &&
                      filteredExhibitors.map((exh) => (
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
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "#e5e7eb",
  fontSize: 13,
};
