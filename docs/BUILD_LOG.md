# Build Log

Date: 2026-09-02  
Environment: Windows 11, PowerShell, T3N testnet

## Pre-existing validated environment

- `@terminal3/t3n-sdk@5.5.0` was present in the sibling `t3n-first` project.
- The provided environment records Rust `1.98.0`, Cargo `1.98.0`, and targets `x86_64-pc-windows-msvc` and `wasm32-wasip2`.
- Visual Studio C++ Build Tools are required for the Windows MSVC target.
- The untouched Terminal 3 reference `z-tenant-flight` had previously built to `wasm32-wasip2`, passed seven native tests and native Clippy, and registered as contract ID 859. This project did not modify it or its registration record.
- Existing T3N tenant authentication was known to work. No tenant DID was copied into application source.

## Inspection and design

1. Read the sibling T3N connection/registration scripts without modifying them.
2. Read `z-tenant-flight` WIT packages and Rust host usage without modifying the repository.
3. Inspected the installed SDK 5.5.0 declarations for `T3nClient`, `TenantClient`, `maps.create`, `entrySet`, `entryGet`, `getStatus`, `contracts.register`, `listDetailed`, and `contracts.execute`.
4. Confirmed `host:interfaces/kv-store@2.1.0` exposes `get` and `set-claims-digest`, and `host:tenant/tenant-context@1.0.0` returns the raw 20-byte tenant DID.
5. Chose private tenant KV with a contract-only reader ACL and no contract writers. The management client performs bootstrap writes.

## Trust-anchor finding

SDK 5.5.0 requires `trustAnchor`. The testnet manifest fetch was already confirmed to fail as malformed at `https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest`. The client therefore isolates an explicit `unsafe_trust_server: true` testnet-only exception. Credentials are never logged.

## Commands and results

This section is updated with commands actually run in this repository.

| Check | Command | Result |
|---|---|---|
| Rust format | `cargo fmt --all -- --check` | Passed, no diff |
| Rust WASM release | `cargo build --target wasm32-wasip2 --release` | Passed |
| Rust native tests | `cargo test --lib --target x86_64-pc-windows-msvc` | Passed: 16 passed, 0 failed |
| Rust native Clippy | `cargo clippy --all-targets --target x86_64-pc-windows-msvc -- -D warnings` | Passed, zero warnings |
| Rust WASM Clippy | `cargo clippy --target wasm32-wasip2 --release -- -D warnings` | Passed, zero warnings |
| Client install | `npm install` | Passed: 22 packages added, 0 vulnerabilities reported |
| TypeScript | `npm run typecheck` | Passed |
| Offline demo | `npm run demo` | Passed: 8/8 scenarios |
| T3N registration | `npm run register` | Blocked until `T3N_API_KEY` is available in this process |
| Policy setup | `npm run setup` | Blocked until registration and credentials |
| Live invocation | `npm run demo:live` | Blocked until registration, setup, and credentials |

The release component is 150,480 bytes with SHA-256 `21AE314320939FBDC512CBA134755E5A8743DB573A3315648B6259CEFB6348FC`.

The registration command was run once without a credential to validate its preflight path. It stopped before any network call with `T3N_API_KEY is required for live T3N operations`; no registration record was created and no contract ID is claimed.

No real exchange, wallet, market-data service, or funds are used by any command.
