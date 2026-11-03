import { platformCode, resolveLanguage } from '../platform';

describe('platform helpers', () => {
  it('maps platforms to the backend enum', () => {
    expect(platformCode('ios')).toBe(1);
    expect(platformCode('android')).toBe(2);
  });
  it('resolves language like the mobile SDKs', () => {
    expect(resolveLanguage('en', 'ar')).toBe('ar');
    expect(resolveLanguage('fr', null)).toBe('fr');
    expect(resolveLanguage('fr', 'arabic')).toBe('fr');
    expect(resolveLanguage(undefined, undefined)).toBe('en');
    expect(resolveLanguage('english', '')).toBe('en');
  });
});
