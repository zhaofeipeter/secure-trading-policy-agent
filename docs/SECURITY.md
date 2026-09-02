# Security Model

## Principals and credential boundaries

The tenant administrator and trading agent are separate T3N identities with separate credentials.

| Principal | Credential | Permitted project operations |
|---|---|---|
| Tenant administrator | `T3N_API_KEY` | Verify the tenant, register the contract, provision the map, and administer policy |
| Data owner | `USER_KEY` | Grant the agent permission to invoke one contract function |
| Trading agent | `AGENT_KEY` | Invoke `trading-policy@0.1.0::evaluate-trade` |

The live invocation path constructs a plain `T3nClient` from `AGENT_KEY`; it never imports the tenant-admin helper or reads `T3N_API_KEY`. Registration and policy setup construct `TenantClient` through `connectTenantAdmin()`. Agent authorization is a separate, explicit data-owner operation.

The selected onboarding model is a public/self-authenticated agent. A human must create a fresh agent key, fund it with testnet credits, derive its DID, complete the public-agent card/onboarding flow, and then use `USER_KEY` to add a bound grant for exactly `trading-policy@0.1.0::evaluate-trade`. The grant contains no data scopes, read scopes, or outbound hosts.

Consequently, a prompt-injected agent process does not possess the tenant administrative credential and cannot rewrite policy through tenant management APIs. This boundary depends on deploying the processes with genuinely separate secret stores; placing all three keys in one shared environment would defeat that isolation.

## Guarantees within the demo scope

1. The LLM is an untrusted decision proposer. Its output is data, not authorization.
2. The Rust TEE policy contract is the deterministic authority for `ALLOW` or `DENY`.
3. The contract checks caller authorization before reading policy.
4. Policy is read from `z:<trusted-tenant-did>:trading-policy-config`; it is not accepted in the invocation payload.
5. The map is private, the registered business contract is its only configured reader, and it is not a writer. Tenant administration performs controlled policy updates.
6. Money uses unsigned integer cents and confidence uses basis points constrained to `0..=10000`. No floating-point money or confidence comparison exists in the Rust engine.
7. Invalid trade payloads fail closed as `DENY / INVALID_INPUT`. Missing or invalid policy fails the invocation rather than allowing it.
8. The contract imports no HTTP, exchange, signing, wallet, or outbox capability.
9. No real trade execution exists. `ALLOW` is only an authorization result.
10. The contract sets the transaction claims digest to SHA-256 of the decision bytes. This project does not independently retrieve or verify a receipt.

## Testnet-only attestation exception

The client explicitly configures `unsafe_trust_server: true` because the T3N testnet signed manifest was malformed when reproduced during development. This bypasses server attestation verification. It is acceptable only for this testnet demonstration and is not a production security posture.

Production must obtain a valid signed TrustAnchor, verify the server/TEE attestation chain, pin the expected environment, and fail closed on verification failure. Removing the unsafe object without adding valid verification is not sufficient.

## Secret handling

- `T3N_API_KEY`, `AGENT_KEY`, and `USER_KEY` are read only from their respective process environments.
- Source code never prints, serializes, or persists those keys.
- `.env` and `.env.*` are ignored.
- `client/contract-registration.json` and `client/agent-authorization.json` are ignored. They contain identifiers and metadata, not keys.
- Keys must never appear in screenshots, logs, build output, issues, or commits.
- Tenant, data-owner, or agent DID exposure in screenshots should be intentional and documented.

## Important limitations

- The testnet trust bypass means the client cannot cryptographically establish that it is talking to an attested production-grade server.
- `dailyLossUsdCents` is supplied by the caller. A malicious agent could lie about it. Production must derive cumulative loss from trusted protected ledger/accounting state.
- `confidenceBps` is an agent-supplied signal. The contract checks its range and threshold but cannot prove calibration or provenance.
- The authorization script uses the SDK helper implementing the documented `agent-auth-update` flow to preserve unrelated grants, but it does not independently read back and compare the platform's effective authorization decision.
- Policy setup converges the SDK-exposed visibility, ACL, and admin-readable settings. It cannot verify hidden platform state that the SDK does not expose.
- The offline demo duplicates policy rules for presentation and is not a security boundary. Only `demo:live` exercises the deployed TEE contract.
- This proof of concept has not received an independent security audit and must not control real funds.

## Production controls still required

Verified TrustAnchor handling, independently verified transaction receipts, trusted risk/accounting inputs, explicit execution delegation, isolated wallet custody, replay/idempotency controls, rate limits, multi-party approvals, append-only policy and decision reporting, monitoring, incident response, and independent review.
