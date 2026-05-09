import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadResumePdf(buffer: Buffer, filename: string): Promise<string> {
    const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.pdf$/i, '');
    const publicId = `graphite/resumes/${Date.now()}_${sanitizedName}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', public_id: publicId, overwrite: false },
        (error, result) => {
          if (error || !result) {
            logger.error({ error, filename }, 'Cloudinary upload failed');
            reject(error ?? new Error('Upload returned no result'));
          } else {
            logger.info({ filename, url: result.secure_url }, 'Resume uploaded to Cloudinary');
            resolve(result.secure_url);
          }
        }
      );
      uploadStream.end(buffer);
    });
  }
}
