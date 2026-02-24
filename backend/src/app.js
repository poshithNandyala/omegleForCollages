import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

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

// Routes
import userRoutes from "./routes/user.route.js"
app.use("/api/v1/users", userRoutes)

// Error handler
app.use((err, req, res, next) => {
    console.error(err)
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || []
    })
})

export { app }
