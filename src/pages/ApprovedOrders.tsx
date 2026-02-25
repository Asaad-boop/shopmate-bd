import { Navigate } from "react-router-dom";

// Approved Orders = Orders page filtered to approved/confirmed status
export default function ApprovedOrders() {
  return <Navigate to="/orders?status=approved" replace />;
}
