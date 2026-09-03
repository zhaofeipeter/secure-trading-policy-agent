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

  const reasons = candidate.reasons as ReasonCode[];
  if (candidate.decision === "ALLOW" && reasons.length !== 0) {
    throw new Error("Malformed policy decision: ALLOW must not contain reasons");
  }
  if (candidate.decision === "DENY" && reasons.length === 0) {
    throw new Error("Malformed policy decision: DENY must contain at least one reason");
  }

  const hasSymbol = Object.hasOwn(candidate, "symbol");
  const hasSide = Object.hasOwn(candidate, "side");
  const hasNotional = Object.hasOwn(candidate, "notionalUsdCents");

  if (hasSymbol && (typeof candidate.symbol !== "string" || candidate.symbol.length === 0)) {
    throw new Error("Malformed policy decision: invalid symbol");
  }
  if (hasSide && (typeof candidate.side !== "string" || candidate.side.length === 0)) {
    throw new Error("Malformed policy decision: invalid side");
  }
  if (
    hasNotional &&
    (typeof candidate.notionalUsdCents !== "number" ||
      !Number.isSafeInteger(candidate.notionalUsdCents) ||
      candidate.notionalUsdCents < 0)
  ) {
    throw new Error("Malformed policy decision: invalid notionalUsdCents");
  }

  const isInvalidInput = reasons.includes("INVALID_INPUT");
  if (!isInvalidInput && (!hasSymbol || !hasSide || !hasNotional)) {
    throw new Error("Malformed policy decision: evaluated decisions require context fields");
  }

  if (isInvalidInput) {
    return {
      decision: "DENY",
      reasons: reasons as [ReasonCode, ...ReasonCode[]],
      ...(hasSymbol ? { symbol: candidate.symbol as string } : {}),
      ...(hasSide ? { side: candidate.side as string } : {}),
      ...(hasNotional ? { notionalUsdCents: candidate.notionalUsdCents as number } : {}),
    };
  }

  if (candidate.decision === "ALLOW") {
    return {
      decision: "ALLOW",
      reasons: [],
      symbol: candidate.symbol as string,
      side: candidate.side as string,
      notionalUsdCents: candidate.notionalUsdCents as number,
    };
  }

  return {
    decision: "DENY",
    reasons: reasons as [ReasonCode, ...ReasonCode[]],
    symbol: candidate.symbol as string,
    side: candidate.side as string,
    notionalUsdCents: candidate.notionalUsdCents as number,
  };
}
