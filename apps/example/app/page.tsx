import Link from "next/link";

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-8 px-6 py-16">
      <div className="grain pointer-events-none absolute inset-0 -z-10" />

      <section className="app-card ml-0 p-8 md:ml-10 md:max-w-4xl md:p-10">
        <p className="text-xs uppercase tracking-[0.24em] opacity-70">AppBase Reference App</p>
        <h1 className="mt-3 text-5xl font-extrabold leading-[0.96] md:text-7xl">
          Todo app that feels
          <br />
          <span className="text-[var(--accent)]">designed, not generated.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base opacity-80 md:text-lg">
          Start with auth, land in a protected dashboard, and manage todos with SDK-powered CRUD.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          className="app-card translate-y-3 p-5 transition hover:-translate-y-1"
          href="/sign-up"
        >
          <p className="text-sm opacity-70">Get started</p>
          <h2 className="mt-1 text-2xl font-bold">Sign up</h2>
          <p className="mt-2 text-sm opacity-75">Create your account in seconds.</p>
        </Link>
        <Link
          className="app-card -translate-y-2 p-5 transition hover:-translate-y-3"
          href="/sign-in"
        >
          <p className="text-sm opacity-70">Welcome back</p>
          <h2 className="mt-1 text-2xl font-bold">Sign in</h2>
          <p className="mt-2 text-sm opacity-75">Continue where you left off.</p>
        </Link>
        <Link
          className="app-card bg-[var(--panel)] p-5 transition hover:-translate-y-1"
          href="/dashboard"
        >
          <p className="text-sm opacity-70">Protected area</p>
          <h2 className="mt-1 text-2xl font-bold">Dashboard</h2>
          <p className="mt-2 text-sm opacity-75">Manage your todo list with SDK DB client.</p>
          </Link>
      </section>
    </main>
  );
}
