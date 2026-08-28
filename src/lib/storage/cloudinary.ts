import "server-only";

import { v2 as cloudinary } from "cloudinary";

import {
  buildObjectName,
  type StorageProvider,
  type StoredImage,
  type UploadInput,
} from "@/lib/storage/types";

/**
 * Cloudinary driver.
 *
 * Files are relayed through our own route handler rather than uploaded from the
 * browser, so `CLOUDINARY_API_SECRET` never reaches the client. Product photos
 * are a few megabytes at most, so the extra hop costs nothing meaningful.
 *
 * Cloudinary does the web optimisation: `quality: auto` and `fetch_format: auto`
 * mean a single stored original is served as AVIF/WebP at an appropriate
 * quality per browser, and an upload-time cap keeps absurd camera dimensions
 * out of the pipeline.
 */
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER ?? "meemiart/products";

const configured = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
}

export const cloudinaryProvider: StorageProvider = {
  name: "Cloudinary",
  isConfigured: configured,

  async upload({ bytes, filename }: UploadInput): Promise<StoredImage> {
    if (!configured) {
      throw new Error(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      );
    }

    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: FOLDER,
          public_id: buildObjectName(filename),
          resource_type: "image",
          overwrite: false,
          // Normalise anything enormous; Cloudinary then derives per-browser
          // variants from this stored original.
          transformation: [
            { width: 2400, height: 2400, crop: "limit" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ],
        },
        (error, uploaded) => {
          if (error) reject(new Error(error.message));
          else if (!uploaded) reject(new Error("Cloudinary returned no result."));
          else resolve(uploaded as unknown as Record<string, unknown>);
        },
      );

      stream.end(bytes);
    });

    return {
      url: String(result.secure_url),
      key: String(result.public_id),
      width: typeof result.width === "number" ? result.width : null,
      height: typeof result.height === "number" ? result.height : null,
      bytes: typeof result.bytes === "number" ? result.bytes : 0,
      format: typeof result.format === "string" ? result.format : null,
    };
  },

  async remove(key: string): Promise<void> {
    if (!configured || !key) return;
    try {
      await cloudinary.uploader.destroy(key, { resource_type: "image" });
    } catch (error) {
      // An image already gone from the CDN should never block the admin from
      // removing the row that points at it.
      console.warn("[storage/cloudinary] delete failed", key, error);
    }
  },
};
