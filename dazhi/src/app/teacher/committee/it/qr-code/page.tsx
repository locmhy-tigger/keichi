"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"

const PRESETS = [
  { label: "學校網站",    value: "https://www.school.edu.hk" },
  { label: "Google Classroom", value: "https://classroom.google.com" },
  { label: "學校 Wi-Fi", value: "WIFI:T:WPA;S:SchoolWiFi;P:password123;;" },
]

const SIZES = [128, 256, 512]

export default function QRCodePage() {
  const [text,     setText]     = useState("")
  const [size,     setSize]     = useState(256)
  const [rendered, setRendered] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!text || !canvasRef.current) { setRendered(false); return }
    QRCode.toCanvas(canvasRef.current, text, { width: size, margin: 2, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then(() => setRendered(true))
      .catch(() => setRendered(false))
  }, [text, size])

  function download() {
    if (!canvasRef.current || !rendered) return
    const url = canvasRef.current.toDataURL("image/png")
    const a   = document.createElement("a")
    a.href     = url
    a.download = "qrcode.png"
    a.click()
  }

  const inputCls   = "w-full px-3 py-2 text-body rounded-input border outline-none"
  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/teacher/committee/it" className="text-caption" style={{ color: "var(--color-ink-400)" }}>
          ← 資訊科技
        </Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">QR Code 生成器</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>輸入網址或文字</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://…"
              className={inputCls}
              style={inputStyle}
              maxLength={500}
            />
            <p className="text-caption mt-1" style={{ color: "var(--color-ink-300)" }}>{text.length} / 500</p>
          </div>

          {/* Presets */}
          <div>
            <p className="text-caption mb-2" style={{ color: "var(--color-ink-700)" }}>快速填入</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setText(p.value)}
                  className="text-caption px-3 py-1.5 rounded-pill border transition-colors"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size selector */}
          <div>
            <p className="text-caption mb-2" style={{ color: "var(--color-ink-700)" }}>尺寸</p>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className="text-caption px-3 py-1.5 rounded-input border transition-colors"
                  style={{
                    border:     "1px solid var(--color-border)",
                    background: size === s ? "var(--color-accent)" : "var(--color-surface)",
                    color:      size === s ? "white" : "var(--color-ink-700)",
                  }}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          {rendered && (
            <button
              onClick={download}
              className="w-full px-4 py-2.5 rounded-input text-body font-medium text-white"
              style={{ background: "var(--color-accent)" }}
            >
              下載 PNG
            </button>
          )}
        </div>

        {/* QR preview */}
        <div
          className="card flex items-center justify-center min-h-[260px]"
          style={{ background: "var(--color-surface-2)" }}
        >
          {text ? (
            <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
          ) : (
            <div className="text-center" style={{ color: "var(--color-ink-300)" }}>
              <p className="text-h2 mb-1">⬜</p>
              <p className="text-caption">輸入文字後即時生成</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
