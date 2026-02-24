import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import { getCollegeByEmail, isValidCollegeEmail } from '../utils/colleges.js';
import { OTP } from '../models/otp.model.js';
import { sendOTPEmail, generateOTP } from '../utils/email.js';

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        if (!user) {
            throw new ApiError(404, "USER NOT FOUND FROM generateAccessAndRefreshTokens FUNCTION")
        }

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken

        await user.save({
            validateBeforeSave: false
        })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "SOMETHING WENT WRONG WHILE GENERATING ACCESS AND REFRESH TOKENS", error)
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password, gender, interests } = req.body

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "ALL FIELDS ARE REQUIRED")
    }

    if (!isValidCollegeEmail(email)) {
        throw new ApiError(400, "PLEASE USE A VALID CAMPUS EMAIL (.edu, .ac.in, etc.)")
    }

    const otpRecord = await OTP.findOne({
        email: email.toLowerCase(),
        verified: true,
        expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
        throw new ApiError(400, "Email not verified. Please verify your email first.");
    }

    const collegeInfo = getCollegeByEmail(email);

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "USER ALREADY EXISTS")
    }

    let avatarUrl = undefined;
    const avatarFile = req.file || req.files?.avatar?.[0];
    if (avatarFile?.path) {
        const avatar = await uploadOnCloudinary(avatarFile.path);
        if (avatar) {
            avatarUrl = avatar.url;
        }
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        college: collegeInfo.name,
        collegeDomain: collegeInfo.domain,
        avatar: avatarUrl,
        gender: gender || 'prefer-not-to-say',
        interests: interests ? (Array.isArray(interests) ? interests : JSON.parse(interests)) : []
    })

    const createdUser = await User.findOne(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "USER NOT CREATED")
    }

    await OTP.deleteMany({ email: email.toLowerCase() });

    return res.status(201).json(
        new ApiResponse(201, createdUser, "USER CREATED SUCCESSFULLY")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body

    if (!username && !email) {
        throw new ApiError(400, "USERNAME OR EMAIL IS REQUIRED")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "USER NOT FOUND")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(400, "INCORRECT PASSWORD")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "USER LOGGED IN SUCCESSFULLY"
            )
        )
})

const logOutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, null, "USER LOGGED OUT SUCCESSFULLY")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token missing. Please log in again.");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        if (!decodedToken) {
            throw new ApiError(401, "Invalid refresh token. Please log in again.");
        }

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(404, "User not found. Please log in again.");
        }

        if (user?.refreshToken !== incomingRefreshToken) {
            throw new ApiError(403, "Refresh token mismatch. Please log in again.");
        }

        const options = {
            httpOnly: true,
            secure: true
        };

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken: accessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token successfully refreshed."
                )
            );
    } catch (error) {
        throw new ApiError(401, "Token refresh failed. Please try logging in again.");
    }
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, req.user, "USER DATA FETCHED SUCCESSFULLY")
    )
})

const updateProfile = asyncHandler(async (req, res) => {
    const { fullName, bio, gender, interests } = req.body
    const updateData = {}
    if (fullName) updateData.fullName = fullName
    if (bio !== undefined) updateData.bio = bio
    if (gender) updateData.gender = gender
    if (interests) updateData.interests = interests

    // Handle avatar upload
    const avatarFile = req.file
    if (avatarFile?.path) {
        const avatar = await uploadOnCloudinary(avatarFile.path)
        if (avatar) updateData.avatar = avatar.url
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updateData },
        { new: true, runValidators: true }
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200, user, "Profile updated"))
})

const sendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    if (!isValidCollegeEmail(email)) {
        throw new ApiError(400, "Please use a valid college/university email (.edu, .ac.in, etc.)");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        throw new ApiError(409, "An account with this email already exists");
    }

    await OTP.deleteMany({ email: email.toLowerCase() });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
        email: email.toLowerCase(),
        otp,
        expiresAt
    });

    await sendOTPEmail(email, otp);

    return res.status(200).json(
        new ApiResponse(200, { email }, "OTP sent successfully. Check your email.")
    );
});

const verifyOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        throw new ApiError(400, "Email and OTP are required");
    }

    const otpRecord = await OTP.findOne({
        email: email.toLowerCase(),
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
        throw new ApiError(400, "OTP expired or not found. Please request a new one.");
    }

    if (otpRecord.attempts >= 5) {
        await OTP.deleteMany({ email: email.toLowerCase() });
        throw new ApiError(429, "Too many failed attempts. Please request a new OTP.");
    }

    if (otpRecord.otp !== otp) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw new ApiError(400, `Incorrect OTP. ${5 - otpRecord.attempts} attempts remaining.`);
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return res.status(200).json(
        new ApiResponse(200, { email, verified: true }, "Email verified successfully")
    );
});

const getColleges = asyncHandler(async (req, res) => {
    const { getAllColleges } = await import('../utils/colleges.js');
    return res.status(200).json(
        new ApiResponse(200, getAllColleges(), "COLLEGES FETCHED SUCCESSFULLY")
    );
});

const getOnlineUsers = asyncHandler(async (req, res) => {
    const count = await User.countDocuments({ isOnline: true })
    return res.status(200).json(new ApiResponse(200, { count }, "Online count fetched"))
})

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    getCurrentUser,
    updateProfile,
    sendOTP,
    verifyOTP,
    getColleges,
    getOnlineUsers
}
