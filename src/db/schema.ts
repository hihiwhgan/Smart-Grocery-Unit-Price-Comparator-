/**
 * 賣場極簡比價王 - 離線優先（Offline-First）本機 SQLite 資料庫 Schema 與存取層
 *
 * 使用 expo-sqlite 儲存所有比價紀錄、商品條碼、GPS 賣場資訊與壓縮商品照片路徑。
 * 確保在無網路訊號的地下室大賣場（如好市多、家樂福 B1/B2）也能秒開、流暢計算與查詢。
 */

import * as SQLite from 'expo-sqlite';
import {
  PriceHistoryRecord,
  PromoType,
  StoreName,
  UnitType,
} from '../types/grocery';

export const DATABASE_NAME = 'smart_grocery_comparator.db';

/**
 * 完整 SQLite DDL Schema
 * 包含：
 * 1. stores: 賣場座標與常用賣場清單（支援離線 GPS 距離判斷）
 * 2. price_records: 個人「底價筆記本」歷史價格與本機照片縮圖紀錄
 * 3. comparison_sessions: 暫存當前比價計算機狀態
 */
export const SQLITE_SCHEMA_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. 常用賣場與離線 GPS 座標圍欄表
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  chain_type TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  radius_meters REAL DEFAULT 500,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 2. 個人「底價筆記本」歷史價格紀錄表
CREATE TABLE IF NOT EXISTS price_records (
  id TEXT PRIMARY KEY NOT NULL,
  product_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  barcode TEXT,
  store_name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  original_price REAL NOT NULL,
  effective_price REAL NOT NULL,
  promo_type TEXT NOT NULL DEFAULT 'NONE',
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_price REAL NOT NULL,
  photo_uri TEXT,
  recorded_at TEXT NOT NULL,
  created_timestamp INTEGER NOT NULL
);

-- 加速條碼掃描、關鍵字搜尋與賣場篩選的索引
CREATE INDEX IF NOT EXISTS idx_price_records_barcode ON price_records(barcode);
CREATE INDEX IF NOT EXISTS idx_price_records_normalized_name ON price_records(normalized_name);
CREATE INDEX IF NOT EXISTS idx_price_records_store_name ON price_records(store_name);
CREATE INDEX IF NOT EXISTS idx_price_records_unit_price ON price_records(normalized_name, unit, unit_price ASC);
`;

/** 預設內建的底價筆記本範例資料（方便首次啟動與模擬測試） */
export const INITIAL_SEED_RECORDS: PriceHistoryRecord[] = [
  {
    id: 'seed-1',
    productName: '舒潔三層抽取式衛生紙 (110抽x24包)',
    barcode: '4710036003128',
    storeName: '全聯福利中心',
    latitude: 25.033964,
    longitude: 121.543378,
    originalPrice: 369,
    effectivePrice: 369,
    promoType: 'NONE',
    quantity: 2640,
    unit: '抽',
    unitPrice: 369 / 2640, // 0.1398 元/抽
    photoUri: 'tag_tissue_pxmart',
    recordedAt: '2026-11-10',
    isHistoricalLowest: true,
  },
  {
    id: 'seed-2',
    productName: '科克蘭三層抽取衛生紙 (120抽x24包)',
    barcode: '0096619147281',
    storeName: '好市多 Costco',
    latitude: 25.065321,
    longitude: 121.575412,
    originalPrice: 389,
    effectivePrice: 389,
    promoType: 'NONE',
    quantity: 2880,
    unit: '抽',
    unitPrice: 389 / 2880, // 0.1351 元/抽
    photoUri: 'tag_tissue_costco',
    recordedAt: '2026-11-02',
    isHistoricalLowest: true,
  },
  {
    id: 'seed-3',
    productName: '瑞穗鮮乳家庭號 (全脂)',
    barcode: '4710088410134',
    storeName: '家樂福 Carrefour',
    latitude: 25.041822,
    longitude: 121.564101,
    originalPrice: 169,
    effectivePrice: 169,
    promoType: 'NONE',
    quantity: 1858,
    unit: 'ml',
    unitPrice: 169 / 1858, // 0.09096 元/ml
    photoUri: 'tag_milk_carrefour',
    recordedAt: '2026-11-14',
    isHistoricalLowest: true,
  },
  {
    id: 'seed-4',
    productName: '義大利奧利塔玄米油 (組)',
    barcode: '8008857010025',
    storeName: '全聯福利中心',
    latitude: 25.033964,
    longitude: 121.543378,
    originalPrice: 558,
    effectivePrice: 279,
    promoType: 'BOGO',
    quantity: 1000,
    unit: 'ml',
    unitPrice: 279 / 1000, // 0.279 元/ml
    photoUri: 'tag_oil_pxmart',
    recordedAt: '2026-10-28',
    isHistoricalLowest: true,
  },
];

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * 初始化本機 SQLite 資料庫並寫入預設種子資料
 */
export async function initOfflineDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(SQLITE_SCHEMA_DDL);

  // 檢查是否已有歷史資料，若無則寫入預設底價種子資料
  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM price_records'
  );

  if (!countRow || countRow.count === 0) {
    for (const record of INITIAL_SEED_RECORDS) {
      await insertPriceRecordToSQLite(db, record);
    }
  }

  dbInstance = db;
  return db;
}

/** 正規化商品名稱以便模糊比對同類商品 */
export function normalizeProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\(\)（）\[\]【】]/g, '');
}

/** 新增一筆底價紀錄至本機 SQLite */
export async function insertPriceRecordToSQLite(
  db: SQLite.SQLiteDatabase,
  record: PriceHistoryRecord
): Promise<void> {
  const normalized = normalizeProductName(record.productName);
  await db.runAsync(
    `INSERT OR REPLACE INTO price_records (
      id, product_name, normalized_name, barcode, store_name,
      latitude, longitude, original_price, effective_price,
      promo_type, quantity, unit, unit_price, photo_uri,
      recorded_at, created_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.productName,
      normalized,
      record.barcode,
      record.storeName,
      record.latitude,
      record.longitude,
      record.originalPrice,
      record.effectivePrice,
      record.promoType,
      record.quantity,
      record.unit,
      record.unitPrice,
      record.photoUri,
      record.recordedAt,
      Date.now(),
    ]
  );
}

/** 查詢本機所有底價紀錄（支援賣場篩選與關鍵字搜尋） */
export async function queryPriceHistoryRecords(
  db: SQLite.SQLiteDatabase,
  options?: {
    storeFilter?: StoreName | 'ALL';
    searchKeyword?: string;
  }
): Promise<PriceHistoryRecord[]> {
  let sql = `SELECT * FROM price_records WHERE 1=1`;
  const params: (string | number)[] = [];

  if (options?.storeFilter && options.storeFilter !== 'ALL') {
    sql += ` AND store_name = ?`;
    params.push(options.storeFilter);
  }

  if (options?.searchKeyword && options.searchKeyword.trim() !== '') {
    const kw = `%${options.searchKeyword.trim()}%`;
    sql += ` AND (product_name LIKE ? OR barcode LIKE ? OR store_name LIKE ?)`;
    params.push(kw, kw, kw);
  }

  sql += ` ORDER BY created_timestamp DESC`;

  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map((row) => ({
    id: row.id,
    productName: row.product_name,
    barcode: row.barcode,
    storeName: row.store_name as StoreName,
    latitude: row.latitude,
    longitude: row.longitude,
    originalPrice: row.original_price,
    effectivePrice: row.effective_price,
    promoType: row.promo_type as PromoType,
    quantity: row.quantity,
    unit: row.unit as UnitType,
    unitPrice: row.unit_price,
    photoUri: row.photo_uri,
    recordedAt: row.recorded_at,
    isHistoricalLowest: true,
  }));
}
