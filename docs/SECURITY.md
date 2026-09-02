# Security Model

## Credential handling and observed identity semantics

The tenant/admin and nominal-agent credential values are different and are consumed by separate modules. In the tested T3N environment, however, they are not separate authenticated principals.

| Operational role | Credential | Project code path |
|---|---|---|
| Tenant/admin | `T3N_API_KEY` | Verify the tenant, register the contract, provision the map, and administer policy |
| Data owner | `USER_KEY` | Grant the agent permission to invoke one contract function |
| Nominal trading agent | `AGENT_KEY` | Invoke `trading-policy@0.1.0::evaluate-trade` through the demo code path |

The live invocation path constructs a plain `T3nClient` from `AGENT_KEY`; it never imports the tenant-admin helper or reads `T3N_API_KEY`. Registration and policy setup construct `TenantClient` through `connectTenantAdmin()`. Agent authorization is a separate, explicit data-owner operation.

The tested onboarding flow issued a distinct `AGENT_KEY` value, but both it and `T3N_API_KEY` authenticated as `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. A live read-only probe run with only `AGENT_KEY` present successfully called `tenant.me()`, `maps.getStatus`, `maps.entryGet(current)`, and `contracts.listDetailed`.

No tenant control-plane write was probed. These results do not establish whether `AGENT_KEY` can create, update, delete, authorize, revoke, or register anything. They do establish that separate credential values and application modules do not create a demonstrated T3N authorization boundary in this environment. Possible account-scoped credential or onboarding semantics require Terminal 3 clarification.

Operational secret separation still reduces accidental key reuse and keeps admin APIs out of the nominal-agent application module, but it must not be presented as protection enforced by distinct T3N principals.

## Guarantees within the demo scope

1. The LLM is an untrusted decision proposer. Its output is data, not authorization.
2. The Rust TEE policy contract is the deterministic authority for `ALLOW` or `DENY`.
3. The contract checks authorization before reading policy. This remains a useful TEE policy gate even though the tested invocation is a self/shared-DID authorization flow rather than demonstrated cross-principal delegation.
4. Policy is read from `z:<trusted-tenant-did>:trading-policy-config`; it is not accepted in the invocation payload.
5. The map is private, the registered business contract is its only configured reader, and it is not a writer. Tenant administration performs controlled policy updates.
6. Money uses unsigned integer cents and confidence uses basis points constrained to `0..=10000`. No floating-point money or confidence comparison exists in the Rust engine.
7. Invalid trade payloads fail closed as `DENY / INVALID_INPUT`. Missing or invalid policy fails the invocation rather than allowing it.
8. The contract imports no HTTP, exchange, signing, wallet, or outbox capability.
9. No real trade execution exists. `ALLOW` is only an authorization result.
10. The contract sets the transaction claims digest to SHA-256 of the decision bytes. This project does not independently retrieve or verify a receipt.

## Testnet-only attestation exception

The client explicitly configures `unsafe_trust_server: true` because the T3N testnet signed manifest was malformed when reproduced during development. A live read-only recheck on 2026-09-02 still returned `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.` This bypasses server attestation verification. It is acceptable only for this testnet demonstration and is not a production security posture.

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
- Distinct `T3N_API_KEY` and `AGENT_KEY` values resolved to the same T3N DID, and the nominal-agent key successfully performed tenant control-plane reads. No write authority was tested, so write/admin mutation capability is unknown.
- `dailyLossUsdCents` is supplied by the caller. A malicious agent could lie about it. Production must derive cumulative loss from trusted protected ledger/accounting state.
- `confidenceBps` is an agent-supplied signal. The contract checks its range and threshold but cannot prove calibration or provenance.
- The authorization script uses the SDK helper implementing the documented `agent-auth-update` flow to preserve unrelated grants, but it does not independently read back and compare the platform's effective authorization decision.
- Policy setup converges the SDK-exposed visibility, ACL, and admin-readable settings. It cannot verify hidden platform state that the SDK does not expose.
- The offline demo duplicates policy rules for presentation and is not a security boundary. Only `demo:live` exercises the deployed TEE contract.
- This proof of concept has not received an independent security audit and must not control real funds.

## Production controls still required

Verified TrustAnchor handling, independently verified transaction receipts, trusted risk/accounting inputs, explicit execution delegation, isolated wallet custody, replay/idempotency controls, rate limits, multi-party approvals, append-only policy and decision reporting, monitoring, incident response, and independent review.
