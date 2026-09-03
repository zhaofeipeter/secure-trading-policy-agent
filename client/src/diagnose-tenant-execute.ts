import { readRegistration } from "./registration.js";
import { connectTenantAdmin } from "./tenant-admin.js";
import {
  CONTRACT_TAIL,
  EVALUATE_TRADE_FUNCTION,
  ORIGINAL_VERSION,
  type TradeIntent,
} from "./types.js";

const EXPECTED_CONTRACT_ID = 863;
const EXPECTED_SCRIPT_NAME =
  "z:f62da0c78b9ffd0fce31193d4e7db02f272adc0e:trading-policy";

const intent: TradeIntent = {
  symbol: "SOL",
  side: "BUY",
  venue: "JUPITER",
  notionalUsdCents: 50_000,
  dailyLossUsdCents: 10_000,
  confidenceBps: 9_100,
};

function errorField(error: unknown, key: string): unknown {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return undefined;
  }
  return (error as Record<string, unknown>)[key];
}

function printable(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

try {
  if (process.env.AGENT_KEY) {
    throw new Error("Refusing diagnostic: AGENT_KEY must not be present");
  }
  if (process.env.USER_KEY) {
    throw new Error("Refusing diagnostic: USER_KEY must not be present");
  }
  if (!process.env.T3N_API_KEY) {
    throw new Error("T3N_API_KEY is required for the tenant execute diagnostic");
  }

  const registration = await readRegistration();
  if (
    registration.contractId !== EXPECTED_CONTRACT_ID ||
    registration.scriptName !== EXPECTED_SCRIPT_NAME ||
    registration.tail !== CONTRACT_TAIL ||
    registration.version !== ORIGINAL_VERSION
  ) {
    throw new Error(
      `Registration record must identify contract ${EXPECTED_CONTRACT_ID}, ` +
        `${EXPECTED_SCRIPT_NAME}@${ORIGINAL_VERSION}`,
    );
  }

  const { tenant, tenantDid: authenticatedDid } = await connectTenantAdmin();
  if (authenticatedDid !== registration.tenantDid) {
    throw new Error("Authenticated tenant DID does not match the registration record");
  }

  console.log("DIAGNOSTIC_TENANT_EXECUTE");
  console.log(`authenticatedDid: ${authenticatedDid}`);
  console.log(`contractTail: ${CONTRACT_TAIL}`);
  console.log(`contractId: ${EXPECTED_CONTRACT_ID}`);
  console.log(`version: ${ORIGINAL_VERSION}`);
  console.log(`functionName: ${EVALUATE_TRADE_FUNCTION}`);

  const response: unknown = await tenant.contracts.execute("trading-policy", {
    version: ORIGINAL_VERSION,
    functionName: "evaluate-trade",
    input: intent,
  });

  console.log("returnedValue:");
  console.log(JSON.stringify(response, null, 2));
} catch (error) {
  console.error(`name: ${error instanceof Error ? error.name : "UnknownError"}`);
  console.error(`message: ${error instanceof Error ? error.message : String(error)}`);
  console.error(`code: ${printable(errorField(error, "code"))}`);
  console.error(`rpcMethod: ${printable(errorField(error, "rpcMethod"))}`);
  console.error(`httpStatus: ${printable(errorField(error, "httpStatus"))}`);
  console.error(`requestId: ${printable(errorField(error, "requestId"))}`);
  console.error(`detail: ${printable(errorField(error, "detail"))}`);
  process.exitCode = 1;
}
