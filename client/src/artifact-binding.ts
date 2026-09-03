import { createHash } from "node:crypto";

import { ORIGINAL_VERSION, WORKAROUND_VERSION } from "./types.js";

export interface WasmArtifactBinding {
  label: string;
  version: string;
  sha256: string;
}

export const ORIGINAL_ARTIFACT_BINDING: WasmArtifactBinding = {
  label: "historical authorization-bearing contract",
  version: ORIGINAL_VERSION,
  sha256: "860d752ea211698440732e8ad7e85f08a54d2fc20fd137e678bece7f42abe3d8",
};

export const WORKAROUND_ARTIFACT_BINDING: WasmArtifactBinding = {
  label: "diagnostic authorization-free workaround contract",
  version: WORKAROUND_VERSION,
  sha256: "1b5d75c3b8ae031535e180f52510c9b23bf50bc88e71232a27694635f0733dab",
};

export function assertWasmArtifactBinding(
  wasm: Uint8Array,
  binding: WasmArtifactBinding,
): void {
  const actualSha256 = createHash("sha256").update(wasm).digest("hex");
  if (actualSha256 !== binding.sha256) {
    throw new Error(
      `${binding.label} WASM does not match the approved SHA-256 for version ${binding.version}. ` +
        "Refusing to register potentially mislabeled bytes.",
    );
  }
}
