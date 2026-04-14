import { fileURLToPath, pathToFileURL } from "url";
import fs from "fs";
import path from "path";
import type { ListContext, ListItem, RouterData } from "../types.js";
import { config } from "../config.js";
import logger from "../utils/logger.js";

export type SourceResult = {
  name: string;
  title: string;
  type: string;
  link?: string;
  total: number;
  data: ListItem[];
  error?: string;
};

type RouteModule = {
  handleRoute?: (c: ListContext, noCache: boolean) => Promise<RouterData>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, "../routes");

const mockContext = {
  req: {
    query: () => undefined,
  },
} as unknown as ListContext;

const getRouteNames = (): string[] => {
  if (!fs.existsSync(routesDir)) return [];
  return fs
    .readdirSync(routesDir)
    .filter((file) => /\.(ts|js)$/.test(file) && !file.endsWith(".d.ts"))
    .map((file) => file.replace(/\.(ts|js)$/, ""))
    .sort();
};

const collectOne = async (routeName: string): Promise<SourceResult> => {
  try {
    const routePath = path.join(routesDir, `${routeName}.${routesDir.includes("/dist/") ? "js" : "ts"}`);
    const fallbackPath = path.join(routesDir, `${routeName}.js`);
    const importPath = fs.existsSync(routePath) ? routePath : fallbackPath;
    const routeModule = (await import(pathToFileURL(importPath).href)) as RouteModule;

    if (!routeModule.handleRoute) {
      throw new Error("missing handleRoute export");
    }

    const routeData = await routeModule.handleRoute(mockContext, config.PUSH_NO_CACHE);
    const data = Array.isArray(routeData.data) ? routeData.data : [];

    return {
      name: routeData.name || routeName,
      title: routeData.title || routeName,
      type: routeData.type || "",
      link: routeData.link,
      total: routeData.total ?? data.length,
      data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`📡 [Push] ${routeName} fetch failed: ${message}`);
    return {
      name: routeName,
      title: routeName,
      type: "",
      total: 0,
      data: [],
      error: message,
    };
  }
};

const timeoutResult = (routeName: string, message: string): SourceResult => {
  logger.error(`📡 [Push] ${routeName} fetch failed: ${message}`);
  return {
    name: routeName,
    title: routeName,
    type: "",
    total: 0,
    data: [],
    error: message,
  };
};

const withTimeout = async (promise: Promise<SourceResult>, timeoutMs: number, routeName: string): Promise<SourceResult> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${routeName} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return timeoutResult(routeName, message);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const collectAllSources = async (): Promise<SourceResult[]> => {
  const routeNames = getRouteNames();
  const concurrency = Math.max(1, config.PUSH_CONCURRENCY);
  const results: SourceResult[] = [];

  for (let i = 0; i < routeNames.length; i += concurrency) {
    const chunk = routeNames.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((routeName) => withTimeout(collectOne(routeName), config.PUSH_SOURCE_TIMEOUT, routeName)),
    );
    results.push(...chunkResults);
  }

  return results;
};
