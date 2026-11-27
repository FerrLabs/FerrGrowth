import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  GROWTH,
  handlers,
  lastCall,
  mockFetch,
  mockServer,
  parses,
  resetHarness,
} from './support/harness.js';

describe('ferrgrowth page publishing tools', () => {
  beforeEach(async () => {
    resetHarness();
    const { registerPagePublishingTools } = await import('../page-publishing.js');
    registerPagePublishingTools(mockServer);
  });

  it('registers the five tools', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'create_preview_link',
      'list_preview_links',
      'revoke_preview_link',
      'schedule_page',
      'unschedule_page',
    ]);
  });

  it('schedule_page posts publish_at and encodes slugs', async () => {
    await handlers.get('schedule_page')!({
      site_id: 'my site',
      page_slug: 'a/b',
      publish_at: '2026-11-01T09:00:00Z',
    });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/my%20site/pages/a%2Fb/schedule`,
      method: 'POST',
      body: { publish_at: '2026-11-01T09:00:00Z' },
    });
  });

  it('schedule_page rejects a timestamp without a timezone offset', () => {
    expect(
      parses('schedule_page', { site_id: 's', page_slug: 'p', publish_at: '2026-11-01' }),
    ).toBe(false);
    expect(
      parses('schedule_page', { site_id: 's', page_slug: 'p', publish_at: '2026-11-01T09:00:00' }),
    ).toBe(false);
    expect(
      parses('schedule_page', {
        site_id: 's',
        page_slug: 'p',
        publish_at: '2026-11-01T09:00:00+02:00',
      }),
    ).toBe(true);
  });

  it('unschedule_page deletes the schedule', async () => {
    await handlers.get('unschedule_page')!({ site_id: 's', page_slug: 'p' });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/s/pages/p/schedule`,
      method: 'DELETE',
    });
  });

  it('create_preview_link sends only the fields that were given', async () => {
    await handlers.get('create_preview_link')!({ site_id: 's', page_slug: 'p' });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/s/pages/p/preview-links`,
      method: 'POST',
      body: {},
    });

    mockFetch.mockClear();
    await handlers.get('create_preview_link')!({
      site_id: 's',
      page_slug: 'p',
      password: 'secret1',
      expires_in_hours: 24,
    });
    expect(lastCall().body).toEqual({ password: 'secret1', expires_in_hours: 24 });
  });

  it('create_preview_link validates password length and expiry bounds', () => {
    const base = { site_id: 's', page_slug: 'p' };
    expect(parses('create_preview_link', { ...base, password: 'short' })).toBe(false);
    expect(parses('create_preview_link', { ...base, expires_in_hours: 0 })).toBe(false);
    expect(parses('create_preview_link', { ...base, expires_in_hours: 2161 })).toBe(false);
    expect(parses('create_preview_link', { ...base, expires_in_hours: 1.5 })).toBe(false);
    expect(
      parses('create_preview_link', { ...base, password: 'secret1', expires_in_hours: 2160 }),
    ).toBe(true);
  });

  it('list_preview_links reads the page links', async () => {
    await handlers.get('list_preview_links')!({ site_id: 's', page_slug: 'p' });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/s/pages/p/preview-links`,
      method: 'GET',
    });
  });

  it('revoke_preview_link deletes by link id under the site', async () => {
    await handlers.get('revoke_preview_link')!({ site_id: 's', link_id: 'abc-123' });
    expect(lastCall()).toMatchObject({
      url: `${GROWTH}/sites/s/preview-links/abc-123`,
      method: 'DELETE',
    });
  });
});
