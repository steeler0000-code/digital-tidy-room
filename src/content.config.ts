import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z, type RefinementCtx } from 'astro/zod';

const sourceSchema = z.object({
  title: z.string(),
  url: z.url()
});

const faqSchema = z.object({
  question: z.string(),
  answer: z.string()
});

const sharedFields = {
  title: z.string(),
  description: z.string(),
  subtitle: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  author: z.string().default('카일루스'),
  publishedAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  scheduledAt: z.coerce.date().optional(),
  editorialApproved: z.boolean().default(false),
  draft: z.boolean().default(true),
  featured: z.boolean().default(false),
  summary: z.string(),
  highlights: z.array(z.string()).min(2),
  related: z.array(z.string()).default([]),
  sources: z.array(sourceSchema).min(1),
  faq: z.array(faqSchema).default([])
};

const validatePublication = (
  data: { draft: boolean; publishedAt?: Date },
  context: RefinementCtx
) => {
  if (!data.draft && !data.publishedAt) {
    context.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: '공개 문서에는 publishedAt이 필요합니다.'
    });
  }
};

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z
    .object({
      ...sharedFields,
      category: z.enum([
        'files-folders',
        'photos-media',
        'email-web',
        'backup-accounts',
        'digital-habits'
      ])
    })
    .superRefine(validatePublication)
});

const columns = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/columns' }),
  schema: z.object(sharedFields).superRefine(validatePublication)
});

export const collections = { articles, columns };
