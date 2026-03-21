"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppBase } from "@/lib/appbase";

type LogItem = { at: string; message: string };

function nowTime() {
  return new Date().toLocaleTimeString();
}

export default function SignUpPage() {
  const router = useRouter();
  const appBase = useAppBase();
  const { signUp, getSession } = appBase.auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);

  const push = (message: string) => {
    setLogs((prev) => [{ at: nowTime(), message }, ...prev]);
    console.info(`[sign-up] ${message}`);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    push("Sign up started");
    try {
      const res = await signUp({ email, password });
      push(`Sign up success: ${res.user.email}`);
      push(getSession() ? "Session active" : "Session missing");
      router.push("/dashboard");
    } catch (error) {
      push(`Sign up failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error("[sign-up] failed", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 p-6">
      <div className="grain pointer-events-none absolute inset-0 -z-10" />
      <section className="app-card p-6 md:p-8">
        <h1 className="text-4xl font-extrabold">Create your account</h1>
        <p className="mt-2 text-sm opacity-75">Create an account, then jump directly to your protected dashboard.</p>
        <div className="mt-4 flex gap-2">
          <Link className="rounded-lg border-2 border-[var(--line)] px-3 py-2" href="/">
            Home
          </Link>
          <Link className="rounded-lg border-2 border-[var(--line)] px-3 py-2" href="/sign-in">
            Go to sign in
          </Link>
        </div>
      </section>

      <form onSubmit={onSubmit} className="app-card grid gap-4 p-6 md:p-8">
        <label className="grid gap-1 text-sm">
          <span>Email</span>
          <input
            className="app-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Password</span>
          <input
            className="app-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="SecurePassword123!"
            required
          />
        </label>
        <button
          disabled={busy}
          className="app-button rounded-lg px-4 py-2 disabled:opacity-50"
          type="submit"
        >
          {busy ? "Signing up..." : "Create account"}
        </button>
      </form>

      <section className="app-card p-6">
        <h2 className="text-lg font-semibold">Activity</h2>
        <ul className="mt-3 grid gap-2">
          {logs.map((log, i) => (
            <li key={`${log.at}-${i}`} className="rounded-lg border-2 border-[var(--line)] bg-[var(--panel)] p-2 text-sm">
              <div className="font-mono">[{log.at}] {log.message}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
