import { useState, useEffect, useCallback } from "react";
import { listRuns } from "../api";

interface Run {
  runId: string;
  type: string;
  name: string;
  status: string;
  progress: number;
  startedAt: string;
  completedAt: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  running: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function RunsTable() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await listRuns(50);

    if (res.status === "ok") {
      setRuns(res.data);
    } else {
      setError(res.error || "Failed to fetch runs");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Runs
          {!loading && !error && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({runs.length})
            </span>
          )}
        </h2>
        <button
          onClick={fetchRuns}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {loading && runs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading runs...
        </div>
      ) : !error && runs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No runs recorded yet.
        </div>
      ) : !error ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Run ID</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.runId} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground" title={run.runId}>
                    {run.runId.slice(0, 8)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-mono bg-primary/10 text-primary">
                      {run.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${STATUS_STYLES[run.status] || "bg-muted text-muted-foreground"}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-xs text-muted-foreground">
                    {run.progress}%
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">
                    {formatTime(run.startedAt)}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">
                    {formatTime(run.completedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
