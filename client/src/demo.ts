import { connectAgent } from "./agent.js";
import { readAgentAuthorization } from "./authorization.js";
import { parsePolicyDecision } from "./policy-decision.js";
import { readRegistration } from "./registration.js";
import {
  CONTRACT_VERSION,
  DEFAULT_POLICY,
  EVALUATE_TRADE_FUNCTION,
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
    intent: { symbol: "SOL", side: "BUY", notionalUsdCents: 50_000, venue: "JUPITER", confidenceBps: 9_100, dailyLossUsdCents: 10_000 },
    expectedDecision: "ALLOW",
    expectedReasons: [],
  },
  {
    name: "valid BTC sell",
    intent: { symbol: "BTC", side: "SELL", notionalUsdCents: 70_000, venue: "JUPITER", confidenceBps: 8_800, dailyLossUsdCents: 20_000 },
    expectedDecision: "ALLOW",
    expectedReasons: [],
  },
  {
    name: "unsupported token",
    intent: { symbol: "DOGE", side: "BUY", notionalUsdCents: 10_000, venue: "JUPITER", confidenceBps: 9_500, dailyLossUsdCents: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["SYMBOL_NOT_ALLOWED"],
  },
  {
    name: "unsupported venue",
    intent: { symbol: "SOL", side: "BUY", notionalUsdCents: 10_000, venue: "BINANCE", confidenceBps: 9_500, dailyLossUsdCents: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["VENUE_NOT_ALLOWED"],
  },
  {
    name: "oversized SOL trade",
    intent: { symbol: "SOL", side: "BUY", notionalUsdCents: 150_000, venue: "JUPITER", confidenceBps: 9_500, dailyLossUsdCents: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["NOTIONAL_LIMIT_EXCEEDED"],
  },
  {
    name: "low-confidence trade",
    intent: { symbol: "SOL", side: "SELL", notionalUsdCents: 20_000, venue: "JUPITER", confidenceBps: 5_000, dailyLossUsdCents: 0 },
    expectedDecision: "DENY",
    expectedReasons: ["CONFIDENCE_TOO_LOW"],
  },
  {
    name: "daily loss exceeded",
    intent: { symbol: "BTC", side: "SELL", notionalUsdCents: 20_000, venue: "JUPITER", confidenceBps: 9_000, dailyLossUsdCents: 50_100 },
    expectedDecision: "DENY",
    expectedReasons: ["DAILY_LOSS_LIMIT_EXCEEDED"],
  },
  {
    name: "multiple simultaneous violations",
    intent: { symbol: "DOGE", side: "HOLD", notionalUsdCents: 200_000, venue: "BINANCE", confidenceBps: 2_000, dailyLossUsdCents: 90_000 },
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
  const unitsValid =
    Number.isSafeInteger(intent.notionalUsdCents) && intent.notionalUsdCents >= 0 &&
    Number.isSafeInteger(intent.dailyLossUsdCents) && intent.dailyLossUsdCents >= 0 &&
    Number.isSafeInteger(intent.confidenceBps) &&
    intent.confidenceBps >= 0 &&
    intent.confidenceBps <= 10_000;
  if (!unitsValid) {
    return parsePolicyDecision({
      decision: "DENY",
      reasons: ["INVALID_INPUT"],
      symbol: intent.symbol,
      side: intent.side,
      notionalUsdCents: intent.notionalUsdCents,
    });
  }

  const reasons: ReasonCode[] = [];
  if (!policy.allowedSymbols.includes(intent.symbol)) reasons.push("SYMBOL_NOT_ALLOWED");
  if (!policy.allowedVenues.includes(intent.venue)) reasons.push("VENUE_NOT_ALLOWED");
  if (intent.notionalUsdCents > policy.maxTradeNotionalUsdCents) reasons.push("NOTIONAL_LIMIT_EXCEEDED");
  if (intent.dailyLossUsdCents > policy.maxDailyLossUsdCents) reasons.push("DAILY_LOSS_LIMIT_EXCEEDED");
  if (intent.confidenceBps < policy.minConfidenceBps) reasons.push("CONFIDENCE_TOO_LOW");
  if (intent.side !== "BUY" && intent.side !== "SELL") reasons.push("INVALID_SIDE");
  return parsePolicyDecision({
    decision: reasons.length === 0 ? "ALLOW" : "DENY",
    reasons,
    symbol: intent.symbol,
    side: intent.side,
    notionalUsdCents: intent.notionalUsdCents,
  });
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
  const authorization = await readAgentAuthorization();
  if (
    authorization.scriptName !== registration.scriptName ||
    authorization.version !== registration.version
  ) {
    throw new Error("Agent authorization does not match the registered contract");
  }
  const { agentClient, agentDid } = await connectAgent();
  if (agentDid !== authorization.agentDid) {
    throw new Error("Authenticated agent does not match the authorized agent DID");
  }
  console.log(`Mode: LIVE T3N TESTNET TEE (${registration.scriptName}@${registration.version})`);
  console.log(`Agent DID: ${agentDid}`);
  console.log("Security note: testnet uses the documented unsafe trust-server workaround.\n");
  return async (intent) => {
    const response: unknown = await agentClient.executeAndDecode({
      contract_id: registration.scriptName,
      contract_version: CONTRACT_VERSION,
      function_name: EVALUATE_TRADE_FUNCTION,
      pii_did: authorization.dataOwnerDid,
      input: intent,
    });
    return parsePolicyDecision(response);
  };
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
