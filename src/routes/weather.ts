import type { ListContext, RouterData } from "../types.js";
import { get, type RequestResult } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";

const DEFAULT_LATITUDE = 24.872281;
const DEFAULT_LONGITUDE = 102.581883;
const DEFAULT_LOCATION_NAME = "云南省昆明市安宁市金方街道恒大金碧天下二期";
const DEFAULT_TIMEZONE = "auto";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const WEATHER_CODE_MAP: Record<number, string> = {
  0: "晴朗",
  1: "大致晴",
  2: "局部多云",
  3: "多云",
  45: "雾",
  48: "冻雾",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "强毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "冰粒",
  80: "阵雨",
  81: "较强阵雨",
  82: "强阵雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷暴",
  96: "雷暴伴轻冰雹",
  99: "强雷暴伴冰雹",
};

const AQI_LEVELS: Array<[number, number, string]> = [
  [0, 50, "优"],
  [51, 100, "良"],
  [101, 150, "轻度污染"],
  [151, 200, "中度污染"],
  [201, 300, "重度污染"],
  [301, 9999, "严重污染"],
];

type WeatherOptions = {
  latitude: number;
  longitude: number;
  location: string;
  timezone: string;
};

type WeatherCurrent = {
  time?: string;
  temperature_2m?: number;
  apparent_temperature?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  cloud_cover?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  wind_gusts_10m?: number;
  wind_direction_10m?: number;
  pressure_msl?: number;
};

type WeatherDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  apparent_temperature_max?: number[];
  apparent_temperature_min?: number[];
  precipitation_probability_max?: number[];
  precipitation_sum?: number[];
  wind_speed_10m_max?: number[];
  wind_gusts_10m_max?: number[];
  wind_direction_10m_dominant?: number[];
  uv_index_max?: number[];
  sunrise?: string[];
  sunset?: string[];
};

type ForecastResponse = {
  current?: WeatherCurrent;
  daily?: WeatherDaily;
};

type AirCurrent = {
  time?: string;
  european_aqi?: number;
  pm2_5?: number;
  pm10?: number;
  nitrogen_dioxide?: number;
  sulphur_dioxide?: number;
  ozone?: number;
  carbon_monoxide?: number;
  uv_index?: number;
};

type AirResponse = {
  current?: AirCurrent;
};

const weatherText = (code: unknown): string => {
  const numericCode = Number(code);
  return Number.isFinite(numericCode) ? WEATHER_CODE_MAP[numericCode] || `未知天气(${code})` : `未知天气(${code})`;
};

const windDirText = (deg: unknown): string => {
  const numericDeg = Number(deg);
  if (!Number.isFinite(numericDeg)) return "未知风向";
  const dirs = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"];
  return dirs[Math.floor(((numericDeg % 360) + 22.5) / 45) % 8];
};

const describeAqi = (aqi?: number): string => {
  if (aqi === undefined) return "未知";
  const level = AQI_LEVELS.find(([lo, hi]) => lo <= aqi && aqi <= hi);
  return level?.[2] || "未知";
};

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildUrl = (baseUrl: string, params: Record<string, string | number>): string =>
  `${baseUrl}?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`;

const buildForecastUrl = (options: WeatherOptions): string =>
  buildUrl(OPEN_METEO_FORECAST_URL, {
    latitude: options.latitude,
    longitude: options.longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,pressure_msl,cloud_cover,weather_code,wind_gusts_10m,wind_direction_10m,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset",
    timezone: options.timezone,
  });

const buildAirUrl = (options: WeatherOptions): string =>
  buildUrl(OPEN_METEO_AIR_URL, {
    latitude: options.latitude,
    longitude: options.longitude,
    current:
      "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,uv_index,european_aqi",
    timezone: options.timezone,
  });

const getOptions = (c: ListContext): WeatherOptions => ({
  latitude: toNumber(c.req.query("latitude"), DEFAULT_LATITUDE),
  longitude: toNumber(c.req.query("longitude"), DEFAULT_LONGITUDE),
  location: c.req.query("location") || DEFAULT_LOCATION_NAME,
  timezone: c.req.query("timezone") || DEFAULT_TIMEZONE,
});

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  const options = getOptions(c);
  const listData = await getList(options, noCache);
  const routeData: RouterData = {
    name: "weather",
    title: "Open-Meteo",
    type: `${options.location}天气预报`,
    description: "OpenClaw 9:00 定时任务同源天气查询 API，包含当前天气、空气质量和未来 3 天预报",
    params: {
      latitude: { name: "纬度", value: DEFAULT_LATITUDE },
      longitude: { name: "经度", value: DEFAULT_LONGITUDE },
      location: { name: "位置名称", value: DEFAULT_LOCATION_NAME },
      timezone: { name: "时区", value: DEFAULT_TIMEZONE },
    },
    link: OPEN_METEO_FORECAST_URL,
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

const currentDesc = (current: WeatherCurrent, air?: AirCurrent): string =>
  [
    `时间：${current.time || "N/A"}`,
    `体感温度：${current.apparent_temperature ?? "N/A"}°C`,
    `天气状况：${weatherText(current.weather_code)}`,
    `相对湿度：${current.relative_humidity_2m ?? "N/A"}%`,
    `当前降水：${current.precipitation ?? "N/A"} mm`,
    `云量：${current.cloud_cover ?? "N/A"}%`,
    `风速：${current.wind_speed_10m ?? "N/A"} km/h`,
    `阵风：${current.wind_gusts_10m ?? "N/A"} km/h`,
    `风向：${windDirText(current.wind_direction_10m)} (${current.wind_direction_10m ?? "N/A"}°)`,
    `海平面气压：${current.pressure_msl ?? "N/A"} hPa`,
    `AQI(EU)：${air?.european_aqi ?? "N/A"} (${describeAqi(air?.european_aqi)})`,
    `PM2.5：${air?.pm2_5 ?? "N/A"} μg/m³`,
    `PM10：${air?.pm10 ?? "N/A"} μg/m³`,
    `紫外线：${air?.uv_index ?? "N/A"}`,
  ].join("\n");

const dailyDesc = (daily: WeatherDaily, index: number): string =>
  [
    `日天气：${weatherText(daily.weather_code?.[index])}`,
    `最高 / 最低温：${daily.temperature_2m_max?.[index] ?? "N/A"} / ${daily.temperature_2m_min?.[index] ?? "N/A"}°C`,
    `体感最高 / 最低：${daily.apparent_temperature_max?.[index] ?? "N/A"} / ${daily.apparent_temperature_min?.[index] ?? "N/A"}°C`,
    `最大降水概率：${daily.precipitation_probability_max?.[index] ?? "N/A"}%`,
    `总降水量：${daily.precipitation_sum?.[index] ?? "N/A"} mm`,
    `最大风速：${daily.wind_speed_10m_max?.[index] ?? "N/A"} km/h`,
    `最大阵风：${daily.wind_gusts_10m_max?.[index] ?? "N/A"} km/h`,
    `主导风向：${windDirText(daily.wind_direction_10m_dominant?.[index])} (${daily.wind_direction_10m_dominant?.[index] ?? "N/A"}°)`,
    `日出 / 日落：${daily.sunrise?.[index] ?? "N/A"} / ${daily.sunset?.[index] ?? "N/A"}`,
    `紫外线最大：${daily.uv_index_max?.[index] ?? "N/A"}`,
  ].join("\n");

const getList = async (options: WeatherOptions, noCache: boolean) => {
  const [forecastResult, airResult] = await Promise.all([
    get<ForecastResponse>({ url: buildForecastUrl(options), noCache, timeout: 30000 }),
    get<AirResponse>({ url: buildAirUrl(options), noCache, timeout: 30000 }),
  ]);

  const current = forecastResult.data.current || {};
  const daily = forecastResult.data.daily || {};
  const airCurrent = airResult.data.current;
  const updateTime = newestUpdateTime(forecastResult, airResult);
  const currentTime = current.time ? getTime(current.time) : undefined;

  const data = [
    {
      id: "current",
      title: `${options.location} 当前 ${current.temperature_2m ?? "N/A"}°C ${weatherText(current.weather_code)}`,
      desc: currentDesc(current, airCurrent),
      hot: airCurrent?.european_aqi,
      timestamp: currentTime,
      url: OPEN_METEO_FORECAST_URL,
      mobileUrl: OPEN_METEO_FORECAST_URL,
    },
    ...(daily.time || []).slice(0, 3).map((day, index) => ({
      id: `daily-${day}`,
      title: `${day} ${weatherText(daily.weather_code?.[index])} ${daily.temperature_2m_min?.[index] ?? "N/A"}-${daily.temperature_2m_max?.[index] ?? "N/A"}°C`,
      desc: dailyDesc(daily, index),
      hot: daily.precipitation_probability_max?.[index],
      timestamp: getTime(day),
      url: OPEN_METEO_FORECAST_URL,
      mobileUrl: OPEN_METEO_FORECAST_URL,
    })),
  ];

  return {
    updateTime,
    fromCache: forecastResult.fromCache && airResult.fromCache,
    data,
  };
};

const newestUpdateTime = (...results: Array<RequestResult<unknown>>): string =>
  results
    .map((result) => result.updateTime)
    .sort()
    .at(-1) || new Date().toISOString();
