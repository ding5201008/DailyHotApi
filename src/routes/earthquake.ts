import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";

const mappings: Record<string, string> = {
  O_TIME: "发震时刻(UTC+8)",
  LOCATION_C: "参考位置",
  M: "震级(M)",
  EPI_LAT: "纬度(°)",
  EPI_LON: "经度(°)",
  EPI_DEPTH: "深度(千米)",
  SAVE_TIME: "录入时间",
};

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "earthquake",
    title: "中国地震台",
    type: "地震速报",
    link: "https://news.ceic.ac.cn/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface WolfxEarthquakeItem {
  EventID: string;
  time: string;
  ReportTime: string;
  location: string;
  magnitude: string;
  depth: string;
  latitude: string;
  longitude: string;
}

const getList = async (noCache: boolean) => {
  const url = "https://api.wolfx.jp/cenc_eqlist.json";
  const result = await get<Record<string, WolfxEarthquakeItem | string>>({ url, noCache });
  const list = Object.values(result.data).filter(
    (item): item is WolfxEarthquakeItem => typeof item === "object" && Boolean(item.EventID),
  );
  return {
    ...result,
    data: list.map((v) => {
      const contentBuilder = [
        `${mappings.O_TIME}：${v.time}`,
        `${mappings.LOCATION_C}：${v.location}`,
        `${mappings.M}：${v.magnitude}`,
        `${mappings.EPI_LAT}：${v.latitude}`,
        `${mappings.EPI_LON}：${v.longitude}`,
        `${mappings.EPI_DEPTH}：${v.depth}`,
        `${mappings.SAVE_TIME}：${v.ReportTime}`,
      ];
      return {
        id: v.EventID,
        title: `${v.location}发生${v.magnitude}级地震`,
        desc: contentBuilder.join("\n"),
        timestamp: getTime(v.time),
        hot: undefined,
        url: "https://news.ceic.ac.cn/",
        mobileUrl: "https://news.ceic.ac.cn/",
      };
    }),
  };
};
