import { cookies } from "next/headers"
import { createServerComponentClient } from "@/lib/supabase-server"
import PortalNav from "@/components/portal/Nav"
import CinqLogo from "@/components/CinqLogo"
import ColorSwatches from "@/components/portal/ColorSwatches"
import type { Database } from "@/types/database"

export default async function LibraryPage() {
  const supabase = await createServerComponentClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("contact_email", user?.email ?? "")
    .single()

  // Check if files are unlocked (final invoice paid)
  const { data: unlockInvoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_id", client?.id ?? "")
    .eq("unlocks_files", true)
    .eq("status", "paid")
    .maybeSingle()

  const isUnlocked = !!unlockInvoice

  // Get brand assets
  const { data: assets } = await supabase
    .from("brand_assets")
    .select("*")
    .eq("project_id", client?.id ?? "") // joined via RLS
    .order("sort_order")

  const { data: colors } = await supabase
    .from("color_swatches")
    .select("*")
    .order("sort_order")

  const { data: typefaces } = await supabase
    .from("typeface_entries")
    .select("*")
    .order("sort_order")

  const logoAssets    = assets?.filter(a => a.category === "logo")       ?? []
  const guideAssets   = assets?.filter(a => a.category === "guidelines") ?? []
  const sourceAssets  = assets?.filter(a => a.category === "source")     ?? []
  const otherAssets   = assets?.filter(a => !["logo","guidelines","source"].includes(a.category)) ?? []

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
          <div style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(237,232,224,0.3)", marginBottom: 10 }}>
            &bull; Brand Library
          </div>
          <div style={{ fontWeight: 300, fontSize: 28, color: "rgba(237,232,224,0.88)", letterSpacing: "-0.01em", marginBottom: 6 }}>
            {client?.name}
          </div>
          <div style={{ fontSize: 10, color: "rgba(237,232,224,0.32)", letterSpacing: "0.04em" }}>
            {isUnlocked ? "All files available for download" : "Files unlock after final payment"}
          </div>
        </div>

        {isUnlocked && assets && assets.length > 0 && (
          <a
            href="/api/download-all"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(237,232,224,0.45)",
              border: "0.5px solid rgba(237,232,224,0.2)",
              padding: "10px 18px", textDecoration: "none",
            }}
          >
            &#8675; &nbsp;Download everything
          </a>
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
            <div style={sectionLabel}>Logo files</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 40 }}>
              {logoAssets.map(asset => (
                <AssetTile key={asset.id} asset={asset} dark={asset.name.toLowerCase().includes("reverse") || asset.name.toLowerCase().includes("dark")} />
              ))}
            </div>

            {/* Color palette */}
            {colors && colors.length > 0 && (
              <>
                <div style={sectionLabel}>Color palette</div>
                <ColorSwatches colors={colors} />
              </>
            )}
          </div>

          {/* Right col */}
          <div>
            {/* Typography */}
            {typefaces && typefaces.length > 0 && (
              <>
                <div style={sectionLabel}>Typography</div>
                <div style={{ marginBottom: 40 }}>
                  {typefaces.map(tf => (
                    <div key={tf.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "16px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)", ...(tf.sort_order === 0 ? { borderTop: "0.5px solid rgba(15,15,14,0.07)" } : {}) }}>
                      <div style={{ fontSize: 22, fontWeight: 300, color: "#0F0F0E", opacity: 0.75, letterSpacing: "-0.01em" }}>
                        Aa
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "#0F0F0E", opacity: 0.45, letterSpacing: "0.04em", marginBottom: 2 }}>{tf.name} — {tf.weight}</div>
                        <div style={{ fontSize: 8, color: "#0F0F0E", opacity: 0.25, letterSpacing: "0.04em", marginBottom: 4 }}>{tf.role}</div>
                        {tf.file_url && (
                          <a href={tf.file_url} style={{ fontSize: 8, color: "#0F0F0E", opacity: 0.28, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}>
                            &#8675; Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* All files */}
            <div style={sectionLabel}>All deliverable files</div>
            <div>
              {[...guideAssets, ...sourceAssets, ...otherAssets].map(asset => (
                <FileRow key={asset.id} asset={asset} />
              ))}
            </div>
          </div>

        </main>
      )}
    </>
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
        border: "0.5px solid rgba(15,15,14,0.1)",
        background: dark ? "#1A1916" : "rgba(255,255,255,0.2)",
        textDecoration: "none", cursor: "pointer",
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ fontSize: dark ? 10 : 11, letterSpacing: "0.12em", textTransform: "uppercase", color: dark ? "rgba(237,232,224,0.55)" : "rgba(15,15,14,0.55)", fontWeight: 300 }}>
        {asset.name}
      </div>
      <div style={{ fontSize: 7, letterSpacing: "0.1em", textTransform: "uppercase", color: dark ? "rgba(237,232,224,0.22)" : "rgba(15,15,14,0.22)" }}>
        {asset.file_type.toUpperCase()}
      </div>
    </a>
  )
}

function FileRow({ asset }: { asset: any }) {
  const ext = asset.file_type.toUpperCase()
  const size = asset.file_size_bytes > 1024 * 1024
    ? `${(asset.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(asset.file_size_bytes / 1024)} KB`

  return (
    <a
      href={asset.file_url}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 0", borderBottom: "0.5px solid rgba(15,15,14,0.07)",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 28, height: 34, border: "0.5px solid rgba(15,15,14,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 7, letterSpacing: "0.06em", color: "#0F0F0E", opacity: 0.4,
        }}>
          {ext}
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#0F0F0E", opacity: 0.7, marginBottom: 2, fontWeight: 300 }}>{asset.name}</div>
          <div style={{ fontSize: 9, color: "#0F0F0E", opacity: 0.28, letterSpacing: "0.04em" }}>{size} &nbsp;&middot;&nbsp; {ext}</div>
        </div>
      </div>
      <div style={{ fontSize: 9, color: "#0F0F0E", opacity: 0.28, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        &#8675; Download
      </div>
    </a>
  )
}

function LockedState() {
  return (
    <div style={{ padding: "80px 48px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.25, marginBottom: 16 }}>
        Brand library
      </div>
      <div style={{ fontWeight: 300, fontSize: 18, opacity: 0.6, marginBottom: 12, letterSpacing: "-0.01em" }}>
        Your files are almost ready.
      </div>
      <div style={{ fontSize: 11, opacity: 0.38, lineHeight: 1.7 }}>
        Your brand library will unlock automatically once the final invoice is paid. All logo files, brand guidelines, color values, and source files will be available here.
      </div>
      <a href="/invoices" style={{
        display: "inline-block", marginTop: 28,
        fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "#0F0F0E", opacity: 0.45, textDecoration: "none",
        border: "0.5px solid rgba(15,15,14,0.18)", padding: "10px 20px",
      }}>
        View invoices &rarr;
      </a>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
  color: "#0F0F0E", opacity: 0.28, marginBottom: 18,
  display: "flex", alignItems: "center", gap: 12,
}
