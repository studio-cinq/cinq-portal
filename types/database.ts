// -- Cinq Portal Database Types --
// These mirror the Supabase tables exactly.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type DeliverableStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "complete"

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"

export type ProjectStatus =
  | "proposal_sent"
  | "active"
  | "complete"
  | "on_hold"

export type PhaseChoice = "now" | "later"

export type ReviewSessionStatus = "in_review" | "revising" | "approved"

// -- Core types --

export interface Client {
  id: string
  created_at: string
  name: string
  contact_name: string
  contact_email: string
  logo_url?: string
  notes?: string
  library_share_token?: string | null
}

export interface ClientContact {
  id: string
  created_at: string
  client_id: string
  name: string
  email: string
  role?: string | null
  is_primary: boolean
}

export interface Project {
  id: string
  created_at: string
  client_id: string
  contact_id?: string | null
  title: string
  scope: string
  status: ProjectStatus
  start_date?: string
  end_date?: string
  total_weeks?: number
  current_week?: number
}

export interface Deliverable {
  id: string
  created_at: string
  project_id: string
  name: string
  description?: string
  status: DeliverableStatus
  revision_used: number
  revision_max: number
  sort_order: number
}

export interface PresentationSlide {
  id: string
  created_at: string
  deliverable_id: string
  project_id: string
  image_url: string
  caption?: string
  sort_order: number
}

export interface DecisionLog {
  id: string
  created_at: string
  project_id: string
  entry: string
  logged_at: string
}

export interface ProposalItem {
  id: string
  created_at: string
  project_id: string
  name: string
  description: string
  price: number
  timeline_weeks_min: number
  timeline_weeks_max: number
  phase: PhaseChoice
  accepted: boolean
  sort_order: number
  is_recommended: boolean
}

export interface Invoice {
  id: string
  created_at: string
  project_id: string
  client_id: string
  invoice_number: string
  description: string
  amount: number
  status: InvoiceStatus
  due_date?: string
  paid_at?: string
  stripe_payment_intent_id?: string
  unlocks_files: boolean
}

export interface BrandAsset {
  id: string
  created_at: string
  project_id: string
  name: string
  file_url: string
  file_type: string
  file_size_bytes: number
  category: "logo" | "color" | "typography" | "guidelines" | "source" | "other"
  sort_order: number
}

export interface ColorSwatch {
  id: string
  project_id: string
  name: string
  hex: string
  sort_order: number
}

export interface TypefaceEntry {
  id: string
  project_id: string
  name: string
  weight: string
  role: string
  file_url?: string
  sort_order: number
}

export interface Message {
  id: string
  created_at: string
  project_id: string
  from_client: boolean
  sender_name: string
  body: string
  read: boolean
}

export interface ReviewSession {
  id: string
  created_at: string
  project_id: string
  client_id: string
  site_url: string
  current_round: number
  status: ReviewSessionStatus
  viewed_at?: string
  submitted_at?: string
  approved_at?: string
  notes?: string
}

export interface ReviewAnnotation {
  id: string
  created_at: string
  session_id: string
  round: number
  page_url: string
  x_percent: number
  y_percent: number
  viewport_w: number
  viewport_h: number
  scroll_y?: number
  page_height?: number
  comment: string
  resolved: boolean
}

// -- Convenience join types --

export interface ProjectWithClient extends Project {
  client: Client
}

export interface ProjectFull extends Project {
  client: Client
  deliverables: Deliverable[]
  decision_log: DecisionLog[]
  invoices: Invoice[]
  proposal_items: ProposalItem[]
  messages: Message[]
}

export type Database = {
  public: {
    Tables: {
      clients: { Row: Client; Insert: Omit<Client, "id" | "created_at">; Update: Partial<Client> }
      client_contacts: { Row: ClientContact; Insert: Omit<ClientContact, "id" | "created_at">; Update: Partial<ClientContact> }
      projects: { Row: Project; Insert: Omit<Project, "id" | "created_at">; Update: Partial<Project> }
      deliverables: { Row: Deliverable; Insert: Omit<Deliverable, "id" | "created_at">; Update: Partial<Deliverable> }
      presentation_slides: { Row: PresentationSlide; Insert: Omit<PresentationSlide, "id" | "created_at">; Update: Partial<PresentationSlide> }
      decision_log: { Row: DecisionLog; Insert: Omit<DecisionLog, "id" | "created_at">; Update: Partial<DecisionLog> }
      proposal_items: { Row: ProposalItem; Insert: Omit<ProposalItem, "id" | "created_at">; Update: Partial<ProposalItem> }
      invoices: { Row: Invoice; Insert: Omit<Invoice, "id" | "created_at">; Update: Partial<Invoice> }
      brand_assets: { Row: BrandAsset; Insert: Omit<BrandAsset, "id" | "created_at">; Update: Partial<BrandAsset> }
      color_swatches: { Row: ColorSwatch; Insert: Omit<ColorSwatch, "id">; Update: Partial<ColorSwatch> }
      typeface_entries: { Row: TypefaceEntry; Insert: Omit<TypefaceEntry, "id">; Update: Partial<TypefaceEntry> }
      messages: { Row: Message; Insert: Omit<Message, "id" | "created_at">; Update: Partial<Message> }
      review_sessions: { Row: ReviewSession; Insert: Omit<ReviewSession, "id" | "created_at">; Update: Partial<ReviewSession> }
      review_annotations: { Row: ReviewAnnotation; Insert: Omit<ReviewAnnotation, "id" | "created_at">; Update: Partial<ReviewAnnotation> }
    }
  }
}
