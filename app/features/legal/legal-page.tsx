import { data, Link } from "react-router";
import { env } from "#app/lib/env.server.ts";
import type { Route } from "./+types/legal-page";
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from "./legal-documents.ts";
import styles from "./legal-page.module.css";

function isDocumentKey(value: string | undefined): value is LegalDocumentKey {
  return value !== undefined && Object.hasOwn(LEGAL_DOCUMENTS, value);
}

export function loader({ params }: Route.LoaderArgs) {
  if (!isDocumentKey(params.document)) throw data("Not Found", { status: 404 });
  // Signup's link only where signup exists: it is a 404 when off (F-441).
  return { document: params.document, signupOpen: env.SIGNUP_MODE !== "off" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData ? LEGAL_DOCUMENTS[loaderData.document].title : "Not found";
  return [{ title: `${title} - Habre` }];
}

// A fixed locale and zone so the server and the browser print the same date.
function humanDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function LegalPage({ loaderData }: Route.ComponentProps) {
  const key = loaderData.document;
  const doc = LEGAL_DOCUMENTS[key];
  const other = key === "terms" ? "privacy" : "terms";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            h
          </span>{" "}
          habre
        </span>
      </header>
      <main className={styles.main}>
        <article className={styles.article}>
          <h1>{doc.title}</h1>
          <p className={styles.updated}>
            Last updated <time dateTime={doc.updated}>{humanDate(doc.updated)}</time>
          </p>
          {doc.intro.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {doc.sections.map((section) => (
            <section key={section.id}>
              <h2 id={section.id}>{section.heading}</h2>
              {section.paragraphs.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {section.list && (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <nav className={styles.links} aria-label="Related">
            <Link to={`/legal/${other}`}>{LEGAL_DOCUMENTS[other].title}</Link>
            {loaderData.signupOpen && <Link to="/signup">Create your website</Link>}
          </nav>
        </article>
      </main>
    </div>
  );
}
