# Superteam Submission — T3N Secure Trading Policy Agent

## Project

**T3N Secure Trading Policy Agent**

> A deterministic TEE authorization layer between an AI trading agent and execution infrastructure.

## Short summary

AI agents can propose useful trades, but they should not have unlimited authority over enterprise assets. This proof of concept places deterministic Rust policy evaluation inside the T3N tenant boundary. The live T3N TEE demo reads tenant-owned policy and returns `ALLOW` or `DENY` with stable reason codes across eight scenarios. It never executes a trade.

## Why it is useful

The design separates probabilistic trade proposals from deterministic policy enforcement. Prompt injection may change what a model proposes, but cannot change the Rust rules or tenant-owned policy consumed by the contract. Limits use integer cents and basis points, avoiding floating-point policy comparisons. The repository also records a reproducible T3N host-compatibility finding instead of hiding it: the intended authorisation-bearing version fails at runtime, while a single-variable diagnostic version executes successfully.

## What T3N protects

- Tenant-scoped policy in private map `z:<tenant>:trading-policy-config`
- Deterministic policy evaluation in contract `z:<tenant>:trading-policy`
- Private policy-map access requested for contract IDs 863 and 868; the business contracts are not writers
- Separate Tenant/Admin, data-owner, and Nominal Agent credential paths in application code
- A shared observed T3N DID for the tested Tenant/Admin and Nominal Agent credentials; no security boundary is claimed between them
- An original bound agent grant limited to `trading-policy@0.1.0::evaluate-trade`; that version did not execute successfully in the tested runtime
- A transaction claims digest set by the contract to SHA-256 of the decision bytes

SDK 5.5.0 does not expose map ACL readback, so the accepted readers-only update response `{}` is not claimed as independent ACL verification. The demo also does not independently retrieve or verify a transaction receipt. The client uses the SDK's unsafe trust-server escape hatch because the signed testnet trust manifest was malformed when reproduced. A read-only recheck on 2026-09-02 still returned `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.` This is a testnet-only workaround, not a production security claim.

## Deterministic units

- Money is represented as unsigned integer US-dollar cents: USD 500.00 is `50000`.
- Confidence is represented as basis points in `0..=10000`: 91% is `9100`.
- Inputs use `notionalUsdCents`, `dailyLossUsdCents`, and `confidenceBps`.
- Policy uses `maxTradeNotionalUsdCents`, `maxDailyLossUsdCents`, and `minConfidenceBps`.

## What was built

- Rust `wasm32-wasip2` T3N tenant contract
- Strict integer trade and policy models with stable multi-violation decisions
- Original 0.1.0 caller-authorization design, preserved as immutable contract 863 evidence
- Single-variable 0.1.1 diagnostic workaround, registered separately as contract 868
- Separate `connectTenantAdmin()`, `connectDataOwner()`, and `connectAgent()` paths
- Guarded, version-specific registration helpers that preserve existing metadata
- Recoverable policy-map provisioning whose ACL update runs on every setup attempt
- Data-owner authorization using the SDK helper implementing the documented `agent-auth-update` flow, scoped to one function and preserving unrelated grants
- Runtime validation of decoded live policy decisions
- Eight-scenario offline harness and a live 0.1.1 TenantClient demo with runtime response validation
- Architecture, security, reproduced-bug, build, and reproduction documentation

## Architecture and live evidence

Two immutable versions under tail `trading-policy` provide a controlled comparison:

| Contract | Design | Testnet result |
|---|---|---|
| 863 / 0.1.0 | Imports `host:interfaces/authorisation@2.1.0`; calls `check-authorized([])` before KV | Repeated `action.execute` `-32603 Internal error` |
| 868 / 0.1.1 | Removes only the authorisation import/call; preserves tenant context, KV, policy logic, response shape, and claims digest | Live T3N TEE demo passed 8/8 |

The successful live results were:

1. valid SOL buy → `ALLOW`
2. valid BTC sell → `ALLOW`
3. unsupported token → `DENY / SYMBOL_NOT_ALLOWED`
4. unsupported venue → `DENY / VENUE_NOT_ALLOWED`
5. oversized SOL trade → `DENY / NOTIONAL_LIMIT_EXCEEDED`
6. low-confidence trade → `DENY / CONFIDENCE_TOO_LOW`
7. daily loss exceeded → `DENY / DAILY_LOSS_LIMIT_EXCEEDED`
8. multiple simultaneous violations → `DENY` with all six expected ordered reasons

No exchange was contacted and no real trade was executed.

The evidence strongly isolates the 0.1.0 failure to the `host:interfaces/authorisation@2.1.0` / `check-authorized` path in the tested T3N testnet environment. Local WIT compiles and contract registration succeeds, but runtime execution returns `-32603`; removing the dependency makes the otherwise equivalent contract execute. This appears to be a host-surface/runtime compatibility discrepancy. It is not presented as mathematical proof or a confirmed T3N security vulnerability.

## Run locally

```powershell
git clone https://github.com/zhaofeipeter/secure-trading-policy-agent.git
cd secure-trading-policy-agent\client
npm install
npm run typecheck
npm run test:parser
npm run demo
```

The offline demo prints all eight deterministic decisions without contacting T3N. The recorded live result used the already registered contract 868 and `npm run demo:live:0.1.1`; registration, setup, authorization, and map mutation are not prerequisites to rerun as part of the public local demo.

## Links

- GitHub repository: https://github.com/zhaofeipeter/secure-trading-policy-agent
- Live evidence and exact integration notes: https://github.com/zhaofeipeter/secure-trading-policy-agent/blob/fix/cto-review-remediation/docs/BUILD_LOG.md
- Reproducible T3N findings: https://github.com/zhaofeipeter/secure-trading-policy-agent/blob/fix/cto-review-remediation/docs/BUGS.md

## Screenshot checklist

- [ ] WASM release build success
- [ ] Native tests showing the exact test count
- [ ] Native and WASM Clippy success
- [ ] Credential onboarding/claim evidence with all keys hidden
- [ ] Original contract ID `863` / 0.1.0 failure with request ID visible and credentials hidden
- [ ] Diagnostic contract ID `868` / 0.1.1
- [ ] Function-scoped authorization output with user and agent keys hidden
- [ ] Policy setup/read-back success
- [ ] Live 0.1.1 valid intent returning `ALLOW`
- [ ] Live 0.1.1 rejected intent returning multiple reason codes
- [ ] Repository tree and identity architecture diagram
- [ ] Any displayed DID exposure is intentional and documented

## Bugs and DX findings

- The T3N testnet signed trust manifest was malformed when reproduced, requiring a visible testnet-only unsafe opt-out.
- Different Tenant/Admin and Nominal Agent credential values resolved to the same T3N DID, and the Nominal Agent credential could perform tenant control-plane reads. No write permission was tested; this is recorded as a documentation/runtime or onboarding-semantics discrepancy requiring Terminal 3 clarification, not as a confirmed platform vulnerability.
- The authorisation-bearing 0.1.0 contract repeatedly returned `-32603`, while otherwise equivalent 0.1.1 succeeded after the authorisation dependency was removed. This is recorded as a likely host-surface/runtime compatibility discrepancy, not a confirmed vulnerability.
- SDK 5.5.0 has no reader/writer ACL readback API; the accepted readers-only update is not represented as independent ACL verification.
- Windows native tests need an explicit MSVC target when this repository defaults Cargo to `wasm32-wasip2`.

Full reproduction, expected/actual behavior, workaround, severity, and qualification are in `docs/BUGS.md`.

## Continued operation

Version 0.1.1 is a diagnostic/workaround contract. Because it removes `check-authorized`, its successful run demonstrates T3N TEE execution, deterministic private-KV-backed policy enforcement, and ALLOW/DENY decisions; it does not demonstrate independent agent-principal isolation or successful caller authorization. We would not connect either version to real funds in the current proof-of-concept state. `dailyLossUsdCents` and `confidenceBps` are caller-supplied rather than trusted accounting/model-attestation inputs. Further work includes resolving the authorisation host discrepancy, restoring verified caller authorization, verified production TrustAnchor handling, independently verified receipts, trusted dynamic risk state, a separately authorized execution adapter, wallet secret isolation, replay controls, multi-party approval, append-only reporting, audited policy administration, and independent security review.
