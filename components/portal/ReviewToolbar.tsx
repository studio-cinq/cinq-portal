"use client"

interface ReviewToolbarProps {
  projectTitle: string
  clientName: string
  siteUrl: string
  currentPageUrl: string
  onPageUrlChange: (url: string) => void
  mode: "browse" | "comment"
  onModeChange: (mode: "browse" | "comment") => void
  round: number
  pinCount: number
  onSubmit: () => void
  onApprove: () => void
  submitting: boolean
  approving: boolean
  notes?: string
}

export default function ReviewToolbar({
  projectTitle,
  clientName,
  siteUrl,
  currentPageUrl,
  onPageUrlChange,
  mode,
  onModeChange,
  round,
  pinCount,
  onSubmit,
  onApprove,
  submitting,
  approving,
  notes,
}: ReviewToolbarProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      background: "rgba(250,248,245,0.98)",
      borderBottom: "0.5px solid rgba(15,15,14,0.1)",
      backdropFilter: "blur(8px)",
      position: "relative",
      zIndex: 50,
    }}>
      {/* Main toolbar row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        height: 52,
        gap: 16,
      }}>
        {/* Left: logo + project info */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink)",
            opacity: 0.35,
            whiteSpace: "nowrap",
          }}>Studio Cinq</span>
          <span style={{ width: 0.5, height: 20, background: "rgba(15,15,14,0.12)" }} />
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            color: "var(--ink)",
            opacity: 0.65,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>{projectTitle}</span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink)",
            opacity: 0.35,
            border: "0.5px solid rgba(15,15,14,0.15)",
            padding: "3px 8px",
            whiteSpace: "nowrap",
          }}>Round {round}</span>
        </div>

        {/* Center: mode toggle */}
        <div style={{
          display: "flex",
          border: "0.5px solid rgba(15,15,14,0.15)",
          overflow: "hidden",
        }}>
          {(["browse", "comment"] as const).map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "7px 16px",
                border: "none",
                cursor: "pointer",
                background: mode === m ? "var(--ink)" : "transparent",
                color: mode === m ? "#EDE8E0" : "var(--ink)",
                opacity: mode === m ? 1 : 0.45,
                transition: "all 0.15s",
              }}
            >{m === "browse" ? "Browse" : `Comment${pinCount > 0 ? ` (${pinCount})` : ""}`}</button>
          ))}
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onSubmit}
            disabled={submitting || pinCount === 0}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "var(--ink)",
              color: "#EDE8E0",
              padding: "8px 16px",
              border: "none",
              cursor: "pointer",
              opacity: submitting || pinCount === 0 ? 0.3 : 1,
              transition: "opacity 0.2s",
              whiteSpace: "nowrap",
            }}
          >{submitting ? "Submitting…" : "Submit feedback"}</button>

          <button
            onClick={onApprove}
            disabled={approving}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "none",
              color: "var(--ink)",
              padding: "8px 14px",
              cursor: "pointer",
              border: "0.5px solid rgba(15,15,14,0.15)",
              opacity: approving ? 0.3 : 0.55,
              transition: "opacity 0.2s",
              whiteSpace: "nowrap",
            }}
          >{approving ? "Approving…" : "Approve site"}</button>
        </div>
      </div>

      {/* URL bar row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 20px 10px",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink)",
          opacity: 0.35,
          whiteSpace: "nowrap",
        }}>Page</span>
        <input
          type="text"
          value={currentPageUrl}
          onChange={e => onPageUrlChange(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink)",
            opacity: 0.6,
            background: "rgba(255,255,255,0.3)",
            border: "0.5px solid rgba(15,15,14,0.08)",
            outline: "none",
            boxSizing: "border-box",
          }}
          placeholder="Paste current page URL if you navigated"
        />
      </div>

      {/* Notes from admin */}
      {notes && (
        <div style={{
          padding: "0 20px 12px",
          borderTop: "0.5px solid rgba(15,15,14,0.06)",
          paddingTop: 10,
        }}>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink)",
            opacity: 0.35,
            margin: "0 0 4px",
          }}>Note from Kacie</p>
          <p style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-sm)",
            color: "var(--ink)",
            opacity: 0.65,
            margin: 0,
            lineHeight: 1.5,
          }}>{notes}</p>
        </div>
      )}
    </div>
  )
}
