import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Habre CMS" }];
}

export default function Home() {
  return (
    <main>
      <h1>Habre CMS</h1>
    </main>
  );
}
