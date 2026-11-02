import test from "node:test";
import assert from "node:assert/strict";
import {
  createVault,
  unlockVault,
  encryptData,
  changePassword,
  validateEnvelope,
  validateData,
  ITERATIONS,
} from "../crypto.js";
import {
  newData,
  publishDraft,
  newDraft,
  entriesFor,
  period,
  weekStart,
  movePeriod,
  calendarDays,
  highlights,
  prepareAiText,
  today,
  addDays,
} from "../model.js";

const password = "only-a-disposable-test-secret-123";
function fixture() {
  const data = newData("测试用户");
  data.draft.text = "不能在明文存储中出现的私人日记";
  data.draft.photos = ["data:image/jpeg;base64,/9j/2Q=="];
  publishDraft(data, "2026-11-02T03:00:00Z", "first");
  data.draft.text = "尚未发表的私密草稿";
  data.reviews["month:2026-11-01"] = {
    text: "私密总结",
    sourceIds: ["first"],
    type: "month",
    start: "2026-11-01",
    end: "2026-11-30",
  };
  return data;
}

test("whole vault is ciphertext: entries, photos, drafts, summaries and name round-trip", async () => {
  const data = fixture(),
    result = await createVault(password, data),
    raw = JSON.stringify(result.envelope);
  for (const secret of [
    data.name,
    data.entries[0].text,
    data.draft.text,
    "私密总结",
    "data:image/jpeg",
  ])
    assert.ok(!raw.includes(secret));
  assert.equal(result.envelope.kdf.iterations, ITERATIONS);
  assert.deepEqual((await unlockVault(result.envelope, password)).data, data);
  assert.deepEqual(
    (await unlockVault(result.envelope, result.recovery, true)).data,
    data,
  );
});
test("wrong secrets, modified ciphertext, replaced vault context and malformed backups are rejected", async () => {
  const result = await createVault(password, fixture());
  await assert.rejects(
    unlockVault(result.envelope, "wrong-password"),
    "bad password",
  );
  await assert.rejects(unlockVault(result.envelope, "0".repeat(64), true));
  const tampered = structuredClone(result.envelope);
  tampered.payload.ciphertext =
    (tampered.payload.ciphertext[0] === "A" ? "B" : "A") +
    tampered.payload.ciphertext.slice(1);
  await assert.rejects(unlockVault(tampered, password));
  await assert.rejects(
    unlockVault({ ...result.envelope, id: crypto.randomUUID() }, password),
  );
  assert.throws(() =>
    validateEnvelope({
      ...result.envelope,
      kdf: { ...result.envelope.kdf, iterations: 2 ** 31 },
    }),
  );
  assert.throws(() => validateEnvelope({ ...result.envelope, version: 99 }));
});
test("fresh IV on every save and password changes retain recovery access", async () => {
  const result = await createVault(password, fixture()),
    saved = await encryptData(result.key, result.envelope, fixture());
  assert.notEqual(saved.payload.iv, result.envelope.payload.iv);
  assert.notEqual(saved.payload.ciphertext, result.envelope.payload.ciphertext);
  const changed = await changePassword(
    result.key,
    saved,
    "another-disposable-password-456",
  );
  await assert.rejects(unlockVault(changed, password));
  assert.deepEqual(
    (await unlockVault(changed, "another-disposable-password-456")).data,
    fixture(),
  );
  assert.deepEqual(
    (await unlockVault(changed, result.recovery, true)).data,
    fixture(),
  );
  assert.deepEqual(
    (await unlockVault(result.envelope, password)).data,
    fixture(),
  );
});
test("invalid content and too-short passwords cannot create a usable vault", async () => {
  await assert.rejects(createVault("1234", newData()));
  const data = fixture();
  data.entries[0].photos = ["https://example.invalid/private.jpg"];
  assert.throws(() => validateData(data));
  const invalid = fixture();
  invalid.entries[0].date = "2026-02-30";
  assert.throws(() => validateData(invalid));
});
test("writing accepts a single sentence or a photo, preserves previous versions and resets draft", () => {
  const data = newData();
  assert.throws(() => publishDraft(data));
  data.draft.text = "只有一句话";
  publishDraft(data, "2026-01-01T01:00:00Z", "one");
  assert.equal(data.entries.length, 1);
  assert.equal(data.draft.text, "");
  data.draft = { ...newDraft(), id: "one", text: "修改过的一句话" };
  publishDraft(data);
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].versions[0].text, "只有一句话");
  assert.equal(data.entries[0].createdAt, "2026-01-01T01:00:00Z");
  data.draft.photos = ["data:image/jpeg;base64,/9j/2Q=="];
  publishDraft(data);
  assert.equal(data.entries.length, 2);
  data.draft = { ...newDraft(), text: "无效日期", date: "" };
  assert.throws(() => publishDraft(data));
  data.draft.date = addDays(today(), 1);
  assert.throws(() => publishDraft(data));
});
test("week/month boundaries include year rollover and leap days without local timezone drift", () => {
  assert.equal(weekStart("2027-01-03"), "2026-12-28");
  assert.deepEqual(period("2024-02-15", "month"), {
    start: "2024-02-01",
    end: "2024-02-29",
    key: "month:2024-02-01",
    type: "month",
  });
  assert.equal(movePeriod("2026-12-31", "month", 1), "2027-01-01");
  assert.equal(calendarDays("2026-11").length, 42);
  assert.equal(calendarDays("2026-11")[0], "2026-10-26");
});
test("review and AI material only include explicitly selected, non-deleted entries", () => {
  const data = newData();
  data.entries = [
    {
      id: "1",
      date: "2026-10-26",
      createdAt: "1",
      text: "本周第一篇",
      starred: false,
      photos: [],
    },
    {
      id: "2",
      date: "2026-11-01",
      createdAt: "2",
      text: "已删除秘密",
      deletedAt: "x",
      starred: true,
      photos: [],
    },
    {
      id: "3",
      date: "2026-11-02",
      createdAt: "3",
      text: "下周秘密",
      starred: false,
      photos: [],
    },
  ];
  const range = period("2026-10-28", "week"),
    records = entriesFor(data, range);
  assert.deepEqual(
    records.map((e) => e.id),
    ["1"],
  );
  const text = prepareAiText(records, range);
  assert.ok(text.includes("本周第一篇"));
  assert.ok(!text.includes("已删除秘密"));
  assert.ok(!text.includes("下周秘密"));
  const list = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    date: `2026-10-${26 + i}`,
    starred: i === 0,
  }));
  assert.equal(highlights(list).length, 3);
  assert.equal(highlights(list)[0].id, "0");
});
