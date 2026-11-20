/**
 * 賣場極簡比價王 - 分頁 2：個人「底價筆記本」歷史儲存清單 (PriceHistoryScreen)
 *
 * 功能亮點：
 * - 支援「賣場篩選器」（全部、全聯、家樂福、好市多、大潤發、愛買）一鍵切換。
 * - 支援「關鍵字 / 條碼搜尋」快速查找過去買過的價格。
 * - 每筆紀錄顯示：商品縮圖標記、購買賣場、當天日期、折後總價、容量規格與換算單價。
 * - 點擊任意歷史紀錄上的「⚡ 帶入比價」按鈕，可立即將該歷史商品帶回「比價計算」分頁與貨架現場商品對決。
 */

import React, { useMemo, useState } from 'react';
import {
  FlatList,
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
}

export const PriceHistoryScreen: React.FC<PriceHistoryScreenProps> = ({
  records,
  onLoadRecordIntoComparator,
  onDeleteRecord,
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
        const matchBarcode = rec.barcode ? rec.barcode.includes(q) : false;
        return matchName || matchStore || matchBarcode;
      }
      return true;
    });
  }, [records, selectedStore, searchQuery]);

  const getPromoBadgeText = (promoType: string) => {
    const found = PROMO_OPTIONS.find((p) => p.id === promoType);
    return found && found.id !== 'NONE' ? found.label : null;
  };

  return (
    <View style={styles.container}>
      {/* 關鍵字與條碼快速搜尋欄 */}
      <View style={styles.searchBoxWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜尋商品名稱、衛生紙、鮮乳或條碼..."
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

      {/* 底價紀錄列表 */}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>尚無符合的底價紀錄</Text>
            <Text style={styles.emptySubtitle}>
              在「比價計算」分頁點擊「💾 儲存此價格」即可建立您的個人底價筆記本！
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const promoLabel = getPromoBadgeText(item.promoType);
          return (
            <View style={styles.recordCard}>
              {/* 左側商品價標照片縮圖區 */}
              <View style={styles.thumbnailBox}>
                <Text style={styles.thumbnailEmoji}>🏷️</Text>
                <Text style={styles.thumbnailCaption}>價標縮圖</Text>
              </View>

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

              {/* 右側操作區：帶入比價 & 刪除 */}
              <View style={styles.actionColumn}>
                <TouchableOpacity
                  style={styles.compareBtn}
                  onPress={() => onLoadRecordIntoComparator(item)}
                >
                  <Text style={styles.compareBtnText}>⚡ 帶入比價</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => onDeleteRecord(item.id)}
                >
                  <Text style={styles.removeBtnText}>刪除</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingTop: 12,
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
  recordCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    gap: 10,
  },
  thumbnailBox: {
    width: 64,
    height: 76,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailEmoji: {
    fontSize: 26,
  },
  thumbnailCaption: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
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
    fontSize: 17,
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
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  specText: {
    fontSize: 14,
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
    fontSize: 14,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeBtnText: {
    color: '#D32F2F',
    fontSize: 13,
    fontWeight: '700',
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
