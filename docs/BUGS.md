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

SDK 5.5.0 type declarations confirm the client surfaces used for tenant map lifecycle, entry set/get, contract registration, agent sessions, the SDK helper implementing the documented `agent-auth-update` flow, and contract execution. SDK 5.5.0 does not expose an ACL readback API for map reader/writer configuration. The readers-only request `[863, 868]` was accepted with response `{}`, but its effective state could not be independently retrieved through the SDK.

## FINDING-004 — Authorisation host path fails while an otherwise equivalent contract executes

- **Environment:** T3N testnet on Windows 11; client SDK `@terminal3/t3n-sdk@5.5.0`; Rust `wasm32-wasip2` components registered under tail `trading-policy`.
- **Original:** Contract 863 / `0.1.0` imports `host:interfaces/authorisation@2.1.0` and calls `check-authorized([])` at function entry. It also imports tenant context and KV as shown below.
- **Observed 0.1.0 behavior:** Registration and policy-map setup succeeded, but both `T3nClient.executeAndDecode` payload forms and `TenantClient.contracts.execute("trading-policy", ...)` repeatedly returned `action.execute` `-32603 Internal error`. Recorded request IDs include `845e1326-2722-4f8c-86c8-eecb2664c833`, `2b1da316-fd54-48bb-9cd7-c36c9f5ccd78`, and `8d1de50a-650c-4715-90dc-9cece37915a0`.
- **Diagnostic:** Contract 868 / `0.1.1` changes only the contract version and removes the authorisation WIT import and `check-authorized` entry call. Tenant context, `kv-store.get`, `kv-store.set-claims-digest`, request/response types, map/key, and policy logic are preserved.
- **Observed 0.1.1 behavior:** After an accepted readers-only map patch requesting `[863, 868]`, direct tenant execution succeeded. The full T3N testnet TEE demo passed all 8 deterministic scenarios, including both ALLOW fixtures and the ordered six-reason DENY fixture. No exchange was contacted and no trade was executed.

| WASM host import | 863 / 0.1.0 | 868 / 0.1.1 | Difference |
|---|---|---|---|
| `host:interfaces/authorisation@2.1.0` | Present; `check-authorized` called first | Absent | Only removed host dependency |
| `host:tenant/tenant-context@1.0.0` | Present | Present | None |
| `host:interfaces/kv-store@2.1.0` | Present; `get` and `set-claims-digest` used | Present; same calls used | None |

### Reproduction

1. Build and register the 0.1.0 component with the three imports above as contract 863.
2. Provision `trading-policy-config/current` for contract read access and invoke `evaluate-trade` with the repository's known-good SOL fixture.
3. Observe `action.execute` error `-32603`; the request IDs above are examples from repeated attempts.
4. Build 0.1.1 from the same source with only `host:interfaces/authorisation@2.1.0` and `check-authorized([])` removed, and register it separately as contract 868.
5. Add 868 to the map reader request without changing policy data, then invoke the same SOL fixture through `TenantClient.contracts.execute`.
6. Run the same eight fixtures through `npm run demo:live:0.1.1`; the recorded run passed 8/8.

- **Expected:** A locally valid, successfully registered contract using the supplied authorisation WIT surface either executes `check-authorized` and returns its typed result, or returns a specific compatibility/authorization error.
- **Actual:** The authorisation-bearing 0.1.0 returns only `-32603 Internal error`; removing that single dependency allows the otherwise equivalent 0.1.1 to execute successfully.
- **Assessment:** The evidence strongly isolates the failure to the `host:interfaces/authorisation@2.1.0` / `check-authorized` path in the tested T3N testnet environment. This appears to be a host-surface/runtime compatibility discrepancy requiring Terminal 3 clarification. Local compilation and successful registration do not establish runtime host support.
- **Claim boundary:** This is not labelled a confirmed T3N security vulnerability and is not mathematical proof of root cause. Diagnostic 0.1.1 omits caller authorization, so its success does not demonstrate a separate agent/data-owner authorization boundary or successful `check-authorized` enforcement.

## Final integration status

The immutable live evidence is contract 863 / 0.1.0 for the intended authorization design and contract 868 / 0.1.1 for the diagnostic workaround. Do not overwrite or represent them as the same security design. `BUILD_LOG.md` records both the failures and the successful 8/8 run.
