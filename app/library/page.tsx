import { createServerComponentClient } from "@/lib/supabase-server"
import PortalNav from "@/components/portal/Nav"
import ColorSwatches from "@/components/portal/ColorSwatches"
import Link from "next/link"

export default async function LibraryPage() {
  const supabase = await createServerComponentClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: clientRaw } = await supabase
    .from("clients")
    .select("*")
    .eq("contact_email", user?.email ?? "")
    .single()
  const client = clientRaw as any

  // Check if files are unlocked (final invoice paid)
  const { data: unlockInvoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("client_id", client?.id ?? "")
    .eq("unlocks_files", true)
    .eq("status", "paid")
    .maybeSingle()

  const isUnlocked = !!unlockInvoice

  // Get client's projects
  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", client?.id ?? "")
  const projectIds = (projectsRaw ?? []).map((p: any) => p.id)

  // Get brand assets for those projects
  const { data: assetsRaw } = projectIds.length > 0
    ? await supabase
        .from("brand_assets")
        .select("*")
        .in("project_id", projectIds)
        .order("sort_order")
    : { data: [] }
  const assets = assetsRaw ?? []

  const { data: colorsRaw } = projectIds.length > 0
    ? await supabase
        .from("color_swatches")
        .select("*")
        .in("project_id", projectIds)
        .order("sort_order")
    : { data: [] }
  const colors = colorsRaw ?? []

  const { data: typefacesRaw } = projectIds.length > 0
    ? await supabase
        .from("typeface_entries")
        .select("*")
        .in("project_id", projectIds)
        .order("sort_order")
    : { data: [] }
  const typefaces = typefacesRaw ?? []

  const logoAssets   = assets.filter((a: any) => a.category === "logo")
  const guideAssets  = assets.filter((a: any) => a.category === "guidelines")
  const sourceAssets = assets.filter((a: any) => a.category === "source")
  const otherAssets  = assets.filter((a: any) => !["logo","guidelines","source"].includes(a.category))
  const allFiles     = [...guideAssets, ...sourceAssets, ...otherAssets]

  return (
    <>
      <PortalNav clientName={client?.name} />

      {/* Hero */}
      <div style={{
        background: "#1A1916",
        padding: "44px 48px 40px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontFamily: "'Matter SemiMono', monospace",
            fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(237,232,224,0.45)", marginBottom: 10,
          }}>
            · Brand Library
          </div>
          <div style={{
            fontFamily: "'PP Writer', Georgia, serif",
            fontWeight: 400, fontSize: 28,
            color: "rgba(237,232,224,0.92)", letterSpacing: "-0.01em", marginBottom: 8,
          }}>
            {client?.name}
          </div>
          <div style={{
            fontFamily: "'Matter SemiMono', monospace",
            fontSize: 10, color: "rgba(237,232,224,0.45)", letterSpacing: "0.04em",
          }}>
            {isUnlocked ? "All files available for download" : "Files unlock after final payment"}
          </div>
        </div>

        {isUnlocked && assets.length > 0 && (
          <div style={{
            fontFamily: "'Matter SemiMono', monospace",
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(237,232,224,0.55)",
            border: "0.5px solid rgba(237,232,224,0.25)",
            padding: "10px 18px", cursor: "pointer",
          }}>
            ↓ &nbsp;Download everything
          </div>
        )}
      </div>

      {!isUnlocked ? (
        <LockedState />
      ) : (
        <main style={{
          padding: "44px 48px 56px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 48,
          maxWidth: 1100,
          margin: "0 auto",
        }}>

          {/* Left col */}
          <div>
            {/* Logo files */}
            {logoAssets.length > 0 && (
              <>
                <SectionLabel>Logo files</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 40 }}>
                  {logoAssets.map((asset: any) => (
                    <AssetTile
                      key={asset.id}
                      asset={asset}
                      dark={asset.name.toLowerCase().includes("reverse") || asset.name.toLowerCase().includes("dark")}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Color palette */}
            {colors.length > 0 && (
              <>
                <SectionLabel>Color palette</SectionLabel>
                <ColorSwatches colors={colors} />
              </>
            )}

            {logoAssets.length === 0 && colors.length === 0 && (
              <div style={{ fontFamily: "'PP Writer', Georgia, serif", fontSize: 13, opacity: 0.4, paddingTop: 16 }}>
                No logo files or colors added yet.
              </div>
            )}
          </div>

          {/* Right col */}
          <div>
            {/* Typography */}
            {typefaces.length > 0 && (
              <>
                <SectionLabel>Typography</SectionLabel>
                <div style={{ marginBottom: 40 }}>
                  {typefaces.map((tf: any, i: number) => (
                    <div key={tf.id} style={{
                      display: "flex", alignItems: "baseline",
                      justifyContent: "space-between", gap: 16,
                      padding: "16px 0",
                      borderBottom: "0.5px solid rgba(15,15,14,0.08)",
                      borderTop: i === 0 ? "0.5px solid rgba(15,15,14,0.08)" : "none",
                    }}>
                      <div style={{
                        fontFamily: "'PP Writer', Georgia, serif",
                        fontSize: 22, color: "#0F0F0E", opacity: 0.82,
                      }}>
                        Aa
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontFamily: "'PP Writer', Georgia, serif",
                          fontSize: 13, color: "#0F0F0E", opacity: 0.72, marginBottom: 3,
                        }}>
                          {tf.name} — {tf.weight}
                        </div>
                        <div style={{
                          fontFamily: "'Matter SemiMono', monospace",
                          fontSize: 8, color: "#0F0F0E", opacity: 0.4,
                          letterSpacing: "0.06em", marginBottom: 6,
                        }}>
                          {tf.role}
                        </div>
                        {tf.file_url && (
                          <a href={tf.file_url} style={{
                            fontFamily: "'Matter SemiMono', monospace",
                            fontSize: 8, color: "#0F0F0E", opacity: 0.45,
                            letterSpacing: "0.1em", textTransform: "uppercase",
                            textDecoration: "none",
                          }}>
                            ↓ Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* All files */}
            {allFiles.length > 0 && (
              <>
                <SectionLabel>All deliverable files</SectionLabel>
                <div>
                  {allFiles.map((asset: any) => (
                    <FileRow key={asset.id} asset={asset} />
                  ))}
                </div>
              </>
            )}

            {typefaces.length === 0 && allFiles.length === 0 && (
              <div style={{ fontFamily: "'PP Writer', Georgia, serif", fontSize: 13, opacity: 0.4, paddingTop: 16 }}>
                No files added yet.
              </div>
            )}
          </div>

        </main>
      )}
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'Matter SemiMono', monospace",
      fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
      color: "#0F0F0E", opacity: 0.5,
      marginBottom: 18,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {children}
      <div style={{ flex: 1, height: "0.5px", background: "rgba(15,15,14,0.1)" }} />
    </div>
  )
}

function AssetTile({ asset, dark }: { asset: any; dark?: boolean }) {
  return (
    <a
      href={asset.file_url}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 10, aspectRatio: "4/3",
        border: `0.5px solid ${dark ? "transparent" : "rgba(15,15,14,0.12)"}`,
        background: dark ? "#1A1916" : "rgba(255,255,255,0.35)",
        textDecoration: "none", cursor: "pointer",
      }}
    >
      <div style={{
        fontFamily: "'Matter SemiMono', monospace",
        fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
        color: dark ? "rgba(237,232,224,0.7)" : "rgba(15,15,14,0.7)",
        textAlign: "center", padding: "0 8px",
      }}>
        {asset.name}
      </div>
      <div style={{
        fontFamily: "'Matter SemiMono', monospace",
        fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase",
        color: dark ? "rgba(237,232,224,0.35)" : "rgba(15,15,14,0.35)",
      }}>
        {asset.file_type?.toUpperCase()}
      </div>
    </a>
  )
}

function FileRow({ asset }: { asset: any }) {
  const ext = asset.file_type?.toUpperCase() ?? "FILE"
  const size = asset.file_size_bytes > 1024 * 1024
    ? `${(asset.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(asset.file_size_bytes / 1024)} KB`

  return (
    <a
      href={asset.file_url}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.08)",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 28, height: 34,
          border: "0.5px solid rgba(15,15,14,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Matter SemiMono', monospace",
          fontSize: 7, letterSpacing: "0.06em",
          color: "#0F0F0E", opacity: 0.5,
        }}>
          {ext}
        </div>
        <div>
          <div style={{
            fontFamily: "'PP Writer', Georgia, serif",
            fontSize: 13, color: "#0F0F0E", opacity: 0.8, marginBottom: 3,
          }}>
            {asset.name}
          </div>
          <div style={{
            fontFamily: "'Matter SemiMono', monospace",
            fontSize: 9, color: "#0F0F0E", opacity: 0.4, letterSpacing: "0.04em",
          }}>
            {size} · {ext}
          </div>
        </div>
      </div>
      <div style={{
        fontFamily: "'Matter SemiMono', monospace",
        fontSize: 9, color: "#0F0F0E", opacity: 0.45,
        letterSpacing: "0.1em", textTransform: "uppercase",
      }}>
        ↓ Download
      </div>
    </a>
  )
}

function LockedState() {
  return (
    <div style={{ padding: "80px 48px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{
        fontFamily: "'Matter SemiMono', monospace",
        fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase",
        opacity: 0.4, marginBottom: 16,
      }}>
        Brand library
      </div>
      <div style={{
        fontFamily: "'PP Writer', Georgia, serif",
        fontWeight: 400, fontSize: 20, opacity: 0.72,
        marginBottom: 14, letterSpacing: "-0.01em",
      }}>
        Your files are almost ready.
      </div>
      <div style={{
        fontFamily: "'PP Writer', Georgia, serif",
        fontSize: 13, opacity: 0.55, lineHeight: 1.8,
      }}>
        Your brand library will unlock automatically once the final invoice is paid. All logo files, brand guidelines, color values, and source files will be available here.
      </div>
      <Link href="/invoices" style={{
        display: "inline-block", marginTop: 28,
        fontFamily: "'Matter SemiMono', monospace",
        fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "#0F0F0E", opacity: 0.55, textDecoration: "none",
        border: "0.5px solid rgba(15,15,14,0.2)", padding: "10px 20px",
      }}>
        View invoices →
      </Link>
    </div>
  )
}