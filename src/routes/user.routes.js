import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
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

export default router;
