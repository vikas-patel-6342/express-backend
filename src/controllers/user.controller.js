import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  //  Steps for Registering New User

  // * 1. Get User Data form Frontend
  const { userName, email, fullName, password } = req.body; // ! JSON data or form data will be handle with req.body

  // * 2. Not Empty and correct email validation to be applied
  if (
    [userName, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required !");
  }

  // ! Email validation
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email.trim())) {
    throw new ApiError(400, "Please Enter Correct Email Address !");
  }

  // * 3. Check if user is already exist or not using => {Email and Username}

  const existingUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, "Username and Email Already exist !");
  }

  // * 4. Files are avilable or not. => (Avatar Image and CoverImage)
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //  const coverImageLocalPath = req.files?.coverIamge[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // ! Check if Avatar Image is available or not
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar Image is Not available !");
  }

  // * 5. Upload Images to the cloudinary.
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // ! Check if avatar image is uploaded or not on cloudinary
  if (!avatar) {
    throw new ApiError(400, "There is a problem in uploading Aavatar Image !");
  }

  // * 7. User object to be created for uploading the data on MongoDB.
  const newUser = await User.create({
    userName: userName.toLowerCase(),
    fullName,
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // ! Check if user is created or not
  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating a User !");
  }

  // * 8. Return the response to the user
  return res
    .status(200)
    .json(
      new ApiResponse(200, "User is Successfully Registered !", createdUser)
    );
});

export { registerUser };
