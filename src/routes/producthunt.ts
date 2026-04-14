import type { ListItem, RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import { parseRSS } from "../utils/parseRSS.js";
import { load } from "cheerio";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "producthunt",
    title: "Product Hunt",
    type: "Today",
    description: "The best new products, every day",
    link: "https://www.producthunt.com/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

const getList = async (noCache: boolean) => {
  const baseUrl = "https://www.producthunt.com";
  const feedUrl = `${baseUrl}/feed`;
  const result = await get<string>({
    url: feedUrl,
    noCache,
    responseType: "text",
  });

  try {
    const items = await parseRSS(result.data);
    const stories: ListItem[] = items
      .map((item, index): ListItem | undefined => {
        const content = item.content || item.contentSnippet || "";
        const $ = load(content);
        const desc = $("p").first().text().trim() || undefined;
        const link = item.link || "";
        const id = item.guid?.split("/").pop() || link || index;

        if (!item.title || !link) {
          return undefined;
        }

        return {
          id,
          title: item.title,
          desc,
          author: item.author,
          hot: undefined,
          timestamp: item.pubDate ? getTime(item.pubDate) : undefined,
          url: link,
          mobileUrl: link,
        };
      })
      .filter((item): item is ListItem => Boolean(item));

    return {
      ...result,
      data: stories,
    };
  } catch (error) {
    throw new Error(`Failed to parse Product Hunt HTML: ${error}`);
  }
};
