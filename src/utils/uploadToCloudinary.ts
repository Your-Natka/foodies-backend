import cloudinary from "../services/cloudinaryService.ts";

interface UploadOptions {
  folder: string;
}

export const uploadImageToCloudinary = async (
  file: Express.Multer.File,
  options: UploadOptions,
): Promise<{ url: string; publicId: string }> => {
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

        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    uploadStream.on("error", reject);
    uploadStream.end(file.buffer);
  });
};

export const uploadToCloudinary = async (file: Express.Multer.File, options: UploadOptions) => {
  const image = await uploadImageToCloudinary(file, options);
  return image.url;
};

export const deleteImageFromCloudinary = async (publicId: string) => {
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Image deletion failed");
  }
};
