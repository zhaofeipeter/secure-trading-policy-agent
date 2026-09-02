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

export interface ConnectedDataOwner {
  dataOwnerClient: T3nClient;
  dataOwnerDid: string;
  nodeUrl: string;
}

/** Data-owner connection used only to administer the owner's agent grants. */
export async function connectDataOwner(): Promise<ConnectedDataOwner> {
  setEnvironment("testnet");
  const userKey = process.env.USER_KEY;
  if (!userKey) {
    throw new Error("USER_KEY is required to authorize the agent");
  }

  const nodeUrl = getNodeUrl();
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(userKey);
  const dataOwnerClient = new T3nClient({
    trustAnchor: TESTNET_ONLY_UNSAFE_TRUST_ANCHOR,
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, userKey),
    },
  });

  await dataOwnerClient.handshake();
  const authentication = await dataOwnerClient.authenticate(createEthAuthInput(address));
  return { dataOwnerClient, dataOwnerDid: authentication.value, nodeUrl };
}
