import type { UpdatePageInput } from './page-update-schema.js';

export function buildUpdatePageBody({
  blocks,
  ...rest
}: UpdatePageInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (blocks !== undefined) {
    body.blocks = blocks.map((block) => ({ ...block, id: block.id ?? crypto.randomUUID() }));
  }
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) body[key] = value;
  }
  return body;
}
