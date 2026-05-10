import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

// ============================================================
// Cloudinary — configured singleton
// ============================================================

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a buffer to Cloudinary and return the secure URL.
 * @param buffer  Raw file bytes
 * @param folder  Cloudinary folder path (e.g. "graphite/avatars")
 * @param publicId  Optional stable public_id so re-uploads overwrite in-place
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: Record<string, any> = {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    };

    if (publicId) {
      options.public_id = publicId;
      options.overwrite = true;
      options.invalidate = true;
    }

    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
      resolve(result.secure_url);
    });

    uploadStream.end(buffer);
  });
}

export { cloudinary };
