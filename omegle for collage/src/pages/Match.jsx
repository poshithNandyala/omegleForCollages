import { useState, useEffect, useRef, useCallback } from 'react'
import { Shuffle, X, Send, Video, VideoOff, Mic, MicOff, SkipForward, Filter, AlertTriangle, PhoneOff } from 'lucide-react'
import { Button, Select } from '../components/ui'
import { getSocket } from '../lib/socket'
import useAuthStore from '../stores/authStore'
import toast from 'react-hot-toast'

export default function Match() {
    const { user } = useAuthStore()
    const [status, setStatus] = useState('idle')
    const [stranger, setStranger] = useState(null)
    const [roomId, setRoomId] = useState(null)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [filters, setFilters] = useState({ college: 'any', gender: 'any' })
    const [showFilters, setShowFilters] = useState(false)
    const [videoActive, setVideoActive] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [iceServers, setIceServers] = useState([{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }])
    const [showReport, setShowReport] = useState(false)
    const [peerState, setPeerState] = useState('new')

    const messagesEndRef = useRef(null)
    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const peerConnection = useRef(null)
    const localStream = useRef(null)
    const typingTimeout = useRef(null)
    const roomIdRef = useRef(null)
    const pendingCandidates = useRef([])

    const socket = getSocket()

    useEffect(() => { roomIdRef.current = roomId }, [roomId])

    // Fix: Attach stream to video element whenever ref becomes available
    useEffect(() => {
        if (localVideoRef.current && localStream.current) {
            localVideoRef.current.srcObject = localStream.current
        }
    }, [videoActive])

    useEffect(() => {
        if (remoteVideoRef.current && peerConnection.current) {
            const pc = peerConnection.current
            pc.ontrack = (event) => {
                if (remoteVideoRef.current && event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0]
                }
            }
        }
    }, [videoActive])

    const getMediaConstraints = useCallback(() => {
        const mobile = window.innerWidth < 768
        if (mobile) {
            return { video: { width: { ideal: 480 }, height: { ideal: 640 }, facingMode: 'user', frameRate: { ideal: 24 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
        }
        return { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
    }, [])

    const cleanupVideo = useCallback(() => {
        localStream.current?.getTracks().forEach(t => t.stop())
        localStream.current = null
        if (peerConnection.current) {
            peerConnection.current.onicecandidate = null
            peerConnection.current.ontrack = null
            peerConnection.current.oniceconnectionstatechange = null
            peerConnection.current.close()
            peerConnection.current = null
        }
        pendingCandidates.current = []
        if (localVideoRef.current) localVideoRef.current.srcObject = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        setPeerState('new')
    }, [])

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 })

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('ice-candidate', { roomId: roomIdRef.current, candidate: event.candidate })
            }
        }

        pc.ontrack = (event) => {
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0]
            }
        }

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState
            setPeerState(state)
            if (state === 'failed') pc.restartIce()
            if (state === 'disconnected') {
                setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected') pc.restartIce()
                }, 3000)
            }
        }

        peerConnection.current = pc
        return pc
    }, [iceServers, socket])

    useEffect(() => {
        if (!socket) return

        socket.on('waiting', () => setStatus('searching'))
        socket.on('stranger-found', ({ roomId: rId, stranger: s }) => {
            setStatus('connected')
            setStranger(s)
            setRoomId(rId)
            setMessages([])
            toast.success('Stranger found! Say hi 👋')
        })
        socket.on('new-message', ({ senderId, content, timestamp }) => {
            setMessages(prev => [...prev, { fromMe: senderId === socket.id, content, timestamp }])
        })
        socket.on('stranger-typing', () => setIsTyping(true))
        socket.on('stranger-stop-typing', () => setIsTyping(false))
        socket.on('stranger-disconnected', () => {
            setStatus('idle')
            setStranger(null)
            setRoomId(null)
            setMessages(prev => [...prev, { system: true, content: 'Stranger disconnected' }])
            cleanupVideo()
            setVideoActive(false)
            toast('Stranger left', { icon: '👋' })
        })

        socket.on('video-offer', async ({ offer }) => {
            try {
                if (!localStream.current) {
                    const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints())
                    localStream.current = stream
                }
                const pc = createPeerConnection()
                localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current))
                await pc.setRemoteDescription(new RTCSessionDescription(offer))
                for (const c of pendingCandidates.current) {
                    await pc.addIceCandidate(new RTCIceCandidate(c))
                }
                pendingCandidates.current = []
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                socket.emit('video-answer', { roomId: roomIdRef.current, answer })
                setVideoActive(true)
            } catch (err) {
                console.error('video-offer error:', err)
                toast.error('Failed to start video')
            }
        })
        socket.on('video-answer', async ({ answer }) => {
            try {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer))
                for (const c of pendingCandidates.current) {
                    await peerConnection.current?.addIceCandidate(new RTCIceCandidate(c))
                }
                pendingCandidates.current = []
            } catch (err) {
                console.error('video-answer error:', err)
            }
        })
        socket.on('ice-candidate', async ({ candidate }) => {
            try {
                if (peerConnection.current?.remoteDescription) {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate))
                } else {
                    pendingCandidates.current.push(candidate)
                }
            } catch (err) {
                console.error('ice-candidate error:', err)
            }
        })
        socket.on('video-ended', () => {
            cleanupVideo()
            setVideoActive(false)
            toast('Video call ended', { icon: '📹' })
        })
        socket.on('ice-servers', ({ iceServers: servers }) => setIceServers(servers))
        socket.on('report-submitted', () => toast.success('Report submitted'))
        socket.on('account-suspended', () => {
            toast.error('Your account has been suspended')
            window.location.href = '/login'
        })

        return () => {
            ;['waiting','stranger-found','new-message','stranger-typing','stranger-stop-typing',
              'stranger-disconnected','video-offer','video-answer','ice-candidate','video-ended',
              'ice-servers','report-submitted','account-suspended'
            ].forEach(e => socket.off(e))
        }
    }, [socket, cleanupVideo, createPeerConnection, getMediaConstraints])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => () => cleanupVideo(), [cleanupVideo])

    const findStranger = () => {
        if (!socket) { toast.error('Not connected'); return }
        setStatus('searching')
        setMessages([])
        setStranger(null)
        socket.emit('find-stranger', filters)
    }

    const skipStranger = () => {
        if (!socket) return
        socket.emit('skip-stranger')
        cleanupVideo()
        setVideoActive(false)
        setStatus('idle')
        setStranger(null)
        setRoomId(null)
        setMessages([])
    }

    const stopSearching = () => {
        socket?.emit('stop-searching')
        setStatus('idle')
    }

    const sendMessage = (e) => {
        e.preventDefault()
        if (!input.trim() || !socket || !roomId) return
        socket.emit('send-message', { roomId, content: input.trim() })
        setInput('')
        socket.emit('stop-typing', { roomId })
    }

    const handleInputChange = (e) => {
        setInput(e.target.value)
        if (!socket || !roomId) return
        socket.emit('typing', { roomId })
        clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => socket.emit('stop-typing', { roomId }), 1000)
    }

    const startVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints())
            localStream.current = stream
            const pc = createPeerConnection()
            stream.getTracks().forEach(track => pc.addTrack(track, stream))
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.emit('video-offer', { roomId, offer })
            setVideoActive(true)
        } catch {
            toast.error('Camera/mic access denied')
        }
    }

    const endVideo = () => {
        socket?.emit('end-video', { roomId })
        cleanupVideo()
        setVideoActive(false)
    }

    const toggleMute = () => {
        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
            setIsMuted(!isMuted)
        }
    }

    const toggleCamera = () => {
        if (localStream.current) {
            localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
            setIsCameraOff(!isCameraOff)
        }
    }

    const reportUser = (reason) => {
        if (!socket) return
        socket.emit('report-user', { reason })
        setShowReport(false)
    }

    // ==================== OMEGLE-STYLE LAYOUT ====================

    // IDLE STATE — Landing
    if (status === 'idle') {
        return (
            <div className="flex-1 flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)]">
                <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-brand-light dark:bg-brand/10 rounded-3xl flex items-center justify-center mb-6 sm:mb-8">
                        <Shuffle size={36} className="text-brand" />
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 dark:text-zinc-100 mb-3 text-center">Ready to connect?</h1>
                    <p className="text-gray-500 dark:text-zinc-400 mb-6 sm:mb-8 max-w-md text-center text-sm sm:text-lg">
                        You'll be matched with a random verified college student for video or text chat.
                    </p>

                    {/* Filters inline */}
                    <div className="w-full max-w-lg mb-6">
                        <button onClick={() => setShowFilters(!showFilters)}
                            className={`mx-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors mb-4 ${
                                showFilters ? 'bg-brand-light text-brand' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300'
                            }`}>
                            <Filter size={14} /> Filters
                        </button>
                        {showFilters && (
                            <div className="grid grid-cols-2 gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                                <Select label="College" value={filters.college}
                                    onChange={(e) => setFilters({ ...filters, college: e.target.value })}
                                    options={[{ value: 'any', label: 'Any College' }, { value: 'same', label: 'Same College' }]} />
                                <Select label="Gender" value={filters.gender}
                                    onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                                    options={[{ value: 'any', label: 'Anyone' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
                            </div>
                        )}
                    </div>

                    <Button onClick={findStranger} size="lg" className="px-10 py-3.5 text-base">
                        <Shuffle size={20} /> Start
                    </Button>
                </div>
            </div>
        )
    }

    // SEARCHING STATE
    if (status === 'searching') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] px-4">
                <div className="w-16 h-16 border-[3px] border-gray-200 dark:border-zinc-700 border-t-brand rounded-full animate-spin mb-6" />
                <h2 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Looking for someone...</h2>
                <p className="text-gray-500 dark:text-zinc-400 mb-6 text-sm sm:text-base">Hang tight, we're finding a match</p>
                <Button variant="outline" onClick={stopSearching}>Cancel</Button>
            </div>
        )
    }

    // ==================== CONNECTED — OMEGLE LAYOUT ====================
    // Top: Video (side by side) | Bottom: Chat (transparent over dark bg)
    return (
        <div className="flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-gray-950 overflow-hidden">

            {/* ===== VIDEO AREA — Takes up top portion ===== */}
            <div className={`relative shrink-0 ${videoActive ? 'flex-1 min-h-0' : 'h-0'}`}>
                {videoActive && (
                    <div className="grid grid-cols-2 h-full gap-[2px]">
                        {/* Local Video (You) */}
                        <div className="relative bg-gray-900 overflow-hidden">
                            <video
                                ref={localVideoRef}
                                autoPlay muted playsInline
                                className="w-full h-full object-cover"
                                style={{ transform: 'scaleX(-1)' }}
                            />
                            {isCameraOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-800 flex items-center justify-center">
                                        <span className="text-2xl sm:text-3xl font-bold text-gray-400">{user?.fullName?.[0] || 'Y'}</span>
                                    </div>
                                </div>
                            )}
                            <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 text-white text-[10px] sm:text-xs bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-medium">You</span>
                        </div>

                        {/* Remote Video (Stranger) */}
                        <div className="relative bg-gray-900 overflow-hidden">
                            <video
                                ref={remoteVideoRef}
                                autoPlay playsInline
                                className="w-full h-full object-cover"
                            />
                            {peerState !== 'connected' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                                    <div className="text-center">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 border-[3px] border-zinc-700 border-t-brand rounded-full animate-spin mx-auto mb-2 sm:mb-3" />
                                        <p className="text-[10px] sm:text-sm text-gray-400">Connecting...</p>
                                    </div>
                                </div>
                            )}
                            <span className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 text-white text-[10px] sm:text-xs bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-medium">{stranger?.fullName || 'Stranger'}</span>
                            {peerState === 'connected' && (
                                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-[10px] uppercase tracking-wider text-green-400 font-medium hidden sm:inline">Live</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Video Controls — floating center bottom */}
                {videoActive && (
                    <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 z-10">
                        <button onClick={toggleMute}
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'}`}>
                            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                        <button onClick={endVideo}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg shadow-red-500/30">
                            <PhoneOff size={20} />
                        </button>
                        <button onClick={toggleCamera}
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'}`}>
                            {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                        </button>
                    </div>
                )}
            </div>

            {/* ===== CHAT AREA — Bottom portion, dark bg ===== */}
            <div className={`flex flex-col bg-gray-950 ${videoActive ? 'h-[45%] sm:h-[40%]' : 'flex-1'} min-h-0`}>

                {/* Top bar — stranger info + controls */}
                <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {stranger?.avatar ? (
                            <img src={stranger.avatar} alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0 ring-2 ring-brand/30" />
                        ) : (
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xs font-bold shrink-0">
                                {stranger?.fullName?.[0] || '?'}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{stranger?.fullName || 'Stranger'}</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 truncate">{stranger?.college || 'College student'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        {!videoActive && (
                            <button onClick={startVideo} className="p-2 bg-brand/20 text-brand rounded-lg hover:bg-brand hover:text-white transition-all" title="Video call">
                                <Video size={16} />
                            </button>
                        )}
                        <button onClick={skipStranger} className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white/10 text-gray-300 rounded-lg text-xs font-semibold hover:bg-white/20 transition-colors">
                            <SkipForward size={13} /> Next
                        </button>
                        <button onClick={skipStranger} className="sm:hidden p-2 bg-white/10 text-gray-300 rounded-lg">
                            <SkipForward size={15} />
                        </button>
                        <div className="relative">
                            <button onClick={() => setShowReport(!showReport)} className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors" title="Report">
                                <AlertTriangle size={14} />
                            </button>
                            {showReport && (
                                <div className="absolute right-0 bottom-full mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 w-44 z-50">
                                    {['harassment', 'inappropriate', 'spam', 'underage', 'other'].map(reason => (
                                        <button key={reason} onClick={() => reportUser(reason)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 capitalize">
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={skipStranger} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Disconnect">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 space-y-2 min-h-0 no-scrollbar">
                    <div className="text-center py-1.5">
                        <span className="text-[10px] sm:text-xs text-gray-600 bg-white/5 px-3 py-1 rounded-full">
                            Connected with {stranger?.fullName || 'a stranger'}
                        </span>
                    </div>
                    {messages.map((msg, i) => (
                        msg.system ? (
                            <div key={i} className="text-center py-1">
                                <span className="text-[10px] sm:text-xs text-gray-600">{msg.content}</span>
                            </div>
                        ) : (
                            <div key={i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] sm:max-w-[65%] px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm leading-relaxed ${
                                    msg.fromMe
                                        ? 'bg-brand text-white rounded-br-md'
                                        : 'bg-white/10 text-gray-200 rounded-bl-md'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        )
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-md">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="px-3 sm:px-5 py-2.5 sm:py-3 border-t border-white/10 flex gap-2 shrink-0">
                    <input
                        value={input} onChange={handleInputChange}
                        placeholder="Type a message..."
                        className="flex-1 h-10 sm:h-11 px-4 bg-white/10 border border-white/10 text-white placeholder:text-gray-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                        autoComplete="off"
                    />
                    <button type="submit" disabled={!input.trim()}
                        className="h-10 sm:h-11 w-10 sm:w-auto sm:px-5 bg-brand text-white rounded-xl hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-semibold text-sm shrink-0">
                        <Send size={16} />
                        <span className="hidden sm:inline">Send</span>
                    </button>
                </form>
            </div>
        </div>
    )
}
