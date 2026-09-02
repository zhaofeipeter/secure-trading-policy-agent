//! T3N secure trading policy contract.
//!
//! An untrusted agent proposes an intent. This component reads policy from the
//! authenticated tenant's private KV namespace, returns a deterministic
//! authorization decision, and commits the response hash as the transaction's
//! claims digest. It has no capability to execute a trade.
#![warn(clippy::style, missing_debug_implementations)]
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

#[cfg(target_arch = "wasm32")]
use alloc::{string::String, vec::Vec};

#[cfg(target_arch = "wasm32")]
use models::Policy;

pub const CONTRACT_VERSION: &str = "0.1.0";
pub const POLICY_MAP_TAIL: &str = "trading-policy";
pub const POLICY_KEY: &[u8] = b"current";

wit_bindgen::generate!({
    world: "trading-policy",
    path: "wit",
    additional_derives: [serde::Deserialize, serde::Serialize],
    generate_all,
});

mod models;
mod policy;

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::z::trading_policy::contracts::Guest for Component {
    fn evaluate_trade(
        req: exports::z::trading_policy::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        evaluate_trade_wasm(req.input.as_deref())
    }
}

#[cfg(target_arch = "wasm32")]
fn evaluate_trade_wasm(input: Option<&[u8]>) -> Result<Vec<u8>, String> {
    use crate::host::{interfaces::kv_store, tenant::tenant_context};
    use sha2::{Digest, Sha256};

    let tenant_id = hex::encode(tenant_context::tenant_did());
    let map_name = alloc::format!("z:{tenant_id}:{POLICY_MAP_TAIL}");
    let policy_bytes = kv_store::get(&map_name, POLICY_KEY)
        .map_err(|_| "policy storage read failed".to_string())?
        .ok_or_else(|| "policy is not configured".to_string())?;
    let configured_policy: Policy = serde_json::from_slice(&policy_bytes)
        .map_err(|_| "stored policy is malformed".to_string())?;
    if !configured_policy.is_valid() {
        return Err("stored policy is invalid".to_string());
    }

    let response = match input {
        Some(bytes) => policy::evaluate_json(bytes, &configured_policy),
        None => models::DecisionResponse::invalid_input(),
    };
    let encoded =
        serde_json::to_vec(&response).map_err(|_| "decision encoding failed".to_string())?;
    let digest = Sha256::digest(&encoded);
    kv_store::set_claims_digest(digest.as_slice())
        .map_err(|_| "decision audit commitment failed".to_string())?;
    Ok(encoded)
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contract_version_is_expected_semver() {
        assert_eq!(CONTRACT_VERSION, "0.1.0");
        assert_eq!(CONTRACT_VERSION.split('.').count(), 3);
    }

    #[test]
    fn policy_location_is_stable() {
        assert_eq!(POLICY_MAP_TAIL, "trading-policy");
        assert_eq!(POLICY_KEY, b"current");
    }
}
