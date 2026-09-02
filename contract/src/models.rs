use alloc::{string::String, vec::Vec};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TradeIntent {
    pub symbol: String,
    pub side: String,
    pub notional_usd: f64,
    pub venue: String,
    pub confidence: f64,
    pub daily_loss_usd: f64,
}

impl TradeIntent {
    pub fn has_valid_numbers(&self) -> bool {
        self.notional_usd.is_finite()
            && self.notional_usd >= 0.0
            && self.daily_loss_usd.is_finite()
            && self.daily_loss_usd >= 0.0
            && self.confidence.is_finite()
            && (0.0..=1.0).contains(&self.confidence)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Policy {
    pub allowed_symbols: Vec<String>,
    pub allowed_venues: Vec<String>,
    pub max_trade_notional_usd: f64,
    pub max_daily_loss_usd: f64,
    pub min_confidence: f64,
}

impl Policy {
    pub fn is_valid(&self) -> bool {
        !self.allowed_symbols.is_empty()
            && !self.allowed_venues.is_empty()
            && self.allowed_symbols.iter().all(|value| !value.is_empty())
            && self.allowed_venues.iter().all(|value| !value.is_empty())
            && self.max_trade_notional_usd.is_finite()
            && self.max_trade_notional_usd >= 0.0
            && self.max_daily_loss_usd.is_finite()
            && self.max_daily_loss_usd >= 0.0
            && self.min_confidence.is_finite()
            && (0.0..=1.0).contains(&self.min_confidence)
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Decision {
    Allow,
    Deny,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReasonCode {
    SymbolNotAllowed,
    VenueNotAllowed,
    NotionalLimitExceeded,
    DailyLossLimitExceeded,
    ConfidenceTooLow,
    InvalidSide,
    InvalidInput,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DecisionResponse {
    pub decision: Decision,
    pub reasons: Vec<ReasonCode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub side: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notional_usd: Option<f64>,
}

impl DecisionResponse {
    pub fn invalid_input() -> Self {
        Self {
            decision: Decision::Deny,
            reasons: alloc::vec![ReasonCode::InvalidInput],
            symbol: None,
            side: None,
            notional_usd: None,
        }
    }
}
