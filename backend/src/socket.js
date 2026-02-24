import { Server } from "socket.io"
import jwt from "jsonwebtoken"
import { User } from "./models/user.model.js"

let io

// Queue of users waiting to be matched: { socketId, userId, filters }
const waitingQueue = []
// Active pairs: Map<socketId, partnerSocketId>
const activePairs = new Map()

export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN,
            credentials: true
        }
    })

    // Auth middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token ||
                          socket.handshake.headers.authorization?.replace("Bearer ", "")
            if (!token) return next(new Error("Authentication required"))
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
            const user = await User.findById(decoded._id).select("-password -refreshToken")
            if (!user) return next(new Error("User not found"))
            socket.userId = decoded._id
            socket.userData = { fullName: user.fullName, college: user.college, gender: user.gender, avatar: user.avatar }
            next()
        } catch (error) {
            next(new Error("Invalid token"))
        }
    })

    io.on("connection", async (socket) => {
        console.log(`Connected: ${socket.userId}`)

        // Mark user online
        await User.findByIdAndUpdate(socket.userId, { isOnline: true })

        // ========== MATCHING (Omegle-style) ==========

        // User wants to find a stranger
        // filters: { college: "any" | "same", gender: "any" | "male" | "female" | "other" }
        socket.on("find-stranger", (filters = {}) => {
            // Remove from queue if already waiting
            const existingIndex = waitingQueue.findIndex(w => w.socketId === socket.id)
            if (existingIndex !== -1) waitingQueue.splice(existingIndex, 1)

            // Try to find a match
            const matchIndex = waitingQueue.findIndex(w => {
                if (w.userId === socket.userId) return false // don't match self

                // College filter
                if (filters.college === "same" && w.filters?.college === "same") {
                    if (w.collegeDomain !== socket.userData?.college) return false
                }

                // Gender filter from the waiting person
                if (w.filters?.gender && w.filters.gender !== "any") {
                    if (socket.userData?.gender !== w.filters.gender) return false
                }
                // Gender filter from the searching person
                if (filters.gender && filters.gender !== "any") {
                    if (w.gender !== filters.gender) return false
                }

                return true
            })

            if (matchIndex !== -1) {
                const partner = waitingQueue.splice(matchIndex, 1)[0]

                // Create pair
                activePairs.set(socket.id, partner.socketId)
                activePairs.set(partner.socketId, socket.id)

                // Create a room for them
                const roomId = `room:${socket.id}-${partner.socketId}`
                socket.join(roomId)
                io.sockets.sockets.get(partner.socketId)?.join(roomId)

                // Notify both users they're matched
                socket.emit("stranger-found", {
                    roomId,
                    stranger: { fullName: partner.userData?.fullName, college: partner.userData?.college, avatar: partner.userData?.avatar }
                })
                io.to(partner.socketId).emit("stranger-found", {
                    roomId,
                    stranger: { fullName: socket.userData?.fullName, college: socket.userData?.college, avatar: socket.userData?.avatar }
                })
            } else {
                // Add to queue
                waitingQueue.push({
                    socketId: socket.id,
                    userId: socket.userId,
                    userData: socket.userData,
                    collegeDomain: socket.userData?.college,
                    gender: socket.userData?.gender,
                    filters
                })
                socket.emit("waiting", { position: waitingQueue.length })
            }
        })

        // Stop searching
        socket.on("stop-searching", () => {
            const index = waitingQueue.findIndex(w => w.socketId === socket.id)
            if (index !== -1) waitingQueue.splice(index, 1)
        })

        // Skip / Next stranger
        socket.on("skip-stranger", () => {
            disconnectPair(socket)
        })

        // ========== CHAT ==========

        socket.on("send-message", ({ roomId, content }) => {
            if (!content?.trim()) return
            const partnerId = activePairs.get(socket.id)
            if (!partnerId) return

            io.to(roomId).emit("new-message", {
                sender: socket.id === [...activePairs.entries()].find(([k, v]) => v === partnerId)?.[0] ? "you" : "stranger",
                senderId: socket.id,
                content: content.trim(),
                timestamp: new Date()
            })
        })

        socket.on("typing", ({ roomId }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) {
                io.to(partnerId).emit("stranger-typing")
            }
        })

        socket.on("stop-typing", ({ roomId }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) {
                io.to(partnerId).emit("stranger-stop-typing")
            }
        })

        // ========== VIDEO CALL (WebRTC Signaling) ==========

        socket.on("video-offer", ({ roomId, offer }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) {
                io.to(partnerId).emit("video-offer", { offer, from: socket.id })
            }
        })

        socket.on("video-answer", ({ roomId, answer }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) {
                io.to(partnerId).emit("video-answer", { answer, from: socket.id })
            }
        })

        socket.on("ice-candidate", ({ roomId, candidate }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) {
                io.to(partnerId).emit("ice-candidate", { candidate, from: socket.id })
            }
        })

        socket.on("end-video", ({ roomId }) => {
            const partnerId = activePairs.get(socket.id)
            if (partnerId) {
                io.to(partnerId).emit("video-ended")
            }
        })

        // ========== DISCONNECT ==========

        socket.on("disconnect", async () => {
            console.log(`Disconnected: ${socket.userId}`)
            await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: new Date() })

            // Remove from queue
            const queueIndex = waitingQueue.findIndex(w => w.socketId === socket.id)
            if (queueIndex !== -1) waitingQueue.splice(queueIndex, 1)

            // Disconnect pair
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

        // Leave rooms
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
