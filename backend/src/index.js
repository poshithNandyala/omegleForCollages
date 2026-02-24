import dotenv from 'dotenv'
import { createServer } from 'http'
import { connectDB } from "./db/index.js"
import { app } from './app.js'
import { initializeSocket } from './socket.js'

dotenv.config({ path: '.env' })

const server = createServer(app)

connectDB()
    .then(() => {
        initializeSocket(server)
        const port = process.env.PORT || 8001
        server.listen(port, () => console.log(`CampusConnect running on port ${port} 🚀`))
    })
    .catch((err) => {
        console.log('MongoDB connection failed', err)
        process.exit(1)
    })
