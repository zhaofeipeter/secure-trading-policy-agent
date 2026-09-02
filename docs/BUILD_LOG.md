# Build Log

Date: 2026-09-02  
Environment: Windows 11, PowerShell, T3N testnet configuration

## CTO remediation inspection

Before implementation, the current Terminal 3 Quickstart, Agent Auth, Invoke Contract, Public Agent, and Organization-owned Agent documentation was reviewed together with installed `@terminal3/t3n-sdk@5.5.0` declarations and the vendored WIT.

The selected model is a public/self-authenticated agent because the existing tenant is an individual tenant and no organization-owned-agent requirement was supplied. The resulting separation is:

- tenant administration: `T3N_API_KEY` through `connectTenantAdmin()`
- data-owner grant bootstrap: `USER_KEY` plus public `AGENT_DID` through `connectDataOwner()`
- business invocation: `AGENT_KEY` through `connectAgent()`

The current Agent Auth guide documents a data-owner-signed `agent-auth-update`. SDK 5.5.0 confirms `updateAgentAuth` as the SDK helper implementing that documented flow, plus agent-side contract execution. The helper preserves unrelated grant rows instead of replacing the entire policy. The vendored `host:interfaces/authorisation@2.1.0` WIT confirms `check-authorized(list<string>)`, and the remediated WASM build validates the Rust binding and empty-host call locally.

## Trust-anchor finding

SDK 5.5.0 exposes the `fetchTrustedManifest("testnet")` path. In an earlier reproduced attempt, the SDK reported that the testnet manifest response was malformed. This project therefore isolates `{ unsafe_trust_server: true }` as an explicit testnet-only workaround. It disables server attestation verification and is not production-safe. Remote state may have changed and must be rechecked before live deployment.

## Remediation QA

These are commands actually run after the CTO changes.

| Check | Command | Result |
|---|---|---|
| Rust format | `cargo fmt --all -- --check` | Passed, no diff |
| Rust WASM release | `cargo build --target wasm32-wasip2 --release` | Passed |
| Rust native tests | `cargo test --lib --target x86_64-pc-windows-msvc` | Passed: 17 passed, 0 failed |
| Rust native Clippy | `cargo clippy --all-targets --target x86_64-pc-windows-msvc -- -D warnings` | Passed, zero warnings |
| Rust WASM Clippy | `cargo clippy --target wasm32-wasip2 --release -- -D warnings` | Passed, zero warnings |
| Client install | `npm install` | Passed: up to date, 23 packages audited, 0 vulnerabilities |
| TypeScript | `npm run typecheck` | Passed |
| Policy-decision parser | `npm run test:parser` | Passed: 6/6 protocol assertions |
| Offline demo | `npm run demo` | Passed: 8/8 deterministic scenarios |
| Static unit/field scan | `rg` over Rust/TypeScript source excluding dependencies and build output | No Rust `f32`/`f64`, legacy wire fields, or blind `as PolicyDecision` cast |
| Secret scan | `rg` over tracked project content excluding dependencies and build output | No T3N-key-shaped or 64-hex-private-key value found |
| Patch whitespace | `git diff --check` | Passed; only Git's Windows line-ending notices |

The release component is 153,836 bytes with SHA-256 `860D752EA211698440732E8AD7E85F08A54D2FC20FD137E678BECE7F42ABE3D8`.

## Live-mutation status

No live command was run during CTO remediation:

- `npm run register` was not run.
- `npm run authorize` was not run.
- `npm run setup` was not run.
- `npm run demo:live` was not run.

No contract was registered, no contract ID was generated, no delegation grant or policy map was written, and no local registration/authorization record exists. Version remains `0.1.0`. No real exchange, wallet, market-data service, or funds are used by any project command.

## Remaining live uncertainties

- The testnet trust manifest should be retried before registration because remote state may have changed; production cannot use the unsafe fallback.
- The compiled WIT and SDK types confirm `check-authorized([])` for a no-egress contract, but this exact bound-grant/empty-host path has not yet been exercised end to end on testnet.
- The SDK exposes convergent map updates but not a typed full-map metadata read through `TenantMapsNamespace`; setup reapplies desired ACL properties and verifies the policy entry rather than claiming full ACL read-back.
- Receipt retrieval and independent claims-digest verification are not implemented.
