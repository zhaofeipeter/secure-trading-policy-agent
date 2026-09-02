# Build Log

Dates: 2026-09-02 through 2026-09-03
Environment: Windows 11, PowerShell, T3N testnet configuration

## CTO remediation inspection

Before implementation, the current Terminal 3 Quickstart, Agent Auth, Invoke Contract, Public Agent, and Organization-owned Agent documentation was reviewed together with installed `@terminal3/t3n-sdk@5.5.0` declarations and the vendored WIT.

The selected model is a public/self-authenticated agent because the existing tenant is an individual tenant and no organization-owned-agent requirement was supplied. The resulting operational credential paths are:

- tenant administration: `T3N_API_KEY` through `connectTenantAdmin()`
- data-owner grant bootstrap: `USER_KEY` plus public `AGENT_DID` through `connectDataOwner()`
- business invocation: `AGENT_KEY` through `connectAgent()`

These paths separate credential handling in the application, but they do not establish separate T3N principals in the tested environment. On 2026-09-02, the different `T3N_API_KEY` and separately issued `AGENT_KEY` values both authenticated as `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. The read-only results are recorded below.

The current Agent Auth guide documents a data-owner-signed `agent-auth-update`. SDK 5.5.0 confirms `updateAgentAuth` as the SDK helper implementing that documented flow, plus agent-side contract execution. The helper preserves unrelated grant rows instead of replacing the entire policy. The vendored `host:interfaces/authorisation@2.1.0` WIT confirms `check-authorized(list<string>)`, and the original 0.1.0 WASM validates that the Rust binding and empty-host call compile locally. That does not establish that the testnet runtime supports the imported host surface.

## Trust-anchor finding

SDK 5.5.0 exposes the `fetchTrustedManifest("testnet")` path. On 2026-09-02, the read-only live probe still returned `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.` This project therefore isolates `{ unsafe_trust_server: true }` as an explicit testnet-only workaround. It disables server attestation verification and is not production-safe. Remote state may change and must be rechecked before live deployment.

## Pre-live remediation QA for 0.1.0

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

The original 0.1.0 release component was 153,836 bytes with SHA-256 `860D752EA211698440732E8AD7E85F08A54D2FC20FD137E678BECE7F42ABE3D8`.

## Live identity and privilege probe

Contract `trading-policy@0.1.0` was registered as contract ID `863` before this read-only probe. The probe itself performed no mutation and did not run any of the following commands:

- `npm run register` was not run.
- `npm run authorize` was not run.
- `npm run setup` was not run.
- `npm run demo:live` was not run.

The probe used only `AGENT_KEY`, with `T3N_API_KEY` and `USER_KEY` absent. Agent authentication, node handshake/session establishment, a plain identity read, `TenantClient` construction, `tenant.me()`, `maps.getStatus`, `maps.entryGet(current)`, and `contracts.listDetailed` all succeeded. Both the Tenant/Admin credential and the Nominal Agent credential resolved to the shared observed T3N DID `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. The final probe classification was `SHARED_TENANT_PRIVILEGE`.

No tenant control-plane write was tested, so this result does not establish whether the Nominal Agent credential has write or administrative mutation authority. It does establish that credential-value and application-module separation is not a demonstrated T3N authorization boundary in this environment. No real exchange, wallet, market-data service, or funds are used by any project command.

## Contract execution investigation

### Original 863 / 0.1.0

The 0.1.0 component imports:

- `host:interfaces/authorisation@2.1.0`
- `host:tenant/tenant-context@1.0.0`
- `host:interfaces/kv-store@2.1.0`

Its entry path calls `check-authorized([])` before tenant-context lookup, KV access, or policy logic. Registration and map setup succeeded, but `action.execute` repeatedly returned `-32603 Internal error`. Recorded request IDs include:

- `845e1326-2722-4f8c-86c8-eecb2664c833`
- `2b1da316-fd54-48bb-9cd7-c36c9f5ccd78`
- `8d1de50a-650c-4715-90dc-9cece37915a0`

Both `contract_id` / `contract_version` and `script_name` / `script_version` client payload experiments failed. Direct `TenantClient.contracts.execute("trading-policy", ...)` also failed, which removed the nominal-agent invocation wrapper as the primary explanation.

### Diagnostic 868 / 0.1.1

Version 0.1.1 is a strict single-variable diagnostic: it removes `host:interfaces/authorisation@2.1.0` and the entry `check-authorized([])` call. Tenant context, `kv-store.get`, `kv-store.set-claims-digest`, data structures, map name/key, and policy logic are unchanged. The component is 152,218 bytes with SHA-256 `1B5D75C3B8AE031535E180F52510C9B23BF50BC88E71232A27694635F0733DAB`.

Contract 868 was registered separately without overwriting 863. A patch-only SDK call requested readers `{ only: [863, 868] }` for `trading-policy-config` and returned `{}`. No other map field and no policy value was sent. SDK 5.5.0 has no ACL readback API, so the effective reader list was not independently retrieved.

Direct tenant execution of 0.1.1 succeeded. The full `demo:live:0.1.1` run then passed all eight deterministic fixtures:

1. valid SOL buy — `ALLOW`
2. valid BTC sell — `ALLOW`
3. unsupported token — `DENY / SYMBOL_NOT_ALLOWED`
4. unsupported venue — `DENY / VENUE_NOT_ALLOWED`
5. oversized SOL trade — `DENY / NOTIONAL_LIMIT_EXCEEDED`
6. low-confidence trade — `DENY / CONFIDENCE_TOO_LOW`
7. daily loss exceeded — `DENY / DAILY_LOSS_LIMIT_EXCEEDED`
8. multiple violations — `DENY` with all six expected ordered reasons

No exchange was contacted and no trade was executed.

The evidence strongly isolates the failure to the `host:interfaces/authorisation@2.1.0` / `check-authorized` path in the tested T3N testnet environment. It appears to be a host-surface/runtime compatibility discrepancy. This is not mathematical proof of causation or a confirmed T3N security vulnerability. Because 0.1.1 omits the authorization check, its successful run is not evidence of separate agent/data-owner authorization or cross-principal delegation.

## Final pre-commit QA

No live script was part of final QA.

| Check | Command | Final result |
|---|---|---|
| Rust format | `cargo fmt --all -- --check` | Passed, exit 0 |
| Rust native tests | `cargo test --lib --target x86_64-pc-windows-msvc` | Passed: 17 passed, 0 failed, 0 ignored |
| Rust native Clippy | `cargo clippy --lib --target x86_64-pc-windows-msvc -- -D warnings` | Passed, exit 0, zero warnings |
| TypeScript | `npm run typecheck` | Passed, exit 0 |
| Policy-decision parser | `npm run test:parser` | Passed: 6/6 assertions |
| Offline demo | `npm run demo` | Passed: 8/8 deterministic scenarios |
| Secret scan | Repository scan excluding dependencies/build output | Passed: no 64-hex credential, private-key, common token, or JWT value found |
| Patch whitespace | `git diff --check` | Passed; Windows line-ending notices only |

The first sandboxed native-test attempts could not open the existing Cargo build-lock file (`os error 5`) and did not reach compilation. The same required command was rerun with local filesystem permission and produced the successful 17-test result above.

## Remaining limitations

- The testnet trust manifest must be rechecked before production deployment because remote state may change; production cannot use the unsafe fallback.
- The reason that two different credential values resolve to the same DID, and the extent of the Nominal Agent credential's tenant permissions, require clarification from Terminal 3. No write probe should be used to answer that question in this environment.
- The authorisation host/runtime compatibility discrepancy must be resolved before the original security design can be claimed as operational.
- Diagnostic 0.1.1 omits `check-authorized`; it is not production-ready and proves no agent/data-owner authorization boundary.
- The SDK exposes patch-only map updates but no reader/writer ACL readback through `TenantMapsNamespace`; the accepted `[863, 868]` request cannot be independently verified through SDK 5.5.0.
- Receipt retrieval and independent claims-digest verification are not implemented.
