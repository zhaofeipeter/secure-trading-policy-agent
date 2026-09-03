import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { readRegistration } from "./registration.js";
import { connectTenantAdmin } from "./tenant-admin.js";
import {
  CONTRACT_TAIL,
  ORIGINAL_VERSION,
  POLICY_MAP_TAIL,
  WORKAROUND_VERSION,
} from "./types.js";

const ORIGINAL_CONTRACT_ID = 863;
const DIAGNOSTIC_CONTRACT_ID = 868;
const DIAGNOSTIC_REGISTRATION_PATH = fileURLToPath(
  new URL("../contract-registration-0.1.1.json", import.meta.url),
);

interface DiagnosticRegistration {
  tenantDid: string;
  tail: string;
  version: string;
  contractId: number;
}

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
    throw new Error("Refusing ACL update: AGENT_KEY must not be present");
  }
  if (process.env.USER_KEY !== undefined) {
    throw new Error("Refusing ACL update: USER_KEY must not be present");
  }
  if (!process.env.T3N_API_KEY) {
    throw new Error("T3N_API_KEY is required for the diagnostic reader ACL update");
  }

  const original = await readRegistration();
  if (
    original.contractId !== ORIGINAL_CONTRACT_ID ||
    original.version !== ORIGINAL_VERSION ||
    original.tail !== CONTRACT_TAIL
  ) {
    throw new Error(
      `Original registration must identify contract ${ORIGINAL_CONTRACT_ID} / ${CONTRACT_TAIL}@${ORIGINAL_VERSION}`,
    );
  }

  const diagnostic = JSON.parse(
    await readFile(DIAGNOSTIC_REGISTRATION_PATH, "utf8"),
  ) as Partial<DiagnosticRegistration>;
  if (
    diagnostic.contractId !== DIAGNOSTIC_CONTRACT_ID ||
    diagnostic.version !== WORKAROUND_VERSION ||
    diagnostic.tail !== CONTRACT_TAIL ||
    typeof diagnostic.tenantDid !== "string"
  ) {
    throw new Error(
      `Diagnostic registration must identify contract ${DIAGNOSTIC_CONTRACT_ID} / ${CONTRACT_TAIL}@${WORKAROUND_VERSION}`,
    );
  }
  if (diagnostic.tenantDid !== original.tenantDid) {
    throw new Error("Original and diagnostic registration tenant DIDs do not match");
  }

  const { tenant, tenantDid } = await connectTenantAdmin();
  if (tenantDid !== original.tenantDid) {
    throw new Error("Authenticated tenant DID does not match the registration records");
  }

  console.log("GRANT_DIAGNOSTIC_READER_0_1_1");
  console.log(`map: ${POLICY_MAP_TAIL}`);
  console.log(`readers requested: [${ORIGINAL_CONTRACT_ID}, ${DIAGNOSTIC_CONTRACT_ID}]`);

  const response = await tenant.maps.update(POLICY_MAP_TAIL, {
    readers: { only: [ORIGINAL_CONTRACT_ID, DIAGNOSTIC_CONTRACT_ID] },
  });

  console.log("SDK response:");
  console.log(JSON.stringify(response, null, 2));
  console.log("ACL_READBACK_AVAILABLE: false");
  console.log("reason: @terminal3/t3n-sdk@5.5.0 exposes no ACL read API");
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
