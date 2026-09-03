import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  ORIGINAL_ARTIFACT_BINDING,
  WORKAROUND_ARTIFACT_BINDING,
  assertWasmArtifactBinding,
} from "./artifact-binding.js";

assert.equal(ORIGINAL_ARTIFACT_BINDING.version, "0.1.0");
assert.equal(WORKAROUND_ARTIFACT_BINDING.version, "0.1.1");
assert.notEqual(ORIGINAL_ARTIFACT_BINDING.sha256, WORKAROUND_ARTIFACT_BINDING.sha256);

const fixture = Buffer.from("deterministic-wasm-fixture", "utf8");
const fixtureSha256 = createHash("sha256").update(fixture).digest("hex");

assert.doesNotThrow(() =>
  assertWasmArtifactBinding(fixture, {
    label: "matching fixture",
    version: "0.1.1",
    sha256: fixtureSha256,
  }),
);

assert.throws(
  () =>
    assertWasmArtifactBinding(fixture, {
      label: "mismatched fixture",
      version: "0.1.0",
      sha256: "0".repeat(64),
    }),
  /Refusing to register potentially mislabeled bytes/,
);

console.log("5/5 WASM artifact-binding assertions passed.");
