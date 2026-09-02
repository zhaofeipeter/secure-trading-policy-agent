import {
  T3nClient,
  createEthAuthInput,
  eth_get_address,
  getNodeUrl,
  loadWasmComponent,
  metamask_sign,
  setEnvironment,
} from "@terminal3/t3n-sdk";

import { TESTNET_ONLY_UNSAFE_TRUST_ANCHOR } from "./t3n.js";

export interface ConnectedAgent {
  agentClient: T3nClient;
  agentDid: string;
  nodeUrl: string;
}

/** Agent connection. This module never reads or accepts the tenant admin key. */
export async function connectAgent(): Promise<ConnectedAgent> {
  setEnvironment("testnet");
  const agentKey = process.env.AGENT_KEY;
  if (!agentKey) {
    throw new Error("AGENT_KEY is required for live agent execution");
  }

  const nodeUrl = getNodeUrl();
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(agentKey);
  const agentClient = new T3nClient({
    trustAnchor: TESTNET_ONLY_UNSAFE_TRUST_ANCHOR,
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, agentKey),
    },
  });

  await agentClient.handshake();
  const authentication = await agentClient.authenticate(createEthAuthInput(address));
  return { agentClient, agentDid: authentication.value, nodeUrl };
}
