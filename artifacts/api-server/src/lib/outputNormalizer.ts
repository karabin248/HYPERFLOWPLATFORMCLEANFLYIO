import type { CoreResponse } from "./pythonClient";

export interface NormalizedOutput {
  summary: string;
  structured: Record<string, unknown>;
  artifacts: string[];
  qualityScore: number | null;
  warnings: string[];
  nextSuggestedAction: string | null;
}

export function normalizeOutput(coreData: CoreResponse): NormalizedOutput {
  const result = coreData.result || {};
  const output = (result.output as string) || "";
  const intent = coreData.intent || (result.intent as string) || "";
  const mode = coreData.mode || (result.mode as string) || "";
  const confidence = (result.confidence as number) || (coreData.quality_score as number) || null;
  const source = (result.source as string) || "";

  const warnings: string[] = [];
  if (source === "stub") {
    warnings.push("Response generated from stub (no LLM connected)");
  }
  if (confidence !== null && confidence < 0.5) {
    warnings.push(`Low confidence: ${confidence}`);
  }

  const summary = output
    ? output.length > 200
      ? output.slice(0, 200) + "..."
      : output
    : `${intent} execution in ${mode} mode`;

  return {
    summary,
    structured: {
      intent,
      mode,
      output,
      confidence,
      source,
      reasoning: result.reasoning || null,
      tokenCount: result.token_count || null,
    },
    artifacts: [],
    qualityScore: coreData.quality_score ?? null,
    warnings,
    nextSuggestedAction: null,
  };
}
