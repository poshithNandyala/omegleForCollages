import mongoose, { Schema } from "mongoose"

const otpSchema = new Schema(
    {
        email: { type: String, required: true, lowercase: true, trim: true, index: true },
        otp: { type: String, required: true },
        expiresAt: { type: Date, required: true, index: { expires: 0 } },
        verified: { type: Boolean, default: false },
        attempts: { type: Number, default: 0 }
    },
    { timestamps: true }
)

export const OTP = mongoose.model("OTP", otpSchema)
