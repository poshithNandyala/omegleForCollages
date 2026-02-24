import { useState, useEffect, useRef } from 'react'
import { Shuffle, X, Send, Video, VideoOff, Mic, MicOff, SkipForward, Filter } from 'lucide-react'
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

    const messagesEndRef = useRef(null)
    const localVideoRef = useRef(null)
    const remoteVideoRef = useRef(null)
    const peerConnection = useRef(null)
    const localStream = useRef(null)
    const typingTimeout = useRef(null)

    const socket = getSocket()

    useEffect(() => {
        if (!socket) return

        socket.on('waiting', () => setStatus('searching'))
        socket.on('stranger-found', ({ roomId: rId, stranger: s }) => {
            setStatus('connected'); setStranger(s); setRoomId(rId); setMessages([])
            toast.success('Stranger found! Say hi')
        })
        socket.on('new-message', ({ senderId, content, timestamp }) => {
            setMessages(prev => [...prev, { fromMe: senderId === socket.id, content, timestamp }])
        })
        socket.on('stranger-typing', () => setIsTyping(true))
        socket.on('stranger-stop-typing', () => setIsTyping(false))
        socket.on('stranger-disconnected', () => {
            setStatus('idle'); setStranger(null); setRoomId(null)
            setMessages(prev => [...prev, { system: true, content: 'Stranger disconnected' }])
            cleanupVideo(); toast('Stranger left')
        })
        socket.on('video-offer', async ({ offer }) => {
            if (!peerConnection.current) await setupPeerConnection()
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer))
            const answer = await peerConnection.current.createAnswer()
            await peerConnection.current.setLocalDescription(answer)
            socket.emit('video-answer', { roomId, answer })
        })
        socket.on('video-answer', async ({ answer }) => {
            await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer))
        })
        socket.on('ice-candidate', async ({ candidate }) => {
            await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate))
        })
        socket.on('video-ended', () => { cleanupVideo(); setVideoActive(false) })

        return () => {
            ;['waiting','stranger-found','new-message','stranger-typing','stranger-stop-typing',
              'stranger-disconnected','video-offer','video-answer','ice-candidate','video-ended'
            ].forEach(e => socket.off(e))
        }
    }, [socket, roomId])

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    const findStranger = () => {
        if (!socket) { toast.error('Not connected'); return }
        setStatus('searching'); setMessages([]); setStranger(null)
        socket.emit('find-stranger', filters)
    }
    const skipStranger = () => {
        if (!socket) return
        socket.emit('skip-stranger'); cleanupVideo(); setVideoActive(false)
        setStatus('idle'); setStranger(null); setRoomId(null); setMessages([])
    }
    const stopSearching = () => { socket?.emit('stop-searching'); setStatus('idle') }
    const sendMessage = (e) => {
        e.preventDefault()
        if (!input.trim() || !socket || !roomId) return
        socket.emit('send-message', { roomId, content: input.trim() })
        setInput(''); socket.emit('stop-typing', { roomId })
    }
    const handleInputChange = (e) => {
        setInput(e.target.value)
        if (!socket || !roomId) return
        socket.emit('typing', { roomId })
        clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => socket.emit('stop-typing', { roomId }), 1000)
    }
    const setupPeerConnection = async () => {
        peerConnection.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
        peerConnection.current.onicecandidate = (event) => { if (event.candidate && socket) socket.emit('ice-candidate', { roomId, candidate: event.candidate }) }
        peerConnection.current.ontrack = (event) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0] }
        if (localStream.current) localStream.current.getTracks().forEach(track => peerConnection.current.addTrack(track, localStream.current))
    }
    const startVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            localStream.current = stream
            if (localVideoRef.current) localVideoRef.current.srcObject = stream
            await setupPeerConnection()
            const offer = await peerConnection.current.createOffer()
            await peerConnection.current.setLocalDescription(offer)
            socket.emit('video-offer', { roomId, offer }); setVideoActive(true)
        } catch { toast.error('Camera/mic access denied') }
    }
    const endVideo = () => { socket?.emit('end-video', { roomId }); cleanupVideo(); setVideoActive(false) }
    const cleanupVideo = () => {
        localStream.current?.getTracks().forEach(t => t.stop()); localStream.current = null
        peerConnection.current?.close(); peerConnection.current = null
        if (localVideoRef.current) localVideoRef.current.srcObject = null
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    }
    const toggleMute = () => { if (localStream.current) { localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled }); setIsMuted(!isMuted) } }
    const toggleCamera = () => { if (localStream.current) { localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled }); setIsCameraOff(!isCameraOff) } }

    return (
        <div className="flex-1 flex flex-col">
            <div className="w-full max-w-[1400px] mx-auto px-6 py-6 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Find a Stranger</h1>
                                                 <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">Random chat with verified college students</p>
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                            showFilters ? 'bg-brand-light text-brand' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                        }`}>
                        <Filter size={16} /> Filters
                    </button>
                </div>

                {showFilters && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select label="College" value={filters.college}
                            onChange={(e) => setFilters({ ...filters, college: e.target.value })}
                            options={[{ value: 'any', label: 'Any College' }, { value: 'same', label: 'Same College Only' }]} />
                        <Select label="Gender Preference" value={filters.gender}
                            onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                            options={[{ value: 'any', label: 'Anyone' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
                    </div>
                )}

                {videoActive && (
                    <div className="grid grid-cols-2 gap-4 mb-5">
                        <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video">
                            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                            <span className="absolute bottom-3 left-3 text-white text-xs bg-black/60 px-2.5 py-1 rounded-md font-medium">You</span>
                        </div>
                        <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video">
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <span className="absolute bottom-3 left-3 text-white text-xs bg-black/60 px-2.5 py-1 rounded-md font-medium">Stranger</span>
                        </div>
                    </div>
                )}

                {/* Main chat area */}
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden flex flex-col min-h-[500px]">
                    {status === 'idle' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-20 h-20 bg-brand-light dark:bg-brand/10 rounded-2xl flex items-center justify-center mb-6">
                                <Shuffle size={32} className="text-brand" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Ready to connect?</h2>
                                                         <p className="text-gray-500 dark:text-zinc-400 mb-8 max-w-sm text-base">
                                You'll be matched with a random verified college student for text or video chat.
                            </p>
                            <Button onClick={findStranger} size="lg">
                                <Shuffle size={18} /> Find a Stranger
                            </Button>
                        </div>
                    )}

                    {status === 'searching' && (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-14 h-14 border-[3px] border-gray-200 dark:border-zinc-700 border-t-brand rounded-full animate-spin mb-6" />
                                                         <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Looking for someone...</h2>
                                                         <p className="text-gray-500 dark:text-zinc-400 mb-6">Hang tight, we're finding a match</p>
                            <Button variant="outline" onClick={stopSearching}>Cancel</Button>
                        </div>
                    )}

                    {status === 'connected' && (
                        <>
                            {/* Chat header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                                <div className="flex items-center gap-3">
                                    {stranger?.avatar ? (
                                        <img src={stranger.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand text-sm font-bold">
                                            {stranger?.fullName?.[0] || '?'}
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-zinc-100">{stranger?.fullName || 'Stranger'}</p>
                                                                                 <p className="text-xs text-gray-500 dark:text-zinc-400">{stranger?.college || 'College student'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {videoActive ? (
                                        <>
                                            <button onClick={toggleMute} className={`p-2.5 rounded-lg transition-colors ${isMuted ? 'bg-red-100 text-red-500' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}>
                                                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                                            </button>
                                            <button onClick={toggleCamera} className={`p-2.5 rounded-lg transition-colors ${isCameraOff ? 'bg-red-100 text-red-500' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}>
                                                {isCameraOff ? <VideoOff size={16} /> : <Video size={16} />}
                                            </button>
                                            <button onClick={endVideo} className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                                                <VideoOff size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={startVideo} className="p-2.5 bg-brand-light text-brand rounded-lg hover:bg-brand hover:text-white transition-colors">
                                            <Video size={16} />
                                        </button>
                                    )}
                                    <button onClick={skipStranger} className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
                                        <SkipForward size={14} /> Next
                                    </button>
                                    <button onClick={skipStranger} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                                <div className="text-center py-2">
                                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                                        Connected with {stranger?.fullName || 'a stranger'}
                                    </span>
                                </div>
                                {messages.map((msg, i) => (
                                    msg.system ? (
                                        <div key={i} className="text-center py-1">
                                            <span className="text-xs text-gray-400">{msg.content}</span>
                                        </div>
                                    ) : (
                                        <div key={i} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                                                msg.fromMe ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200'
                                            }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    )
                                ))}
                                {isTyping && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-100 dark:bg-zinc-800 px-4 py-3 rounded-xl">
                                            <div className="flex gap-1.5">
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
                            <form onSubmit={sendMessage} className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex gap-3">
                                <input
                                    value={input} onChange={handleInputChange}
                                    placeholder="Type a message..."
                                    className="flex-1 h-11 px-4 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 dark:text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                                />
                                <button type="submit" disabled={!input.trim()}
                                    className="h-11 px-5 bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-semibold text-sm">
                                    <Send size={16} /> Send
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
