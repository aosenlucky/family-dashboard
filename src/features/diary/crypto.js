// Only this authenticated envelope is persisted, never journal plaintext.
// Password and recovery wrappers protect the same random 256-bit data key.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const ITERATIONS = 600000;
const VERSION = 1;
const random = (length) => crypto.getRandomValues(new Uint8Array(length));
export function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function fromBase64(value) {
  if (typeof value !== "string") throw new Error("备份格式不正确");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
const aad = (id, role) =>
  encoder.encode(`family-diary:${VERSION}:${id}:${role}`);
async function passwordKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromBase64(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function rawKey(bytes, extractable = false) {
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", extractable, [
    "encrypt",
    "decrypt",
  ]);
}
async function seal(key, bytes, context) {
  const iv = random(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: context },
    key,
    bytes,
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}
async function open(key, box, context) {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(box.iv), additionalData: context },
    key,
    fromBase64(box.ciphertext),
  );
}
function recoveryBytes(code) {
  const hex = code.replace(/[\s-]/g, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hex)) throw new Error("恢复码格式不正确");
  return Uint8Array.from(hex.match(/../g), (part) => parseInt(part, 16));
}
function validateBox(box) {
  if (
    !box ||
    fromBase64(box.iv).length !== 12 ||
    fromBase64(box.ciphertext).length < 16
  )
    throw new Error("备份格式不正确");
}
export function validateEnvelope(value) {
  if (
    !value ||
    value.format !== "family-private-diary" ||
    value.version !== VERSION ||
    typeof value.id !== "string" ||
    value.id.length > 80 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    value.kdf?.name !== "PBKDF2-SHA256" ||
    value.kdf.iterations < ITERATIONS ||
    value.kdf.iterations > 2000000 ||
    !Number.isSafeInteger(value.kdf.iterations) ||
    fromBase64(value.kdf.salt).length !== 16
  )
    throw new Error("这不是受支持的加密日记备份");
  validateBox(value.wrappedPassword);
  validateBox(value.wrappedRecovery);
  validateBox(value.payload);
  return value;
}
export function validateData(data) {
  const validDate = (s) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) &&
    new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
  const validPhotos = (photos) =>
    Array.isArray(photos) &&
    photos.length <= 4 &&
    photos.every(
      (p) =>
        typeof p === "string" &&
        /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p),
    );
  const validEntry = (e) =>
    e &&
    typeof e.id === "string" &&
    typeof e.text === "string" &&
    e.text.length <= 50000 &&
    validDate(e.date) &&
    validPhotos(e.photos) &&
    typeof e.starred === "boolean" &&
    typeof e.createdAt === "string" &&
    (!e.versions ||
      (Array.isArray(e.versions) &&
        e.versions.length <= 5 &&
        e.versions.every(
          (v) =>
            typeof v.text === "string" &&
            validDate(v.date) &&
            validPhotos(v.photos),
        )));
  if (
    !data ||
    data.schema !== 1 ||
    typeof data.name !== "string" ||
    data.name.length > 40 ||
    !Array.isArray(data.entries) ||
    !data.entries.every(validEntry) ||
    new Set(data.entries.map((e) => e.id)).size !== data.entries.length ||
    !data.draft ||
    typeof data.draft.text !== "string" ||
    data.draft.text.length > 50000 ||
    !validDate(data.draft.date) ||
    !validPhotos(data.draft.photos) ||
    !data.reviews ||
    typeof data.reviews !== "object" ||
    Array.isArray(data.reviews) ||
    !Object.values(data.reviews).every(
      (r) =>
        r &&
        typeof r.text === "string" &&
        ["week", "month"].includes(r.type) &&
        validDate(r.start) &&
        validDate(r.end) &&
        Array.isArray(r.sourceIds) &&
        r.sourceIds.every((id) => typeof id === "string"),
    )
  )
    throw new Error("备份内的日记结构不完整，未导入任何数据");
  return data;
}
export async function encryptData(key, envelope, data) {
  validateData(data);
  const payload = await seal(
    key,
    encoder.encode(JSON.stringify(data)),
    aad(envelope.id, "data"),
  );
  return { ...envelope, payload };
}
export async function createVault(password, data) {
  if ([...password].length < 12)
    throw new Error("请使用至少 12 个字符的日记口令");
  const dataKey = await rawKey(random(32), true);
  const secret = random(32);
  const recovery = [...secret]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .match(/.{8}/g)
    .join("-")
    .toUpperCase();
  const envelope = {
    format: "family-private-diary",
    version: VERSION,
    id: crypto.randomUUID(),
    revision: 0,
    kdf: {
      name: "PBKDF2-SHA256",
      salt: toBase64(random(16)),
      iterations: ITERATIONS,
    },
  };
  const bytes = new Uint8Array(await crypto.subtle.exportKey("raw", dataKey));
  envelope.wrappedPassword = await seal(
    await passwordKey(password, envelope.kdf.salt, ITERATIONS),
    bytes,
    aad(envelope.id, "password"),
  );
  envelope.wrappedRecovery = await seal(
    await rawKey(secret),
    bytes,
    aad(envelope.id, "recovery"),
  );
  bytes.fill(0);
  secret.fill(0);
  return {
    envelope: await encryptData(dataKey, envelope, data),
    key: dataKey,
    recovery,
  };
}
export async function unlockVault(envelope, secret, recovery = false) {
  validateEnvelope(envelope);
  let raw;
  try {
    const wrapper = recovery
      ? await rawKey(recoveryBytes(secret))
      : await passwordKey(secret, envelope.kdf.salt, envelope.kdf.iterations);
    raw = new Uint8Array(
      await open(
        wrapper,
        recovery ? envelope.wrappedRecovery : envelope.wrappedPassword,
        aad(envelope.id, recovery ? "recovery" : "password"),
      ),
    );
    const key = await rawKey(raw, true);
    const data = validateData(
      JSON.parse(
        decoder.decode(
          await open(key, envelope.payload, aad(envelope.id, "data")),
        ),
      ),
    );
    return { key, data };
  } catch {
    throw new Error(
      recovery
        ? "恢复码不正确，或备份已损坏。"
        : "日记口令不正确，或加密文件已损坏。",
    );
  } finally {
    raw?.fill(0);
  }
}
export async function changePassword(key, envelope, password) {
  if ([...password].length < 12)
    throw new Error("请使用至少 12 个字符的日记口令");
  const salt = toBase64(random(16));
  const bytes = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  try {
    return {
      ...envelope,
      kdf: { name: "PBKDF2-SHA256", salt, iterations: ITERATIONS },
      wrappedPassword: await seal(
        await passwordKey(password, salt, ITERATIONS),
        bytes,
        aad(envelope.id, "password"),
      ),
    };
  } finally {
    bytes.fill(0);
  }
}
