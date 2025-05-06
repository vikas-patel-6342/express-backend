import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

// ? Cookies Options
const cookieOptions = {
  httpOnly: true,
  secure: true, // ! Only Accessable and Changeble By Server
};

// ? Generate Access and Refresh Token
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    // * Add and Save the refresh token in the database
    user.refreshToken = refreshToken;
    // * Save
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

// ? Register User
const registerUser = asyncHandler(async (req, res) => {
  //  Steps for Registering New User

  // * 1. Get User Data form Frontend / User
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

  // * 3. Check if user is already exist or not using => {Email or Username}

  const existingUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, "Username or Email Already exist !");
  }

  // * 4. Files are avilable or not. => (Avatar Image and CoverImage)
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //  const coverImageLocalPath = req.files?.coverIamge[0]?.path;

  // ! If Cover Image is Available or Not Available
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
    coverImage: coverImage?.url || "Cover Image Not Uploaded !",
  });

  // ! Remove the password and refresh token fields from the Response
  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  // ! Check if user is created or not
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

// ? Login User
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

  // * 7 Remove the Password and Refresh Token from the Response
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // * 8. Send the Response to the User
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

// ? Logout User
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

  // * Return the response and Clear theCookies
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, "User Logged Out Successfully", {}));
});

// ? Refresh the Access Token
const refreshAccesssToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  // ! Check if Refresh token is coming or not
  if (!incomingRefreshToken) {
    throw new ApiError(400, "Unauthorized User !");
  }

  try {
    // * Decode the Incoming Refresh Token
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // * Find the User using Decoded Token from the database
    const user = await User.findById(decodedToken?._id);

    // ! Check if User is available or Not
    if (!user) {
      throw new ApiError(401, "Inavlid Refresh Token");
    }

    // ! Match the incoming Refresh token and Refresh token from Database
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is Expired !");
    }

    // * Generate the Access and refresh Token
    const { accessToken, newRefreshToken } = generateAccessAndRefreshToken(
      user._id
    );

    // * Return the Response
    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, cookieOptions)
      .json(
        new ApiResponse(200, "Access Token Refreshed Successfully !", {
          accessToken,
          refreshToken: newRefreshToken,
        })
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh Token !");
  }
});

// ? Update User Password
const updateUserPassword = asyncHandler(async (req, res) => {
  // * Find the User using JWT Middleware
  const user = await User.findById(req.user?._id);

  // * Get Old Password and New Password from User
  const { oldPassword, newPassword } = req.body;

  // ! Check if old password is correct or not
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password");
  }

  // * Add the new password
  user.password = newPassword;

  // * Save Password to the database
  await user.save({ validateBeforeSave: false });

  // * Return the response
  return res
    .status(200)
    .json(new ApiResponse(200, "Password Updated Successfully !", {}));
});

// ? Get Current User
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, "Current User Fetched Successfylly", req.user));
});

// ? Update User Details
const updateUserDetails = asyncHandler(async (req, res) => {
  // * Get the data from the user
  const { fullName, email } = req.body;

  // ! Check User enters the email or fullname
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required !");
  }

  // * Find the User details from the database using JWT
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    // * Update the User Details
    {
      $set: { fullName, email },
    },
    // * Get the Updated information in the response
    { new: true }
  ).select("-password");

  // * Return the Response
  return res
    .status(200)
    .json(new ApiResponse(200, "User Data Updated Successfully !", {}));
});

// ? Avatart Image Update
const updateAvatarImage = asyncHandler(async (req, res) => {
  // * Get the file from User using Multer Middleware
  const avatarLocalPath = await req.file?.path;

  // ! Check Avatar Image is available or Not
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar Image is Missing !");
  }

  // * Upload Avatar image on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // ! Check the image is uploaded on cloudinary or not
  if (!avatar.url) {
    throw new ApiError(400, "There is problem in updating Avatar Image !");
  }

  // * Update the Avatar Image in the database
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        // * Update Avatar url
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  // * Return the Response
  return res
    .status(200)
    .json(new ApiResponse(200, "Avatar Image Updated Successfully !", user));
});

// ? Cover Image Update
const updateCoverImage = asyncHandler(async (req, res) => {
  // * Get the file from User using Multer Middleware
  const coverImageLocalPath = await req.file?.path;

  // ! Check Cover Image is available or Not
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image is Missing !");
  }

  // * Upload Cover image on cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // ! Check the image is uploaded on cloudinary or not
  if (!coverImage.url) {
    throw new ApiError(400, "There is problem in updating Cover Image !");
  }

  // * Update the Cover Image in the database
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        // * Update Avatar url
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  // * Return the Response
  return res
    .status(200)
    .json(new ApiResponse(200, "Cover Image Updated Successfully !", user));
});

// ? Get the Channel Profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
  // * Get the user from the url
  const { userName } = req.params;

  // ! Check if username is available or not
  if (!userName?.trim()) {
    throw new ApiError(400, "User is Missing ?");
  }

  // * Use Aggregation Pipeline
  const channel = await User.aggregate([
    // * Match the Username
    {
      $match: {
        userName: userName?.toLowerCase(),
      },
    },
    // * Find the Subscriber of the User
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    // * Find how many channels are subscribed by user
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    // * Add fields in the User Model
    {
      $addFields: {
        // * Add count of Subscribers in the user Model
        subscriberCount: {
          $size: "$subscribers",
        },
        // * Add count of channel subscribed by user in the user model
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },

        // * Find that the channel is subscribed or not
        isSubscribed: {
          $cond: {
            if: { $in: [req.body.user?._id, "$subscribers.subscribe"] },
            then: true,
            else: false,
          },
        },
      },
    },

    // * Send the data
    {
      $project: {
        fullName: 1,
        userName: 1,
        avatar: 1,
        coverImage: 1,
        subscriberCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);

  console.log(channel);

  // ! Check if channel is available or not
  if (!channel?.length) {
    throw new ApiError(404, "Channel Not Found !");
  }

  // * Return the response
  return res
    .status(200)
    .json(new ApiResponse(200, "Channel Fetched Successfully", channel[0]));
});

// * Get User Watch History
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccesssToken,
  updateUserPassword,
  getCurrentUser,
  updateUserDetails,
  updateAvatarImage,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
