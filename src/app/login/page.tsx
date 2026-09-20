"use client";

import { useActionState } from "react";

import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Log in</h1>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {state.error ? <p role="alert" style={{ color: "crimson" }}>{state.error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p>
        Need an account? <a href="/signup">Sign up your organization</a>
      </p>
    </main>
  );
}
