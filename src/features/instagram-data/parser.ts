import JSZip from "jszip";

import { normalizeRelationshipData } from "./compare";
import type {
  ImportDiagnostics,
  InstagramAccount,
  InstagramRelationshipData,
} from "./types";

type PartialRelationshipData = Partial<InstagramRelationshipData>;

type RawEntry = {
  href?: unknown;
  value?: unknown;
  timestamp?: unknown;
  username?: unknown;
};

export type ImportProgress = {
  stage: "opening" | "reading" | "finalizing";
  current: number;
  total: number;
  label: string;
};

export type DetailedImportResult = {
  data: InstagramRelationshipData;
  diagnostics: ImportDiagnostics;
};

type ImportProgressHandler = (progress: ImportProgress) => void;

type TextTask = {
  name: string;
  read: () => Promise<string>;
};

const fileBaseName = (name: string) => name.split("/").pop()?.toLowerCase() ?? "";

const classifyFile = (name: string): "followers" | "following" | null => {
  const base = fileBaseName(name);
  if (/^followers?(?:[_-]\d+)?\.(json|html?)$/.test(base)) return "followers";
  if (/^following(?:[_-]\d+)?\.(json|html?)$/.test(base)) return "following";
  if (/^following_accounts?(?:[_-]\d+)?\.(json|html?)$/.test(base)) return "following";
  return null;
};

const isRelationshipCandidate = (name: string) => {
  const lower = name.toLowerCase();
  return Boolean(classifyFile(name)) || lower.includes("followers_and_following");
};

const sanitizeUsername = (value: string) => {
  const username = value
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .split(/[/?#]/)[0]
    .trim();

  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return "";
  return username;
};

const fromRawEntry = (
  entry: RawEntry,
  diagnostics: ImportDiagnostics,
): InstagramAccount | null => {
  const value =
    typeof entry.value === "string"
      ? entry.value
      : typeof entry.username === "string"
        ? entry.username
        : "";
  const href = typeof entry.href === "string" ? entry.href : undefined;
  const candidate = value || href || "";
  const username = sanitizeUsername(candidate);

  if (!username) {
    if (candidate) diagnostics.invalidEntriesIgnored += 1;
    return null;
  }

  return {
    username,
    href,
    timestamp: typeof entry.timestamp === "number" ? entry.timestamp : undefined,
  };
};

const collectAccounts = (
  value: unknown,
  diagnostics: ImportDiagnostics,
): InstagramAccount[] => {
  const accounts: InstagramAccount[] = [];

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const list = record.string_list_data;

    if (Array.isArray(list)) {
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const account = fromRawEntry(item as RawEntry, diagnostics);
        if (account) accounts.push(account);
      }
      return;
    }

    const direct = fromRawEntry(record as RawEntry, diagnostics);
    if (direct) {
      accounts.push(direct);
      return;
    }

    Object.values(record).forEach(walk);
  };

  walk(value);
  return accounts;
};

const parseUnclassifiedJson = (
  parsed: unknown,
  diagnostics: ImportDiagnostics,
): PartialRelationshipData => {
  const result: PartialRelationshipData = {};

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes("relationships_following") || normalizedKey === "following") {
        result.following = [...(result.following ?? []), ...collectAccounts(value, diagnostics)];
        continue;
      }
      if (normalizedKey.includes("relationships_followers") || /^followers?$/.test(normalizedKey)) {
        result.followers = [...(result.followers ?? []), ...collectAccounts(value, diagnostics)];
        continue;
      }
      walk(value);
    }
  };

  walk(parsed);
  return result;
};

const parseJson = (
  name: string,
  text: string,
  diagnostics: ImportDiagnostics,
): PartialRelationshipData => {
  const parsed = JSON.parse(text) as unknown;
  const classified = classifyFile(name);

  if (classified) {
    return { [classified]: collectAccounts(parsed, diagnostics) };
  }

  return parseUnclassifiedJson(parsed, diagnostics);
};

const parseHtml = (
  name: string,
  text: string,
  diagnostics: ImportDiagnostics,
): PartialRelationshipData => {
  const classified = classifyFile(name);
  if (!classified) return {};

  const document = new DOMParser().parseFromString(text, "text/html");
  const accounts: InstagramAccount[] = [];

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") || undefined;
    const candidate = anchor.textContent || href || "";
    const username = sanitizeUsername(candidate);
    if (!username) {
      if (candidate.trim()) diagnostics.invalidEntriesIgnored += 1;
      return;
    }
    accounts.push({ username, href });
  });

  return { [classified]: accounts };
};

const merge = (
  target: InstagramRelationshipData,
  partial: PartialRelationshipData,
) => {
  if (partial.followers) target.followers.push(...partial.followers);
  if (partial.following) target.following.push(...partial.following);
};

const parseNamedText = (
  name: string,
  text: string,
  diagnostics: ImportDiagnostics,
): PartialRelationshipData => {
  if (name.toLowerCase().endsWith(".json")) return parseJson(name, text, diagnostics);
  if (/\.html?$/i.test(name)) return parseHtml(name, text, diagnostics);
  return {};
};

const buildTasks = async (
  files: File[],
  diagnostics: ImportDiagnostics,
  onProgress?: ImportProgressHandler,
): Promise<TextTask[]> => {
  const tasks: TextTask[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    diagnostics.filesScanned += 1;

    onProgress?.({
      stage: "opening",
      current: index + 1,
      total: files.length,
      label: "Opening " + file.name,
    });

    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !/\.(json|html?)$/i.test(entry.name)) continue;
        diagnostics.filesScanned += 1;
        if (!isRelationshipCandidate(entry.name)) continue;
        diagnostics.relationshipFiles += 1;
        tasks.push({ name: entry.name, read: () => entry.async("text") });
      }
      continue;
    }

    if (!/\.(json|html?)$/i.test(file.name)) continue;
    diagnostics.relationshipFiles += 1;
    tasks.push({ name: file.name, read: () => file.text() });
  }

  return tasks;
};

export async function parseInstagramFilesDetailed(
  files: File[] | FileList,
  onProgress?: ImportProgressHandler,
): Promise<DetailedImportResult> {
  const diagnostics: ImportDiagnostics = {
    filesScanned: 0,
    relationshipFiles: 0,
    duplicatesIgnored: 0,
    invalidEntriesIgnored: 0,
    malformedFiles: [],
  };
  const selectedFiles = Array.from(files);
  const tasks = await buildTasks(selectedFiles, diagnostics, onProgress);
  const raw: InstagramRelationshipData = { followers: [], following: [] };

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];

    onProgress?.({
      stage: "reading",
      current: index + 1,
      total: tasks.length,
      label: "Reading " + fileBaseName(task.name),
    });

    try {
      merge(raw, parseNamedText(task.name, await task.read(), diagnostics));
    } catch {
      diagnostics.malformedFiles.push(fileBaseName(task.name));
    }
  }

  onProgress?.({
    stage: "finalizing",
    current: tasks.length,
    total: tasks.length,
    label: "Comparing followers and following",
  });

  const normalized = normalizeRelationshipData(raw);
  diagnostics.duplicatesIgnored =
    raw.followers.length + raw.following.length -
    normalized.followers.length - normalized.following.length;

  if (normalized.followers.length === 0 && normalized.following.length === 0) {
    throw new Error(
      diagnostics.malformedFiles.length
        ? "Instagram files were found, but none could be parsed. Try a fresh data export."
        : "No followers/following data was found. Import the Instagram export ZIP or its followers/following JSON/HTML files.",
    );
  }

  return { data: normalized, diagnostics };
}

export async function parseInstagramFiles(
  files: File[] | FileList,
  onProgress?: ImportProgressHandler,
): Promise<InstagramRelationshipData> {
  return (await parseInstagramFilesDetailed(files, onProgress)).data;
}
