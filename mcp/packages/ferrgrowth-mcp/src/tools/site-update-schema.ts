import { z } from 'zod';

const CUSTOM_CODE_MAX_BYTES = 50_000;

const maxBytes = (value: string): boolean =>
  new TextEncoder().encode(value).length <= CUSTOM_CODE_MAX_BYTES;

const fontSchema = z.object({
  family: z.string().min(1),
  url: z.string().optional(),
  catalog: z.record(z.string(), z.unknown()).optional(),
  faces: z.array(z.record(z.string(), z.unknown())).optional(),
});

const colorsSchema = z.object({
  brand: z.string(),
  accent: z.string(),
  bg: z.string(),
  surface: z.string(),
  text: z.string(),
  muted: z.string(),
});

export const themeSchema = z
  .object({
    colors: colorsSchema,
    spacing: z.object({ sm: z.number(), md: z.number(), lg: z.number(), xl: z.number() }),
    darkMode: z.string().optional(),
    dark: colorsSchema.partial().optional(),
    fonts: z.object({ heading: fontSchema.optional(), body: fontSchema.optional() }).optional(),
  })
  .describe('Site theme. Replaces the whole theme: send colors and spacing every time.');

export const updateSiteFields = {
  theme: themeSchema.optional(),
  custom_css: z
    .string()
    .refine(maxBytes, 'max 50000 bytes')
    .nullable()
    .optional()
    .describe('Site-wide CSS, max 50000 bytes. null clears.'),
  head_html: z
    .string()
    .refine(maxBytes, 'max 50000 bytes')
    .nullable()
    .optional()
    .describe('Raw HTML injected in every page head, max 50000 bytes. null clears.'),
};
