/**
 * 賣場極簡比價王 - 核心型別定義 (Core Type Definitions)
 */

/** 常用單位選項 */
export type UnitType = 'g' | 'ml' | '抽' | '入' | '包';

export const UNIT_OPTIONS: UnitType[] = ['g', 'ml', '抽', '入', '包'];

/** 賣場常見促銷折扣類型 */
export type PromoType =
  | 'NONE'
  | 'BOGO'          // 買一送一 (× 0.5)
  | 'SECOND_HALF'   // 第二件5折 (× 0.75)
  | 'DISCOUNT_85'   // 85折 (× 0.85)
  | 'DISCOUNT_80';  // 打8折 (× 0.80)

export interface PromoOption {
  id: PromoType;
  label: string;
  multiplier: number;
  badgeText: string;
}

export const PROMO_OPTIONS: PromoOption[] = [
  { id: 'NONE', label: '無折扣', multiplier: 1.0, badgeText: '原價' },
  { id: 'BOGO', label: '買一送一', multiplier: 0.5, badgeText: '5折換算' },
  { id: 'SECOND_HALF', label: '第二件5折', multiplier: 0.75, badgeText: '75折換算' },
  { id: 'DISCOUNT_85', label: '85折', multiplier: 0.85, badgeText: '85折' },
  { id: 'DISCOUNT_80', label: '打8折', multiplier: 0.8, badgeText: '8折' },
];

/** 常見台灣實體大賣場清單 */
export type StoreName = '全聯福利中心' | '家樂福 Carrefour' | '好市多 Costco' | '大潤發 RT-Mart' | '愛買 a.mart';

export const STORE_OPTIONS: StoreName[] = [
  '全聯福利中心',
  '家樂福 Carrefour',
  '好市多 Costco',
  '大潤發 RT-Mart',
  '愛買 a.mart',
];

/** 動態比價計算機中的單一商品卡片資料 */
export interface ComparisonItem {
  id: string;
  title: string;              // 例如 "商品 1" 或 OCR 帶入的 "抽取式衛生紙"
  priceInput: string;         // 總價格字串（支援小數點輸入）
  quantityInput: string;      // 總容量/數量字串（例如單包 110 抽）
  packCountInput: string;     // 包數/組數（預設 "1"，例如 1袋24包 可輸入 24 或直接輸入總量）
  unit: UnitType;             // 單位 ('g' | 'ml' | '抽' | '入' | '包')
  promo: PromoType;           // 促銷折扣
  barcode?: string;           // 掃描到的 EAN/UPC 條碼
  photoUri?: string;          // 拍攝的價標本機縮圖路徑
  matchedHistoryRecord?: PriceHistoryRecord | null; // 匹配的歷史底價紀錄
}

/** 即時計算後的單價與排名結果 */
export interface CalculatedItemResult {
  itemId: string;
  isValid: boolean;
  effectiveTotalPrice: number; // 折扣後有效總價
  totalQuantity: number;       // 總容量/總數量
  unitPrice: number;           // 單位價格 (元 / 單位)
  displayPer100Price: number;  // 每 100g / 100ml / 100抽 價格（方便閱讀）
  isWinner: boolean;           // 是否為全場單價最低（最划算）
  rank: number | null;         // 排名 (1, 2, 3...)
  savingsPercentVsSecond: number | null; // 第一名比第二名省 X%
  extraCostPercentVsWinner: number | null; // 非第一名比第一名貴 X%
  historyAlert: HistoryPriceAlert | null;  // 與本機歷史底價的紅綠燈比對結果
}

/** 歷史低價紅綠燈提醒 */
export interface HistoryPriceAlert {
  status: 'NEW_LOW' | 'CHEAPER_THAN_LAST' | 'MORE_EXPENSIVE' | 'SAME';
  diffAmount: number;          // 總價或換算同規格價差（元）
  unitPriceDiffPercent: number;// 單價差距百分比
  historicalBestUnitPrice: number;
  lastRecordedPrice: number;
  lastStoreName: StoreName;
  lastRecordedDate: string;
  message: string;             // 例如 "🔥 破歷史新低價！比上次便宜 15 元" 或 "⚠️ 比上次買的貴 12 元"
}

/** 本機資料庫「底價筆記本」儲存紀錄 Schema */
export interface PriceHistoryRecord {
  id: string;
  productName: string;
  barcode: string | null;
  storeName: StoreName;
  latitude: number | null;
  longitude: number | null;
  originalPrice: number;
  effectivePrice: number;
  promoType: PromoType;
  quantity: number;
  unit: UnitType;
  unitPrice: number;           // 元 / 單位
  photoUri: string | null;     // 壓縮後的本機照片 URI
  recordedAt: string;          // ISO 日期字串 (YYYY-MM-DD)
  isHistoricalLowest: boolean; // 是否為該商品目前歷史最低單價
}

/** 當前對焦的輸入欄位（用於下方固定大型數字鍵盤） */
export interface ActiveInputTarget {
  itemId: string;
  field: 'priceInput' | 'quantityInput';
}
