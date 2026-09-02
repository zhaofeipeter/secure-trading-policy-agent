export const CONTRACT_TAIL = "trading-policy";
export const CONTRACT_VERSION = "0.1.0";
export const POLICY_KEY = "current";

export type TradeSide = "BUY" | "SELL";

export interface TradeIntent {
  symbol: string;
  side: TradeSide | string;
  notionalUsd: number;
  venue: string;
  confidence: number;
  dailyLossUsd: number;
}

export interface TradingPolicy {
  allowedSymbols: string[];
  allowedVenues: string[];
  maxTradeNotionalUsd: number;
  maxDailyLossUsd: number;
  minConfidence: number;
}

export type Decision = "ALLOW" | "DENY";

export type ReasonCode =
  | "SYMBOL_NOT_ALLOWED"
  | "VENUE_NOT_ALLOWED"
  | "NOTIONAL_LIMIT_EXCEEDED"
  | "DAILY_LOSS_LIMIT_EXCEEDED"
  | "CONFIDENCE_TOO_LOW"
  | "INVALID_SIDE"
  | "INVALID_INPUT";

export interface PolicyDecision {
  decision: Decision;
  reasons: ReasonCode[];
  symbol?: string;
  side?: string;
  notionalUsd?: number;
}

export interface ContractRegistration {
  tenantDid: string;
  tail: typeof CONTRACT_TAIL;
  scriptName: string;
  version: typeof CONTRACT_VERSION;
  contractId: number;
  registeredAt: string;
}

export const DEFAULT_POLICY: TradingPolicy = {
  allowedSymbols: ["SOL", "BTC"],
  allowedVenues: ["JUPITER"],
  maxTradeNotionalUsd: 1_000,
  maxDailyLossUsd: 500,
  minConfidence: 0.8,
};
