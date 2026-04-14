import { config } from "../config.js";
import logger from "../utils/logger.js";
import type { PushFormat } from "./formatter.js";

type Channel = {
  name: string;
  format: PushFormat;
  maxBytes: number;
  send: (content: string) => Promise<boolean>;
};

const splitAccounts = (value: string): string[] =>
  value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

const postJson = async (url: string, payload: unknown): Promise<unknown> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return data;
};

const sendFeishu = async (webhookUrl: string, content: string): Promise<boolean> => {
  const payload = webhookUrl.includes("www.feishu.cn")
    ? { msg_type: "text", content: { text: content } }
    : {
        msg_type: "interactive",
        card: {
          schema: "2.0",
          body: { elements: [{ tag: "markdown", content }] },
        },
      };

  const result = await postJson(webhookUrl, payload) as { StatusCode?: number; code?: number; msg?: string; StatusMessage?: string };
  if (result.StatusCode === 0 || result.code === 0) return true;
  throw new Error(result.msg || result.StatusMessage || "Feishu webhook returned non-zero status");
};

const sendWeWork = async (webhookUrl: string, content: string): Promise<boolean> => {
  const isText = config.WEWORK_MSG_TYPE.toLowerCase() === "text";
  const plainText = content
    .replace(/\*\*/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 $2");
  const payload = isText
    ? { msgtype: "text", text: { content: plainText } }
    : { msgtype: "markdown", markdown: { content } };

  const result = await postJson(webhookUrl, payload) as { errcode?: number; errmsg?: string };
  if (result.errcode === 0) return true;
  throw new Error(result.errmsg || "WeWork webhook returned non-zero status");
};

const sendTelegram = async (botToken: string, chatId: string, content: string): Promise<boolean> => {
  const result = await postJson(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text: content,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }) as { ok?: boolean; description?: string };
  if (result.ok) return true;
  throw new Error(result.description || "Telegram API returned non-ok status");
};

const createChannels = (): Channel[] => {
  const channels: Channel[] = [];

  splitAccounts(config.FEISHU_WEBHOOK_URL).forEach((webhookUrl, index) => {
    channels.push({
      name: `飞书${index + 1}`,
      format: "feishu",
      maxBytes: 29000,
      send: (content) => sendFeishu(webhookUrl, content),
    });
  });

  splitAccounts(config.WEWORK_WEBHOOK_URL).forEach((webhookUrl, index) => {
    channels.push({
      name: `企业微信${index + 1}`,
      format: "wework",
      maxBytes: 3900,
      send: (content) => sendWeWork(webhookUrl, content),
    });
  });

  const botTokens = splitAccounts(config.TELEGRAM_BOT_TOKEN);
  const chatIds = splitAccounts(config.TELEGRAM_CHAT_ID);
  const telegramCount = Math.min(botTokens.length, chatIds.length);
  for (let index = 0; index < telegramCount; index += 1) {
    channels.push({
      name: `Telegram${index + 1}`,
      format: "telegram",
      maxBytes: 3900,
      send: (content) => sendTelegram(botTokens[index], chatIds[index], content),
    });
  }

  return channels;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendBatches = async (
  buildBatches: (format: PushFormat, maxBytes: number) => string[],
): Promise<void> => {
  const channels = createChannels();
  if (channels.length === 0) {
    logger.warn("📣 [Push] no notification channel configured; skip sending.");
    return;
  }

  for (const channel of channels) {
    const batches = buildBatches(channel.format, channel.maxBytes);
    logger.info(`📣 [Push] ${channel.name} message split into ${batches.length} batches`);

    for (let index = 0; index < batches.length; index += 1) {
      try {
        await channel.send(batches[index]);
        logger.info(`📣 [Push] ${channel.name} batch ${index + 1}/${batches.length} sent`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`📣 [Push] ${channel.name} batch ${index + 1}/${batches.length} failed: ${message}`);
        break;
      }

      if (index < batches.length - 1) {
        await sleep(config.PUSH_BATCH_INTERVAL);
      }
    }
  }
};
