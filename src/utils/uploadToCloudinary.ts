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

export const uploadToCloudinary = async (
  file: Express.Multer.File,
  options: UploadOptions,
) => {
  const image = await uploadImageToCloudinary(file, options);
  return image.url;
};

export const deleteImageFromCloudinary = async (publicId: string) => {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Image deletion failed");
  }
};

// extract Cloudinary public ID from an image URL.
export const extractPublicIdFromUrl = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== "res.cloudinary.com") {
      return null;
    }

    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    const uploadIndex = parts.indexOf("upload");

    if (uploadIndex === -1) return null;

    const publicIdParts = parts.slice(uploadIndex + 1);

    // remove version segment, e.g. v1234567890.
    if (/^v\d+$/.test(publicIdParts[0] ?? "")) {
      publicIdParts.shift();
    }

    if (publicIdParts.length === 0) return null;

    const lastIndex = publicIdParts.length - 1;

    // remove file extension.
    publicIdParts[lastIndex] = publicIdParts[lastIndex].replace(
      /\.[^/.]+$/,
      "",
    );

    return publicIdParts.join("/") || null;
  } catch {
    return null;
  }
};
