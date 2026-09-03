# Security Model

## Credential handling and observed identity semantics

The tenant/admin and nominal-agent credential values are different and are consumed by separate modules. In the tested T3N environment, however, they are not separate authenticated principals.

| Operational role | Credential | Project code path |
|---|---|---|
| Tenant/admin | `T3N_API_KEY` | Verify the tenant, register the contract, provision the map, and administer policy |
| Data owner | `USER_KEY` | Grant the agent permission to invoke one contract function |
| Nominal trading agent | `AGENT_KEY` | Invoke the original `trading-policy@0.1.0::evaluate-trade` path |
| Diagnostic live demo | `T3N_API_KEY` | Invoke workaround `trading-policy@0.1.1::evaluate-trade` through `TenantClient` |

The live invocation path constructs a plain `T3nClient` from `AGENT_KEY`; it never imports the tenant-admin helper or reads `T3N_API_KEY`. Registration and policy setup construct `TenantClient` through `connectTenantAdmin()`. Agent authorization is a separate, explicit data-owner operation.

The tested onboarding flow issued a distinct `AGENT_KEY` value, but both it and `T3N_API_KEY` authenticated as `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. A live read-only probe run with only `AGENT_KEY` present successfully called `tenant.me()`, `maps.getStatus`, `maps.entryGet(current)`, and `contracts.listDetailed`.

No tenant control-plane write was probed. These results do not establish whether `AGENT_KEY` can create, update, delete, authorize, revoke, or register anything. They do establish that separate credential values and application modules do not create a demonstrated T3N authorization boundary in this environment. Possible account-scoped credential or onboarding semantics require Terminal 3 clarification.

Operational secret separation still reduces accidental key reuse and keeps admin APIs out of the nominal-agent application module, but it must not be presented as protection enforced by distinct T3N principals.

## Version-specific security boundary

Contract 863 / 0.1.0 is the original intended secure design. It imports `host:interfaces/authorisation@2.1.0` and calls `check-authorized([])` before tenant context, KV access, or business logic. In the tested T3N testnet environment it repeatedly failed with `action.execute` `-32603 Internal error`.

Contract 868 / 0.1.1 is a single-variable diagnostic workaround. It removes that WIT import and entry call while retaining tenant context, KV access, policy logic, response validation, and claims-digest setting. Its live test passed 8/8 scenarios. The evidence strongly isolates the runtime failure to the authorisation/check-authorized path, but does not establish a mathematical proof of causation or a confirmed platform vulnerability.

Because 0.1.1 does not call `check-authorized`, its successful run demonstrates T3N TEE contract execution, private KV-backed deterministic policy evaluation, and ALLOW/DENY behavior only. It does not demonstrate an independent agent principal, cross-principal delegation, or successful authorisation-host enforcement. It must not control real funds.

## Guarantees within the demo scope

1. The LLM is an untrusted decision proposer. Its output is data, not authorization.
2. The Rust TEE policy contract is the deterministic authority for `ALLOW` or `DENY`.
3. The 0.1.0 design checks authorization before reading policy, but did not execute successfully in the tested runtime. Diagnostic 0.1.1 intentionally lacks this check.
4. Policy is read from `z:<trusted-tenant-did>:trading-policy-config`; it is not accepted in the invocation payload.
5. The private map was originally configured for reader 863. A readers-only patch requesting `[863, 868]` was accepted, with no other map field or policy value sent. SDK 5.5.0 cannot read back the effective ACL.
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
- `client/contract-registration.json`, `client/contract-registration-0.1.1.json`, and `client/agent-authorization.json` are ignored. They contain identifiers and metadata, not keys.
- Keys must never appear in screenshots, logs, build output, issues, or commits.
- Tenant, data-owner, or agent DID exposure in screenshots should be intentional and documented.

## Important limitations

- The testnet trust bypass means the client cannot cryptographically establish that it is talking to an attested production-grade server.
- Distinct `T3N_API_KEY` and `AGENT_KEY` values resolved to the same T3N DID, and the nominal-agent key successfully performed tenant control-plane reads. No write authority was tested, so write/admin mutation capability is unknown.
- Workaround contract 868 / 0.1.1 has no `check-authorized` call and therefore supplies no caller-authorization enforcement.
- `dailyLossUsdCents` is supplied by the caller. A malicious agent could lie about it. Production must derive cumulative loss from trusted protected ledger/accounting state.
- `confidenceBps` is an agent-supplied signal. The contract checks its range and threshold but cannot prove calibration or provenance.
- The authorization script uses the SDK helper implementing the documented `agent-auth-update` flow to preserve unrelated grants, but it does not independently read back and compare the platform's effective authorization decision.
- Policy setup converges SDK-exposed settings, but SDK 5.5.0 cannot independently read back reader/writer ACL configuration.
- The offline demo duplicates policy rules for presentation and is not a security boundary. The successful `demo:live:0.1.1` exercises deployed contract 868 but uses the Tenant/Admin path and omits authorization enforcement.
- This proof of concept has not received an independent security audit and must not control real funds.

## Production controls still required

Resolution of the authorisation host/runtime discrepancy, restored and verified caller authorization, verified TrustAnchor handling, independently verified transaction receipts, trusted risk/accounting inputs, explicit execution delegation, isolated wallet custody, replay/idempotency controls, rate limits, multi-party approvals, append-only policy and decision reporting, monitoring, incident response, and independent review.
