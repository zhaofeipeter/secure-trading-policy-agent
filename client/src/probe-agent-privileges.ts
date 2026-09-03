import { RpcError, TenantClient } from "@terminal3/t3n-sdk";

import { connectAgent } from "./agent.js";
import { readRegistration } from "./registration.js";
import { POLICY_KEY, POLICY_MAP_TAIL } from "./types.js";

type ProbeResult =
  | "SUCCESS"
  | "UNAUTHORIZED"
  | "NOT_SUPPORTED"
  | "NOT_PROBED"
  | "FAIL";

interface ProbeRow {
  name: string;
  result: ProbeResult;
  note?: string;
}

const tenantAdminPresent = Boolean(process.env.T3N_API_KEY);
const userKeyPresent = Boolean(process.env.USER_KEY);
const agentKeyPresent = Boolean(process.env.AGENT_KEY);

if (tenantAdminPresent) {
  throw new Error("Refusing privilege probe: T3N_API_KEY must not be present");
}
if (userKeyPresent) {
  throw new Error("Refusing privilege probe: USER_KEY must not be present");
}
if (!agentKeyPresent) {
  throw new Error("AGENT_KEY is required for the read-only privilege probe");
}

function classifyFailure(error: unknown): Pick<ProbeRow, "result" | "note"> {
  const message = error instanceof Error ? error.message : String(error);
  const detail = error instanceof RpcError ? error.detail ?? "" : "";
  const combined = `${message} ${detail}`;

  if (
    (error instanceof RpcError &&
      (error.httpStatus === 401 || error.httpStatus === 403)) ||
    /unauthori[sz]ed|forbidden|orgadminrequired|admin required|permission denied|access denied/i.test(
      combined,
    )
  ) {
    return { result: "UNAUTHORIZED" };
  }

  if (
    /not supported|unsupported|unknown function|method not found/i.test(
      combined,
    )
  ) {
    return { result: "NOT_SUPPORTED" };
  }

  return {
    result: "FAIL",
    note: error instanceof Error ? error.name : "unknown error",
  };
}

async function runReadOnlyProbe(
  name: string,
  operation: () => Promise<unknown>,
): Promise<ProbeRow> {
  try {
    await operation();
    return { name, result: "SUCCESS" };
  } catch (error) {
    return { name, ...classifyFailure(error) };
  }
}

function notProbed(name: string, note: string): ProbeRow {
  return { name, result: "NOT_PROBED", note };
}

function printRows(rows: ProbeRow[]): void {
  const width = Math.max(...rows.map((row) => row.name.length), 34);
  console.log("Probe".padEnd(width), "Result");
  console.log("-".repeat(width), "----------------");
  for (const row of rows) {
    const result = row.note ? `${row.result} (${row.note})` : row.result;
    console.log(row.name.padEnd(width), result);
  }
}

console.log("T3N AGENT KEY PRIVILEGE PROBE\n");
console.log("Credential isolation:");
console.log(`T3N_API_KEY present: ${tenantAdminPresent ? "YES" : "NO"}`);
console.log(`USER_KEY present: ${userKeyPresent ? "YES" : "NO"}`);
console.log(`AGENT_KEY present: ${agentKeyPresent ? "YES" : "NO"}`);

const rows: ProbeRow[] = [];
let authenticatedDid: string | null = null;

try {
  const registration = await readRegistration();
  const { agentClient, agentDid, nodeUrl } = await connectAgent();
  authenticatedDid = agentDid;

  rows.push({ name: "Agent authentication", result: "SUCCESS" });
  rows.push({ name: "Node handshake/session", result: "SUCCESS" });

  const sessionDid = agentClient.getDid()?.value;
  rows.push({
    name: "Plain client identity read",
    result: sessionDid === agentDid ? "SUCCESS" : "FAIL",
    ...(sessionDid === agentDid ? {} : { note: "session DID mismatch" }),
  });

  let tenant: TenantClient | null = null;
  try {
    tenant = new TenantClient({
      environment: "testnet",
      endpoint: nodeUrl,
      baseUrl: nodeUrl,
      t3n: agentClient,
      tenantDid: registration.tenantDid,
    });
    rows.push({ name: "TenantClient construction", result: "SUCCESS" });
  } catch (error) {
    rows.push({
      name: "TenantClient construction",
      ...classifyFailure(error),
    });
  }

  if (tenant === null) {
    rows.push(notProbed("tenant.me()", "TenantClient unavailable"));
    rows.push(notProbed("maps.getStatus", "TenantClient unavailable"));
    rows.push(
      notProbed("maps.entryGet(current)", "TenantClient unavailable"),
    );
    rows.push(
      notProbed("contracts.listDetailed", "TenantClient unavailable"),
    );
  } else {
    rows.push(
      await runReadOnlyProbe("tenant.me()", () => tenant.tenant.me()),
    );
    rows.push(
      await runReadOnlyProbe("maps.getStatus", () =>
        tenant.maps.getStatus(POLICY_MAP_TAIL),
      ),
    );
    rows.push(
      await runReadOnlyProbe("maps.entryGet(current)", () =>
        tenant.maps.entryGet(POLICY_MAP_TAIL, POLICY_KEY),
      ),
    );
    rows.push(
      await runReadOnlyProbe("contracts.listDetailed", () =>
        tenant.contracts.listDetailed({ limit: 200 }),
      ),
    );
  }
} catch (error) {
  const failure = classifyFailure(error);
  rows.push({ name: "Agent authentication", ...failure });
  rows.push(notProbed("Node handshake/session", "authentication failed"));
  rows.push(notProbed("Plain client identity read", "authentication failed"));
  rows.push(notProbed("TenantClient construction", "authentication failed"));
  rows.push(notProbed("tenant.me()", "authentication failed"));
  rows.push(notProbed("maps.getStatus", "authentication failed"));
  rows.push(notProbed("maps.entryGet(current)", "authentication failed"));
  rows.push(notProbed("contracts.listDetailed", "authentication failed"));
}

console.log("\n[AUTH]");
console.log(
  `status: ${rows.find((row) => row.name === "Agent authentication")?.result === "SUCCESS" ? "PASS" : "FAIL"}`,
);
console.log(`did: ${authenticatedDid ?? "unavailable"}`);
console.log("\nAuthenticated DID:");
console.log(authenticatedDid ?? "unavailable");
console.log("");
printRows(rows);

const controlPlaneRows = rows.filter((row) =>
  [
    "tenant.me()",
    "maps.getStatus",
    "maps.entryGet(current)",
    "contracts.listDetailed",
  ].includes(row.name),
);
const anyControlPlaneSuccess = controlPlaneRows.some(
  (row) => row.result === "SUCCESS",
);
const allControlPlaneUnauthorized =
  controlPlaneRows.length > 0 &&
  controlPlaneRows.every((row) => row.result === "UNAUTHORIZED");

const interpretation = anyControlPlaneSuccess
  ? "SHARED_TENANT_PRIVILEGE"
  : allControlPlaneUnauthorized
    ? "STRICTLY_SEPARATED"
    : "INCONCLUSIVE";

console.log("\nMutation calls executed:");
console.log("NONE");
console.log("\nFinal interpretation:");
console.log(interpretation);
