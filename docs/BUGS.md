# T3N / Bounty Engineering Findings

Only issues observed in the supplied environment or already confirmed by the bounty task are recorded here. Credentials are redacted.

## BUG-001 — DX friction: package/documentation mismatch

- **Context:** Some bounty/onboarding guidance referenced `@terminal3/t3n-adk`; the installed and successfully validated package in this workspace is `@terminal3/t3n-sdk@5.5.0`.
- **Reproduction:** Follow guidance that imports or installs the former package name in this environment.
- **Expected:** Documentation consistently names the currently distributed SDK.
- **Actual:** The referenced name does not match the package used by the working local reference client.
- **Workaround:** Inspect the installed package and use `@terminal3/t3n-sdk@5.5.0`.
- **Impact / severity:** Medium DX friction. It can block onboarding, but does not weaken runtime policy once corrected. This report does not claim all current documentation still contains the old name.

## BUG-002 — SDK 5.5.0 requires `trustAnchor`

- **Reproduction:** Construct `T3nClient` without the required `trustAnchor` configuration and attempt a handshake.
- **Expected:** A complete quickstart supplies a verified trust source, or a clear configuration error identifies the missing field.
- **Actual:** The installed SDK type/API requires the field; prior attempts without it could not initialize correctly.
- **Workaround:** Supply an explicit TrustAnchor. For this testnet-only demo, BUG-003 forces the unsafe opt-out.
- **Impact / severity:** High onboarding friction; security-sensitive because callers must make an explicit trust decision.

## BUG-003 — T3N testnet trust manifest is malformed

- **Reproduction:** Call the SDK trusted-manifest path for testnet during the confirmed environment setup.
- **Expected:** `fetchTrustedManifest("testnet")` returns a well-formed signed manifest suitable for a verified TrustAnchor.
- **Actual:** It failed with: `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.`
- **Workaround:** This bounty testnet client visibly uses `{ unsafe_trust_server: true }` in one isolated helper.
- **Impact / severity:** Critical for production trust, high for testnet integration. The workaround disables server attestation verification and is never production-safe.

## BUG-004 — Windows native tests inherit a WASM default target

- **Reproduction:** In a contract whose `.cargo/config.toml` defaults to `wasm32-wasip2`, run `cargo test --lib` on Windows.
- **Expected:** Native unit tests compile and run locally, or Cargo clearly directs the developer to select a runnable target.
- **Actual:** Cargo builds a WASM test binary and Windows fails to execute it with OS error 193.
- **Workaround:** Run `cargo test --lib --target x86_64-pc-windows-msvc`. Use the same explicit native target for native Clippy.
- **Impact / severity:** Medium DX friction. Contract builds are unaffected; test execution is blocked until the target is explicit.

## Integration status

SDK 5.5.0 types confirm tenant map lifecycle, entry set/get, contract registration, inventory, and execution APIs. Live behavior is recorded in `BUILD_LOG.md`; no success is claimed unless a command was actually run with credentials.
