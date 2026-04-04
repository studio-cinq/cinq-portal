import { supabaseAdmin } from "@/lib/supabase-server"

type PortalLibrarySnapshot = {
  client: any | null
  contact: any | null
  projectIds: string[]
  hasGateInvoice: boolean
  gateIsPaid: boolean
  isUnlocked: boolean
  assets: any[]
  colors: any[]
  typefaces: any[]
}

export async function getPortalLibrarySnapshotByClientId(clientId: string): Promise<PortalLibrarySnapshot> {
  if (!clientId) {
    return { client: null, contact: null, projectIds: [], hasGateInvoice: false, gateIsPaid: false, isUnlocked: true, assets: [], colors: [], typefaces: [] }
  }

  const { data: clientRaw } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle()

  const client = clientRaw as any

  if (!client) {
    return { client: null, contact: null, projectIds: [], hasGateInvoice: false, gateIsPaid: false, isUnlocked: true, assets: [], colors: [], typefaces: [] }
  }

  const [{ data: projectsRaw }, { data: gateInvoicesRaw }] = await Promise.all([
    supabaseAdmin.from("projects").select("id").eq("client_id", client.id),
    supabaseAdmin
      .from("invoices")
      .select("id, status")
      .eq("client_id", client.id)
      .eq("unlocks_files", true),
  ])

  const projectIds = (projectsRaw ?? []).map((project: any) => project.id)
  const gateInvoices = gateInvoicesRaw ?? []
  const hasGateInvoice = gateInvoices.length > 0
  const gateIsPaid = gateInvoices.some((invoice: any) => invoice.status === "paid")
  const isUnlocked = !hasGateInvoice || gateIsPaid

  if (projectIds.length === 0 || !isUnlocked) {
    return { client, contact: null, projectIds, hasGateInvoice, gateIsPaid, isUnlocked, assets: [], colors: [], typefaces: [] }
  }

  const [assetsRes, colorsRes, typefacesRes] = await Promise.all([
    supabaseAdmin.from("brand_assets").select("*").in("project_id", projectIds).order("sort_order"),
    supabaseAdmin.from("color_swatches").select("*").in("project_id", projectIds).order("sort_order"),
    supabaseAdmin.from("typeface_entries").select("*").in("project_id", projectIds).order("sort_order"),
  ])

  return {
    client,
    contact: null,
    projectIds,
    hasGateInvoice,
    gateIsPaid,
    isUnlocked,
    assets: assetsRes.data ?? [],
    colors: colorsRes.data ?? [],
    typefaces: typefacesRes.data ?? [],
  }
}

export async function getPortalLibrarySnapshotByShareToken(token: string): Promise<PortalLibrarySnapshot> {
  const empty: PortalLibrarySnapshot = {
    client: null, contact: null, projectIds: [],
    hasGateInvoice: false, gateIsPaid: false, isUnlocked: true,
    assets: [], colors: [], typefaces: [],
  }
  if (!token) return empty

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("library_share_token" as any, token)
    .maybeSingle()

  if (!client) return empty

  // Admin is intentionally sharing — bypass gate/unlock logic
  const snapshot = await getPortalLibrarySnapshotByClientId((client as any).id)
  return { ...snapshot, isUnlocked: true }
}

export async function getPortalLibrarySnapshotByEmail(email: string): Promise<PortalLibrarySnapshot> {
  const empty: PortalLibrarySnapshot = {
    client: null, contact: null, projectIds: [],
    hasGateInvoice: false, gateIsPaid: false, isUnlocked: true,
    assets: [], colors: [], typefaces: [],
  }

  if (!email) return empty

  // Look up contact in client_contacts first, fall back to legacy clients.contact_email
  const { data: contactRaw } = await (supabaseAdmin as any)
    .from("client_contacts")
    .select("*, clients(*)")
    .eq("email", email)
    .maybeSingle()

  let client: any = null
  let contact: any = null

  if (contactRaw) {
    contact = { id: contactRaw.id, name: contactRaw.name, email: contactRaw.email, role: contactRaw.role, is_primary: contactRaw.is_primary, client_id: contactRaw.client_id }
    client = contactRaw.clients
  } else {
    // Fallback: legacy lookup by clients.contact_email
    const { data: clientRaw } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("contact_email", email)
      .maybeSingle()
    client = clientRaw
  }

  if (!client) return empty

  // Fetch projects — filter by contact if applicable
  const [{ data: allProjectsRaw }, { data: gateInvoicesRaw }] = await Promise.all([
    supabaseAdmin.from("projects").select("id, contact_id").eq("client_id", client.id),
    supabaseAdmin
      .from("invoices")
      .select("id, status")
      .eq("client_id", client.id)
      .eq("unlocks_files", true),
  ])

  const allProjects = (allProjectsRaw ?? []) as any[]

  // Contact sees: their assigned projects + unassigned (shared) projects
  const visibleProjects = contact
    ? allProjects.filter(p => p.contact_id === null || p.contact_id === contact.id)
    : allProjects

  const projectIds = visibleProjects.map((p: any) => p.id)
  const gateInvoices = gateInvoicesRaw ?? []
  const hasGateInvoice = gateInvoices.length > 0
  const gateIsPaid = gateInvoices.some((invoice: any) => invoice.status === "paid")
  const isUnlocked = !hasGateInvoice || gateIsPaid

  if (projectIds.length === 0 || !isUnlocked) {
    return { client, contact, projectIds, hasGateInvoice, gateIsPaid, isUnlocked, assets: [], colors: [], typefaces: [] }
  }

  const [assetsRes, colorsRes, typefacesRes] = await Promise.all([
    supabaseAdmin.from("brand_assets").select("*").in("project_id", projectIds).order("sort_order"),
    supabaseAdmin.from("color_swatches").select("*").in("project_id", projectIds).order("sort_order"),
    supabaseAdmin.from("typeface_entries").select("*").in("project_id", projectIds).order("sort_order"),
  ])

  return {
    client, contact, projectIds,
    hasGateInvoice, gateIsPaid, isUnlocked,
    assets: assetsRes.data ?? [],
    colors: colorsRes.data ?? [],
    typefaces: typefacesRes.data ?? [],
  }
}
