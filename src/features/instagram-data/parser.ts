import JSZip from "jszip";

import { normalizeRelationshipData } from "./compare";
import type { InstagramAccount, InstagramRelationshipData } from "./types";

type PartialRelationshipData = Partial<InstagramRelationshipData>;

type RawEntry = {
  href?: unknown;
  value?: unknown;
  timestamp?: unknown;
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

const parseZip = async (file: File): Promise<InstagramRelationshipData> => {
  const zip = await JSZip.loadAsync(file);
  const result: InstagramRelationshipData = { followers: [], following: [] };

  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !classifyFile(entry.name)) continue;
    const text = await entry.async("text");
    merge(result, parseNamedText(entry.name, text));
  }

  return result;
};

export async function parseInstagramFiles(
  files: File[] | FileList,
): Promise<InstagramRelationshipData> {
  const result: InstagramRelationshipData = { followers: [], following: [] };

  for (const file of Array.from(files)) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      merge(result, await parseZip(file));
      continue;
    }

    const text = await file.text();
    merge(result, parseNamedText(file.name, text));
  }

  const normalized = normalizeRelationshipData(result);
  if (normalized.followers.length === 0 && normalized.following.length === 0) {
    throw new Error(
      "No followers/following data was found. Import the Instagram export ZIP or its followers/following JSON/HTML files.",
    );
  }

  return normalized;
}
