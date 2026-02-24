import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"
import { ApiError } from "./ApiError.js"
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) throw new ApiError(400, "File path required")
        const response = await cloudinary.uploader.upload(localFilePath, { resource_type: 'auto' })
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        if (localFilePath && fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath)
        throw new ApiError(500, `Upload failed: ${error.message}`)
    }
}

export { uploadOnCloudinary }
