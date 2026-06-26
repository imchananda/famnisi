"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  type MediaItem,
  type Platform,
  normalizePlatform,
  officialHashtags,
  parseMediaItemsFromCSV,
  platforms,
} from "@/lib/media";

type Language = "th" | "en";

type AdminForm = {
  id: string;
  mark: boolean;
  platform: Platform;
  mediaName: string;
  title: string;
  url: string;
  hashtags: string;
};

type AdminSheetResponse = {
  ok?: boolean;
  error?: string;
  response?: {
    ok?: boolean;
    id?: string;
    error?: string;
  };
};

const emptyForm: AdminForm = {
  id: "",
  mark: false,
  platform: "Instagram",
  mediaName: "",
  title: "",
  url: "",
  hashtags: officialHashtags.join("\n"),
};

const LANGUAGE_STORAGE_KEY = "film-armani-language-v1";
const ADMIN_AUTH_STORAGE_KEY = "film-armani-admin-auth-v1";

export default function AdminPage() {
  const [language, setLanguage] = useState<Language>("th");
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [authError, setAuthError] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activePlatform, setActivePlatform] = useState<(typeof platforms)[number]>("All");
  const [formData, setFormData] = useState<AdminForm>(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const t = adminText[language];

  const loadMedia = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/sheet", { cache: "no-store" });
      if (!response.ok) {
        setStatusMessage(t.loadError);
        return;
      }

      const csv = await response.text();
      setItems(parseMediaItemsFromCSV(csv));
    } catch {
      setStatusMessage(t.loadError);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage === "th" || savedLanguage === "en") {
        setLanguage(savedLanguage);
      }

      if (sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === "true") {
        setVerified(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!verified) return;
    const timeoutId = window.setTimeout(() => {
      loadMedia();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMedia, verified]);

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const platformCounts = useMemo(() => {
    return platforms.reduce(
      (acc, platform) => {
        if (platform === "All") {
          acc[platform] = items.length;
          return acc;
        }

        acc[platform] = items.filter((item) => item.platform === platform).length;
        return acc;
      },
      {} as Record<(typeof platforms)[number], number>,
    );
  }, [items]);

  const mediaSuggestions = useMemo(() => {
    const uniqueNames = Array.from(
      new Set(items.map((item) => item.mediaName).filter(Boolean)),
    );
    const normalizedValue = formData.mediaName.trim().toLowerCase();

    if (!normalizedValue) return uniqueNames.slice(0, 6);

    return uniqueNames
      .filter(
        (name) =>
          name.toLowerCase().includes(normalizedValue) &&
          name.toLowerCase() !== normalizedValue,
      )
      .slice(0, 6);
  }, [formData.mediaName, items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const matchesPlatform =
        activePlatform === "All" || item.platform === activePlatform;
      const matchesSearch =
        !normalizedSearch ||
        `${item.title} ${item.mediaName} ${item.url} ${item.hashtags}`
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesPlatform && matchesSearch;
    });
  }, [activePlatform, items, searchTerm]);

  const isUrlDuplicate = useMemo(() => {
    const normalizedUrl = normalizeUrl(formData.url);
    if (!normalizedUrl) return false;

    return items.some((item) => {
      if (formData.id && item.id === formData.id) return false;
      return normalizeUrl(item.url) === normalizedUrl;
    });
  }, [formData.id, formData.url, items]);

  const totalMarked = items.filter((item) => item.mark).length;
  const platformTotal = new Set(items.map((item) => item.platform)).size;

  const verifyPassword = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError("");

    const response = await fetch("/api/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin", password }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setAuthError(translateAdminError(data.error, language) || t.verifyError);
      return;
    }

    sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "true");
    setVerified(true);
  };

  const openAddModal = () => {
    setFormData(emptyForm);
    setSubmitSuccess(false);
    setStatusMessage("");
    setShowModal(true);
  };

  const openEditModal = (item: MediaItem) => {
    setFormData({
      id: item.id,
      mark: item.mark,
      platform: item.platform,
      mediaName: item.mediaName,
      title: item.title,
      url: item.url,
      hashtags: item.hashtags,
    });
    setSubmitSuccess(false);
    setStatusMessage("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setShowModal(false);
    setSubmitSuccess(false);
    setFormData(emptyForm);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    setStatusMessage("");

    if (isUrlDuplicate) {
      setStatusMessage(t.urlExists);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      action: formData.id ? "updateRow" : "addRow",
      sheetGID: "0",
      data: {
        id: formData.id || undefined,
        mark: formData.mark,
        platform: formData.platform,
        media: formData.mediaName,
        title: formData.title,
        url: formData.url,
        hashtag: formData.hashtags,
        hashtags: formData.hashtags,
      },
    };

    try {
      const response = await fetch("/api/admin/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as AdminSheetResponse;

      if (!response.ok || result.response?.ok === false) {
        const error = result.error || result.response?.error;
        setStatusMessage(translateAdminError(error, language) || t.submitError);
        return;
      }

      setSubmitSuccess(true);
      setStatusMessage(t.saved);
      await loadMedia(true);

      window.setTimeout(() => {
        setSubmitSuccess(false);
        setShowModal(false);
        setFormData(emptyForm);
      }, 900);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteItem = async (item: MediaItem) => {
    const confirmed = window.confirm(t.confirmDelete);
    if (!confirmed) return;

    const previousItems = items;
    setStatusMessage("");
    setItems((current) => current.filter((entry) => entry.id !== item.id));

    const response = await fetch("/api/admin/sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "deleteRow",
        sheetGID: "0",
        data: { id: item.id },
      }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as AdminSheetResponse;
      setItems(previousItems);
      setStatusMessage(translateAdminError(result.error, language) || t.deleteError);
      return;
    }

    setStatusMessage(t.deleted);
    await loadMedia(true);
  };

  if (!verified) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8efe9] px-5 text-[#2a1114]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#ead3cc] via-[#8d2334] to-[#2a1114]" />
        <div className="pointer-events-none absolute left-1/2 top-[-18rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[#ead3cc]/50 blur-3xl" />

        <form
          onSubmit={verifyPassword}
          className="relative z-10 w-full max-w-md rounded-[32px] border border-white/70 bg-[#fffaf6]/90 p-8 shadow-[0_34px_100px_rgba(111,29,44,0.18)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#8d2334]">
              {t.adminAccess}
            </p>
            <LanguageToggle language={language} onChange={changeLanguage} />
          </div>

          <div className="mt-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#7c6864]">
              FILM X ARMANI
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-wide">
              {t.mediaManagement}
            </h1>
          </div>

          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setAuthError("");
            }}
            placeholder={t.passwordPlaceholder}
            className={`mt-8 h-13 w-full rounded-2xl border bg-white/85 px-5 text-center font-mono text-sm tracking-[0.28em] outline-none transition ${
              authError
                ? "border-[#8d2334] ring-4 ring-[#8d2334]/10"
                : "border-[#d8b3ad] focus:border-[#8d2334]"
            }`}
          />

          {authError ? (
            <p className="mt-3 text-center text-xs font-semibold text-[#8d2334]">
              {authError}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-6 h-12 w-full rounded-2xl bg-[#2a1114] text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_18px_40px_rgba(42,17,20,0.22)] transition hover:bg-[#6f1d2c] active:scale-[0.99]"
          >
            {t.enterAdmin}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8efe9] pb-16 text-[#2a1114]">
      <div className="sticky top-0 z-30 border-b border-[#ead3cc] bg-[#f8efe9]/92 backdrop-blur-xl">
        <div className="h-1 bg-gradient-to-r from-[#ead3cc] via-[#8d2334] to-[#2a1114]" />
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="text-xs font-semibold text-[#7c6864] transition hover:text-[#2a1114]"
            >
              {t.backHome}
            </button>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#d8b3ad] bg-white text-xs font-bold text-[#8d2334]">
                DB
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-wide sm:text-2xl">
                  {t.databaseManagement}
                </h1>
                <p className="text-xs text-[#7c6864]">{t.databaseDescription}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LanguageToggle language={language} onChange={changeLanguage} />
            <button
              type="button"
              onClick={() => loadMedia()}
              className="h-10 rounded-2xl border border-[#d8b3ad] bg-white px-4 text-xs font-bold uppercase tracking-[0.14em] text-[#6f1d2c] transition hover:border-[#8d2334]"
            >
              {t.refresh}
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="h-10 rounded-2xl bg-[#2a1114] px-5 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[0_16px_40px_rgba(42,17,20,0.18)] transition hover:bg-[#6f1d2c]"
            >
              {t.addMedia}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label={t.totalRecords} value={formatNumber(items.length)} />
          <StatCard
            label={t.importantRecords}
            value={formatNumber(totalMarked)}
            accent
          />
          <StatCard
            label={t.platformCount}
            value={`${formatNumber(platformTotal)} ${t.platformUnit}`}
          />
        </div>

        <section className="mt-6 rounded-[28px] border border-white/70 bg-[#fffaf6]/88 p-4 shadow-[0_20px_70px_rgba(111,29,44,0.10)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8d2334]">
                Search
              </span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t.searchPlaceholder}
                className="h-12 w-full rounded-2xl border border-[#d8b3ad] bg-white pl-20 pr-4 text-sm outline-none transition focus:border-[#8d2334]"
              />
            </div>

            <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-[#ead3cc] bg-[#f8efe9]/70 p-1">
              {platforms.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setActivePlatform(platform)}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold transition ${
                    activePlatform === platform
                      ? "bg-white text-[#2a1114] shadow-sm"
                      : "text-[#7c6864] hover:text-[#2a1114]"
                  }`}
                >
                  <span>{platform === "All" ? t.all : platformShortName(platform)}</span>
                  <span className="tabular-nums text-[#8d2334]">
                    {platformCounts[platform] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {statusMessage ? (
            <div className="mt-4 rounded-2xl border border-[#d8b3ad] bg-white px-4 py-3 text-sm font-semibold text-[#8d2334]">
              {statusMessage}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#ead3cc] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-[#fff4f1] text-[10px] font-bold uppercase tracking-[0.16em] text-[#8d2334]">
                  <tr>
                    <th className="w-16 px-4 py-3 text-center">{t.no}</th>
                    <th className="w-24 px-4 py-3 text-center">{t.mark}</th>
                    <th className="w-36 px-4 py-3">{t.platform}</th>
                    <th className="px-4 py-3">{t.media}</th>
                    <th className="min-w-[280px] px-4 py-3">URL</th>
                    <th className="min-w-[210px] px-4 py-3">{t.hashtags}</th>
                    <th className="w-28 px-4 py-3 text-center">{t.manage}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ead3cc]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-[#7c6864]">
                        {t.loading}
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-[#7c6864]">
                        {t.emptyState}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, index) => (
                      <tr
                        key={`${item.id}-${index}`}
                        className="transition hover:bg-[#fffaf6]"
                      >
                        <td className="px-4 py-4 text-center text-xs tabular-nums text-[#7c6864]">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {item.mark ? (
                            <span className="inline-flex h-7 items-center rounded-full bg-[#8d2334] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                              {t.focus}
                            </span>
                          ) : (
                            <span className="text-[#c7aaa4]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#ead3cc] bg-[#fff4f1] text-[10px] font-bold text-[#8d2334]">
                              {platformShortName(item.platform)}
                            </span>
                            <span className="text-xs font-semibold text-[#7c6864]">
                              {item.platform}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="max-w-[240px] truncate font-semibold">
                            {item.mediaName || "-"}
                          </p>
                          <p className="mt-1 max-w-[260px] truncate text-xs text-[#7c6864]">
                            {item.title || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block max-w-[360px] truncate text-xs font-medium text-[#7c6864] transition hover:text-[#8d2334] hover:underline"
                          >
                            {item.url || "-"}
                          </a>
                        </td>
                        <td className="px-4 py-4">
                          <p className="line-clamp-2 max-w-[260px] whitespace-pre-wrap text-xs leading-relaxed text-[#7c6864]">
                            {item.hashtags || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d8b3ad] bg-white text-xs font-bold text-[#6f1d2c] transition hover:border-[#8d2334] hover:bg-[#fff4f1]"
                              aria-label={t.edit}
                              title={t.edit}
                            >
                              E
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(item)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ead3cc] bg-white text-xs font-bold text-[#7c6864] transition hover:border-[#8d2334] hover:bg-[#8d2334] hover:text-white"
                              aria-label={t.delete}
                              title={t.delete}
                            >
                              D
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
          <button
            type="button"
            className="absolute inset-0 bg-[#2a1114]/45 backdrop-blur-md"
            onClick={closeModal}
            aria-label={t.close}
          />
          <div className="relative max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-[34px] border border-white/75 bg-[#fffaf6] shadow-[0_34px_130px_rgba(42,17,20,0.32)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#ead3cc] via-[#8d2334] to-[#2a1114]" />

            <div className="flex items-start justify-between gap-4 border-b border-[#ead3cc] bg-[linear-gradient(135deg,#fffaf6_0%,#f5ded9_100%)] px-5 py-5 sm:px-7">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#8d2334]">
                    {formData.id ? t.editMode : t.addMode}
                  </span>
                  {formData.mark ? (
                    <span className="rounded-full bg-[#8d2334] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                      {t.focus}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-wide sm:text-3xl">
                  {formData.id ? t.editMedia : t.addMedia}
                </h2>
                <p className="mt-1 text-xs text-[#7c6864]">
                  {t.databaseDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-sm font-bold text-[#7c6864] transition hover:text-[#2a1114]"
                aria-label={t.close}
              >
                X
              </button>
            </div>

            {submitSuccess ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#8d2334] text-sm font-bold text-white">
                  OK
                </div>
                <h3 className="mt-5 text-xl font-semibold">{t.submitSuccess}</h3>
                <p className="mt-2 text-sm text-[#7c6864]">{t.submitSuccessDetail}</p>
              </div>
            ) : (
              <form
                onSubmit={submitForm}
                className="grid max-h-[calc(94vh-118px)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]"
              >
                <div className="space-y-5 px-5 py-5 sm:px-7">
                  <section className="rounded-[26px] border border-[#ead3cc] bg-white/72 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#6f1d2c]">
                          {t.focusMedia}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#7c6864]">
                          {t.focusMediaHint}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={formData.mark}
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            mark: !current.mark,
                          }))
                        }
                        className={`relative h-8 w-16 shrink-0 rounded-full p-1 transition ${
                          formData.mark ? "bg-[#8d2334]" : "bg-[#ead3cc]"
                        }`}
                      >
                        <span
                          className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${
                            formData.mark ? "translate-x-8" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="mt-5">
                      <label className="admin-label">{t.platform}</label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {platforms
                          .filter((platform) => platform !== "All")
                          .map((platform) => (
                            <button
                              key={platform}
                              type="button"
                              onClick={() =>
                                setFormData((current) => ({
                                  ...current,
                                  platform: normalizePlatform(platform),
                                }))
                              }
                              className={`flex h-11 items-center justify-center gap-2 rounded-2xl border text-xs font-bold transition ${
                                formData.platform === platform
                                  ? "border-[#8d2334] bg-[#8d2334] text-white shadow-[0_14px_30px_rgba(141,35,52,0.22)]"
                                  : "border-[#ead3cc] bg-white text-[#7c6864] hover:border-[#d8b3ad] hover:text-[#2a1114]"
                              }`}
                            >
                              <span>{platformShortName(platform)}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[26px] border border-[#ead3cc] bg-white/72 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="relative">
                        <label className="admin-label">{t.mediaName}</label>
                        <input
                          required
                          value={formData.mediaName}
                          onChange={(event) => {
                            setFormData((current) => ({
                              ...current,
                              mediaName: event.target.value,
                            }));
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() =>
                            window.setTimeout(() => setShowSuggestions(false), 160)
                          }
                          placeholder={t.mediaNamePlaceholder}
                          className="admin-field"
                        />
                        {showSuggestions && mediaSuggestions.length > 0 ? (
                          <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-2xl border border-[#ead3cc] bg-white shadow-[0_18px_50px_rgba(42,17,20,0.14)]">
                            {mediaSuggestions.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setFormData((current) => ({
                                    ...current,
                                    mediaName: name,
                                  }));
                                  setShowSuggestions(false);
                                }}
                                className="block w-full border-b border-[#ead3cc]/70 px-4 py-2.5 text-left text-sm text-[#2a1114] last:border-b-0 hover:bg-[#fff4f1]"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="admin-label">{t.title}</label>
                        <input
                          value={formData.title}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder={t.titlePlaceholder}
                          className="admin-field"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="admin-label">URL</label>
                      <input
                        required
                        type="url"
                        value={formData.url}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            url: event.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className={`admin-field ${
                          isUrlDuplicate
                            ? "border-[#8d2334] ring-4 ring-[#8d2334]/10"
                            : ""
                        }`}
                      />
                      {isUrlDuplicate ? (
                        <p className="mt-2 text-xs font-bold text-[#8d2334]">
                          {t.duplicateUrl}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <label className="admin-label">{t.hashtags}</label>
                      <textarea
                        value={formData.hashtags}
                        onChange={(event) =>
                          setFormData((current) => ({
                            ...current,
                            hashtags: event.target.value,
                          }))
                        }
                        rows={4}
                        placeholder="#FilmXSiBloom"
                        className="admin-field min-h-32 resize-none py-3 leading-relaxed"
                      />
                    </div>
                  </section>

                  {statusMessage ? (
                    <p className="rounded-2xl border border-[#ead3cc] bg-white px-4 py-3 text-sm font-semibold text-[#8d2334]">
                      {statusMessage}
                    </p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 border-t border-[#ead3cc] pt-5 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="h-12 rounded-2xl border border-[#d8b3ad] bg-white px-6 text-sm font-bold uppercase tracking-[0.14em] text-[#6f1d2c] transition hover:border-[#8d2334]"
                    >
                      {t.close}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || isUrlDuplicate}
                      className="h-12 rounded-2xl bg-[#2a1114] px-7 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_18px_45px_rgba(42,17,20,0.18)] transition hover:bg-[#6f1d2c] disabled:cursor-not-allowed disabled:bg-[#c7aaa4]"
                    >
                      {isSubmitting ? t.saving : t.saveMedia}
                    </button>
                  </div>
                </div>

                <aside className="border-t border-[#ead3cc] bg-[#f8efe9]/78 p-5 lg:border-l lg:border-t-0">
                  <div className="sticky top-5 rounded-[28px] border border-white/80 bg-white/72 p-5 shadow-[0_20px_60px_rgba(111,29,44,0.10)]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8d2334]">
                      Preview
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8d2334] text-xs font-bold text-white">
                        {platformShortName(formData.platform)}
                      </span>
                      <span className="rounded-full border border-[#ead3cc] bg-[#fff4f1] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f1d2c]">
                        {formData.mark ? t.focus : t.platform}
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c6864]">
                          {t.mediaName}
                        </p>
                        <p className="mt-1 min-h-6 break-words text-lg font-semibold text-[#2a1114]">
                          {formData.mediaName || t.mediaNamePlaceholder}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c6864]">
                          {t.title}
                        </p>
                        <p className="mt-1 min-h-5 break-words text-sm leading-relaxed text-[#2a1114]">
                          {formData.title || t.titlePlaceholder}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c6864]">
                          URL
                        </p>
                        <p className="mt-1 line-clamp-2 break-all text-xs leading-relaxed text-[#7c6864]">
                          {formData.url || "https://..."}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c6864]">
                          {t.hashtags}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-[#ead3cc] bg-[#fffaf6] p-3 text-xs leading-relaxed text-[#6f1d2c]">
                          {formData.hashtags || officialHashtags.join("\n")}
                        </p>
                      </div>
                    </div>
                  </div>
                </aside>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

const adminText: Record<
  Language,
  {
    addMedia: string;
    addMode: string;
    adminAccess: string;
    all: string;
    backHome: string;
    close: string;
    confirmDelete: string;
    databaseDescription: string;
    databaseManagement: string;
    delete: string;
    deleted: string;
    deleteError: string;
    duplicateUrl: string;
    edit: string;
    editMedia: string;
    editMode: string;
    emptyState: string;
    enterAdmin: string;
    focus: string;
    focusMedia: string;
    focusMediaHint: string;
    hashtags: string;
    importantRecords: string;
    loading: string;
    loadError: string;
    manage: string;
    mark: string;
    media: string;
    mediaManagement: string;
    mediaName: string;
    mediaNamePlaceholder: string;
    no: string;
    passwordPlaceholder: string;
    platform: string;
    platformCount: string;
    platformUnit: string;
    refresh: string;
    saveMedia: string;
    saved: string;
    saving: string;
    searchPlaceholder: string;
    submitError: string;
    submitSuccess: string;
    submitSuccessDetail: string;
    title: string;
    titlePlaceholder: string;
    totalRecords: string;
    urlExists: string;
    verifyError: string;
  }
> = {
  th: {
    addMedia: "เพิ่มรายการสื่อ",
    addMode: "เพิ่มข้อมูล",
    adminAccess: "Admin Access",
    all: "ทั้งหมด",
    backHome: "กลับหน้าหลัก",
    close: "ปิด",
    confirmDelete: "ต้องการลบรายการสื่อนี้ใช่ไหม?",
    databaseDescription: "จัดการรายการสื่อของแคมเปญและซิงก์กับ Google Sheets",
    databaseManagement: "Database Management",
    delete: "ลบ",
    deleted: "ลบรายการแล้ว",
    deleteError: "ไม่สามารถลบข้อมูลได้",
    duplicateUrl: "URL นี้มีอยู่ในระบบแล้ว",
    edit: "แก้ไข",
    editMedia: "แก้ไขรายการสื่อ",
    editMode: "แก้ไขข้อมูล",
    emptyState: "ไม่พบรายการสื่อที่ตรงกับการค้นหา",
    enterAdmin: "เข้าสู่ระบบ",
    focus: "สำคัญ",
    focusMedia: "สื่อสำคัญ",
    focusMediaHint: "ทำเครื่องหมายเพื่อเน้นรายการนี้ในระบบ",
    hashtags: "แฮชแท็ก",
    importantRecords: "สื่อสำคัญ",
    loading: "กำลังโหลดข้อมูล...",
    loadError: "ไม่สามารถโหลดข้อมูลจาก Google Sheet ได้",
    manage: "จัดการ",
    mark: "สถานะ",
    media: "สื่อ",
    mediaManagement: "จัดการรายการสื่อ",
    mediaName: "ชื่อสื่อ",
    mediaNamePlaceholder: "เช่น Vogue Thailand",
    no: "ลำดับ",
    passwordPlaceholder: "รหัสผ่าน",
    platform: "แพลตฟอร์ม",
    platformCount: "จำนวนแพลตฟอร์ม",
    platformUnit: "แพลตฟอร์ม",
    refresh: "รีเฟรช",
    saveMedia: "บันทึกรายการสื่อ",
    saved: "บันทึกข้อมูลสำเร็จ",
    saving: "กำลังบันทึก...",
    searchPlaceholder: "ค้นหาชื่อสื่อ, หัวข้อ, URL หรือแฮชแท็ก",
    submitError: "ไม่สามารถบันทึกข้อมูลได้",
    submitSuccess: "บันทึกสำเร็จ",
    submitSuccessDetail: "ข้อมูลถูกส่งเข้า Google Sheets แล้ว",
    title: "หัวข้อ",
    titlePlaceholder: "เช่น Campaign Launch Post",
    totalRecords: "รายการทั้งหมด",
    urlExists: "URL นี้มีอยู่แล้ว",
    verifyError: "ไม่สามารถตรวจสอบรหัสผ่านผู้ดูแลได้",
  },
  en: {
    addMedia: "Add Media",
    addMode: "New Record",
    adminAccess: "Admin Access",
    all: "All",
    backHome: "Back Home",
    close: "Close",
    confirmDelete: "Delete this media record?",
    databaseDescription: "Manage campaign media records and sync with Google Sheets.",
    databaseManagement: "Database Management",
    delete: "Delete",
    deleted: "Record deleted.",
    deleteError: "Unable to delete data.",
    duplicateUrl: "This URL already exists.",
    edit: "Edit",
    editMedia: "Edit Media",
    editMode: "Edit Record",
    emptyState: "No media records match your search.",
    enterAdmin: "Enter Admin",
    focus: "Focus",
    focusMedia: "Focus media",
    focusMediaHint: "Mark this record as an important target.",
    hashtags: "Hashtags",
    importantRecords: "Important Media",
    loading: "Loading data...",
    loadError: "Unable to load Google Sheet data.",
    manage: "Manage",
    mark: "Mark",
    media: "Media",
    mediaManagement: "Media Management",
    mediaName: "Media name",
    mediaNamePlaceholder: "e.g. Vogue Thailand",
    no: "No.",
    passwordPlaceholder: "Password",
    platform: "Platform",
    platformCount: "Platforms Count",
    platformUnit: "platforms",
    refresh: "Refresh",
    saveMedia: "Save Media",
    saved: "Saved successfully.",
    saving: "Saving...",
    searchPlaceholder: "Search media, title, URL, or hashtag",
    submitError: "Unable to save data.",
    submitSuccess: "Saved",
    submitSuccessDetail: "The record has been sent to Google Sheets.",
    title: "Title",
    titlePlaceholder: "e.g. Campaign Launch Post",
    totalRecords: "Total Records",
    urlExists: "This URL already exists.",
    verifyError: "Unable to verify admin password.",
  },
};

function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-full border border-[#d8b3ad]/35 bg-[#f8efe9] p-0.5">
      {(["th", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
            language === option
              ? "bg-white text-[#2a1114] shadow-sm"
              : "text-[#7c6864]/70 hover:text-[#2a1114]"
          }`}
          aria-pressed={language === option}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-[#fffaf6]/88 p-5 shadow-[0_18px_50px_rgba(111,29,44,0.08)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7c6864]">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          accent ? "text-[#8d2334]" : "text-[#2a1114]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function platformShortName(platform: (typeof platforms)[number] | Platform) {
  if (platform === "All") return "All";
  if (platform === "Instagram") return "IG";
  if (platform === "Facebook") return "FB";
  if (platform === "TikTok") return "TT";
  if (platform === "YouTube") return "YT";
  return "X";
}

function translateAdminError(error: string | undefined, language: Language) {
  if (!error) return "";
  if (language === "en") return error;

  if (error === "Incorrect password") return "รหัสผ่านไม่ถูกต้อง";
  if (error === "Invalid request body") return "รูปแบบคำขอไม่ถูกต้อง";
  if (error === "Row not found") return "ไม่พบแถวข้อมูลนี้ใน Google Sheet";
  if (error === "Missing id") return "ไม่พบรหัสรายการ";
  if (error === "Sheet not found") return "ไม่พบชีต media";
  if (error === "Unknown action") return "คำสั่งไม่ถูกต้อง";
  if (error === "Failed to send request to Google Apps Script") {
    return "ไม่สามารถส่งคำขอไปยัง Google Apps Script ได้";
  }
  if (error.includes("Missing VITE_ADMIN_PASSWORD")) {
    return "ยังไม่ได้ตั้งค่า VITE_ADMIN_PASSWORD ใน .env";
  }
  if (error.includes("Missing VITE_GAS_URL")) {
    return "ยังไม่ได้ตั้งค่า VITE_GAS_URL ใน .env";
  }
  if (error.includes("denied")) {
    return "Google Apps Script ปฏิเสธคำขอ กรุณาตรวจสิทธิ์ Web App";
  }

  return error;
}

function normalizeUrl(url: string) {
  return url.trim().toLowerCase().replace(/\/$/, "");
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}
