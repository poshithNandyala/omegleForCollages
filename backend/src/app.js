import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import logger from "./utils/logger.js"

const app = express()

// Security headers
app.use(helmet())

// Trust proxy (for Render/Railway/etc behind reverse proxy)
app.set("trust proxy", 1)

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later." }
})

app.use(cors({
    origin: function (origin, callback) {
        const allowed = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || []
        if (!origin || allowed.includes(origin)) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true
}))

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
app.use(cookieParser())

// Health check endpoint (for Render/monitoring)
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() })
})

// Routes
import userRoutes from "./routes/user.route.js"
app.use("/api/v1/users", apiLimiter, userRoutes)

// Error handler
app.use((err, req, res, next) => {
    logger.error(err.message, { stack: err.stack, statusCode: err.statusCode || 500 })
    res.status(err.statusCode || 500).json({
        success: false,
        message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
        errors: err.errors || []
    })
})

export { app }
