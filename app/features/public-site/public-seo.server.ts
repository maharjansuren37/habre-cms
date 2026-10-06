import { mediaSources } from "#app/features/media/media-objects.ts";
import { env } from "#app/lib/env.server.ts";

/**
 * Splits a published entry into what its page shows and what its head tags
 * need (item 17, F-108): the search title, description and the share image's
 * absolute URL - never the image's media id or its storage key.
 */
export function splitPublicSeo<
  T extends {
    seoTitle: string;
    seoDescription: string;
    socialImageStorageKey: string | null;
    socialImageVariantWidths: number[] | null;
  },
>({ seoTitle, seoDescription, socialImageStorageKey, socialImageVariantWidths, ...rest }: T) {
  return {
    rest,
    seo: {
      title: seoTitle,
      description: seoDescription,
      imageUrl: socialImageStorageKey
        ? mediaSources(env.R2_PUBLIC_URL, {
            storageKey: socialImageStorageKey,
            variantWidths: socialImageVariantWidths,
          }).social
        : null,
    },
  };
}
