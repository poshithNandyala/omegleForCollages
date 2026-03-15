import { useState, useEffect, useRef, useCallback } from 'react'
import { Shuffle, X, Send, Video, VideoOff, Mic, MicOff, SkipForward, Filter, AlertTriangle, PhoneOff, MessageCircle } from 'lucide-react'
import { Button, Select } from '../components/ui'
import { getSocket } from '../lib/socket'
import useAuthStore from '../stores/authStore'
import toast from 'react-hot-toast'

const isMobile = () => window.innerWidth < 768

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
    const [showChat, setShowChat] = useState(true)

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

    const getMediaConstraints = useCallback(() => {
        if (isMobile()) {
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
            if (state === 'failed') {
                pc.restartIce()
            }
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
            setShowChat(true)
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
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream
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
                console.error('Failed to handle video offer:', err)
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
                console.error('Failed to set video answer:', err)
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
                console.error('ICE candidate error:', err)
            }
        })
        socket.on('video-ended', () => {
            cleanupVideo()
            setVideoActive(false)
            setShowChat(true)
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

    useEffect(() => {
        return () => cleanupVideo()
    }, [cleanupVideo])

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
            if (localVideoRef.current) localVideoRef.current.srcObject = stream
            const pc = createPeerConnection()
            stream.getTracks().forEach(track => pc.addTrack(track, stream))
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.emit('video-offer', { roomId, offer })
            setVideoActive(true)
            if (isMobile()) setShowChat(false)
        } catch {
            toast.error('Camera/mic access denied')
        }
    }

    const endVideo = () => {
        socket?.emit('end-video', { roomId })
        cleanupVideo()
        setVideoActive(false)
        setShowChat(true)
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

    const ConnectionBadge = () => {
        if (!videoActive) return null
        const colors = { connected: 'bg-green-500', checking: 'bg-yellow-500', new: 'bg-gray-400', failed: 'bg-red-500', disconnected: 'bg-red-500' }
        return (
            <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${colors[peerState] || 'bg-gray-400'} ${peerState === 'checking' ? 'animate-pulse' : ''}`} />
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium hidden sm:inline">
                    {peerState === 'connected' ? 'Live' : peerState === 'checking' ? 'Connecting...' : peerState === 'failed' ? 'Reconnecting...' : ''}
                </span>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] overflow-hidden">
            <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-6 py-3 sm:py-6 flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 sm:mb-5 shrink-0">
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 truncate">Find a Stranger</h1>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 mt-0.5 hidden sm:block">Random chat with verified college students</p>
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                            showFilters ? 'bg-brand-light text-brand' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                        }`}>
                        <Filter size={14} /> Filters
                    </button>
                </div>

                {showFilters && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-4 sm:p-5 mb-3 sm:mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 shrink-0">
                        <Select label="College" value={filters.college}
                            onChange={(e) => setFilters({ ...filters, college: e.target.value })}
                            options={[{ value: 'any', label: 'Any College' }, { value: 'same', label: 'Same College Only' }]} />
                        <Select label="Gender Preference" value={filters.gender}
                            onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                            options={[{ value: 'any', label: 'Anyone' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
                    </div>
                )}

                {/* Video section */}
                {videoActive && (
                    <div className="relative mb-3 sm:mb-5 shrink-0">
                        <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video max-h-[35vh] sm:max-h-[50vh]">
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            {peerState !== 'connected' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                                    <div className="text-center">
                                        <div className="w-10 h-10 border-[3px] border-zinc-700 border-t-brand rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-sm text-gray-400">Connecting video...</p>
                                    </div>
                                </div>
                            )}
                            <span className="absolute bottom-3 left-3 text-white text-xs bg-black/60 px-2.5 py-1 rounded-md font-medium">
                                {stranger?.fullName || 'Stranger'}
                            </span>
                            <div className="absolute top-3 left-3"><ConnectionBadge /></div>
                        </div>

                        <div className="absolute bottom-3 right-3 w-20 h-28 sm:w-36 sm:h-28 rounded-lg overflow-hidden bg-gray-800 border-2 border-white/20 shadow-xl">
                            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                            <span className="absolute bottom-1 left-1.5 text-white text-[10px] bg-black/60 px-1.5 py-0.5 rounded font-medium">You</span>
                        </div>

                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3">
                            <button onClick={toggleMute}
                                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}>
                                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                            </button>
                            <button onClick={endVideo}
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg">
                                <PhoneOff size={20} />
                            </button>
                            <button onClick={toggleCamera}
                                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-red-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}>
                                {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Toggle chat on mobile when video is active */}
                {videoActive && (
                    <button onClick={() => setShowChat(!showChat)}
                        className="flex sm:hidden items-center justify-center gap-2 py-2 text-sm text-brand font-semibold mb-2 shrink-0">
                        <MessageCircle size={16} />
                        {showChat ? 'Hide Chat' : `Show Chat ${messages.length > 0 ? `(${messages.length})` : ''}`}
                    </button>
                )}

                {/* Main chat area */}
                <div className={`flex-1 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col min-h-0 ${videoActive && !showChat ? 'hidden' : ''}`}>
                    {status === 'idle' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-light dark:bg-brand/10 rounded-2xl flex items-center justify-center mb-5 sm:mb-6">
                                <Shuffle size={28} className="text-brand" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Ready to connect?</h2>
                            <p className="text-gray-500 dark:text-zinc-400 mb-6 sm:mb-8 max-w-sm text-sm sm:text-base">
                                You'll be matched with a random verified college student for text or video chat.
                            </p>
                            <Button onClick={findStranger} size="lg">
                                <Shuffle size={18} /> Find a Stranger
                            </Button>
                        </div>
                    )}

                    {status === 'searching' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 border-[3px] border-gray-200 dark:border-zinc-700 border-t-brand rounded-full animate-spin mb-5 sm:mb-6" />
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Looking for someone...</h2>
                            <p className="text-gray-500 dark:text-zinc-400 mb-5 sm:mb-6 text-sm sm:text-base">Hang tight, we're finding a match</p>
                            <Button variant="outline" onClick={stopSearching}>Cancel</Button>
                        </div>
                    )}

                    {status === 'connected' && (
                        <>
                            {/* Chat header */}
                            <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 shrink-0">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    {stranger?.avatar ? (
                                        <img src={stranger.avatar} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-brand-light flex items-center justify-center text-brand text-xs sm:text-sm font-bold shrink-0">
                                            {stranger?.fullName?.[0] || '?'}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm sm:text-base truncate">{stranger?.fullName || 'Stranger'}</p>
                                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 truncate">{stranger?.college || 'College student'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                    {!videoActive && (
                                        <button onClick={startVideo} className="p-2 sm:p-2.5 bg-brand-light text-brand rounded-lg hover:bg-brand hover:text-white transition-colors" title="Start video">
                                            <Video size={16} />
                                        </button>
                                    )}
                                    <button onClick={skipStranger} className="hidden sm:flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg text-xs sm:text-sm font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                        <SkipForward size={14} /> Next
                                    </button>
                                    <button onClick={skipStranger} className="sm:hidden p-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg" title="Next">
                                        <SkipForward size={16} />
                                    </button>
                                    <div className="relative">
                                        <button onClick={() => setShowReport(!showReport)} className="p-2 sm:p-2.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Report">
                                            <AlertTriangle size={14} />
                                        </button>
                                        {showReport && (
                                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 w-44 z-50">
                                                {['harassment', 'inappropriate', 'spam', 'underage', 'other'].map(reason => (
                                                    <button key={reason} onClick={() => reportUser(reason)}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 capitalize">
                                                        {reason}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={skipStranger} className="p-2 sm:p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Disconnect">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-2.5 sm:space-y-3 min-h-0 no-scrollbar">
                                <div className="text-center py-2">
                                    <span className="text-[10px] sm:text-xs text-gray-400 bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                                        Connected with {stranger?.fullName || 'a stranger'}
                                    </span>
                                </div>
                                {messages.map((msg, i) => (
                                    msg.system ? (
                                        <div key={i} className="text-center py-1">
                                            <span className="text-[10px] sm:text-xs text-gray-400">{msg.content}</span>
                                        </div>
                                    ) : (
                                        <div key={i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] sm:max-w-[70%] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm leading-relaxed ${
                                                msg.fromMe ? 'bg-brand text-white rounded-br-md' : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 rounded-bl-md'
                                            }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    )
                                ))}
                                {isTyping && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-md">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message input */}
                            <form onSubmit={sendMessage} className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex gap-2 sm:gap-3 shrink-0">
                                <input
                                    value={input} onChange={handleInputChange}
                                    placeholder="Type a message..."
                                    className="flex-1 h-10 sm:h-11 px-3 sm:px-4 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 dark:text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                                    autoComplete="off"
                                />
                                <button type="submit" disabled={!input.trim()}
                                    className="h-10 sm:h-11 w-10 sm:w-auto sm:px-5 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-semibold text-sm shrink-0">
                                    <Send size={16} />
                                    <span className="hidden sm:inline">Send</span>
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
