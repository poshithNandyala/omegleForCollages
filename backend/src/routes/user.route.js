import { Router } from "express"
import rateLimit from "express-rate-limit"
import {
    registerUser, loginUser, logOutUser, refreshAccessToken,
    getCurrentUser, updateProfile, sendOTP, verifyOTP, getColleges, getOnlineUsers
} from "../controllers/user.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { VerifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: "Too many attempts, please try again later." }
})

// Public
router.route("/register").post(authLimiter, upload.single("avatar"), registerUser)
router.route("/login").post(authLimiter, loginUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/colleges").get(getColleges)
router.route("/send-otp").post(authLimiter, sendOTP)
router.route("/verify-otp").post(authLimiter, verifyOTP)
router.route("/online-count").get(getOnlineUsers)

// Protected
router.route("/logout").post(VerifyJWT, logOutUser)
router.route("/me").get(VerifyJWT, getCurrentUser)
router.route("/profile").patch(VerifyJWT, upload.single("avatar"), updateProfile)

export default router
