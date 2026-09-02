# T3N / Bounty Engineering Findings

Only issues personally reproduced in the supplied environment are recorded here. The current Quickstart uses the `@terminal3/t3n-sdk` package name, so no package-name mismatch is reported.

Separately, SDK 5.5.0 exposes `fetchTrustedManifest()`; the requirement to make an explicit trust decision is not itself reported as a platform bug.

## BUG-001 — T3N testnet trust manifest was malformed

- **Reproduction:** Call `fetchTrustedManifest("testnet")` using `@terminal3/t3n-sdk@5.5.0` during the recorded environment setup.
- **Expected:** The testnet endpoint returns a well-formed signed manifest suitable for constructing a verified TrustAnchor.
- **Actual:** The SDK failed with: `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.`
- **Workaround:** This testnet-only client isolates the SDK's explicit `{ unsafe_trust_server: true }` option in one helper.
- **Impact / severity:** Critical if carried into production; high testnet-integration impact. The workaround disables server attestation verification and is not production-safe.
- **Verification status:** Reproduced. It should be rechecked before live registration because remote testnet state may have changed.

## BUG-002 — Windows cannot execute tests built for the repository's default WASM target

- **Reproduction:** In this contract, whose `.cargo/config.toml` defaults to `wasm32-wasip2`, run the otherwise standard `cargo test --lib` command on Windows.
- **Expected:** Unit tests run locally, or project instructions consistently select a runnable native target.
- **Actual:** Cargo produces a WASM test binary and Windows fails to execute it with OS error 193.
- **Workaround:** Run `cargo test --lib --target x86_64-pc-windows-msvc`. Use the same explicit native target for native Clippy.
- **Impact / severity:** Medium developer-experience friction. Contract compilation is unaffected; local test execution is blocked until a native target is selected.
- **Verification status:** Reproduced against the current reference-repository target configuration and documented command combination available during development.

## Integration status

SDK 5.5.0 type declarations confirm the client surfaces used for tenant map lifecycle, entry set/get, contract registration, agent sessions, the SDK helper implementing the documented `agent-auth-update` flow, and contract execution. `BUILD_LOG.md` records only commands actually executed. No successful registration, grant, policy mutation, or live invocation is claimed.
