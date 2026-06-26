import { redirect } from "next/navigation"

/**
 * Quotes list is now part of the unified Documents view. The detail,
 * edit, and new pages live in place; only this bare list redirects.
 */
export default function AdminQuotesPage() {
  redirect("/admin/documents?type=quote")
}
