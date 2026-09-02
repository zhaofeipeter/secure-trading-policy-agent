import { writeFile } from "node:fs/promises";

import { type AgentAuthScriptGrant } from "@terminal3/t3n-sdk";

import { AUTHORIZATION_PATH } from "./authorization.js";
import { connectDataOwner } from "./data-owner.js";
import { readRegistration } from "./registration.js";
import {
  CONTRACT_VERSION,
  EVALUATE_TRADE_FUNCTION,
  type AgentAuthorization,
} from "./types.js";

const agentDid = process.env.AGENT_DID;
if (!agentDid || !/^did:t3n:[a-fA-F0-9]{40}$/.test(agentDid)) {
  throw new Error(
    "AGENT_DID must be the session-derived did:t3n identifier for the nominal agent credential",
  );
}

const registration = await readRegistration();
const { dataOwnerClient, dataOwnerDid } = await connectDataOwner();
const grant: AgentAuthScriptGrant = {
  scriptName: registration.scriptName,
  versionReq: CONTRACT_VERSION,
  functions: [EVALUATE_TRADE_FUNCTION],
  scopes: [],
  readScopes: [],
  allowedHosts: [],
};

// The current public Agent Auth flow writes agent-auth-update as the data owner.
// This SDK helper performs that documented update as a read/merge/write so grants
// for other agents and contracts are preserved.
await dataOwnerClient.updateAgentAuth(agentDid, grant);

const authorization: AgentAuthorization = {
  agentDid,
  dataOwnerDid,
  scriptName: registration.scriptName,
  version: CONTRACT_VERSION,
  functionName: EVALUATE_TRADE_FUNCTION,
  authorizedAt: new Date().toISOString(),
};
await writeFile(AUTHORIZATION_PATH, `${JSON.stringify(authorization, null, 2)}\n`, "utf8");

console.log("Agent authorization configured.");
console.log(`agentDid: ${agentDid}`);
console.log(`dataOwnerDid: ${dataOwnerDid}`);
console.log(`permission: ${registration.scriptName}@${CONTRACT_VERSION}::${EVALUATE_TRADE_FUNCTION}`);
console.log(`metadata: ${AUTHORIZATION_PATH}`);
