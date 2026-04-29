'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CartItem } from '@/types'

type CartContextType = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (offerId: string) => void
  clearCart: () => void
  total: number
  itemCount: number
  hasItem: (offerId: string) => boolean
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [bounceKey, setBounceKey] = useState(0)

  // Persist cart to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gappy-cart')
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('gappy-cart', JSON.stringify(items))
  }, [items])

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.offer_id === item.offer_id)
      if (exists) return prev
      return [...prev, item]
    })
    setBounceKey((k) => k + 1)
  }, [])

  const removeItem = useCallback((offerId: string) => {
    setItems((prev) => prev.filter((i) => i.offer_id !== offerId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    localStorage.removeItem('gappy-cart')
  }, [])

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const itemCount = items.length

  const hasItem = useCallback(
    (offerId: string) => items.some((i) => i.offer_id === offerId),
    [items]
  )

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total, itemCount, hasItem }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
