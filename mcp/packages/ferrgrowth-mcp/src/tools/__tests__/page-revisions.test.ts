import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  call,
  GROWTH,
  handlers,
  lastCall,
  mockFetch,
  mockServer,
  ok,
  schemas,
} from './support/harness.js';

describe('page revision tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok([]));
    const { registerPageRevisionTools } = await import('../page-revisions.js');
    registerPageRevisionTools(mockServer);
  });

  it('list_page_revisions reads the page revisions with paging', async () => {
    await handlers.get('list_page_revisions')!({
      site_id: 'shop',
      page_slug: 'pricing',
      limit: 10,
      offset: 20,
    });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/pages/pricing/revisions?limit=10&offset=20`);
    expect(call.method).toBe('GET');
  });

  it('list_page_revisions sends no query string by default', async () => {
    await handlers.get('list_page_revisions')!({ site_id: 'shop', page_slug: 'pricing' });

    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/pages/pricing/revisions`);
  });

  it('encodes slugs and ids in the path', async () => {
    await handlers.get('get_page_revision')!({
      site_id: 'shop',
      page_slug: 'a/b',
      revision_id: 'rev 1',
    });

    expect(lastCall().url).toBe(`${GROWTH}/sites/shop/pages/a%2Fb/revisions/rev%201`);
  });

  it('restore_page_revision posts to the restore action of that revision', async () => {
    mockFetch.mockResolvedValue(ok({ slug: 'pricing' }));
    const result = await handlers.get('restore_page_revision')!({
      site_id: 'shop',
      page_slug: 'pricing',
      revision_id: 'rev-7',
    });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/pages/pricing/revisions/rev-7/restore`);
    expect(call.method).toBe('POST');
    expect(result.content[0].text).toContain('pricing');
  });

  it('rejects a limit above the API cap', () => {
    const limit = schemas.get('list_page_revisions')!.limit;
    expect(limit.safeParse(101).success).toBe(false);
    expect(limit.safeParse(100).success).toBe(true);
  });

  it('requires a revision id to restore', () => {
    const id = schemas.get('restore_page_revision')!.revision_id;
    expect(id.safeParse('').success).toBe(false);
  });
});
