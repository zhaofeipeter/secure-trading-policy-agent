import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  EVALUATE_TRADE_FUNCTION,
  ORIGINAL_VERSION,
  type AgentAuthorization,
} from "./types.js";

export const AUTHORIZATION_PATH = fileURLToPath(
  new URL("../agent-authorization.json", import.meta.url),
);

export async function readAgentAuthorization(): Promise<AgentAuthorization> {
  const parsed = JSON.parse(await readFile(AUTHORIZATION_PATH, "utf8")) as Partial<AgentAuthorization>;
  if (
    typeof parsed.agentDid !== "string" ||
    typeof parsed.dataOwnerDid !== "string" ||
    typeof parsed.scriptName !== "string" ||
    parsed.version !== ORIGINAL_VERSION ||
    parsed.functionName !== EVALUATE_TRADE_FUNCTION ||
    typeof parsed.authorizedAt !== "string"
  ) {
    throw new Error("Agent authorization record is malformed or for a different contract function");
  }
  return parsed as AgentAuthorization;
}
