# 賣場極簡比價王 (Smart Grocery Unit Price Comparator - Mobile App)

專為精打細算的家庭主婦與賣場採購者設計的**離線優先（Offline-First）跨平台手機比價 App**（基於 **React Native / Expo + SQLite + Google ML Kit 離線 OCR**）。在全聯、家樂福、好市多等地下室無網路賣場中，單手推購物車即可用大拇指快速比價並記錄個人歷史底價。

---

## 1. 專案檔案架構

```text
Smart-Grocery-Unit-Price-Comparator-/
├── app.json                                 # Expo iOS/Android 原生權限設定 (Camera, SQLite, GPS Location)
├── package.json                             # React Native / Expo 與離線硬體套件依賴
├── tsconfig.json                            # TypeScript 嚴格型別設定
├── app/
│   ├── _layout.tsx                          # Expo Router 根路由
│   └── index.tsx                            # 主畫面（雙分頁導覽列：1.比價計算 / 2.底價紀錄）
└── src/
    ├── types/
    │   └── grocery.ts                       # 商品卡片、促銷折扣、歷史紅綠燈與底價筆記本型別
    ├── db/
    │   └── schema.ts                        # 離線 SQLite Schema DDL (stores, price_records) 與查詢介面
    ├── utils/
    │   ├── calculator.ts                    # 多商品即時單價計算、促銷折算、皇冠勝出與歷史紅綠燈比對引擎
    │   └── __tests__/
    │       └── calculator.test.mjs          # 核心計價與價標 OCR 解析單元測試
    ├── services/
    │   └── hardwareService.ts               # Google ML Kit 離線 OCR 價標解析器、條碼掃描與 GPS 賣場定位服務
    └── components/
        ├── ProductComparisonCard.tsx        # 高對比大字體商品比價卡（#2E7D32 綠色粗框皇冠 + #D32F2F 警示橘紅）
        ├── CustomNumericKeypad.tsx          # 螢幕下半部 45% 單手拇指熱區大型數字鍵盤与快捷操作列
        ├── CameraSimulatorModal.tsx         # 相機 OCR 價標辨識與條碼掃描模擬測試互動視窗
        └── PriceHistoryScreen.tsx           # 個人「底價筆記本」分頁（賣場篩選器、關鍵字搜尋、價標縮圖）
```

---

## 2. 如何啟動與測試

```bash
# 1. 執行核心單價計算與 OCR 解析自動化測試
npm test

# 2. 安裝依賴並啟動 iOS / Android 手機模擬器
npm install
npx expo start
```