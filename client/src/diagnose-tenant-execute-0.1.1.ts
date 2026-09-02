import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { connectTenantAdmin } from "./tenant-admin.js";
import {
  CONTRACT_TAIL,
  EVALUATE_TRADE_FUNCTION,
  type TradeIntent,
} from "./types.js";

const DIAGNOSTIC_CONTRACT_ID = 868;
const DIAGNOSTIC_VERSION = "0.1.1";
const DIAGNOSTIC_REGISTRATION_PATH = fileURLToPath(
  new URL("../contract-registration-0.1.1.json", import.meta.url),
);

interface DiagnosticRegistration {
  tenantDid: string;
  tail: string;
  version: string;
  contractId: number;
}

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
  if (process.env.AGENT_KEY !== undefined) {
    throw new Error("Refusing diagnostic: AGENT_KEY must not be present");
  }
  if (process.env.USER_KEY !== undefined) {
    throw new Error("Refusing diagnostic: USER_KEY must not be present");
  }
  if (!process.env.T3N_API_KEY) {
    throw new Error("T3N_API_KEY is required for the 0.1.1 tenant execute diagnostic");
  }

  const registration = JSON.parse(
    await readFile(DIAGNOSTIC_REGISTRATION_PATH, "utf8"),
  ) as Partial<DiagnosticRegistration>;
  if (
    registration.contractId !== DIAGNOSTIC_CONTRACT_ID ||
    registration.tail !== CONTRACT_TAIL ||
    registration.version !== DIAGNOSTIC_VERSION ||
    typeof registration.tenantDid !== "string"
  ) {
    throw new Error(
      `Diagnostic registration must identify contract ${DIAGNOSTIC_CONTRACT_ID} / ${CONTRACT_TAIL}@${DIAGNOSTIC_VERSION}`,
    );
  }

  const { tenant, tenantDid: authenticatedDid } = await connectTenantAdmin();
  if (authenticatedDid !== registration.tenantDid) {
    throw new Error("Authenticated tenant DID does not match the diagnostic registration record");
  }

  console.log("DIAGNOSTIC_TENANT_EXECUTE_0_1_1");
  console.log(`authenticatedDid: ${authenticatedDid}`);
  console.log(`contractTail: ${CONTRACT_TAIL}`);
  console.log(`contractId: ${DIAGNOSTIC_CONTRACT_ID}`);
  console.log(`version: ${DIAGNOSTIC_VERSION}`);
  console.log(`functionName: ${EVALUATE_TRADE_FUNCTION}`);

  const response: unknown = await tenant.contracts.execute(CONTRACT_TAIL, {
    version: DIAGNOSTIC_VERSION,
    functionName: EVALUATE_TRADE_FUNCTION,
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
