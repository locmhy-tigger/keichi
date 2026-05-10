"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function SessionTimeoutWatcher({ expires }: { expires: string | undefined }) {
  const router = useRouter()

  useEffect(() => {
    if (!expires) return

    const expiryTime = new Date(expires).getTime()
    const now = new Date().getTime()
    const timeLeft = expiryTime - now

    if (timeLeft <= 0) {
      router.push("/login")
      return
    }

    const timer = setTimeout(() => {
      router.push("/login")
    }, timeLeft)

    return () => clearTimeout(timer)
  }, [expires, router])

  return null
}
