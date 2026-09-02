/**
 * TESTNET-ONLY SECURITY EXCEPTION.
 *
 * SDK 5.5.0 requires a trust anchor, while the signed testnet manifest is
 * currently malformed. This explicit opt-out must never be used in production.
 */
export const TESTNET_ONLY_UNSAFE_TRUST_ANCHOR = {
  unsafe_trust_server: true,
} as const;
