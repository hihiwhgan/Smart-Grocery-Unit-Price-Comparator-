/**
 * 賣場極簡比價王 - 多商品動態單價即時計算與歷史底價比對引擎
 *
 * 核心職責：
 * 1. 根據商品「總價格」、「總容量/數量 × 包數」與「促銷折扣（買一送一、第二件5折、85折、8折）」即時換算折後單價。
 * 2. 對所有有效商品卡片進行單價排序，找出單價最低（最划算）的勝出商品（Winner），並計算「比第二名省 X%」。
 * 3. 自動與本機 SQLite「底價筆記本」歷史紀錄比對，產生紅綠燈提醒（「破歷史新低價！」或「比上次買的便宜/貴 X 元」）。
 */

import {
  CalculatedItemResult,
  ComparisonItem,
  HistoryPriceAlert,
  PriceHistoryRecord,
  PROMO_OPTIONS,
  PromoType,
} from '../types/grocery';

/**
 * 取得促銷折扣對應的折數乘數
 */
export function getPromoMultiplier(promo: PromoType): number {
  const found = PROMO_OPTIONS.find((p) => p.id === promo);
  return found ? found.multiplier : 1.0;
}

/**
 * 格式化單價顯示（自動根據數值大小調整小數位數，讓家庭主婦一眼看懂）
 */
export function formatUnitPrice(unitPrice: number): string {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return '--';
  }
  if (unitPrice < 0.01) {
    return unitPrice.toFixed(4);
  }
  if (unitPrice < 1) {
    return unitPrice.toFixed(3);
  }
  if (unitPrice < 10) {
    return unitPrice.toFixed(2);
  }
  return unitPrice.toFixed(1);
}

/**
 * 比對當前商品與本機歷史底價紀錄，回傳紅綠燈狀態
 */
export function evaluateHistoryAlert(
  item: ComparisonItem,
  effectiveTotalPrice: number,
  totalQuantity: number,
  unitPrice: number,
  historyRecords: PriceHistoryRecord[]
): HistoryPriceAlert | null {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || totalQuantity <= 0) {
    return null;
  }

  // 1. 優先比對條碼 (Barcode)，其次比對名稱關鍵字
  const cleanTitle = item.title.trim().toLowerCase();
  const candidates = historyRecords.filter((rec) => {
    if (item.barcode && rec.barcode && item.barcode === rec.barcode) {
      return true;
    }
    if (
      cleanTitle.length >= 2 &&
      !cleanTitle.startsWith('商品') &&
      (rec.productName.toLowerCase().includes(cleanTitle) ||
        cleanTitle.includes(rec.productName.toLowerCase().slice(0, 4)))
    ) {
      return rec.unit === item.unit;
    }
    return false;
  });

  if (candidates.length === 0) {
    return null;
  }

  // 找出最近一次購買紀錄與歷史最低單價紀錄
  const lastRecord = candidates[0];
  const lowestRecord = candidates.reduce(
    (min, cur) => (cur.unitPrice < min.unitPrice ? cur : min),
    candidates[0]
  );

  // 以當前購買的總容量換算：如果用上次的單價買同樣容量要多少錢？
  const equivalentPastTotalCost = lastRecord.unitPrice * totalQuantity;
  const diffAmount = Math.round(effectiveTotalPrice - equivalentPastTotalCost);
  const unitPriceDiffPercent =
    ((unitPrice - lastRecord.unitPrice) / lastRecord.unitPrice) * 100;

  // 誤差在 0.5% 以內視為平手
  if (Math.abs(unitPriceDiffPercent) < 0.5) {
    return {
      status: 'SAME',
      diffAmount: 0,
      unitPriceDiffPercent: 0,
      historicalBestUnitPrice: lowestRecord.unitPrice,
      lastRecordedPrice: lastRecord.effectivePrice,
      lastStoreName: lastRecord.storeName,
      lastRecordedDate: lastRecord.recordedAt,
      message: `與上次在 ${lastRecord.storeName} 買的單價相同`,
    };
  }

  // 破歷史新低價
  if (unitPrice < lowestRecord.unitPrice * 0.995) {
    const savedDollars = Math.max(1, Math.abs(diffAmount));
    return {
      status: 'NEW_LOW',
      diffAmount: -savedDollars,
      unitPriceDiffPercent,
      historicalBestUnitPrice: lowestRecord.unitPrice,
      lastRecordedPrice: lastRecord.effectivePrice,
      lastStoreName: lastRecord.storeName,
      lastRecordedDate: lastRecord.recordedAt,
      message: `破歷史新低價！比上次在${lastRecord.storeName.replace(/ .*/, '')}買便宜 ${savedDollars} 元`,
    };
  }

  // 比上次便宜
  if (unitPrice < lastRecord.unitPrice) {
    const savedDollars = Math.max(1, Math.abs(diffAmount));
    return {
      status: 'CHEAPER_THAN_LAST',
      diffAmount: -savedDollars,
      unitPriceDiffPercent,
      historicalBestUnitPrice: lowestRecord.unitPrice,
      lastRecordedPrice: lastRecord.effectivePrice,
      lastStoreName: lastRecord.storeName,
      lastRecordedDate: lastRecord.recordedAt,
      message: `比上次買的便宜 ${savedDollars} 元`,
    };
  }

  // 比上次貴（警示橘紅色 #D32F2F）
  const extraDollars = Math.max(1, Math.abs(diffAmount));
  return {
    status: 'MORE_EXPENSIVE',
    diffAmount: extraDollars,
    unitPriceDiffPercent,
    historicalBestUnitPrice: lowestRecord.unitPrice,
    lastRecordedPrice: lastRecord.effectivePrice,
    lastStoreName: lastRecord.storeName,
    lastRecordedDate: lastRecord.recordedAt,
    message: `比上次在${lastRecord.storeName.replace(/ .*/, '')}買的貴 ${extraDollars} 元`,
  };
}

/**
 * 即時計算所有商品卡片的折後單價、勝出排名與省錢百分比
 */
export function calculateAllComparisons(
  items: ComparisonItem[],
  historyRecords: PriceHistoryRecord[] = []
): Record<string, CalculatedItemResult> {
  const rawResults: CalculatedItemResult[] = items.map((item) => {
    const rawPrice = parseFloat(item.priceInput);
    const rawQty = parseFloat(item.quantityInput);
    const rawPacks = parseFloat(item.packCountInput || '1');
    const packMultiplier = Number.isFinite(rawPacks) && rawPacks > 0 ? rawPacks : 1;

    const isValid =
      Number.isFinite(rawPrice) &&
      rawPrice > 0 &&
      Number.isFinite(rawQty) &&
      rawQty > 0;

    if (!isValid) {
      return {
        itemId: item.id,
        isValid: false,
        effectiveTotalPrice: 0,
        totalQuantity: 0,
        unitPrice: 0,
        displayPer100Price: 0,
        isWinner: false,
        rank: null,
        savingsPercentVsSecond: null,
        extraCostPercentVsWinner: null,
        historyAlert: null,
      };
    }

    const multiplier = getPromoMultiplier(item.promo);
    const effectiveTotalPrice = rawPrice * multiplier;
    const totalQuantity = rawQty * packMultiplier;
    const unitPrice = effectiveTotalPrice / totalQuantity;
    const displayPer100Price = unitPrice * 100;

    const historyAlert = evaluateHistoryAlert(
      item,
      effectiveTotalPrice,
      totalQuantity,
      unitPrice,
      historyRecords
    );

    return {
      itemId: item.id,
      isValid: true,
      effectiveTotalPrice,
      totalQuantity,
      unitPrice,
      displayPer100Price,
      isWinner: false,
      rank: null,
      savingsPercentVsSecond: null,
      extraCostPercentVsWinner: null,
      historyAlert,
    };
  });

  // 取出所有輸入完整的商品卡片並依單價由低到高排序
  const validSorted = rawResults
    .filter((r) => r.isValid)
    .sort((a, b) => a.unitPrice - b.unitPrice);

  if (validSorted.length > 0) {
    const bestUnitPrice = validSorted[0].unitPrice;
    const secondUnitPrice =
      validSorted.length >= 2 ? validSorted[1].unitPrice : null;

    validSorted.forEach((res, idx) => {
      res.rank = idx + 1;
      // 若單價與最低單價相同（誤差極小），皆標示為勝出
      const isTiedForFirst = Math.abs(res.unitPrice - bestUnitPrice) < 1e-7;
      res.isWinner = isTiedForFirst;

      if (isTiedForFirst && secondUnitPrice && secondUnitPrice > bestUnitPrice) {
        // 「比第二名省 X%」= ((第二名 - 第一名) / 第二名) * 100
        const savePct =
          ((secondUnitPrice - bestUnitPrice) / secondUnitPrice) * 100;
        res.savingsPercentVsSecond = Math.round(savePct * 10) / 10;
      } else if (!isTiedForFirst) {
        const extraPct =
          ((res.unitPrice - bestUnitPrice) / bestUnitPrice) * 100;
        res.extraCostPercentVsWinner = Math.round(extraPct * 10) / 10;
      }
    });
  }

  const resultMap: Record<string, CalculatedItemResult> = {};
  for (const res of rawResults) {
    resultMap[res.itemId] = res;
  }
  return resultMap;
}
