import { redirect } from "react-router";

// The first admin section to ship (item 3) is the posts list; /admin exists
// only to send people there.
export function loader() {
  throw redirect("/admin/posts");
}
