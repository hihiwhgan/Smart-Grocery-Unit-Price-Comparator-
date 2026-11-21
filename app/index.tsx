/**
 * 賣場極簡比價王 (Smart Grocery Unit Price Comparator) - 主程式入口
 *
 * 視覺與功能規範：
 * - 日系柔和極簡風（Soft Minimalist，暖米白底 `#F7F6F2`）+ 粗框空心按鈕（Thick Outline Hollow Buttons）。
 * - GPS 定位直接顯示「賣場品牌 + 分店名稱」（例如：「全聯福利中心（新竹中正店）」），不再顯示經緯度數字。
 */

import React, { useMemo, useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<'COMPARE' | 'HISTORY'>('COMPARE');

  // 當前賣場與 GPS 分店名稱顯示（直接顯示店名，不顯示經緯度）
  const [currentStore, setCurrentStore] = useState<StoreName>('全聯福利中心');
  const [currentBranchDisplay, setCurrentBranchDisplay] =
    useState<string>('全聯福利中心');
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [showStorePicker, setShowStorePicker] = useState<boolean>(false);

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

  const [activeInput, setActiveInput] = useState<ActiveInputTarget | null>({
    itemId: 'item-1',
    field: 'priceInput',
  });
  const [isKeypadExpanded, setIsKeypadExpanded] = useState<boolean>(true);

  const [magnifierModal, setMagnifierModal] = useState<{
    visible: boolean;
    targetItemId: string;
  }>({
    visible: false,
    targetItemId: 'item-1',
  });

  /** 呼叫手機真實 GPS 硬體定位並直接帶出最近賣場與分店名稱 */
  const handleRealGpsLocate = async () => {
    if (isLocatingGps) return;
    setIsLocatingGps(true);
    try {
      const gpsRes = await LocationStoreService.detectCurrentStoreWithRealGps();
      setCurrentStore(gpsRes.storeName);
      setCurrentBranchDisplay(gpsRes.fullStoreDisplay);
      setCurrentCoords({
        latitude: gpsRes.latitude,
        longitude: gpsRes.longitude,
      });
    } catch (err: any) {
      Alert.alert(
        'GPS 定位提示',
        err?.message || '尚未取得 GPS 訊號，可手動點選賣場清單'
      );
    } finally {
      setIsLocatingGps(false);
    }
  };

  const calculationResults = useMemo(
    () => calculateAllComparisons(items, historyRecords),
    [items, historyRecords]
  );

  const activeCardTitle = useMemo(() => {
    if (!activeInput) return '商品 1';
    const idx = items.findIndex((i) => i.id === activeInput.itemId);
    if (idx === -1) return '商品 1';
    return items[idx].title || `商品 ${idx + 1}`;
  }, [activeInput, items]);

  const magnifierTargetItem = useMemo(
    () =>
      items.find((i) => i.id === magnifierModal.targetItemId) || items[0],
    [items, magnifierModal.targetItemId]
  );

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

  const handleRemoveItem = (id: string) => {
    if (items.length <= 2) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

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
      `商品：${newRecord.productName}\n賣場：${currentBranchDisplay} (${todayStr})\n折後實付：$${Math.round(newRecord.effectivePrice)} (${newRecord.quantity}${newRecord.unit})`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F6F2" />

      {/* 頂部柔和極簡卡片 Header */}
      <View style={styles.topHeaderCard}>
        <View style={styles.titleRow}>
          <Text style={styles.appTitle}>賣場極簡比價王</Text>
          {activeTab === 'COMPARE' && (
            <TouchableOpacity
              style={styles.resetAllBtn}
              onPress={handleResetAllCards}
            >
              <Text style={styles.resetAllBtnText}>清空重算</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 當前賣場顯示（直接顯示店名）與粗框空心 GPS 定位按鈕 */}
        <View style={styles.gpsStoreBar}>
          <TouchableOpacity
            style={styles.storeSelectorButton}
            onPress={() => setShowStorePicker((v) => !v)}
          >
            <Text style={styles.storeSelectorText} numberOfLines={1}>
              當前賣場：{currentBranchDisplay}
            </Text>
            <Text style={styles.dropdownChevron}>⌄</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gpsRefreshBtn}
            onPress={handleRealGpsLocate}
            disabled={isLocatingGps}
          >
            <Text style={styles.gpsRefreshBtnText}>
              {isLocatingGps ? '定位中...' : 'GPS 定位'}
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
                  setCurrentBranchDisplay(store.split(' ')[0]);
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

      {/* 主內容區 */}
      {activeTab === 'COMPARE' ? (
        <View style={styles.compareWorkspace}>
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

      {/* 底部柔和膠囊導覽列 */}
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
            比價計算 ({items.length})
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
            底價紀錄 ({historyRecords.length})
          </Text>
        </TouchableOpacity>
      </View>

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
    backgroundColor: '#F7F6F2',
  },
  topHeaderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E0D8',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2C302E',
  },
  resetAllBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#9CA39E',
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  resetAllBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4A4F4C',
  },
  gpsStoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeSelectorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F6F2',
    borderWidth: 1.5,
    borderColor: '#D5D3CA',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  storeSelectorText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2C302E',
    flex: 1,
  },
  dropdownChevron: {
    fontSize: 16,
    fontWeight: '800',
    color: '#5C615E',
    marginLeft: 6,
  },
  gpsRefreshBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: '#5B836B',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  gpsRefreshBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#466A54',
  },
  storeDropdown: {
    marginTop: 8,
    backgroundColor: '#F7F6F2',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D5D3CA',
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  storeOptionItem: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D5D3CA',
  },
  storeOptionItemActive: {
    backgroundColor: '#EDF3EF',
    borderWidth: 2.5,
    borderColor: '#5B836B',
  },
  storeOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A4F4C',
  },
  storeOptionTextActive: {
    color: '#3F634D',
    fontWeight: '900',
  },
  compareWorkspace: {
    flex: 1,
  },
  cardsScrollArea: {
    flex: 1,
    backgroundColor: '#F7F6F2',
  },
  cardsScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
  },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#EAE7DF',
    padding: 5,
    height: 58,
    alignItems: 'center',
  },
  navTabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  navTabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#2C302E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  navTabText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#7A7E7B',
  },
  navTabTextActive: {
    color: '#2C302E',
    fontWeight: '900',
  },
});
