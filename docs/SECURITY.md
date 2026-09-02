# Security Model

## Guarantees within the demo scope

1. The LLM is an untrusted decision proposer. Its output is data, not authorization.
2. The Rust TEE policy contract is the deterministic authority for `ALLOW` or `DENY`.
3. Prompt injection cannot alter the configured policy because policy is read from tenant-scoped KV and is not accepted in the invocation payload.
4. No exchange key or wallet key is exposed to the LLM. No exchange or wallet credential is required anywhere in the project.
5. No real trade execution exists. An `ALLOW` is only an authorization result.
6. Invalid trade payloads fail closed as `DENY / INVALID_INPUT`. Missing or invalid policy fails the invocation rather than allowing it.
7. The contract imports no HTTP, signing, wallet, exchange, or outbox capability.
8. Live decision bytes are committed as a SHA-256 claims digest for receipt/ledger correlation.

## TESTNET-ONLY attestation exception

The client explicitly configures `unsafe_trust_server: true` because SDK 5.5.0 requires `trustAnchor` and the T3N testnet signed manifest was malformed during development. This bypasses server attestation verification. It is acceptable only for this testnet demonstration and is not a production security posture.

Production must obtain a valid signed TrustAnchor, verify the server/TEE attestation chain, pin the expected environment, and fail closed on verification failure. Removing the unsafe object without adding valid verification is not sufficient.

## Secret handling

- `T3N_API_KEY` is read only from the process environment.
- Code never prints, interpolates, serializes, or persists the API key.
- `.env` and `.env.*` are ignored.
- `client/contract-registration.json` is ignored because it contains a tenant DID, even though it contains no API key.
- API keys must never appear in screenshots, logs, build output, issues, or commits.
- Tenant DID exposure in screenshots should be intentional and documented.

## Important limitations

- The testnet trust bypass means the client cannot cryptographically know it is talking to an attested production-grade server.
- `dailyLossUsd` is supplied by the caller in v1. A malicious agent could lie about it. Production must derive cumulative loss from trusted ledger/accounting state inside T3N.
- Confidence is an agent-supplied signal. The contract only checks its numeric threshold; it cannot prove calibration or provenance.
- Policy setup is a bootstrap CLI, not a complete enterprise administration system with approvals and change history.
- The local demo harness duplicates the rules for offline presentation and is not a security boundary. Only `demo:live` exercises the TEE contract.
- This proof of concept has not received an independent security audit and must not control real funds.

## Production controls still required

Verified TrustAnchor handling, authenticated policy administration, trusted risk/accounting inputs, explicit execution delegation, isolated wallet custody, replay/idempotency controls, rate limits, multi-party approvals, append-only policy/decision reporting, monitoring, incident response, and independent review.
