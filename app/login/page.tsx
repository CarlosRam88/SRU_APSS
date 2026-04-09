"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Incorrect password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-4">
          <img src="/Scotlandlogo.png" alt="Scottish Rugby" className="h-20 w-auto" />
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-[var(--bp-muted)] mb-1">Scottish Rugby Athletic Performance and Sports Science</p>
            <h1 className="text-2xl font-semibold text-[var(--bp-accent)] tracking-tight">Catapult Dashboard - Prototype</h1>
          </div>
        </div>

        <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[var(--bp-muted)] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoFocus
                placeholder="Enter password"
                className="w-full bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 focus:outline-none focus:border-[var(--bp-accent)]"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="px-5 py-2 rounded text-sm font-medium tracking-wide transition-colors bg-[var(--bp-accent)] text-[var(--bp-bg)] hover:bg-[var(--bp-accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Checking…" : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
