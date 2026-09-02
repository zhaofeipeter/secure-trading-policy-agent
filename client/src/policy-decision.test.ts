import assert from "node:assert/strict";

import { parsePolicyDecision } from "./policy-decision.js";

const normalAllow = {
  decision: "ALLOW",
  reasons: [],
  symbol: "SOL",
  side: "BUY",
  notionalUsdCents: 50_000,
};
assert.deepEqual(parsePolicyDecision(normalAllow), normalAllow);

const normalDeny = {
  decision: "DENY",
  reasons: ["NOTIONAL_LIMIT_EXCEEDED"],
  symbol: "SOL",
  side: "BUY",
  notionalUsdCents: 150_000,
};
assert.deepEqual(parsePolicyDecision(normalDeny), normalDeny);

const invalidInputWithoutContext = {
  decision: "DENY",
  reasons: ["INVALID_INPUT"],
};
assert.deepEqual(
  parsePolicyDecision(invalidInputWithoutContext),
  invalidInputWithoutContext,
);

assert.throws(
  () =>
    parsePolicyDecision({
      ...normalAllow,
      reasons: ["CONFIDENCE_TOO_LOW"],
    }),
  /ALLOW must not contain reasons/,
);

assert.throws(
  () =>
    parsePolicyDecision({
      ...normalDeny,
      reasons: [],
    }),
  /DENY must contain at least one reason/,
);

assert.throws(
  () =>
    parsePolicyDecision({
      ...normalDeny,
      reasons: ["NOT_A_REASON"],
    }),
  /invalid reasons/,
);

console.log("6/6 policy decision parser assertions passed.");
