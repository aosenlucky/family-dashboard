import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/sync.js";
import {
  accessProof,
  createCloudStorage,
} from "../src/features/diary/cloud.js";
import {
  createVault,
  unlockVault,
  encryptData,
  changePassword,
} from "../src/features/diary/crypto.js";
import { newData } from "../src/features/diary/model.js";
import { testRecords } from "./fixtures/diary-records.js";

test("two devices, personal access, encrypted chunks, atomic writes and recovery", async (t) => {
  const database = testRecords();
  t.mock.method(globalThis, "fetch", database.request);
  const family = "family-test-only",
    pass = "disposable personal secret",
    newPass = "updated disposable secret";
  const before = { ...process.env };
  Object.assign(process.env, {
    SYSTEM_PASSWORD: family,
    DEMO_PASSWORD: "sample-demo",
    SUPABASE_URL: "https://invalid.test",
    SUPABASE_SERVICE_ROLE_KEY: "non-secret-fixture",
  });
  t.after(() => {
    for (const k of [
      "SYSTEM_PASSWORD",
      "DEMO_PASSWORD",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ])
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
  });
  async function request(url, opts) {
    const headers = Object.fromEntries(new Headers(opts.headers).entries());
    let status = 200,
      payload;
    await handler(
      { method: "POST", headers, body: JSON.parse(opts.body) },
      {
        status(n) {
          status = n;
          return this;
        },
        setHeader() {},
        json(b) {
          payload = b;
        },
      },
    );
    return Response.json(payload, { status });
  }
  const user = "aosen",
    token = await accessProof(user, pass);
  const storage = (name, proof, pin = family) =>
    createCloudStorage(name, proof, request, () => pin);
  const phone = storage(user, token),
    computer = storage(user, token);
  const data = newData("synthetic"),
    vault = await createVault(pass, data);
  const recovery = await accessProof(user, vault.recovery, true);
  await phone.register(recovery);
  const first = await phone.writeVault(vault.envelope, 0, { recovery });
  const secondDevice = await unlockVault(await computer.readVault(), pass);
  assert.deepEqual(secondDevice.data, data);

  const bobKey = await accessProof("小悦", pass),
    bob = storage("小悦", bobKey);
  await bob.register(await accessProof("小悦", vault.recovery, true));
  assert.equal(await bob.readVault(), null);
  const attacker = storage(user, bobKey);
  for (const bad of [
    attacker,
    storage(user, token, "sample-demo"),
    storage(user, token, ""),
  ]) {
    await assert.rejects(bad.readVault(), (e) => [401, 403].includes(e.status));
    await assert.rejects(bad.writeVault(first, first.revision), (e) =>
      [401, 403].includes(e.status),
    );
  }
  await assert.rejects(attacker.register(recovery), (e) => e.status === 403);
  data.draft.text = "a draft only the author should see";
  data.draft.photos = ["data:image/jpeg;base64," + "A".repeat(390000)];
  const updated = await encryptData(vault.key, first, data);
  const published = await phone.writeVault(updated, first.revision);
  assert.equal(published.revision, 2);
  assert.deepEqual(
    (await unlockVault(await computer.readVault(), pass)).data,
    data,
  );
  assert.ok([...database.rows.keys()].some((k) => k.includes(":part:")));
  assert.ok(!JSON.stringify([...database.rows]).includes(data.draft.text));
  assert.ok(!JSON.stringify([...database.rows]).includes(pass));
  assert.ok(!JSON.stringify([...database.rows]).includes(vault.recovery));
  const racing = await Promise.allSettled([
    phone.writeVault(updated, 2),
    computer.writeVault(updated, 2),
  ]);
  assert.equal(racing.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(racing.find((r) => r.status === "rejected").reason.status, 409);
  await assert.rejects(
    computer.writeVault(updated, 1),
    (e) => e.status === 409,
  );
  const rec = storage(user, recovery);
  const old = await rec.readVault();
  assert.deepEqual((await unlockVault(old, vault.recovery, true)).data, data);
  const next = await changePassword(vault.key, old, newPass);
  await rec.writeVault(next, old.revision, { password: newPass });
  await assert.rejects(computer.readVault(), (e) => e.status === 403);
  const changed = await storage(
    user,
    await accessProof(user, newPass),
  ).readVault();
  assert.deepEqual((await unlockVault(changed, newPass)).data, data);
  assert.equal(
    (await storage(user, recovery).readVault()).revision,
    changed.revision,
  );
  const invalid = await request("/api/sync", {
    headers: { Authorization: family, "X-Diary-Access": recovery },
    body: JSON.stringify({
      action: "private-diary",
      account: user,
      op: "commit",
      revision: changed.revision,
      upload: crypto.randomUUID(),
      header: { bad: true },
      parts: 0,
    }),
  });
  assert.equal(invalid.status, 400);
});
