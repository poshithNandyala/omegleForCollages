import { asyncHandler } from "../utils/asyncHandler.js"
import jwt from 'jsonwebtoken'
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"

export const VerifyJWT = asyncHandler(async (req, _, next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    if (!token) throw new ApiError(401, "Authentication required")

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decoded._id).select("-password -refreshToken")
        if (!user) throw new ApiError(401, "Invalid token")
        req.user = user
        next()
    } catch (error) {
        throw new ApiError(error?.statusCode || 401, error?.message || "Invalid token")
    }
})
