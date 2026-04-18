import { logger } from "./logger";

export type AuditAction =
  | "agent.created"
  | "agent.updated"
  | "agent.disabled"
  | "agent.enabled"
  | "agent.seeded"
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.retried"
  | "run.cancelled"
  | "auth.failed"
  | "auth.denied"
  | "rate_limit.exceeded";

export interface AuditEvent {
  action: AuditAction;
  timestamp: string;
  correlationId?: string;
  actor?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

const auditLogger = logger.child({ component: "audit" });

export function emitAuditEvent(event: Omit<AuditEvent, "timestamp">): void {
  const fullEvent: AuditEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  auditLogger.info(fullEvent, `audit: ${event.action}`);
}
