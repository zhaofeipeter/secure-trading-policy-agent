import { readRegistration } from "./registration.js";
import { connectTenantAdmin } from "./tenant-admin.js";
import { DEFAULT_POLICY, POLICY_KEY, POLICY_MAP_TAIL } from "./types.js";

const registration = await readRegistration();
const { tenant, tenantDid } = await connectTenantAdmin();

if (tenantDid !== registration.tenantDid) {
  throw new Error("Authenticated tenant does not match the contract registration record");
}

const policyMapName = tenant.canonicalName(POLICY_MAP_TAIL);
const status = await tenant.maps.getStatus(POLICY_MAP_TAIL);
if (status === "deleting") {
  throw new Error("Policy map is still deleting; wait until its status is absent before retrying");
}

if (status === "absent") {
  await tenant.maps.create({
    tail: POLICY_MAP_TAIL,
    visibility: "private",
    writers: { only: [] },
    readers: { only: [registration.contractId] },
  });
  console.log(`Created private map: ${policyMapName}`);
}

// Always converge ACL and admin-read state, including after a prior run created
// the map but failed before configuration completed.
await tenant.maps.update(POLICY_MAP_TAIL, {
  visibility: "private",
  writers: { only: [] },
  readers: { only: [registration.contractId] },
  adminReadable: true,
});
console.log("Policy map access configuration converged.");

const desired = JSON.stringify(DEFAULT_POLICY);
const existing = await tenant.maps.entryGet(POLICY_MAP_TAIL, POLICY_KEY);
if (existing !== null && existing !== desired) {
  throw new Error(
    "A different policy is already configured. Refusing to overwrite it automatically.",
  );
}

if (existing === null) {
  await tenant.maps.entrySet(POLICY_MAP_TAIL, POLICY_KEY, desired);
  console.log(`Stored policy at ${policyMapName}/${POLICY_KEY}`);
} else {
  console.log("Policy already matches the deterministic demo policy; no write performed.");
}

const readBack = await tenant.maps.entryGet(POLICY_MAP_TAIL, POLICY_KEY);
if (readBack !== desired) {
  throw new Error("Policy read-back verification failed");
}
console.log("Policy setup and read-back verification succeeded.");
