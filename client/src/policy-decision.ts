import { type PolicyDecision, type ReasonCode } from "./types.js";

const REASON_CODES = new Set<ReasonCode>([
  "SYMBOL_NOT_ALLOWED",
  "VENUE_NOT_ALLOWED",
  "NOTIONAL_LIMIT_EXCEEDED",
  "DAILY_LOSS_LIMIT_EXCEEDED",
  "CONFIDENCE_TOO_LOW",
  "INVALID_SIDE",
  "INVALID_INPUT",
]);

export function parsePolicyDecision(value: unknown): PolicyDecision {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Malformed policy decision: expected an object");
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.decision !== "ALLOW" && candidate.decision !== "DENY") {
    throw new Error("Malformed policy decision: invalid decision");
  }
  if (
    !Array.isArray(candidate.reasons) ||
    !candidate.reasons.every(
      (reason): reason is ReasonCode => typeof reason === "string" && REASON_CODES.has(reason as ReasonCode),
    )
  ) {
    throw new Error("Malformed policy decision: invalid reasons");
  }
  if (typeof candidate.symbol !== "string" || candidate.symbol.length === 0) {
    throw new Error("Malformed policy decision: invalid symbol");
  }
  if (typeof candidate.side !== "string" || candidate.side.length === 0) {
    throw new Error("Malformed policy decision: invalid side");
  }
  if (
    typeof candidate.notionalUsdCents !== "number" ||
    !Number.isSafeInteger(candidate.notionalUsdCents) ||
    candidate.notionalUsdCents < 0
  ) {
    throw new Error("Malformed policy decision: invalid notionalUsdCents");
  }

  return {
    decision: candidate.decision,
    reasons: candidate.reasons,
    symbol: candidate.symbol,
    side: candidate.side,
    notionalUsdCents: candidate.notionalUsdCents,
  };
}
