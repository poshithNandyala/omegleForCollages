import mongoose from "mongoose"
import { DB_NAME } from "../constants.js"

export const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI.replace(/\/$/, '')
        const conn = await mongoose.connect(`${uri}/${DB_NAME}`)
        console.log(`MongoDB Connected: ${conn.connection.host}`)
    } catch (error) {
        console.log('MongoDB connection failed', error)
        process.exit(1)
    }
}
