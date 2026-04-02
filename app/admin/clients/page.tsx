import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import DeleteButton from "@/components/portal/DeleteButton"

export default async function AdminClientsPage() {
  const supabase = await createServerComponentClient()

  const { data: clientsRaw } = await supabase
    .from("clients").select("*, projects(id, status)")
    .order("created_at", { ascending: false })
  const clients = clientsRaw as any[] | null

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            All clients — {clients?.length ?? 0}
          </div>
          <Link href="/admin/clients/new" style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)",
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--ink)", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New client
          </Link>
        </div>

        <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 80px 60px", gap: 24, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Client", "Contact", "Projects", "", ""].map((h, i) => (
            <div key={`${h}-${i}`} style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-eyebrow)", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {clients?.map(client => {
          const activeProjects = client.projects?.filter((p: any) => p.status === "active").length ?? 0
          const totalProjects  = client.projects?.length ?? 0

          return (
            <div
              key={client.id}
              className="admin-client-row"
              style={{
                display: "grid", gridTemplateColumns: "1fr 160px 120px 80px 60px",
                gap: 24, alignItems: "center", padding: "18px 0",
                borderBottom: "0.5px solid rgba(15,15,14,0.08)",
              }}
            >
              <Link href={`/admin/clients/${client.id}`} style={{ textDecoration: "none" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-full)" as any, letterSpacing: "-0.01em" }}>
                  {client.name}
                </div>
                {client.notes && (
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, marginTop: 3 }}>
                    {client.notes.slice(0, 60)}{client.notes.length > 60 ? "…" : ""}
                  </div>
                )}
              </Link>

              <div className="admin-client-col-hide">
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-body)" as any }}>{client.contact_name}</div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-eyebrow)", opacity: "var(--op-muted)" as any, marginTop: 2 }}>{client.contact_email}</div>
              </div>

              <div className="admin-client-col-hide" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-muted)" as any }}>
                {activeProjects > 0
                  ? <span style={{ color: "var(--sage)" }}>{activeProjects} active</span>
                  : <span style={{ opacity: 0.4 }}>—</span>
                }
                {totalProjects > 0 && (
                  <span style={{ opacity: 0.4, marginLeft: 6 }}>/ {totalProjects} total</span>
                )}
              </div>

              <Link href={`/admin/clients/${client.id}`} style={{ textAlign: "right", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", opacity: "var(--op-ghost)" as any, textDecoration: "none" }}>&rarr;</Link>
              <DeleteButton endpoint="/api/admin/delete/client" id={client.id} confirm={`Delete ${client.name}? This will also delete all their projects, invoices, and proposals. This cannot be undone.`} />
            </div>
          )
        })}

        {(!clients || clients.length === 0) && (
          <div style={{ padding: "48px 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", opacity: "var(--op-ghost)" as any, textAlign: "center" }}>
            No clients yet — <Link href="/admin/clients/new" style={{ opacity: 0.6, textDecoration: "none", borderBottom: "0.5px solid rgba(15,15,14,0.2)" }}>add your first client</Link> to get started.
          </div>
        )}
      </main>
    </>
  )
}