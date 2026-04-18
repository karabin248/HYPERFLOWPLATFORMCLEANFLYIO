import { useState } from "react";
import { scanAllRepositories } from "../api";

interface Props {
  onScanComplete: () => void;
  disabled?: boolean;
}

export default function ScanAllButton({ onScanComplete, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleScanAll() {
    setLoading(true);
    setResult(null);

    const res = await scanAllRepositories();

    if (res.status === "ok") {
      setResult(`Scan ${res.data?.status || "completed"}`);
      onScanComplete();
    } else {
      setResult(res.error || "Scan failed");
    }

    setLoading(false);
    setTimeout(() => setResult(null), 4000);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleScanAll}
        disabled={loading || disabled}
        className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? "Scanning all..." : "Scan All Repositories"}
      </button>
      {result && (
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
