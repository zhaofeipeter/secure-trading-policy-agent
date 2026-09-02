# T3N Secure Trading Policy Agent

A proof-of-concept deterministic TEE authorization layer between an AI trading agent and execution infrastructure. A nominal agent credential proposes a trade; a Rust contract hosted by T3N reads tenant-owned policy and returns `ALLOW` or `DENY`. This repository never submits a trade, holds no exchange or wallet execution credentials, and uses no funds.

## Why this exists

An LLM is useful for proposing actions, but prompt injection, hallucinations, and compromised context make it a poor security boundary. The TEE contract remains the deterministic policy boundary. Credential modules and process environments are separated operationally, but the tested tenant/admin and nominal-agent credentials resolved to the same T3N DID, so this deployment does not claim a T3N principal or privilege boundary between them.

```mermaid
flowchart LR
    Admin[Tenant/Admin credential<br/>T3N_API_KEY] --> Shared[Shared observed T3N DID]
    Agent[Nominal Agent credential<br/>AGENT_KEY] --> Shared
    Shared -->|tenant administration path| T[T3N testnet]
    Shared -->|nominal agent invocation path| T
    Shared -->|provision/administer| KV[(Private policy map<br/>trading-policy-config)]
    User[Data Owner<br/>USER_KEY] -->|grant evaluate-trade only| Auth[Authorisation policy]
    T --> C[Rust TEE contract<br/>trading-policy]
    Auth -->|check-authorized| C
    KV -->|contract-only read| C
    C -->|ALLOW or DENY| Agent
    C -->|set transaction claims digest| T
    Agent -. no execution adapter .-> X[No real trade]
```

The LLM proposes. The TEE contract enforces deterministic policy. The admin and nominal-agent code paths use different credential values and modules, but no T3N authorization boundary between those credentials was observed.

## Integer policy units

Money is represented as integer US-dollar cents and confidence as integer basis points. The Rust policy engine contains no floating-point monetary or confidence comparisons.

| Meaning | Wire value |
|---|---:|
| USD 500.00 | `notionalUsdCents: 50000` |
| USD 1,000.00 limit | `maxTradeNotionalUsdCents: 100000` |
| 91% confidence | `confidenceBps: 9100` |
| 80% minimum | `minConfidenceBps: 8000` |

Example intent:

```json
{
  "symbol": "SOL",
  "side": "BUY",
  "notionalUsdCents": 50000,
  "venue": "JUPITER",
  "confidenceBps": 9100,
  "dailyLossUsdCents": 10000
}
```

The default policy allows `SOL` and `BTC` on `JUPITER`, caps a proposed trade at 100,000 cents, caps the caller-supplied daily-loss value at 50,000 cents, and requires 8,000 basis points of confidence.

## Credential paths and observed identity

Never place all three credentials in one runtime or shell.

| Operational path | Environment | Intended responsibility |
|---|---|---|
| Tenant/admin | `T3N_API_KEY` | Tenant verification, contract registration, map provisioning, policy administration |
| Data owner | `USER_KEY`, plus public `AGENT_DID` | Grant or revoke the agent's exact contract/function authority |
| Nominal agent runtime | `AGENT_KEY` | Application code invokes `evaluate-trade`; the demo module does not construct `TenantClient` |

On 2026-09-02, the different `T3N_API_KEY` and separately issued `AGENT_KEY` values both authenticated as `did:t3n:f62da0c78b9ffd0fce31193d4e7db02f272adc0e`. With only `AGENT_KEY` present, read-only calls to `tenant.me()`, `maps.getStatus`, `maps.entryGet(current)`, and `contracts.listDetailed` all succeeded. No tenant control-plane write was tested. Consequently, process-level secret separation remains useful operational hygiene, but it is not evidence of T3N authorization separation and creates no demonstrated protection against tenant writes.

### Agent onboarding choice

This demo used the public/self-authenticating onboarding flow for an individual tenant. In this test environment it produced a different credential value that resolved to the same DID as the tenant/admin credential:

1. Obtain a separately issued credited agent key from the T3N claim page.
2. In an agent-only shell, use the SDK CLI with `--api-key $env:AGENT_KEY` to run `whoami`, scaffold/host the public agent card, and verify it.
3. Copy the session-returned DID into `AGENT_DID` in the separate data-owner authorization shell.
4. After the contract is registered, run `npm run authorize` with `USER_KEY` and `AGENT_DID`. The SDK helper implementing the documented `agent-auth-update` flow performs a read/merge/write for only `trading-policy@0.1.0::evaluate-trade`, with empty data scopes and no outbound hosts, while preserving unrelated grants.
5. `npm run demo:live` uses only `AGENT_KEY`; it reads non-secret local authorization metadata to supply the data-owner DID as `pii_did`.

`USER_KEY` is required for the authorization bootstrap because the grant is a SelfOnly data-owner write. It is not required or read by the nominal-agent execution module. In this environment, the next live authorization test is a self/shared-DID flow and must not be described as proof of cross-principal delegation.

## Tenant policy storage

- Contract: `z:<tenant-id>:trading-policy`
- Policy map: `z:<tenant-id>:trading-policy-config`
- Entry key: `current`

The contract constructs the map name from the host-provided tenant DID. Setup converges the map on every run to private visibility, current contract-ID read access, no business-contract writers, and tenant-admin read-back. It then refuses to overwrite a different policy and verifies the intended value.

## Prerequisites and install

- Node.js 18+
- Rust with `wasm32-wasip2`
- Visual Studio C++ Build Tools for Windows native tests
- `@terminal3/t3n-sdk@5.5.0`

```powershell
cd C:\project\superteam\secure-trading-policy-agent\client
npm install
```

## Local build and QA

These commands do not contact T3N:

```powershell
cd C:\project\superteam\secure-trading-policy-agent\contract
cargo fmt --all -- --check
cargo build --target wasm32-wasip2 --release
cargo test --lib --target x86_64-pc-windows-msvc
cargo clippy --all-targets --target x86_64-pc-windows-msvc -- -D warnings
cargo clippy --target wasm32-wasip2 --release -- -D warnings

cd ..\client
npm install
npm run typecheck
npm run demo
```

Bare `cargo test --lib` inherits the repository's WASM default target, which Windows cannot execute directly. Always select the native MSVC target as shown.

## Current live testnet state and next test

Contract `trading-policy@0.1.0` is already registered as contract ID 863, and policy map `trading-policy-config` exists. Do not rerun registration.

After approval, the next live step is the self/shared-DID authorization test:

```powershell
$env:USER_KEY = "<data-owner-key>"
$env:AGENT_DID = "<session-derived-agent-did>"
npm run authorize
```

Nominal-agent credential shell:

```powershell
$env:AGENT_KEY = "<nominal-agent-key>"
npm run demo:live
```

Registration remains fixed at tail `trading-policy`, version `0.1.0`. It refuses an existing local record and checks live tenant inventory before registering. No automatic version bump exists.

## Demo modes

`npm run demo` runs eight fixtures through a trusted local harness. It is useful for deterministic output review but is not evidence of T3N execution.

`npm run demo:live` authenticates using only the nominal `AGENT_KEY`, validates that its session DID matches the authorization metadata, calls the contract through `T3nClient.executeAndDecode`, and runtime-validates every returned field and reason code. It does not construct `TenantClient`. Because the tested `AGENT_KEY` shares the tenant DID, success would validate a self/shared-DID authorization flow, not cross-principal delegation.

## Audit statement

The contract SHA-256 hashes its serialized decision and calls the vendored `kv-store.set-claims-digest` host function. Therefore, the contract **sets the transaction claims digest**. This repository does not independently retrieve or verify a T3N receipt, and it does not claim that verification has occurred. Receipt retrieval and independent verification remain future work.

## TESTNET-ONLY trust limitation

SDK 5.5.0 exposes the `fetchTrustedManifest("testnet")` path. A live read-only recheck on 2026-09-02 still returned: `Trust manifest at https://cn-api.sg.testnet.t3n.terminal3.io/api/trust-manifest is malformed.` The client therefore isolates an explicit `{ unsafe_trust_server: true }` workaround for this bounty testnet only.

This disables server attestation verification and is not production-safe. Production must restore a verified TrustAnchor and fail closed on verification failure. See [docs/BUGS.md](docs/BUGS.md).

## Security limitations and production path

The tested tenant/admin and nominal-agent credentials share one observed T3N DID, and the nominal-agent credential successfully performed tenant control-plane reads. Write/admin mutation authority was not tested and is unknown. The caller also supplies `dailyLossUsdCents` and `confidenceBps`; the contract validates their ranges and thresholds but cannot prove their provenance. Production must clarify T3N credential/onboarding semantics, derive risk state from trusted protected sources, restore verified TrustAnchor handling, isolate wallet custody, add replay controls and independent receipt verification, and undergo independent security review.

No current code is authorized to control real funds.
