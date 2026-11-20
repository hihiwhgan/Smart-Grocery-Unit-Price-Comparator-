/**
 * 賣場極簡比價王 - 長輩友善「相機高倍率放大鏡」元件 (CameraMagnifierModal)
 *
 * 設計理念：
 * - 取消複雜的拍價標與 OCR 辨識，改用手機真實相機實現「大字高倍率放大鏡」，讓長輩在賣場貨架前輕鬆看清楚微小的「標價」與「容量（g/ml/抽）」。
 * - 支援：
 *   1. 一鍵倍率切換：1x、2x、3x、5x 超大字按鈕。
 *   2. ❄️ 凍結畫面（定格）：手抖或高處價標時，按一下定格畫面，即可拿近慢慢看清楚並直接在本視窗輸入該商品的「價格」與「容量」。
 *   3. 🔦 手電筒補光：賣場貨架下層光線昏暗時可一鍵開燈。
 */

import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { UNIT_OPTIONS, UnitType } from '../types/grocery';

interface CameraMagnifierModalProps {
  visible: boolean;
  targetCardTitle: string;
  currentPrice: string;
  currentQuantity: string;
  currentUnit: UnitType;
  onUpdatePrice: (price: string) => void;
  onUpdateQuantity: (qty: string) => void;
  onUpdateUnit: (unit: UnitType) => void;
  onClose: () => void;
}

const ZOOM_LEVELS = [
  { label: '1x 原倍', zoomValue: 0.0, scaleText: '1x' },
  { label: '2x 放大', zoomValue: 0.25, scaleText: '2x' },
  { label: '3x 特大', zoomValue: 0.55, scaleText: '3x' },
  { label: '5x 超大', zoomValue: 0.85, scaleText: '5x' },
];

export const CameraSimulatorModal: React.FC<CameraMagnifierModalProps> = ({
  visible,
  targetCardTitle,
  currentPrice,
  currentQuantity,
  currentUnit,
  onUpdatePrice,
  onUpdateQuantity,
  onUpdateUnit,
  onClose,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [zoomIndex, setZoomIndex] = useState<number>(2); // 預設 3x 特大放大
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [frozenPhotoUri, setFrozenPhotoUri] = useState<string | null>(null);

  /** 凍結 / 解凍畫面（方便長輩拍下價標定格拿近看，不怕手抖） */
  const handleToggleFreeze = async () => {
    if (frozenPhotoUri) {
      setFrozenPhotoUri(null);
      return;
    }
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      if (photo?.uri) {
        setFrozenPhotoUri(photo.uri);
      }
    } catch {
      // ignore if capture fails
    }
  };

  const activeZoom = ZOOM_LEVELS[zoomIndex] || ZOOM_LEVELS[1];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* 頂部大字標題列 */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.titleText}>
                🔍 價標放大鏡 ({activeZoom.scaleText})
              </Text>
              <Text style={styles.subtitleText}>
                對準貨架價標看清楚「價格」與「容量」，正在填寫：{targetCardTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Text style={styles.closeIconText}>✕ 關閉</Text>
            </TouchableOpacity>
          </View>

          {/* 相機放大鏡取景窗 */}
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>
                請開啟相機權限以使用「大字價標放大鏡」
              </Text>
              <TouchableOpacity
                style={styles.grantBtn}
                onPress={requestPermission}
              >
                <Text style={styles.grantBtnText}>🔓 允許開啟相機放大鏡</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.magnifierContainer}>
              <View style={styles.viewportBox}>
                {frozenPhotoUri ? (
                  <Image
                    source={{ uri: frozenPhotoUri }}
                    style={styles.cameraPreview}
                    resizeMode="cover"
                  />
                ) : (
                  <CameraView
                    ref={cameraRef}
                    style={styles.cameraPreview}
                    facing="back"
                    zoom={activeZoom.zoomValue}
                    enableTorch={torchOn}
                  />
                )}

                {/* 放大鏡準星輔助線 */}
                <View style={styles.magnifierGuideFrame} pointerEvents="none">
                  <Text style={styles.magnifierBadge}>
                    {frozenPhotoUri
                      ? '❄️ 畫面已定格（不怕手抖）'
                      : `🔍 目前放大 ${activeZoom.scaleText}`}
                  </Text>
                </View>
              </View>

              {/* 放大倍率大按鈕列 (1x / 2x / 3x / 5x) */}
              <View style={styles.zoomButtonsRow}>
                {ZOOM_LEVELS.map((z, idx) => {
                  const active = zoomIndex === idx;
                  return (
                    <TouchableOpacity
                      key={z.label}
                      style={[
                        styles.zoomBtn,
                        active && styles.zoomBtnActive,
                      ]}
                      onPress={() => {
                        setZoomIndex(idx);
                        setFrozenPhotoUri(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.zoomBtnText,
                          active && styles.zoomBtnTextActive,
                        ]}
                      >
                        {z.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 定格畫面 & 手電筒補光大按鈕 */}
              <View style={styles.utilityControlsRow}>
                <TouchableOpacity
                  style={[
                    styles.freezeBtn,
                    frozenPhotoUri && styles.freezeBtnActive,
                  ]}
                  onPress={handleToggleFreeze}
                >
                  <Text style={styles.freezeBtnText}>
                    {frozenPhotoUri
                      ? '▶️ 恢復即時放大鏡'
                      : '❄️ 定格畫面 (拿近慢慢看)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.torchBtn,
                    torchOn && styles.torchBtnActive,
                  ]}
                  onPress={() => setTorchOn((v) => !v)}
                >
                  <Text
                    style={[
                      styles.torchBtnText,
                      torchOn && styles.torchBtnTextActive,
                    ]}
                  >
                    {torchOn ? '🔦 關燈' : '🔦 補光燈'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 邊看放大鏡邊輸入：直接填入「總價格」與「總容量」 */}
          <View style={styles.quickEntryPanel}>
            <Text style={styles.quickEntryTitle}>
              ✍️ 看清楚後可直接在此輸入（自動同步至 {targetCardTitle}）：
            </Text>

            <View style={styles.quickInputsRow}>
              <View style={styles.quickInputBox}>
                <Text style={styles.quickInputLabel}>標價 (元)</Text>
                <TextInput
                  style={styles.quickInputField}
                  keyboardType="numeric"
                  value={currentPrice}
                  onChangeText={onUpdatePrice}
                  placeholder="輸入價格"
                  placeholderTextColor="#9E9E9E"
                />
              </View>

              <View style={styles.quickInputBox}>
                <Text style={styles.quickInputLabel}>
                  容量 / 數量 ({currentUnit})
                </Text>
                <TextInput
                  style={styles.quickInputField}
                  keyboardType="numeric"
                  value={currentQuantity}
                  onChangeText={onUpdateQuantity}
                  placeholder="輸入容量"
                  placeholderTextColor="#9E9E9E"
                />
              </View>
            </View>

            <View style={styles.quickUnitRow}>
              {UNIT_OPTIONS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.quickUnitPill,
                    currentUnit === u && styles.quickUnitPillActive,
                  ]}
                  onPress={() => onUpdateUnit(u)}
                >
                  <Text
                    style={[
                      styles.quickUnitText,
                      currentUnit === u && styles.quickUnitTextActive,
                    ]}
                  >
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>✅ 看完填好，返回比價</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111111',
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 2,
  },
  closeIconBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  closeIconText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  permissionBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 14,
  },
  grantBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  magnifierContainer: {
    marginBottom: 12,
  },
  viewportBox: {
    height: 250,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 3.5,
    borderColor: '#2E7D32',
    backgroundColor: '#000000',
    position: 'relative',
    marginBottom: 10,
  },
  cameraPreview: {
    width: '100%',
    height: '100%',
  },
  magnifierGuideFrame: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  magnifierBadge: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '900',
  },
  zoomButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  zoomBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#BDBDBD',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  zoomBtnActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  zoomBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  zoomBtnTextActive: {
    color: '#FFFFFF',
  },
  utilityControlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  freezeBtn: {
    flex: 1.6,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  freezeBtnActive: {
    backgroundColor: '#D32F2F',
  },
  freezeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  torchBtn: {
    flex: 1,
    backgroundColor: '#FFF8E1',
    borderWidth: 2,
    borderColor: '#FFB300',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  torchBtnActive: {
    backgroundColor: '#FFB300',
  },
  torchBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  torchBtnTextActive: {
    color: '#111111',
  },
  quickEntryPanel: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    padding: 12,
  },
  quickEntryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B5E20',
    marginBottom: 8,
  },
  quickInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  quickInputBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickInputLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#424242',
  },
  quickInputField: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111111',
    paddingVertical: 2,
  },
  quickUnitRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  quickUnitPill: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  quickUnitPillActive: {
    backgroundColor: '#111111',
  },
  quickUnitText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111111',
  },
  quickUnitTextActive: {
    color: '#FFFFFF',
  },
  doneBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
});
