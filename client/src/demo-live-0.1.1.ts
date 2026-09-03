import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parsePolicyDecision } from "./policy-decision.js";
import { connectTenantAdmin } from "./tenant-admin.js";
import {
  CONTRACT_TAIL,
  EVALUATE_TRADE_FUNCTION,
  WORKAROUND_VERSION,
  type PolicyDecision,
  type ReasonCode,
  type TradeIntent,
} from "./types.js";

const DIAGNOSTIC_CONTRACT_ID = 868;
const DIAGNOSTIC_REGISTRATION_PATH = fileURLToPath(
  new URL("../contract-registration-0.1.1.json", import.meta.url),
);

interface DiagnosticRegistration {
  tenantDid: string;
  tail: string;
  scriptName: string;
  version: string;
  contractId: number;
}

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

function assertExpected(scenario: Scenario, actual: PolicyDecision): void {
  const reasonsMatch = JSON.stringify(actual.reasons) === JSON.stringify(scenario.expectedReasons);
  if (actual.decision !== scenario.expectedDecision || !reasonsMatch) {
    throw new Error(
      `${scenario.name}: expected ${scenario.expectedDecision} ${JSON.stringify(scenario.expectedReasons)}, ` +
        `received ${actual.decision} ${JSON.stringify(actual.reasons)}`,
    );
  }
}

if (process.env.AGENT_KEY !== undefined) {
  throw new Error("Refusing 0.1.1 tenant demo: AGENT_KEY must not be present");
}
if (process.env.USER_KEY !== undefined) {
  throw new Error("Refusing 0.1.1 tenant demo: USER_KEY must not be present");
}
if (!process.env.T3N_API_KEY) {
  throw new Error("T3N_API_KEY is required for the 0.1.1 live tenant demo");
}

const registration = JSON.parse(
  await readFile(DIAGNOSTIC_REGISTRATION_PATH, "utf8"),
) as Partial<DiagnosticRegistration>;
if (
  registration.contractId !== DIAGNOSTIC_CONTRACT_ID ||
  registration.tail !== CONTRACT_TAIL ||
  registration.version !== WORKAROUND_VERSION ||
  typeof registration.scriptName !== "string" ||
  typeof registration.tenantDid !== "string"
) {
  throw new Error(
    `Diagnostic registration must identify contract ${DIAGNOSTIC_CONTRACT_ID} / ${CONTRACT_TAIL}@${WORKAROUND_VERSION}`,
  );
}

const { tenant, tenantDid } = await connectTenantAdmin();
if (tenantDid !== registration.tenantDid) {
  throw new Error("Authenticated tenant DID does not match the 0.1.1 registration record");
}

console.log(
  `Mode: LIVE T3N TESTNET TEE (${registration.scriptName}@${WORKAROUND_VERSION}, contract ${DIAGNOSTIC_CONTRACT_ID})`,
);
console.log(`Tenant DID: ${tenantDid}`);
console.log("Security note: testnet uses the documented unsafe trust-server workaround.\n");

let passed = 0;
for (const scenario of scenarios) {
  const response: unknown = await tenant.contracts.execute(CONTRACT_TAIL, {
    version: WORKAROUND_VERSION,
    functionName: EVALUATE_TRADE_FUNCTION,
    input: scenario.intent,
  });
  const decision = parsePolicyDecision(response);
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
