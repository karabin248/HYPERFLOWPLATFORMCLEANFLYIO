import { useState } from "react";
import { createRepository } from "../api";

interface Props {
  onCreated: () => void;
}

export default function AddRepoForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setLoading(true);
    setError(null);

    const res = await createRepository({ name: name.trim(), url: url.trim() });

    if (res.status === "ok") {
      setName("");
      setUrl("");
      onCreated();
    } else {
      setError(res.error || "Failed to create repository");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1 min-w-0">
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="express"
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        />
      </div>
      <div className="flex-[2] min-w-0">
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/expressjs/express"
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !name.trim() || !url.trim()}
        className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? "Adding..." : "Add Repository"}
      </button>
      {error && (
        <span className="text-xs text-destructive whitespace-nowrap">{error}</span>
      )}
    </form>
  );
}
