import { useParams } from "react-router-dom"
import { CustomerGroupsView } from "./CatalogCustomerGroupsPage"

export function CatalogCustomerGroupEditorPage() {
  const { id } = useParams()
  return <CustomerGroupsView key={id ?? "new"} editor />
}
