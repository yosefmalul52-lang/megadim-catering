import {
  addLocalePrefix,
  getLocaleFromUrl,
  localizeNavPath,
  stripLocalePrefix,
  switchLocaleUrl
} from './locale.util';

describe('locale.util', () => {
  it('detects locale from URL', () => {
    expect(getLocaleFromUrl('/')).toBe('he');
    expect(getLocaleFromUrl('/about')).toBe('he');
    expect(getLocaleFromUrl('/en')).toBe('en');
    expect(getLocaleFromUrl('/en/about')).toBe('en');
  });

  it('strips and adds locale prefix', () => {
    expect(stripLocalePrefix('/en/about')).toBe('/about');
    expect(stripLocalePrefix('/en')).toBe('/');
    expect(addLocalePrefix('/about', 'en')).toBe('/en/about');
    expect(addLocalePrefix('/', 'en')).toBe('/en');
    expect(addLocalePrefix('/en/about', 'he')).toBe('/about');
  });

  it('switches locale while keeping page', () => {
    expect(switchLocaleUrl('/about', 'en')).toBe('/en/about');
    expect(switchLocaleUrl('/en/checkout', 'he')).toBe('/checkout');
    expect(switchLocaleUrl('/ready-for-shabbat/product/1', 'en')).toBe(
      '/en/ready-for-shabbat/product/1'
    );
  });

  it('localizes nav paths', () => {
    expect(localizeNavPath('/', 'en')).toBe('/en');
    expect(localizeNavPath('/contact', 'en')).toBe('/en/contact');
    expect(localizeNavPath('/admin', 'en')).toBe('/admin');
  });
});
