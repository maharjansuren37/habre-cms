import { data, Form, Link, redirect, useNavigation } from "react-router";
import { proposalSchema } from "#app/features/ai/proposal.ts";
import { userContext } from "#app/features/auth/user-context.ts";
import { findMediaByIds } from "#app/features/media/media.server.ts";
import { BrandFields } from "#app/features/settings/brand-fields.tsx";
import { getSiteSettings, saveBrandStep } from "#app/features/settings/settings.server.ts";
import {
  brandColorSchema,
  logoMediaIdSchema,
  stylePresetSchema,
} from "#app/features/settings/settings-input.ts";
import { env } from "#app/lib/env.server.ts";
import { Button } from "#app/lib/ui/button.tsx";
import { Message } from "#app/lib/ui/message.tsx";
import type { Route } from "./+types/start-brand";
import styles from "./onboarding.module.css";
import { findThisRun } from "./this-run.server.ts";

export const handle = { wide: true };

export function meta(_: Route.MetaArgs) {
  return [{ title: "Make it yours - Habre" }];
}

const LOGO_PROBLEM = "That logo could not be saved. Choose it again.";

export async function loader({ context, params }: Route.LoaderArgs) {
  const { siteId } = context.get(userContext);
  const run = await findThisRun(siteId, params.runId);
  const settings = await getSiteSettings(siteId, env.R2_PUBLIC_URL);
  // The result is untrusted: only a proposal that parses gives the AI swatch a colour.
  const proposal = run.status === "succeeded" ? proposalSchema.safeParse(run.result) : null;
  const aiColour = proposal?.success ? proposal.data.brandColor || null : null;
  return { runId: run.id, settings, aiColour };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { siteId } = context.get(userContext);
  const run = await findThisRun(siteId, params.runId);
  const form = await request.formData();
  const values = {
    brandColor: String(form.get("brandColor") ?? ""),
    stylePreset: String(form.get("stylePreset") ?? ""),
  };
  const rawLogoId = form.get("logoMediaId");
  const refuse = (problem: string, errors: { brandColor?: string; stylePreset?: string } = {}) =>
    data({ problem, values: { ...values, errors } }, { status: 400 });

  const brandColor = brandColorSchema.safeParse(values.brandColor);
  const stylePreset = stylePresetSchema.safeParse(values.stylePreset);
  if (!brandColor.success || !stylePreset.success) {
    return refuse("Your choices were not saved.", {
      brandColor: brandColor.error?.issues[0]?.message,
      stylePreset: stylePreset.error?.issues[0]?.message,
    });
  }
  const logoId = logoMediaIdSchema.safeParse(rawLogoId === "" ? null : rawLogoId);
  // A well-formed id can still be another site's or deleted (Settings' F-89 check).
  if (
    !logoId.success ||
    (logoId.data && (await findMediaByIds(siteId, [logoId.data])).length === 0)
  ) {
    return refuse(LOGO_PROBLEM);
  }
  const saved = await saveBrandStep(siteId, {
    logoMediaId: logoId.data,
    brandColor: brandColor.data,
    stylePreset: stylePreset.data,
  });
  if (saved === "logo-gone") return refuse(LOGO_PROBLEM);
  throw redirect(`/start/${run.id}`);
}

export default function StartBrand({ loaderData, actionData }: Route.ComponentProps) {
  const { runId, settings, aiColour } = loaderData;
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle" && navigation.formMethod === "POST";

  return (
    <Form method="post">
      <div className={styles.steps}>
        <span className={styles.bars} aria-hidden="true">
          <span className={`${styles.bar} ${styles.done}`} />
          <span className={`${styles.bar} ${styles.done}`} />
          <span className={`${styles.bar} ${styles.done}`} />
        </span>
        <span>Step 3 of 3</span>
      </div>
      <h1 className={styles.heading}>Make it yours</h1>
      <p className={styles.lede}>Optional. You can change all of this later in Settings.</p>

      {actionData?.problem && (
        <Message tone="error" title={actionData.problem} className={styles.banner} />
      )}

      <BrandFields saved={settings} submitted={actionData?.values} aiColour={aiColour} split />

      <div className={styles.actions}>
        <Button type="submit" variant="primary" className={styles.large} isPending={isSaving}>
          {isSaving ? "Saving…" : "Finish"}
        </Button>
        <Link to={`/start/${runId}`} className={styles.secondaryLink}>
          Skip for now
        </Link>
      </div>
    </Form>
  );
}
