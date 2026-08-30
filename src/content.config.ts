import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z, type RefinementCtx } from 'astro/zod';

const sourceSchema = z.object({ title: z.string(), url: z.url(), publisher: z.string().optional() });
const channelSchema = z.object({ name: z.string(), url: z.url() });
const cardSchema = z.object({
  image: z.string().regex(/^\/content\/(briefings|guides)\/[a-z0-9-]+\/slide-\d{2}\.png$/),
  title: z.string().min(2),
  description: z.string().min(40),
  alt: z.string().min(15).max(120)
});
const sharedFields = {
  title: z.string(), description: z.string(), subtitle: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/), author: z.string().default('카일루스'),
  publishedAt: z.coerce.date().optional(), updatedAt: z.coerce.date().optional(),
  scheduledAt: z.coerce.date().optional(), editorialApproved: z.boolean().default(false),
  draft: z.boolean().default(true), featured: z.boolean().default(false), summary: z.string(),
  highlights: z.array(z.string()).min(2), related: z.array(z.string()).default([]),
  sources: z.array(sourceSchema).min(1), contentTier: z.enum(['standard', 'flagship']).default('standard'),
  cards: z.array(cardSchema).length(8).default([]), externalChannels: z.array(channelSchema).default([])
};
function validatePublication(data: { draft: boolean; publishedAt?: Date }, context: RefinementCtx) {
  if (!data.draft && !data.publishedAt) context.addIssue({ code: 'custom', path: ['publishedAt'], message: '공개 문서에는 publishedAt이 필요합니다.' });
}
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({ ...sharedFields, category: z.enum(['market-signals', 'global-investing', 'etf-structure', 'company-analysis']) }).superRefine(validatePublication)
});
const briefings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/briefings' }),
  schema: z.object({
    ...sharedFields, briefingDate: z.coerce.date(), reviewedAt: z.coerce.date(),
    coverageStart: z.string().optional(), coverageEnd: z.string().optional(),
    topics: z.array(z.string()).min(1), markets: z.array(z.string()).min(1),
    originalChannels: z.array(channelSchema).default([])
  }).superRefine(validatePublication)
});
export const collections = { guides, briefings };
