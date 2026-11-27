import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlers, mockFetch, mockServer } from './support/harness.js';

describe('dot segments in path arguments', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    const { registerReleaseTools } = await import('../releases.js');
    const { registerPageTools } = await import('../pages.js');
    registerReleaseTools(mockServer);
    registerPageTools(mockServer);
  });

  it('restore_release refuses ".." as release_id', async () => {
    await expect(
      handlers.get('restore_release')!({ site_id: 'acme', release_id: '..' }),
    ).rejects.toThrow(/Invalid path segment/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('get_page refuses ".." as site_id', async () => {
    await expect(handlers.get('get_page')!({ site_id: '..', page_slug: 'home' })).rejects.toThrow(
      /Invalid path segment/,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
