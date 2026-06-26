import Link from "next/link"

export type FilterTab = {
  /** URL-param value for this tab. `null` means the default tab (no param). */
  value: string | null
  label: string
  count?: number
  /** Override the auto-generated href if the page needs a custom shape. */
  href?: string
}

/**
 * Underline filter tabs used across the admin lists (Documents, Invoices,
 * Clients). State lives in the URL via the `paramName` so reloads stick
 * and tab links are shareable.
 *
 * Visual: low-weight mono labels with a small count beside each. Active tab
 * gets a 2px ink underline; inactive tabs sit at reduced opacity.
 */
export default function FilterTabs({
  basePath,
  paramName = "tab",
  tabs,
  activeValue,
  trailing,
}: {
  /** e.g. "/admin/documents" */
  basePath: string
  /** Query param name. Default "tab" — pass "type" / "status" / etc. */
  paramName?: string
  tabs: FilterTab[]
  /** The currently active tab's `value` (or null for the default tab). */
  activeValue: string | null
  /** Optional right-aligned slot (e.g. a "{n} drafts →" link). */
  trailing?: React.ReactNode
}) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 26,
        borderBottom: "0.5px solid var(--hairline, rgba(15,15,14,0.1))",
        paddingBottom: 0,
        marginBottom: 4,
      }}
    >
      {tabs.map(tab => {
        const active = tab.value === activeValue
        const href = tab.href ?? (tab.value == null ? basePath : `${basePath}?${paramName}=${tab.value}`)
        return (
          <Link
            key={tab.value ?? "__default"}
            role="tab"
            aria-selected={active}
            href={href}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: active ? "var(--ink)" : "rgba(15,15,14,0.45)",
              textDecoration: "none",
              padding: "10px 0",
              borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span style={{ opacity: 0.5 }}> · {tab.count}</span>
            )}
          </Link>
        )
      })}
      {trailing && <span style={{ marginLeft: "auto" }}>{trailing}</span>}
    </div>
  )
}
