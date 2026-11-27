import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  call,
  GROWTH,
  handlers,
  lastCall,
  mockServer,
  resetHarness,
  schemas,
} from './support/harness.js';

describe('ferrgrowth write tools', () => {
  beforeEach(async () => {
    resetHarness();
    const { registerSiteTools } = await import('../sites.js');
    const { registerPageTools } = await import('../pages.js');
    const { registerFormTools } = await import('../forms.js');
    const { registerReleaseTools } = await import('../releases.js');
    registerSiteTools(mockServer);
    registerPageTools(mockServer);
    registerFormTools(mockServer);
    registerReleaseTools(mockServer);
  });

  it('negotiates the contract by date header, with no version left in the path', async () => {
    await handlers.get('create_site')!({ slug: 'shop', name: 'Shop' });

    const call = lastCall();
    expect(call.headers['x-ferrgrowth-api-version']).toBe('2026-08-04');
    expect(call.url).not.toContain('/v1/');
  });

  it('every call goes to the FerrGrowth API', async () => {
    await handlers.get('create_site')!({ slug: 'shop', name: 'Shop' });
    expect(lastCall().url.startsWith('https://api.ferrgrowth.com')).toBe(true);
    expect(lastCall().url).not.toContain('api.ferrlabs.com');
  });

  it('create_site posts the slug and name', async () => {
    await handlers.get('create_site')!({ slug: 'shop', name: 'Shop' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites`);
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({ slug: 'shop', name: 'Shop' });
  });

  it('archive_site is a DELETE on the site, despite the name', async () => {
    const result = await handlers.get('archive_site')!({ site_id: 'shop' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop`);
    expect(call.method).toBe('DELETE');
    expect(result.content[0].text).toContain('shop');
  });

  it('publish_page posts to the publish sub-resource of the page', async () => {
    await handlers.get('publish_page')!({ site_id: 'shop', page_slug: 'pricing' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/pages/pricing/publish`);
    expect(call.method).toBe('POST');
  });

  it('activate_release switches live serving on the named release', async () => {
    await handlers.get('activate_release')!({ site_id: 'shop', release_id: 'rel-7' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/releases/rel-7/activate`);
    expect(call.method).toBe('POST');
  });

  it('delete_form removes the form, not the site', async () => {
    const result = await handlers.get('delete_form')!({ site_id: 'shop', form_id: 'f1' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/forms/f1`);
    expect(call.method).toBe('DELETE');
    expect(result.content[0].text).toContain('f1');
  });

  it('detach_domain deletes the domain sub-resource rather than the site', async () => {
    await handlers.get('detach_domain')!({ site_id: 'shop' });

    const call = lastCall();
    expect(call.url).toBe(`${GROWTH}/sites/shop/domain`);
    expect(call.method).toBe('DELETE');
  });

  it('escapes a site id so it cannot climb the path', async () => {
    await handlers.get('archive_site')!({ site_id: '../releases' });
    expect(lastCall().url).toBe(`${GROWTH}/sites/..%2Freleases`);
  });

  it('rejects a site slug that is not lowercase alphanumeric with hyphens', () => {
    const slug = schemas.get('create_site')!.slug;
    expect(slug.safeParse('my-shop').success).toBe(true);
    expect(slug.safeParse('My Shop').success).toBe(false);
    expect(slug.safeParse('a').success).toBe(false);
  });
});
