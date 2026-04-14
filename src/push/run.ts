import { runDailyHotPush } from "./scheduler.js";

try {
  await runDailyHotPush("manual/action");
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
