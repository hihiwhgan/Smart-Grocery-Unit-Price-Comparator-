/**
 * 賣場極簡比價王 - 單手拇指操作熱區：底部固定大型數字鍵盤與快捷操作台
 *
 * 設計規範：
 * - 將「+ 新增比價商品」、「開啟相機模擬辨識」與「大型數字鍵盤」集中配置於螢幕下半部 45% 區域。
 * - 大按鍵、高對比、支援單手推購物車時用大拇指盲按輸入。
 * - 提供「下一個欄位 / 下一張商品卡」一鍵跳轉，無需將手指移到螢幕上半部。
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
      {/* 單手拇指快捷列：+ 新增比價商品 & 📷 相機智慧辨識模擬 */}
      <View style={styles.thumbActionBar}>
        <TouchableOpacity
          style={styles.addProductBtn}
          onPress={onAddProduct}
          activeOpacity={0.85}
        >
          <Text style={styles.addProductBtnText}>＋ 新增比價商品</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickOcrBtn}
          onPress={onQuickCameraSimulate}
          activeOpacity={0.85}
        >
          <Text style={styles.quickOcrBtnText}>📷 相機拍價標</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.collapseBtn}
          onPress={onToggleKeypad}
          activeOpacity={0.85}
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

          {/* 大型高對比數字鍵盤 */}
          <View style={styles.keypadBody}>
            <View style={styles.numbersGrid}>
              {KEY_ROWS.map((row, rIdx) => (
                <View key={rIdx} style={styles.keyRow}>
                  {row.map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={[
                        styles.numKey,
                        k === '⌫' && styles.backspaceKey,
                      ]}
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

            {/* 右側功能大按鍵區 */}
            <View style={styles.sideActionColumn}>
              <TouchableOpacity
                style={styles.clearKey}
                onPress={onClear}
                activeOpacity={0.75}
              >
                <Text style={styles.clearKeyText}>清除</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles. quickDoubleZeroKey}
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
    backgroundColor: '#F3F4F6',
    borderTopWidth: 2,
    borderTopColor: '#BDBDBD',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  thumbActionBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  addProductBtn: {
    flex: 1.3,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProductBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  quickOcrBtn: {
    flex: 1.1,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickOcrBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  collapseBtn: {
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapseBtnText: {
    color: '#212121',
    fontSize: 14,
    fontWeight: '800',
  },
  activeTargetBar: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  activeTargetText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333333',
  },
  highlightText: {
    color: '#2E7D32',
    fontWeight: '900',
  },
  keypadBody: {
    flexDirection: 'row',
    gap: 8,
  },
  numbersGrid: {
    flex: 3,
    gap: 6,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  numKey: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backspaceKey: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFB74D',
  },
  numKeyText: {
    fontSize: 23,
    fontWeight: '900',
    color: '#111111',
  },
  sideActionColumn: {
    flex: 1.05,
    gap: 6,
  },
  clearKey: {
    height: 48,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#EF9A9A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearKeyText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#D32F2F',
  },
  quickDoubleZeroKey: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextFieldKey: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  nextFieldKeyText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});
