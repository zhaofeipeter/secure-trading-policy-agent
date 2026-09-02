import {
  T3nClient,
  TenantClient,
  createEthAuthInput,
  eth_get_address,
  getNodeUrl,
  loadWasmComponent,
  metamask_sign,
  setEnvironment,
} from "@terminal3/t3n-sdk";

import { TESTNET_ONLY_UNSAFE_TRUST_ANCHOR } from "./t3n.js";

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

  const adminKey = process.env.T3N_API_KEY;
  if (!adminKey) {
    throw new Error("T3N_API_KEY is required for the contract-log diagnostic");
  }

  setEnvironment("testnet");
  const nodeUrl = getNodeUrl();
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(adminKey);
  const adminClient = new T3nClient({
    trustAnchor: TESTNET_ONLY_UNSAFE_TRUST_ANCHOR,
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, adminKey),
    },
  });

  await adminClient.handshake();
  const authentication = await adminClient.authenticate(createEthAuthInput(address));
  const authenticatedDid = authentication.value;
  const tenant = new TenantClient({
    environment: "testnet",
    endpoint: nodeUrl,
    baseUrl: nodeUrl,
    t3n: adminClient,
    tenantDid: authenticatedDid,
  });

  console.log("DIAGNOSTIC_CONTRACT_LOGS");
  console.log(`authenticatedDid: ${authenticatedDid}`);
  console.log("contractTail: trading-policy");

  const result = await tenant.contracts.logs("trading-policy", {
    limit: 100,
  });

  console.log("entries:");
  console.log(JSON.stringify(result.entries, null, 2));
  console.log(`next_seq: ${result.next_seq ?? "null"}`);
  console.log(`truncated: ${result.truncated}`);
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
