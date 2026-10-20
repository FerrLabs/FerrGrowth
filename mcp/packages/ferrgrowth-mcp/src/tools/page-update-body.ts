import type { UpdatePageInput } from './page-update-schema.js';

export function buildUpdatePageBody({
  new_slug,
  blocks,
  ...rest
}: UpdatePageInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (new_slug !== undefined) body.slug = new_slug;
  if (blocks !== undefined) {
    body.blocks = blocks.map((block) => ({ ...block, id: block.id ?? crypto.randomUUID() }));
  }
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) body[key] = value;
  }
  return body;
}
