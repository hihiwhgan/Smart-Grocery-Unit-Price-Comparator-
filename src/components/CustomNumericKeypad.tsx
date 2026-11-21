/**
 * 賣場極簡比價王 - 單手拇指操作熱區：底部固定大型數字鍵盤與快捷操作台
 *
 * 視覺風格：日系柔和極簡風（Soft Minimalist）+ 粗框空心按鈕（Thick Outline Hollow Buttons）
 * - 「＋ 新增比價商品」：2.5px 深岩灰粗框空心膠囊按鈕 (`#3E423F`)
 * - 「🔍 放大鏡看標價」：2.5px 鼠尾草綠粗框空心膠囊按鈕 (`#5B836B`)
 * - 「清除」：2.5px 乾燥玫瑰粉粗框空心按鈕 (`#B86B6B`)
 * - 「下一欄 ➔」：2.5px 鼠尾草綠粗框空心大按鍵 (`#5B836B`)
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActiveInputTarget } from '../types/grocery';

interface CustomNumericKeypadProps {
  activeInput: ActiveInputTarget | null;
  activeCardTitle: string;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onNextField: () => void;
  onAddProduct: () => void;
  onQuickCameraSimulate: () => void;
  onToggleKeypad: () => void;
  isExpanded: boolean;
}

const KEY_ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
];

export const CustomNumericKeypad: React.FC<CustomNumericKeypadProps> = ({
  activeInput,
  activeCardTitle,
  onKeyPress,
  onBackspace,
  onClear,
  onNextField,
  onAddProduct,
  onQuickCameraSimulate,
  onToggleKeypad,
  isExpanded,
}) => {
  const fieldName =
    activeInput?.field === 'priceInput' ? '總價格 (元)' : '總容量/數量';

  return (
    <View style={styles.bottomThumbDock}>
      {/* 單手拇指快捷列（粗框空心膠囊按鈕）：+ 新增比價商品 & 🔍 放大鏡看標價 */}
      <View style={styles.thumbActionBar}>
        <TouchableOpacity
          style={styles.addProductBtn}
          onPress={onAddProduct}
          activeOpacity={0.8}
        >
          <Text style={styles.addProductBtnText}>＋ 新增比價商品</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickOcrBtn}
          onPress={onQuickCameraSimulate}
          activeOpacity={0.8}
        >
          <Text style={styles.quickOcrBtnText}>🔍 放大鏡看標價</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.collapseBtn}
          onPress={onToggleKeypad}
          activeOpacity={0.8}
        >
          <Text style={styles.collapseBtnText}>
            {isExpanded ? '▼ 收起' : '▲ 鍵盤'}
          </Text>
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <>
          {/* 當前正在輸入的目標提示條 */}
          <View style={styles.activeTargetBar}>
            <Text style={styles.activeTargetText}>
              正在輸入：<Text style={styles.highlightText}>{activeCardTitle}</Text> 的{' '}
              <Text style={styles.highlightText}>{fieldName}</Text>
            </Text>
          </View>

          {/* 大型柔和數字鍵盤 */}
          <View style={styles.keypadBody}>
            <View style={styles.numbersGrid}>
              {KEY_ROWS.map((row, rIdx) => (
                <View key={rIdx} style={styles.keyRow}>
                  {row.map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={styles.numKey}
                      onPress={() => {
                        if (k === '⌫') {
                          onBackspace();
                        } else {
                          onKeyPress(k);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.numKeyText}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {/* 右側功能大按鍵區（粗框空心） */}
            <View style={styles.sideActionColumn}>
              <TouchableOpacity
                style={styles.clearKey}
                onPress={onClear}
                activeOpacity={0.75}
              >
                <Text style={styles.clearKeyText}>清除</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickDoubleZeroKey}
                onPress={() => onKeyPress('00')}
                activeOpacity={0.75}
              >
                <Text style={styles.numKeyText}>00</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.nextFieldKey}
                onPress={onNextField}
                activeOpacity={0.8}
              >
                <Text style={styles.nextFieldKeyText}>下一欄 ➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomThumbDock: {
    backgroundColor: '#EAE7DF',
    borderTopWidth: 1,
    borderTopColor: '#DCD9D0',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  thumbActionBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addProductBtn: {
    flex: 1.2,
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: '#3E423F',
    borderRadius: 22,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProductBtnText: {
    color: '#2C302E',
    fontSize: 16,
    fontWeight: '800',
  },
  quickOcrBtn: {
    flex: 1.2,
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: '#5B836B',
    borderRadius: 22,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickOcrBtnText: {
    color: '#466A54',
    fontSize: 16,
    fontWeight: '800',
  },
  collapseBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#9CA39E',
    borderRadius: 18,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapseBtnText: {
    color: '#4A4F4C',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTargetBar: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  activeTargetText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2C302E',
  },
  highlightText: {
    color: '#466A54',
    fontWeight: '900',
  },
  keypadBody: {
    flexDirection: 'row',
    gap: 8,
  },
  numbersGrid: {
    flex: 3,
    gap: 7,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 7,
  },
  numKey: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCD9D0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C302E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  numKeyText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#2C302E',
  },
  sideActionColumn: {
    flex: 1.05,
    gap: 7,
  },
  clearKey: {
    height: 48,
    backgroundColor: '#EFECE6',
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#B86B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearKeyText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#A65858',
  },
  quickDoubleZeroKey: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCD9D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextFieldKey: {
    flex: 1,
    backgroundColor: '#E5EDE8',
    borderWidth: 2.5,
    borderColor: '#5B836B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  nextFieldKeyText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#3F634D',
  },
});
