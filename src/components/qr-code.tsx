'use client'

import { QRCodeSVG } from 'qrcode.react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * QR code with a pixel-reveal dissolve animation on mount.
 */
export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setRevealed(0)
    const id = setInterval(() => {
      setRevealed(r => {
        if (r >= 100) {
          clearInterval(id)
          return 100
        }
        return r + Math.random() * 25
      })
    }, 40)
    return () => clearInterval(id)
  }, [value])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative inline-block"
      style={{ filter: `blur(${Math.max(0, 6 - revealed / 16)}px)` }}
    >
      <div className="rounded-xl bg-white p-3 shadow-sm border">
        <QRCodeSVG value={value} size={size} level="M" includeMargin={false} fgColor="#0f1f1c" bgColor="#ffffff" />
      </div>
    </motion.div>
  )
}
