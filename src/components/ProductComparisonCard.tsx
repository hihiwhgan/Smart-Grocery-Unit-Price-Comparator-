/**
 * 賣場極簡比價王 - 單一商品比價卡片元件 (ProductComparisonCard)
 *
 * 設計規範：
 * - 白底黑字大字體、高對比視覺設計。
 * - 最划算選項（isWinner）：高飽和綠色（#2E7D32）粗邊框 + 皇冠圖示 + 「比第二名省 X%」醒目徽章。
 * - 較貴或歷史比對漲價：警示橘紅色（#D32F2F）標示。
 * - 內建常用單位快捷選擇鈕（g、ml、抽、入、包）與促銷折扣一鍵換算（買一送一、第二件5折、85折、打8折）。
 * - 點擊「總價格」或「總容量/數量」輸入框時，不彈出系統小鍵盤，而是喚起固定於螢幕下半部的大型數字鍵盤。
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import {
  ActiveInputTarget,
  CalculatedItemResult,
  ComparisonItem,
  PROMO_OPTIONS,
  PromoType,
  UNIT_OPTIONS,
  UnitType,
} from '../types/grocery';
import { formatUnitPrice } from '../utils/calculator';

interface ProductComparisonCardProps {
  item: ComparisonItem;
  index: number;
  totalItemsCount: number;
  result: CalculatedItemResult;
  activeInput: ActiveInputTarget | null;
  onFocusField: (target: ActiveInputTarget) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onSelectUnit: (id: string, unit: UnitType) => void;
  onSelectPromo: (id: string, promo: PromoType) => void;
  onRemoveItem: (id: string) => void;
  onOpenCameraOcr: (id: string) => void;
  onOpenBarcodeScan: (id: string) => void;
  onSaveToNotebook: (id: string) => void;
}

export const ProductComparisonCard: React.FC<ProductComparisonCardProps> = ({
  item,
  index,
  totalItemsCount,
  result,
  activeInput,
  onFocusField,
  onUpdateTitle,
  onSelectUnit,
  onSelectPromo,
  onRemoveItem,
  onOpenCameraOcr,
  onOpenBarcodeScan,
  onSaveToNotebook,
}) => {
  const isPriceFocused =
    activeInput?.itemId === item.id && activeInput?.field === 'priceInput';
  const isQtyFocused =
    activeInput?.itemId === item.id && activeInput?.field === 'quantityInput';

  return (
    <View
      style={[
        styles.card,
        result.isWinner && styles.winnerCard,
      ]}
    >
      {/* 勝出皇冠橫幅 (Winner Banner) */}
      {result.isWinner && (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerBannerText}>
            👑 最划算首選！
            {result.savingsPercentVsSecond !== null
              ? ` 比第二名省 ${result.savingsPercentVsSecond}%`
              : ' 目前單價最低'}
          </Text>
        </View>
      )}

      {/* 頂部標題列：商品名稱 + 相機拍照 OCR + 條碼掃描 + 刪除鈕 */}
      <View style={styles.headerRow}>
        <View style={styles.titleBadge}>
          <Text style={styles.indexNumber}>#{index + 1}</Text>
        </View>
        <TextInput
          style={styles.titleInput}
          value={item.title}
          onChangeText={(text) => onUpdateTitle(item.id, text)}
          placeholder={`商品 ${index + 1} 名稱`}
          placeholderTextColor="#757575"
        />

        {/* 相機 OCR 價標辨識按鈕 */}
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => onOpenCameraOcr(item.id)}
          accessibilityLabel="拍照辨識價標"
        >
          <Text style={styles.cameraButtonText}>📷 拍價標</Text>
        </TouchableOpacity>

        {/* 條碼掃描按鈕 */}
        <TouchableOpacity
          style={styles.barcodeButton}
          onPress={() => onOpenBarcodeScan(item.id)}
          accessibilityLabel="掃描商品條碼"
        >
          <Text style={styles.barcodeButtonText}>🏷️ 條碼</Text>
        </TouchableOpacity>

        {totalItemsCount > 2 && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onRemoveItem(item.id)}
            accessibilityLabel="刪除此商品"
          >
            <Text style={styles.deleteButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 歷史底價紅綠燈提醒列 */}
      {result.historyAlert && (
        <View
          style={[
            styles.historyAlertBox,
            result.historyAlert.status === 'MORE_EXPENSIVE'
              ? styles.historyAlertDanger
              : styles.historyAlertSuccess,
          ]}
        >
          <Text
            style={[
              styles.historyAlertText,
              result.historyAlert.status === 'MORE_EXPENSIVE'
                ? styles.historyAlertTextDanger
                : styles.historyAlertTextSuccess,
            ]}
          >
            {result.historyAlert.status === 'NEW_LOW' && '🔥 '}
            {result.historyAlert.status === 'CHEAPER_THAN_LAST' && '🟢 '}
            {result.historyAlert.status === 'MORE_EXPENSIVE' && '🔴 '}
            {result.historyAlert.message}
          </Text>
        </View>
      )}

      {/* 核心大字體輸入區：左邊「總價格」、右邊「總容量/數量」 */}
      <View style={styles.inputsRow}>
        {/* 總價格輸入框 */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.inputFieldBox,
            isPriceFocused && styles.inputFieldBoxFocused,
          ]}
          onPress={() =>
            onFocusField({ itemId: item.id, field: 'priceInput' })
          }
        >
          <Text style={styles.inputLabel}>總價格 (元)</Text>
          <View style={styles.inputValueRow}>
            <Text style={styles.currencyPrefix}>$</Text>
            <Text
              style={[
                styles.inputValueText,
                !item.priceInput && styles.placeholderText,
              ]}
            >
              {item.priceInput || '0'}
            </Text>
          </View>
          {item.promo !== 'NONE' && result.isValid && (
            <Text style={styles.discountedSubtext}>
              折後實付 ${Math.round(result.effectiveTotalPrice * 10) / 10}
            </Text>
          )}
        </TouchableOpacity>

        {/* 總容量/數量輸入框 */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.inputFieldBox,
            isQtyFocused && styles.inputFieldBoxFocused,
          ]}
          onPress={() =>
            onFocusField({ itemId: item.id, field: 'quantityInput' })
          }
        >
          <Text style={styles.inputLabel}>總容量 / 數量</Text>
          <View style={styles.inputValueRow}>
            <Text
              style={[
                styles.inputValueText,
                !item.quantityInput && styles.placeholderText,
              ]}
            >
              {item.quantityInput || '0'}
            </Text>
            <Text style={styles.unitSuffix}>{item.unit}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 常用單位快捷選擇鈕 (g, ml, 抽, 入, 包) */}
      <View style={styles.selectorRow}>
        <Text style={styles.selectorLabel}>單位：</Text>
        <View style={styles.pillGroup}>
          {UNIT_OPTIONS.map((u) => {
            const active = item.unit === u;
            return (
              <TouchableOpacity
                key={u}
                style={[styles.unitPill, active && styles.unitPillActive]}
                onPress={() => onSelectUnit(item.id, u)}
              >
                <Text
                  style={[
                    styles.unitPillText,
                    active && styles.unitPillTextActive,
                  ]}
                >
                  {u}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 賣場常見促銷折扣快捷鍵 */}
      <View style={styles.selectorRow}>
        <Text style={styles.selectorLabel}>促銷：</Text>
        <View style={styles.pillGroup}>
          {PROMO_OPTIONS.map((p) => {
            const active = item.promo === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.promoPill, active && styles.promoPillActive]}
                onPress={() => onSelectPromo(item.id, p.id)}
              >
                <Text
                  style={[
                    styles.promoPillText,
                    active && styles.promoPillTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 底部即時換算結果列 + 一鍵儲存此價格按鈕 */}
      <View style={styles.footerRow}>
        <View style={styles.unitPriceResultBox}>
          <Text style={styles.unitPriceCaption}>換算單價</Text>
          {result.isValid ? (
            <View style={styles.unitPriceNumbersRow}>
              <Text
                style={[
                  styles.unitPriceBigValue,
                  result.isWinner && styles.winnerText,
                  !result.isWinner &&
                    result.extraCostPercentVsWinner !== null &&
                    styles.loserText,
                ]}
              >
                ${formatUnitPrice(result.unitPrice)}
                <Text style={styles.perUnitText}> / {item.unit}</Text>
              </Text>
              {!result.isWinner &&
                result.extraCostPercentVsWinner !== null && (
                  <View style={styles.extraCostBadge}>
                    <Text style={styles.extraCostBadgeText}>
                      貴 {result.extraCostPercentVsWinner}%
                    </Text>
                  </View>
                )}
            </View>
          ) : (
            <Text style={styles.waitingInputText}>請輸入價格與容量</Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            !result.isValid && styles.saveButtonDisabled,
          ]}
          disabled={!result.isValid}
          onPress={() => onSaveToNotebook(item.id)}
        >
          <Text style={styles.saveButtonText}>💾 儲存此價格</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  winnerCard: {
    borderWidth: 3.5,
    borderColor: '#2E7D32',
    backgroundColor: '#F4FBF4',
  },
  winnerBanner: {
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerBannerText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  titleBadge: {
    backgroundColor: '#1B5E20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  indexNumber: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 2,
  },
  cameraButton: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  cameraButtonText: {
    color: '#1B5E20',
    fontWeight: '800',
    fontSize: 14,
  },
  barcodeButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  barcodeButtonText: {
    color: '#333333',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9E9E9E',
  },
  historyAlertBox: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  historyAlertSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  historyAlertDanger: {
    backgroundColor: '#FFEBEE',
    borderColor: '#D32F2F',
  },
  historyAlertText: {
    fontSize: 15,
    fontWeight: '800',
  },
  historyAlertTextSuccess: {
    color: '#2E7D32',
  },
  historyAlertTextDanger: {
    color: '#D32F2F',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inputFieldBox: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 2,
    borderColor: '#BDBDBD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputFieldBoxFocused: {
    borderColor: '#2E7D32',
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#424242',
    marginBottom: 2,
  },
  inputValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    marginRight: 3,
  },
  inputValueText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111111',
  },
  placeholderText: {
    color: '#BDBDBD',
  },
  unitSuffix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#424242',
    marginLeft: 4,
  },
  discountedSubtext: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2E7D32',
    marginTop: 2,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#424242',
    width: 48,
  },
  pillGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  unitPillActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  unitPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
  },
  unitPillTextActive: {
    color: '#FFFFFF',
  },
  promoPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  promoPillActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  promoPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333333',
  },
  promoPillTextActive: {
    color: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 10,
    marginTop: 2,
  },
  unitPriceResultBox: {
    flex: 1,
  },
  unitPriceCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: '#616161',
  },
  unitPriceNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitPriceBigValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
  },
  winnerText: {
    color: '#2E7D32',
  },
  loserText: {
    color: '#D32F2F',
  },
  perUnitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#424242',
  },
  extraCostBadge: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#D32F2F',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  extraCostBadgeText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '800',
  },
  waitingInputText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  saveButton: {
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
