import { connectT3n } from "./t3n.js";
import { readRegistration } from "./registration.js";
import { DEFAULT_POLICY, POLICY_KEY } from "./types.js";

const registration = await readRegistration();
const { tenant, tenantDid } = await connectT3n();

if (tenantDid !== registration.tenantDid) {
  throw new Error("Authenticated tenant does not match the contract registration record");
}

const status = await tenant.maps.getStatus(registration.tail);
if (status === "deleting") {
  throw new Error("Policy map is still deleting; wait until its status is absent before retrying");
}

if (status === "absent") {
  await tenant.maps.create({
    tail: registration.tail,
    visibility: "private",
    writers: { only: [] },
    readers: { only: [registration.contractId] },
  });
  await tenant.maps.update(registration.tail, { adminReadable: true });
  console.log(`Created private map: ${registration.scriptName}`);
}

const desired = JSON.stringify(DEFAULT_POLICY);
const existing = await tenant.maps.entryGet(registration.tail, POLICY_KEY);
if (existing !== null && existing !== desired) {
  throw new Error(
    "A different policy is already configured. Refusing to overwrite it automatically.",
  );
}

if (existing === null) {
  await tenant.maps.entrySet(registration.tail, POLICY_KEY, desired);
  console.log(`Stored policy at ${registration.scriptName}/${POLICY_KEY}`);
} else {
  console.log("Policy already matches the deterministic demo policy; no write performed.");
}

const readBack = await tenant.maps.entryGet(registration.tail, POLICY_KEY);
if (readBack !== desired) {
  throw new Error("Policy read-back verification failed");
}
console.log("Policy setup and read-back verification succeeded.");
