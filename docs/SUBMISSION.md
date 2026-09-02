# Superteam Submission Draft

## Project

**T3N Secure Trading Policy Agent**

> A deterministic TEE authorization layer between an AI trading agent and execution infrastructure.

## Short summary

AI agents can propose useful trades, but they should not have unlimited authority over enterprise assets. This proof of concept puts a deterministic Rust policy contract inside the T3N tenant boundary. An agent submits a `TradeIntent`; the contract reads tenant-owned policy, returns `ALLOW` or `DENY` with stable reason codes, and binds the response digest to the T3N transaction. It never executes a trade.

## Why it is useful

The design separates probabilistic decision-making from deterministic authorization. Prompt injection or hallucination may change what the model proposes, but it cannot change which symbols and venues are allowed, the configured notional and daily-loss limits, or the confidence threshold stored in the tenant policy map.

## What T3N protects

- Tenant-scoped policy stored in a private `z:<tenant>:trading-policy` map
- Deterministic policy evaluation in a Rust WASM contract
- Contract-only policy read access through a scoped map ACL
- An authenticated tenant identity obtained from the T3N session rather than hardcoded source
- A SHA-256 decision claims digest associated with the contract transaction

The current testnet client uses the explicitly documented unsafe trust-server escape hatch because the signed testnet trust manifest is malformed. This is a testnet integration workaround, not a production claim.

## What was built

- Rust `wasm32-wasip2` T3N tenant contract
- Strict trade and policy models
- Stable multi-violation policy engine with more than nine native tests
- TypeScript SDK connection helper
- Guarded contract registration and local deployment metadata
- Idempotent, read-back-verified private policy setup
- Eight-scenario offline and live CLI demo paths
- Architecture, security, bugs/DX, build, and reproduction documentation

## Demo flow

1. Build and test the Rust component.
2. Authenticate to T3N testnet with `T3N_API_KEY`.
3. Register `trading-policy@0.1.0` once.
4. Create a private policy map and store the deterministic demo policy.
5. Submit valid and invalid trade intents.
6. Show `ALLOW`/`DENY` and all applicable reason codes.
7. Emphasize that no exchange is contacted and no trade is placed.

## Links

- GitHub repository: `<ADD_GITHUB_REPOSITORY_URL>`
- Demo video: `<ADD_DEMO_VIDEO_URL>`

## Screenshot checklist

- [ ] WASM release build success
- [ ] Native tests showing the exact test count
- [ ] Native and WASM Clippy success
- [ ] Contract registration output with API key hidden
- [ ] Policy setup/read-back success
- [ ] Live valid intent returning `ALLOW`
- [ ] Live rejected intent returning multiple reason codes
- [ ] Repository tree and architecture diagram
- [ ] If showing a tenant DID, document that exposure as intentional; never show an API key

## Bugs and DX findings

- Package naming mismatch in some guidance (`t3n-adk` vs the working `t3n-sdk` package)
- SDK 5.5.0 requires an explicit `trustAnchor`
- Testnet signed trust manifest was malformed, requiring a visible testnet-only unsafe opt-out
- Windows native tests require an explicit MSVC target when Cargo defaults to `wasm32-wasip2`

Full reproductions, expected/actual behavior, workarounds, and severity are in `docs/BUGS.md`.

## Continued operation

Yes, we would continue developing the authorization layer, but we would not operate it against real funds in its current proof-of-concept state. The next steps are verified production TrustAnchor handling, trusted dynamic risk/accounting state, a separately authorized Solana/Jupiter execution adapter, wallet secret isolation, multi-agent approvals, append-only decision audit tooling, and enterprise policy administration.
