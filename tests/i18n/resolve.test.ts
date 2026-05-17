import { describe, expect, it } from 'vitest'
import { resolveLocale } from '@/lib/i18n/resolve'

/**
 * Covers the NFR-7 test list explicitly + the edge cases the ADR §6
 * sequence diagram calls out.
 */
describe('resolveLocale', () => {
  describe('precedence chain (URL → cookie → AL → booking.language → en)', () => {
    it('URL ?lang= wins over cookie, AL, booking', () => {
      expect(
        resolveLocale({
          urlLang: 'ja',
          cookie: 'ko',
          acceptLanguage: 'zh-TW',
          bookingLanguage: 'en',
        })
      ).toEqual({ locale: 'ja', source: 'url' })
    })

    it('invalid URL falls through to cookie', () => {
      expect(
        resolveLocale({ urlLang: 'fr', cookie: 'ja' })
      ).toEqual({ locale: 'ja', source: 'cookie' })
    })

    it('invalid URL + invalid cookie falls through to AL', () => {
      expect(
        resolveLocale({
          urlLang: 'xx',
          cookie: 'fake',
          acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.5',
        })
      ).toEqual({ locale: 'ko', source: 'accept-language' })
    })

    it('unsupported AL falls through to booking.language', () => {
      expect(
        resolveLocale({
          acceptLanguage: 'fr-FR,fr;q=0.9',
          bookingLanguage: 'ja',
        })
      ).toEqual({ locale: 'ja', source: 'booking' })
    })

    it('AL beats booking.language when both are supported', () => {
      // The whole point of the user's chain correction: AL reflects what
      // the guest's browser actually wants. A Korean speaker booking via
      // a Japanese agent should see Korean UI, not Japanese.
      expect(
        resolveLocale({
          acceptLanguage: 'ko',
          bookingLanguage: 'ja',
        })
      ).toEqual({ locale: 'ko', source: 'accept-language' })
    })

    it('falls all the way to en when nothing matches', () => {
      expect(
        resolveLocale({
          urlLang: 'fr',
          cookie: 'de',
          acceptLanguage: 'fr',
          bookingLanguage: 'xx',
        })
      ).toEqual({ locale: 'en', source: 'default' })
    })

    it('empty input → en (default)', () => {
      expect(resolveLocale({})).toEqual({ locale: 'en', source: 'default' })
    })

    it('null / undefined fields tolerated', () => {
      expect(
        resolveLocale({
          urlLang: null,
          cookie: undefined,
          acceptLanguage: '',
          bookingLanguage: null,
        })
      ).toEqual({ locale: 'en', source: 'default' })
    })
  })

  describe('Accept-Language parsing', () => {
    it('Traditional Chinese signal via -Hant', () => {
      expect(
        resolveLocale({ acceptLanguage: 'zh-Hant-TW,zh;q=0.9,en;q=0.8' })
      ).toEqual({ locale: 'zh-TW', source: 'accept-language' })
    })

    it('zh-HK maps to Traditional', () => {
      expect(resolveLocale({ acceptLanguage: 'zh-HK' })).toEqual({
        locale: 'zh-TW',
        source: 'accept-language',
      })
    })

    it('zh-CN maps to Simplified', () => {
      expect(resolveLocale({ acceptLanguage: 'zh-CN,zh;q=0.9' })).toEqual({
        locale: 'zh-CN',
        source: 'accept-language',
      })
    })

    it('region-less zh maps to Simplified by convention', () => {
      expect(resolveLocale({ acceptLanguage: 'zh' })).toEqual({
        locale: 'zh-CN',
        source: 'accept-language',
      })
    })

    it('respects q-value ordering', () => {
      // The high-q entry is fr (unsupported), then ja, then ko. ja wins.
      expect(
        resolveLocale({ acceptLanguage: 'fr;q=1.0, ja;q=0.9, ko;q=0.5' })
      ).toEqual({ locale: 'ja', source: 'accept-language' })
    })

    it('region drop: en-US → en, ja-JP → ja', () => {
      expect(resolveLocale({ acceptLanguage: 'en-US' })).toEqual({
        locale: 'en',
        source: 'accept-language',
      })
      expect(resolveLocale({ acceptLanguage: 'ja-JP' })).toEqual({
        locale: 'ja',
        source: 'accept-language',
      })
    })

    it('completely unsupported Accept-Language → no match (fall through)', () => {
      expect(resolveLocale({ acceptLanguage: 'fr-FR,de;q=0.9' })).toEqual({
        locale: 'en',
        source: 'default',
      })
    })

    it('whitespace tolerant', () => {
      expect(
        resolveLocale({ acceptLanguage: '  ja  ;  q=0.9 ,  en;q=0.5' })
      ).toEqual({ locale: 'ja', source: 'accept-language' })
    })
  })

  describe('booking.language legacy alias', () => {
    it('legacy "zh" booking value aliases to zh-CN', () => {
      expect(resolveLocale({ bookingLanguage: 'zh' })).toEqual({
        locale: 'zh-CN',
        source: 'booking',
      })
    })

    it('unsupported booking value falls through to default', () => {
      expect(resolveLocale({ bookingLanguage: 'xx' })).toEqual({
        locale: 'en',
        source: 'default',
      })
    })

    it('supported booking value passes through', () => {
      expect(resolveLocale({ bookingLanguage: 'ko' })).toEqual({
        locale: 'ko',
        source: 'booking',
      })
    })
  })

  describe('security / robustness', () => {
    it('malformed URL ?lang= falls through silently (no throw)', () => {
      expect(() =>
        resolveLocale({ urlLang: 'xx-XX-YY' })
      ).not.toThrow()
      expect(resolveLocale({ urlLang: 'xx-XX-YY' }).source).toBe('default')
    })

    it('tampered cookie does not pass type guard', () => {
      expect(
        resolveLocale({ cookie: '<script>alert(1)</script>' })
      ).toEqual({ locale: 'en', source: 'default' })
    })

    it('numeric / non-string urlLang ignored (TS would reject; runtime safe)', () => {
      expect(
        // @ts-expect-error — runtime safety check for arbitrary upstream values
        resolveLocale({ urlLang: 123 })
      ).toEqual({ locale: 'en', source: 'default' })
    })
  })
})
