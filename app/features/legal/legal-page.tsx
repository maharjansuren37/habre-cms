import { data } from "react-router";

// Placeholder (F-428 Step 1): every document is Not Found until Step 3 renders them.
export function loader() {
  throw data("Not Found", { status: 404 });
}

export default function LegalPage() {
  return null;
}
