/**
 * 賣場極簡比價王 - 核心多商品單價計算、促銷折扣與離線 OCR 解析自動化測試
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// 測試用促銷折數表
const PROMO_MULTIPLIERS = {
  NONE: 1.0,
  BOGO: 0.5,
  SECOND_HALF: 0.75,
  DISCOUNT_85: 0.85,
  DISCOUNT_80: 0.8,
};

function calculateUnitPrices(items) {
  const results = items.map((it) => {
    const price = parseFloat(it.priceInput);
    const qty = parseFloat(it.quantityInput);
    const mult = PROMO_MULTIPLIERS[it.promo] ?? 1.0;
    const effectivePrice = price * mult;
    const unitPrice = effectivePrice / qty;
    return {
      id: it.id,
      effectivePrice,
      unitPrice,
      isWinner: false,
      savingsPercentVsSecond: null,
    };
  });

  const sorted = [...results].sort((a, b) => a.unitPrice - b.unitPrice);
  const best = sorted[0].unitPrice;
  const second = sorted.length > 1 ? sorted[1].unitPrice : null;

  for (const r of results) {
    if (Math.abs(r.unitPrice - best) < 1e-7) {
      r.isWinner = true;
      if (second && second > best) {
        r.savingsPercentVsSecond = Math.round(((second - best) / second) * 1000) / 10;
      }
    }
  }
  return results;
}

test('多商品動態比價：支援 3 個以上商品、買一送一與第二件5折即時勝出計算', () => {
  const items = [
    { id: 'item-1', priceInput: '369', quantityInput: '2640', promo: 'NONE' },        // 0.13977 元/抽
    { id: 'item-2', priceInput: '358', quantityInput: '1320', promo: 'BOGO' },        // 179 / 1320 = 0.13560 元/抽
    { id: 'item-3', priceInput: '420', quantityInput: '2400', promo: 'SECOND_HALF' }, // 315 / 2400 = 0.13125 元/抽 (最划算!)
  ];

  const results = calculateUnitPrices(items);
  const item3Result = results.find((r) => r.id === 'item-3');
  const item2Result = results.find((r) => r.id === 'item-2');

  assert.equal(item3Result.isWinner, true, '商品 3 (第二件5折後 0.1313 元/抽) 應勝出');
  assert.equal(item2Result.isWinner, false);
  assert.ok(
    item3Result.savingsPercentVsSecond > 3.0 && item3Result.savingsPercentVsSecond < 3.5,
    `第一名應比第二名省約 3.2%，實際為 ${item3Result.savingsPercentVsSecond}%`
  );
});

test('賣場價標 OCR 正規表達式解析：自動擷取價格、複合容量(110抽x24包)與買一送一促銷', () => {
  const rawOcr = '全聯福利中心 春風抽取衛生紙 110抽x12包 買一送一 特價 $358';
  const priceMatch = rawOcr.match(/(?:特價|售價|\$)\s*(\d+)/);
  const multiPackMatch = rawOcr.match(/(\d+)\s*(抽|入|g|ml)\s*[xX*×]\s*(\d+)/);
  const isBogo = /買一送一|買1送1/.test(rawOcr);

  assert.equal(Number(priceMatch[1]), 358);
  assert.equal(Number(multiPackMatch[1]) * Number(multiPackMatch[3]), 1320);
  assert.equal(multiPackMatch[2], '抽');
  assert.equal(isBogo, true);
});
