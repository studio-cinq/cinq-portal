"use client"

import { useState } from "react"
import type { PresentationSlide } from "@/types/database"

export default function SlideViewer({ slides }: { slides: PresentationSlide[] }) {
  const [current, setCurrent] = useState(0)
  const slide = slides[current]

  return (
    <div style={{ width: "100%", maxWidth: 800, position: "relative" }}>

      {/* Prev arrow */}
      {current > 0 && (
        <button onClick={() => setCurrent(c => c - 1)} style={arrowStyle("left")}>
          &larr;
        </button>
      )}

      {/* Slide image */}
      <div style={{ width: "100%", aspectRatio: "16/10", position: "relative", overflow: "hidden" }}>
        <img
          src={slide.image_url}
          alt={slide.caption ?? `Slide ${current + 1}`}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </div>

      {/* Caption */}
      {slide.caption && (
        <div style={{
          textAlign: "center", marginTop: 16,
          fontSize: 8, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "rgba(237,232,224,0.25)",
        }}>
          {slide.caption}
        </div>
      )}

      {/* Next arrow */}
      {current < slides.length - 1 && (
        <button onClick={() => setCurrent(c => c + 1)} style={arrowStyle("right")}>
          &rarr;
        </button>
      )}

      {/* Dots */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, marginTop: 20,
      }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width: 5, height: 5, borderRadius: "50%",
              background: i === current ? "rgba(237,232,224,0.65)" : "rgba(237,232,224,0.2)",
              border: "none", cursor: "pointer", padding: 0,
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>

      {/* Slide count */}
      <div style={{
        textAlign: "center", marginTop: 8,
        fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(237,232,224,0.2)",
      }}>
        Slide {current + 1} of {slides.length}
        {slide.caption ? ` · ${slide.caption}` : ""}
      </div>

    </div>
  )
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 8,
    transform: "translateY(-50%)",
    fontSize: 18,
    color: "rgba(237,232,224,0.22)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 12,
    fontFamily: "var(--font-sans)",
    zIndex: 10,
  }
}
