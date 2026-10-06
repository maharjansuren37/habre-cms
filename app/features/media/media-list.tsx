import { data, Form, Link, redirect, useNavigation } from "react-router";
import { userContext } from "#app/features/auth/user-context.ts";
import { DELETED_ACCOUNT } from "#app/lib/deleted-account.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Field } from "#app/lib/ui/field.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import { Meter } from "#app/lib/ui/meter.tsx";
import type { Route } from "./+types/media-list";
import { mediaBannerRedirect, readMediaBanner } from "./banner.ts";
import { formatFileSize } from "./file-size.ts";
import { insertMedia, listMedia, storageUsed } from "./media.server.ts";
import {
  altTextSchema,
  detectImage,
  filenameSchema,
  isUploadSizeAllowed,
  MAX_UPLOAD_BYTES,
} from "./media-input.ts";
import styles from "./media-list.module.css";
import { parseMediaListPage } from "./media-list-query.ts";
import { buildMediaUrl } from "./media-url.ts";
import { uploadObject } from "./r2.server.ts";
import { generateStorageKey } from "./storage-key.ts";
import { fitsStorage, formatStorageLimit, storageSummary } from "./storage-limit.ts";

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
  const list = await listMedia(actor.siteId, page);
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
      url: buildMediaUrl(env.R2_PUBLIC_URL, item.storageKey),
      // Matches media.server.ts's `ownedBy`: authors delete only their own,
      // editors and admins delete any.
      canDelete: actor.role !== "author" || item.uploadedBy === actor.id,
    })),
    total: list.total,
    totalPages: list.totalPages,
    page,
    banner,
    storage: storageSummary(await storageUsed(actor.siteId), env.STORAGE_LIMIT_BYTES),
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
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return data({ problem: "Choose an image to upload." }, { status: 400 });
  }
  // The header check above is on the declared size; this is the real one.
  if (file.size > MAX_UPLOAD_BYTES) {
    return data(
      { problem: "This image is larger than 10 MB. Choose a smaller file and try again." },
      { status: 413 },
    );
  }
  const altText = altTextSchema.safeParse(form.get("altText") ?? "");
  if (!altText.success) {
    return data(
      { problem: altText.error.issues[0]?.message ?? "Add alt text before uploading." },
      { status: 400 },
    );
  }
  const filename = filenameSchema.safeParse(file.name);
  if (!filename.success) {
    return data(
      { problem: filename.error.issues[0]?.message ?? "This file has no usable name." },
      { status: 400 },
    );
  }

  const buffer = await file.arrayBuffer();
  const detected = detectImage(new Uint8Array(buffer));
  if (!detected.ok) {
    return data({ problem: "This file is not a JPEG, PNG, WebP or GIF image." }, { status: 400 });
  }

  // Before R2 and before any row. No lock: two uploads at once can each pass by one file (accepted).
  const limit = env.STORAGE_LIMIT_BYTES;
  if (limit !== null && !fitsStorage(await storageUsed(actor.siteId), buffer.byteLength, limit)) {
    return data(
      {
        problem: `This image would take your site past its ${formatStorageLimit(limit)} of storage. Delete images you no longer use, then try again. Paid plans with more storage are coming soon.`,
      },
      { status: 413 },
    );
  }

  const storageKey = generateStorageKey(actor.siteId, detected.extension);
  // R2 object first, then the row (the plan's data rule) - a failure between
  // leaves a harmless orphaned object.
  await uploadObject(storageKey, buffer, detected.mimeType);
  await insertMedia(
    actor.siteId,
    {
      storageKey,
      filename: filename.data,
      mimeType: detected.mimeType,
      byteSize: buffer.byteLength,
      width: detected.width,
      height: detected.height,
      altText: altText.data,
      // Step 3 stores the sizes; until then the upload is kept as sent.
      variantWidths: null,
    },
    actor.id,
  );
  return mediaBannerRedirect("uploaded", filename.data);
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
