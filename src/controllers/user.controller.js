import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

// ! Generate Access and Refresh Toke
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    //console.log(accessToken, refreshToken);

    // * Add the refresh token in the database
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // * Return the Access and Refresh Token
    return { accessToken, refreshToken };
    // ** //
  } catch (error) {
    throw new ApiError(
      500,
      "There is a problem in generating Access and Refresh Token"
    );
  }
};

// ! Register User
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

// ! Login User
const loginUser = asyncHandler(async (req, res) => {
  // Steps for User Login

  // * 1. Get the data from the user
  const { userName, email, password } = req.body;

  // ! 2. Check if username or email is available or not
  if (!(userName || email)) {
    throw new ApiError(400, "Username or Email is Required !");
  }

  // * 3. Find the Username or Email in the database
  const user = await User.findOne({
    $or: [{ email }, { userName }],
  });

  // ! 4. Check if user data is available or not in the database
  if (!user) {
    throw new ApiError(404, "User Not Found !");
  }

  // ! 5. Check the password of the user
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Inavlid Login Credentials ! ");
  }

  // * 6 Call the Refresh and Access Token from the above method
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // * 7 Remove the fields from the Response
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // * 8 Send the data in the cookies
  const cookieOptions = {
    httpOnly: true,
    secure: true, // ! Only Accessable and Changeble By Server
  };

  // * 9. Send the Response to the User
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(200, "User Logged In Successfully !", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    // * Find the user Using req.user / "Auth" middleware
    req.user._id,
    {
      // * Update the Refresh Token
      $set: {
        refreshToken: undefined,
      },
    },
    {
      // * Enter the New Entry
      new: true,
    }
  );

  // * Cookie Options
  const cookieOptions = {
    httpOnly: true,
    secure: true,
  };

  // * Return the response and Clear theCookies
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, "User Logged Out Successfully", {}));
});

export { registerUser, loginUser, logoutUser };
