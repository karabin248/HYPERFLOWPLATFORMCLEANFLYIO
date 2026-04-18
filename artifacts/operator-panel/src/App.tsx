import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import AddRepoForm from "./components/AddRepoForm";
import ScanAllButton from "./components/ScanAllButton";
import RepoTable from "./components/RepoTable";
import RunsTable from "./components/RunsTable";
import GraphView from "./components/GraphView";
import { listRepositories } from "./api";

function App() {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    const res = await listRepositories();
    if (res.status === "ok") {
      setRepos(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Repositories
              {!loading && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({repos.length})
                </span>
              )}
            </h2>
            <ScanAllButton
              onScanComplete={fetchRepos}
              disabled={repos.length === 0}
            />
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <AddRepoForm onCreated={fetchRepos} />
          </div>
          <div className="bg-card border border-border rounded-lg">
            <RepoTable repos={repos} loading={loading} onRefresh={fetchRepos} />
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg p-4">
          <RunsTable />
        </section>

        <section className="bg-card border border-border rounded-lg p-4">
          <GraphView />
        </section>
      </main>
    </div>
  );
}

export default App;
