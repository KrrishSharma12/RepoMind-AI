"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/auth-client";

/** Starts the GitHub login. On success the browser leaves for GitHub, so `pending` stays true. */
export function useGithubSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
        errorCallbackURL: "/",
      });
      console.log("GitHub sign-in result:", result);
      if (result?.error) {
        setError(result.error.message ?? "Could not start GitHub sign-in.");
        setPending(false);
      }
    } catch {
      setError("Could not reach the server. Please try again.");
      setPending(false);
    }
  }

  return { signIn, pending, error };
}