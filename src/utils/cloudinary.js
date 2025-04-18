import { v2 as cloudinary } from "cloudinary";
import { log } from "console";
import fs from "fs";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET_KEY,
});

// Upload on Cloudinary
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath)
      return console.log("There is problem in uploading file");

    // Upload on Clodinary
    const fileResponse = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // If file is successfully uploaded on clodinary
    console.log(
      "File is successfully uploaded on cloudinary",
      fileResponse.url
    );

    return fileResponse;
  } catch (error) {
    fs.unlinkSync(localFilePath); // Remove the temporary file from the database / server when upload is failed.

    return null;
  }
};

export { uploadOnCloudinary };
