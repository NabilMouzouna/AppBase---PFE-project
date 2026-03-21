"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppBase } from "@/lib/appbase";
import { useRequireAuth } from "@/lib/auth";

type RawCollectionRecord = {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
};

type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

function mapTodo(record: RawCollectionRecord): Todo {
  return {
    id: record.id,
    title: typeof record.data.title === "string" ? record.data.title : "Untitled",
    done: Boolean(record.data.done),
    createdAt:
      typeof record.data.createdAt === "string" ? record.data.createdAt : record.createdAt,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const appBase = useAppBase();
  const { hasSession } = useRequireAuth("/sign-in");
  const { signOut, getSession } = appBase.auth;
  const todosCollection = useMemo(() => appBase.db.collection("todos"), [appBase]);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTodos = useCallback(async () => {
    setError(null);
    try {
      const res = await todosCollection.list();
      setTodos(res.items.map(mapTodo));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load todos";
      setError(msg);
    }
  }, [todosCollection]);

  useEffect(() => {
    if (!hasSession) return;
    void loadTodos();
  }, [hasSession, loadTodos]);

  const createTodo = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await todosCollection.create({
        title: title.trim(),
        done: false,
        createdAt: new Date().toISOString(),
      });
      setTitle("");
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create todo");
    } finally {
      setBusy(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    setBusy(true);
    setError(null);
    try {
      await todosCollection.update(todo.id, { done: !todo.done });
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo");
    } finally {
      setBusy(false);
    }
  };

  const removeTodo = async (todoId: string) => {
    setBusy(true);
    setError(null);
    try {
      await todosCollection.delete(todoId);
      await loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo");
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      router.push("/sign-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
    } finally {
      setBusy(false);
    }
  };

  if (!hasSession) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <p className="text-sm opacity-75">Redirecting to sign in...</p>
      </main>
    );
  }

  const userEmail = getSession()?.user.email ?? "user";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="grain pointer-events-none absolute inset-0 -z-10" />

      <header className="app-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-60">Protected</p>
            <h1 className="mt-1 text-4xl font-extrabold">Todo Dashboard</h1>
            <p className="mt-2 text-sm opacity-75">Signed in as {userEmail}</p>
          </div>
          <div className="flex gap-2">
            <Link className="rounded-lg border-2 border-[var(--line)] px-3 py-2 text-sm" href="/">
              Home
            </Link>
            <button
              disabled={busy}
              className="rounded-lg border-2 border-[var(--line)] bg-[var(--accent)] px-3 py-2 text-sm text-[#fffaf0] disabled:opacity-60"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="app-card p-6">
        <h2 className="text-lg font-semibold">Add todo</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            className="app-input flex-1"
            placeholder="Write your next task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            disabled={busy}
            className="app-button rounded-lg px-4 py-2 disabled:opacity-60"
            onClick={createTodo}
          >
            Add
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </section>

      <section className="app-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your todos</h2>
          <button className="rounded-lg border-2 border-[var(--line)] px-3 py-2 text-sm" onClick={loadTodos} disabled={busy}>
            Refresh
          </button>
        </div>

        {todos.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-[var(--line)] p-6 text-center text-sm opacity-75">
            No todos yet. Add one above to get started.
          </p>
        ) : (
          <ul className="grid gap-3">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <button
                  className={`text-left ${todo.done ? "line-through opacity-60" : ""} transition hover:translate-x-0.5`}
                  onClick={() => toggleTodo(todo)}
                  disabled={busy}
                >
                  <div className="font-medium">{todo.title}</div>
                  <div className="text-xs opacity-65">
                    {new Date(todo.createdAt).toLocaleString()} | {todo.done ? "Done" : "Open"}
                  </div>
                </button>
                <button
                  className="rounded-lg border-2 border-[var(--line)] bg-[var(--panel)] px-3 py-1 text-sm"
                  onClick={() => removeTodo(todo.id)}
                  disabled={busy}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

