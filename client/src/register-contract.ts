import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { connectT3n } from "./t3n.js";
import { REGISTRATION_PATH } from "./registration.js";
import {
  CONTRACT_TAIL,
  CONTRACT_VERSION,
  type ContractRegistration,
} from "./types.js";

const WASM_PATH = fileURLToPath(
  new URL(
    "../../contract/target/wasm32-wasip2/release/secure_trading_policy_agent_contract.wasm",
    import.meta.url,
  ),
);

if (existsSync(REGISTRATION_PATH)) {
  throw new Error(
    `Registration record already exists at ${REGISTRATION_PATH}. ` +
      "Inspect it instead of re-registering or automatically bumping the version.",
  );
}

if (!existsSync(WASM_PATH)) {
  throw new Error(`WASM artifact not found at ${WASM_PATH}. Build the Rust contract first.`);
}

const { tenant, tenantDid } = await connectT3n();
const canonicalName = tenant.canonicalName(CONTRACT_TAIL);
const inventory = await tenant.contracts.listDetailed({ limit: 200 });
const existing = inventory.contracts.find((item) => item.name === canonicalName);
if (existing) {
  throw new Error(
    `${canonicalName} is already registered at version ${existing.version}. ` +
      "Refusing to overwrite it or invent a version bump.",
  );
}

const wasm = await readFile(WASM_PATH);
const result = await tenant.contracts.register({
  tail: CONTRACT_TAIL,
  version: CONTRACT_VERSION,
  wasm,
});

const registration: ContractRegistration = {
  tenantDid,
  tail: CONTRACT_TAIL,
  scriptName: result.name,
  version: CONTRACT_VERSION,
  contractId: result.contract_id,
  registeredAt: new Date().toISOString(),
};

await writeFile(REGISTRATION_PATH, `${JSON.stringify(registration, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});

console.log("Contract registered successfully.");
console.log(`scriptName: ${registration.scriptName}`);
console.log(`contract_id: ${registration.contractId}`);
console.log(`version: ${registration.version}`);
console.log(`metadata: ${REGISTRATION_PATH}`);
