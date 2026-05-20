"use client"

import { useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

type ProjectFile = {
  id: string
  project_id: string
  name: string
  description?: string | null
  file_url: string
  storage_path: string
  file_type?: string | null
  file_size_bytes?: number | null
  uploaded_at: string
}

const mono = { fontFamily: "var(--font-mono)" } as const
const sans = { fontFamily: "var(--font-sans)" } as const
const serif = { fontFamily: "var(--font-serif)" } as const

const sectionLabel: React.CSSProperties = {
  ...mono,
  fontSize: "var(--text-eyebrow)",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  opacity: 0.5,
  marginBottom: 16,
}

function fmtSize(bytes?: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(d: string) {
  const date = new Date(d)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fileIcon(type?: string | null) {
  if (!type) return "·"
  const t = type.toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"].includes(t)) return "▢"
  if (["pdf"].includes(t)) return "▤"
  if (["doc", "docx", "txt", "md"].includes(t)) return "▦"
  if (["zip", "rar", "7z"].includes(t)) return "▣"
  return "·"
}

export default function ProjectFiles({ projectId, initialFiles }: { projectId: string; initialFiles: ProjectFile[] }) {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setError(null)
    setUploading(true)

    const newFiles: ProjectFile[] = []

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin"
      const path = `${projectId}/${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

      const { error: uploadErr } = await supabase.storage.from("project-files").upload(path, file)
      if (uploadErr) {
        console.error("[project-files upload]", uploadErr)
        setError(`Upload failed for ${file.name}`)
        continue
      }

      const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(path)

      const { data: row, error: dbErr } = await supabase.from("project_files").insert({
        project_id: projectId,
        name: file.name,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_type: ext,
        file_size_bytes: file.size,
      }).select().single()

      if (dbErr) {
        console.error("[project-files db]", dbErr)
        setError(`Couldn't record ${file.name}`)
        continue
      }

      if (row) newFiles.push(row as ProjectFile)
    }

    setFiles(prev => [...newFiles, ...prev])
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function deleteFile(file: ProjectFile) {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return

    // Optimistic
    setFiles(prev => prev.filter(f => f.id !== file.id))

    await supabase.storage.from("project-files").remove([file.storage_path])
    await supabase.from("project_files").delete().eq("id", file.id)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }
  function onDragLeave() { setDragOver(false) }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={sectionLabel}>
          Project files {files.length > 0 && <span style={{ opacity: 0.6 }}>· {files.length}</span>}
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            ...mono, fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--ink)", opacity: uploading ? 0.4 : 0.7,
            background: "transparent",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
            cursor: uploading ? "default" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : "+ Upload"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={e => handleUpload(e.target.files)}
        style={{ display: "none" }}
      />

      {/* Drop zone (always visible, becomes prominent on drag) */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: files.length === 0 ? "48px 32px" : "20px 24px",
          background: dragOver ? "rgba(143,167,181,0.1)" : "rgba(255,255,255,0.3)",
          border: dragOver
            ? "1px dashed var(--sage)"
            : "0.5px dashed rgba(15,15,14,0.2)",
          textAlign: "center",
          cursor: "pointer",
          transition: "background 0.18s, border-color 0.18s",
          marginBottom: files.length > 0 ? 24 : 0,
        }}
      >
        {files.length === 0 ? (
          <>
            <div style={{ ...serif, fontStyle: "italic", fontSize: 18, opacity: 0.6, marginBottom: 6 }}>
              No files yet.
            </div>
            <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5 }}>
              Drop files here, or click to choose. References, briefs, photos — anything you want stored alongside this project.
            </div>
          </>
        ) : (
          <div style={{ ...sans, fontSize: "var(--text-sm)", opacity: 0.5 }}>
            Drop files here or click to add more
          </div>
        )}
      </div>

      {error && (
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.08em", color: "var(--amber)", opacity: 0.9, marginTop: 10 }}>
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}>
          {files.map(f => (
            <div key={f.id} style={{
              padding: "14px 16px",
              background: "rgba(255,255,255,0.42)",
              border: "0.5px solid rgba(15,15,14,0.1)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ ...mono, fontSize: 14, opacity: 0.45, flexShrink: 0, lineHeight: 1 }}>
                  {fileIcon(f.file_type)}
                </span>
                <a
                  href={f.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...sans, fontSize: "var(--text-sm)", opacity: 0.88,
                    textDecoration: "none", color: "inherit",
                    wordBreak: "break-word", lineHeight: 1.4, flex: 1,
                  }}
                  title={f.name}
                >
                  {f.name}
                </a>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "0.08em", opacity: 0.4 }}>
                  {f.file_type?.toUpperCase()} {f.file_size_bytes ? ` · ${fmtSize(f.file_size_bytes)}` : ""} · {fmtDate(f.uploaded_at)}
                </div>
                <button
                  onClick={() => deleteFile(f)}
                  aria-label="Delete file"
                  style={{
                    ...mono, fontSize: 10, letterSpacing: "0.08em",
                    background: "none", border: "none", padding: "2px 6px",
                    color: "var(--ink)", opacity: 0.3,
                    cursor: "pointer",
                  }}
                  className="project-file-delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .project-file-delete:hover { opacity: 0.7 !important; }
      `}</style>
    </section>
  )
}
