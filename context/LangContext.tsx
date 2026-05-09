'use client'

import { createContext, useContext } from 'react'
import { getStrings } from '@/lib/i18n'

type LangCtx = ReturnType<typeof getStrings>

const LangContext = createContext<LangCtx>(getStrings('en'))

export function LangProvider({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <LangContext.Provider value={getStrings(lang)}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
