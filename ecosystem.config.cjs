module.exports = {
  apps: [{
    name: 'daily-news',
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 6688,
      PUSH_ENABLED: process.env.PUSH_ENABLED || 'true',
      PUSH_TIMEZONE: process.env.PUSH_TIMEZONE || 'Asia/Shanghai',
      PUSH_SCHEDULE_TIMES: process.env.PUSH_SCHEDULE_TIMES || '09:00,23:00',
      PUSH_ITEMS_PER_SOURCE: process.env.PUSH_ITEMS_PER_SOURCE || '10',
      PUSH_CONCURRENCY: process.env.PUSH_CONCURRENCY || '3',
      PUSH_SOURCE_TIMEOUT: process.env.PUSH_SOURCE_TIMEOUT || '20000',
      PUSH_NO_CACHE: process.env.PUSH_NO_CACHE || 'true',
      PUSH_BATCH_INTERVAL: process.env.PUSH_BATCH_INTERVAL || '1000',
      FEISHU_WEBHOOK_URL: process.env.FEISHU_WEBHOOK_URL || '',
      WEWORK_WEBHOOK_URL: process.env.WEWORK_WEBHOOK_URL || '',
      WEWORK_MSG_TYPE: process.env.WEWORK_MSG_TYPE || 'markdown',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || ''
    }
  }]
}
