import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { genHeaders } from "../utils/getToken/coolapk.js";
import { load } from "cheerio";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "coolapk",
    title: "酷安",
    type: "热榜",
    link: "https://www.coolapk.com/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface CoolapkItem {
  id: string;
  message: string;
  tpic: string;
  username: string;
  ttitle: string;
  shareUrl: string;
}

interface CoolapkResponse {
  data: CoolapkItem[];
}

interface Coolapk1sItem {
  id: string;
  message: string;
  message_title?: string;
  title: string;
  username: string;
  pic?: string;
  ttitle?: string;
  likenum?: string;
}

interface Coolapk1sPageProps {
  feeds?: Coolapk1sItem[];
}

const getFallbackList = async (noCache: boolean) => {
  const url = "https://www.coolapk1s.com/headlines/1";
  const result = await get<string>({
    url,
    noCache,
    responseType: "text",
    headers: {
      Referer: "https://www.coolapk1s.com/",
      "User-Agent": "Mozilla/5.0",
    },
  });
  const $ = load(result.data);
  const nextData = $("#__NEXT_DATA__").text();
  const pageData = JSON.parse(nextData) as { props?: { pageProps?: Coolapk1sPageProps } };
  const list = pageData.props?.pageProps?.feeds || [];

  return {
    ...result,
    data: list.map((v) => ({
      id: v.id,
      title: v.message_title || v.title,
      cover: v.pic,
      author: v.username,
      desc: load(v.message || "").text().trim(),
      timestamp: undefined,
      hot: v.likenum ? parseInt(v.likenum, 10) : undefined,
      url: `https://www.coolapk1s.com/feed/${v.id}`,
      mobileUrl: `https://www.coolapk1s.com/feed/${v.id}`,
    })),
  };
};

const getList = async (noCache: boolean) => {
  const url = `https://api.coolapk.com/v6/page/dataList?url=/feed/statList?cacheExpires=300&statType=day&sortField=detailnum&title=今日热门&title=今日热门&subTitle=&page=1`;
  let result;
  try {
    result = await get<CoolapkResponse>({
      url,
      noCache,
      headers: genHeaders(),
    });
  } catch {
    return getFallbackList(noCache);
  }
  const list = result.data.data;
  return {
    ...result,
    data: list.map((v) => ({
      id: v.id,
      title: v.message,
      cover: v.tpic,
      author: v.username,
      desc: v.ttitle,
      timestamp: undefined,
      hot: undefined,
      url: v.shareUrl,
      mobileUrl: v.shareUrl,
    })),
  };
};
