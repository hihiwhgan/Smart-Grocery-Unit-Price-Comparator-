/**
 * 賣場極簡比價王 (Smart Grocery Unit Price Comparator) - 主程式入口
 *
 * 架構規範：
 * - 全 App 僅包含 2 個主要分頁（Bottom Navigation Bar）：
 *   1. 「比價計算」（預設首頁：多商品動態卡片列表、真實手機 GPS 賣場自動定位、長輩友善相機放大鏡按鈕、底部固定 45% 單手拇指操作區）
 *   2. 「底價紀錄」（個人底價筆記本：支援手勢左滑刪除、一鍵清除全部紀錄、賣場篩選器、關鍵字搜尋）
 * - 100% 離線優先（Offline-First）：連接本機 SQLite 資料庫 (`src/db/schema.ts`)。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraSimulatorModal } from '../src/components/CameraSimulatorModal';
import { CustomNumericKeypad } from '../src/components/CustomNumericKeypad';
import { PriceHistoryScreen } from '../src/components/PriceHistoryScreen';
import { ProductComparisonCard } from '../src/components/ProductComparisonCard';
import { INITIAL_SEED_RECORDS } from '../src/db/schema';
import {
  KNOWN_STORE_GEOFENCES,
  LocationStoreService,
} from '../src/services/hardwareService';
import {
  ActiveInputTarget,
  ComparisonItem,
  PriceHistoryRecord,
  PromoType,
  STORE_OPTIONS,
  StoreName,
  UnitType,
} from '../src/types/grocery';
import { calculateAllComparisons } from '../src/utils/calculator';

export default function AppMainScreen() {
  // 底部導覽列分頁 ('COMPARE' | 'HISTORY')
  const [activeTab, setActiveTab] = useState<'COMPARE' | 'HISTORY'>('COMPARE');

  // 真實 GPS 自動定位賣場與經緯度座標狀態
  const [currentStore, setCurrentStore] = useState<StoreName>('全聯福利中心');
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });
  const [gpsStatusText, setGpsStatusText] = useState<string>(
    '正在讀取手機 GPS 定位...'
  );
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [showStorePicker, setShowStorePicker] = useState<boolean>(false);

  // 本機 SQLite 底價筆記本紀錄狀態
  const [historyRecords, setHistoryRecords] = useState<PriceHistoryRecord[]>(
    INITIAL_SEED_RECORDS
  );

  // 多商品動態比價卡片列表（預設顯示空白的「商品 1」與「商品 2」）
  const [items, setItems] = useState<ComparisonItem[]>([
    {
      id: 'item-1',
      title: '商品 1',
      priceInput: '',
      quantityInput: '',
      packCountInput: '1',
      unit: 'g',
      promo: 'NONE',
    },
    {
      id: 'item-2',
      title: '商品 2',
      priceInput: '',
      quantityInput: '',
      packCountInput: '1',
      unit: 'g',
      promo: 'NONE',
    },
  ]);

  // 當前下方固定大型數字鍵盤對焦的輸入框
  const [activeInput, setActiveInput] = useState<ActiveInputTarget | null>({
    itemId: 'item-1',
    field: 'priceInput',
  });
  const [isKeypadExpanded, setIsKeypadExpanded] = useState<boolean>(true);

  // 長輩友善「相機高倍率放大鏡」視窗狀態
  const [magnifierModal, setMagnifierModal] = useState<{
    visible: boolean;
    targetItemId: string;
  }>({
    visible: false,
    targetItemId: 'item-1',
  });

  /** 啟動時自動請求手機真實 GPS 定位並判斷所在賣場 */
  useEffect(() => {
    handleRealGpsLocate();
  }, []);

  /** 呼叫手機真實 GPS 硬體定位並計算距離最近的賣場 */
  const handleRealGpsLocate = async () => {
    if (isLocatingGps) return;
    setIsLocatingGps(true);
    setGpsStatusText('🛰️ 正在透過手機 GPS 定位所在賣場...');
    try {
      const gpsRes = await LocationStoreService.detectCurrentStoreWithRealGps();
      setCurrentStore(gpsRes.storeName);
      setCurrentCoords({
        latitude: gpsRes.latitude,
        longitude: gpsRes.longitude,
      });
      const distKm =
        gpsRes.distanceMeters >= 1000
          ? `${(gpsRes.distanceMeters / 1000).toFixed(1)}km`
          : `${gpsRes.distanceMeters}m`;
      setGpsStatusText(
        `GPS (${gpsRes.latitude.toFixed(4)}, ${gpsRes.longitude.toFixed(4)}) · 最近：${gpsRes.districtLabel} (${distKm})`
      );
    } catch (err: any) {
      setGpsStatusText(
        `GPS 提示：${err?.message || '尚未取得 GPS 訊號，可手動切換賣場'}`
      );
    } finally {
      setIsLocatingGps(false);
    }
  };

  // 即時計算所有商品的折後單價、勝出皇冠與歷史紅綠燈比對
  const calculationResults = useMemo(
    () => calculateAllComparisons(items, historyRecords),
    [items, historyRecords]
  );

  // 取得當前對焦商品的名稱
  const activeCardTitle = useMemo(() => {
    if (!activeInput) return '商品 1';
    const idx = items.findIndex((i) => i.id === activeInput.itemId);
    if (idx === -1) return '商品 1';
    return items[idx].title || `商品 ${idx + 1}`;
  }, [activeInput, items]);

  // 取得放大鏡對應的商品卡片
  const magnifierTargetItem = useMemo(
    () =>
      items.find((i) => i.id === magnifierModal.targetItemId) || items[0],
    [items, magnifierModal.targetItemId]
  );

  /** 動態新增商品卡片（商品 3、商品 4...） */
  const handleAddProduct = () => {
    const nextNumber = items.length + 1;
    const defaultUnit: UnitType = items[0]?.unit || 'g';
    const newId = `item-${Date.now()}`;
    const newItem: ComparisonItem = {
      id: newId,
      title: `商品 ${nextNumber}`,
      priceInput: '',
      quantityInput: '',
      packCountInput: '1',
      unit: defaultUnit,
      promo: 'NONE',
    };
    setItems((prev) => [...prev, newItem]);
    setActiveInput({ itemId: newId, field: 'priceInput' });
    setIsKeypadExpanded(true);
  };

  /** 刪除單一商品卡片（至少保留 2 張卡片比價） */
  const handleRemoveItem = (id: string) => {
    if (items.length <= 2) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  /** 重置清空所有比價卡片 */
  const handleResetAllCards = () => {
    const firstId = `item-${Date.now()}-1`;
    const secondId = `item-${Date.now()}-2`;
    setItems([
      {
        id: firstId,
        title: '商品 1',
        priceInput: '',
        quantityInput: '',
        packCountInput: '1',
        unit: 'g',
        promo: 'NONE',
      },
      {
        id: secondId,
        title: '商品 2',
        priceInput: '',
        quantityInput: '',
        packCountInput: '1',
        unit: 'g',
        promo: 'NONE',
      },
    ]);
    setActiveInput({ itemId: firstId, field: 'priceInput' });
  };

  /** 大型數字鍵盤輸入處理 */
  const handleKeyPress = (key: string) => {
    if (!activeInput) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeInput.itemId) return item;
        const currentVal = item[activeInput.field];
        if (key === '.' && currentVal.includes('.')) {
          return item;
        }
        const nextVal =
          currentVal === '0' && key !== '.' ? key : currentVal + key;
        if (nextVal.length > 8) return item;
        return {
          ...item,
          [activeInput.field]: nextVal,
        };
      })
    );
  };

  const handleBackspace = () => {
    if (!activeInput) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeInput.itemId) return item;
        const currentVal = item[activeInput.field];
        return {
          ...item,
          [activeInput.field]: currentVal.slice(0, -1),
        };
      })
    );
  };

  const handleClearField = () => {
    if (!activeInput) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== activeInput.itemId) return item;
        return {
          ...item,
          [activeInput.field]: '',
        };
      })
    );
  };

  /** 單手「下一欄」循環跳轉：商品 1 價格 -> 商品 1 容量 -> 商品 2 價格 -> 商品 2 容量... */
  const handleNextField = () => {
    if (!activeInput || items.length === 0) return;
    if (activeInput.field === 'priceInput') {
      setActiveInput({ itemId: activeInput.itemId, field: 'quantityInput' });
      return;
    }
    const curIndex = items.findIndex((i) => i.id === activeInput.itemId);
    const nextIndex = (curIndex + 1) % items.length;
    setActiveInput({
      itemId: items[nextIndex].id,
      field: 'priceInput',
    });
  };

  /** 一鍵儲存商品價格至本機「底價筆記本」 (自動帶入當天日期、真實 GPS 經緯度與賣場名稱) */
  const handleSaveToNotebook = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    const calc = calculationResults[itemId];
    if (!item || !calc || !calc.isValid) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const fallbackGeo =
      KNOWN_STORE_GEOFENCES.find((g) => g.storeName === currentStore) ||
      KNOWN_STORE_GEOFENCES[0];

    const newRecord: PriceHistoryRecord = {
      id: `rec-${Date.now()}`,
      productName: item.title.trim() || '未命名商品',
      barcode: null,
      storeName: currentStore,
      latitude: currentCoords.latitude ?? fallbackGeo.latitude,
      longitude: currentCoords.longitude ?? fallbackGeo.longitude,
      originalPrice: parseFloat(item.priceInput),
      effectivePrice: calc.effectiveTotalPrice,
      promoType: item.promo,
      quantity: calc.totalQuantity,
      unit: item.unit,
      unitPrice: calc.unitPrice,
      photoUri: null,
      recordedAt: todayStr,
      isHistoricalLowest: true,
    };

    setHistoryRecords((prev) => [newRecord, ...prev]);
    Alert.alert(
      '✅ 已存入底價筆記本',
      `商品：${newRecord.productName}\n賣場：${newRecord.storeName} (${todayStr})\n折後實付：$${Math.round(newRecord.effectivePrice)} (${newRecord.quantity}${newRecord.unit})`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* 頂部狀態列：App 標題 + 真實 GPS 定位狀態 + 賣場切換 */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.appTitle}>賣場極簡比價王</Text>
            <Text style={styles.offlineStatusText} numberOfLines={1}>
              ⚡ {gpsStatusText}
            </Text>
          </View>

          {activeTab === 'COMPARE' && (
            <TouchableOpacity
              style={styles.resetAllBtn}
              onPress={handleResetAllCards}
            >
              <Text style={styles.resetAllBtnText}>🔄 清空重算</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* GPS 當前賣場顯示與真實 GPS 重新定位按鈕 */}
        <View style={styles.gpsStoreBar}>
          <TouchableOpacity
            style={styles.storeSelectorButton}
            onPress={() => setShowStorePicker((v) => !v)}
          >
            <Text style={styles.storeSelectorText}>
              📍 當前賣場：{currentStore} ▾
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gpsRefreshBtn}
            onPress={handleRealGpsLocate}
            disabled={isLocatingGps}
          >
            <Text style={styles.gpsRefreshBtnText}>
              {isLocatingGps ? '🛰️ 定位中...' : '🛰️ 真實 GPS 定位'}
            </Text>
          </TouchableOpacity>
        </View>

        {showStorePicker && (
          <View style={styles.storeDropdown}>
            {STORE_OPTIONS.map((store) => (
              <TouchableOpacity
                key={store}
                style={[
                  styles.storeOptionItem,
                  currentStore === store && styles.storeOptionItemActive,
                ]}
                onPress={() => {
                  setCurrentStore(store);
                  setShowStorePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.storeOptionText,
                    currentStore === store && styles.storeOptionTextActive,
                  ]}
                >
                  {store}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 主內容區：根據底部導覽列切換「比價計算」或「底價紀錄」 */}
      {activeTab === 'COMPARE' ? (
        <View style={styles.compareWorkspace}>
          {/* 上半部：多商品動態比價卡片捲動列表 */}
          <ScrollView
            style={styles.cardsScrollArea}
            contentContainerStyle={styles.cardsScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {items.map((item, idx) => (
              <ProductComparisonCard
                key={item.id}
                item={item}
                index={idx}
                totalItemsCount={items.length}
                result={calculationResults[item.id]}
                activeInput={activeInput}
                onFocusField={(target) => {
                  setActiveInput(target);
                  setIsKeypadExpanded(true);
                }}
                onUpdateTitle={(id, title) =>
                  setItems((prev) =>
                    prev.map((it) => (it.id === id ? { ...it, title } : it))
                  )
                }
                onSelectUnit={(id, unit: UnitType) =>
                  setItems((prev) =>
                    prev.map((it) => (it.id === id ? { ...it, unit } : it))
                  )
                }
                onSelectPromo={(id, promo: PromoType) =>
                  setItems((prev) =>
                    prev.map((it) => (it.id === id ? { ...it, promo } : it))
                  )
                }
                onRemoveItem={handleRemoveItem}
                onOpenMagnifier={(id) =>
                  setMagnifierModal({
                    visible: true,
                    targetItemId: id,
                  })
                }
                onSaveToNotebook={handleSaveToNotebook}
              />
            ))}
          </ScrollView>

          {/* 下半部 45% 單手拇指操作熱區：+ 新增比價商品、🔍 放大鏡看標價與大型數字鍵盤 */}
          <CustomNumericKeypad
            activeInput={activeInput}
            activeCardTitle={activeCardTitle}
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClearField}
            onNextField={handleNextField}
            onAddProduct={handleAddProduct}
            onQuickCameraSimulate={() =>
              setMagnifierModal({
                visible: true,
                targetItemId: activeInput?.itemId || items[0].id,
              })
            }
            onToggleKeypad={() => setIsKeypadExpanded((v) => !v)}
            isExpanded={isKeypadExpanded}
          />
        </View>
      ) : (
        <PriceHistoryScreen
          records={historyRecords}
          onLoadRecordIntoComparator={(record) => {
            const newId = `item-${Date.now()}`;
            setItems((prev) => [
              ...prev,
              {
                id: newId,
                title: `${record.productName} (${record.storeName.split(' ')[0]}歷史價)`,
                priceInput: String(record.originalPrice),
                quantityInput: String(record.quantity),
                packCountInput: '1',
                unit: record.unit,
                promo: record.promoType,
              },
            ]);
            setActiveTab('COMPARE');
          }}
          onDeleteRecord={(id) =>
            setHistoryRecords((prev) => prev.filter((r) => r.id !== id))
          }
          onClearAllRecords={() => setHistoryRecords([])}
        />
      )}

      {/* 底部導覽列 (Bottom Navigation Bar) - 僅包含 2 個主要分頁 */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          style={[
            styles.navTabItem,
            activeTab === 'COMPARE' && styles.navTabItemActive,
          ]}
          onPress={() => setActiveTab('COMPARE')}
        >
          <Text
            style={[
              styles.navTabText,
              activeTab === 'COMPARE' && styles.navTabTextActive,
            ]}
          >
            🧮 比價計算 ({items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navTabItem,
            activeTab === 'HISTORY' && styles.navTabItemActive,
          ]}
          onPress={() => setActiveTab('HISTORY')}
        >
          <Text
            style={[
              styles.navTabText,
              activeTab === 'HISTORY' && styles.navTabTextActive,
            ]}
          >
            📒 底價紀錄 ({historyRecords.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 長輩友善相機高倍率放大鏡視窗 */}
      {magnifierTargetItem && (
        <CameraSimulatorModal
          visible={magnifierModal.visible}
          targetCardTitle={magnifierTargetItem.title || '指定商品卡'}
          currentPrice={magnifierTargetItem.priceInput}
          currentQuantity={magnifierTargetItem.quantityInput}
          currentUnit={magnifierTargetItem.unit}
          onUpdatePrice={(val) =>
            setItems((prev) =>
              prev.map((it) =>
                it.id === magnifierTargetItem.id
                  ? { ...it, priceInput: val }
                  : it
              )
            )
          }
          onUpdateQuantity={(val) =>
            setItems((prev) =>
              prev.map((it) =>
                it.id === magnifierTargetItem.id
                  ? { ...it, quantityInput: val }
                  : it
              )
            )
          }
          onUpdateUnit={(u) =>
            setItems((prev) =>
              prev.map((it) =>
                it.id === magnifierTargetItem.id ? { ...it, unit: u } : it
              )
            )
          }
          onClose={() =>
            setMagnifierModal((prev) => ({ ...prev, visible: false }))
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#111111',
  },
  offlineStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 2,
  },
  resetAllBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resetAllBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
  },
  gpsStoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeSelectorButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  storeSelectorText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  gpsRefreshBtn: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  gpsRefreshBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2E7D32',
  },
  storeDropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#111111',
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  storeOptionItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  storeOptionItemActive: {
    backgroundColor: '#2E7D32',
  },
  storeOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  storeOptionTextActive: {
    color: '#FFFFFF',
  },
  compareWorkspace: {
    flex: 1,
  },
  cardsScrollArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  cardsScrollContent: {
    padding: 12,
    paddingBottom: 24,
  },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#111111',
    height: 60,
  },
  navTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  navTabItemActive: {
    backgroundColor: '#111111',
  },
  navTabText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4B5563',
  },
  navTabTextActive: {
    color: '#FFFFFF',
  },
});
