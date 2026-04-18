export default function Header() {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Hyperflow Operator Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Repository lifecycle control
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
          v0.3
        </span>
      </div>
    </header>
  );
}
