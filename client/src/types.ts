export const CONTRACT_TAIL = "trading-policy";
export const CONTRACT_VERSION = "0.1.0";
export const POLICY_MAP_TAIL = "trading-policy-config";
export const POLICY_KEY = "current";
export const EVALUATE_TRADE_FUNCTION = "evaluate-trade";

export type TradeSide = "BUY" | "SELL";

export interface TradeIntent {
  symbol: string;
  side: TradeSide | string;
  notionalUsdCents: number;
  venue: string;
  confidenceBps: number;
  dailyLossUsdCents: number;
}

export interface TradingPolicy {
  allowedSymbols: string[];
  allowedVenues: string[];
  maxTradeNotionalUsdCents: number;
  maxDailyLossUsdCents: number;
  minConfidenceBps: number;
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
  symbol: string;
  side: string;
  notionalUsdCents: number;
}

export interface ContractRegistration {
  tenantDid: string;
  tail: typeof CONTRACT_TAIL;
  scriptName: string;
  version: typeof CONTRACT_VERSION;
  contractId: number;
  registeredAt: string;
}

export interface AgentAuthorization {
  agentDid: string;
  dataOwnerDid: string;
  scriptName: string;
  version: typeof CONTRACT_VERSION;
  functionName: typeof EVALUATE_TRADE_FUNCTION;
  authorizedAt: string;
}

export const DEFAULT_POLICY: TradingPolicy = {
  allowedSymbols: ["SOL", "BTC"],
  allowedVenues: ["JUPITER"],
  maxTradeNotionalUsdCents: 100_000,
  maxDailyLossUsdCents: 50_000,
  minConfidenceBps: 8_000,
};
