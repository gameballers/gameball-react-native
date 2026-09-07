import {
  platformCode,
  osTypeFor,
  resolveLanguage,
  detectPlatform,
} from '../platform';

describe('platform helpers', () => {
  it('maps platforms to the backend enum and osType', () => {
    expect(platformCode('ios')).toBe(1);
    expect(platformCode('android')).toBe(2);
    expect(platformCode('web')).toBe(3);
    expect(osTypeFor('web')).toBe('Web');
    expect(osTypeFor('ios')).toBe('iOS');
  });
  it('resolves language like the mobile SDKs', () => {
    expect(resolveLanguage('en', 'ar')).toBe('ar');
    expect(resolveLanguage('fr', null)).toBe('fr');
    expect(resolveLanguage('fr', 'arabic')).toBe('fr');
    expect(resolveLanguage(undefined, undefined)).toBe('en');
    expect(resolveLanguage('english', '')).toBe('en');
  });
  it('detects the platform from the adapter, defaulting to web', () => {
    expect(detectPlatform()).toBe('web');
    expect(detectPlatform({ platform: () => 'android' })).toBe('android');
  });
});
