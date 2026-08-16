import { getCollection, type CollectionEntry } from 'astro:content';

export function isPublished<T extends { data: { draft: boolean; publishedAt?: Date } }>(entry: T) {
  return !entry.data.draft && !!entry.data.publishedAt && entry.data.publishedAt <= new Date();
}

export function contentDate(entry: { data: { publishedAt?: Date; updatedAt?: Date } }) {
  return entry.data.updatedAt || entry.data.publishedAt || new Date(0);
}

export function sortByRecent<T extends { data: { publishedAt?: Date; updatedAt?: Date } }>(entries: T[]) {
  return [...entries].sort((a, b) => contentDate(b).getTime() - contentDate(a).getTime());
}

export async function getPublishedArticles() {
  return sortByRecent((await getCollection('articles')).filter(isPublished));
}

export async function getPublishedColumns() {
  return sortByRecent((await getCollection('columns')).filter(isPublished));
}

export type AnyContentEntry = CollectionEntry<'articles'> | CollectionEntry<'columns'>;
