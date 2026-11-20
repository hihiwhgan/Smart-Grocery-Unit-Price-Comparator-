/**
 * 賣場極簡比價王 - 真實手機相機取景器與離線價標 OCR / 條碼掃描模組
 *
 * 功能：
 * 1. 使用 `expo-camera` 的 `CameraView` 啟動手機真實後置鏡頭取景器。
 * 2. 「拍價標辨識 (OCR)」模式：對準賣場貨架價格牌按下快門，呼叫 `takePictureAsync` 拍下真實照片，
 *    並交由本機離線 Google ML Kit (`CameraOcrService.recognizePriceTagFromPhotoUri`) 自動擷取
 *    「商品名稱」、「售價」、「容量/數量」與「促銷折扣」，同時保留照片縮圖供底價筆記本存檔。
 * 3. 「條碼掃描 (BARCODE)」模式：自動透過原生鏡頭掃描 EAN-13 / EAN-8 / UPC 商品條碼並比對本機歷史底價。
 * 4. 若使用者未對準真實價標，亦可在畫面下方直接輸入/修改辨識出的文字立即解析帶入。
 */

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import {
  CameraOcrService,
  OcrTagRecognitionResult,
  parseShelfTagOcrText,
} from '../services/hardwareService';
import { PriceHistoryRecord } from '../types/grocery';

interface CameraScannerModalProps {
  visible: boolean;
  mode: 'OCR' | 'BARCODE';
  targetCardTitle: string;
  historyRecords: PriceHistoryRecord[];
  onClose: () => void;
  onApplyRecognition: (result: OcrTagRecognitionResult) => void;
}

export const CameraSimulatorModal: React.FC<CameraScannerModalProps> = ({
  visible,
  mode,
  targetCardTitle,
  historyRecords,
  onClose,
  onApplyRecognition,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    mode === 'OCR'
      ? '請將賣場貨架「價格牌」對準綠色取景框，按下快門拍照辨識'
      : '請將商品「條碼 (EAN/UPC)」對準取景框即可自動掃描'
  );
  const [manualOcrInput, setManualOcrInput] = useState('');

  /** 按下真實快門拍攝價標並執行本機離線 ML Kit OCR */
  const handleCapturePriceTag = async () => {
    if (!cameraRef.current || isProcessing) return;
    setIsProcessing(true);
    setStatusMessage('📸 正在拍攝價標並執行本機離線 OCR 文字辨識...');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setStatusMessage('⚠️ 拍照失敗，請重試');
        setIsProcessing(false);
        return;
      }

      const result = await CameraOcrService.recognizePriceTagFromPhotoUri(
        photo.uri
      );
      setIsProcessing(false);
      onApplyRecognition(result);
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMessage(
        `OCR 辨識提示：${err?.message || '請確認價標字跡清晰或使用下方文字解析'}`
      );
    }
  };

  /** 真實鏡頭掃描到 EAN/UPC 商品條碼時的回呼 */
  const handleBarcodeScanned = (scanResult: BarcodeScanningResult) => {
    if (mode !== 'BARCODE' || isProcessing) return;
    const scannedCode = scanResult.data?.trim();
    if (!scannedCode) return;

    setIsProcessing(true);
    // 查詢本機 SQLite 底價筆記本是否已有該條碼的歷史紀錄
    const matchedHistory = historyRecords.find(
      (r) => r.barcode === scannedCode
    );

    if (matchedHistory) {
      onApplyRecognition({
        productName: matchedHistory.productName,
        price: matchedHistory.effectivePrice,
        quantity: matchedHistory.quantity,
        packCount: 1,
        unit: matchedHistory.unit,
        detectedPromo: matchedHistory.promoType,
        barcode: scannedCode,
        photoUri: matchedHistory.photoUri || '',
        rawOcrText: `條碼掃描命中本機歷史紀錄：${scannedCode}`,
        confidence: 1.0,
      });
    } else {
      onApplyRecognition({
        productName: `條碼商品 (${scannedCode})`,
        price: 0,
        quantity: 1,
        packCount: 1,
        unit: 'g',
        detectedPromo: 'NONE',
        barcode: scannedCode,
        photoUri: '',
        rawOcrText: `已掃描新商品條碼：${scannedCode}`,
        confidence: 1.0,
      });
    }
    setIsProcessing(false);
  };

  /** 解析使用者手動貼上或修正的價標文字 */
  const handleParseCustomOcrText = () => {
    if (!manualOcrInput.trim()) return;
    const parsed = parseShelfTagOcrText(manualOcrInput);
    onApplyRecognition({
      productName: parsed.productName,
      price: parsed.price ?? 0,
      quantity: parsed.quantity ?? 1,
      packCount: 1,
      unit: parsed.unit,
      detectedPromo: parsed.detectedPromo,
      photoUri: '',
      rawOcrText: parsed.rawOcrText,
      confidence: 0.95,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.topBar}>
            <Text style={styles.titleText}>
              {mode === 'OCR'
                ? `📷 相機拍價標辨識 (${targetCardTitle})`
                : `🏷️ 真實條碼掃描 (${targetCardTitle})`}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 檢查並請求真實相機權限 */}
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>
                需要開啟手機相機權限以拍攝賣場價格牌與條碼
              </Text>
              <TouchableOpacity
                style={styles.grantBtn}
                onPress={requestPermission}
              >
                <Text style={styles.grantBtnText}>🔓 允許開啟手機相機</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.cameraPreview}
                facing="back"
                barcodeScannerSettings={
                  mode === 'BARCODE'
                    ? {
                        barcodeTypes: [
                          'ean13',
                          'ean8',
                          'upc_a',
                          'upc_e',
                          'code128',
                          'qr',
                        ],
                      }
                    : undefined
                }
                onBarcodeScanned={
                  mode === 'BARCODE' ? handleBarcodeScanned : undefined
                }
              >
                <View style={styles.reticleBox}>
                  <View style={styles.cornerTL} />
                  <View style={styles.cornerTR} />
                  <View style={styles.cornerBL} />
                  <View style={styles.cornerBR} />
                </View>
              </CameraView>

              {mode === 'OCR' && (
                <TouchableOpacity
                  style={styles.shutterBtn}
                  onPress={handleCapturePriceTag}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.shutterBtnText}>
                      📸 按下快門拍價標並自動填入
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.statusHint}>{statusMessage}</Text>

          {/* 輔助價標文字即時解析區 */}
          <View style={styles.manualParseRow}>
            <TextInput
              style={styles.manualInput}
              value={manualOcrInput}
              onChangeText={setManualOcrInput}
              placeholder="亦可直接輸入價標文字 (例：舒潔衛生紙 110抽x24包 $339)"
              placeholderTextColor="#757575"
            />
            <TouchableOpacity
              style={styles.parseBtn}
              onPress={handleParseCustomOcrText}
            >
              <Text style={styles.parseBtnText}>解析帶入</Text>
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
    backgroundColor: 'rgba(0,0,0,0.72)',
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
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
  },
  closeIconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  closeIconText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#424242',
  },
  permissionBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 14,
  },
  grantBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  cameraContainer: {
    marginBottom: 10,
  },
  cameraPreview: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  reticleBox: {
    width: '82%',
    height: 130,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.45)',
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4ADE80',
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 24,
    height: 24,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4ADE80',
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4ADE80',
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4ADE80',
  },
  shutterBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  shutterBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  statusHint: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 10,
  },
  manualParseRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  parseBtn: {
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  parseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
