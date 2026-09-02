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

export interface ConnectedTenantAdmin {
  adminClient: T3nClient;
  tenant: TenantClient;
  tenantDid: string;
  nodeUrl: string;
}

/** Administrative connection. Never call this from the agent execution path. */
export async function connectTenantAdmin(): Promise<ConnectedTenantAdmin> {
  setEnvironment("testnet");
  const adminKey = process.env.T3N_API_KEY;
  if (!adminKey) {
    throw new Error("T3N_API_KEY is required for tenant administration");
  }

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
  const tenantDid = authentication.value;
  const tenant = new TenantClient({
    environment: "testnet",
    endpoint: nodeUrl,
    baseUrl: nodeUrl,
    t3n: adminClient,
    tenantDid,
  });
  await tenant.tenant.me();

  return { adminClient, tenant, tenantDid, nodeUrl };
}
