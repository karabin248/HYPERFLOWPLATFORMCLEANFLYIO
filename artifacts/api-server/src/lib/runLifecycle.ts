export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export interface TransitionResult {
  ok: boolean;
  error?: string;
}

export function canTransition(from: RunStatus, to: RunStatus): TransitionResult {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) {
    return { ok: false, error: `Unknown status: ${from}` };
  }
  if (!allowed.includes(to)) {
    return { ok: false, error: `Invalid transition: ${from} → ${to}. Allowed: ${allowed.join(", ") || "none"}` };
  }
  return { ok: true };
}

export function isTerminal(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isRetryable(status: RunStatus): boolean {
  return status === "failed";
}
