import { useState } from "react";
import { scanRepository, deleteRepository } from "../api";

interface Repository {
  id: string;
  name: string;
  url: string;
  language: string;
  classification: string;
  dependencyCount: number;
  overlapScore: number | null;
}

interface Props {
  repos: Repository[];
  loading: boolean;
  onRefresh: () => void;
}

export default function RepoTable({ repos, loading, onRefresh }: Props) {
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [actionResult, setActionResult] = useState<Record<string, string>>({});

  async function handleScan(id: string) {
    setActionLoading((prev) => ({ ...prev, [id]: "scanning" }));
    setActionResult((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const res = await scanRepository(id);

    if (res.status === "ok") {
      setActionResult((prev) => ({ ...prev, [id]: `Scan ${res.data?.status || "done"}` }));
      onRefresh();
    } else {
      setActionResult((prev) => ({ ...prev, [id]: res.error || "Scan failed" }));
    }

    setActionLoading((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setTimeout(() => {
      setActionResult((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 4000);
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete repository "${name}"?`)) return;

    setActionLoading((prev) => ({ ...prev, [id]: "deleting" }));

    const res = await deleteRepository(id);

    if (res.status === "ok") {
      onRefresh();
    } else {
      setActionResult((prev) => ({ ...prev, [id]: res.error || "Delete failed" }));
    }

    setActionLoading((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading repositories...
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No repositories. Add one above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">URL</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Language</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Classification</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Deps</th>
            <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => (
            <tr key={repo.id} className="border-b border-border/50 hover:bg-muted/30">
              <td className="py-2.5 px-3 font-medium text-foreground">{repo.name}</td>
              <td className="py-2.5 px-3 text-muted-foreground">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  {repo.url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </td>
              <td className="py-2.5 px-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
                  repo.language === "unknown"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary"
                }`}>
                  {repo.language}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
                  repo.classification === "unknown"
                    ? "bg-muted text-muted-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  {repo.classification}
                </span>
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                {repo.dependencyCount}
              </td>
              <td className="py-2.5 px-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {actionResult[repo.id] && (
                    <span className="text-xs text-muted-foreground">
                      {actionResult[repo.id]}
                    </span>
                  )}
                  <button
                    onClick={() => handleScan(repo.id)}
                    disabled={!!actionLoading[repo.id]}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-secondary text-secondary-foreground hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading[repo.id] === "scanning" ? "Scanning..." : "Scan"}
                  </button>
                  <button
                    onClick={() => handleDelete(repo.id, repo.name)}
                    disabled={!!actionLoading[repo.id]}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading[repo.id] === "deleting" ? "..." : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
