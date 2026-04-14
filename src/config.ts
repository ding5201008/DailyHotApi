import dotenv from "dotenv";

// 环境变量
dotenv.config();

export type Config = {
  PORT: number;
  DISALLOW_ROBOT: boolean;
  CACHE_TTL: number;
  REQUEST_TIMEOUT: number;
  ALLOWED_DOMAIN: string;
  ALLOWED_HOST: string;
  USE_LOG_FILE: boolean;
  RSS_MODE: boolean;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  REDIS_DB: number;
  ZHIHU_COOKIE: string;
  FILTER_WEIBO_ADVERTISEMENT: boolean;
  PUSH_ENABLED: boolean;
  PUSH_TIMEZONE: string;
  PUSH_SCHEDULE_TIMES: string;
  PUSH_ITEMS_PER_SOURCE: number;
  PUSH_CONCURRENCY: number;
  PUSH_NO_CACHE: boolean;
  PUSH_BATCH_INTERVAL: number;
  FEISHU_WEBHOOK_URL: string;
  WEWORK_WEBHOOK_URL: string;
  WEWORK_MSG_TYPE: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
};

// 验证并提取环境变量
const getEnvVariable = (key: string): string | undefined => {
  const value = process.env[key];
  if (value === undefined) return undefined;
  return value;
};

// 将环境变量转换为数值
const getNumericEnvVariable = (key: string, defaultValue: number): number => {
  const value = getEnvVariable(key) ?? String(defaultValue);
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) return defaultValue;
  return parsedValue;
};

// 将环境变量转换为布尔值
const getBooleanEnvVariable = (key: string, defaultValue: boolean): boolean => {
  const value = getEnvVariable(key) ?? String(defaultValue);
  return value.toLowerCase() === "true";
};

// 创建配置对象
export const config: Config = {
  PORT: getNumericEnvVariable("PORT", 6688),
  DISALLOW_ROBOT: getBooleanEnvVariable("DISALLOW_ROBOT", true),
  CACHE_TTL: getNumericEnvVariable("CACHE_TTL", 3600),
  REQUEST_TIMEOUT: getNumericEnvVariable("REQUEST_TIMEOUT", 6000),
  ALLOWED_DOMAIN: getEnvVariable("ALLOWED_DOMAIN") || "*",
  ALLOWED_HOST: getEnvVariable("ALLOWED_HOST") || "imsyy.top",
  USE_LOG_FILE: getBooleanEnvVariable("USE_LOG_FILE", true),
  RSS_MODE: getBooleanEnvVariable("RSS_MODE", false),
  REDIS_HOST: getEnvVariable("REDIS_HOST") || "127.0.0.1",
  REDIS_PORT: getNumericEnvVariable("REDIS_PORT", 6379),
  REDIS_PASSWORD: getEnvVariable("REDIS_PASSWORD") || "",
  REDIS_DB:  getNumericEnvVariable("REDIS_DB", 0),
  ZHIHU_COOKIE: getEnvVariable("ZHIHU_COOKIE") || "",
  FILTER_WEIBO_ADVERTISEMENT: getBooleanEnvVariable("FILTER_WEIBO_ADVERTISEMENT", false),
  PUSH_ENABLED: getBooleanEnvVariable("PUSH_ENABLED", true),
  PUSH_TIMEZONE: getEnvVariable("PUSH_TIMEZONE") || "Asia/Shanghai",
  PUSH_SCHEDULE_TIMES: getEnvVariable("PUSH_SCHEDULE_TIMES") || "09:00,23:00",
  PUSH_ITEMS_PER_SOURCE: getNumericEnvVariable("PUSH_ITEMS_PER_SOURCE", 10),
  PUSH_CONCURRENCY: getNumericEnvVariable("PUSH_CONCURRENCY", 3),
  PUSH_NO_CACHE: getBooleanEnvVariable("PUSH_NO_CACHE", true),
  PUSH_BATCH_INTERVAL: getNumericEnvVariable("PUSH_BATCH_INTERVAL", 1000),
  FEISHU_WEBHOOK_URL: getEnvVariable("FEISHU_WEBHOOK_URL") || "",
  WEWORK_WEBHOOK_URL: getEnvVariable("WEWORK_WEBHOOK_URL") || "",
  WEWORK_MSG_TYPE: getEnvVariable("WEWORK_MSG_TYPE") || "markdown",
  TELEGRAM_BOT_TOKEN: getEnvVariable("TELEGRAM_BOT_TOKEN") || "",
  TELEGRAM_CHAT_ID: getEnvVariable("TELEGRAM_CHAT_ID") || "",
};
