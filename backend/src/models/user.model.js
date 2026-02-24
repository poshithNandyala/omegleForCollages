import mongoose, { Schema } from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { isValidCollegeEmail } from "../utils/colleges.js"

const userSchema = new Schema(
    {
        username: {
            type: String, required: true, unique: true,
            lowercase: true, trim: true, index: true
        },
        email: {
            type: String, required: true, unique: true,
            lowercase: true, trim: true,
            validate: {
                validator: (v) => isValidCollegeEmail(v),
                message: props => `${props.value} is not a valid college email`
            }
        },
        fullName: { type: String, required: true, trim: true },
        college: { type: String, required: true, trim: true },
        collegeDomain: { type: String, required: true, trim: true, lowercase: true },
        avatar: {
            type: String,
            default: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
        },
        password: { type: String, required: [true, "Password is required"] },
        gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'], default: 'prefer-not-to-say' },
        bio: { type: String, maxlength: 200, default: '' },
        interests: [{ type: String, trim: true }],
        isOnline: { type: Boolean, default: false },
        lastSeen: { type: Date, default: Date.now },
        refreshToken: { type: String }
    },
    { timestamps: true }
)

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName,
            college: this.college,
            collegeDomain: this.collegeDomain
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { _id: this._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    )
}

export const User = mongoose.model("User", userSchema)
