import { Router } from "express"
import {
    registerUser, loginUser, logOutUser, refreshAccessToken,
    getCurrentUser, updateProfile, sendOTP, verifyOTP, getColleges, getOnlineUsers
} from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { VerifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

// Public
router.route("/register").post(upload.single("avatar"), registerUser)
router.route("/login").post(loginUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/colleges").get(getColleges)
router.route("/send-otp").post(sendOTP)
router.route("/verify-otp").post(verifyOTP)
router.route("/online-count").get(getOnlineUsers)

// Protected
router.route("/logout").post(VerifyJWT, logOutUser)
router.route("/me").get(VerifyJWT, getCurrentUser)
router.route("/profile").patch(VerifyJWT, upload.single("avatar"), updateProfile)

export default router
