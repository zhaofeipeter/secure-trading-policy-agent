# Superteam Submission Draft

## Project

**T3N Secure Trading Policy Agent**

> A deterministic TEE authorization layer between an AI trading agent and execution infrastructure.

## Short summary

AI agents can propose useful trades, but they should not have unlimited authority over enterprise assets. This proof of concept places a deterministic Rust policy contract inside the T3N tenant boundary. A separately authenticated agent submits a `TradeIntent`; the contract verifies caller authorization, reads tenant-owned policy, and returns `ALLOW` or `DENY` with stable reason codes. It never executes a trade.

## Why it is useful

The design separates probabilistic decision-making, deterministic authorization, and policy administration. Prompt injection may change what the model proposes, but the agent runtime holds only `AGENT_KEY`, not `T3N_API_KEY`, and therefore cannot use tenant control-plane APIs to rewrite policy. Limits are evaluated using integer cents and basis points, avoiding floating-point policy comparisons.

## What T3N protects

- Tenant-scoped policy in private map `z:<tenant>:trading-policy-config`
- Deterministic policy evaluation in contract `z:<tenant>:trading-policy`
- Contract-only policy read access through the configured map ACL; the business contract is not a writer
- Separate tenant-admin, data-owner, and agent identities
- A bound agent grant limited to `trading-policy@0.1.0::evaluate-trade`
- A transaction claims digest set by the contract to SHA-256 of the decision bytes

The demo does not independently retrieve or verify a transaction receipt. The current client also uses the explicitly documented unsafe trust-server escape hatch because the signed testnet trust manifest was malformed when reproduced. That is a testnet workaround, not a production security claim.

## Deterministic units

- Money is represented as unsigned integer US-dollar cents: USD 500.00 is `50000`.
- Confidence is represented as basis points in `0..=10000`: 91% is `9100`.
- Inputs use `notionalUsdCents`, `dailyLossUsdCents`, and `confidenceBps`.
- Policy uses `maxTradeNotionalUsdCents`, `maxDailyLossUsdCents`, and `minConfidenceBps`.

## What was built

- Rust `wasm32-wasip2` T3N tenant contract
- Strict integer trade and policy models with stable multi-violation decisions
- Explicit caller authorization check before policy access
- Separate `connectTenantAdmin()`, `connectDataOwner()`, and `connectAgent()` paths
- Guarded contract registration with version fixed at `0.1.0`
- Recoverable policy-map provisioning whose ACL update runs on every setup attempt
- Data-owner `agent-auth-update` script scoped to the one evaluation function and preserving unrelated grants
- Runtime validation of decoded live policy decisions
- Eight-scenario offline and live CLI demo paths
- Architecture, security, reproduced-bug, build, and reproduction documentation

## Future live demo flow (after approval)

1. Build and test the Rust component locally.
2. Manually onboard a public/self-authenticated agent with its own key and DID.
3. Authenticate as tenant admin with `T3N_API_KEY` and register `trading-policy@0.1.0` once.
4. Authenticate as the data owner with `USER_KEY` and grant the agent only `evaluate-trade` permission.
5. Provision/read back the private policy map using the tenant administrator.
6. Invoke the contract with `AGENT_KEY`, validate each decoded response, and show both `ALLOW` and multi-reason `DENY` cases.
7. Emphasize that no exchange is contacted and no trade is placed.

## Links

- GitHub repository: `<ADD_GITHUB_REPOSITORY_URL>`
- Demo video: `<ADD_DEMO_VIDEO_URL>`

## Screenshot checklist

- [ ] WASM release build success
- [ ] Native tests showing the exact test count
- [ ] Native and WASM Clippy success
- [ ] Public-agent onboarding with all keys hidden
- [ ] Contract registration output with admin key hidden
- [ ] Function-scoped authorization output with user and agent keys hidden
- [ ] Policy setup/read-back success
- [ ] Live valid intent returning `ALLOW`
- [ ] Live rejected intent returning multiple reason codes
- [ ] Repository tree and identity architecture diagram
- [ ] Any displayed DID exposure is intentional and documented

## Bugs and DX findings

- The T3N testnet signed trust manifest was malformed when reproduced, requiring a visible testnet-only unsafe opt-out.
- Windows native tests need an explicit MSVC target when this repository defaults Cargo to `wasm32-wasip2`.

Full reproduction, expected/actual behavior, workaround, severity, and qualification are in `docs/BUGS.md`.

## Continued operation

We would continue developing the authorization layer, but would not connect it to real funds in its current proof-of-concept state. `dailyLossUsdCents` and `confidenceBps` are still caller-supplied rather than trusted accounting/model-attestation inputs. Further work includes verified production TrustAnchor handling, independently verified receipts, trusted dynamic risk state, a separately authorized Solana/Jupiter execution adapter, wallet secret isolation, replay controls, multi-party approval, append-only reporting, audited policy administration, and independent security review.
