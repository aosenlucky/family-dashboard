// One encrypted rescue copy per open editor. Independent tabs never replace each other's drafts.
const connections = new Map();
function open(account) {
  if (!connections.has(account))
    connections.set(
      account,
      new Promise((resolve, reject) => {
        const request = indexedDB.open("family-diary-unsent-v1:" + account, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("copies", { keyPath: "id" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch((error) => {
        connections.delete(account);
        throw error;
      }),
    );
  return connections.get(account);
}
async function transact(account, mode, run) {
  const db = await open(account);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("copies", mode);
    const request = run(tx.objectStore("copies"));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () =>
      reject(tx.error || new Error("本机存储不可用。"));
  });
}
export function pendingCopies(account) {
  return {
    list: () => transact(account, "readonly", (s) => s.getAll()),
    save: (id, envelope) =>
      transact(account, "readwrite", (s) =>
        s.put({ id, envelope, time: Date.now() }),
      ),
    remove: (id) => transact(account, "readwrite", (s) => s.delete(id)),
  };
}
