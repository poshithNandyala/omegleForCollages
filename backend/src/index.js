import dotenv from 'dotenv'
import fs from 'fs'
import { createServer } from 'http'
import { connectDB } from "./db/index.js"

if (!fs.existsSync('./public/temp')) {
    fs.mkdirSync('./public/temp', { recursive: true })
}
import { app } from './app.js'
import { initializeSocket } from './socket.js'
import logger from './utils/logger.js'

dotenv.config({ path: '.env' })

const server = createServer(app)

connectDB()
    .then(async () => {
        await initializeSocket(server)
        const port = process.env.PORT || 8001
        server.listen(port, () => logger.info(`CampusConnect running on port ${port}`))
    })
    .catch((err) => {
        logger.error('MongoDB connection failed', err)
        process.exit(1)
    })
