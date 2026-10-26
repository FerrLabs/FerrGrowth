import { describe, it, expect } from 'vitest';
import { pathSegment } from '../api-base.js';

describe('pathSegment', () => {
  it.each(['.', '..'])('rejects the dot segment %s', (value) => {
    expect(() => pathSegment(value)).toThrow(/Invalid path segment/);
  });

  it('encodes reserved characters', () => {
    expect(pathSegment('a/b?c')).toBe('a%2Fb%3Fc');
  });

  it('keeps dots inside a longer segment', () => {
    expect(pathSegment('v1.2..3')).toBe('v1.2..3');
  });
});
