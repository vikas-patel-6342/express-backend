import { ApiError } from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// * Creating Middleware to verify the Access and Refresh Token
export const verifyJWT = asyncHandler((req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    // ! Check if token is Available or Not
    if (!token) {
      throw new ApiError(401, "Unauthorized Request !");
    }

    // * If token is Available decode the token using JWT
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // ! Remove the Refresh Token and Password from the response
    const user = User.findById(decodedToken._id).select(
      "-password -refreshToken"
    );

    // ! Check if User is available or not
    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});
