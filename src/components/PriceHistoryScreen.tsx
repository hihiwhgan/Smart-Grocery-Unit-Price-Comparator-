/**
 * 賣場極簡比價王 - 分頁 2：個人「底價筆記本」歷史儲存清單 (PriceHistoryScreen)
 *
 * 功能亮點：
 * 1. 左滑刪除（Swipe-Left to Delete）：每筆歷史底價紀錄支援手勢左滑拉出醒目的紅色「🗑️ 刪除」按鈕，滑到底亦可直接刪除。
 * 2. 一鍵清除全部紀錄（Clear All）：頂部設有醒目的「🗑️ 一鍵清除全部紀錄」按鈕，並附防呆確認提示。
 * 3. 支援「賣場篩選器」（全部、全聯、家樂福、好市多、大潤發、愛買）與「關鍵字搜尋」。
 * 4. 點擊任意歷史紀錄上的「⚡ 帶入比價」按鈕，可立即將該歷史商品帶回「比價計算」分頁與現場商品比價。
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  PriceHistoryRecord,
  PROMO_OPTIONS,
  STORE_OPTIONS,
  StoreName,
} from '../types/grocery';
import { formatUnitPrice } from '../utils/calculator';

interface PriceHistoryScreenProps {
  records: PriceHistoryRecord[];
  onLoadRecordIntoComparator: (record: PriceHistoryRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAllRecords: () => void;
}

/**
 * 支援手勢左滑刪除的單筆歷史底價卡片元件
 */
const SwipeableHistoryItem: React.FC<{
  item: PriceHistoryRecord;
  promoLabel: string | null;
  onLoadRecordIntoComparator: (record: PriceHistoryRecord) => void;
  onDeleteRecord: (id: string) => void;
}> = ({
  item,
  promoLabel,
  onLoadRecordIntoComparator,
  onDeleteRecord,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -110));
        } else {
          translateX.setValue(0);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -130) {
          // 大幅左滑到底直接刪除
          onDeleteRecord(item.id);
        } else if (gestureState.dx < -45) {
          // 展開右側紅色刪除按鈕
          Animated.spring(translateX, {
            toValue: -92,
            useNativeDriver: true,
          }).start();
        } else {
          // 收回
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      {/* 底層紅色左滑刪除區 */}
      <View style={styles.deleteBackLayer}>
        <TouchableOpacity
          style={styles.swipeDeleteActionBtn}
          onPress={() => onDeleteRecord(item.id)}
        >
          <Text style={styles.swipeDeleteIcon}>🗑️</Text>
          <Text style={styles.swipeDeleteText}>刪除</Text>
        </TouchableOpacity>
      </View>

      {/* 上層可左滑的紀錄卡片 */}
      <Animated.View
        style={[
          styles.recordCard,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* 中間商品與賣場資訊 */}
        <View style={styles.recordInfo}>
          <View style={styles.storeDateRow}>
            <View style={styles.storeBadge}>
              <Text style={styles.storeBadgeText}>
                📍 {item.storeName.split(' ')[0]}
              </Text>
            </View>
            <Text style={styles.dateText}>{item.recordedAt}</Text>
            {promoLabel && (
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>{promoLabel}</Text>
              </View>
            )}
          </View>

          <Text style={styles.productNameText}>{item.productName}</Text>

          <View style={styles.priceDetailRow}>
            <Text style={styles.totalPriceText}>
              實付 ${Math.round(item.effectivePrice)}
            </Text>
            <Text style={styles.specText}>
              / {item.quantity} {item.unit}
            </Text>
          </View>

          <View style={styles.unitPriceHighlightBox}>
            <Text style={styles.unitPriceHighlightText}>
              歷史底價：${formatUnitPrice(item.unitPrice)} / {item.unit}
            </Text>
          </View>
        </View>

        {/* 右側操作區：帶入比價 & 左滑提示 */}
        <View style={styles.actionColumn}>
          <TouchableOpacity
            style={styles.compareBtn}
            onPress={() => onLoadRecordIntoComparator(item)}
          >
            <Text style={styles.compareBtnText}>⚡ 帶入比價</Text>
          </TouchableOpacity>
          <Text style={styles.swipeHintText}>⬅ 左滑刪除</Text>
        </View>
      </Animated.View>
    </View>
  );
};

export const PriceHistoryScreen: React.FC<PriceHistoryScreenProps> = ({
  records,
  onLoadRecordIntoComparator,
  onDeleteRecord,
  onClearAllRecords,
}) => {
  const [selectedStore, setSelectedStore] = useState<StoreName | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (selectedStore !== 'ALL' && rec.storeName !== selectedStore) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const matchName = rec.productName.toLowerCase().includes(q);
        const matchStore = rec.storeName.toLowerCase().includes(q);
        return matchName || matchStore;
      }
      return true;
    });
  }, [records, selectedStore, searchQuery]);

  const getPromoBadgeText = (promoType: string) => {
    const found = PROMO_OPTIONS.find((p) => p.id === promoType);
    return found && found.id !== 'NONE' ? found.label : null;
  };

  const handleConfirmClearAll = () => {
    if (records.length === 0) return;
    Alert.alert(
      '🗑️ 確定要一鍵清除所有底價紀錄嗎？',
      `目前共有 ${records.length} 筆儲存的歷史底價，清除後無法復原。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定全部清除',
          style: 'destructive',
          onPress: onClearAllRecords,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* 頂部操作列：左滑提示 + 一鍵清除全部按鈕 */}
      <View style={styles.topHeaderBar}>
        <Text style={styles.swipeBannerHint}>
          💡 提示：將任一筆紀錄「往左滑」即可刪除
        </Text>
        <TouchableOpacity
          style={[
            styles.clearAllBtn,
            records.length === 0 && styles.clearAllBtnDisabled,
          ]}
          disabled={records.length === 0}
          onPress={handleConfirmClearAll}
        >
          <Text style={styles.clearAllBtnText}>🗑️ 一鍵清除全部</Text>
        </TouchableOpacity>
      </View>

      {/* 關鍵字快速搜尋欄 */}
      <View style={styles.searchBoxWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜尋商品名稱（如：衛生紙、鮮乳）..."
          placeholderTextColor="#757575"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearchBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 賣場篩選器橫向按鈕列 */}
      <View style={styles.storeFilterRow}>
        <TouchableOpacity
          style={[
            styles.storeFilterChip,
            selectedStore === 'ALL' && styles.storeFilterChipActive,
          ]}
          onPress={() => setSelectedStore('ALL')}
        >
          <Text
            style={[
              styles.storeFilterText,
              selectedStore === 'ALL' && styles.storeFilterTextActive,
            ]}
          >
            全部賣場 ({records.length})
          </Text>
        </TouchableOpacity>

        {STORE_OPTIONS.map((store) => {
          const active = selectedStore === store;
          const shortName = store.split(' ')[0];
          return (
            <TouchableOpacity
              key={store}
              style={[
                styles.storeFilterChip,
                active && styles.storeFilterChipActive,
              ]}
              onPress={() => setSelectedStore(store)}
            >
              <Text
                style={[
                  styles.storeFilterText,
                  active && styles.storeFilterTextActive,
                ]}
              >
                {shortName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 底價紀錄列表（支援左滑刪除） */}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>目前沒有任何底價紀錄</Text>
            <Text style={styles.emptySubtitle}>
              在「比價計算」分頁點擊「💾 儲存此價格」即可建立您的個人底價筆記本！
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableHistoryItem
            item={item}
            promoLabel={getPromoBadgeText(item.promoType)}
            onLoadRecordIntoComparator={onLoadRecordIntoComparator}
            onDeleteRecord={onDeleteRecord}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  swipeBannerHint: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#424242',
  },
  clearAllBtn: {
    backgroundColor: '#D32F2F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearAllBtnDisabled: {
    backgroundColor: '#BDBDBD',
  },
  clearAllBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  searchBoxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111111',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
  },
  clearSearchBtn: {
    fontSize: 18,
    fontWeight: '900',
    color: '#757575',
    paddingHorizontal: 6,
  },
  storeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  storeFilterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  storeFilterChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  storeFilterText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#333333',
  },
  storeFilterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 24,
  },
  swipeContainer: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#D32F2F',
  },
  deleteBackLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 96,
    backgroundColor: '#D32F2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDeleteActionBtn: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDeleteIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  recordCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  recordInfo: {
    flex: 1,
  },
  storeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  storeBadge: {
    backgroundColor: '#111111',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  storeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#616161',
  },
  promoBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoBadgeText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '800',
  },
  productNameText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },
  priceDetailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  totalPriceText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
  },
  specText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#616161',
  },
  unitPriceHighlightBox: {
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unitPriceHighlightText: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '900',
  },
  actionColumn: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  compareBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  swipeHintText: {
    color: '#9E9E9E',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
    textAlign: 'center',
  },
});
