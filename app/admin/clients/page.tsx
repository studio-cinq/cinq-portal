import { createServerComponentClient } from "@/lib/supabase-server"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import DeleteButton from "@/components/portal/DeleteButton"

export default async function AdminClientsPage() {
  const supabase = await createServerComponentClient()

  const { data: clientsRaw } = await supabase
    .from("clients")
    .select("*, projects(id, status)")
    .order("created_at", { ascending: false })

  const clients = clientsRaw as any[] | null

  return (
    <>
      <PortalNav isAdmin />
      <main className="admin-page-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 48px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 36 }}>
          <div style={{ fontSize: 8, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5 }}>
            All clients — {clients?.length ?? 0}
          </div>
          <Link href="/admin/clients/new" style={{
            fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "#0F0F0E", opacity: 0.6, textDecoration: "none",
            border: "0.5px solid rgba(15,15,14,0.2)", padding: "8px 14px",
          }}>
            + New client
          </Link>
        </div>

        {/* Header */}
        <div className="admin-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 160px 120px 80px 60px", gap: 24, paddingBottom: 10, borderBottom: "0.5px solid rgba(15,15,14,0.12)" }}>
          {["Client", "Contact", "Projects", "", ""].map(h => (
            <div key={h} style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.45 }}>{h}</div>
          ))}
        </div>

        {clients?.map(client => {
          const activeProjects = client.projects?.filter((p: any) => p.status === "active").length ?? 0
          const totalProjects  = client.projects?.length ?? 0

          return (
            <Link
  key={client.id}
  href={`/admin/clients/${client.id}`}
  className="admin-client-row"
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 160px 120px 80px 60px",
    gap: 24, alignItems: "center",
    padding: "18px 0",
    borderBottom: "0.5px solid rgba(15,15,14,0.08)",
    textDecoration: "none",
  }}
>
              <div>
                <div style={{ fontSize: 14, fontWeight: 300, opacity: 0.88, letterSpacing: "-0.01em" }}>
                  {client.name}
                </div>
                {client.notes && (
                  <div style={{ fontSize: 9, opacity: 0.45, marginTop: 3, letterSpacing: "0.01em" }}>
                    {client.notes.slice(0, 60)}{client.notes.length > 60 ? "…" : ""}
                  </div>
                )}
              </div>

              <div className="admin-client-col-hide">
  <div style={{ fontSize: 11, opacity: 0.75 }}>{client.contact_name}</div>
  <div style={{ fontSize: 9, opacity: 0.45, marginTop: 2 }}>{client.contact_email}</div>
</div>

              <div className="admin-client-col-hide" style={{ fontSize: 11, opacity: 0.65 }}>
                {activeProjects > 0
                  ? <span style={{ color: "#6B8F71" }}>{activeProjects} active</span>
                  : <span style={{ opacity: 0.4 }}>—</span>
                }
                {totalProjects > 0 && (
                  <span style={{ opacity: 0.4, marginLeft: 6 }}>/ {totalProjects} total</span>
                )}
              </div>

              <div style={{ textAlign: "right", fontSize: 11, opacity: 0.3 }}>&rarr;</div>
<DeleteButton endpoint="/api/admin/delete/client" id={client.id} confirm={`Delete ${client.name}? This will also delete all their projects, invoices, and proposals. This cannot be undone.`} />
            </Link>
          )
        })}

        {(!clients || clients.length === 0) && (
          <div style={{ padding: "48px 0", fontSize: 12, opacity: 0.35, textAlign: "center" }}>
            No clients yet. Add your first client to get started.
          </div>
        )}

      </main>
    </>
  )
}
