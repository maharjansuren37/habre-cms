import { data, Form, Link, redirect, useNavigation } from "react-router";
import { userContext } from "#app/features/auth/user-context.ts";
import { limitsFor } from "#app/features/plans/plan-limits.ts";
import { findMemberSite } from "#app/features/sites/find-site.server.ts";
import { DELETED_ACCOUNT } from "#app/lib/deleted-account.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import { Meter } from "#app/lib/ui/meter.tsx";
import type { Route } from "./+types/media-list";
import { mediaBannerRedirect, readMediaBanner } from "./banner.ts";
import { formatFileSize } from "./file-size.ts";
import { listMedia, storageUsed } from "./media.server.ts";
import { isUploadSizeAllowed } from "./media-input.ts";
import styles from "./media-list.module.css";
import { parseMediaListPage } from "./media-list-query.ts";
import { mediaSources } from "./media-objects.ts";
import { storageSummary } from "./storage-limit.ts";
import { storeUpload } from "./store-upload.server.ts";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Media - Habre CMS" }];
}

/** Only the params that differ from the default, matching `post-list.tsx`'s `listHref`. */
function mediaListHref(page: number): string {
  return page > 1 ? `/admin/media?page=${page}` : "/admin/media";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = context.get(userContext);
  const url = new URL(request.url);
  const page = parseMediaListPage(url);
  const [list, { plan }] = await Promise.all([
    listMedia(actor.siteId, page),
    findMemberSite(actor.siteId),
  ]);
  const { storageBytes } = limitsFor(plan, env.PLAN_LIMITS);
  // A bookmarked or stale page past the real end would otherwise render a
  // false "No images uploaded yet." with no way back (F-75, the same shape
  // F-56 found for posts) - redirect to the last real page instead.
  if (page > list.totalPages && list.total > 0) {
    throw redirect(mediaListHref(list.totalPages));
  }
  const banner = readMediaBanner(url.searchParams);
  return {
    media: list.media.map((item) => ({
      ...item,
      url: mediaSources(env.R2_PUBLIC_URL, item).thumbnail,
      // Matches media.server.ts's `ownedBy`: authors delete only their own,
      // editors and admins delete any.
      canDelete: actor.role !== "author" || item.uploadedBy === actor.id,
    })),
    total: list.total,
    totalPages: list.totalPages,
    page,
    banner,
    storage: storageSummary(await storageUsed(actor.siteId), storageBytes),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = context.get(userContext);
  if (!isUploadSizeAllowed(request.headers)) {
    return data(
      { problem: "This image is larger than 10 MB. Choose a smaller file and try again." },
      { status: 413 },
    );
  }
  const form = await request.formData();
  const result = await storeUpload(actor, form.get("file"), form.get("altText"));
  if (!result.ok) return data({ problem: result.problem }, { status: result.status });
  return mediaBannerRedirect("uploaded", result.media.filename);
}

export default function MediaList({ loaderData, actionData }: Route.ComponentProps) {
  const { media, total, totalPages, page, banner, storage } = loaderData;
  const navigation = useNavigation();
  const isUploading = navigation.state === "submitting" && navigation.formAction === "/admin/media";

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Media</h1>
      </div>
      {banner && (
        <Message
          tone="success"
          title={`"${banner.filename}" was ${banner.verb}.`}
          className={styles.banner}
        />
      )}
      {actionData?.problem && (
        <Message tone="error" title={actionData.problem} className={styles.banner} />
      )}
      <Meter
        label="Storage"
        text={
          storage.limitText
            ? `${storage.usedText} of ${storage.limitText} used`
            : `${storage.usedText} used`
        }
        value={storage.value}
        max={storage.max}
        className={styles.storage}
      />
      {storage.isFull && (
        <p className={styles.full}>
          Your site has used all of its {storage.limitText} of storage. Delete images you no longer
          use to upload more.
        </p>
      )}
      <Form method="post" encType="multipart/form-data" className={styles.uploadForm}>
        <Field
          label="Image"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          required
        />
        <Field
          label="Alt text"
          name="altText"
          hint="Describes the image for screen readers and search engines."
          required
        />
        <Button type="submit" variant="primary" isPending={isUploading}>
          {isUploading ? "Uploading…" : "Upload"}
        </Button>
      </Form>
      {media.length === 0 ? (
        <p className={styles.empty}>No images uploaded yet.</p>
      ) : (
        <ul className={styles.grid}>
          {media.map((item) => (
            <li key={item.id} className={styles.card}>
              <img
                src={item.url}
                alt={item.altText}
                width={item.width}
                height={item.height}
                className={styles.thumb}
              />
              <p className={styles.filename}>{item.filename}</p>
              <p className={styles.meta}>
                {item.width}×{item.height} · {formatFileSize(item.byteSize)}
              </p>
              <p className={styles.meta}>
                {item.uploadedByName ?? DELETED_ACCOUNT} ·{" "}
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
              {item.canDelete && (
                <Link className={styles.delete} to={`/admin/media/${item.id}/delete`}>
                  Delete<span className="visually-hidden"> {item.filename}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Media pages">
          {page > 1 && <Link to={mediaListHref(page - 1)}>Previous</Link>}
          <span className={styles.pageStatus}>
            Page {page} of {totalPages} ({total} images)
          </span>
          {page < totalPages && <Link to={mediaListHref(page + 1)}>Next</Link>}
        </nav>
      )}
    </>
  );
}
