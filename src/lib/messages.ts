export type MessageLanguage = "th" | "en";

export type MessagePools = Record<MessageLanguage, string[]>;

export const defaultMessagePools: MessagePools = {
  th: [
    "ขอแสดงความยินดีกับฟิล์ม รชานันท์ ในฐานะ Giorgio Armani Thailand Fragrance Ambassador",
    "แคมเปญ Armani Si Bloom ครั้งนี้งดงามและหรูหรามาก",
    "ฟิล์ม รชานันท์ถ่ายทอดความสง่างามของ Giorgio Armani ได้อย่างลงตัว",
    "ลุคนี้อ่อนหวาน หรูหรา และเหมาะกับ Armani Si Bloom มาก",
  ],
  en: [
    "Congratulations to Film Rachanun as Giorgio Armani Thailand Fragrance Ambassador.",
    "A beautifully elegant campaign moment for Armani Si Bloom.",
    "Film Rachanun captures the refined spirit of Giorgio Armani with grace.",
    "Soft, polished, and luminous. A perfect Armani Si Bloom moment.",
  ],
};

const endings = [
  "So elegant.",
  "Beautifully done.",
  "Pure Si Bloom energy.",
  "A graceful campaign moment.",
];

export function generateRandomMessage(
  language: MessageLanguage = "th",
  pools: MessagePools = defaultMessagePools,
) {
  const pool = pools[language]?.filter(Boolean);
  const fallbackPool = defaultMessagePools[language];
  const activePool = pool.length ? pool : fallbackPool;
  const base = activePool[Math.floor(Math.random() * activePool.length)];
  const ending = endings[Math.floor(Math.random() * endings.length)];

  return language === "en" ? `${base} ${ending}` : base;
}
