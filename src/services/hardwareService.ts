/**
 * 賣場極簡比價王 - 真實手機硬體串接服務 (Real GPS Location + Camera Magnifier Support)
 *
 * 1. 相機高倍率放大鏡 (`CameraMagnifierModal`):
 *    - 專為長輩與家庭主婦設計：透過手機真實後置鏡頭提供 1x / 2x / 3x / 5x 數位放大、手電筒補光、高對比與畫面凍結（定格），
 *      方便看清楚賣場貨架價格牌上的微小容量（g / ml / 抽）與標價數字。
 * 2. 真實 GPS 定位與賣場自動判別 (`detectCurrentStoreWithRealGps`):
 *    - 透過 `expo-location` 取得手機真實經緯度，並結合離線 Haversine 距離演算法
 *      自動判斷當前所在的大賣場（全聯、好市多、家樂福、大潤發、愛買）。
 */

import * as Location from 'expo-location';
import { StoreName } from '../types/grocery';

export interface RealGpsLocationResult {
  storeName: StoreName;
  districtLabel: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  accuracyMeters: number | null;
  isLiveHardwareGps: boolean;
}

/**
 * 台灣主要實體大賣場真實經緯度座標庫（支援無網路地下室/離線 Haversine 最近賣場匹配）
 */
export interface StoreGeoFence {
  storeName: StoreName;
  latitude: number;
  longitude: number;
  districtLabel: string;
}

export const KNOWN_STORE_GEOFENCES: StoreGeoFence[] = [
  {
    storeName: '全聯福利中心',
    latitude: 25.033964,
    longitude: 121.543378,
    districtLabel: '台北大安延吉店',
  },
  {
    storeName: '全聯福利中心',
    latitude: 25.0132,
    longitude: 121.4637,
    districtLabel: '板橋文化店',
  },
  {
    storeName: '全聯福利中心',
    latitude: 24.1618,
    longitude: 120.6469,
    districtLabel: '台中市政店',
  },
  {
    storeName: '全聯福利中心',
    latitude: 22.6651,
    longitude: 120.3032,
    districtLabel: '高雄巨蛋店',
  },
  {
    storeName: '好市多 Costco',
    latitude: 25.065321,
    longitude: 121.575412,
    districtLabel: '內湖賣場',
  },
  {
    storeName: '好市多 Costco',
    latitude: 25.0018,
    longitude: 121.4912,
    districtLabel: '中和賣場',
  },
  {
    storeName: '好市多 Costco',
    latitude: 24.1329,
    longitude: 120.6488,
    districtLabel: '台中南屯賣場',
  },
  {
    storeName: '好市多 Costco',
    latitude: 22.6562,
    longitude: 120.3059,
    districtLabel: '高雄大順賣場',
  },
  {
    storeName: '家樂福 Carrefour',
    latitude: 25.0382,
    longitude: 121.5063,
    districtLabel: '桂林量販店',
  },
  {
    storeName: '家樂福 Carrefour',
    latitude: 25.0681,
    longitude: 121.5794,
    districtLabel: '內湖量販店',
  },
  {
    storeName: '家樂福 Carrefour',
    latitude: 24.1632,
    longitude: 120.6381,
    districtLabel: '青海量販店',
  },
  {
    storeName: '家樂福 Carrefour',
    latitude: 22.6551,
    longitude: 120.3204,
    districtLabel: '鼎山量販店',
  },
  {
    storeName: '大潤發 RT-Mart',
    latitude: 25.04819,
    longitude: 121.54461,
    districtLabel: '中崙店',
  },
  {
    storeName: '大潤發 RT-Mart',
    latitude: 25.0645,
    longitude: 121.5739,
    districtLabel: '內湖店',
  },
  {
    storeName: '愛買 a.mart',
    latitude: 25.08312,
    longitude: 121.55611,
    districtLabel: '大直店',
  },
  {
    storeName: '愛買 a.mart',
    latitude: 24.9968,
    longitude: 121.4581,
    districtLabel: '板橋南雅店',
  },
];

/**
 * 計算兩個經緯度座標之間的真實球面距離（公尺）- Haversine 公式
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // 地球半徑（公尺）
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * 根據真實 GPS 經緯度座標找出距離最近的實體賣場
 */
export function findNearestStoreByCoordinates(
  latitude: number,
  longitude: number
): { store: StoreGeoFence; distanceMeters: number } {
  let nearest = KNOWN_STORE_GEOFENCES[0];
  let minDistance = Infinity;

  for (const fence of KNOWN_STORE_GEOFENCES) {
    const dist = calculateHaversineDistanceMeters(
      latitude,
      longitude,
      fence.latitude,
      fence.longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
      nearest = fence;
    }
  }

  return { store: nearest, distanceMeters: minDistance };
}

/**
 * 真實手機 GPS 定位服務：請求原生定位權限、讀取真實經緯度並判斷當前所在賣場
 */
export const LocationStoreService = {
  /**
   * 讀取手機真實 GPS 經緯度並自動判斷距離最近的大賣場
   */
  async detectCurrentStoreWithRealGps(): Promise<RealGpsLocationResult> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('未授予 GPS 定位權限，請在手機設定中允許定位權限');
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude, accuracy } = position.coords;
    const { store, distanceMeters } = findNearestStoreByCoordinates(
      latitude,
      longitude
    );

    let districtLabel = store.districtLabel;
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (places && places.length > 0) {
        const p = places[0];
        const area = [p.city || p.region, p.district, p.street]
          .filter(Boolean)
          .join('');
        if (area) {
          districtLabel = `${area} (${store.districtLabel})`;
        }
      }
    } catch {
      // 完全離線環境下使用內建離線座標圍欄名稱
    }

    return {
      storeName: store.storeName,
      districtLabel,
      latitude,
      longitude,
      distanceMeters,
      accuracyMeters: accuracy ? Math.round(accuracy) : null,
      isLiveHardwareGps: true,
    };
  },
};
