import { config } from "../config.js";
import logger from "../utils/logger.js";
import { collectAllSources } from "./collector.js";
import { buildTrendRadarStyleBatches } from "./formatter.js";
import { sendBatches } from "./notifier.js";

let schedulerStarted = false;
let running = false;
let lastRunKey = "";

const formatDateParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};

const scheduleTimes = (): string[] =>
  config.PUSH_SCHEDULE_TIMES.split(",")
    .map((item) => item.trim())
    .filter((item) => /^\d{2}:\d{2}$/.test(item));

export const runDailyHotPush = async (trigger: string): Promise<void> => {
  if (running) {
    logger.warn(`📣 [Push] previous job is still running; skip ${trigger}`);
    return;
  }

  running = true;
  try {
    logger.info(`📣 [Push] start collecting all DailyHot sources (${trigger})`);
    const sources = await collectAllSources();
    logger.info(`📣 [Push] collected ${sources.length} sources`);

    await sendBatches((format, maxBytes) =>
      buildTrendRadarStyleBatches(sources, format, {
        reportType: "DailyHot 热点分析报告",
        timeZone: config.PUSH_TIMEZONE,
        itemsPerSource: Math.max(1, config.PUSH_ITEMS_PER_SOURCE),
        maxBytes,
      }),
    );

    logger.info(`📣 [Push] finished (${trigger})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`📣 [Push] failed (${trigger}): ${message}`);
  } finally {
    running = false;
  }
};

export const startPushScheduler = (): void => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (!config.PUSH_ENABLED) {
    logger.info("📣 [Push] scheduler disabled by PUSH_ENABLED=false");
    return;
  }

  const times = scheduleTimes();
  if (times.length === 0) {
    logger.warn("📣 [Push] no valid PUSH_SCHEDULE_TIMES configured; scheduler disabled");
    return;
  }

  logger.info(`📣 [Push] scheduler enabled: ${times.join(", ")} (${config.PUSH_TIMEZONE})`);

  setInterval(() => {
    const now = formatDateParts(new Date(), config.PUSH_TIMEZONE);
    if (!times.includes(now.time)) return;

    const runKey = `${now.date} ${now.time}`;
    if (runKey === lastRunKey) return;

    lastRunKey = runKey;
    void runDailyHotPush(`schedule ${runKey} ${config.PUSH_TIMEZONE}`);
  }, 30 * 1000);
};
