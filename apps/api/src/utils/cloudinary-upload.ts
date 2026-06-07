import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";

import { assertSafeUpload } from "./upload.js";

export const uploadBufferToCloudinary = async (input: {
  buffer: Buffer;
  originalname: string;
  folder: string;
  mimetype?: string;
}): Promise<string> => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    const safeName = encodeURIComponent(input.originalname.replace(/\s+/g, "-"));
    return `https://cdn.pharmacyos.local/${input.folder}/${Date.now()}-${safeName}`;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: input.folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(input.buffer);
  });
};

export const uploadMulterFileToCloudinary = async (file: Express.Multer.File, folder: string): Promise<string> => {
  assertSafeUpload(file);
  return uploadBufferToCloudinary({
    buffer: file.buffer,
    originalname: file.originalname,
    folder,
    mimetype: file.mimetype
  });
};
