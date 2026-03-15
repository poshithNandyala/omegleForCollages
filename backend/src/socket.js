import { Server } from "socket.io"
import jwt from "jsonwebtoken"
import { User } from "./models/user.model.js"
import logger from "./utils/logger.js"

let io

// In-memory queue and pairs (works without Redis for single-server)
const waitingQueue = []
const activePairs = new Map()
const reportCounts = new Map()

async function setupRedisAdapter(io) {
    if (!process.env.REDIS_URL) return
    try {
        const { createClient } = await import("redis")
        const { createAdapter } = await import("@socket.io/redis-adapter")
        const pubClient = createClient({ url: process.env.REDIS_URL, socket: { reconnectStrategy: false } })
        const subClient = pubClient.duplicate()
        pubClient.on("error", () => {})
        subClient.on("error", () => {})
        await Promise.all([pubClient.connect(), subClient.connect()])
        io.adapter(createAdapter(pubClient, subClient))
        logger.info("Redis adapter connected for Socket.IO scaling")
    } catch (err) {
        logger.warn(`Redis adapter failed, using in-memory: ${err.message}`)
    }
}

export const initializeSocket = async (server) => {
    const origins = process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || []

    io = new Server(server, {
        cors: {
            origin: origins,
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    })

    await setupRedisAdapter(io)

    // Auth middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token ||
                          socket.handshake.headers.authorization?.replace("Bearer ", "")
            if (!token) return next(new Error("Authentication required"))
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
            const user = await User.findById(decoded._id).select("-password -refreshToken")
            if (!user) return next(new Error("User not found"))
            if (user.isBanned) return next(new Error("Account suspended"))
            socket.userId = decoded._id
            socket.userData = { fullName: user.fullName, college: user.college, gender: user.gender, avatar: user.avatar, collegeDomain: user.collegeDomain }
            next()
        } catch (error) {
            next(new Error("Invalid token"))
        }
    })

    io.on("connection", async (socket) => {
        logger.info(`Connected: ${socket.userId}`)

        await User.findByIdAndUpdate(socket.userId, { isOnline: true })

        // Send TURN server config if available
        if (process.env.TURN_URL) {
            socket.emit("ice-servers", {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    {
                        urls: process.env.TURN_URL,
                        username: process.env.TURN_USERNAME || "",
                        credential: process.env.TURN_CREDENTIAL || ""
                    }
                ]
            })
        }

        // ========== MATCHING ==========

        socket.on("find-stranger", (filters = {}) => {
            const existingIndex = waitingQueue.findIndex(w => w.socketId === socket.id)
            if (existingIndex !== -1) waitingQueue.splice(existingIndex, 1)

            const matchIndex = waitingQueue.findIndex(w => {
                if (w.userId === socket.userId) return false

                if (filters.college === "same" && w.filters?.college === "same") {
                    if (w.userData?.collegeDomain !== socket.userData?.collegeDomain) return false
                }

                if (w.filters?.gender && w.filters.gender !== "any") {
                    if (socket.userData?.gender !== w.filters.gender) return false
                }
                if (filters.gender && filters.gender !== "any") {
                    if (w.gender !== filters.gender) return false
                }

                return true
            })

            if (matchIndex !== -1) {
                const partner = waitingQueue.splice(matchIndex, 1)[0]

                activePairs.set(socket.id, partner.socketId)
                activePairs.set(partner.socketId, socket.id)

                const roomId = `room:${socket.id}-${partner.socketId}`
                socket.join(roomId)
                io.sockets.sockets.get(partner.socketId)?.join(roomId)

                socket.emit("stranger-found", {
                    roomId,
                    stranger: { fullName: partner.userData?.fullName, college: partner.userData?.college, avatar: partner.userData?.avatar }
                })
                io.to(partner.socketId).emit("stranger-found", {
                    roomId,
                    stranger: { fullName: socket.userData?.fullName, college: socket.userData?.college, avatar: socket.userData?.avatar }
                })

                logger.info(`Matched: ${socket.userId} <-> ${partner.userId}`)
            } else {
                waitingQueue.push({
                    socketId: socket.id,
                    userId: socket.userId,
                    userData: socket.userData,
                    collegeDomain: socket.userData?.collegeDomain,
                    gender: socket.userData?.gender,
                    filters
                })
                socket.emit("waiting", { position: waitingQueue.length })
            }
        })

        socket.on("stop-searching", () => {
            const index = waitingQueue.findIndex(w => w.socketId === socket.id)
            if (index !== -1) waitingQueue.splice(index, 1)
        })

        socket.on("skip-stranger", () => {
            disconnectPair(socket)
        })

        // ========== CHAT ==========

        socket.on("send-message", ({ roomId, content }) => {
            if (!content?.trim()) return
            const sanitized = content.trim().slice(0, 2000)
            const partnerId = activePairs.get(socket.id)
            if (!partnerId) return

            io.to(roomId).emit("new-message", {
                senderId: socket.id,
                content: sanitized,
                timestamp: new Date()
            })
        })

        socket.on("typing", ({ roomId }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) io.to(partnerId).emit("stranger-typing")
        })

        socket.on("stop-typing", ({ roomId }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) io.to(partnerId).emit("stranger-stop-typing")
        })

        // ========== VIDEO CALL ==========

        socket.on("video-offer", ({ roomId, offer }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) io.to(partnerId).emit("video-offer", { offer, from: socket.id })
        })

        socket.on("video-answer", ({ roomId, answer }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) io.to(partnerId).emit("video-answer", { answer, from: socket.id })
        })

        socket.on("ice-candidate", ({ roomId, candidate }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) io.to(partnerId).emit("ice-candidate", { candidate, from: socket.id })
        })

        socket.on("end-video", ({ roomId }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) io.to(partnerId).emit("video-ended")
        })

        // ========== MODERATION ==========

        socket.on("report-user", async ({ reason }) => {
            const partnerId = activePairs.get(socket.id)
            if (!partnerId) return

            const partnerSocket = io.sockets.sockets.get(partnerId)
            if (!partnerSocket) return

            const reportedUserId = partnerSocket.userId
            const count = (reportCounts.get(reportedUserId) || 0) + 1
            reportCounts.set(reportedUserId, count)

            logger.warn(`User reported: ${reportedUserId} by ${socket.userId}, reason: ${reason}, total: ${count}`)

            if (count >= 5) {
                await User.findByIdAndUpdate(reportedUserId, { isBanned: true })
                partnerSocket.emit("account-suspended")
                partnerSocket.disconnect(true)
                logger.warn(`User auto-banned: ${reportedUserId} after ${count} reports`)
            }

            socket.emit("report-submitted")
            disconnectPair(socket)
        })

        // ========== DISCONNECT ==========

        socket.on("disconnect", async () => {
            logger.info(`Disconnected: ${socket.userId}`)
            await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() })

            const queueIndex = waitingQueue.findIndex(w => w.socketId === socket.id)
            if (queueIndex !== -1) waitingQueue.splice(queueIndex, 1)

            disconnectPair(socket)
        })
    })

    return io
}

function disconnectPair(socket) {
    const partnerId = activePairs.get(socket.id)
    if (partnerId) {
        io.to(partnerId).emit("stranger-disconnected")
        activePairs.delete(socket.id)
        activePairs.delete(partnerId)

        const partnerSocket = io.sockets.sockets.get(partnerId)
        if (partnerSocket) {
            partnerSocket.rooms.forEach(room => {
                if (room.startsWith("room:")) partnerSocket.leave(room)
            })
        }
        socket.rooms.forEach(room => {
            if (room.startsWith("room:")) socket.leave(room)
        })
    }
}

export const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized")
    return io
}

export const getOnlineCount = () => {
    return io ? io.engine.clientsCount : 0
}
