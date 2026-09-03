import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  WORKAROUND_ARTIFACT_BINDING,
  assertWasmArtifactBinding,
} from "./artifact-binding.js";
import { readRegistration } from "./registration.js";
import { connectTenantAdmin } from "./tenant-admin.js";
import {
  CONTRACT_TAIL,
  ORIGINAL_VERSION,
  WORKAROUND_VERSION,
} from "./types.js";

const EXPECTED_BASE_CONTRACT_ID = 863;
const EXPECTED_SCRIPT_NAME =
  "z:f62da0c78b9ffd0fce31193d4e7db02f272adc0e:trading-policy";
const WASM_PATH = fileURLToPath(
  new URL(
    "../../contract/diagnostic-target-0.1.1/wasm32-wasip2/release/secure_trading_policy_agent_contract.wasm",
    import.meta.url,
  ),
);
const DIAGNOSTIC_REGISTRATION_PATH = fileURLToPath(
  new URL("../contract-registration-0.1.1.json", import.meta.url),
);

interface DiagnosticRegistration {
  tenantDid: string;
  tail: typeof CONTRACT_TAIL;
  scriptName: string;
  version: typeof WORKAROUND_VERSION;
  contractId: number;
  registeredAt: string;
  basedOnContractId: typeof EXPECTED_BASE_CONTRACT_ID;
}

if (existsSync(DIAGNOSTIC_REGISTRATION_PATH)) {
  throw new Error(
    `Diagnostic registration record already exists at ${DIAGNOSTIC_REGISTRATION_PATH}. ` +
      "Inspect it instead of re-registering.",
  );
}
if (!existsSync(WASM_PATH)) {
  throw new Error(`Diagnostic WASM artifact not found at ${WASM_PATH}`);
}
const wasm = await readFile(WASM_PATH);
assertWasmArtifactBinding(wasm, WORKAROUND_ARTIFACT_BINDING);

const baseRegistration = await readRegistration();
if (
  baseRegistration.contractId !== EXPECTED_BASE_CONTRACT_ID ||
  baseRegistration.scriptName !== EXPECTED_SCRIPT_NAME ||
  baseRegistration.version !== ORIGINAL_VERSION
) {
  throw new Error("The immutable 0.1.0 registration evidence does not match contract 863");
}

const { tenant, tenantDid } = await connectTenantAdmin();
if (tenantDid !== baseRegistration.tenantDid) {
  throw new Error("Authenticated tenant DID does not match the 0.1.0 registration evidence");
}

const result = await tenant.contracts.register({
  tail: CONTRACT_TAIL,
  version: WORKAROUND_VERSION,
  wasm,
});
if (result.name !== EXPECTED_SCRIPT_NAME) {
  throw new Error(`Unexpected registered script name: ${result.name}`);
}

const registration: DiagnosticRegistration = {
  tenantDid,
  tail: CONTRACT_TAIL,
  scriptName: result.name,
  version: WORKAROUND_VERSION,
  contractId: result.contract_id,
  registeredAt: new Date().toISOString(),
  basedOnContractId: EXPECTED_BASE_CONTRACT_ID,
};

await writeFile(
  DIAGNOSTIC_REGISTRATION_PATH,
  `${JSON.stringify(registration, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);

console.log("Diagnostic contract version registered successfully.");
console.log(`scriptName: ${registration.scriptName}`);
console.log(`contract_id: ${registration.contractId}`);
console.log(`version: ${registration.version}`);
console.log(`metadata: ${DIAGNOSTIC_REGISTRATION_PATH}`);
