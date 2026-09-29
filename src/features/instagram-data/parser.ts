import JSZip from "jszip";

import { normalizeRelationshipData } from "./compare";
import type { InstagramAccount, InstagramRelationshipData } from "./types";

type PartialRelationshipData = Partial<InstagramRelationshipData>;

type RawEntry = {
  href?: unknown;
  value?: unknown;
  timestamp?: unknown;
};

export type ImportProgress = {
  stage: "opening" | "reading" | "finalizing";
  current: number;
  total: number;
  label: string;
};

type ImportProgressHandler = (progress: ImportProgress) => void;

type TextTask = {
  name: string;
  read: () => Promise<string>;
};

const fileBaseName = (name: string) => name.split("/").pop()?.toLowerCase() ?? "";

const classifyFile = (name: string): "followers" | "following" | null => {
  const base = fileBaseName(name);
  if (/^followers(?:_\d+)?\.(json|html?)$/.test(base)) return "followers";
  if (/^following(?:_\d+)?\.(json|html?)$/.test(base)) return "following";
  return null;
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

const fromRawEntry = (entry: RawEntry): InstagramAccount | null => {
  const value = typeof entry.value === "string" ? entry.value : "";
  const href = typeof entry.href === "string" ? entry.href : undefined;
  const username = sanitizeUsername(value || href || "");
  if (!username) return null;

  return {
    username,
    href,
    timestamp: typeof entry.timestamp === "number" ? entry.timestamp : undefined,
  };
};

const collectStringListAccounts = (value: unknown): InstagramAccount[] => {
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
        const account = fromRawEntry(item as RawEntry);
        if (account) accounts.push(account);
      }
      return;
    }

    Object.values(record).forEach(walk);
  };

  walk(value);
  return accounts;
};

const parseJson = (name: string, text: string): PartialRelationshipData => {
  const parsed = JSON.parse(text) as unknown;
  const classified = classifyFile(name);

  if (classified) {
    return { [classified]: collectStringListAccounts(parsed) };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const result: PartialRelationshipData = {};

    if (record.relationships_following) {
      result.following = collectStringListAccounts(record.relationships_following);
    }
    if (record.relationships_followers) {
      result.followers = collectStringListAccounts(record.relationships_followers);
    }
    return result;
  }

  return {};
};

const parseHtml = (name: string, text: string): PartialRelationshipData => {
  const classified = classifyFile(name);
  if (!classified) return {};

  const document = new DOMParser().parseFromString(text, "text/html");
  const accounts: InstagramAccount[] = [];

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href") || undefined;
    const username = sanitizeUsername(anchor.textContent || href || "");
    if (!username) return;
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

const parseNamedText = (name: string, text: string): PartialRelationshipData => {
  if (name.toLowerCase().endsWith(".json")) return parseJson(name, text);
  if (/\.html?$/i.test(name)) return parseHtml(name, text);
  return {};
};

const buildTasks = async (
  files: File[],
  onProgress?: ImportProgressHandler,
): Promise<TextTask[]> => {
  const tasks: TextTask[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    onProgress?.({
      stage: "opening",
      current: index + 1,
      total: files.length,
      label: "Opening " + file.name,
    });

    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !classifyFile(entry.name)) continue;
        tasks.push({
          name: entry.name,
          read: () => entry.async("text"),
        });
      }
      continue;
    }

    tasks.push({
      name: file.name,
      read: () => file.text(),
    });
  }

  return tasks;
};

export async function parseInstagramFiles(
  files: File[] | FileList,
  onProgress?: ImportProgressHandler,
): Promise<InstagramRelationshipData> {
  const selectedFiles = Array.from(files);
  const tasks = await buildTasks(selectedFiles, onProgress);
  const result: InstagramRelationshipData = { followers: [], following: [] };

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];

    onProgress?.({
      stage: "reading",
      current: index + 1,
      total: tasks.length,
      label: "Reading " + fileBaseName(task.name),
    });

    merge(result, parseNamedText(task.name, await task.read()));
  }

  onProgress?.({
    stage: "finalizing",
    current: tasks.length,
    total: tasks.length,
    label: "Comparing followers and following",
  });

  const normalized = normalizeRelationshipData(result);
  if (normalized.followers.length === 0 && normalized.following.length === 0) {
    throw new Error(
      "No followers/following data was found. Import the Instagram export ZIP or its followers/following JSON/HTML files.",
    );
  }

  return normalized;
}
