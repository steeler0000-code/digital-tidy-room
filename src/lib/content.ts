import { getCollection, type CollectionEntry } from 'astro:content';
export function isPublished<T extends { data: { draft: boolean; publishedAt?: Date } }>(entry: T) {
  if (entry.data.draft || !entry.data.publishedAt) return false;
  const todayKst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return entry.data.publishedAt.toISOString().slice(0, 10) <= todayKst;
}
export function contentDate(entry: { data: { publishedAt?: Date; updatedAt?: Date } }) { return entry.data.updatedAt || entry.data.publishedAt || new Date(0); }
export function sortByRecent<T extends { data: { publishedAt?: Date; updatedAt?: Date } }>(entries: T[]) { return [...entries].sort((a, b) => contentDate(b).getTime() - contentDate(a).getTime()); }
export async function getPublishedGuides() { return sortByRecent((await getCollection('guides')).filter(isPublished)); }
export async function getPublishedBriefings() { return sortByRecent((await getCollection('briefings')).filter(isPublished)); }
export type AnyContentEntry = CollectionEntry<'guides'> | CollectionEntry<'briefings'>;
