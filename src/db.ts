import { openDB, DBSchema, IDBPDatabase } from "idb";

interface TokenUsage {
  id?: number;
  date: string;
  model: string;
  kind: string;
  tokens: number;
}

interface UsageDB extends DBSchema {
  tokenUsage: {
    key: number;
    value: TokenUsage;
    indexes: { "date": string };
  };
}

let dbPromise: Promise<IDBPDatabase<UsageDB>>;

function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<UsageDB>("AInputUsageDB", 1, {
      upgrade(db) {
        const store = db.createObjectStore("tokenUsage", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("date", "date");
      },
    });
  }
  return dbPromise;
}

export async function addTokenUsage(usage: TokenUsage) {
  const db = await initDB();
  await db.add("tokenUsage", usage);
}

export async function getTokenUsage(
  page: number,
  pageSize: number
): Promise<{ data: TokenUsage[]; total: number }> {
  const db = await initDB();
  const tx = db.transaction("tokenUsage", "readonly");
  const store = tx.objectStore("tokenUsage");
  const total = await store.count();

  let cursor = await store.openCursor(null, "prev");
  if (page > 1 && cursor) {
    await cursor.advance((page - 1) * pageSize);
  }


  const data: TokenUsage[] = [];
  let count = 0;
  while (cursor && count < pageSize) {
    data.push(cursor.value);
    cursor = await cursor.continue();
    count++;
  }

  return { data, total };
}
