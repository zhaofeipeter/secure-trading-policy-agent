import { connectAgent } from "./agent.js";
import { readAgentAuthorization } from "./authorization.js";
import { readRegistration } from "./registration.js";
import type { TradeIntent } from "./types.js";

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
  if (process.env.T3N_API_KEY) {
    throw new Error("Refusing diagnostic: T3N_API_KEY must not be present");
  }
  if (process.env.USER_KEY) {
    throw new Error("Refusing diagnostic: USER_KEY must not be present");
  }
  if (!process.env.AGENT_KEY) {
    throw new Error("AGENT_KEY is required for the execute-shape diagnostic");
  }

  const registration = await readRegistration();
  const authorization = await readAgentAuthorization();
  if (
    authorization.scriptName !== registration.scriptName ||
    authorization.version !== registration.version
  ) {
    throw new Error("Agent authorization does not match the registered contract");
  }

  const { agentClient, agentDid: authenticatedDid } = await connectAgent();
  if (authenticatedDid !== authorization.agentDid) {
    throw new Error("Authenticated agent does not match the authorized agent DID");
  }

  console.log("DIAGNOSTIC_EXECUTE_SHAPE");
  console.log(`authenticatedDid: ${authenticatedDid}`);
  console.log(`script_name: ${registration.scriptName}`);
  console.log("script_version: 0.1.0");
  console.log("function_name: evaluate-trade");
  console.log(`pii_did: ${authorization.dataOwnerDid}`);

  const response: unknown = await agentClient.executeAndDecode({
    script_name: registration.scriptName,
    script_version: "0.1.0",
    function_name: "evaluate-trade",
    pii_did: authorization.dataOwnerDid,
    input: intent,
  });

  console.log("decodedResponse:");
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
