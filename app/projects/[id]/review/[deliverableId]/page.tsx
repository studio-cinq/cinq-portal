import { cookies } from "next/headers"
import { createServerComponentClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import Link from "next/link"
import PortalNav from "@/components/portal/Nav"
import ReviewActions from "@/components/portal/ReviewActions"
import type { Database } from "@/types/database"

export default async function ReviewPage({
  params,
}: {
  params: { id: string; deliverableId: string }
}) {
  const supabase = await createServerComponentClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("contact_email", user?.email ?? "")
    .single()

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .eq("client_id", client?.id ?? "")
    .single()

  if (!project) notFound()

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("*")
    .eq("id", params.deliverableId)
    .eq("project_id", project.id)
    .single()

  if (!deliverable) notFound()

  const { data: slides } = await supabase
    .from("presentation_slides")
    .select("*")
    .eq("deliverable_id", deliverable.id)
    .order("sort_order")

  return (
    <>
      <PortalNav clientName={client?.name} />

      {/* Sub-nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 52,
        borderBottom: "0.5px solid rgba(15,15,14,0.1)",
        background: "rgba(237,232,224,0.9)",
      }}>
        <Link href={`/projects/${project.id}`} style={{
          fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#0F0F0E", opacity: 0.42, textDecoration: "none",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          &larr; &nbsp;Back to project
        </Link>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--ink)", opacity: 0.75, fontWeight: 300 }}>
            {deliverable.name}
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.42, marginTop: 2 }}>
            {project.title}
          </div>
        </div>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c95a3b", opacity: 0.85 }}>
          Round {deliverable.revision_used + 1} of {deliverable.revision_max}
        </div>
      </div>

      {/* Dark stage */}
      <div style={{
        background: "#1A1916",
        minHeight: 360,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        position: "relative",
      }}>
        {slides && slides.length > 0 ? (
          <SlideViewer slides={slides} />
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(237,232,224,0.2)", marginBottom: 16 }}>
              Presentation
            </div>
            <div style={{ fontSize: 13, color: "rgba(237,232,224,0.35)", fontWeight: 300, lineHeight: 1.6 }}>
              Slides will appear here once uploaded by the studio.
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        borderTop: "0.5px solid rgba(15,15,14,0.09)",
        background: "rgba(237,232,224,0.5)",
      }}>
        {/* Context */}
        <div style={{ padding: "24px 28px", borderRight: "0.5px solid rgba(15,15,14,0.08)" }}>
          <div style={barLabel}>About this round</div>
          <div style={{ fontSize: 11, color: "var(--ink)", opacity: 0.5, lineHeight: 1.6 }}>
            {deliverable.description ?? `Round ${deliverable.revision_used + 1} of ${deliverable.revision_max} for ${deliverable.name}.`}
          </div>
        </div>

        {/* Feedback + approve — client component */}
        <ReviewActions
          projectId={project.id}
          deliverableId={deliverable.id}
          revisionsRemaining={deliverable.revision_max - deliverable.revision_used - 1}
        />
      </div>
    </>
  )
}

// Slide viewer — client component
import SlideViewer from "@/components/portal/SlideViewer"

const barLabel: React.CSSProperties = {
  fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
  color: "#0F0F0E", opacity: 0.42, marginBottom: 12,
}
