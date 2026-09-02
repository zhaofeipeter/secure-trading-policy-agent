# T3N / Bounty Engineering Findings

Only issues personally reproduced in the supplied environment are recorded here. The current Quickstart uses the `@terminal3/t3n-sdk` package name, so no package-name mismatch is reported.

Separately, SDK 5.5.0 exposes `fetchTrustedManifest()`; the requirement to make an explicit trust decision is not itself reported as a platform bug.

## BUG-001 — T3N testnet trust manifest was malformed

- **Reproduction:** Call `fetchTrustedManifest("testnet")` using `@terminal3/t3n-sdk@5.5.0` during the recorded environment setup.
- **Expected:** The testnet endpoint returns a well-formed signed manifest suitable for constructing a verified TrustAnchor.
- **Actual:** The SDK failed with: `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.`
- **Workaround:** This testnet-only client isolates the SDK's explicit `{ unsafe_trust_server: true }` option in one helper.
- **Impact / severity:** Critical if carried into production; high testnet-integration impact. The workaround disables server attestation verification and is not production-safe.
- **Verification status:** Reproduced initially and again during a read-only live probe on 2026-09-02. The live recheck returned the same malformed-manifest error. Remote state may change and must be checked again before production deployment.

## BUG-002 — Windows cannot execute tests built for the repository's default WASM target

- **Reproduction:** In this contract, whose `.cargo/config.toml` defaults to `wasm32-wasip2`, run the otherwise standard `cargo test --lib` command on Windows.
- **Expected:** Unit tests run locally, or project instructions consistently select a runnable native target.
- **Actual:** Cargo produces a WASM test binary and Windows fails to execute it with OS error 193.
- **Workaround:** Run `cargo test --lib --target x86_64-pc-windows-msvc`. Use the same explicit native target for native Clippy.
- **Impact / severity:** Medium developer-experience friction. Contract compilation is unaffected; local test execution is blocked until a native target is selected.
- **Verification status:** Reproduced against the current reference-repository target configuration and documented command combination available during development.

## FINDING-003 — Claim/onboarding credentials resolved to a shared tenant DID

- **Context:** Current T3N agent-identity guidance describes an agent as using its own key and DID, separate from the tenant. The tested claim/onboarding flow issued a credential value different from `T3N_API_KEY`.
- **Reproduction:** Clear `T3N_API_KEY` and `USER_KEY`, authenticate using only the separately issued `AGENT_KEY`, then perform only read-only identity and tenant-management calls.
- **Expected security-model assumption:** The nominal agent credential would authenticate to an agent DID distinct from the tenant/admin DID, or tenant control-plane reads would be unauthorized.
- **Actual:** Both credential values authenticated as `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. With only `AGENT_KEY`, authentication, the plain identity read, `TenantClient` construction, `tenant.me()`, `maps.getStatus`, `maps.entryGet(current)`, and `contracts.listDetailed` all succeeded.
- **Safety boundary:** No create, update, delete, authorize, revoke, register, or other write call was executed. The probe establishes tenant control-plane read access only; it makes no claim about write or admin-mutation authority.
- **Interpretation:** This is a reproduced documentation/runtime or onboarding-semantics discrepancy requiring Terminal 3 clarification. It is not labelled a platform vulnerability because possible account-scoped credential semantics or other onboarding behavior are not yet understood.
- **Project impact:** Credential modules can remain operationally isolated, but this test environment cannot claim that different key values create independently privileged T3N principals. The next contract authorization test is a self/shared-DID flow, not evidence of cross-principal delegation.

## Integration status

SDK 5.5.0 type declarations confirm the client surfaces used for tenant map lifecycle, entry set/get, contract registration, agent sessions, the SDK helper implementing the documented `agent-auth-update` flow, and contract execution. `BUILD_LOG.md` records the current live state and distinguishes it from the 2026-09-02 read-only probe. Contract `trading-policy@0.1.0` is registered as ID `863`; the probe itself performed no registration, grant, policy mutation, or live contract invocation.
