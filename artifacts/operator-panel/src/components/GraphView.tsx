import { useState } from "react";
import { getGraph } from "../api";

interface GraphNode {
  id: string;
  name: string;
  language: string;
  classification: string;
  dependencyCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  matchType?: string;
  matchedOn?: string;
}

interface OverlapPair {
  repoA: string;
  repoB: string;
  score: number;
  sharedTokens?: string[];
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  overlapPairs: OverlapPair[];
}

export default function GraphView() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setError(null);

    const res = await getGraph();

    if (res.status === "ok") {
      setData(res.data);
    } else {
      setError(res.error || "Failed to fetch graph");
    }

    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Dependency Graph
        </h2>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : data ? "Refresh Graph" : "Load Graph"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{data.nodes.length} nodes</span>
            <span>{data.edges.length} edges</span>
            <span>{data.overlapPairs.length} overlap pairs</span>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Nodes</h3>
            {data.nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nodes</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Language</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Classification</th>
                      <th className="text-right py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Deps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.nodes.map((node) => (
                      <tr key={node.id} className="border-b border-border/50">
                        <td className="py-1.5 px-3 font-medium">{node.name}</td>
                        <td className="py-1.5 px-3 font-mono text-xs">{node.language}</td>
                        <td className="py-1.5 px-3 font-mono text-xs">{node.classification}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs">{node.dependencyCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Edges</h3>
            {data.edges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dependency edges</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Source</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Target</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Match</th>
                      <th className="text-right py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.edges.map((edge, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 px-3 font-mono text-xs">{edge.source}</td>
                        <td className="py-1.5 px-3 font-mono text-xs">{edge.target}</td>
                        <td className="py-1.5 px-3 font-mono text-xs">{edge.type}</td>
                        <td className="py-1.5 px-3 font-mono text-xs">
                          {edge.matchType || "-"}
                          {edge.matchedOn ? ` (${edge.matchedOn})` : ""}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs">{edge.weight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Overlap Pairs</h3>
            {data.overlapPairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overlap pairs</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Repo A</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Repo B</th>
                      <th className="text-right py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Score</th>
                      <th className="text-left py-1.5 px-3 text-xs font-medium text-muted-foreground uppercase">Shared Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overlapPairs.map((pair, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 px-3 font-mono text-xs">{pair.repoA}</td>
                        <td className="py-1.5 px-3 font-mono text-xs">{pair.repoB}</td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs">{pair.score.toFixed(3)}</td>
                        <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">
                          {pair.sharedTokens?.join(", ") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
