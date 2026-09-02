use alloc::vec::Vec;

use crate::models::{Decision, DecisionResponse, Policy, ReasonCode, TradeIntent};

pub fn evaluate_json(input: &[u8], policy: &Policy) -> DecisionResponse {
    match serde_json::from_slice::<TradeIntent>(input) {
        Ok(intent) => evaluate(&intent, policy),
        Err(_) => DecisionResponse::invalid_input(),
    }
}

pub fn evaluate(intent: &TradeIntent, policy: &Policy) -> DecisionResponse {
    if !intent.has_valid_numbers() {
        return DecisionResponse {
            decision: Decision::Deny,
            reasons: alloc::vec![ReasonCode::InvalidInput],
            symbol: Some(intent.symbol.clone()),
            side: Some(intent.side.clone()),
            notional_usd: Some(intent.notional_usd),
        };
    }

    let mut reasons = Vec::new();

    if !policy
        .allowed_symbols
        .iter()
        .any(|value| value == &intent.symbol)
    {
        reasons.push(ReasonCode::SymbolNotAllowed);
    }
    if !policy
        .allowed_venues
        .iter()
        .any(|value| value == &intent.venue)
    {
        reasons.push(ReasonCode::VenueNotAllowed);
    }
    if intent.notional_usd > policy.max_trade_notional_usd {
        reasons.push(ReasonCode::NotionalLimitExceeded);
    }
    if intent.daily_loss_usd > policy.max_daily_loss_usd {
        reasons.push(ReasonCode::DailyLossLimitExceeded);
    }
    if intent.confidence < policy.min_confidence {
        reasons.push(ReasonCode::ConfidenceTooLow);
    }
    if intent.side != "BUY" && intent.side != "SELL" {
        reasons.push(ReasonCode::InvalidSide);
    }

    DecisionResponse {
        decision: if reasons.is_empty() {
            Decision::Allow
        } else {
            Decision::Deny
        },
        reasons,
        symbol: Some(intent.symbol.clone()),
        side: Some(intent.side.clone()),
        notional_usd: Some(intent.notional_usd),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> Policy {
        Policy {
            allowed_symbols: alloc::vec!["SOL".into(), "BTC".into()],
            allowed_venues: alloc::vec!["JUPITER".into()],
            max_trade_notional_usd: 1_000.0,
            max_daily_loss_usd: 500.0,
            min_confidence: 0.8,
        }
    }

    fn intent() -> TradeIntent {
        TradeIntent {
            symbol: "SOL".into(),
            side: "BUY".into(),
            notional_usd: 500.0,
            venue: "JUPITER".into(),
            confidence: 0.91,
            daily_loss_usd: 100.0,
        }
    }

    fn reason_codes(result: DecisionResponse) -> Vec<ReasonCode> {
        result.reasons
    }

    #[test]
    fn valid_intent_is_allowed() {
        assert_eq!(evaluate(&intent(), &policy()).decision, Decision::Allow);
    }

    #[test]
    fn valid_btc_sell_is_allowed() {
        let mut value = intent();
        value.symbol = "BTC".into();
        value.side = "SELL".into();
        assert_eq!(evaluate(&value, &policy()).decision, Decision::Allow);
    }

    #[test]
    fn invalid_symbol_is_denied() {
        let mut value = intent();
        value.symbol = "DOGE".into();
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![ReasonCode::SymbolNotAllowed]
        );
    }

    #[test]
    fn invalid_venue_is_denied() {
        let mut value = intent();
        value.venue = "BINANCE".into();
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![ReasonCode::VenueNotAllowed]
        );
    }

    #[test]
    fn max_notional_is_enforced() {
        let mut value = intent();
        value.notional_usd = 1_000.01;
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![ReasonCode::NotionalLimitExceeded]
        );
    }

    #[test]
    fn daily_loss_is_enforced() {
        let mut value = intent();
        value.daily_loss_usd = 500.01;
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![ReasonCode::DailyLossLimitExceeded]
        );
    }

    #[test]
    fn confidence_threshold_is_enforced() {
        let mut value = intent();
        value.confidence = 0.79;
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![ReasonCode::ConfidenceTooLow]
        );
    }

    #[test]
    fn invalid_side_is_rejected() {
        let mut value = intent();
        value.side = "HOLD".into();
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![ReasonCode::InvalidSide]
        );
    }

    #[test]
    fn multiple_violations_are_returned_in_stable_order() {
        let value = TradeIntent {
            symbol: "DOGE".into(),
            side: "HOLD".into(),
            notional_usd: 2_000.0,
            venue: "BINANCE".into(),
            confidence: 0.2,
            daily_loss_usd: 900.0,
        };
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![
                ReasonCode::SymbolNotAllowed,
                ReasonCode::VenueNotAllowed,
                ReasonCode::NotionalLimitExceeded,
                ReasonCode::DailyLossLimitExceeded,
                ReasonCode::ConfidenceTooLow,
                ReasonCode::InvalidSide,
            ]
        );
    }

    #[test]
    fn malformed_json_is_rejected() {
        assert_eq!(
            reason_codes(evaluate_json(br#"{"symbol":"SOL""#, &policy())),
            alloc::vec![ReasonCode::InvalidInput]
        );
    }

    #[test]
    fn missing_field_is_rejected() {
        assert_eq!(
            reason_codes(evaluate_json(br#"{"symbol":"SOL"}"#, &policy())),
            alloc::vec![ReasonCode::InvalidInput]
        );
    }

    #[test]
    fn negative_notional_is_invalid_input() {
        let mut value = intent();
        value.notional_usd = -1.0;
        assert_eq!(
            reason_codes(evaluate(&value, &policy())),
            alloc::vec![ReasonCode::InvalidInput]
        );
    }

    #[test]
    fn boundaries_are_inclusive() {
        let mut value = intent();
        value.notional_usd = 1_000.0;
        value.daily_loss_usd = 500.0;
        value.confidence = 0.8;
        assert_eq!(evaluate(&value, &policy()).decision, Decision::Allow);
    }

    #[test]
    fn response_uses_machine_readable_codes() {
        let mut value = intent();
        value.side = "HOLD".into();
        let json = serde_json::to_string(&evaluate(&value, &policy())).expect("serialize response");
        assert!(json.contains("\"decision\":\"DENY\""));
        assert!(json.contains("\"INVALID_SIDE\""));
        assert!(json.contains("\"notionalUsd\":500.0"));
    }
}
