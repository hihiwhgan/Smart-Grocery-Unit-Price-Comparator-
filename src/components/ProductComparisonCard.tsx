/**
 * 賣場極簡比價王 - 單一商品比價卡片元件 (ProductComparisonCard)
 *
 * 視覺風格：日系柔和極簡風（Soft Minimalist）+ 粗框空心按鈕（Thick Outline Hollow Buttons）
 * - 背景與卡片：暖米白底搭配柔霧白卡片 (`#FFFFFF`) 與 `1.5px` 柔和暖灰邊框 (`#E2E0D8`)。
 * - 主色調：莫蘭迪鼠尾草綠 (`#5B836B`)；警示/較貴：乾燥玫瑰粉 (`#B86B6B`)；文字：溫潤深炭灰 (`#2C302E`)。
 * - 所有按鈕與選中標籤皆採用 `2.5px` 粗框空心設計，無沉重實心色塊。
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
  onOpenMagnifier: (id: string) => void;
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
  onOpenMagnifier,
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
      {/* 勝出皇冠橫幅 (粗框空心柔和綠橫幅) */}
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

      {/* 頂部標題列：粗框空心編號 + 商品名稱 + 粗框空心放大鏡按鈕 + 刪除鈕 */}
      <View style={styles.headerRow}>
        <View style={styles.titleBadge}>
          <Text style={styles.indexNumber}>#{index + 1}</Text>
        </View>
        <TextInput
          style={styles.titleInput}
          value={item.title}
          onChangeText={(text) => onUpdateTitle(item.id, text)}
          placeholder={`商品 ${index + 1} 名稱`}
          placeholderTextColor="#9CA39E"
        />

        {/* 粗框空心水平「🔍 放大鏡」按鈕 */}
        <TouchableOpacity
          style={styles.magnifierButton}
          onPress={() => onOpenMagnifier(item.id)}
          accessibilityLabel="開啟相機放大鏡看價標"
        >
          <Text style={styles.magnifierButtonText}>🔍 放大鏡</Text>
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

      {/* 歷史底價柔和提醒列 */}
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
            {result.historyAlert.status === 'NEW_LOW' && '🌿 '}
            {result.historyAlert.status === 'CHEAPER_THAN_LAST' && '🟢 '}
            {result.historyAlert.status === 'MORE_EXPENSIVE' && '🔸 '}
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
            <Text
              style={[
                styles.currencyPrefix,
                !item.priceInput && styles.placeholderText,
              ]}
            >
              $
            </Text>
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

      {/* 常用單位快捷選擇鈕 (粗框空心選取態) */}
      <View style={styles.selectorRow}>
        <Text style={styles.selectorLabel}>單位:</Text>
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

      {/* 賣場常見促銷折扣快捷鍵 (粗框空心選取態) */}
      <View style={styles.selectorRow}>
        <Text style={styles.selectorLabel}>促銷:</Text>
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

      {/* 底部即時換算結果列 + 粗框空心「儲存此價格」按鈕 */}
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
          <Text
            style={[
              styles.saveButtonText,
              !result.isValid && styles.saveButtonTextDisabled,
            ]}
          >
            💾 儲存此價格
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E0D8',
    padding: 15,
    marginBottom: 14,
    shadowColor: '#2C302E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  winnerCard: {
    borderWidth: 2.5,
    borderColor: '#5B836B',
    backgroundColor: '#FAFDFB',
  },
  winnerBanner: {
    backgroundColor: '#F2F7F4',
    borderWidth: 2,
    borderColor: '#5B836B',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winnerBannerText: {
    color: '#466A54',
    fontSize: 16,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  titleBadge: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#5B836B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  indexNumber: {
    color: '#5B836B',
    fontWeight: '800',
    fontSize: 15,
  },
  titleInput: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
    color: '#2C302E',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E4DC',
    paddingVertical: 3,
  },
  magnifierButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3E423F',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  magnifierButtonText: {
    color: '#2C302E',
    fontWeight: '800',
    fontSize: 14,
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9CA39E',
  },
  historyAlertBox: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  historyAlertSuccess: {
    backgroundColor: '#F2F7F4',
    borderColor: '#5B836B',
  },
  historyAlertDanger: {
    backgroundColor: '#FDF6F6',
    borderColor: '#B86B6B',
  },
  historyAlertText: {
    fontSize: 14,
    fontWeight: '800',
  },
  historyAlertTextSuccess: {
    color: '#466A54',
  },
  historyAlertTextDanger: {
    color: '#A65858',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  inputFieldBox: {
    flex: 1,
    backgroundColor: '#F7F6F2',
    borderWidth: 1.5,
    borderColor: '#D5D3CA',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputFieldBoxFocused: {
    borderColor: '#5B836B',
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5C615E',
    marginBottom: 3,
  },
  inputValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencyPrefix: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C302E',
    marginRight: 3,
  },
  inputValueText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#2C302E',
  },
  placeholderText: {
    color: '#B5B3AA',
  },
  unitSuffix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5C615E',
    marginLeft: 4,
  },
  discountedSubtext: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5B836B',
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
    color: '#5C615E',
    width: 46,
  },
  pillGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitPill: {
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 18,
    backgroundColor: '#F7F6F2',
    borderWidth: 1.5,
    borderColor: '#D5D3CA',
  },
  unitPillActive: {
    backgroundColor: '#EDF3EF',
    borderWidth: 2.5,
    borderColor: '#5B836B',
  },
  unitPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A4F4C',
  },
  unitPillTextActive: {
    color: '#3F634D',
    fontWeight: '900',
  },
  promoPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F7F6F2',
    borderWidth: 1.5,
    borderColor: '#D5D3CA',
  },
  promoPillActive: {
    backgroundColor: '#EDF3EF',
    borderWidth: 2.5,
    borderColor: '#5B836B',
  },
  promoPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A4F4C',
  },
  promoPillTextActive: {
    color: '#3F634D',
    fontWeight: '900',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#ECEAE2',
    paddingTop: 10,
    marginTop: 4,
  },
  unitPriceResultBox: {
    flex: 1,
  },
  unitPriceCaption: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A7E7B',
  },
  unitPriceNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitPriceBigValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2C302E',
  },
  winnerText: {
    color: '#466A54',
  },
  loserText: {
    color: '#A65858',
  },
  perUnitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5C615E',
  },
  extraCostBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#B86B6B',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  extraCostBadgeText: {
    color: '#A65858',
    fontSize: 12,
    fontWeight: '800',
  },
  waitingInputText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA39E',
  },
  saveButton: {
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: '#5B836B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  saveButtonDisabled: {
    borderColor: '#D5D3CA',
  },
  saveButtonText: {
    color: '#466A54',
    fontSize: 14,
    fontWeight: '800',
  },
  saveButtonTextDisabled: {
    color: '#B5B3AA',
  },
});
