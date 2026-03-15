import { useState, useEffect, useRef, useCallback } from 'react'
import { Shuffle, Send, Video, VideoOff, Mic, MicOff, SkipForward, Filter, AlertTriangle, PhoneOff } from 'lucide-react'
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
    const [chatOpen, setChatOpen] = useState(true)

    const messagesEndRef = useRef(null)
    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const peerConnection = useRef(null)
    const localStream = useRef(null)
    const typingTimeout = useRef(null)
    const roomIdRef = useRef(null)
    const pendingCandidates = useRef([])
    const isInitiator = useRef(false)

    const socket = getSocket()

    useEffect(() => { roomIdRef.current = roomId }, [roomId])

    // Attach local stream to video element whenever it's ready
    useEffect(() => {
        if (localVideoRef.current && localStream.current) {
            localVideoRef.current.srcObject = localStream.current
        }
    }, [localReady])

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
        isInitiator.current = false
        if (localVideoRef.current) localVideoRef.current.srcObject = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
        setLocalReady(false)
        setRemoteReady(false)
        setPeerState('new')
    }, [])

    const makePeer = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 })

        pc.onicecandidate = (e) => {
            if (e.candidate && socket) {
                socket.emit('ice-candidate', { roomId: roomIdRef.current, candidate: e.candidate })
            }
        }

        pc.ontrack = (e) => {
            if (remoteVideoRef.current && e.streams[0]) {
                remoteVideoRef.current.srcObject = e.streams[0]
                setRemoteReady(true)
            }
        }

        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState
            setPeerState(s)
            if (s === 'failed') pc.restartIce()
            if (s === 'disconnected') {
                setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected') pc.restartIce()
                }, 3000)
            }
        }

        peerConnection.current = pc
        return pc
    }, [iceServers, socket])

    // Get camera and start call as initiator
    const startCall = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(getConstraints())
            localStream.current = stream
            setLocalReady(true)
            const pc = makePeer()
            stream.getTracks().forEach(t => pc.addTrack(t, stream))
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.emit('video-offer', { roomId: roomIdRef.current, offer })
            isInitiator.current = true
        } catch {
            toast.error('Camera/mic access denied')
        }
    }, [getConstraints, makePeer, socket])

    // Answer incoming call
    const answerCall = useCallback(async (offer) => {
        try {
            if (!localStream.current) {
                const stream = await navigator.mediaDevices.getUserMedia(getConstraints())
                localStream.current = stream
                setLocalReady(true)
            }
            const pc = makePeer()
            localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current))
            await pc.setRemoteDescription(new RTCSessionDescription(offer))
            for (const c of pendingCandidates.current) {
                await pc.addIceCandidate(new RTCIceCandidate(c))
            }
            pendingCandidates.current = []
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socket.emit('video-answer', { roomId: roomIdRef.current, answer })
        } catch (err) {
            console.error('answer error:', err)
            toast.error('Video connection failed')
        }
    }, [getConstraints, makePeer, socket])

    useEffect(() => {
        if (!socket) return

        socket.on('waiting', () => setStatus('searching'))

        socket.on('stranger-found', ({ roomId: rId, stranger: s }) => {
            setStatus('connected')
            setStranger(s)
            setRoomId(rId)
            setMessages([])
            setChatOpen(true)
            toast.success('Stranger found! 👋')
            // AUTO-START video — initiator starts call immediately
            setTimeout(() => startCall(), 500)
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
            cleanup()
            toast('Stranger left', { icon: '👋' })
        })

        socket.on('video-offer', async ({ offer }) => {
            await answerCall(offer)
        })

        socket.on('video-answer', async ({ answer }) => {
            try {
                await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer))
                for (const c of pendingCandidates.current) {
                    await peerConnection.current?.addIceCandidate(new RTCIceCandidate(c))
                }
                pendingCandidates.current = []
            } catch (err) {
                console.error('answer-set error:', err)
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

        socket.on('video-ended', () => {
            cleanup()
        })

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
    }, [socket, cleanup, startCall, answerCall])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => () => cleanup(), [cleanup])

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

    // ===================== IDLE =====================
    if (status === 'idle') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-gray-950 px-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-brand/10 rounded-3xl flex items-center justify-center mb-6 sm:mb-8">
                    <Shuffle size={36} className="text-brand" />
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-3 text-center">Start Matching</h1>
                <p className="text-gray-400 mb-6 sm:mb-8 max-w-md text-center text-sm sm:text-lg">
                    Video chat with random verified college students. Camera starts automatically.
                </p>

                <div className="w-full max-w-sm mb-6">
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`mx-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors mb-3 ${
                            showFilters ? 'bg-brand/20 text-brand' : 'bg-white/10 text-gray-400'
                        }`}>
                        <Filter size={14} /> Filters
                    </button>
                    {showFilters && (
                        <div className="grid grid-cols-2 gap-3 bg-white/5 rounded-xl border border-white/10 p-4">
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
                    <Video size={20} /> Start
                </Button>
            </div>
        )
    }

    // ===================== SEARCHING =====================
    if (status === 'searching') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-gray-950 px-4">
                <div className="w-16 h-16 border-[3px] border-gray-700 border-t-brand rounded-full animate-spin mb-6" />
                <h2 className="text-xl sm:text-3xl font-bold text-white mb-2">Finding someone...</h2>
                <p className="text-gray-400 mb-6 text-sm sm:text-base">Camera will start when matched</p>
                <Button variant="outline" onClick={stopSearching} className="border-gray-600 text-gray-300">Cancel</Button>
            </div>
        )
    }

    // ===================== CONNECTED — FULL OMEGLE LAYOUT =====================
    return (
        <div className="flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-black overflow-hidden relative">

            {/* ===== FULL SCREEN VIDEO — SIDE BY SIDE ===== */}
            <div className="flex-1 grid grid-cols-2 gap-[1px] min-h-0">

                {/* YOUR VIDEO */}
                <div className="relative bg-gray-900 overflow-hidden">
                    <video
                        ref={localVideoRef}
                        autoPlay muted playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    {(!localReady || isCameraOff) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-2">
                                    <span className="text-xl sm:text-3xl font-bold text-gray-500">{user?.fullName?.[0] || 'Y'}</span>
                                </div>
                                {!localReady && <p className="text-xs text-gray-600 mt-2">Starting camera...</p>}
                            </div>
                        </div>
                    )}
                    <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-black/60 backdrop-blur-sm px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md">
                        <span className="text-white text-[10px] sm:text-xs font-medium">You</span>
                    </div>
                </div>

                {/* STRANGER VIDEO */}
                <div className="relative bg-gray-900 overflow-hidden">
                    <video
                        ref={remoteVideoRef}
                        autoPlay playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    {!remoteReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-2">
                                    <span className="text-xl sm:text-3xl font-bold text-gray-500">{stranger?.fullName?.[0] || '?'}</span>
                                </div>
                                <div className="w-6 h-6 border-2 border-gray-700 border-t-brand rounded-full animate-spin mx-auto mt-3" />
                                <p className="text-xs text-gray-600 mt-2">Connecting...</p>
                            </div>
                        </div>
                    )}
                    <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-black/60 backdrop-blur-sm px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md flex items-center gap-1.5">
                        {remoteReady && peerState === 'connected' && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                        <span className="text-white text-[10px] sm:text-xs font-medium">{stranger?.fullName || 'Stranger'}</span>
                    </div>
                    {stranger?.college && (
                        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
                            <span className="text-gray-300 text-[9px] sm:text-[11px]">{stranger.college}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== VIDEO CONTROLS — Floating center ===== */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(40%+8px)] sm:bottom-[calc(35%+12px)] flex items-center gap-3 sm:gap-4 z-30">
                <button onClick={toggleMute}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isMuted ? 'bg-red-500 text-white' : 'bg-black/40 backdrop-blur-md text-white hover:bg-black/60'
                    }`}>
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button onClick={disconnect}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-xl shadow-red-500/30">
                    <PhoneOff size={24} />
                </button>
                <button onClick={toggleCam}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        isCameraOff ? 'bg-red-500 text-white' : 'bg-black/40 backdrop-blur-md text-white hover:bg-black/60'
                    }`}>
                    {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
                <button onClick={() => { disconnect(); findStranger() }}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-hover transition-all shadow-lg">
                    <SkipForward size={20} />
                </button>
            </div>

            {/* Report button — top right */}
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-30">
                <div className="relative">
                    <button onClick={() => setShowReport(!showReport)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 backdrop-blur-md text-amber-400 flex items-center justify-center hover:bg-black/60 transition-all">
                        <AlertTriangle size={16} />
                    </button>
                    {showReport && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1.5 w-44 z-50">
                            {['harassment', 'inappropriate', 'spam', 'underage', 'other'].map(reason => (
                                <button key={reason} onClick={() => reportUser(reason)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 capitalize first:rounded-t-xl last:rounded-b-xl">
                                    {reason}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ===== CHAT OVERLAY — Bottom of screen, on top of video ===== */}
            <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${
                chatOpen ? 'h-[40%] sm:h-[35%]' : 'h-12'
            }`}>

                {/* Chat toggle handle */}
                <button onClick={() => setChatOpen(p => !p)}
                    className="absolute -top-0 left-0 right-0 h-10 flex items-center justify-center cursor-pointer z-10">
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full">
                        <div className="w-8 h-1 bg-gray-500 rounded-full" />
                        {!chatOpen && messages.length > 0 && (
                            <span className="text-[10px] text-gray-400 font-medium">{messages.length} messages</span>
                        )}
                    </div>
                </button>

                {chatOpen && (
                    <div className="h-full flex flex-col bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-6">
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-2 space-y-1.5 min-h-0 no-scrollbar">
                            {messages.length === 0 && (
                                <div className="text-center py-3">
                                    <span className="text-xs text-gray-600">Say something...</span>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                msg.system ? (
                                    <div key={i} className="text-center py-1">
                                        <span className="text-[10px] text-gray-600">{msg.content}</span>
                                    </div>
                                ) : (
                                    <div key={i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-sm leading-relaxed ${
                                            msg.fromMe
                                                ? 'bg-brand text-white rounded-br-sm'
                                                : 'bg-white/15 text-white rounded-bl-sm'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                )
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white/15 px-4 py-2.5 rounded-2xl rounded-bl-sm">
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

                        {/* Input */}
                        <form onSubmit={sendMessage} className="px-3 sm:px-5 py-2 sm:py-3 flex gap-2 shrink-0">
                            <input
                                value={input} onChange={handleInput}
                                placeholder="Type a message..."
                                className="flex-1 h-10 sm:h-11 px-4 bg-white/10 border border-white/10 text-white placeholder:text-gray-500 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-transparent backdrop-blur-sm"
                                autoComplete="off"
                            />
                            <button type="submit" disabled={!input.trim()}
                                className="h-10 sm:h-11 w-10 sm:w-11 bg-brand text-white rounded-full hover:bg-brand-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0">
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
