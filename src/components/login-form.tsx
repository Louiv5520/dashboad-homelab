"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") || "");
    const password = String(formData.get("password") || "");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Login fejlede. Tjek brugernavn og kode.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: 24,
          display: "grid",
          gap: 14,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Homelab Dashboard</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>Log ind for at se og styre dine services.</p>

        <label style={{ display: "grid", gap: 6 }}>
          Brugernavn
          <input
            name="username"
            required
            autoComplete="username"
            style={{
              background: "var(--panel-soft)",
              border: "1px solid var(--line)",
              color: "var(--text)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          Kodeord
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={{
              background: "var(--panel-soft)",
              border: "1px solid var(--line)",
              color: "var(--text)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          />
        </label>

        {error ? <p style={{ margin: 0, color: "var(--bad)" }}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            borderRadius: 10,
            border: "1px solid transparent",
            background: "#2563eb",
            color: "white",
            padding: "10px 14px",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Logger ind..." : "Log ind"}
        </button>
      </form>
    </main>
  );
}
