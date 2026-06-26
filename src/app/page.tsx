"use client";

import Image from "next/image";
import armaniLogo from "../../public/images/GIORGIO_ARMANI_LOGO_2019_B_Plan de travail 1.png";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type MediaItem,
  type Platform,
  mockMediaItems,
  officialHashtags,
  platforms,
} from "@/lib/media";
import {
  defaultMessagePools,
  generateRandomMessage,
  type MessageLanguage,
  type MessagePools,
} from "@/lib/messages";

const CHECKLIST_STORAGE_KEY = "film-armani-checklist-v1";
const LANGUAGE_STORAGE_KEY = "film-armani-language-v1";
const DEFAULT_CHECKLIST_SNAPSHOT = JSON.stringify(
  mockMediaItems.filter((item) => item.checked).map((item) => item.id),
);
type GalleryItem = {
  id: string;
  title: string;
  image: string;
  filename: string;
};

export default function Home() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(mockMediaItems);
  const [activeView, setActiveView] = useState<"media" | "gallery">("media");
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(
    null,
  );
  const [messagePools, setMessagePools] = useState<MessagePools>(defaultMessagePools);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [generatedGalleryCaption, setGeneratedGalleryCaption] = useState("");
  const [messageLanguage, setMessageLanguage] = useState<MessageLanguage>("th");
  const [barLanguage, setBarLanguage] = useState<MessageLanguage>("th");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNativeShareSupported, setIsNativeShareSupported] = useState(false);
  const [copiedType, setCopiedType] = useState<
    "hashtags" | "message" | "all" | null
  >(null);
  const [galleryCopiedType, setGalleryCopiedType] = useState<
    "caption" | "hashtags" | "all" | null
  >(null);
  const [activePlatform, setActivePlatform] =
    useState<(typeof platforms)[number]>("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const checklistSnapshot = useSyncExternalStore(
    subscribeToChecklist,
    getChecklistSnapshot,
    getServerChecklistSnapshot,
  );
  const checkedIds = useMemo(() => parseChecklistSnapshot(checklistSnapshot), [
    checklistSnapshot,
  ]);

  const loadMediaItems = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true);

    try {
      const response = await fetch("/api/media", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as { items?: MediaItem[] };
      if (!Array.isArray(data.items)) return;

      setMediaItems(data.items);
    } catch {
      // Keep the mock media list if the API is unavailable.
    } finally {
      if (showRefreshState) setIsRefreshing(false);
    }
  }, []);

  const loadGalleryItems = useCallback(async () => {
    try {
      const response = await fetch("/api/gallery", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as { items?: GalleryItem[] };
      if (Array.isArray(data.items)) setGalleryItems(data.items);
    } catch {
      setGalleryItems([]);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as { messages?: MessagePools };
      if (data.messages) setMessagePools(data.messages);
    } catch {
      setMessagePools(defaultMessagePools);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMediaItems() {
      if (cancelled) return;
      await loadMediaItems();
    }

    loadInitialMediaItems();

    return () => {
      cancelled = true;
    };
  }, [loadMediaItems]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadGalleryItems();
      loadMessages();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadGalleryItems, loadMessages]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!("canShare" in navigator)) return;

      try {
        const file = new File([""], "gallery.txt", { type: "text/plain" });
        setIsNativeShareSupported(navigator.canShare({ files: [file] }));
      } catch {
        setIsNativeShareSupported(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filteredItems = useMemo(() => {
    const result = mediaItems
      .filter((item) => {
        const matchesPlatform =
          activePlatform === "All" || item.platform === activePlatform;

        return matchesPlatform;
      })
      .sort((a, b) => {
        if (b.mark !== a.mark) return b.mark ? 1 : -1;
        if (sortOrder === "platform") return a.platform.localeCompare(b.platform);
        return getDateTime(b.date) - getDateTime(a.date);
      });

    if (sortOrder === "checked") {
      return [...result].sort(
        (a, b) => Number(checkedIds.has(b.id)) - Number(checkedIds.has(a.id)),
      );
    }

    const pending = result.filter((item) => !checkedIds.has(item.id));
    const done = result.filter((item) => checkedIds.has(item.id));

    return [...pending, ...done];
  }, [activePlatform, checkedIds, mediaItems, sortOrder]);

  const platformCounts = useMemo(() => {
    const initialCounts = Object.fromEntries(
      platforms.map((platform) => [platform, 0]),
    ) as Record<(typeof platforms)[number], number>;

    return mediaItems.reduce(
      (counts, item) => {
        counts.All += 1;
        counts[item.platform] += 1;
        return counts;
      },
      initialCounts,
    );
  }, [mediaItems]);

  const completedCount = checkedIds.size;
  const pendingCount = Math.max(mediaItems.length - completedCount, 0);
  const completionPercent = mediaItems.length
    ? Math.min(Math.round((completedCount / mediaItems.length) * 100), 100)
    : 0;
  const barLabels = bottomBarLabels[barLanguage];
  const activeSortLabel =
    sortOrder === "checked"
      ? barLabels.sortChecked
      : sortOrder === "platform"
        ? barLabels.sortPlatform
        : barLabels.sortNewest;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage !== "th" && savedLanguage !== "en") return;

      setBarLanguage(savedLanguage);
      setMessageLanguage(savedLanguage);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const changeLanguage = (language: MessageLanguage) => {
    setBarLanguage(language);
    setMessageLanguage(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  };

  const toggleChecked = (id: string) => {
    const next = new Set(checkedIds);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify([...next]));
    window.dispatchEvent(new Event(CHECKLIST_STORAGE_KEY));
  };

  const openMediaItem = (item: MediaItem) => {
    setSelectedItem(item);
    setGeneratedMessage("");
    setCopiedType(null);
  };

  const copySelectedHashtags = async () => {
    if (!selectedItem) return;
    await navigator.clipboard.writeText(selectedItem.hashtags || officialHashtags.join("\n"));
    setCopiedType("hashtags");
    window.setTimeout(() => setCopiedType(null), 1800);
  };

  const generateMessage = (language = messageLanguage) => {
    setMessageLanguage(language);
    setGeneratedMessage(generateRandomMessage(language, messagePools));
    setCopiedType(null);
  };

  const copyMessage = async () => {
    if (!generatedMessage) return;
    await navigator.clipboard.writeText(generatedMessage);
    setCopiedType("message");
    window.setTimeout(() => setCopiedType(null), 1800);
  };

  const copyAll = async () => {
    if (!selectedItem) return;
    const hashtags = selectedItem.hashtags || officialHashtags.join("\n");
    const text = generatedMessage ? `${generatedMessage}\n\n${hashtags}` : hashtags;
    await navigator.clipboard.writeText(text);
    setCopiedType("all");
    window.setTimeout(() => setCopiedType(null), 1800);
  };

  const goToPost = () => {
    if (!selectedItem?.url) return;
    window.open(selectedItem.url, "_blank", "noopener,noreferrer");
  };

  const openGalleryItem = (item: GalleryItem) => {
    setSelectedGalleryItem(item);
    setGeneratedGalleryCaption("");
    setGalleryCopiedType(null);
  };

  const galleryShareText = [
    "FILM ARMANI SI AMBASSADOR",
    ...officialHashtags,
    "@filmracha",
  ].join("\n");

  const generateGalleryCaption = (language = barLanguage) => {
    setBarLanguage(language);
    setMessageLanguage(language);
    setGeneratedGalleryCaption(generateRandomMessage(language, messagePools));
    setGalleryCopiedType(null);
  };

  const downloadGalleryImage = async (item: GalleryItem) => {
    try {
      const response = await fetch(item.image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `film-armani-${item.filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(item.image, "_blank", "noopener,noreferrer");
    }
  };

  const copyGalleryCaption = async () => {
    if (!generatedGalleryCaption) return;

    await navigator.clipboard.writeText(generatedGalleryCaption);
    setGalleryCopiedType("caption");
    window.setTimeout(() => setGalleryCopiedType(null), 1800);
  };

  const copyGalleryHashtags = async () => {
    await navigator.clipboard.writeText(galleryShareText);
    setGalleryCopiedType("hashtags");
    window.setTimeout(() => setGalleryCopiedType(null), 1800);
  };

  const copyGalleryAll = async () => {
    const text = generatedGalleryCaption
      ? `${generatedGalleryCaption}\n\n${galleryShareText}`
      : galleryShareText;

    await navigator.clipboard.writeText(text);
    setGalleryCopiedType("all");
    window.setTimeout(() => setGalleryCopiedType(null), 1800);
  };

  const shareGalleryNative = async () => {
    if (!selectedGalleryItem) return;

    const text = generatedGalleryCaption
      ? `${generatedGalleryCaption}\n\n${galleryShareText}`
      : galleryShareText;

    try {
      const response = await fetch(selectedGalleryItem.image);
      const blob = await response.blob();
      const file = new File([blob], selectedGalleryItem.filename, {
        type: blob.type || "image/jpeg",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Film Rachanun x Armani Si Bloom",
          text,
        });
        return;
      }

      await copyGalleryAll();
      await downloadGalleryImage(selectedGalleryItem);
    } catch {
      await copyGalleryAll();
      await downloadGalleryImage(selectedGalleryItem);
    }
  };

  const shareGalleryToX = () => {
    const text = generatedGalleryCaption
      ? `${generatedGalleryCaption}\n\n${galleryShareText}`
      : galleryShareText;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const shareGalleryToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        window.location.origin,
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <main className="min-h-screen bg-[#f8efe9] pb-28 text-[#2a1114]">
      <section
        id="top"
        className="mx-auto grid max-w-[1500px] gap-5 px-5 py-10 text-center sm:px-8 md:min-h-[620px] md:grid-cols-[45%_55%] md:items-center md:gap-8 md:py-10 md:text-left lg:px-10 xl:min-h-[720px] xl:grid-cols-[40%_60%] xl:py-12"
      >
        <div className="mx-auto max-w-3xl md:mx-0 md:max-w-none">
          <Image
            src={armaniLogo}
            alt="Giorgio Armani"
            priority
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 300px, 240px"
            className="mx-auto mb-9 h-auto w-60 object-contain sm:w-72 md:mx-0 lg:w-72 xl:w-80"
          />
          <h1 className="luxury-display text-4xl font-medium leading-[0.95] tracking-[0.04em] text-[#2a1114] sm:text-5xl md:text-5xl xl:text-7xl">
            {barLanguage === "th" ? "ฟิล์ม รชานันท์" : "FILM RACHANUN"}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-sm font-medium uppercase leading-snug tracking-[0.12em] text-[#8d2334] sm:text-lg md:mx-0 md:text-xl xl:text-2xl">
            Giorgio Armani Thailand
            <br />
            Fragrance Ambassador
          </p>
          <p className="luxury-display mt-5 text-xs font-normal uppercase tracking-[0.2em] text-[#6f1d2c] sm:text-base md:text-4xl xl:text-5xl">
            Armani Si Bloom
          </p>

          <div className="mt-8 hidden flex-wrap justify-center gap-3 md:flex md:justify-start">
            {["#FilmXSiBloom", "#ArmaniFragrance", "#filmracha"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#d7aeb0] bg-[#fffaf6] px-4 py-2 text-sm font-medium text-[#7b2531]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex justify-center overflow-visible md:h-[500px] md:-ml-6 md:justify-end xl:h-[620px] xl:-ml-16">
          <Image
            src="/images/hero-film-armani.png?v=202606262116"
            alt="Film Rachanun for Giorgio Armani Si Bloom campaign"
            width={1457}
            height={1402}
            priority
            sizes="(min-width: 1280px) 60vw, (min-width: 768px) 55vw, 88vw"
            className="h-auto max-h-[460px] w-[95vw] max-w-none object-contain md:h-full md:max-h-full md:w-auto xl:h-full"
          />
        </div>
      </section>

      <section id="media-list" className="bg-[#fffaf6] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="luxury-display text-2xl font-medium uppercase tracking-[0.18em] text-[#8d2334] sm:text-3xl lg:text-4xl">
                {activeView === "gallery" ? barLabels.gallery : barLabels.mediaList}
              </h2>
            </div>

            {activeView === "media" ? (
              <div
                className="relative shrink-0"
                onBlur={(event) => {
                  if (!(event.relatedTarget instanceof Node)) {
                    setSortMenuOpen(false);
                    return;
                  }

                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setSortMenuOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => setSortMenuOpen((isOpen) => !isOpen)}
                  className="inline-flex h-10 min-w-[118px] items-center justify-between gap-3 rounded-full border border-[#d8b3ad]/60 bg-white/85 px-4 text-xs font-semibold text-[#2a1114] shadow-[0_8px_22px_rgba(111,29,44,0.07)] outline-none transition hover:border-[#8d2334]/55 hover:bg-[#fff7f3] focus:border-[#8d2334] focus:ring-4 focus:ring-[#8d2334]/10"
                  aria-expanded={sortMenuOpen}
                  aria-haspopup="menu"
                  aria-label={barLabels.sortMedia}
                >
                  <span className="truncate">{activeSortLabel}</span>
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 text-[#8d2334] transition-transform ${
                      sortMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {sortMenuOpen ? (
                  <div
                    className="absolute right-0 top-12 z-30 w-40 overflow-hidden rounded-[22px] border border-[#d8b3ad]/55 bg-[#fffaf6]/96 p-1.5 shadow-[0_18px_50px_rgba(111,29,44,0.18)] backdrop-blur-xl"
                    role="menu"
                  >
                    {[
                      { value: "newest", label: barLabels.sortNewest },
                      { value: "checked", label: barLabels.sortChecked },
                      { value: "platform", label: barLabels.sortPlatform },
                    ].map((option) => {
                      const isActive = sortOrder === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setSortOrder(option.value);
                            setSortMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                            isActive
                              ? "bg-[#8d2334] text-white shadow-sm"
                              : "text-[#6f1d2c] hover:bg-[#f8efe9]"
                          }`}
                          role="menuitem"
                        >
                          <span>{option.label}</span>
                          {isActive ? <span className="text-[10px]">✓</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {activeView === "media" ? (
            <div className="mt-8 flex justify-center">
              <div className="flex max-w-full gap-2 overflow-x-auto pb-2">
            {platforms.map((platform) => {
              const isActive = activePlatform === platform;

              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setActivePlatform(platform)}
                  aria-label={`Filter ${platform}`}
                  className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold leading-none transition ${
                    isActive
                      ? "border-[#8d2334] bg-[#8d2334] text-white shadow-[0_12px_26px_rgba(141,35,52,0.2)]"
                      : "border-[#d8b3ad] bg-[#fffaf6] text-[#6f1d2c] hover:border-[#8d2334]"
                  }`}
                >
                  <PlatformIcon platform={platform} className="h-4 w-4" />
                  <span className="ml-2 inline-block text-xs leading-none tabular-nums">
                    {platformCounts[platform]}
                  </span>
                </button>
              );
            })}
              </div>
            </div>
          ) : null}

          {activeView === "media" ? (
            <div className="mt-8 w-full">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
                {filteredItems.map((item, index) => {
                  const isChecked = checkedIds.has(item.id);
                  const previousItem = filteredItems[index - 1];
                  const isNewSection =
                    index === 0 || checkedIds.has(previousItem.id) !== isChecked;

                  return (
                    <Fragment key={item.id}>
                      {isNewSection ? (
                          <div className="col-span-1 flex items-center gap-4 px-2 pb-1 pt-5 first:pt-0 md:col-span-2 lg:col-span-3">
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d8b3ad]" />
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d2334]">
                            {isChecked ? barLabels.done : barLabels.pending}
                          </p>
                          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d8b3ad]" />
                        </div>
                      ) : null}

                      <article
                        onClick={() => openMediaItem(item)}
                        className={`group flex cursor-pointer items-stretch overflow-hidden rounded-2xl border transition ${
                          isChecked
                            ? "border-[#ead3cc] bg-[#f8efe9]/65 opacity-70"
                            : item.mark
                              ? "border-[#8d2334] bg-white shadow-[0_12px_32px_rgba(141,35,52,0.11)] hover:shadow-[0_18px_44px_rgba(141,35,52,0.15)]"
                              : "border-[#ead3cc] bg-white hover:border-[#d6aaa4] hover:shadow-[0_14px_34px_rgba(141,35,52,0.09)]"
                        }`}
                      >
                        <div
                          className={`w-2 shrink-0 ${
                            isChecked
                              ? "bg-[#d8b3ad]"
                              : item.mark
                                ? "bg-[#8d2334]"
                                : "bg-[#e8c8c4]"
                          }`}
                        />

                        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold ${
                              isChecked
                                ? "bg-[#ead3cc] text-[#6f1d2c]"
                                : "bg-[#8d2334] text-white"
                            }`}
                          >
                            {isChecked ? (
                              "✓"
                            ) : (
                              <PlatformIcon platform={item.platform} className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <h3 className="truncate text-sm font-semibold leading-5 text-[#2a1114]">
                                {item.mediaName || item.title}
                              </h3>
                              {item.mark && !isChecked ? (
                                <span className="shrink-0 rounded-full bg-[#8d2334] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white">
                                  {barLabels.focus}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-[#7c6864]">
                              <span className="shrink-0 uppercase">{item.platform}</span>
                              <span className="h-1 w-1 rounded-full bg-[#d8b3ad]" />
                              <span className="truncate">{item.title}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleChecked(item.id);
                            }}
                            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              isChecked
                                ? "bg-white text-[#6f1d2c] hover:bg-[#fff4f1]"
                                : "bg-[#fff4f1] text-[#8d2334] hover:bg-[#8d2334] hover:text-white"
                            }`}
                            aria-label={
                              isChecked ? barLabels.undoChecklist : barLabels.checkList
                            }
                          >
                            {isChecked ? "↩" : "✓"}
                          </button>
                        </div>
                      </article>
                    </Fragment>
                  );
                })}
              </div>

              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-[#ead3cc] bg-white px-5 py-10 text-center text-sm font-medium text-[#7c6864]">
                  {barLabels.noMedia}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-8">
              {galleryItems.length ? (
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
                  {galleryItems.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openGalleryItem(item)}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#d8b3ad]/35 bg-white p-1.5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#8d2334]/45 hover:shadow-[0_16px_40px_rgba(111,29,44,0.13)]"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#f8efe9]">
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={900}
                          height={1200}
                          sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
                          className="h-full w-full object-cover object-top transition-all duration-500 group-hover:scale-[1.04]"
                        />
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg border border-white/45 bg-[#fffaf6]/82 px-2 py-1 opacity-0 shadow-sm backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2a1114]">
                          {barLabels.look} {index + 1}
                        </span>
                        <span className="text-[9px] font-semibold text-[#8d2334]">
                          {barLabels.share}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-[#ead3cc] bg-white px-5 py-12 text-center text-sm font-medium text-[#7c6864]">
                  {barLabels.galleryEmpty}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {selectedItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div className="absolute inset-0 animate-in fade-in bg-[#2a1114]/30 backdrop-blur-sm duration-200" />

          <section
            className="relative flex max-h-[88vh] w-full max-w-[380px] animate-in zoom-in-95 flex-col overflow-hidden rounded-[28px] border border-[#d8b3ad]/35 bg-[#fffaf6] shadow-[0_10px_50px_rgba(42,17,20,0.18)] duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d8b3ad]/25 bg-[#f8efe9]/55 px-4 pb-2.5 pt-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8d2334] to-[#4b1723] text-white shadow-sm">
                  <PlatformIcon platform={selectedItem.platform} className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-[#2a1114]">
                    {selectedItem.mediaName || selectedItem.title || barLabels.noTitle}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d2334]/70">
                    {selectedItem.platform}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f8efe9] text-[#8d2334] transition-colors hover:bg-[#e8c8c4]/70 hover:text-[#2a1114]"
                aria-label={barLabels.close}
              >
                X
              </button>
            </div>

            <div className="flex-1 space-y-3.5 overflow-y-auto bg-[#fffaf6] p-4">
              <div className="relative rounded-[16px] border border-[#d8b3ad]/25 bg-white p-3 pt-2.5 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8d2334]/65">
                    {barLabels.hashtags}
                  </span>
                  <button
                    type="button"
                    onClick={copySelectedHashtags}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold shadow-sm transition-all ${
                      copiedType === "hashtags"
                        ? "border-[#2a1114] bg-[#2a1114] text-white"
                        : "border-[#d8b3ad]/30 bg-[#f8efe9] text-[#8d2334] hover:bg-[#ead3cc]/60 hover:text-[#2a1114]"
                    }`}
                  >
                    {copiedType === "hashtags" ? (
                      barLabels.copied
                    ) : (
                      <>
                        <CopyIcon className="h-3 w-3" />
                        {barLabels.copyTagsShort}
                      </>
                    )}
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto pr-1">
                  <p className="whitespace-pre-wrap text-[12.5px] font-medium leading-relaxed text-[#2a1114]">
                    {selectedItem.hashtags || officialHashtags.join("\n")}
                  </p>
                </div>
              </div>

              <div className="relative flex flex-col rounded-[16px] border border-[#d8b3ad]/25 bg-white p-3 pt-2.5 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8d2334]/65">
                    {barLabels.randomMessage}
                  </span>
                  {generatedMessage ? (
                    <div className="flex items-center gap-1.5">
                      {(["th", "en"] as const).map((language) => (
                        <button
                          key={language}
                          type="button"
                          onClick={() => generateMessage(language)}
                          className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-sm transition-all ${
                            messageLanguage === language
                              ? "bg-[#ead3cc] text-[#2a1114]"
                              : "border border-[#d8b3ad]/30 bg-[#f8efe9] text-[#8d2334]/75 hover:bg-[#ead3cc]/60"
                          }`}
                        >
                          ↻ {language.toUpperCase()}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={copyMessage}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold shadow-sm transition-all ${
                          copiedType === "message"
                            ? "border-[#2a1114] bg-[#2a1114] text-white"
                            : "border-[#d8b3ad]/30 bg-[#f8efe9] text-[#8d2334] hover:bg-[#ead3cc]/60 hover:text-[#2a1114]"
                        }`}
                      >
                        {copiedType === "message" ? (
                          barLabels.copied
                        ) : (
                          <>
                            <CopyIcon className="h-3 w-3" />
                            {barLabels.copyMsgShort}
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>

                {!generatedMessage ? (
                  <div className="flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => generateMessage("th")}
                      className="flex-1 rounded-xl border border-[#d8b3ad]/25 bg-[#f8efe9] py-4 text-[13px] font-bold text-[#2a1114] shadow-sm transition-all hover:bg-[#ead3cc]/60"
                    >
                      THAI
                    </button>
                    <button
                      type="button"
                      onClick={() => generateMessage("en")}
                      className="flex-1 rounded-xl border border-[#d8b3ad]/25 bg-[#f8efe9] py-4 text-[13px] font-bold text-[#2a1114] shadow-sm transition-all hover:bg-[#ead3cc]/60"
                    >
                      ENGLISH
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] leading-relaxed text-[#2a1114]">
                    {generatedMessage}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                {generatedMessage ? (
                  <button
                    type="button"
                    onClick={copyAll}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-[14px] border py-3 text-[12.5px] font-bold shadow-sm transition-all ${
                      copiedType === "all"
                        ? "border-[#d8b3ad]/40 bg-white text-[#2a1114]"
                        : "border-transparent bg-[#2a1114] text-white hover:bg-[#4b1723]"
                    }`}
                  >
                    {copiedType === "all" ? (
                      barLabels.copied
                    ) : (
                      <>
                        <CopyIcon className="h-3.5 w-3.5" />
                        {barLabels.copyAll}
                      </>
                    )}
                  </button>
                ) : null}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={goToPost}
                    className="flex flex-1 items-center justify-center rounded-[14px] bg-gradient-to-r from-[#8d2334] to-[#4b1723] py-3.5 text-[12.5px] font-bold text-white shadow-sm transition-all hover:opacity-90"
                  >
                    {barLabels.goToPost}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toggleChecked(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    className={`flex flex-1 items-center justify-center rounded-[14px] border py-3.5 text-[12.5px] font-bold shadow-sm transition-all ${
                      checkedIds.has(selectedItem.id)
                        ? "border-[#d8b3ad]/35 bg-white text-[#2a1114] hover:bg-[#f8efe9]"
                        : "border-transparent bg-[#2a1114] text-white hover:bg-[#4b1723]"
                    }`}
                  >
                    {checkedIds.has(selectedItem.id) ? barLabels.done : barLabels.markDone}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {selectedGalleryItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
          onClick={() => setSelectedGalleryItem(null)}
        >
          <div className="absolute inset-0 animate-in fade-in bg-[#2a1114]/40 backdrop-blur-sm duration-200" />

          <section
            className="relative flex max-h-[88vh] w-full max-w-[420px] animate-in zoom-in-95 flex-col overflow-hidden rounded-[28px] border border-[#d8b3ad]/35 bg-[#fffaf6] shadow-[0_10px_50px_rgba(42,17,20,0.18)] duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d8b3ad]/25 bg-[#f8efe9]/55 px-4 pb-2.5 pt-3.5">
              <span className="text-xs font-bold uppercase tracking-widest text-[#8d2334]">
                {barLabels.shareCampaignPhoto}
              </span>
              <button
                type="button"
                onClick={() => setSelectedGalleryItem(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8efe9] text-[#8d2334] transition-colors hover:bg-[#e8c8c4]/70 hover:text-[#2a1114]"
                aria-label={barLabels.close}
              >
                X
              </button>
            </div>

            <div className="max-h-[75vh] space-y-4 overflow-y-auto p-4">
              <div className="group relative overflow-hidden rounded-2xl border border-[#d8b3ad]/30 bg-white p-1.5 shadow-inner">
                <Image
                  src={selectedGalleryItem.image}
                  alt={selectedGalleryItem.title}
                  width={900}
                  height={1200}
                  sizes="(min-width: 640px) 380px, 92vw"
                  className="aspect-[4/3] w-full rounded-xl object-cover object-top"
                />

                <button
                  type="button"
                  onClick={() => downloadGalleryImage(selectedGalleryItem)}
                  className="absolute bottom-3.5 right-3.5 flex items-center gap-1.5 rounded-lg bg-[#2a1114]/85 px-3 py-1.5 text-[11px] font-bold text-white shadow-md backdrop-blur-sm transition-all hover:bg-[#2a1114] active:scale-95"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  {barLabels.downloadPhoto}
                </button>
              </div>

              <div className="rounded-[16px] border border-[#d8b3ad]/25 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8d2334]/65">
                    {barLabels.hashtags}
                  </span>
                  <button
                    type="button"
                    onClick={copyGalleryHashtags}
                    className={`rounded-md border px-2.5 py-1 text-[10px] font-bold transition-all ${
                      galleryCopiedType === "hashtags"
                        ? "border-[#2a1114] bg-[#2a1114] text-white"
                        : "border-[#d8b3ad]/30 bg-[#f8efe9] text-[#8d2334] hover:bg-[#ead3cc]/60 hover:text-[#2a1114]"
                    }`}
                  >
                    {galleryCopiedType === "hashtags"
                      ? barLabels.copied
                      : barLabels.copyHashtag}
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-xs font-semibold leading-relaxed tracking-wide text-[#2a1114]">
                  {galleryShareText}
                </p>
              </div>

              <div className="flex flex-col rounded-[16px] border border-[#d8b3ad]/25 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8d2334]/65">
                    {barLabels.randomCaption}
                  </span>

                  {generatedGalleryCaption ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => generateGalleryCaption()}
                        className="rounded-md bg-[#f8efe9] px-2 py-1 text-[10px] font-bold text-[#8d2334]/80 hover:bg-[#ead3cc]/60"
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        onClick={copyGalleryCaption}
                        className={`rounded-md border px-2.5 py-1 text-[10px] font-bold transition-all ${
                          galleryCopiedType === "caption"
                            ? "border-[#2a1114] bg-[#2a1114] text-white"
                            : "border-[#d8b3ad]/30 bg-[#f8efe9] text-[#8d2334] hover:bg-[#ead3cc]/60 hover:text-[#2a1114]"
                        }`}
                      >
                        {galleryCopiedType === "caption"
                          ? barLabels.copied
                          : barLabels.copyMsgShort}
                      </button>
                    </div>
                  ) : null}
                </div>

                {!generatedGalleryCaption ? (
                  <button
                    type="button"
                    onClick={() => generateGalleryCaption()}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#d8b3ad]/25 bg-[#f8efe9] py-3.5 text-xs font-bold text-[#2a1114] shadow-sm transition-all hover:bg-[#ead3cc]/60 active:scale-[0.98]"
                  >
                    {barLabels.rollCaption}
                  </button>
                ) : (
                  <p className="text-xs font-medium leading-relaxed text-[#2a1114]">
                    {generatedGalleryCaption}
                  </p>
                )}
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={shareGalleryNative}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 text-xs font-bold shadow-sm transition-all ${
                    galleryCopiedType === "all"
                      ? "border-[#d8b3ad]/35 bg-white text-[#2a1114]"
                      : "border-transparent bg-gradient-to-r from-[#8d2334] to-[#4b1723] text-white hover:opacity-95"
                  }`}
                >
                  <ShareIcon className="h-4 w-4" />
                  {galleryCopiedType === "all"
                    ? barLabels.sharePrepared
                    : isNativeShareSupported
                      ? barLabels.sharePhotoDirect
                      : barLabels.quickDownloadCopy}
                </button>

                {generatedGalleryCaption ? (
                  <button
                    type="button"
                    onClick={copyGalleryAll}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold shadow-sm transition-all ${
                      galleryCopiedType === "all"
                        ? "border-[#d8b3ad]/35 bg-white text-[#2a1114]"
                        : "border-transparent bg-[#2a1114]/85 text-white hover:bg-[#2a1114]"
                    }`}
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                    {barLabels.copyAll}
                  </button>
                ) : null}

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={shareGalleryToX}
                    className="flex h-11 items-center justify-center rounded-xl bg-[#111111] text-white shadow-sm transition hover:opacity-90 active:scale-95"
                    title={barLabels.shareToX}
                  >
                    <PlatformIcon platform="X" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={shareGalleryToFacebook}
                    className="flex h-11 items-center justify-center rounded-xl bg-[#1877f2] text-white shadow-sm transition hover:opacity-90 active:scale-95"
                    title={barLabels.shareToFacebook}
                  >
                    <PlatformIcon platform="Facebook" className="h-5 w-5" />
                  </button>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 text-white shadow-sm transition hover:opacity-90 active:scale-95"
                    title={barLabels.goToInstagram}
                  >
                    <PlatformIcon platform="Instagram" className="h-5 w-5" />
                  </a>
                  <a
                    href="https://tiktok.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center rounded-xl bg-black text-white shadow-sm transition hover:opacity-90 active:scale-95"
                    title={barLabels.goToTikTok}
                  >
                    <PlatformIcon platform="TikTok" className="h-5 w-5" />
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-[#d8b3ad]/20 bg-[#f8efe9]/55 p-2.5 text-center">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-widest text-[#8d2334]/70">
                  {barLabels.tips}
                </span>
                <p className="text-[10px] leading-relaxed text-[#7c6864]">
                  {barLabels.galleryTip}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-transparent px-4 pb-4 sm:pb-6">
        <div className="relative mx-auto max-w-3xl">
          <div className="flex w-full items-center justify-between gap-1 rounded-[28px] border border-[#d8b3ad]/35 bg-[#fffaf6]/95 px-3 py-2.5 shadow-2xl shadow-[#6f1d2c]/18 backdrop-blur-xl sm:px-5">
            <div className="flex shrink-0 rounded-full border border-[#d8b3ad]/25 bg-[#f8efe9] p-0.5">
              {(["th", "en"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => {
                    changeLanguage(language);
                  }}
                  className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-all sm:text-[10px] ${
                    barLanguage === language
                      ? "bg-white text-[#2a1114] shadow-sm"
                      : "text-[#7c6864]/70 hover:text-[#2a1114]"
                  }`}
                  aria-pressed={barLanguage === language}
                >
                  {language.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="mx-1 h-6 w-px shrink-0 bg-[#d8b3ad]/35 sm:mx-2" />

            <div className="flex flex-1 flex-col items-center">
              <div className="mb-1 flex items-baseline whitespace-nowrap text-[12px] font-bold leading-none text-[#2a1114] sm:text-[13px]">
                {pendingCount}
                <span className="ml-[2px] text-[9px] font-normal text-[#7c6864]/60 sm:text-[10px]">
                  / {mediaItems.length}
                </span>
              </div>
              <div className="whitespace-nowrap text-[7px] uppercase leading-none tracking-widest text-[#7c6864]/85 sm:text-[8px]">
                {barLabels.pending}
              </div>
            </div>

            <div className="h-6 w-px shrink-0 bg-[#d8b3ad]/35" />

            <div className="flex flex-1 flex-col items-center">
              <div className="mb-1 text-[13px] font-bold leading-none text-[#8d2334] sm:text-[14px]">
                {completionPercent}%
              </div>
              <div className="whitespace-nowrap text-[7px] uppercase leading-none tracking-widest text-[#7c6864]/85 sm:text-[8px]">
                {barLabels.complete}
              </div>
            </div>

            <div className="mx-1 h-6 w-px shrink-0 bg-[#d8b3ad]/35 sm:mx-2" />

            <button
              type="button"
              onClick={() => {
                setActiveView((current) => (current === "media" ? "gallery" : "media"));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="group flex flex-1 cursor-pointer flex-col items-center justify-center transition-all active:scale-95"
              aria-label={activeView === "media" ? "Open gallery" : "Open media list"}
            >
              <div
                className={`transition-all duration-300 ${
                  activeView === "gallery"
                    ? "scale-110 text-[#8d2334]"
                    : "text-[#d8b3ad] group-hover:text-[#2a1114]"
                }`}
              >
                {activeView === "gallery" ? (
                  <MediaIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                ) : (
                  <GalleryIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                )}
              </div>
              <div
                className={`mt-1 whitespace-nowrap text-[7px] uppercase leading-none tracking-widest transition-all sm:text-[8px] ${
                  activeView === "gallery"
                    ? "font-bold text-[#8d2334]"
                    : "text-[#7c6864]/85 group-hover:text-[#2a1114]"
                }`}
              >
                {activeView === "gallery" ? barLabels.media : barLabels.gallery}
              </div>
            </button>

            <div className="ml-1 mr-2 hidden h-6 w-px shrink-0 bg-[#d8b3ad]/35 sm:block" />

            <button
              type="button"
              onClick={() => {
                loadMediaItems(true);
                loadGalleryItems();
                loadMessages();
              }}
              disabled={isRefreshing}
              className={`shrink-0 rounded-full border border-[#d8b3ad]/35 bg-[#f8efe9] p-2 text-[#2a1114] transition-all hover:bg-[#8d2334] hover:text-white sm:p-1.5 ${
                isRefreshing ? "animate-spin opacity-50" : ""
              }`}
              aria-label={barLabels.refresh}
              title={isRefreshing ? barLabels.refreshing : barLabels.refresh}
            >
              <RefreshIcon className="h-[14px] w-[14px] sm:h-[15px] sm:w-[15px]" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

const bottomBarLabels: Record<
  MessageLanguage,
  {
    pending: string;
    done: string;
    complete: string;
    media: string;
    mediaList: string;
    campaignGallery: string;
    gallery: string;
    refresh: string;
    refreshing: string;
    sortMedia: string;
    sortNewest: string;
    sortChecked: string;
    sortPlatform: string;
    noMedia: string;
    focus: string;
    checkList: string;
    undoChecklist: string;
    closeDetails: string;
    close: string;
    hashtags: string;
    copyHashtag: string;
    copyTagsShort: string;
    copied: string;
    randomMessage: string;
    messagePlaceholder: string;
    generateMessage: string;
    copyMessage: string;
    copyMsgShort: string;
    copyAll: string;
    goToPost: string;
    markDone: string;
    undoDone: string;
    noTitle: string;
    look: string;
    share: string;
    galleryEmpty: string;
    shareCampaignPhoto: string;
    downloadPhoto: string;
    randomCaption: string;
    rollCaption: string;
    sharePrepared: string;
    sharePhotoDirect: string;
    quickDownloadCopy: string;
    shareToX: string;
    shareToFacebook: string;
    goToInstagram: string;
    goToTikTok: string;
    tips: string;
    galleryTip: string;
  }
> = {
  th: {
    pending: "รอทำ",
    done: "ทำแล้ว",
    complete: "สำเร็จ",
    media: "สื่อ",
    mediaList: "รายการสื่อ",
    campaignGallery: "แกลเลอรี่แคมเปญ",
    gallery: "แกลเลอรี่",
    refresh: "รีเฟรช",
    refreshing: "กำลังโหลด",
    sortMedia: "เรียงรายการสื่อ",
    sortNewest: "ใหม่ล่าสุด",
    sortChecked: "ทำแล้ว",
    sortPlatform: "แพลตฟอร์ม",
    noMedia: "ไม่พบรายการสื่อที่ตรงกัน",
    focus: "สำคัญ",
    checkList: "เช็กลิสต์",
    undoChecklist: "ยกเลิกเช็กลิสต์",
    closeDetails: "ปิดรายละเอียดสื่อ",
    close: "ปิด",
    hashtags: "แฮชแท็ก",
    copyHashtag: "คัดลอกแฮชแท็ก",
    copyTagsShort: "คัดลอกแท็ก",
    copied: "คัดลอกแล้ว",
    randomMessage: "ข้อความสุ่ม",
    messagePlaceholder: "สุ่มข้อความสำหรับรายการสื่อนี้",
    generateMessage: "สุ่มข้อความ",
    copyMessage: "คัดลอกข้อความ",
    copyMsgShort: "คัดลอกข้อความ",
    copyAll: "คัดลอกทั้งหมด",
    goToPost: "ไปที่โพสต์",
    markDone: "ทำเสร็จแล้ว",
    undoDone: "ยกเลิกทำแล้ว",
    noTitle: "ไม่มีชื่อ",
    look: "ลุค",
    share: "แชร์",
    galleryEmpty: "ยังไม่มีรูปในโฟลเดอร์ public/images/gall",
    shareCampaignPhoto: "แชร์รูปแคมเปญ",
    downloadPhoto: "บันทึกรูป",
    randomCaption: "แคปชั่นสุ่ม",
    rollCaption: "สุ่มแคปชั่น",
    sharePrepared: "เตรียมข้อมูลเรียบร้อยแล้ว",
    sharePhotoDirect: "แชร์รูปพร้อมข้อความ",
    quickDownloadCopy: "ดาวน์โหลดและคัดลอก",
    shareToX: "แชร์ไป X",
    shareToFacebook: "แชร์ไป Facebook",
    goToInstagram: "ไปที่ Instagram",
    goToTikTok: "ไปที่ TikTok",
    tips: "คำแนะนำ",
    galleryTip: "บันทึกรูป คัดลอกแคปชั่นและแฮชแท็ก แล้วนำไปโพสต์บนแพลตฟอร์มที่ต้องการได้ทันที",
  },
  en: {
    pending: "Pending",
    done: "Done",
    complete: "Complete",
    media: "Media",
    mediaList: "Media List",
    campaignGallery: "Campaign Gallery",
    gallery: "Gallery",
    refresh: "Refresh",
    refreshing: "Loading",
    sortMedia: "Sort media",
    sortNewest: "Newest",
    sortChecked: "Checked",
    sortPlatform: "Platform",
    noMedia: "No media matched your search.",
    focus: "Focus",
    checkList: "Check list",
    undoChecklist: "Undo checklist",
    closeDetails: "Close media details",
    close: "Close",
    hashtags: "Hashtags",
    copyHashtag: "Copy Hashtag",
    copyTagsShort: "Copy Tags",
    copied: "Copied",
    randomMessage: "Random Message",
    messagePlaceholder: "Generate a campaign message for this media item.",
    generateMessage: "Generate Message",
    copyMessage: "Copy Message",
    copyMsgShort: "Copy Msg",
    copyAll: "Copy All",
    goToPost: "Go to Post",
    markDone: "Mark Done",
    undoDone: "Undo Done",
    noTitle: "No title",
    look: "Look",
    share: "Share",
    galleryEmpty: "No images found in public/images/gall yet.",
    shareCampaignPhoto: "Share Campaign Photo",
    downloadPhoto: "Save Photo",
    randomCaption: "Random Caption",
    rollCaption: "Roll Random Caption",
    sharePrepared: "Sharing Prepared",
    sharePhotoDirect: "Share Photo & Text",
    quickDownloadCopy: "Download & Copy",
    shareToX: "Share to X",
    shareToFacebook: "Share to Facebook",
    goToInstagram: "Go to Instagram",
    goToTikTok: "Go to TikTok",
    tips: "Tips",
    galleryTip:
      "Save the image, copy the caption and hashtags, then post directly to your preferred platform.",
  },
};

function GalleryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
      />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function MediaIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-13.46 5.86"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M4 12A8 8 0 0 1 17.46 6.14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M17.8 3.5v3.1h-3.1M6.2 20.5v-3.1h3.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function getDateTime(date: string) {
  const timestamp = new Date(date).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function subscribeToChecklist(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CHECKLIST_STORAGE_KEY) callback();
  };

  window.addEventListener(CHECKLIST_STORAGE_KEY, callback);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CHECKLIST_STORAGE_KEY, callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getChecklistSnapshot() {
  return localStorage.getItem(CHECKLIST_STORAGE_KEY) ?? DEFAULT_CHECKLIST_SNAPSHOT;
}

function getServerChecklistSnapshot() {
  return DEFAULT_CHECKLIST_SNAPSHOT;
}

function parseChecklistSnapshot(snapshot: string) {
  try {
    return new Set(JSON.parse(snapshot) as string[]);
  } catch {
    return new Set(JSON.parse(DEFAULT_CHECKLIST_SNAPSHOT) as string[]);
  }
}

function PlatformIcon({
  platform,
  className,
}: {
  platform: Platform | "All";
  className?: string;
}) {
  if (platform === "Instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm8.9 1.7a1.35 1.35 0 1 1 0 2.7 1.35 1.35 0 0 1 0-2.7ZM12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />
      </svg>
    );
  }

  if (platform === "Facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.48H15.2c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z" />
      </svg>
    );
  }

  if (platform === "TikTok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M16.62 2c.33 2.69 1.83 4.3 4.38 4.47v3.03a7.45 7.45 0 0 1-4.28-1.38v6.54c0 4.17-2.75 6.85-6.75 6.85-3.35 0-6.07-2.36-6.07-5.72 0-3.82 3.6-6.35 7.36-5.55v3.2c-1.75-.55-3.93.49-3.93 2.34 0 1.44 1.2 2.45 2.62 2.45 1.64 0 2.88-.95 2.88-3.26V2h3.79Z" />
      </svg>
    );
  }

  if (platform === "YouTube") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81ZM10 15V9l5.2 3L10 15Z" />
      </svg>
    );
  }

  if (platform === "X") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M17.53 3h3.08l-6.72 7.68L21.8 21h-6.2l-4.86-6.35L5.18 21H2.1l7.18-8.2L1.7 3h6.36l4.39 5.8L17.53 3Zm-1.08 16.18h1.7L7.12 4.72H5.3l11.15 14.46Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
    </svg>
  );
}

