'use client'

import { useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { translate, type Locale, LOCALES } from '@/lib/i18n'

/**
 * i18n hook — returns a `t(key)` function bound to the current locale,
 * plus the current locale and a setter to switch languages.
 * Persists choice to localStorage.
 */
export function useI18n() {
  const locale = useAppStore((s) => s.locale)
  const setLocale = useAppStore((s) => s.setLocale)

  const t = useCallback(
    (key: string, fallback?: string) => translate(locale, key, fallback),
    [locale]
  )

  return { t, locale, setLocale, locales: LOCALES, dir: LOCALES.find(l => l.code === locale)?.dir || 'ltr' as 'ltr' | 'rtl' }
}
