import type { ListItem } from "../types.js";
import type { SourceResult } from "./collector.js";

export type PushFormat = "feishu" | "wework" | "telegram";

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeText = (value: unknown): string => String(value ?? "").replace(/\s+/g, " ").trim();

const formatDate = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
};

const groupEmoji = (count: number): string => {
  if (count >= 30) return "🔥";
  if (count >= 10) return "📈";
  return "📌";
};

const formatLink = (text: string, url: string | undefined, format: PushFormat): string => {
  if (!url) return format === "telegram" ? escapeHtml(text) : text;
  if (format === "telegram") return `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;
  return `[${text}](${url})`;
};

const formatItemLine = (
  item: ListItem,
  index: number,
  sourceTitle: string,
  format: PushFormat,
): string => {
  const title = normalizeText(item.title) || "未命名热点";
  const desc = normalizeText(item.desc);
  const url = item.mobileUrl || item.url;
  const hot = item.hot === undefined || item.hot === null ? "" : ` · 热度 ${item.hot}`;
  const time = item.timestamp ? ` - ${item.timestamp}` : "";
  const suffix = `${hot}${time}`;
  const source = format === "telegram" ? escapeHtml(sourceTitle) : sourceTitle;
  const linkedTitle = formatLink(title, url, format);

  if (format === "telegram") {
    const descText = desc ? `\n   <i>${escapeHtml(desc.slice(0, 120))}</i>` : "";
    return `  ${index}. 📰 [${source}] ${linkedTitle}${escapeHtml(suffix)}${descText}`;
  }

  const descText = desc ? `\n   > ${desc.slice(0, 120)}` : "";
  return `  ${index}. 📰 [${sourceTitle}] ${linkedTitle}${suffix}${descText}`;
};

export const buildTrendRadarStyleBatches = (
  sources: SourceResult[],
  format: PushFormat,
  options: {
    reportType: string;
    timeZone: string;
    itemsPerSource: number;
    maxBytes: number;
  },
): string[] => {
  const nowText = formatDate(new Date(), options.timeZone);
  const successfulSources = sources.filter((source) => !source.error && source.data.length > 0);
  const failedSources = sources.filter((source) => source.error);
  const totalItems = successfulSources.reduce((sum, source) => sum + source.data.length, 0);
  const visibleItems = successfulSources.reduce(
    (sum, source) => sum + source.data.slice(0, options.itemsPerSource).length,
    0,
  );

  const bold = (text: string) => {
    if (format === "telegram") return `<b>${escapeHtml(text)}</b>`;
    return `**${text}**`;
  };

  const baseHeader = [
    `${bold("🧮 总新闻数：")} ${totalItems}`,
    `${bold("📚 数据源数：")} ${successfulSources.length}/${sources.length}`,
    `${bold("🕒 时间：")} ${nowText}`,
    `${bold("📌 类型：")} ${options.reportType}`,
    "",
    format === "feishu" ? "---" : "",
    "",
    format === "telegram"
      ? `<b>📊 热点新闻统计</b> (展示 ${visibleItems} 条，完整抓取 ${totalItems} 条)`
      : `📊 **热点新闻统计** (展示 ${visibleItems} 条，完整抓取 ${totalItems} 条)`,
    "",
  ]
    .filter((line, index, array) => line || array[index - 1])
    .join("\n");

  const footerLines = [
    "",
    format === "telegram" ? `🕒 更新时间：${escapeHtml(nowText)}` : `> 🕒 更新时间：${nowText}`,
  ];

  if (failedSources.length > 0) {
    footerLines.unshift(
      "",
      format === "telegram"
        ? `<b>⚠️ 数据获取失败的平台：</b> ${escapeHtml(failedSources.map((s) => s.title).join("、"))}`
        : `⚠️ **数据获取失败的平台：** ${failedSources.map((s) => s.title).join("、")}`,
    );
  }

  const footer = footerLines.join("\n");
  const batches: string[] = [];
  let current = baseHeader;

  const pushCurrent = () => {
    const content = `${current.trimEnd()}${footer}`;
    if (content.trim()) batches.push(content);
    current = baseHeader;
  };

  successfulSources.forEach((source, sourceIndex) => {
    const sourceItems = source.data.slice(0, options.itemsPerSource);
    const sourceTitle = `${source.title}${source.type ? ` · ${source.type}` : ""}`;
    const header =
      format === "telegram"
        ? `\n${groupEmoji(source.data.length)} <b>[${sourceIndex + 1}/${successfulSources.length}] ${escapeHtml(sourceTitle)}</b> : ${source.data.length} 条\n`
        : `\n${groupEmoji(source.data.length)} **[${sourceIndex + 1}/${successfulSources.length}] ${sourceTitle}** : **${source.data.length}** 条\n`;

    const lines = sourceItems.map((item, index) =>
      formatItemLine(item, index + 1, source.title, format),
    );
    const block = `${header}\n${lines.join("\n")}\n`;

    if (byteLength(current + block + footer) > options.maxBytes && current !== baseHeader) {
      pushCurrent();
    }

    if (byteLength(baseHeader + block + footer) > options.maxBytes) {
      const smallerBlocks = lines.map((line) => `${header}\n${line}\n`);
      smallerBlocks.forEach((smallBlock) => {
        if (byteLength(current + smallBlock + footer) > options.maxBytes && current !== baseHeader) {
          pushCurrent();
        }
        current += smallBlock;
      });
      return;
    }

    current += block;
  });

  if (current !== baseHeader || batches.length === 0) pushCurrent();
  return batches;
};
