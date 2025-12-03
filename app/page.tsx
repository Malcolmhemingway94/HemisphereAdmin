"use client";

import { useEffect, useState } from "react";

type Attendee = {
  id: number;
  name: string;
  email: string;
};

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  // Load attendees from backend when page loads
  useEffect(() => {
    async function loadAttendees() {
      try {
        const res = await fetch("/api/register", { cache: "no-store" });
        const data = await res.json();
        setAttendees(data);
      } catch (err) {
        console.error("Error loading attendees", err);
      } finally {
        setLoading(false);
      }
    }
    loadAttendees();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Send attendee to backend
    await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });

    // Reload attendee list
    const res = await fetch("/api/register", { cache: "no-store" });
    const updated = await res.json();
    setAttendees(updated);

    setName("");
    setEmail("");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-white rounded-xl p-8 shadow-lg w-full max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-2 text-slate-900">
            Hemisphere — Event Registration
          </h1>
          <p className="text-sm text-slate-600">
            Enter your details to register. Below is the live attendee list
            loaded from your backend.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Malcolm Hemingway"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. you@example.com"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full md:w-auto rounded-md px-4 py-2 text-sm font-semibold bg-slate-900 text-white"
          >
            Register
          </button>
        </form>

        {/* Attendee List */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Attendee List (Admin Preview)
          </h2>

          {loading ? (
            <p className="text-sm text-slate-500">Loading attendees…</p>
          ) : attendees.length === 0 ? (
            <p className="text-sm text-slate-500">
              No attendees yet. Submit the form to see them appear here.
            </p>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
              {attendees.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="text-slate-500">{a.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}




