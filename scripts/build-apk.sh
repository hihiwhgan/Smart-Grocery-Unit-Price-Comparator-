#!/usr/bin/env bash
set -euo pipefail

# 賣場極簡比價王 (Smart Grocery Unit Price Comparator) - 真實 GPS + 真實相機拍標 + 原生 SQLite Android APK 自動編譯腳本
# 使用 Android SDK Build-Tools 34.0.0 (aapt2, d8, zipalign, apksigner) 與 OpenJDK 17

SDK_ROOT="/home/antigravity/android-sdk"
BUILD_TOOLS="${SDK_ROOT}/build-tools/34.0.0"
ANDROID_JAR="${SDK_ROOT}/platforms/android-34/android.jar"

AAPT2="${BUILD_TOOLS}/aapt2"
D8="${BUILD_TOOLS}/d8"
ZIPALIGN="${BUILD_TOOLS}/zipalign"
APKSIGNER="${BUILD_TOOLS}/apksigner"

PROJECT_ROOT="/home/antigravity/hihiwhgan/Smart-Grocery-Unit-Price-Comparator-"
ARTIFACT_DIR="/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/457f6785-9ed6-4385-9819-1029b9781a12"
WORK_DIR="/tmp/android_apk_build"

rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}/src/com/smartgrocery/unitpricecomparator"
mkdir -p "${WORK_DIR}/res/layout"
mkdir -p "${WORK_DIR}/res/values"
mkdir -p "${WORK_DIR}/res/drawable"
mkdir -p "${WORK_DIR}/assets"
mkdir -p "${WORK_DIR}/compiled_res"
mkdir -p "${WORK_DIR}/classes"
mkdir -p "${WORK_DIR}/dex"

# 1. 建立 AndroidManifest.xml (包含真實相機、真實 GPS 定位權限與完全離線支援)
cat << 'EOF' > "${WORK_DIR}/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.smartgrocery.unitpricecomparator"
    android:versionCode="2"
    android:versionName="1.1.0">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />

    <!-- 手機原生硬體權限：真實相機拍照與即時鏡頭取景、真實 GPS 衛星與網路定位 -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />

    <application
        android:label="賣場極簡比價王"
        android:icon="@drawable/ic_launcher"
        android:allowBackup="true"
        android:hardwareAccelerated="true"
        android:theme="@android:style/Theme.DeviceDefault.Light.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

# 2. 建立高對比綠色皇冠向量圖示 (@drawable/ic_launcher)
cat << 'EOF' > "${WORK_DIR}/res/drawable/ic_launcher.xml"
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#2E7D32"
        android:pathData="M0,0h108v108h-108z"/>
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M24,74L84,74L84,82L24,82ZM24,66L30,36L45,52L54,30L63,52L78,36L84,66Z"/>
</vector>
EOF

cat << 'EOF' > "${WORK_DIR}/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">賣場極簡比價王</string>
</resources>
EOF

# 3. 建立整合真實 Android Native Hardware Bridge (真實 GPS LocationManager + 真實相機拍標 MediaStore.ACTION_IMAGE_CAPTURE & 鏡頭取景 + 原生 SQLiteDatabase) 的前端介面
cat << 'EOF' > "${WORK_DIR}/assets/index.html"
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>賣場極簡比價王</title>
  <style>
    * { box-sizing: border-box; user-select: none; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", sans-serif; background: #FFFFFF; color: #111111; overflow: hidden; }
    .app-shell { display: flex; flex-direction: column; width: 100%; height: 100%; }
    .top-header { padding: 10px 14px; border-bottom: 2px solid #E5E7EB; background: #FFFFFF; flex-shrink: 0; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .app-title { font-size: 21px; font-weight: 900; color: #111111; }
    .gps-sub { font-size: 12px; font-weight: 800; color: #2E7D32; margin-top: 2px; }
    .btn-reset { background: #F3F4F6; border: 1.5px solid #D1D5DB; border-radius: 8px; padding: 6px 10px; font-size: 13px; font-weight: 800; color: #1F2937; }
    .store-bar { display: flex; gap: 6px; align-items: center; }
    .store-select { flex: 1; background: #F9FAFB; border: 2px solid #111111; border-radius: 10px; padding: 7px 10px; font-size: 15px; font-weight: 900; color: #111111; }
    .btn-gps { background: #E8F5E9; border: 2px solid #2E7D32; border-radius: 10px; padding: 7px 10px; font-size: 13px; font-weight: 900; color: #2E7D32; }

    .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #F3F4F6; }
    .cards-scroll { flex: 1; overflow-y: auto; padding: 10px 12px; }
    .card { background: #FFFFFF; border: 2px solid #D1D5DB; border-radius: 16px; padding: 12px; margin-bottom: 12px; }
    .card.winner { border: 3.5px solid #2E7D32; background: #F4FBF4; }
    .winner-banner { background: #2E7D32; color: #FFFFFF; border-radius: 10px; padding: 6px 10px; text-align: center; font-size: 16px; font-weight: 900; margin-bottom: 8px; }
    .card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .badge-num { background: #1B5E20; color: #FFFFFF; font-size: 13px; font-weight: 900; padding: 3px 7px; border-radius: 6px; }
    .title-input { flex: 1; font-size: 17px; font-weight: 900; color: #111111; border: none; border-bottom: 1.5px solid #D1D5DB; background: transparent; padding: 2px 0; user-select: text; }
    .btn-ocr { background: #E8F5E9; border: 1.5px solid #2E7D32; color: #1B5E20; border-radius: 8px; padding: 5px 9px; font-size: 13px; font-weight: 900; }
    .btn-del { background: transparent; border: none; font-size: 18px; font-weight: 900; color: #9CA3AF; padding: 2px 6px; }

    .captured-tag-row { display: flex; align-items: center; gap: 8px; background: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 10px; padding: 6px 8px; margin-bottom: 8px; }
    .captured-thumb { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; border: 1.5px solid #2E7D32; }
    .captured-meta { flex: 1; font-size: 12px; font-weight: 800; color: #1B5E20; }

    .alert-box { border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; font-size: 14px; font-weight: 900; border: 1.5px solid; }
    .alert-green { background: #E8F5E9; border-color: #2E7D32; color: #2E7D32; }
    .alert-red { background: #FFEBEE; border-color: #D32F2F; color: #D32F2F; }

    .inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .input-box { background: #FAFAFA; border: 2px solid #BDBDBD; border-radius: 12px; padding: 6px 10px; }
    .input-box.focused { border: 3px solid #2E7D32; background: #FFFFFF; }
    .input-lbl { font-size: 13px; font-weight: 800; color: #4B5563; }
    .input-val-row { display: flex; align-items: baseline; margin-top: 2px; }
    .input-val { font-size: 26px; font-weight: 900; color: #111111; }
    .input-val.empty { color: #BDBDBD; }
    .sub-discount { font-size: 12px; font-weight: 900; color: #2E7D32; }

    .pills-row { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
    .pills-lbl { font-size: 13px; font-weight: 800; color: #4B5563; margin-right: 2px; }
    .pill { padding: 4px 10px; border-radius: 14px; font-size: 14px; font-weight: 800; border: 1.5px solid #D1D5DB; background: #F3F4F6; color: #1F2937; }
    .pill.active-unit { background: #111111; color: #FFFFFF; border-color: #111111; }
    .pill.active-promo { background: #2E7D32; color: #FFFFFF; border-color: #2E7D32; border-radius: 8px; }

    .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E5E7EB; padding-top: 8px; margin-top: 4px; }
    .unit-price-big { font-size: 22px; font-weight: 900; color: #111111; }
    .unit-price-big.win { color: #2E7D32; }
    .unit-price-big.lose { color: #D32F2F; }
    .badge-lose { background: #FFEBEE; border: 1px solid #D32F2F; color: #D32F2F; font-size: 12px; font-weight: 900; padding: 2px 6px; border-radius: 6px; margin-left: 6px; }
    .btn-save { background: #111111; color: #FFFFFF; border: none; border-radius: 10px; padding: 9px 12px; font-size: 14px; font-weight: 900; }
    .btn-save:disabled { background: #BDBDBD; }

    /* 下半部 45% 單手拇指操作熱區 */
    .thumb-dock { background: #E5E7EB; border-top: 2px solid #9CA3AF; padding: 8px 10px; flex-shrink: 0; }
    .thumb-actions { display: flex; gap: 6px; margin-bottom: 6px; }
    .btn-add { flex: 1.15; background: #111111; color: #FFFFFF; border: none; border-radius: 12px; padding: 10px; font-size: 15px; font-weight: 900; }
    .btn-cam { flex: 1.1; background: #2E7D32; color: #FFFFFF; border: none; border-radius: 12px; padding: 10px; font-size: 15px; font-weight: 900; }
    .btn-fold { background: #D1D5DB; color: #111111; border: none; border-radius: 12px; padding: 10px; font-size: 13px; font-weight: 900; }
    .target-hint { background: #E8F5E9; border-radius: 6px; padding: 4px 8px; margin-bottom: 6px; font-size: 13px; font-weight: 800; color: #1F2937; }
    .keypad-grid { display: grid; grid-template-columns: 3fr 1fr; gap: 6px; }
    .num-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
    .key-btn { height: 44px; background: #FFFFFF; border: 1.5px solid #D1D5DB; border-radius: 10px; font-size: 22px; font-weight: 900; color: #111111; }
    .key-back { background: #FFFBEB; border-color: #F59E0B; }
    .side-keys { display: flex; flex-direction: column; gap: 5px; }
    .key-clear { height: 44px; background: #FFEBEE; border: 1.5px solid #D32F2F; border-radius: 10px; font-size: 16px; font-weight: 900; color: #D32F2F; }
    .key-next { flex: 1; background: #2E7D32; color: #FFFFFF; border: none; border-radius: 10px; font-size: 16px; font-weight: 900; }

    /* 底部雙分頁導覽列 */
    .bottom-nav { display: grid; grid-template-columns: 1fr 1fr; height: 54px; border-top: 2px solid #111111; flex-shrink: 0; }
    .nav-item { border: none; font-size: 17px; font-weight: 900; background: #F9FAFB; color: #4B5563; }
    .nav-item.active { background: #111111; color: #FFFFFF; }

    .history-panel { flex: 1; overflow-y: auto; padding: 12px; background: #F3F4F6; }
    .search-input { width: 100%; border: 2px solid #111111; border-radius: 12px; padding: 10px 12px; font-size: 16px; font-weight: 800; margin-bottom: 10px; background: #FFFFFF; user-select: text; }
    .toast { position: fixed; top: 14px; left: 14px; right: 14px; background: #1B5E20; color: #FFFFFF; padding: 12px 14px; border-radius: 12px; font-size: 14px; font-weight: 900; z-index: 2000; box-shadow: 0 6px 16px rgba(0,0,0,0.25); display: none; }

    /* 真實相機拍標 & 價標文字解析視窗 Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1500; display: none; align-items: flex-end; justify-content: center; }
    .modal-sheet { width: 100%; max-height: 92%; background: #FFFFFF; border-top-left-radius: 22px; border-top-right-radius: 22px; padding: 14px; overflow-y: auto; }
    .cam-box { position: relative; width: 100%; height: 220px; background: #000000; border-radius: 14px; overflow: hidden; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; }
    .cam-video { width: 100%; height: 100%; object-fit: cover; }
    .cam-reticle { position: absolute; width: 82%; height: 115px; border: 2.5px solid #4ADE80; border-radius: 10px; pointer-events: none; box-shadow: 0 0 0 9999px rgba(0,0,0,0.32); }
    .btn-native-cam { width: 100%; background: #2E7D32; color: #FFFFFF; border: none; border-radius: 12px; padding: 13px; font-size: 16px; font-weight: 900; margin-bottom: 8px; }
    .btn-web-snap { width: 100%; background: #111111; color: #FFFFFF; border: none; border-radius: 12px; padding: 11px; font-size: 15px; font-weight: 900; margin-bottom: 10px; }
    .ocr-parse-box { background: #F3F4F6; border: 1.5px solid #D1D5DB; border-radius: 12px; padding: 10px; margin-bottom: 10px; }
    .ocr-input { width: 100%; border: 1.5px solid #9CA3AF; border-radius: 8px; padding: 8px 10px; font-size: 15px; font-weight: 800; margin-top: 6px; margin-bottom: 8px; background: #FFFFFF; user-select: text; }
  </style>
</head>
<body>
  <div id="toast" class="toast"></div>

  <!-- 真實相機拍標 Modal -->
  <div id="cameraModal" class="modal-backdrop">
    <div class="modal-sheet">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:18px;font-weight:900;" id="camModalTitle">📷 真實相機拍價標</div>
        <button onclick="closeCameraModal()" style="background:none;border:none;font-size:22px;font-weight:900;padding:2px 8px;">✕</button>
      </div>

      <!-- 即時後置鏡頭取景窗 / 已拍攝的價標照片預覽 -->
      <div class="cam-box">
        <video id="liveVideo" class="cam-video" autoplay playsinline muted></video>
        <img id="capturedPreviewImg" class="cam-video" style="display:none;" />
        <div class="cam-reticle"></div>
      </div>

      <!-- 啟動 Android 原生系統相機 App 拍價標 (或 HTML5 MediaCapture) -->
      <button class="btn-native-cam" onclick="triggerNativeAndroidCamera()">
        📸 開啟手機系統相機拍價標 (高畫質存檔)
      </button>
      <input id="htmlFileCameraInput" type="file" accept="image/*" capture="environment" style="display:none;" onchange="handleHtmlFileCapture(event)" />

      <!-- 直接從上方即時取景框擷取畫面 -->
      <button id="btnSnapLive" class="btn-web-snap" onclick="snapFromLiveVideo()">
        ⚡ 直接從上方取景框快門拍標
      </button>

      <!-- 價標文字智慧解析與確認區 -->
      <div class="ocr-parse-box">
        <div style="font-size:13px;font-weight:900;color:#1B5E20;">
          📝 價標文字智慧解析（支援輸入或貼上價標文字，自動拆解名稱、價格、容量與買一送一）：
        </div>
        <input
          id="ocrRawTextInput"
          class="ocr-input"
          type="text"
          placeholder="例如：舒潔衛生紙 110抽x24包 特價 $339"
        />
        <div style="display:flex;gap:6px;">
          <button onclick="applyParsedOcrText()" style="flex:1;background:#2E7D32;color:#FFFFFF;border:none;border-radius:10px;padding:10px;font-size:15px;font-weight:900;">
            ✅ 解析價標並填入商品卡
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="app-shell">
    <div class="top-header">
      <div class="header-row">
        <div style="flex:1;min-width:0;margin-right:8px;">
          <div class="app-title">🛒 賣場極簡比價王</div>
          <div id="gpsText" class="gps-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            🛰️ 點擊右方「真實GPS」自動定位所在賣場
          </div>
        </div>
        <button class="btn-reset" onclick="resetCards()">🔄 清空重算</button>
      </div>
      <div class="store-bar">
        <select id="storeSelect" class="store-select" onchange="setStore(this.value)">
          <option value="全聯福利中心">📍 當前賣場：全聯福利中心</option>
          <option value="好市多 Costco">📍 當前賣場：好市多 Costco</option>
          <option value="家樂福 Carrefour">📍 當前賣場：家樂福 Carrefour</option>
          <option value="大潤發 RT-Mart">📍 當前賣場：大潤發 RT-Mart</option>
          <option value="愛買 a.mart">📍 當前賣場：愛買 a.mart</option>
        </select>
        <button class="btn-gps" onclick="requestRealGps()">🛰️ 真實GPS</button>
      </div>
    </div>

    <!-- 分頁 1：比價計算 -->
    <div id="viewCompare" class="main-view">
      <div id="cardsList" class="cards-scroll"></div>
      <div class="thumb-dock">
        <div class="thumb-actions">
          <button class="btn-add" onclick="addProduct()">＋ 新增比價商品</button>
          <button class="btn-cam" onclick="openCameraFor(target.id)">📷 相機拍價標</button>
          <button id="btnFold" class="btn-fold" onclick="togglePad()">▼ 收起</button>
        </div>
        <div id="padBody">
          <div id="targetHint" class="target-hint">正在輸入：商品 1 的 總價格 (元)</div>
          <div class="keypad-grid">
            <div class="num-grid">
              <button class="key-btn" onclick="k('7')">7</button>
              <button class="key-btn" onclick="k('8')">8</button>
              <button class="key-btn" onclick="k('9')">9</button>
              <button class="key-btn" onclick="k('4')">4</button>
              <button class="key-btn" onclick="k('5')">5</button>
              <button class="key-btn" onclick="k('6')">6</button>
              <button class="key-btn" onclick="k('1')">1</button>
              <button class="key-btn" onclick="k('2')">2</button>
              <button class="key-btn" onclick="k('3')">3</button>
              <button class="key-btn" onclick="k('.')">.</button>
              <button class="key-btn" onclick="k('0')">0</button>
              <button class="key-btn key-back" onclick="back()">⌫</button>
            </div>
            <div class="side-keys">
              <button class="key-clear" onclick="clr()">清除</button>
              <button class="key-btn" onclick="k('00')">00</button>
              <button class="key-next" onclick="nextField()">下一欄 ➔</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分頁 2：底價紀錄 -->
    <div id="viewHistory" class="history-panel" style="display:none;">
      <input id="searchBox" class="search-input" type="text" placeholder="🔍 搜尋商品名稱、衛生紙、鮮乳或條碼..." oninput="renderHistory()" />
      <div id="storeFilters" class="pills-row" style="margin-bottom:10px;"></div>
      <div id="historyList"></div>
    </div>

    <div class="bottom-nav">
      <button id="tabBtn1" class="nav-item active" onclick="switchTab(1)">🧮 比價計算 (<span id="cntCompare">2</span>)</button>
      <button id="tabBtn2" class="nav-item" onclick="switchTab(2)">📒 底價紀錄 (<span id="cntHistory">3</span>)</button>
    </div>
  </div>

  <script>
    const UNITS = ['g', 'ml', '抽', '入', '包'];
    const PROMOS = [
      { id: 'NONE', label: '無折扣', m: 1.0 },
      { id: 'BOGO', label: '買一送一', m: 0.5 },
      { id: 'SECOND_HALF', label: '第二件5折', m: 0.75 },
      { id: 'DISCOUNT_85', label: '85折', m: 0.85 },
      { id: 'DISCOUNT_80', label: '打8折', m: 0.8 }
    ];

    // 台灣主要實體大賣場真實經緯度座標庫 (供真實 GPS Haversine 距離計算最近賣場)
    const STORE_FENCES = [
      { storeName: '全聯福利中心', district: '台北大安延吉店', lat: 25.033964, lon: 121.543378 },
      { storeName: '全聯福利中心', district: '新北板橋文化店', lat: 25.013200, lon: 121.463700 },
      { storeName: '全聯福利中心', district: '台中市政店', lat: 24.161800, lon: 120.646900 },
      { storeName: '全聯福利中心', district: '高雄巨蛋店', lat: 22.665100, lon: 120.303200 },
      { storeName: '好市多 Costco', district: '內湖賣場', lat: 25.065321, lon: 121.575412 },
      { storeName: '好市多 Costco', district: '中和賣場', lat: 25.001800, lon: 121.491200 },
      { storeName: '好市多 Costco', district: '台中南屯賣場', lat: 24.132900, lon: 120.648800 },
      { storeName: '好市多 Costco', district: '高雄大順賣場', lat: 22.656200, lon: 120.305900 },
      { storeName: '家樂福 Carrefour', district: '桂林量販店', lat: 25.038200, lon: 121.506300 },
      { storeName: '家樂福 Carrefour', district: '內湖量販店', lat: 25.068100, lon: 121.579400 },
      { storeName: '家樂福 Carrefour', district: '台中青海店', lat: 24.163200, lon: 120.638100 },
      { storeName: '家樂福 Carrefour', district: '高雄鼎山店', lat: 22.655100, lon: 120.320400 },
      { storeName: '大潤發 RT-Mart', district: '中崙店', lat: 25.048190, lon: 121.544610 },
      { storeName: '愛買 a.mart', district: '大直店', lat: 25.083120, lon: 121.556110 }
    ];

    let store = '全聯福利中心';
    let lastGpsCoords = { lat: null, lon: null };
    let filterStore = 'ALL';
    let padOpen = true;
    let activeStream = null;
    let currentCameraCardId = 'c1';
    let latestCapturedPhotoDataUrl = null;

    function loadInitialHistory() {
      if (window.AndroidBridge && window.AndroidBridge.loadHistoryJson) {
        try {
          const raw = window.AndroidBridge.loadHistoryJson();
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch (e) {}
      }
      const local = JSON.parse(localStorage.getItem('smart_grocery_sqlite_v2') || 'null');
      if (local && local.length > 0) return local;
      return [
        { id: 'h1', name: '舒潔三層抽取式衛生紙 (110抽x24包)', store: '全聯福利中心', price: 369, qty: 2640, unit: '抽', unitPrice: 369/2640, date: '2026-11-10', barcode: '4710036003128', photo: null },
        { id: 'h2', name: '科克蘭三層抽取衛生紙 (120抽x24包)', store: '好市多 Costco', price: 389, qty: 2880, unit: '抽', unitPrice: 389/2880, date: '2026-11-02', barcode: '0096619147281', photo: null },
        { id: 'h3', name: '瑞穗鮮乳家庭號 (全脂 1858ml)', store: '家樂福 Carrefour', price: 169, qty: 1858, unit: 'ml', unitPrice: 169/1858, date: '2026-11-14', barcode: '4710088410134', photo: null }
      ];
    }

    let history = loadInitialHistory();

    function persistHistory() {
      const jsonStr = JSON.stringify(history);
      localStorage.setItem('smart_grocery_sqlite_v2', jsonStr);
      if (window.AndroidBridge && window.AndroidBridge.saveHistoryJson) {
        try { window.AndroidBridge.saveHistoryJson(jsonStr); } catch (e) {}
      }
    }

    let items = [
      { id: 'c1', title: '舒潔三層抽取式衛生紙 (110抽x24包)', price: '339', qty: '2640', unit: '抽', promo: 'NONE', barcode: '4710036003128', photo: null },
      { id: 'c2', title: '春風超細柔抽取衛生紙 (110抽x12包)', price: '358', qty: '1320', unit: '抽', promo: 'BOGO', barcode: '4710018009216', photo: null }
    ];
    let target = { id: 'c1', field: 'price' };

    function haversineMeters(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    // 接收來自真實 GPS (Android Native LocationManager 或 navigator.geolocation) 的經緯度座標
    window.onRealGpsLocationReceived = function(lat, lon, providerLabel) {
      lastGpsCoords = { lat, lon };
      let nearest = STORE_FENCES[0];
      let minDist = Infinity;
      for (const f of STORE_FENCES) {
        const d = haversineMeters(lat, lon, f.lat, f.lon);
        if (d < minDist) {
          minDist = d;
          nearest = f;
        }
      }
      store = nearest.storeName;
      document.getElementById('storeSelect').value = store;
      const distTxt = minDist >= 1000 ? (minDist / 1000).toFixed(1) + 'km' : minDist + 'm';
      document.getElementById('gpsText').textContent =
        `🛰️ 真實GPS (${lat.toFixed(4)}, ${lon.toFixed(4)}) · 最近：${nearest.district} (${distTxt})`;
      toast(`🛰️ 已取得真實 GPS 座標 (${lat.toFixed(4)}, ${lon.toFixed(4)})\n自動切換至最近賣場：${nearest.storeName}`);
    };

    window.onRealGpsError = function(errMsg) {
      document.getElementById('gpsText').textContent = '⚠️ GPS 定位提示：' + errMsg;
      toast('⚠️ GPS 定位提示：' + errMsg);
    };

    // 觸發真實手機 GPS 定位
    function requestRealGps() {
      document.getElementById('gpsText').textContent = '🛰️ 正在讀取手機真實 GPS 衛星定位...';
      // 1. 優先呼叫 Android 原生 LocationManager Bridge (會自動彈出系統定位權限詢問)
      if (window.AndroidBridge && window.AndroidBridge.requestNativeGps) {
        window.AndroidBridge.requestNativeGps();
        return;
      }
      // 2. 標準 Geolocation API
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => window.onRealGpsLocationReceived(pos.coords.latitude, pos.coords.longitude, 'HTML5-GPS'),
          err => window.onRealGpsError(err.message || '請確認已開啟手機定位權限與 GPS'),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        window.onRealGpsError('此裝置不支援 GPS 定位');
      }
    }

    // 開啟真實相機拍標視窗
    async function openCameraFor(cardId) {
      currentCameraCardId = cardId || target.id;
      target = { id: currentCameraCardId, field: 'price' };
      const it = items.find(x => x.id === currentCameraCardId);
      document.getElementById('camModalTitle').textContent = '📷 真實相機拍價標 (' + (it ? it.title : '商品') + ')';
      document.getElementById('cameraModal').style.display = 'flex';
      document.getElementById('capturedPreviewImg').style.display = 'none';
      document.getElementById('liveVideo').style.display = 'block';

      // 嘗試開啟手機後置鏡頭即時取景
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
          });
          const videoEl = document.getElementById('liveVideo');
          videoEl.srcObject = activeStream;
        } catch (err) {
          // 若 WebView getUserMedia 未授權，使用者可點擊「開啟手機系統相機拍價標」按鈕呼叫原生相機 Intent
        }
      }
    }

    function closeCameraModal() {
      document.getElementById('cameraModal').style.display = 'none';
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
      }
    }

    // 呼叫 Android 原生 MediaStore.ACTION_IMAGE_CAPTURE 相機 Intent
    function triggerNativeAndroidCamera() {
      if (window.AndroidBridge && window.AndroidBridge.launchNativeCamera) {
        window.AndroidBridge.launchNativeCamera();
      } else {
        document.getElementById('htmlFileCameraInput').click();
      }
    }

    // 接收來自 Android 原生相機拍攝後的真實價標照片 Base64 DataURL
    window.onNativeCameraPhotoCaptured = function(dataUrl) {
      latestCapturedPhotoDataUrl = dataUrl;
      const imgEl = document.getElementById('capturedPreviewImg');
      imgEl.src = dataUrl;
      imgEl.style.display = 'block';
      document.getElementById('liveVideo').style.display = 'none';
      items = items.map(x => x.id === currentCameraCardId ? { ...x, photo: dataUrl } : x);
      toast('📸 已拍下真實價標照片並縮圖存檔！可輸入價標文字或直接回主畫面輸入數字');
      render();
    };

    function handleHtmlFileCapture(ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        window.onNativeCameraPhotoCaptured(e.target.result);
      };
      reader.readAsDataURL(file);
    }

    function snapFromLiveVideo() {
      const videoEl = document.getElementById('liveVideo');
      if (!videoEl || !videoEl.videoWidth) {
        triggerNativeAndroidCamera();
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = Math.round((videoEl.videoHeight / videoEl.videoWidth) * 480) || 320;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      window.onNativeCameraPhotoCaptured(dataUrl);
    }

    // 價標文字解析器：自動從價標文字拆解商品名稱、價格、複合容量(110抽x24包)與促銷折數
    function parseShelfTagText(rawText) {
      const cleaned = rawText.replace(/\n+/g, ' ').trim();
      const priceMatch =
        cleaned.match(/(?:特價|售價|促銷價|NT\$|\$)\s*(\d{2,5}(?:\.\d{1,2})?)/i) ||
        cleaned.match(/(\d{2,5})\s*元/) ||
        cleaned.match(/\b(\d{2,4})\b/);
      const price = priceMatch ? priceMatch[1] : '';

      let qty = '';
      let unit = 'g';
      const multiMatch = cleaned.match(/(\d+)\s*(抽|入|g|ml|公克|毫升)\s*[xX*×]\s*(\d+)/i);
      if (multiMatch) {
        qty = String(parseFloat(multiMatch[1]) * parseFloat(multiMatch[3]));
        const u = multiMatch[2].toLowerCase();
        unit = (u === 'g' || u === '公克') ? 'g' : (u === 'ml' || u === '毫升') ? 'ml' : multiMatch[2];
      } else {
        const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(ml|g|公克|毫升|抽|入|包)/i);
        if (singleMatch) {
          qty = singleMatch[1];
          const u = singleMatch[2].toLowerCase();
          unit = (u === 'g' || u === '公克') ? 'g' : (u === 'ml' || u === '毫升') ? 'ml' : singleMatch[2];
        }
      }

      let promo = 'NONE';
      if (/買一送一|買1送1/i.test(cleaned)) promo = 'BOGO';
      else if (/第二件5折|第2件5折/i.test(cleaned)) promo = 'SECOND_HALF';
      else if (/85折/i.test(cleaned)) promo = 'DISCOUNT_85';
      else if (/8折/i.test(cleaned)) promo = 'DISCOUNT_80';

      const namePart = cleaned
        .replace(/(?:特價|售價|促銷價|NT\$|\$)\s*\d+(?:\.\d+)?/gi, '')
        .replace(/買一送一|買1送1|第二件5折|85折|8折/gi, '')
        .trim();

      return {
        title: namePart || '拍標辨識商品',
        price,
        qty,
        unit,
        promo
      };
    }

    function applyParsedOcrText() {
      const raw = document.getElementById('ocrRawTextInput').value.trim();
      if (!raw) {
        closeCameraModal();
        return;
      }
      const parsed = parseShelfTagText(raw);
      items = items.map(x => {
        if (x.id !== currentCameraCardId) return x;
        return {
          ...x,
          title: parsed.title || x.title,
          price: parsed.price || x.price,
          qty: parsed.qty || x.qty,
          unit: UNITS.includes(parsed.unit) ? parsed.unit : x.unit,
          promo: parsed.promo || x.promo,
          photo: latestCapturedPhotoDataUrl || x.photo
        };
      });
      document.getElementById('ocrRawTextInput').value = '';
      closeCameraModal();
      toast('✅ 已解析價標並自動填入商品卡！');
      render();
    }

    function fmt(v) {
      if (!Number.isFinite(v) || v <= 0) return '--';
      if (v < 0.01) return v.toFixed(4);
      if (v < 1) return v.toFixed(3);
      if (v < 10) return v.toFixed(2);
      return v.toFixed(1);
    }

    function calc() {
      const list = items.map(it => {
        const p = parseFloat(it.price);
        const q = parseFloat(it.qty);
        if (!p || !q || p <= 0 || q <= 0) return { id: it.id, valid: false };
        const m = (PROMOS.find(x => x.id === it.promo) || PROMOS[0]).m;
        const eff = p * m;
        const up = eff / q;
        const hist = history.find(h => (it.barcode && h.barcode === it.barcode) || (it.title.length > 3 && h.name.includes(it.title.slice(0, 4)) && h.unit === it.unit));
        let alert = null;
        if (hist) {
          const diff = Math.round(eff - hist.unitPrice * q);
          if (up < hist.unitPrice * 0.995) alert = { cls: 'alert-green', txt: '🔥 破歷史新低價！比上次在' + hist.store.split(' ')[0] + '買便宜 ' + Math.max(1, Math.abs(diff)) + ' 元' };
          else if (up > hist.unitPrice * 1.005) alert = { cls: 'alert-red', txt: '🔴 比上次在' + hist.store.split(' ')[0] + '買的貴 ' + Math.max(1, Math.abs(diff)) + ' 元' };
        }
        return { id: it.id, valid: true, eff, up, win: false, savePct: null, losePct: null, alert };
      });
      const valid = list.filter(x => x.valid).sort((a, b) => a.up - b.up);
      if (valid.length > 0) {
        const best = valid[0].up;
        const sec = valid.length > 1 ? valid[1].up : null;
        valid.forEach(r => {
          if (Math.abs(r.up - best) < 1e-7) {
            r.win = true;
            if (sec && sec > best) r.savePct = Math.round(((sec - best) / sec) * 1000) / 10;
          } else {
            r.losePct = Math.round(((r.up - best) / best) * 1000) / 10;
          }
        });
      }
      const map = {};
      list.forEach(r => map[r.id] = r);
      return map;
    }

    function render() {
      const resMap = calc();
      document.getElementById('cntCompare').textContent = items.length;
      document.getElementById('cntHistory').textContent = history.length;
      const curItem = items.find(i => i.id === target.id) || items[0];
      document.getElementById('targetHint').textContent =
        '正在輸入：' + (curItem ? curItem.title : '商品') + ' 的 ' + (target.field === 'price' ? '總價格 (元)' : '總容量 / 數量');

      document.getElementById('cardsList').innerHTML = items.map((it, idx) => {
        const r = resMap[it.id] || { valid: false };
        const fp = target.id === it.id && target.field === 'price';
        const fq = target.id === it.id && target.field === 'qty';
        return `
          <div class="card ${r.win ? 'winner' : ''}">
            ${r.win ? `<div class="winner-banner">👑 最划算首選！${r.savePct ? '比第二名省 ' + r.savePct + '%' : '目前單價最低'}</div>` : ''}
            <div class="card-header">
              <span class="badge-num">#${idx + 1}</span>
              <input class="title-input" value="${it.title}" onchange="setTitle('${it.id}', this.value)" />
              <button class="btn-ocr" onclick="openCameraFor('${it.id}')">📷 拍價標</button>
              ${items.length > 2 ? `<button class="btn-del" onclick="delCard('${it.id}')">✕</button>` : ''}
            </div>
            ${it.photo ? `
              <div class="captured-tag-row">
                <img class="captured-thumb" src="${it.photo}" />
                <div class="captured-meta">📸 已拍攝真實賣場價標照片（存檔時將自動寫入本機底價筆記本）</div>
              </div>
            ` : ''}
            ${r.alert ? `<div class="alert-box ${r.alert.cls}">${r.alert.txt}</div>` : ''}
            <div class="inputs-grid">
              <div class="input-box ${fp ? 'focused' : ''}" onclick="focusBox('${it.id}','price')">
                <div class="input-lbl">總價格 (元)</div>
                <div class="input-val-row"><span class="input-val ${it.price ? '' : 'empty'}">$${it.price || '0'}</span></div>
                ${it.promo !== 'NONE' && r.valid ? `<div class="sub-discount">折後實付 $${Math.round(r.eff * 10) / 10}</div>` : ''}
              </div>
              <div class="input-box ${fq ? 'focused' : ''}" onclick="focusBox('${it.id}','qty')">
                <div class="input-lbl">總容量 / 數量</div>
                <div class="input-val-row"><span class="input-val ${it.qty ? '' : 'empty'}">${it.qty || '0'}</span><span style="font-size:15px;font-weight:800;margin-left:4px;">${it.unit}</span></div>
              </div>
            </div>
            <div class="pills-row">
              <span class="pills-lbl">單位:</span>
              ${UNITS.map(u => `<button class="pill ${it.unit === u ? 'active-unit' : ''}" onclick="setUnit('${it.id}','${u}')">${u}</button>`).join('')}
            </div>
            <div class="pills-row">
              <span class="pills-lbl">促銷:</span>
              ${PROMOS.map(p => `<button class="pill ${it.promo === p.id ? 'active-promo' : ''}" onclick="setPromo('${it.id}','${p.id}')">${p.label}</button>`).join('')}
            </div>
            <div class="card-footer">
              <div>
                <div style="font-size:12px;font-weight:800;color:#6B7280;">換算單價</div>
                ${r.valid ? `<span class="unit-price-big ${r.win ? 'win' : (r.losePct ? 'lose' : '')}">$${fmt(r.up)} <small style="font-size:13px;">/ ${it.unit}</small></span>${!r.win && r.losePct ? `<span class="badge-lose">貴 ${r.losePct}%</span>` : ''}` : `<span style="font-size:13px;font-weight:700;color:#9CA3AF;">請輸入價格與容量</span>`}
              </div>
              <button class="btn-save" ${!r.valid ? 'disabled' : ''} onclick="savePrice('${it.id}')">💾 儲存此價格</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function focusBox(id, field) { target = { id, field }; render(); }
    function setTitle(id, v) { items = items.map(x => x.id === id ? { ...x, title: v } : x); render(); }
    function setUnit(id, u) { items = items.map(x => x.id === id ? { ...x, unit: u } : x); render(); }
    function setPromo(id, p) { items = items.map(x => x.id === id ? { ...x, promo: p } : x); render(); }
    function addProduct() {
      const nid = 'c' + Date.now();
      items.push({ id: nid, title: '商品 ' + (items.length + 1), price: '', qty: '', unit: items[0].unit, promo: 'NONE', photo: null });
      target = { id: nid, field: 'price' };
      render();
    }
    function delCard(id) {
      if (items.length <= 2) return;
      items = items.filter(x => x.id !== id);
      target = { id: items[0].id, field: 'price' };
      render();
    }
    function resetCards() {
      items = [
        { id: 'c1', title: '商品 1', price: '', qty: '', unit: 'g', promo: 'NONE', photo: null },
        { id: 'c2', title: '商品 2', price: '', qty: '', unit: 'g', promo: 'NONE', photo: null }
      ];
      target = { id: 'c1', field: 'price' };
      render();
    }
    function k(ch) {
      items = items.map(x => {
        if (x.id !== target.id) return x;
        const cur = x[target.field] || '';
        if (ch === '.' && cur.includes('.')) return x;
        const nxt = (cur === '0' && ch !== '.') ? ch : cur + ch;
        return nxt.length > 8 ? x : { ...x, [target.field]: nxt };
      });
      render();
    }
    function back() {
      items = items.map(x => x.id === target.id ? { ...x, [target.field]: (x[target.field] || '').slice(0, -1) } : x);
      render();
    }
    function clr() {
      items = items.map(x => x.id === target.id ? { ...x, [target.field]: '' } : x);
      render();
    }
    function nextField() {
      if (target.field === 'price') target.field = 'qty';
      else {
        const idx = items.findIndex(x => x.id === target.id);
        target = { id: items[(idx + 1) % items.length].id, field: 'price' };
      }
      render();
    }
    function togglePad() {
      padOpen = !padOpen;
      document.getElementById('padBody').style.display = padOpen ? 'block' : 'none';
      document.getElementById('btnFold').textContent = padOpen ? '▼ 收起' : '▲ 鍵盤';
    }
    function savePrice(id) {
      const resMap = calc();
      const it = items.find(x => x.id === id);
      const r = resMap[id];
      if (!it || !r || !r.valid) return;
      const today = new Date().toISOString().slice(0, 10);
      const rec = {
        id: 'h' + Date.now(),
        name: it.title,
        store,
        lat: lastGpsCoords.lat,
        lon: lastGpsCoords.lon,
        price: Math.round(r.eff),
        qty: parseFloat(it.qty),
        unit: it.unit,
        unitPrice: r.up,
        date: today,
        barcode: it.barcode,
        photo: it.photo || null
      };
      history.unshift(rec);
      persistHistory();
      toast('💾 已儲存至本機 SQLite 底價筆記本：' + rec.name + ' (' + store + ')');
      render();
    }
    function setStore(v) { store = v; }
    function switchTab(n) {
      document.getElementById('viewCompare').style.display = n === 1 ? 'flex' : 'none';
      document.getElementById('viewHistory').style.display = n === 2 ? 'block' : 'none';
      document.getElementById('tabBtn1').className = 'nav-item ' + (n === 1 ? 'active' : '');
      document.getElementById('tabBtn2').className = 'nav-item ' + (n === 2 ? 'active' : '');
      if (n === 2) renderHistory();
    }
    function renderHistory() {
      const q = (document.getElementById('searchBox').value || '').toLowerCase();
      const stores = ['ALL', '全聯福利中心', '好市多 Costco', '家樂福 Carrefour', '大潤發 RT-Mart'];
      document.getElementById('storeFilters').innerHTML = stores.map(s => `<button class="pill ${filterStore === s ? 'active-promo' : ''}" onclick="filterStore='${s}';renderHistory()">${s === 'ALL' ? '全部賣場' : s.split(' ')[0]}</button>`).join('');
      const list = history.filter(h => (filterStore === 'ALL' || h.store === filterStore) && (!q || h.name.toLowerCase().includes(q) || h.store.toLowerCase().includes(q)));
      document.getElementById('historyList').innerHTML = list.map(h => `
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          ${h.photo ? `<img src="${h.photo}" style="width:54px;height:54px;object-fit:cover;border-radius:10px;border:1.5px solid #2E7D32;flex-shrink:0;" />` : `<div style="width:54px;height:54px;border-radius:10px;background:#F3F4F6;border:1px solid #D1D5DB;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🏷️</div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:900;color:#2E7D32;">📍 ${h.store} · ${h.date} ${h.lat ? `(${h.lat.toFixed(3)},${h.lon.toFixed(3)})` : ''}</div>
            <div style="font-size:16px;font-weight:900;margin:2px 0;">${h.name}</div>
            <div style="font-size:14px;font-weight:800;color:#374151;">實付 $${h.price} / ${h.qty} ${h.unit} (單價 $${fmt(h.unitPrice)}/${h.unit})</div>
          </div>
          <button class="btn-cam" style="flex:0;white-space:nowrap;" onclick="loadFromHistory('${h.id}')">⚡ 帶入比價</button>
        </div>
      `).join('');
    }
    function loadFromHistory(hid) {
      const h = history.find(x => x.id === hid);
      if (!h) return;
      items.push({ id: 'c' + Date.now(), title: h.name + ' (歷史價)', price: String(h.price), qty: String(h.qty), unit: h.unit, promo: 'NONE', barcode: h.barcode, photo: h.photo });
      switchTab(1);
      render();
    }
    function toast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 3200);
    }

    render();
    // 啟動後自動請求一次真實 GPS 定位
    setTimeout(() => { requestRealGps(); }, 600);
  </script>
</body>
</html>
EOF

# 4. 建立原生 Android MainActivity.java：實作真實 GPS LocationManager、真實相機 Intent (ACTION_IMAGE_CAPTURE)、WebChromeClient 相機與定位權限授權、以及原生 SQLite 儲存 Bridge
cat << 'EOF' > "${WORK_DIR}/src/com/smartgrocery/unitpricecomparator/MainActivity.java"
package com.smartgrocery.unitpricecomparator;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Bitmap;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;

public class MainActivity extends Activity {
    private static final int REQ_PERMISSIONS = 1001;
    private static final int REQ_CAMERA_CAPTURE = 1002;
    private static final int REQ_GPS_PERMISSION = 1003;

    private WebView webView;
    private SQLiteDatabase sqliteDb;
    private LocationManager locationManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 初始化原生 SQLite 資料庫 (smart_grocery_comparator.db)
        initNativeSqlite();

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new AndroidHardwareBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());

        // 允許 WebView 使用真實手機相機 (getUserMedia) 與真實 GPS (Geolocation)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        setContentView(webView);
        checkInitialRuntimePermissions();
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void initNativeSqlite() {
        try {
            sqliteDb = openOrCreateDatabase("smart_grocery_comparator.db", Context.MODE_PRIVATE, null);
            sqliteDb.execSQL(
                "CREATE TABLE IF NOT EXISTS kv_store (" +
                "k TEXT PRIMARY KEY, " +
                "v TEXT NOT NULL)"
            );
        } catch (Exception ignored) {
        }
    }

    private void checkInitialRuntimePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(
                    new String[]{
                        Manifest.permission.CAMERA,
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    REQ_PERMISSIONS
                );
            }
        }
    }

    public class AndroidHardwareBridge {
        @JavascriptInterface
        public void requestNativeGps() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startRealNativeGpsLookup();
                }
            });
        }

        @JavascriptInterface
        public void launchNativeCamera() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startNativeCameraIntent();
                }
            });
        }

        @JavascriptInterface
        public void saveHistoryJson(String json) {
            if (sqliteDb == null || json == null) return;
            try {
                sqliteDb.execSQL(
                    "INSERT OR REPLACE INTO kv_store (k, v) VALUES ('price_records_json', ?)",
                    new Object[]{json}
                );
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public String loadHistoryJson() {
            if (sqliteDb == null) return "";
            Cursor c = null;
            try {
                c = sqliteDb.rawQuery(
                    "SELECT v FROM kv_store WHERE k = 'price_records_json' LIMIT 1",
                    null
                );
                if (c != null && c.moveToFirst()) {
                    return c.getString(0);
                }
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.close();
            }
            return "";
        }
    }

    private void startRealNativeGpsLookup() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(
                        new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        REQ_GPS_PERMISSION
                    );
                    return;
                }
            }

            if (locationManager == null) {
                sendGpsErrorToJs("無法存取系統 LocationManager");
                return;
            }

            Location bestLast = null;
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                bestLast = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (bestLast == null && locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                bestLast = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }

            if (bestLast != null) {
                sendGpsCoordsToJs(bestLast.getLatitude(), bestLast.getLongitude(), bestLast.getProvider());
            }

            final LocationListener onceListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location loc) {
                    if (loc != null) {
                        sendGpsCoordsToJs(loc.getLatitude(), loc.getLongitude(), loc.getProvider());
                        try {
                            locationManager.removeUpdates(this);
                        } catch (SecurityException ignored) {
                        }
                    }
                }

                @Override
                public void onStatusChanged(String p, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(String p) {}

                @Override
                public void onProviderDisabled(String p) {}
            };

            boolean requested = false;
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0, 0, onceListener);
                requested = true;
            }
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, onceListener);
                requested = true;
            }

            if (!requested && bestLast == null) {
                sendGpsErrorToJs("請在手機下拉選單開啟「位置 / GPS」功能");
            }
        } catch (SecurityException se) {
            sendGpsErrorToJs("未授予 GPS 定位權限");
        } catch (Exception e) {
            sendGpsErrorToJs(e.getMessage());
        }
    }

    private void sendGpsCoordsToJs(final double lat, final double lon, final String provider) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    String js = "window.onRealGpsLocationReceived(" + lat + ", " + lon + ", '" + provider + "');";
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    private void sendGpsErrorToJs(final String msg) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    String safe = msg == null ? "定位失敗" : msg.replace("'", "");
                    webView.evaluateJavascript("window.onRealGpsError('" + safe + "');", null);
                }
            }
        });
    }

    private void startNativeCameraIntent() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_CAMERA_CAPTURE);
                    return;
                }
            }
            Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            startActivityForResult(takePictureIntent, REQ_CAMERA_CAPTURE);
        } catch (Exception e) {
            sendGpsErrorToJs("無法啟動手機相機：" + e.getMessage());
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_CAMERA_CAPTURE && resultCode == Activity.RESULT_OK && data != null) {
            Bundle extras = data.getExtras();
            if (extras != null) {
                Object rawBitmap = extras.get("data");
                if (rawBitmap instanceof Bitmap) {
                    Bitmap bmp = (Bitmap) rawBitmap;
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.JPEG, 82, baos);
                    String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                    final String dataUrl = "data:image/jpeg;base64," + base64;
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (webView != null) {
                                webView.evaluateJavascript(
                                    "window.onNativeCameraPhotoCaptured('" + dataUrl + "');",
                                    null
                                );
                            }
                        }
                    });
                }
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_GPS_PERMISSION || requestCode == REQ_PERMISSIONS) {
            startRealNativeGpsLookup();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
EOF

echo "==> [1/6] Compiling Android resources with aapt2..."
"${AAPT2}" compile --dir "${WORK_DIR}/res" -o "${WORK_DIR}/compiled_res/"

echo "==> [2/6] Linking resources and generating R.java & base APK..."
"${AAPT2}" link \
  -o "${WORK_DIR}/unaligned.apk" \
  -I "${ANDROID_JAR}" \
  --manifest "${WORK_DIR}/AndroidManifest.xml" \
  -A "${WORK_DIR}/assets" \
  --java "${WORK_DIR}/src" \
  "${WORK_DIR}/compiled_res/"*.flat

echo "==> [3/6] Compiling Java sources with javac (JDK 17)..."
javac -source 1.8 -target 1.8 \
  -bootclasspath "${ANDROID_JAR}" \
  -classpath "${ANDROID_JAR}" \
  -d "${WORK_DIR}/classes" \
  "${WORK_DIR}/src/com/smartgrocery/unitpricecomparator/R.java" \
  "${WORK_DIR}/src/com/smartgrocery/unitpricecomparator/MainActivity.java"

echo "==> [4/6] Converting JVM bytecode to Dalvik DEX with d8..."
"${D8}" --lib "${ANDROID_JAR}" \
  --output "${WORK_DIR}/dex" \
  "${WORK_DIR}/classes/com/smartgrocery/unitpricecomparator/"*.class

# 將 classes.dex 封裝進 APK 根目錄
(cd "${WORK_DIR}/dex" && zip -q "${WORK_DIR}/unaligned.apk" classes.dex)

echo "==> [5/6] Aligning APK with zipalign..."
"${ZIPALIGN}" -f -p 4 "${WORK_DIR}/unaligned.apk" "${WORK_DIR}/aligned.apk"

echo "==> [6/6] Generating signing keystore and signing APK (v2 + v3 signatures)..."
KEYSTORE="${WORK_DIR}/release-key.jks"
keytool -genkeypair \
  -v \
  -keystore "${KEYSTORE}" \
  -alias smartgrocery \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass android123 \
  -keypass android123 \
  -dname "CN=Smart Grocery Comparator, OU=Mobile, O=SmartGrocery, L=Taipei, ST=Taiwan, C=TW" >/dev/null 2>&1

mkdir -p "${PROJECT_ROOT}/release"
FINAL_APK_REPO="${PROJECT_ROOT}/release/SmartGroceryComparator-v1.0.0-release.apk"
FINAL_APK_ROOT="${PROJECT_ROOT}/SmartGroceryComparator-v1.0.0.apk"
FINAL_APK_ARTIFACT="${ARTIFACT_DIR}/SmartGroceryComparator-v1.0.0.apk"

"${APKSIGNER}" sign \
  --ks "${KEYSTORE}" \
  --ks-pass pass:android123 \
  --key-pass pass:android123 \
  --out "${FINAL_APK_REPO}" \
  "${WORK_DIR}/aligned.apk"

"${APKSIGNER}" verify --verbose "${FINAL_APK_REPO}"

cp "${FINAL_APK_REPO}" "${FINAL_APK_ROOT}"
cp "${FINAL_APK_REPO}" "${FINAL_APK_ARTIFACT}"

ls -lh "${FINAL_APK_REPO}" "${FINAL_APK_ROOT}" "${FINAL_APK_ARTIFACT}"
