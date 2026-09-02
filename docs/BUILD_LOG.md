# Build Log

Date: 2026-09-02  
Environment: Windows 11, PowerShell, T3N testnet configuration

## CTO remediation inspection

Before implementation, the current Terminal 3 Quickstart, Agent Auth, Invoke Contract, Public Agent, and Organization-owned Agent documentation was reviewed together with installed `@terminal3/t3n-sdk@5.5.0` declarations and the vendored WIT.

The selected model is a public/self-authenticated agent because the existing tenant is an individual tenant and no organization-owned-agent requirement was supplied. The resulting operational credential paths are:

- tenant administration: `T3N_API_KEY` through `connectTenantAdmin()`
- data-owner grant bootstrap: `USER_KEY` plus public `AGENT_DID` through `connectDataOwner()`
- business invocation: `AGENT_KEY` through `connectAgent()`

These paths separate credential handling in the application, but they do not establish separate T3N principals in the tested environment. On 2026-09-02, the different `T3N_API_KEY` and separately issued `AGENT_KEY` values both authenticated as `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. The read-only results are recorded below.

The current Agent Auth guide documents a data-owner-signed `agent-auth-update`. SDK 5.5.0 confirms `updateAgentAuth` as the SDK helper implementing that documented flow, plus agent-side contract execution. The helper preserves unrelated grant rows instead of replacing the entire policy. The vendored `host:interfaces/authorisation@2.1.0` WIT confirms `check-authorized(list<string>)`, and the remediated WASM build validates the Rust binding and empty-host call locally.

## Trust-anchor finding

SDK 5.5.0 exposes the `fetchTrustedManifest("testnet")` path. On 2026-09-02, the read-only live probe still returned `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.` This project therefore isolates `{ unsafe_trust_server: true }` as an explicit testnet-only workaround. It disables server attestation verification and is not production-safe. Remote state may change and must be rechecked before live deployment.

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

## Live state and read-only probe

Contract `trading-policy@0.1.0` is already registered as contract ID `863`. That registration predates this read-only probe. The probe performed no mutation and did not run any of the following commands:

- `npm run register` was not run.
- `npm run authorize` was not run.
- `npm run setup` was not run.
- `npm run demo:live` was not run.

The probe used only `AGENT_KEY`, with `T3N_API_KEY` and `USER_KEY` absent. Agent authentication, node handshake/session establishment, a plain identity read, `TenantClient` construction, `tenant.me()`, `maps.getStatus`, `maps.entryGet(current)`, and `contracts.listDetailed` all succeeded. Both the Tenant/Admin credential and the Nominal Agent credential resolved to the shared observed T3N DID `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. The final probe classification was `SHARED_TENANT_PRIVILEGE`.

No tenant control-plane write was tested, so this result does not establish whether the Nominal Agent credential has write or administrative mutation authority. It does establish that credential-value and application-module separation is not a demonstrated T3N authorization boundary in this environment. No real exchange, wallet, market-data service, or funds are used by any project command.

## Remaining live uncertainties

- The testnet trust manifest must be rechecked before production deployment because remote state may change; production cannot use the unsafe fallback.
- The reason that two different credential values resolve to the same DID, and the extent of the Nominal Agent credential's tenant permissions, require clarification from Terminal 3. No write probe should be used to answer that question in this environment.
- The compiled WIT and SDK types confirm `check-authorized([])` for a no-egress contract, but the next live authorization test is a self/shared-DID authorization flow, not proof of cross-principal delegation.
- The SDK exposes convergent map updates but not a typed full-map metadata read through `TenantMapsNamespace`; setup reapplies desired ACL properties and verifies the policy entry rather than claiming full ACL read-back.
- Receipt retrieval and independent claims-digest verification are not implemented.
