import { Router } from "express";
import {
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
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// * Register User Route
router.route("/register").post(
  // ! Apply the multer middleware
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

// * Login User Route
router.route("/login").post(loginUser);

// ? Secured Routes
// * Logout User Route
router.route("/logout").post(verifyJWT, logoutUser);

// * Refresh Token Route
router.route("/refresh-token").post(refreshAccesssToken);

// * Change Password Route
router.route("/change-password").post(verifyJWT, updateUserPassword);

// * Get Curretnt User Route ( Using Get Methode because user don't send any data)
router.route("/current-user").get(verifyJWT, getCurrentUser);

// * Update User Route
router.route("/update-user").patch(verifyJWT, updateUserDetails); // * By using patch methode only updated the details which user updated.

// * Update Avatar Image Route
router
  .route("/update-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateAvatarImage);

// * Update Cover Image Route
router
  .route("/update-cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateCoverImage);

// * Get User Channel using Params
router.route("/channel/:userName").get(verifyJWT, getUserChannelProfile);

// * Get User Channel using Params
router.route("/watch-history").get(verifyJWT, getWatchHistory);

export default router;
