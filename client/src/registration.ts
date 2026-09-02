import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  CONTRACT_TAIL,
  CONTRACT_VERSION,
  type ContractRegistration,
} from "./types.js";

export const REGISTRATION_PATH = fileURLToPath(
  new URL("../contract-registration.json", import.meta.url),
);

export async function readRegistration(): Promise<ContractRegistration> {
  const parsed = JSON.parse(await readFile(REGISTRATION_PATH, "utf8")) as Partial<ContractRegistration>;
  if (
    parsed.tail !== CONTRACT_TAIL ||
    parsed.version !== CONTRACT_VERSION ||
    typeof parsed.tenantDid !== "string" ||
    typeof parsed.scriptName !== "string" ||
    typeof parsed.contractId !== "number" ||
    typeof parsed.registeredAt !== "string"
  ) {
    throw new Error(`Registration record is invalid or not for ${CONTRACT_TAIL}@${CONTRACT_VERSION}`);
  }
  return parsed as ContractRegistration;
}
