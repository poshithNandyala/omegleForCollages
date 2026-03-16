import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Video, VideoOff, Mic, MicOff, SkipForward, Filter, AlertTriangle, PhoneOff, MessageCircle, ChevronLeft, Sparkles, Users, X } from 'lucide-react'
import { Select } from '../components/ui'
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
    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [iceServers, setIceServers] = useState([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ])
    const [showReport, setShowReport] = useState(false)
    const [peerState, setPeerState] = useState('new')
    const [localReady, setLocalReady] = useState(false)
    const [remoteReady, setRemoteReady] = useState(false)
    const [chatOpen, setChatOpen] = useState(false)
    const [matchCount, setMatchCount] = useState(0)
    const [callDuration, setCallDuration] = useState(0)
    const [showConnectedFlash, setShowConnectedFlash] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [swipeOffset, setSwipeOffset] = useState(0)
    const [isSwiping, setIsSwiping] = useState(false)

    const messagesEndRef = useRef(null)
    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const peerConnection = useRef(null)
    const localStream = useRef(null)
    const typingTimeout = useRef(null)
    const roomIdRef = useRef(null)
    const pendingCandidates = useRef([])
    const iceRestartTimer = useRef(null)
    const callTimer = useRef(null)
    const touchStart = useRef({ x: 0, y: 0 })
    const swipeThreshold = 100

    const socket = getSocket()

    useEffect(() => { roomIdRef.current = roomId }, [roomId])

    useEffect(() => {
        if (localVideoRef.current && localStream.current) {
            localVideoRef.current.srcObject = localStream.current
        }
    }, [localReady])

    // Call duration timer
    useEffect(() => {
        if (status === 'connected' && remoteReady) {
            callTimer.current = setInterval(() => setCallDuration(d => d + 1), 1000)
        } else {
            clearInterval(callTimer.current)
            setCallDuration(0)
        }
        return () => clearInterval(callTimer.current)
    }, [status, remoteReady])

    // Track unread messages when chat is closed
    useEffect(() => {
        if (chatOpen) setUnreadCount(0)
    }, [chatOpen])

    const formatDuration = (s) => {
        const m = Math.floor(s / 60)
        const sec = s % 60
        return `${m}:${sec.toString().padStart(2, '0')}`
    }

    const getConstraints = useCallback(() => {
        const mobile = window.innerWidth < 768
        return {
            video: {
                width: { ideal: mobile ? 480 : 1280 },
                height: { ideal: mobile ? 640 : 720 },
                facingMode: 'user',
                frameRate: { ideal: mobile ? 24 : 30 }
            },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        }
    }, [])

    const cleanup = useCallback(() => {
        clearTimeout(iceRestartTimer.current)
        clearInterval(callTimer.current)
        localStream.current?.getTracks().forEach(t => t.stop())
        localStream.current = null
        if (peerConnection.current) {
            peerConnection.current.onicecandidate = null
            peerConnection.current.ontrack = null
            peerConnection.current.oniceconnectionstatechange = null
            peerConnection.current.onnegotiationneeded = null
            peerConnection.current.close()
            peerConnection.current = null
        }
        pendingCandidates.current = []
        if (localVideoRef.current) localVideoRef.current.srcObject = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        setLocalReady(false)
        setRemoteReady(false)
        setPeerState('new')
        setCallDuration(0)
        setShowConnectedFlash(false)
    }, [])

    const getLocalStream = useCallback(async () => {
        if (localStream.current) return localStream.current
        const stream = await navigator.mediaDevices.getUserMedia(getConstraints())
        localStream.current = stream
        setLocalReady(true)
        return stream
    }, [getConstraints])

    const makePeer = useCallback((stream) => {
        const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 })
        stream.getTracks().forEach(t => pc.addTrack(t, stream))

        pc.onicecandidate = (e) => {
            if (e.candidate && socket) {
                socket.emit('ice-candidate', { roomId: roomIdRef.current, candidate: e.candidate })
            }
        }

        pc.ontrack = (e) => {
            if (remoteVideoRef.current && e.streams[0]) {
                remoteVideoRef.current.srcObject = e.streams[0]
                remoteVideoRef.current.play().catch(() => {})
                setRemoteReady(true)
                setShowConnectedFlash(true)
                setTimeout(() => setShowConnectedFlash(false), 1500)
            }
        }

        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState
            setPeerState(s)
            clearTimeout(iceRestartTimer.current)
            if (s === 'failed') {
                pc.restartIce()
            } else if (s === 'disconnected') {
                iceRestartTimer.current = setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected') pc.restartIce()
                }, 3000)
            } else if (s === 'connected' || s === 'completed') {
                setRemoteReady(true)
            }
        }

        peerConnection.current = pc
        return pc
    }, [iceServers, socket])

    useEffect(() => {
        if (!socket) return

        socket.on('waiting', () => setStatus('searching'))

        socket.on('stranger-found', async ({ roomId: rId, stranger: s, initiator }) => {
            setStatus('connected')
            setStranger(s)
            setRoomId(rId)
            setMessages([])
            setChatOpen(false)
            setRemoteReady(false)
            setPeerState('new')
            setUnreadCount(0)
            setMatchCount(c => c + 1)
            toast.success('Matched! 🎉', { icon: '✨', style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(124,58,237,0.3)' } })

            if (initiator) {
                try {
                    const stream = await getLocalStream()
                    const pc = makePeer(stream)
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    socket.emit('video-offer', { roomId: rId, offer })
                } catch {
                    toast.error('Camera/mic access denied')
                }
            }
        })

        socket.on('new-message', ({ senderId, content, timestamp }) => {
            setMessages(prev => [...prev, { fromMe: senderId === socket.id, content, timestamp }])
            if (senderId !== socket.id) {
                setUnreadCount(c => c + 1)
            }
        })
        socket.on('stranger-typing', () => setIsTyping(true))
        socket.on('stranger-stop-typing', () => setIsTyping(false))

        socket.on('stranger-disconnected', () => {
            setStatus('idle')
            setStranger(null)
            setRoomId(null)
            setMessages(prev => [...prev, { system: true, content: 'Stranger disconnected' }])
            cleanup()
            toast('Stranger left 👋', { style: { background: '#1a1a2e', color: '#fff' } })
        })

        socket.on('video-offer', async ({ offer }) => {
            try {
                const stream = await getLocalStream()
                const pc = makePeer(stream)
                await pc.setRemoteDescription(new RTCSessionDescription(offer))
                for (const c of pendingCandidates.current) {
                    await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
                }
                pendingCandidates.current = []
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                socket.emit('video-answer', { roomId: roomIdRef.current, answer })
            } catch (err) {
                console.error('video-offer error:', err)
                toast.error('Video connection failed')
            }
        })

        socket.on('video-answer', async ({ answer }) => {
            try {
                if (!peerConnection.current) return
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
                for (const c of pendingCandidates.current) {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
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
            } catch {}
        })

        socket.on('video-ended', () => cleanup())
        socket.on('ice-servers', ({ iceServers: s }) => setIceServers(s))
        socket.on('report-submitted', () => toast.success('Report submitted'))
        socket.on('account-suspended', () => {
            toast.error('Account suspended')
            window.location.href = '/login'
        })

        return () => {
            ;['waiting','stranger-found','new-message','stranger-typing','stranger-stop-typing',
              'stranger-disconnected','video-offer','video-answer','ice-candidate','video-ended',
              'ice-servers','report-submitted','account-suspended'
            ].forEach(e => socket.off(e))
        }
    }, [socket, cleanup, getLocalStream, makePeer])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => () => cleanup(), [cleanup])

    // ========== SWIPE HANDLERS (mobile) ==========
    const handleTouchStart = (e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        setIsSwiping(false)
    }

    const handleTouchMove = (e) => {
        const dx = e.touches[0].clientX - touchStart.current.x
        const dy = e.touches[0].clientY - touchStart.current.y
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15) {
            setIsSwiping(true)
            setSwipeOffset(dx * 0.4)
        }
    }

    const handleTouchEnd = () => {
        if (Math.abs(swipeOffset) > swipeThreshold) {
            if (swipeOffset < 0) {
                nextStranger()
            } else {
                disconnect()
            }
        }
        setSwipeOffset(0)
        setIsSwiping(false)
    }

    const findStranger = () => {
        if (!socket) { toast.error('Not connected'); return }
        setStatus('searching')
        setMessages([])
        setStranger(null)
        socket.emit('find-stranger', filters)
    }

    const disconnect = () => {
        if (!socket) return
        socket.emit('skip-stranger')
        cleanup()
        setStatus('idle')
        setStranger(null)
        setRoomId(null)
        setMessages([])
    }

    const nextStranger = () => {
        disconnect()
        setRemoteReady(false)
        setTimeout(() => findStranger(), 300)
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

    const handleInput = (e) => {
        setInput(e.target.value)
        if (!socket || !roomId) return
        socket.emit('typing', { roomId })
        clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => socket.emit('stop-typing', { roomId }), 1000)
    }

    const toggleMute = () => {
        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
            setIsMuted(p => !p)
        }
    }

    const toggleCam = () => {
        if (localStream.current) {
            localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
            setIsCameraOff(p => !p)
        }
    }

    const reportUser = (reason) => {
        if (!socket) return
        socket.emit('report-user', { reason })
        setShowReport(false)
    }

    // ===================== IDLE — PREMIUM LANDING =====================
    if (status === 'idle') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-gray-950 px-4 relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-brand/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-[120px]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="w-32 h-32 rounded-full border border-brand/10 animate-pulse-ring" />
                    </div>
                </div>

                <div className="relative z-10 flex flex-col items-center">
                    {/* Icon with glow */}
                    <div className="relative mb-8 animate-float-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
                        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-brand to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl animate-glow-pulse">
                            <Video size={40} className="text-white" />
                        </div>
                        {/* Orbiting dot */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-orbit">
                            <div className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
                        </div>
                    </div>

                    <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-3 text-center animate-float-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
                        Start Matching
                    </h1>
                    <p className="text-gray-400 mb-8 sm:mb-10 max-w-md text-center text-sm sm:text-lg leading-relaxed animate-float-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
                        Video chat with verified college students.<br className="hidden sm:block" />
                        Camera starts automatically when matched.
                    </p>

                    {/* Match stats */}
                    {matchCount > 0 && (
                        <div className="flex items-center gap-2 mb-6 px-4 py-2 rounded-full glass animate-float-up" style={{ animationDelay: '0.35s', opacity: 0 }}>
                            <Sparkles size={14} className="text-brand" />
                            <span className="text-xs text-gray-300 font-medium">{matchCount} matches this session</span>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="w-full max-w-sm mb-8 animate-float-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
                        <button onClick={() => setShowFilters(!showFilters)}
                            className={`mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all mb-3 ${
                                showFilters ? 'bg-brand/20 text-brand border border-brand/30' : 'glass text-gray-400 hover:text-white'
                            }`}>
                            <Filter size={14} /> Filters
                            {(filters.college !== 'any' || filters.gender !== 'any') && (
                                <div className="w-1.5 h-1.5 bg-brand rounded-full" />
                            )}
                        </button>
                        {showFilters && (
                            <div className="grid grid-cols-2 gap-3 glass rounded-2xl p-4 animate-slide-up">
                                <Select label="College" value={filters.college}
                                    onChange={(e) => setFilters({ ...filters, college: e.target.value })}
                                    options={[{ value: 'any', label: 'Any College' }, { value: 'same', label: 'Same College' }]} />
                                <Select label="Gender" value={filters.gender}
                                    onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                                    options={[{ value: 'any', label: 'Anyone' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
                            </div>
                        )}
                    </div>

                    {/* Big CTA */}
                    <div className="animate-float-up" style={{ animationDelay: '0.5s', opacity: 0 }}>
                        <button onClick={findStranger}
                            className="group relative px-12 py-4 sm:px-14 sm:py-5 bg-gradient-to-r from-brand to-purple-600 text-white rounded-2xl font-bold text-lg sm:text-xl transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-brand/30 hover:shadow-brand/50">
                            <span className="flex items-center gap-3">
                                <Video size={22} />
                                Start
                            </span>
                            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </div>

                    {/* Swipe hint for mobile */}
                    <p className="mt-8 text-gray-600 text-xs sm:hidden animate-float-up flex items-center gap-1.5" style={{ animationDelay: '0.7s', opacity: 0 }}>
                        <ChevronLeft size={12} className="animate-swipe-hint" />
                        Swipe left to skip during calls
                    </p>
                </div>
            </div>
        )
    }

    // ===================== SEARCHING — ANIMATED =====================
    if (status === 'searching') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-gray-950 px-4 relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-brand/8 rounded-full blur-[100px] animate-pulse" />
                    <div className="absolute bottom-1/3 right-1/3 w-60 h-60 bg-purple-500/8 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <div className="relative z-10 flex flex-col items-center">
                    {/* Animated search rings */}
                    <div className="relative w-28 h-28 mb-8">
                        <div className="absolute inset-0 border-2 border-brand/30 rounded-full animate-pulse-ring" />
                        <div className="absolute inset-2 border-2 border-brand/20 rounded-full animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
                        <div className="absolute inset-4 border-2 border-brand/10 rounded-full animate-pulse-ring" style={{ animationDelay: '1s' }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-14 h-14 bg-gradient-to-br from-brand to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-brand/30">
                                <Users size={24} className="text-white animate-pulse" />
                            </div>
                        </div>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Looking for someone...</h2>
                    <p className="text-gray-500 mb-8 text-sm sm:text-base">Camera starts when matched</p>

                    {/* Shimmer bar */}
                    <div className="w-48 h-1 rounded-full bg-gray-800 overflow-hidden mb-8">
                        <div className="h-full w-full animate-shimmer rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #7c3aed, transparent)', backgroundSize: '200% 100%' }} />
                    </div>

                    <button onClick={stopSearching}
                        className="px-6 py-2.5 rounded-xl glass text-gray-300 hover:text-white font-medium text-sm transition-all hover:border-white/20 active:scale-95">
                        Cancel
                    </button>
                </div>
            </div>
        )
    }

    // ===================== CONNECTED — PREMIUM VIDEO CALL =====================
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

    return (
        <div className="flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-black overflow-hidden relative select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* SWIPE INDICATORS (mobile) */}
            {isSwiping && (
                <>
                    {/* Swipe left = NEXT */}
                    <div className="swipe-indicator absolute inset-y-0 right-0 w-20 z-40 flex items-center justify-center sm:hidden"
                        style={{ opacity: swipeOffset < -30 ? Math.min(Math.abs(swipeOffset + 30) / 70, 1) : 0 }}>
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 rounded-full bg-brand/80 flex items-center justify-center">
                                <SkipForward size={20} className="text-white" />
                            </div>
                            <span className="text-[10px] text-brand font-semibold">NEXT</span>
                        </div>
                    </div>
                    {/* Swipe right = END */}
                    <div className="swipe-indicator absolute inset-y-0 left-0 w-20 z-40 flex items-center justify-center sm:hidden"
                        style={{ opacity: swipeOffset > 30 ? Math.min((swipeOffset - 30) / 70, 1) : 0 }}>
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 rounded-full bg-red-500/80 flex items-center justify-center">
                                <PhoneOff size={20} className="text-white" />
                            </div>
                            <span className="text-[10px] text-red-400 font-semibold">END</span>
                        </div>
                    </div>
                </>
            )}

            {/* TOP BAR — glassmorphism */}
            <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-4 py-2 glass-dark">
                <div className="flex items-center gap-2.5">
                    {/* Connection status */}
                    <div className={`w-2 h-2 rounded-full ${
                        peerState === 'connected' || peerState === 'completed' ? 'bg-green-400 shadow-sm shadow-green-400/50' :
                        peerState === 'checking' || peerState === 'new' ? 'bg-yellow-400 animate-pulse' :
                        'bg-red-400'
                    }`} />
                    <span className="text-white text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-none">
                        {stranger?.fullName || 'Stranger'}
                    </span>
                    {stranger?.college && (
                        <span className="text-gray-500 text-[10px] sm:text-xs hidden sm:inline">• {stranger.college}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Call timer */}
                    {remoteReady && (
                        <div className="px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-[11px] sm:text-xs font-mono">
                            {formatDuration(callDuration)}
                        </div>
                    )}
                    {/* Report */}
                    <div className="relative">
                        <button onClick={() => setShowReport(!showReport)}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 text-amber-400/70 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90">
                            <AlertTriangle size={14} />
                        </button>
                        {showReport && (
                            <div className="absolute right-0 top-full mt-1.5 glass rounded-xl shadow-2xl py-1.5 w-44 z-50 animate-slide-up border border-white/10">
                                {['harassment', 'inappropriate', 'spam', 'underage', 'other'].map(reason => (
                                    <button key={reason} onClick={() => reportUser(reason)}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 capitalize transition-colors">
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* VIDEO AREA */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 min-h-0 relative"
                style={{ transform: isSwiping ? `translateX(${swipeOffset}px)` : 'none', transition: isSwiping ? 'none' : 'transform 0.3s ease-out' }}>

                {/* STRANGER VIDEO — Full on mobile, left on desktop */}
                <div className="relative bg-gray-900 overflow-hidden order-1">
                    <video
                        ref={remoteVideoRef}
                        autoPlay playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    {!remoteReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
                            <div className="text-center">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center mx-auto shadow-xl">
                                    <span className="text-3xl sm:text-4xl font-bold text-gray-500">{stranger?.fullName?.[0] || '?'}</span>
                                </div>
                                <div className="mt-4 flex items-center gap-2 justify-center">
                                    <div className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <p className="text-xs text-gray-600 mt-2">Connecting video...</p>
                            </div>
                        </div>
                    )}
                    {/* Connected flash */}
                    {showConnectedFlash && (
                        <div className="absolute inset-0 bg-brand/10 animate-connected-flash pointer-events-none z-10" />
                    )}
                    {/* Failed overlay */}
                    {peerState === 'failed' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                                    <AlertTriangle size={20} className="text-red-400" />
                                </div>
                                <p className="text-red-400 text-sm font-medium mb-1">Connection lost</p>
                                <p className="text-gray-600 text-xs">Reconnecting...</p>
                            </div>
                        </div>
                    )}
                    {/* Stranger college badge on mobile */}
                    {stranger?.college && (
                        <div className="absolute top-14 left-3 sm:top-3 sm:left-3 glass px-2.5 py-1 rounded-lg sm:hidden">
                            <span className="text-gray-300 text-[10px]">{stranger.college}</span>
                        </div>
                    )}
                </div>

                {/* YOUR VIDEO — PiP on mobile, right on desktop */}
                {/* On mobile: floating picture-in-picture overlay */}
                <div className={`${
                    isMobile
                        ? 'absolute bottom-32 right-3 w-28 h-40 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 z-20 border-2 border-white/10'
                        : 'relative bg-gray-900 overflow-hidden order-2'
                }`}>
                    <video
                        ref={localVideoRef}
                        autoPlay muted playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    {(!localReady || isCameraOff) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                                <div className={`${isMobile ? 'w-10 h-10' : 'w-16 h-16 sm:w-20 sm:h-20'} rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center mx-auto`}>
                                    <span className={`${isMobile ? 'text-sm' : 'text-2xl sm:text-3xl'} font-bold text-gray-500`}>{user?.fullName?.[0] || 'Y'}</span>
                                </div>
                                {!localReady && !isMobile && (
                                    <p className="text-xs text-gray-600 mt-3">Starting camera...</p>
                                )}
                            </div>
                        </div>
                    )}
                    {!isMobile && (
                        <div className="absolute bottom-3 left-3 glass px-2.5 py-1 rounded-lg">
                            <span className="text-white text-xs font-medium">You</span>
                        </div>
                    )}
                </div>
            </div>

            {/* BOTTOM CONTROLS */}
            <div className="absolute bottom-0 left-0 right-0 z-20">
                {/* Chat panel */}
                {chatOpen && (
                    <div className="animate-slide-up">
                        <div className="h-[45vh] sm:h-[40vh] flex flex-col bg-gradient-to-t from-black via-black/95 to-black/70 border-t border-white/5">
                            {/* Chat header */}
                            <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
                                <span className="text-xs text-gray-400 font-medium">Chat with {stranger?.fullName || 'Stranger'}</span>
                                <button onClick={() => setChatOpen(false)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-2 space-y-2 min-h-0 no-scrollbar">
                                {messages.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <MessageCircle size={28} className="text-gray-800 mx-auto mb-2" />
                                            <span className="text-xs text-gray-700">Say hi! 👋</span>
                                        </div>
                                    </div>
                                )}
                                {messages.map((msg, i) => (
                                    msg.system ? (
                                        <div key={i} className="text-center py-1.5">
                                            <span className="text-[10px] text-gray-600 bg-white/5 px-3 py-1 rounded-full">{msg.content}</span>
                                        </div>
                                    ) : (
                                        <div key={i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                            <div className={`max-w-[80%] px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-sm leading-relaxed ${
                                                msg.fromMe
                                                    ? 'bg-gradient-to-r from-brand to-purple-600 text-white rounded-br-sm shadow-lg shadow-brand/20'
                                                    : 'glass text-white rounded-bl-sm'
                                            }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    )
                                ))}
                                {isTyping && (
                                    <div className="flex justify-start">
                                        <div className="glass px-4 py-2.5 rounded-2xl rounded-bl-sm">
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <form onSubmit={sendMessage} className="px-3 sm:px-5 py-2.5 sm:py-3 flex gap-2 shrink-0 pb-safe">
                                <input
                                    value={input} onChange={handleInput}
                                    placeholder="Type a message..."
                                    className="flex-1 h-11 px-4 glass text-white placeholder:text-gray-600 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent"
                                    autoComplete="off"
                                />
                                <button type="submit" disabled={!input.trim()}
                                    className="h-11 w-11 bg-gradient-to-r from-brand to-purple-600 text-white rounded-full hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 active:scale-90 shadow-lg shadow-brand/20">
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Control bar */}
                <div className={`flex items-center justify-center gap-3 sm:gap-4 px-4 py-3 sm:py-4 pb-safe ${!chatOpen ? 'glass-dark' : 'bg-black'}`}>
                    {/* Mute */}
                    <button onClick={toggleMute}
                        className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
                            isMuted ? 'bg-red-500 text-white shadow-red-500/30' : 'glass text-white hover:bg-white/10'
                        }`}>
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    {/* Camera */}
                    <button onClick={toggleCam}
                        className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
                            isCameraOff ? 'bg-red-500 text-white shadow-red-500/30' : 'glass text-white hover:bg-white/10'
                        }`}>
                        {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>

                    {/* End call */}
                    <button onClick={disconnect}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-2xl shadow-red-500/40 active:scale-90">
                        <PhoneOff size={22} />
                    </button>

                    {/* Chat toggle */}
                    <button onClick={() => setChatOpen(p => !p)}
                        className={`relative w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
                            chatOpen ? 'bg-brand text-white shadow-brand/30' : 'glass text-white hover:bg-white/10'
                        }`}>
                        <MessageCircle size={20} />
                        {!chatOpen && unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-count-pulse">
                                <span className="text-[10px] text-white font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            </div>
                        )}
                    </button>

                    {/* Next */}
                    <button onClick={nextStranger}
                        className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-r from-brand to-purple-600 text-white flex items-center justify-center hover:opacity-90 transition-all shadow-lg shadow-brand/30 active:scale-90"
                        title="Next stranger">
                        <SkipForward size={20} />
                    </button>
                </div>

                {/* Swipe hint (mobile, first match only) */}
                {isMobile && matchCount <= 1 && !chatOpen && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-gray-600 animate-swipe-hint">
                        <ChevronLeft size={12} />
                        <span className="text-[10px]">Swipe to skip</span>
                    </div>
                )}
            </div>
        </div>
    )
}
