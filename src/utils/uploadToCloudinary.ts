import cloudinary from "../services/cloudinaryService.ts";

interface UploadOptions {
  folder: string;
}

export const uploadToCloudinary = async (
  file: Express.Multer.File,
  options: UploadOptions,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Image upload failed"));
          return;
        }

        resolve(result.secure_url);
      },
    );

    uploadStream.end(file.buffer);
  });
};
