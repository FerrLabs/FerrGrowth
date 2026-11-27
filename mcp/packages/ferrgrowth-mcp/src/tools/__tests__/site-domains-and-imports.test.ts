import { describe, it, expect, beforeEach } from 'vitest';
import { GROWTH, call, lastCall, mockServer, resetHarness } from './support/harness.js';

describe('ferrgrowth site domain, import, release and integration tools', () => {
  beforeEach(async () => {
    resetHarness();
    const { registerSiteTools } = await import('../sites.js');
    const { registerPageTools } = await import('../pages.js');
    const { registerReleaseTools } = await import('../releases.js');
    const { registerIntegrationTools } = await import('../integrations.js');
    registerSiteTools(mockServer);
    registerPageTools(mockServer);
    registerReleaseTools(mockServer);
    registerIntegrationTools(mockServer);
  });

  it('discover_pages posts only the origin url', async () => {
    await call('discover_pages', { site_id: 'shop', url: 'https://old.example.test' });

    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/shop/pages/discover`,
      method: 'POST',
      body: { url: 'https://old.example.test' },
    });
  });

  it('import_pages posts the selected pages', async () => {
    const pages = [{ url: 'https://old.example.test/a', slug: 'a', title: 'A' }];

    await call('import_pages', { site_id: 'shop', pages });

    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/shop/pages/import`,
      method: 'POST',
      body: { pages },
    });
  });

  it('attach_domain posts the domain', async () => {
    await call('attach_domain', { site_id: 'shop', domain: 'shop.example.test' });

    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/shop/domain`,
      method: 'POST',
      body: { domain: 'shop.example.test' },
    });
  });

  it('verify_domain posts to the verify endpoint without a body', async () => {
    await call('verify_domain', { site_id: 'shop' });

    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/shop/domain/verify`,
      method: 'POST',
      body: undefined,
    });
  });

  it('detach_domain deletes the domain and confirms in plain text', async () => {
    const result = await call('detach_domain', { site_id: 'shop' });

    expect(lastCall()).toMatchObject({ url: `${GROWTH}/sites/shop/domain`, method: 'DELETE' });
    expect(result.content[0].text).toBe('Custom domain detached from shop.');
  });

  it('get_release reads one release of the site', async () => {
    await call('get_release', { site_id: 'shop', release_id: 'r-1' });

    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/shop/releases/r-1`,
      method: 'GET',
    });
  });

  it('list_releases reads every release of the site', async () => {
    await call('list_releases', { site_id: 'shop' });

    expect(lastCall()).toMatchObject({ url: `${GROWTH}/sites/shop/releases`, method: 'GET' });
  });

  it('list_integrations reads the org integrations', async () => {
    await call('list_integrations', {});

    expect(lastCall()).toMatchObject({ url: `${GROWTH}/integrations`, method: 'GET' });
  });

  it('refuses a dot segment as site id before any request', async () => {
    await expect(call('verify_domain', { site_id: '..' })).rejects.toThrow(/Invalid path segment/);
  });
});
