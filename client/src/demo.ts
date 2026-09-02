import { connectT3n } from "./t3n.js";
import { readRegistration } from "./registration.js";
import {
  CONTRACT_TAIL,
  CONTRACT_VERSION,
  DEFAULT_POLICY,
  type PolicyDecision,
  type ReasonCode,
  type TradeIntent,
  type TradingPolicy,
} from "./types.js";

interface Scenario {
  name: string;
  intent: TradeIntent;
  expectedDecision: PolicyDecision["decision"];
  expectedReasons: ReasonCode[];
}

const scenarios: Scenario[] = [
  {
    name: "valid SOL buy",
    intent: { symbol: "SOL", side: "BUY", notionalUsd: 500, venue: "JUPITER", confidence: 0.91, dailyLossUsd: 100 },
    expectedDecision: "ALLOW",
    expectedReasons: [],
  },
  {
    name: "valid BTC sell",
    intent: { symbol: "BTC", side: "SELL", notionalUsd: 700, venue: "JUPITER", confidence: 0.88, dailyLossUsd: 200 },
    expectedDecision: "ALLOW",
    expectedReasons: [],
  },
  {
    name: "unsupported token",
    intent: { symbol: "DOGE", side: "BUY", notionalUsd: 100, venue: "JUPITER", confidence: 0.95, dailyLossUsd: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["SYMBOL_NOT_ALLOWED"],
  },
  {
    name: "unsupported venue",
    intent: { symbol: "SOL", side: "BUY", notionalUsd: 100, venue: "BINANCE", confidence: 0.95, dailyLossUsd: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["VENUE_NOT_ALLOWED"],
  },
  {
    name: "oversized SOL trade",
    intent: { symbol: "SOL", side: "BUY", notionalUsd: 1_500, venue: "JUPITER", confidence: 0.95, dailyLossUsd: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["NOTIONAL_LIMIT_EXCEEDED"],
  },
  {
    name: "low-confidence trade",
    intent: { symbol: "SOL", side: "SELL", notionalUsd: 200, venue: "JUPITER", confidence: 0.5, dailyLossUsd: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["CONFIDENCE_TOO_LOW"],
  },
  {
    name: "daily loss exceeded",
    intent: { symbol: "BTC", side: "SELL", notionalUsd: 200, venue: "JUPITER", confidence: 0.9, dailyLossUsd: 501 },
    expectedDecision: "DENY",
    expectedReasons: ["DAILY_LOSS_LIMIT_EXCEEDED"],
  },
  {
    name: "multiple simultaneous violations",
    intent: { symbol: "DOGE", side: "HOLD", notionalUsd: 2_000, venue: "BINANCE", confidence: 0.2, dailyLossUsd: 900 },
    expectedDecision: "DENY",
    expectedReasons: [
      "SYMBOL_NOT_ALLOWED",
      "VENUE_NOT_ALLOWED",
      "NOTIONAL_LIMIT_EXCEEDED",
      "DAILY_LOSS_LIMIT_EXCEEDED",
      "CONFIDENCE_TOO_LOW",
      "INVALID_SIDE",
    ],
  },
];

function evaluateInTrustedLocalHarness(
  intent: TradeIntent,
  policy: TradingPolicy,
): PolicyDecision {
  const numbersValid =
    Number.isFinite(intent.notionalUsd) && intent.notionalUsd >= 0 &&
    Number.isFinite(intent.dailyLossUsd) && intent.dailyLossUsd >= 0 &&
    Number.isFinite(intent.confidence) && intent.confidence >= 0 && intent.confidence <= 1;
  if (!numbersValid) {
    return { decision: "DENY", reasons: ["INVALID_INPUT"], symbol: intent.symbol, side: intent.side, notionalUsd: intent.notionalUsd };
  }

  const reasons: ReasonCode[] = [];
  if (!policy.allowedSymbols.includes(intent.symbol)) reasons.push("SYMBOL_NOT_ALLOWED");
  if (!policy.allowedVenues.includes(intent.venue)) reasons.push("VENUE_NOT_ALLOWED");
  if (intent.notionalUsd > policy.maxTradeNotionalUsd) reasons.push("NOTIONAL_LIMIT_EXCEEDED");
  if (intent.dailyLossUsd > policy.maxDailyLossUsd) reasons.push("DAILY_LOSS_LIMIT_EXCEEDED");
  if (intent.confidence < policy.minConfidence) reasons.push("CONFIDENCE_TOO_LOW");
  if (intent.side !== "BUY" && intent.side !== "SELL") reasons.push("INVALID_SIDE");
  return {
    decision: reasons.length === 0 ? "ALLOW" : "DENY",
    reasons,
    symbol: intent.symbol,
    side: intent.side,
    notionalUsd: intent.notionalUsd,
  };
}

function assertExpected(scenario: Scenario, actual: PolicyDecision): void {
  const reasonsMatch = JSON.stringify(actual.reasons) === JSON.stringify(scenario.expectedReasons);
  if (actual.decision !== scenario.expectedDecision || !reasonsMatch) {
    throw new Error(
      `${scenario.name}: expected ${scenario.expectedDecision} ${JSON.stringify(scenario.expectedReasons)}, ` +
        `received ${actual.decision} ${JSON.stringify(actual.reasons)}`,
    );
  }
}

async function createEvaluator(): Promise<(intent: TradeIntent) => Promise<PolicyDecision>> {
  if (!process.argv.includes("--live")) {
    console.log("Mode: TRUSTED LOCAL HARNESS (no T3N invocation; no trade execution)\n");
    return async (intent) => evaluateInTrustedLocalHarness(intent, DEFAULT_POLICY);
  }

  const registration = await readRegistration();
  const { tenant, tenantDid } = await connectT3n();
  if (tenantDid !== registration.tenantDid) {
    throw new Error("Authenticated tenant does not match the contract registration record");
  }
  console.log(`Mode: LIVE T3N TESTNET TEE (${registration.scriptName}@${registration.version})`);
  console.log("Security note: testnet uses the documented unsafe trust-server workaround.\n");
  return async (intent) =>
    (await tenant.contracts.execute(CONTRACT_TAIL, {
      version: CONTRACT_VERSION,
      functionName: "evaluate-trade",
      input: intent,
    })) as PolicyDecision;
}

const evaluateIntent = await createEvaluator();
let passed = 0;
for (const scenario of scenarios) {
  const decision = await evaluateIntent(scenario.intent);
  assertExpected(scenario, decision);
  passed += 1;

  console.log(`Scenario: ${scenario.name}`);
  console.log("Intent:");
  console.log(JSON.stringify(scenario.intent, null, 2));
  console.log(`Decision: ${decision.decision}`);
  console.log("Reasons:");
  if (decision.reasons.length === 0) console.log("- none");
  for (const reason of decision.reasons) console.log(`- ${reason}`);
  console.log("");
}

console.log(`${passed}/${scenarios.length} deterministic scenarios passed.`);
console.log("No exchange was contacted and no trade was executed.");
