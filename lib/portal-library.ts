import { supabaseAdmin } from "@/lib/supabase-server"

type PortalLibrarySnapshot = {
  client: any | null
  projectIds: string[]
  hasGateInvoice: boolean
  gateIsPaid: boolean
  isUnlocked: boolean
  assets: any[]
  colors: any[]
  typefaces: any[]
}

export async function getPortalLibrarySnapshotByEmail(email: string): Promise<PortalLibrarySnapshot> {
  if (!email) {
    return {
      client: null,
      projectIds: [],
      hasGateInvoice: false,
      gateIsPaid: false,
      isUnlocked: true,
      assets: [],
      colors: [],
      typefaces: [],
    }
  }

  const { data: clientRaw } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("contact_email", email)
    .maybeSingle()

  const client = clientRaw as any

  if (!client) {
    return {
      client: null,
      projectIds: [],
      hasGateInvoice: false,
      gateIsPaid: false,
      isUnlocked: true,
      assets: [],
      colors: [],
      typefaces: [],
    }
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
    return {
      client,
      projectIds,
      hasGateInvoice,
      gateIsPaid,
      isUnlocked,
      assets: [],
      colors: [],
      typefaces: [],
    }
  }

  const [assetsRes, colorsRes, typefacesRes] = await Promise.all([
    supabaseAdmin.from("brand_assets").select("*").in("project_id", projectIds).order("sort_order"),
    supabaseAdmin.from("color_swatches").select("*").in("project_id", projectIds).order("sort_order"),
    supabaseAdmin.from("typeface_entries").select("*").in("project_id", projectIds).order("sort_order"),
  ])

  return {
    client,
    projectIds,
    hasGateInvoice,
    gateIsPaid,
    isUnlocked,
    assets: assetsRes.data ?? [],
    colors: colorsRes.data ?? [],
    typefaces: typefacesRes.data ?? [],
  }
}
