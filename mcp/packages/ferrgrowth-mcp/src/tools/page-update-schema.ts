import { z } from 'zod';

const CUSTOM_CODE_MAX_BYTES = 50_000;

const maxBytes = (value: string): boolean =>
  new TextEncoder().encode(value).length <= CUSTOM_CODE_MAX_BYTES;

const BLOCK_KINDS = [
  'Block kinds and key props:',
  'hero: headline, sub',
  'hero_rich: eyebrow, headline, subhead, buttons[{label, href, variant}], bgImage, overlay, align, mediaSide, imageUrl',
  'text: body',
  'cta: headline, href, label',
  'cta_section: headline, body, buttons[{label, href, variant}]',
  'button: label, href, variant, size, align, newTab',
  'form: headline, cta, form_id',
  'testimonial: quote, author, role, avatar_url',
  'faq: items[{question, answer}]',
  'pricing: tiers[{name, price_label, period, features[], cta_label, cta_href, featured}]',
  'video_embed: provider, video_id, caption',
  'image: url, alt, caption, rounded',
  'gallery: layout, columns, images[{url, alt, caption}]',
  'columns: items[{icon, title, body}]',
  'card: icon, imageUrl, eyebrow, title, body, link{label, href}',
  'card_grid: columns, items[{icon, title, body, link{label, href}}]',
  'stats: columns, animate, items[{value, suffix, label}]',
  'logos: title, logos[{url, alt}]',
  'tabs: tabs[{label, body}]',
  'accordion: allowMultiple, items[{title, body}]',
  'navbar: logoText, logoUrl, links[{label, href}], cta{label, href}, sticky',
  'footer: columns[{title, links[{label, href}]}]',
  'icon: name, size, color, align',
  'container: layout, gap, columns, align, justify, children[blocks]',
  'html: html',
  'divider, spacer: no required props',
].join('\n');

export const blockSchema = z.object({
  id: z.string().min(1).optional().describe('Block id. Generated when omitted.'),
  kind: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
});

export type BlockInput = z.infer<typeof blockSchema>;

export const updatePageFields = {
  title: z.string().min(1).max(200).optional(),
  new_slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9/-]+$/)
    .optional()
    .describe('Rename the page slug (and its URL).'),
  blocks: z
    .array(blockSchema)
    .optional()
    .describe(`Replaces the whole block list of the page.\n${BLOCK_KINDS}`),
  meta_title: z
    .string()
    .max(70)
    .nullable()
    .optional()
    .describe('SEO title, max 70 chars. null clears.'),
  meta_description: z
    .string()
    .max(320)
    .nullable()
    .optional()
    .describe('SEO description, max 320 chars. null clears.'),
  og_image_url: z.string().nullable().optional().describe('Open Graph image URL. null clears.'),
  canonical_url: z.string().nullable().optional().describe('Canonical URL. null clears.'),
  robots_noindex: z.boolean().optional().describe('true adds noindex to the page.'),
  custom_css: z
    .string()
    .refine(maxBytes, 'max 50000 bytes')
    .nullable()
    .optional()
    .describe('Page-level CSS, max 50000 bytes. null clears.'),
  head_html: z
    .string()
    .refine(maxBytes, 'max 50000 bytes')
    .nullable()
    .optional()
    .describe('Raw HTML injected in the page head, max 50000 bytes. null clears.'),
};

export type UpdatePageInput = z.infer<z.ZodObject<typeof updatePageFields>>;
