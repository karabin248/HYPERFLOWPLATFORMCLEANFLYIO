import { useState, FormEvent } from "react";
import { setToken } from "../api";

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please enter a token.");
      return;
    }
    setToken(trimmed);
    setError("");
    onLogin();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Operator Panel</h1>
          <p className="text-sm text-muted-foreground">
            Enter your API token to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="token"
              className="block text-sm font-medium text-foreground"
            >
              API Token
            </label>
            <input
              id="token"
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(e) => {
                setTokenValue(e.target.value);
                setError("");
              }}
              placeholder="Enter your token"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
