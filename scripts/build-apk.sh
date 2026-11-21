#!/usr/bin/env bash
set -euo pipefail

# 賣場極簡比價王 (Smart Grocery Unit Price Comparator) - v1.3.0
# 功能與視覺升級：
# 1. 日系無印柔和極簡風格（暖米白 #F7F6F2 底色、莫蘭迪鼠尾草綠 #5B836B、乾燥玫瑰粉 #B86B6B）
# 2. 所有實心按鈕改為「粗框空心按鈕 (2.5px Thick Outline Hollow Buttons)」
# 3. 真實 GPS 定位直接顯示「賣場品牌 + 分店名稱 / 路名」（結合 Android 原生 Geocoder 逆地理編碼與全台各縣市賣場座標庫），不再顯示經緯度數字

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/home/antigravity/android-sdk}}"
BUILD_TOOLS="${SDK_ROOT}/build-tools/34.0.0"
ANDROID_JAR="${SDK_ROOT}/platforms/android-34/android.jar"

AAPT2="${BUILD_TOOLS}/aapt2"
D8="${BUILD_TOOLS}/d8"
ZIPALIGN="${BUILD_TOOLS}/zipalign"
APKSIGNER="${BUILD_TOOLS}/apksigner"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

# 1. 建立 AndroidManifest.xml
cat << 'EOF' > "${WORK_DIR}/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.smartgrocery.unitpricecomparator"
    android:versionCode="4"
    android:versionName="1.3.0">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />

    <!-- 手機原生硬體權限：真實相機放大鏡鏡頭取景、手電筒補光、真實 GPS 衛星與網路定位 -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.FLASHLIGHT" />
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

# 2. 建立柔和鼠尾草綠皇冠向量圖示 (@drawable/ic_launcher)
cat << 'EOF' > "${WORK_DIR}/res/drawable/ic_launcher.xml"
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#5B836B"
        android:pathData="M0,0h108v108h-108z"/>
    <path
        android:fillColor="#F7F6F2"
        android:pathData="M24,74L84,74L84,82L24,82ZM24,66L30,36L45,52L54,30L63,52L78,36L84,66Z"/>
</vector>
EOF

cat << 'EOF' > "${WORK_DIR}/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">賣場極簡比價王</string>
</resources>
EOF

# 3. 建立「日系柔和極簡風 + 粗框空心按鈕 + GPS 賣場店名直接顯示」前端介面
cat << 'EOF' > "${WORK_DIR}/assets/index.html"
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>賣場極簡比價王</title>
  <style>
    * { box-sizing: border-box; user-select: none; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", "PingFang TC", sans-serif;
      background: #F7F6F2;
      color: #2C302E;
      overflow: hidden;
    }
    .app-shell { display: flex; flex-direction: column; width: 100%; height: 100%; background: #F7F6F2; }

    /* 頂部柔和卡片 Header */
    .top-header-card {
      margin: 8px 10px 4px 10px;
      padding: 12px 14px;
      background: #FFFFFF;
      border: 1.5px solid #E2E0D8;
      border-radius: 20px;
      box-shadow: 0 2px 8px rgba(44, 48, 46, 0.04);
      flex-shrink: 0;
    }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }
    .app-title { font-size: 22px; font-weight: 900; color: #2C302E; letter-spacing: 0.3px; }
    .btn-reset {
      background: transparent;
      border: 2px solid #8E9490;
      border-radius: 16px;
      padding: 5px 11px;
      font-size: 13px;
      font-weight: 800;
      color: #4A4F4C;
    }
    .store-bar { display: flex; gap: 8px; align-items: center; }
    .store-select-wrap {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      background: #F7F6F2;
      border: 1.5px solid #D5D3CA;
      border-radius: 22px;
      padding: 0 12px;
      min-width: 0;
    }
    .store-select {
      width: 100%;
      background: transparent;
      border: none;
      padding: 8px 18px 8px 2px;
      font-size: 15px;
      font-weight: 800;
      color: #2C302E;
      appearance: none;
      -webkit-appearance: none;
      outline: none;
      text-overflow: ellipsis;
    }
    .store-chevron {
      position: absolute;
      right: 12px;
      pointer-events: none;
      font-size: 14px;
      font-weight: 900;
      color: #5C615E;
    }
    /* 粗框空心 GPS 定位按鈕 */
    .btn-gps {
      background: transparent;
      border: 2.5px solid #5B836B;
      border-radius: 22px;
      padding: 7px 13px;
      font-size: 14px;
      font-weight: 800;
      color: #466A54;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .gps-branch-tag {
      margin-top: 6px;
      font-size: 12.5px;
      font-weight: 800;
      color: #5B836B;
      padding-left: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* 主內容與商品比價卡片 */
    .main-view { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #F7F6F2; }
    .cards-scroll { flex: 1; overflow-y: auto; padding: 6px 10px 14px 10px; }
    .card {
      background: #FFFFFF;
      border: 1.5px solid #E2E0D8;
      border-radius: 20px;
      padding: 14px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(44, 48, 46, 0.03);
    }
    .card.winner {
      border: 2.5px solid #5B836B;
      background: #FAFDFB;
    }
    /* 粗框空心最划算皇冠橫幅 */
    .winner-banner {
      background: #F2F7F4;
      border: 2px solid #5B836B;
      color: #466A54;
      border-radius: 12px;
      padding: 6px 10px;
      text-align: center;
      font-size: 15.5px;
      font-weight: 900;
      margin-bottom: 10px;
    }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    /* 粗框空心編號 #1 */
    .badge-num {
      background: transparent;
      border: 2px solid #5B836B;
      color: #466A54;
      font-size: 14px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .title-input {
      flex: 1;
      min-width: 0;
      font-size: 18px;
      font-weight: 800;
      color: #2C302E;
      border: none;
      border-bottom: 1px solid #E6E4DC;
      background: transparent;
      padding: 2px 0;
      user-select: text;
    }
    /* 粗框空心水平「🔍 放大鏡」膠囊按鈕（不折行） */
    .btn-magnifier {
      background: transparent;
      border: 2px solid #3E423F;
      color: #2C302E;
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 14px;
      font-weight: 800;
      flex-shrink: 0;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-del {
      background: transparent;
      border: none;
      font-size: 18px;
      font-weight: 700;
      color: #9CA39E;
      padding: 2px 6px;
      flex-shrink: 0;
    }

    .alert-box { border-radius: 10px; padding: 6px 10px; margin-bottom: 10px; font-size: 13.5px; font-weight: 800; border: 1.5px solid; }
    .alert-green { background: #F2F7F4; border-color: #5B836B; color: #466A54; }
    .alert-red { background: #FDF6F6; border-color: #B86B6B; color: #A65858; }

    .inputs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .input-box {
      background: #F7F6F2;
      border: 1.5px solid #D5D3CA;
      border-radius: 14px;
      padding: 8px 12px;
      transition: all 0.15s ease;
    }
    .input-box.focused {
      border: 2.5px solid #5B836B;
      background: #FFFFFF;
      box-shadow: 0 0 0 3px rgba(91, 131, 107, 0.12);
    }
    .input-lbl { font-size: 13.5px; font-weight: 700; color: #5C615E; }
    .input-val-row { display: flex; align-items: baseline; margin-top: 2px; }
    .input-val { font-size: 26px; font-weight: 900; color: #2C302E; }
    .input-val.empty { color: #B5B3AA; }
    .sub-discount { font-size: 12px; font-weight: 800; color: #5B836B; margin-top: 2px; }

    /* 單位與促銷選擇膠囊（粗框空心選取態） */
    .pills-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; }
    .pills-lbl { font-size: 13.5px; font-weight: 700; color: #5C615E; margin-right: 2px; }
    .pill {
      padding: 4px 12px;
      border-radius: 18px;
      font-size: 14px;
      font-weight: 700;
      border: 1.5px solid #D5D3CA;
      background: #F7F6F2;
      color: #4A4F4C;
    }
    .pill.active-unit, .pill.active-promo {
      background: #EDF3EF;
      border: 2.5px solid #5B836B;
      color: #3F634D;
      font-weight: 900;
    }

    .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ECEAE2; padding-top: 9px; margin-top: 4px; }
    .unit-price-big { font-size: 22px; font-weight: 900; color: #2C302E; }
    .unit-price-big.win { color: #466A54; }
    .unit-price-big.lose { color: #A65858; }
    .badge-lose {
      background: transparent;
      border: 1.5px solid #B86B6B;
      color: #A65858;
      font-size: 12px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 8px;
      margin-left: 6px;
    }
    /* 粗框空心「儲存此價格」按鈕 */
    .btn-save {
      background: transparent;
      border: 2.5px solid #5B836B;
      color: #466A54;
      border-radius: 14px;
      padding: 8px 13px;
      font-size: 14px;
      font-weight: 800;
    }
    .btn-save:disabled {
      border-color: #D5D3CA;
      color: #B5B3AA;
    }

    /* 下半部 45% 單手拇指操作熱區（柔和暖灰米色 + 粗框空心按鈕） */
    .thumb-dock {
      background: #EAE7DF;
      border-top: 1px solid #DCD9D0;
      padding: 10px 10px 8px 10px;
      flex-shrink: 0;
    }
    .thumb-actions { display: flex; gap: 8px; margin-bottom: 7px; }
    /* 粗框空心「＋ 新增比價商品」 */
    .btn-add {
      flex: 1.15;
      background: transparent;
      border: 2.5px solid #3E423F;
      color: #2C302E;
      border-radius: 22px;
      padding: 9px 10px;
      font-size: 15px;
      font-weight: 800;
      white-space: nowrap;
    }
    /* 粗框空心「🔍 放大鏡看標價」 */
    .btn-cam {
      flex: 1.15;
      background: transparent;
      border: 2.5px solid #5B836B;
      color: #466A54;
      border-radius: 22px;
      padding: 9px 10px;
      font-size: 15px;
      font-weight: 800;
      white-space: nowrap;
    }
    .btn-fold {
      background: transparent;
      border: 1.5px solid #9CA39E;
      color: #4A4F4C;
      border-radius: 18px;
      padding: 9px 10px;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }
    .target-hint {
      padding: 2px 4px;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 800;
      color: #2C302E;
    }
    .keypad-grid { display: grid; grid-template-columns: 3fr 1fr; gap: 7px; }
    .num-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .key-btn {
      height: 45px;
      background: #FFFFFF;
      border: 1px solid #DCD9D0;
      border-radius: 12px;
      font-size: 22px;
      font-weight: 800;
      color: #2C302E;
      box-shadow: 0 1px 2px rgba(44, 48, 46, 0.04);
    }
    .key-btn:active { background: #F2F0E8; }
    .side-keys { display: flex; flex-direction: column; gap: 6px; }
    /* 粗框空心「清除」按鈕（乾燥玫瑰粉粗框） */
    .key-clear {
      height: 45px;
      background: #EFECE6;
      border: 2.5px solid #B86B6B;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 800;
      color: #A65858;
    }
    /* 粗框空心「下一欄 →」大按鈕（鼠尾草綠粗框） */
    .key-next {
      flex: 1;
      background: #E5EDE8;
      border: 2.5px solid #5B836B;
      color: #3F634D;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 800;
    }

    /* 底部柔和膠囊雙分頁導覽列 */
    .bottom-nav {
      display: grid;
      grid-template-columns: 1fr 1fr;
      height: 56px;
      background: #EAE7DF;
      padding: 5px 8px;
      gap: 6px;
      flex-shrink: 0;
    }
    .nav-item {
      border: none;
      border-radius: 22px;
      font-size: 16.5px;
      font-weight: 800;
      background: transparent;
      color: #7A7E7B;
    }
    .nav-item.active {
      background: #FFFFFF;
      color: #2C302E;
      font-weight: 900;
      box-shadow: 0 1px 4px rgba(44, 48, 46, 0.07);
    }

    /* 底價紀錄分頁 + 左滑刪除 + 粗框空心一鍵清除全部 */
    .history-panel { flex: 1; overflow-y: auto; padding: 12px; background: #F7F6F2; }
    .history-top-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; }
    .swipe-tip { font-size: 13px; font-weight: 800; color: #5C615E; flex: 1; }
    .btn-clear-all {
      background: transparent;
      border: 2.5px solid #B86B6B;
      color: #A65858;
      border-radius: 16px;
      padding: 7px 12px;
      font-size: 13.5px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .btn-clear-all:disabled { border-color: #D5D3CA; color: #B5B3AA; }
    .search-input {
      width: 100%;
      border: 1.5px solid #D5D3CA;
      border-radius: 16px;
      padding: 10px 14px;
      font-size: 15.5px;
      font-weight: 700;
      margin-bottom: 10px;
      background: #FFFFFF;
      color: #2C302E;
      user-select: text;
    }

    /* 左滑刪除容器 */
    .swipe-wrapper { position: relative; margin-bottom: 12px; border-radius: 18px; overflow: hidden; background: #C87A7A; }
    .swipe-delete-bg { position: absolute; top: 0; bottom: 0; right: 0; width: 96px; background: #C87A7A; color: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; z-index: 1; }
    .swipe-card-fg { position: relative; z-index: 2; background: #FFFFFF; border: 1.5px solid #E2E0D8; border-radius: 18px; padding: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: transform 0.18s ease-out; touch-action: pan-y; }

    .toast {
      position: fixed;
      top: 14px;
      left: 14px;
      right: 14px;
      background: #3E423F;
      color: #F7F6F2;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      font-weight: 800;
      z-index: 2000;
      box-shadow: 0 6px 16px rgba(0,0,0,0.15);
      display: none;
    }

    /* 長輩友善「相機高倍率放大鏡」視窗 Modal（粗框空心按鈕版） */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(44, 48, 46, 0.65); z-index: 1500; display: none; align-items: flex-end; justify-content: center; }
    .modal-sheet { width: 100%; max-height: 95%; background: #F7F6F2; border-top-left-radius: 26px; border-top-right-radius: 26px; padding: 15px; overflow-y: auto; }
    .mag-viewport { position: relative; width: 100%; height: 245px; background: #1E201F; border-radius: 18px; border: 3px solid #5B836B; overflow: hidden; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; }
    .mag-video { width: 100%; height: 100%; object-fit: cover; transform-origin: center center; transition: transform 0.15s ease-out; }
    .mag-badge { position: absolute; top: 10px; left: 10px; background: rgba(44,48,46,0.75); color: #DCECE2; font-size: 14px; font-weight: 800; padding: 4px 10px; border-radius: 10px; pointer-events: none; }
    .mag-crosshair { position: absolute; width: 84%; height: 120px; border: 2px dashed rgba(220,236,226,0.75); border-radius: 12px; pointer-events: none; }
    .zoom-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
    .zoom-btn { background: #FFFFFF; border: 1.5px solid #D5D3CA; border-radius: 14px; padding: 10px 4px; font-size: 15px; font-weight: 800; color: #4A4F4C; text-align: center; }
    .zoom-btn.active { background: #EDF3EF; border: 2.5px solid #5B836B; color: #3F634D; font-weight: 900; }
    .mag-tools-row { display: flex; gap: 8px; margin-bottom: 10px; }
    .btn-freeze { flex: 1.5; background: transparent; border: 2.5px solid #3E423F; color: #2C302E; border-radius: 16px; padding: 11px; font-size: 15px; font-weight: 800; }
    .btn-freeze.frozen { border-color: #B86B6B; color: #A65858; background: #FDF6F6; }
    .btn-contrast { flex: 1; background: transparent; border: 2.5px solid #5B836B; color: #466A54; border-radius: 16px; padding: 11px; font-size: 14.5px; font-weight: 800; }
    .btn-contrast.active { background: #EDF3EF; }
    .mag-entry-box { background: #FFFFFF; border: 1.5px solid #E2E0D8; border-radius: 16px; padding: 12px; }
    .mag-input { width: 100%; border: 2px solid #5B836B; border-radius: 12px; padding: 6px 10px; font-size: 24px; font-weight: 900; color: #2C302E; background: #F7F6F2; user-select: text; }
  </style>
</head>
<body>
  <div id="toast" class="toast"></div>

  <!-- 長輩友善「🔍 相機高倍率放大鏡」Modal -->
  <div id="magnifierModal" class="modal-backdrop">
    <div class="modal-sheet">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-size:20px;font-weight:900;color:#2C302E;" id="magModalTitle">🔍 價標放大鏡 (3x)</div>
          <div style="font-size:13px;font-weight:700;color:#5B836B;">對準貨架價標看清楚「標價」與「容量」，可定格畫面拿近看</div>
        </div>
        <button onclick="closeMagnifier()" style="background:transparent;border:2px solid #8E9490;border-radius:14px;font-size:14px;font-weight:800;color:#4A4F4C;padding:5px 12px;">✕ 關閉</button>
      </div>

      <div class="mag-viewport">
        <video id="magVideo" class="mag-video" autoplay playsinline muted></video>
        <canvas id="magFrozenCanvas" class="mag-video" style="display:none;"></canvas>
        <div class="mag-crosshair"></div>
        <div id="magBadgeText" class="mag-badge">🔍 目前放大 3x</div>
      </div>

      <div class="zoom-row">
        <button id="zBtn1" class="zoom-btn" onclick="setMagnifierZoom(1)">1x 原倍</button>
        <button id="zBtn2" class="zoom-btn" onclick="setMagnifierZoom(2)">2x 放大</button>
        <button id="zBtn3" class="zoom-btn active" onclick="setMagnifierZoom(3)">3x 特大</button>
        <button id="zBtn5" class="zoom-btn" onclick="setMagnifierZoom(5)">5x 超大</button>
      </div>

      <div class="mag-tools-row">
        <button id="btnFreezeFrame" class="btn-freeze" onclick="toggleFreezeMagnifier()">
          ❄️ 定格畫面 (拿近慢慢看)
        </button>
        <button id="btnHighContrast" class="btn-contrast" onclick="toggleHighContrast()">
          🔆 加強清晰度
        </button>
      </div>

      <div class="mag-entry-box">
        <div style="font-size:13px;font-weight:800;color:#466A54;margin-bottom:6px;" id="magSyncHint">
          ✍️ 看清楚後可直接在此輸入（自動同步至商品卡）：
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#5C615E;margin-bottom:2px;">總價格 (元)</div>
            <input id="magPriceInput" class="mag-input" type="number" inputmode="decimal" placeholder="0" oninput="syncFromMagnifier()" />
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#5C615E;margin-bottom:2px;">總容量 / 數量</div>
            <input id="magQtyInput" class="mag-input" type="number" inputmode="decimal" placeholder="0" oninput="syncFromMagnifier()" />
          </div>
        </div>
        <button onclick="closeMagnifier()" style="width:100%;background:#EDF3EF;color:#3F634D;border:2.5px solid #5B836B;border-radius:16px;padding:11px;font-size:16px;font-weight:900;">
          ✅ 看完填好，返回比價
        </button>
      </div>
    </div>
  </div>

  <div class="app-shell">
    <!-- 頂部柔和極簡卡片 Header -->
    <div class="top-header-card">
      <div class="header-row">
        <div class="app-title">賣場極簡比價王</div>
        <button class="btn-reset" onclick="resetCards()">清空重算</button>
      </div>
      <div class="store-bar">
        <div class="store-select-wrap">
          <select id="storeSelect" class="store-select" onchange="setStoreManual(this.value)">
            <option id="optPxmart" value="全聯福利中心">當前賣場：全聯福利中心</option>
            <option id="optCostco" value="好市多 Costco">當前賣場：好市多 Costco</option>
            <option id="optCarrefour" value="家樂福 Carrefour">當前賣場：家樂福 Carrefour</option>
            <option id="optRtmart" value="大潤發 RT-Mart">當前賣場：大潤發 RT-Mart</option>
            <option id="optAmart" value="愛買 a.mart">當前賣場：愛買 a.mart</option>
          </select>
          <span class="store-chevron">⌄</span>
        </div>
        <button class="btn-gps" onclick="requestRealGps()">GPS 定位</button>
      </div>
      <div id="gpsText" class="gps-branch-tag" style="display:none;"></div>
    </div>

    <!-- 分頁 1：比價計算 -->
    <div id="viewCompare" class="main-view">
      <div id="cardsList" class="cards-scroll"></div>
      <div class="thumb-dock">
        <div class="thumb-actions">
          <button class="btn-add" onclick="addProduct()">＋ 新增比價商品</button>
          <button class="btn-cam" onclick="openMagnifierFor(target.id)">🔍 放大鏡看標價</button>
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
              <button class="key-btn" onclick="back()">⌫</button>
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

    <!-- 分頁 2：底價紀錄 (支援左滑刪除 + 粗框空心一鍵清除全部) -->
    <div id="viewHistory" class="history-panel" style="display:none;">
      <div class="history-top-bar">
        <div class="swipe-tip">💡 提示：將紀錄「往左滑」即可刪除</div>
        <button id="btnClearAllHistory" class="btn-clear-all" onclick="clearAllHistoryRecords()">
          🗑️ 一鍵清除全部
        </button>
      </div>
      <input id="searchBox" class="search-input" type="text" placeholder="🔍 搜尋商品名稱（如：衛生紙、鮮乳）..." oninput="renderHistory()" />
      <div id="storeFilters" class="pills-row" style="margin-bottom:10px;"></div>
      <div id="historyList"></div>
    </div>

    <!-- 底部柔和雙分頁導覽列 -->
    <div class="bottom-nav">
      <button id="tabBtn1" class="nav-item active" onclick="switchTab(1)">比價計算 (<span id="cntCompare">2</span>)</button>
      <button id="tabBtn2" class="nav-item" onclick="switchTab(2)">底價紀錄 (<span id="cntHistory">0</span>)</button>
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

    // 全台主要縣市實體大賣場分店座標庫（涵蓋新竹/竹北、雙北、桃園、台中、嘉南、高屏）
    const STORE_FENCES = [
      // 新竹市 / 竹北市
      { storeName: '全聯福利中心', branch: '新竹中正店', lat: 24.8128, lon: 120.9642 },
      { storeName: '全聯福利中心', branch: '新竹北大店', lat: 24.8065, lon: 120.9628 },
      { storeName: '全聯福利中心', branch: '新竹光復店', lat: 24.7952, lon: 120.9968 },
      { storeName: '全聯福利中心', branch: '竹北縣政店', lat: 24.8321, lon: 121.0124 },
      { storeName: '好市多 Costco', branch: '新竹店', lat: 24.7916, lon: 121.0142 },
      { storeName: '大潤發 RT-Mart', branch: '新竹湳雅店', lat: 24.8178, lon: 120.9746 },
      { storeName: '大潤發 RT-Mart', branch: '新竹忠孝店', lat: 24.8034, lon: 120.9854 },
      { storeName: '家樂福 Carrefour', branch: '竹北店', lat: 24.8268, lon: 121.0085 },
      { storeName: '愛買 a.mart', branch: '新竹店', lat: 24.8002, lon: 120.9912 },

      // 台北市 / 新北市
      { storeName: '全聯福利中心', branch: '台北大安延吉店', lat: 25.033964, lon: 121.543378 },
      { storeName: '全聯福利中心', branch: '新北板橋文化店', lat: 25.013200, lon: 121.463700 },
      { storeName: '好市多 Costco', branch: '台北內湖店', lat: 25.065321, lon: 121.575412 },
      { storeName: '好市多 Costco', branch: '新北中和店', lat: 25.001800, lon: 121.491200 },
      { storeName: '好市多 Costco', branch: '新北汐止店', lat: 25.059800, lon: 121.638200 },
      { storeName: '好市多 Costco', branch: '台北北投店', lat: 25.128200, lon: 121.468500 },
      { storeName: '家樂福 Carrefour', branch: '台北桂林店', lat: 25.038200, lon: 121.506300 },
      { storeName: '家樂福 Carrefour', branch: '台北內湖店', lat: 25.068100, lon: 121.579400 },
      { storeName: '家樂福 Carrefour', branch: '新北新店店', lat: 24.976200, lon: 121.546100 },
      { storeName: '大潤發 RT-Mart', branch: '台北中崙店', lat: 25.048190, lon: 121.544610 },
      { storeName: '大潤發 RT-Mart', branch: '台北內湖店', lat: 25.064500, lon: 121.573900 },
      { storeName: '愛買 a.mart', branch: '台北大直店', lat: 25.083120, lon: 121.556110 },
      { storeName: '愛買 a.mart', branch: '板橋南雅店', lat: 24.996800, lon: 121.458100 },

      // 桃園市
      { storeName: '好市多 Costco', branch: '桃園南崁店', lat: 25.055800, lon: 121.287200 },
      { storeName: '好市多 Costco', branch: '桃園中壢店', lat: 24.957600, lon: 121.163200 },
      { storeName: '家樂福 Carrefour', branch: '桃園經國店', lat: 25.016800, lon: 121.304500 },
      { storeName: '大潤發 RT-Mart', branch: '桃園中壢店', lat: 24.959200, lon: 121.240800 },
      { storeName: '愛買 a.mart', branch: '桃園店', lat: 24.989500, lon: 121.282500 },

      // 台中市
      { storeName: '全聯福利中心', branch: '台中市政店', lat: 24.161800, lon: 120.646900 },
      { storeName: '好市多 Costco', branch: '台中南屯店', lat: 24.132900, lon: 120.648800 },
      { storeName: '好市多 Costco', branch: '北台中店', lat: 24.184200, lon: 120.706800 },
      { storeName: '家樂福 Carrefour', branch: '台中青海店', lat: 24.163200, lon: 120.638100 },
      { storeName: '家樂福 Carrefour', branch: '台中文心店', lat: 24.146200, lon: 120.648200 },
      { storeName: '大潤發 RT-Mart', branch: '台中忠明店', lat: 24.167800, lon: 120.668200 },
      { storeName: '愛買 a.mart', branch: '台中復興店', lat: 24.119500, lon: 120.662400 },

      // 嘉義 / 台南 / 高雄
      { storeName: '好市多 Costco', branch: '嘉義店', lat: 23.501200, lon: 120.448500 },
      { storeName: '好市多 Costco', branch: '台南店', lat: 23.005200, lon: 120.192400 },
      { storeName: '家樂福 Carrefour', branch: '台南安平店', lat: 22.999200, lon: 120.181500 },
      { storeName: '全聯福利中心', branch: '高雄巨蛋店', lat: 22.665100, lon: 120.303200 },
      { storeName: '好市多 Costco', branch: '高雄大順店', lat: 22.656200, lon: 120.305900 },
      { storeName: '好市多 Costco', branch: '高雄中華店', lat: 22.603500, lon: 120.304800 },
      { storeName: '家樂福 Carrefour', branch: '高雄鼎山店', lat: 22.655100, lon: 120.320400 }
    ];

    let store = '全聯福利中心';
    let currentBranchLabel = '';
    let lastGpsCoords = { lat: null, lon: null };
    let filterStore = 'ALL';
    let padOpen = true;

    let activeStream = null;
    let currentMagnifierCardId = 'c1';
    let currentZoomScale = 3;
    let isMagnifierFrozen = false;
    let isHighContrast = false;

    function loadInitialHistory() {
      if (window.AndroidBridge && window.AndroidBridge.loadHistoryJson) {
        try {
          const raw = window.AndroidBridge.loadHistoryJson();
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          }
        } catch (e) {}
      }
      const local = JSON.parse(localStorage.getItem('smart_grocery_sqlite_v3') || 'null');
      if (Array.isArray(local)) return local;
      return [];
    }

    let history = loadInitialHistory();

    function persistHistory() {
      const jsonStr = JSON.stringify(history);
      localStorage.setItem('smart_grocery_sqlite_v3', jsonStr);
      if (window.AndroidBridge && window.AndroidBridge.saveHistoryJson) {
        try { window.AndroidBridge.saveHistoryJson(jsonStr); } catch (e) {}
      }
    }

    let items = [
      { id: 'c1', title: '商品 1', price: '', qty: '', unit: 'g', promo: 'NONE' },
      { id: 'c2', title: '商品 2', price: '', qty: '', unit: 'g', promo: 'NONE' }
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

    function updateStoreSelectDisplay(storeName, branchText) {
      const selectEl = document.getElementById('storeSelect');
      selectEl.value = storeName;
      const options = selectEl.options;
      for (let i = 0; i < options.length; i++) {
        const val = options[i].value;
        const shortName = val.split(' ')[0];
        if (val === storeName && branchText) {
          options[i].textContent = `當前賣場：${shortName}（${branchText}）`;
        } else {
          options[i].textContent = `當前賣場：${val}`;
        }
      }
    }

    // 接收來自 Android 原生 LocationManager + Geocoder 的定位與真實路名/店名（直接顯示店名，不顯示經緯度數字）
    window.onRealGpsLocationReceived = function(lat, lon, nativeAddressArea) {
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

      // 若距離內建分店在 2.5 公里內，優先顯示精確分店名；若在其它區域且原生 Geocoder 有解析出縣市路名，則顯示該路名分店
      let branchName = nearest.branch;
      if (minDist > 2500 && nativeAddressArea && nativeAddressArea.length >= 2) {
        branchName = nativeAddressArea + '門市';
      }
      currentBranchLabel = branchName;

      updateStoreSelectDisplay(store, branchName);

      const gpsEl = document.getElementById('gpsText');
      const shortBrand = store.split(' ')[0];
      gpsEl.style.display = 'flex';
      gpsEl.textContent = `📍 已自動定位：${shortBrand} · ${branchName}`;
      toast(`📍 已定位至：${shortBrand}（${branchName}）`);
    };

    window.onRealGpsError = function(errMsg) {
      const gpsEl = document.getElementById('gpsText');
      gpsEl.style.display = 'flex';
      gpsEl.textContent = '📍 ' + errMsg;
      toast('📍 ' + errMsg);
    };

    function requestRealGps() {
      const gpsEl = document.getElementById('gpsText');
      gpsEl.style.display = 'flex';
      gpsEl.textContent = '📍 正在定位您所在的賣場店名...';
      if (window.AndroidBridge && window.AndroidBridge.requestNativeGps) {
        window.AndroidBridge.requestNativeGps();
        return;
      }
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => window.onRealGpsLocationReceived(pos.coords.latitude, pos.coords.longitude, ''),
          err => window.onRealGpsError(err.message || '請確認已開啟手機定位權限'),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }

    function setStoreManual(val) {
      store = val;
      currentBranchLabel = '';
      updateStoreSelectDisplay(store, '');
    }

    // 開啟長輩友善「🔍 相機高倍率放大鏡」
    async function openMagnifierFor(cardId) {
      currentMagnifierCardId = cardId || target.id;
      target = { id: currentMagnifierCardId, field: 'price' };
      const it = items.find(x => x.id === currentMagnifierCardId) || items[0];

      document.getElementById('magPriceInput').value = it.price || '';
      document.getElementById('magQtyInput').value = it.qty || '';
      document.getElementById('magSyncHint').textContent =
        `✍️ 看清楚後可直接在此輸入（自動同步至 ${it.title}）：`;

      isMagnifierFrozen = false;
      document.getElementById('magFrozenCanvas').style.display = 'none';
      document.getElementById('magVideo').style.display = 'block';
      document.getElementById('btnFreezeFrame').textContent = '❄️ 定格畫面 (拿近慢慢看)';
      document.getElementById('btnFreezeFrame').classList.remove('frozen');

      document.getElementById('magnifierModal').style.display = 'flex';
      setMagnifierZoom(3);

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
          const videoEl = document.getElementById('magVideo');
          videoEl.srcObject = activeStream;
        } catch (err) {
          toast('請允許相機權限以使用價標放大鏡');
        }
      }
    }

    function setMagnifierZoom(scale) {
      currentZoomScale = scale;
      [1, 2, 3, 5].forEach(s => {
        const btn = document.getElementById('zBtn' + s);
        if (btn) btn.className = 'zoom-btn' + (s === scale ? ' active' : '');
      });
      const videoEl = document.getElementById('magVideo');
      const canvasEl = document.getElementById('magFrozenCanvas');
      const filterStr = isHighContrast ? 'contrast(1.45) brightness(1.08) saturate(1.2)' : 'none';
      videoEl.style.transform = `scale(${scale})`;
      videoEl.style.filter = filterStr;
      canvasEl.style.transform = `scale(${scale})`;
      canvasEl.style.filter = filterStr;

      document.getElementById('magModalTitle').textContent = `🔍 價標放大鏡 (${scale}x)`;
      document.getElementById('magBadgeText').textContent =
        isMagnifierFrozen ? `❄️ 畫面已定格 (${scale}x 放大)` : `🔍 目前放大 ${scale}x`;

      if (activeStream) {
        try {
          const track = activeStream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (caps && caps.zoom) {
            const targetHwZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, scale));
            track.applyConstraints({ advanced: [{ zoom: targetHwZoom }] });
          }
        } catch (e) {}
      }
    }

    function toggleFreezeMagnifier() {
      const videoEl = document.getElementById('magVideo');
      const canvasEl = document.getElementById('magFrozenCanvas');
      const btn = document.getElementById('btnFreezeFrame');

      if (isMagnifierFrozen) {
        isMagnifierFrozen = false;
        canvasEl.style.display = 'none';
        videoEl.style.display = 'block';
        btn.textContent = '❄️ 定格畫面 (拿近慢慢看)';
        btn.classList.remove('frozen');
        document.getElementById('magBadgeText').textContent = `🔍 目前放大 ${currentZoomScale}x`;
        return;
      }

      if (videoEl && videoEl.videoWidth > 0) {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const ctx = canvasEl.getContext('2d');
        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        isMagnifierFrozen = true;
        videoEl.style.display = 'none';
        canvasEl.style.display = 'block';
        btn.textContent = '▶️ 恢復即時放大鏡';
        btn.classList.add('frozen');
        document.getElementById('magBadgeText').textContent = `❄️ 畫面已定格 (${currentZoomScale}x 放大)`;
      } else {
        toast('鏡頭畫面準備中，請稍候再按定格');
      }
    }

    function toggleHighContrast() {
      isHighContrast = !isHighContrast;
      const btn = document.getElementById('btnHighContrast');
      btn.className = 'btn-contrast' + (isHighContrast ? ' active' : '');
      setMagnifierZoom(currentZoomScale);
    }

    function syncFromMagnifier() {
      const pVal = document.getElementById('magPriceInput').value;
      const qVal = document.getElementById('magQtyInput').value;
      items = items.map(x => {
        if (x.id !== currentMagnifierCardId) return x;
        return {
          ...x,
          price: pVal !== undefined ? String(pVal) : x.price,
          qty: qVal !== undefined ? String(qVal) : x.qty
        };
      });
      render();
    }

    function closeMagnifier() {
      document.getElementById('magnifierModal').style.display = 'none';
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
      }
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
        const hist = history.find(h => it.title.length > 2 && !it.title.startsWith('商品') && h.name.includes(it.title.slice(0, 4)) && h.unit === it.unit);
        let alert = null;
        if (hist) {
          const diff = Math.round(eff - hist.unitPrice * q);
          if (up < hist.unitPrice * 0.995) alert = { cls: 'alert-green', txt: '🌿 破歷史新低價！比上次在' + hist.store.split(' ')[0] + '買便宜 ' + Math.max(1, Math.abs(diff)) + ' 元' };
          else if (up > hist.unitPrice * 1.005) alert = { cls: 'alert-red', txt: '🔸 比上次在' + hist.store.split(' ')[0] + '買的貴 ' + Math.max(1, Math.abs(diff)) + ' 元' };
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
              <button class="btn-magnifier" onclick="openMagnifierFor('${it.id}')">🔍 放大鏡</button>
              ${items.length > 2 ? `<button class="btn-del" onclick="delCard('${it.id}')">✕</button>` : ''}
            </div>
            ${r.alert ? `<div class="alert-box ${r.alert.cls}">${r.alert.txt}</div>` : ''}
            <div class="inputs-grid">
              <div class="input-box ${fp ? 'focused' : ''}" onclick="focusBox('${it.id}','price')">
                <div class="input-lbl">總價格 (元)</div>
                <div class="input-val-row"><span class="input-val ${it.price ? '' : 'empty'}">$${it.price || '0'}</span></div>
                ${it.promo !== 'NONE' && r.valid ? `<div class="sub-discount">折後實付 $${Math.round(r.eff * 10) / 10}</div>` : ''}
              </div>
              <div class="input-box ${fq ? 'focused' : ''}" onclick="focusBox('${it.id}','qty')">
                <div class="input-lbl">總容量 / 數量</div>
                <div class="input-val-row"><span class="input-val ${it.qty ? '' : 'empty'}">${it.qty || '0'}</span><span style="font-size:15px;font-weight:700;color:#5C615E;margin-left:4px;">${it.unit}</span></div>
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
                <div style="font-size:12px;font-weight:700;color:#7A7E7B;">換算單價</div>
                ${r.valid ? `<span class="unit-price-big ${r.win ? 'win' : (r.losePct ? 'lose' : '')}">$${fmt(r.up)} <small style="font-size:13px;">/ ${it.unit}</small></span>${!r.win && r.losePct ? `<span class="badge-lose">貴 ${r.losePct}%</span>` : ''}` : `<span style="font-size:13px;font-weight:600;color:#9CA39E;">請輸入價格與容量</span>`}
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
      items.push({ id: nid, title: '商品 ' + (items.length + 1), price: '', qty: '', unit: items[0].unit, promo: 'NONE' });
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
        { id: 'c1', title: '商品 1', price: '', qty: '', unit: 'g', promo: 'NONE' },
        { id: 'c2', title: '商品 2', price: '', qty: '', unit: 'g', promo: 'NONE' }
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
      const storeWithBranch = currentBranchLabel
        ? `${store.split(' ')[0]}（${currentBranchLabel}）`
        : store;
      const rec = {
        id: 'h' + Date.now(),
        name: it.title,
        store: storeWithBranch,
        baseStore: store,
        price: Math.round(r.eff),
        qty: parseFloat(it.qty),
        unit: it.unit,
        unitPrice: r.up,
        date: today
      };
      history.unshift(rec);
      persistHistory();
      toast('💾 已儲存至底價筆記本：' + rec.name + ' · ' + storeWithBranch);
      render();
    }
    function switchTab(n) {
      document.getElementById('viewCompare').style.display = n === 1 ? 'flex' : 'none';
      document.getElementById('viewHistory').style.display = n === 2 ? 'block' : 'none';
      document.getElementById('tabBtn1').className = 'nav-item ' + (n === 1 ? 'active' : '');
      document.getElementById('tabBtn2').className = 'nav-item ' + (n === 2 ? 'active' : '');
      if (n === 2) renderHistory();
    }

    function deleteSingleHistory(id) {
      history = history.filter(h => h.id !== id);
      persistHistory();
      render();
      renderHistory();
      toast('🗑️ 已刪除該筆底價紀錄');
    }

    function clearAllHistoryRecords() {
      if (history.length === 0) return;
      if (!confirm('確定要一鍵清除全部 ' + history.length + ' 筆底價紀錄嗎？')) return;
      history = [];
      persistHistory();
      render();
      renderHistory();
      toast('🗑️ 已一鍵清除所有底價紀錄');
    }

    function renderHistory() {
      const q = (document.getElementById('searchBox').value || '').toLowerCase();
      const stores = ['ALL', '全聯福利中心', '好市多 Costco', '家樂福 Carrefour', '大潤發 RT-Mart'];
      document.getElementById('storeFilters').innerHTML = stores.map(s => `<button class="pill ${filterStore === s ? 'active-promo' : ''}" onclick="filterStore='${s}';renderHistory()">${s === 'ALL' ? '全部賣場 (' + history.length + ')' : s.split(' ')[0]}</button>`).join('');
      document.getElementById('btnClearAllHistory').disabled = history.length === 0;

      const list = history.filter(h => {
        const matchStore = filterStore === 'ALL' || h.store === filterStore || h.baseStore === filterStore || h.store.includes(filterStore.split(' ')[0]);
        const matchQ = !q || h.name.toLowerCase().includes(q) || h.store.toLowerCase().includes(q);
        return matchStore && matchQ;
      });
      const container = document.getElementById('historyList');
      if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:36px 16px;color:#7A7E7B;font-weight:700;font-size:15.5px;">目前沒有任何底價紀錄</div>`;
        return;
      }

      container.innerHTML = list.map(h => `
        <div class="swipe-wrapper" data-id="${h.id}">
          <div class="swipe-delete-bg" onclick="deleteSingleHistory('${h.id}')">
            <span style="font-size:20px;">🗑️</span>
            <span>刪除</span>
          </div>
          <div class="swipe-card-fg" id="fg-${h.id}">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12.5px;font-weight:800;color:#466A54;">📍 ${h.store} · ${h.date}</div>
              <div style="font-size:17px;font-weight:900;margin:3px 0;color:#2C302E;">${h.name}</div>
              <div style="font-size:14px;font-weight:700;color:#5C615E;">實付 $${h.price} / ${h.qty} ${h.unit}</div>
              <div style="display:inline-block;background:#EDF3EF;border:1.5px solid #5B836B;color:#3F634D;font-size:13.5px;font-weight:800;padding:2px 8px;border-radius:8px;margin-top:4px;">
                歷史底價：$${fmt(h.unitPrice)} / ${h.unit}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
              <button class="btn-cam" style="padding:7px 12px;font-size:13px;" onclick="loadFromHistory('${h.id}')">⚡ 帶入比價</button>
              <span style="font-size:11px;font-weight:700;color:#9CA39E;">⬅ 左滑刪除</span>
            </div>
          </div>
        </div>
      `).join('');

      attachSwipeHandlers();
    }

    function attachSwipeHandlers() {
      const wrappers = document.querySelectorAll('.swipe-wrapper');
      wrappers.forEach(wrap => {
        const id = wrap.getAttribute('data-id');
        const fg = document.getElementById('fg-' + id);
        if (!fg) return;

        let startX = 0;
        let startY = 0;
        let currentDx = 0;
        let dragging = false;

        fg.addEventListener('touchstart', e => {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          currentDx = 0;
          dragging = true;
          fg.style.transition = 'none';
        }, { passive: true });

        fg.addEventListener('touchmove', e => {
          if (!dragging) return;
          const dx = e.touches[0].clientX - startX;
          const dy = e.touches[0].clientY - startY;
          if (Math.abs(dy) > Math.abs(dx)) return;
          if (dx < 0) {
            currentDx = Math.max(dx, -140);
            fg.style.transform = `translateX(${currentDx}px)`;
          } else {
            currentDx = 0;
            fg.style.transform = 'translateX(0px)';
          }
        }, { passive: true });

        fg.addEventListener('touchend', () => {
          if (!dragging) return;
          dragging = false;
          fg.style.transition = 'transform 0.18s ease-out';
          if (currentDx < -125) {
            deleteSingleHistory(id);
          } else if (currentDx < -40) {
            fg.style.transform = 'translateX(-96px)';
          } else {
            fg.style.transform = 'translateX(0px)';
          }
        });
      });
    }

    function loadFromHistory(hid) {
      const h = history.find(x => x.id === hid);
      if (!h) return;
      items.push({ id: 'c' + Date.now(), title: h.name + ' (歷史價)', price: String(h.price), qty: String(h.qty), unit: h.unit, promo: 'NONE' });
      switchTab(1);
      render();
    }
    function toast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(() => el.style.display = 'none', 2800);
    }

    window.onNativeCameraPermissionGranted = async function() {
      const modal = document.getElementById('magnifierModal');
      if (modal && modal.style.display === 'flex') {
        try {
          if (activeStream) {
            activeStream.getTracks().forEach(t => t.stop());
          }
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
          const videoEl = document.getElementById('magVideo');
          videoEl.srcObject = activeStream;
          setMagnifierZoom(currentZoomScale);
        } catch (e) {}
      }
    };

    render();
    setTimeout(() => {
      if (window.AndroidBridge && window.AndroidBridge.requestNativeGpsIfPermitted) {
        window.AndroidBridge.requestNativeGpsIfPermitted();
      }
    }, 500);
  </script>
</body>
</html>
EOF

# 4. 建立原生 Android MainActivity.java：整合 LocationManager + Android Geocoder 逆地理編碼（直接解析台灣縣市區與路名回傳給前端顯示分店名）
cat << 'EOF' > "${WORK_DIR}/src/com/smartgrocery/unitpricecomparator/MainActivity.java"
package com.smartgrocery.unitpricecomparator;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQ_CAMERA_PERMISSION = 1002;
    private static final int REQ_GPS_PERMISSION = 1003;

    private WebView webView;
    private SQLiteDatabase sqliteDb;
    private LocationManager locationManager;
    private boolean isRequestingPermission = false;
    private PermissionRequest pendingWebPermissionRequest = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                try {
                                    request.grant(request.getResources());
                                } catch (Exception ignored) {
                                }
                            } else {
                                pendingWebPermissionRequest = request;
                                if (!isRequestingPermission) {
                                    isRequestingPermission = true;
                                    requestPermissions(
                                        new String[]{Manifest.permission.CAMERA},
                                        REQ_CAMERA_PERMISSION
                                    );
                                }
                            }
                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            try {
                                request.grant(request.getResources());
                            } catch (Exception ignored) {
                            }
                        }
                    }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        setContentView(webView);
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

    private boolean hasLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
               checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    public class AndroidHardwareBridge {
        @JavascriptInterface
        public void requestNativeGps() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startRealNativeGpsLookup(true);
                }
            });
        }

        @JavascriptInterface
        public void requestNativeGpsIfPermitted() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (hasLocationPermission()) {
                        startRealNativeGpsLookup(false);
                    }
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

    private String resolveAreaNameFromGeocoder(double lat, double lon) {
        try {
            Geocoder geocoder = new Geocoder(this, Locale.TRADITIONAL_CHINESE);
            List<Address> list = geocoder.getFromLocation(lat, lon, 1);
            if (list != null && !list.isEmpty()) {
                Address a = list.get(0);
                StringBuilder sb = new StringBuilder();
                if (a.getLocality() != null) {
                    sb.append(a.getLocality());
                } else if (a.getSubAdminArea() != null) {
                    sb.append(a.getSubAdminArea());
                } else if (a.getAdminArea() != null) {
                    sb.append(a.getAdminArea());
                }
                if (a.getThoroughfare() != null) {
                    sb.append(a.getThoroughfare());
                }
                return sb.toString().replace("'", "");
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private void startRealNativeGpsLookup(boolean promptIfMissing) {
        try {
            if (!hasLocationPermission()) {
                if (promptIfMissing && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !isRequestingPermission) {
                    isRequestingPermission = true;
                    requestPermissions(
                        new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        },
                        REQ_GPS_PERMISSION
                    );
                }
                return;
            }

            if (locationManager == null) {
                sendGpsErrorToJs("無法存取定位服務");
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
                sendGpsCoordsToJs(bestLast.getLatitude(), bestLast.getLongitude());
            }

            final LocationListener onceListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location loc) {
                    if (loc != null) {
                        sendGpsCoordsToJs(loc.getLatitude(), loc.getLongitude());
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
                sendGpsErrorToJs("請在手機開啟「位置 / GPS」功能");
            }
        } catch (SecurityException se) {
            sendGpsErrorToJs("未授予 GPS 定位權限");
        } catch (Exception e) {
            sendGpsErrorToJs(e.getMessage());
        }
    }

    private void sendGpsCoordsToJs(final double lat, final double lon) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                final String areaName = resolveAreaNameFromGeocoder(lat, lon);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (webView != null) {
                            String js = "window.onRealGpsLocationReceived(" + lat + ", " + lon + ", '" + areaName + "');";
                            webView.evaluateJavascript(js, null);
                        }
                    }
                });
            }
        }).start();
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

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        isRequestingPermission = false;

        if (requestCode == REQ_GPS_PERMISSION) {
            if (hasLocationPermission()) {
                startRealNativeGpsLookup(false);
            } else {
                sendGpsErrorToJs("未允許定位權限，可手動從下拉選單切換賣場");
            }
        } else if (requestCode == REQ_CAMERA_PERMISSION) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                if (pendingWebPermissionRequest != null) {
                    try {
                        pendingWebPermissionRequest.grant(pendingWebPermissionRequest.getResources());
                    } catch (Exception ignored) {
                    }
                    pendingWebPermissionRequest = null;
                }
                if (webView != null) {
                    webView.evaluateJavascript("if(window.onNativeCameraPermissionGranted)window.onNativeCameraPermissionGranted();", null);
                }
            } else {
                if (pendingWebPermissionRequest != null) {
                    try {
                        pendingWebPermissionRequest.deny();
                    } catch (Exception ignored) {
                    }
                    pendingWebPermissionRequest = null;
                }
            }
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
if [ -d "${ARTIFACT_DIR}" ]; then
  cp "${FINAL_APK_REPO}" "${FINAL_APK_ARTIFACT}"
fi

ls -lh "${FINAL_APK_REPO}" "${FINAL_APK_ROOT}"
