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

/**
 * TESTNET-ONLY SECURITY EXCEPTION.
 *
 * SDK 5.5.0 requires a trust anchor, while the signed testnet manifest is
 * currently malformed. This explicit opt-out must never be used in production.
 */
export const TESTNET_ONLY_UNSAFE_TRUST_ANCHOR = {
  unsafe_trust_server: true,
} as const;

export interface ConnectedT3n {
  t3n: T3nClient;
  tenant: TenantClient;
  tenantDid: string;
  nodeUrl: string;
}

export async function connectT3n(): Promise<ConnectedT3n> {
  setEnvironment("testnet");

  const apiKey = process.env.T3N_API_KEY;
  if (!apiKey) {
    throw new Error("T3N_API_KEY is required for live T3N operations");
  }

  const nodeUrl = getNodeUrl();
  const wasmComponent = await loadWasmComponent();
  const address = eth_get_address(apiKey);
  const t3n = new T3nClient({
    trustAnchor: TESTNET_ONLY_UNSAFE_TRUST_ANCHOR,
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, apiKey),
    },
  });

  await t3n.handshake();
  const authenticatedDid = await t3n.authenticate(createEthAuthInput(address));
  const tenantDid = authenticatedDid.value;

  const tenant = new TenantClient({
    environment: "testnet",
    endpoint: nodeUrl,
    baseUrl: nodeUrl,
    t3n,
    tenantDid,
  });
  await tenant.tenant.me();

  return { t3n, tenant, tenantDid, nodeUrl };
}
