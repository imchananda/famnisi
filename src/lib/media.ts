import { parseCSV } from "./csv";

export type Platform =
  | "X"
  | "Instagram"
  | "Facebook"
  | "TikTok"
  | "YouTube";

export type MediaItem = {
  id: string;
  title: string;
  mediaName: string;
  date: string;
  platform: Platform;
  avatar: string;
  checked: boolean;
  url: string;
  hashtags: string;
  mark: boolean;
};

export const platforms = [
  "All",
  "X",
  "Instagram",
  "Facebook",
  "TikTok",
  "YouTube",
] as const;

export const platformMarks: Record<Platform, string> = {
  X: "X",
  Instagram: "IG",
  Facebook: "FB",
  TikTok: "TT",
  YouTube: "YT",
};

export const officialHashtags = [
  "FILM ARMANI SI AMBASSADOR",
  "#FilmXSiBloom",
  "#ArmaniFragrance",
];

export const mockMediaItems: MediaItem[] = [];

export function normalizePlatform(value: string): Platform {
  const raw = value.toLowerCase().trim();

  if (["x", "twitter"].includes(raw)) return "X";
  if (["ig", "instagram", "insta"].includes(raw)) return "Instagram";
  if (["fb", "facebook"].includes(raw)) return "Facebook";
  if (["tt", "tiktok"].includes(raw)) return "TikTok";
  if (["yt", "youtube"].includes(raw)) return "YouTube";
  return "X";
}

export function parseMediaItemsFromCSV(csvText: string): MediaItem[] {
  const rows = parseCSV(csvText.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.toLowerCase().trim());
  const getVal = (values: string[], headerName: string) => {
    const index = headers.indexOf(headerName.toLowerCase().trim());
    return index !== -1 ? values[index] || "" : "";
  };

  return rows
    .slice(1)
    .map((values, index) => {
      const platform = normalizePlatform(getVal(values, "platform") || "x");
      const mediaName =
        getVal(values, "media") ||
        getVal(values, "mediaName") ||
        getVal(values, "media_name") ||
        getVal(values, "ชื่อสื่อ") ||
        "";
      const title =
        getVal(values, "title") ||
        getVal(values, "note") ||
        mediaName ||
        `${platform} Campaign Post`;
      const url = getVal(values, "url");
      const hashtags =
        getVal(values, "hashtags") ||
        getVal(values, "hashtag") ||
        officialHashtags.join("\n");
      const rawMark = getVal(values, "mark").toLowerCase().trim();
      const mark =
        rawMark === "1" ||
        rawMark === "true" ||
        rawMark === "yes" ||
        rawMark === "x" ||
        rawMark === "สำคัญ";

      return {
        id: getVal(values, "id") || url || String(index + 1),
        title,
        mediaName,
        date: getVal(values, "date") || getVal(values, "created_at") || "",
        platform,
        avatar: getAvatar(mediaName || platform),
        checked: false,
        url,
        hashtags,
        mark,
      };
    })
    .filter((item) => item.url || item.title || item.mediaName)
    .reverse();
}

function getAvatar(label: string) {
  return label
    .split(/[\s_@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}
