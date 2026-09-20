"use client";

import { useActionState } from "react";

import { signup, type SignupState } from "@/app/signup/actions";

const initialState: SignupState = { error: null, success: false };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.success) {
    return (
      <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
        <h1>Request received</h1>
        <p>
          Thanks — your organization signup is pending approval. You&apos;ll be able to log in
          once a super-admin approves it.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Sign up your organization</h1>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Organization name
          <input name="organizationName" type="text" required />
        </label>
        <label>
          Institution type
          <select name="institutionType" required defaultValue="">
            <option value="" disabled>
              Select one
            </option>
            <option value="SCHOOL">School</option>
            <option value="COLLEGE">College</option>
          </select>
        </label>
        <label>
          Admin email
          <input name="adminEmail" type="email" required autoComplete="email" />
        </label>
        <label>
          Admin password
          <input
            name="adminPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        {state.error ? <p role="alert" style={{ color: "crimson" }}>{state.error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Sign up"}
        </button>
      </form>
    </main>
  );
}
