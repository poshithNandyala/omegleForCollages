import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Input, Button, Select } from '../components/ui'
import { Upload, User, GraduationCap, Mail, CheckCircle, ArrowLeft, Eye, EyeOff, Zap } from 'lucide-react'
import useAuthStore from '../stores/authStore'
import api from '../lib/axios'

const STEP_EMAIL = 'email'
const STEP_OTP = 'otp'
const STEP_DETAILS = 'details'

const INTEREST_OPTIONS = [
    'Music', 'Gaming', 'Sports', 'Movies', 'Anime', 'Coding',
    'Art', 'Travel', 'Books', 'Fitness', 'Photography', 'Cooking',
    'Dance', 'Science', 'Memes', 'Fashion'
]

export default function Register() {
    const [step, setStep] = useState(STEP_EMAIL)
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [formData, setFormData] = useState({
        fullName: '', username: '', password: '', confirmPassword: '',
        gender: '', interests: []
    })
    const [avatar, setAvatar] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [colleges, setColleges] = useState([])
    const [detectedCollege, setDetectedCollege] = useState(null)
    const [resendTimer, setResendTimer] = useState(0)
    const otpRefs = useRef([])
    const { register, login } = useAuthStore()
    const navigate = useNavigate()

    useEffect(() => {
        api.get('/users/colleges').then(res => setColleges(res.data.data || [])).catch(() => {})
    }, [])

    useEffect(() => {
        if (resendTimer > 0) {
            const id = setInterval(() => setResendTimer(t => t - 1), 1000)
            return () => clearInterval(id)
        }
    }, [resendTimer])

    const emailDomain = useMemo(() => {
        const parts = email.split('@')
        return parts.length === 2 ? parts[1].toLowerCase() : ''
    }, [email])

    useEffect(() => {
        if (!emailDomain) { setDetectedCollege(null); return }
        const match = colleges.find(c => c.domain === emailDomain)
        if (match) {
            setDetectedCollege(match)
        } else {
            const valid = /\.(edu|ac\.[a-z]{2,3}|edu\.[a-z]{2,3})$/i.test(emailDomain)
            setDetectedCollege(valid ? { name: emailDomain.split('.')[0].toUpperCase(), domain: emailDomain, dynamic: true } : null)
        }
    }, [emailDomain, colleges])

    const handleSendOTP = async (e) => {
        e.preventDefault()
        if (!detectedCollege) { toast.error('Use a valid college email'); return }
        setIsLoading(true)
        try {
            await api.post('/users/send-otp', { email })
            toast.success('Verification code sent!')
            setStep(STEP_OTP)
            setResendTimer(60)
            setTimeout(() => otpRefs.current[0]?.focus(), 100)
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send code')
        } finally { setIsLoading(false) }
    }

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return
        const newOtp = [...otp]
        newOtp[index] = value.slice(-1)
        setOtp(newOtp)
        if (value && index < 5) otpRefs.current[index + 1]?.focus()
    }

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus()
    }

    const handleOtpPaste = (e) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (pasted.length === 6) { setOtp(pasted.split('')); otpRefs.current[5]?.focus() }
    }

    const handleVerifyOTP = async (e) => {
        e.preventDefault()
        const otpString = otp.join('')
        if (otpString.length !== 6) { toast.error('Enter the full 6-digit code'); return }
        setIsLoading(true)
        try {
            await api.post('/users/verify-otp', { email, otp: otpString })
            toast.success('Email verified!')
            setStep(STEP_DETAILS)
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid code')
        } finally { setIsLoading(false) }
    }

    const handleResendOTP = async () => {
        if (resendTimer > 0) return
        setIsLoading(true)
        try {
            await api.post('/users/send-otp', { email })
            toast.success('New code sent!')
            setResendTimer(60)
            setOtp(['', '', '', '', '', ''])
            otpRefs.current[0]?.focus()
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resend')
        } finally { setIsLoading(false) }
    }

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

    const toggleInterest = (interest) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : prev.interests.length < 5 ? [...prev.interests, interest] : prev.interests
        }))
    }

    const handleAvatarChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setAvatar(file)
            const reader = new FileReader()
            reader.onload = (e) => setAvatarPreview(e.target.result)
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (formData.password !== formData.confirmPassword) { toast.error("Passwords don't match"); return }
        if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
        setIsLoading(true)
        try {
            const data = new FormData()
            data.append('fullName', formData.fullName)
            data.append('username', formData.username)
            data.append('email', email)
            data.append('password', formData.password)
            data.append('gender', formData.gender)
            data.append('interests', JSON.stringify(formData.interests))
            if (avatar) data.append('avatar', avatar)
            await register(data)
            await login({ email, password: formData.password })
            toast.success('Welcome to CampusConnect!')
            navigate('/match')
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed')
        } finally { setIsLoading(false) }
    }

    const stepIndex = [STEP_EMAIL, STEP_OTP, STEP_DETAILS].indexOf(step)

    return (
        <div className="fixed inset-0 flex bg-white dark:bg-zinc-950">
            {/* Left panel — dark branding (desktop only) */}
            <div className="hidden lg:flex w-1/2 bg-dark flex-col items-center justify-center p-16">
                <div className="max-w-md text-center">
                    <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-8">
                        <Zap size={28} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Join CampusConnect</h2>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Connect with verified students from your college. Video chat, text, and make new friends — all anonymously.
                    </p>

                    {/* Step indicator */}
                    <div className="flex items-center justify-center gap-3 mt-12">
                        {['Email', 'Verify', 'Profile'].map((label, i) => (
                            <div key={label} className="flex items-center gap-3">
                                <div className="flex flex-col items-center gap-2">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                                        stepIndex === i ? 'bg-brand text-white' :
                                        stepIndex > i ? 'bg-green-500 text-white' :
                                        'bg-white/10 text-white/40'
                                    }`}>
                                        {stepIndex > i ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs font-medium ${stepIndex >= i ? 'text-white' : 'text-white/40'}`}>
                                        {label}
                                    </span>
                                </div>
                                {i < 2 && (
                                    <div className={`w-12 h-0.5 mb-6 rounded ${stepIndex > i ? 'bg-green-500' : 'bg-white/10'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center overflow-y-auto">
                <div className="w-full max-w-md px-6 py-12 sm:px-10">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                            {step === STEP_EMAIL && 'Enter your email'}
                            {step === STEP_OTP && 'Verify your email'}
                            {step === STEP_DETAILS && 'Complete your profile'}
                        </h1>
                        <p className="text-gray-500 dark:text-zinc-400 mt-2 text-base">
                            {step === STEP_EMAIL && 'Use your college email to get started'}
                            {step === STEP_OTP && `We sent a code to ${email}`}
                            {step === STEP_DETAILS && 'Tell us about yourself'}
                        </p>
                    </div>

                    {/* Mobile step indicator */}
                    <div className="flex lg:hidden items-center gap-2 mb-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${
                                stepIndex >= i - 1 ? 'bg-brand' : 'bg-gray-200 dark:bg-zinc-700'
                            }`} />
                        ))}
                    </div>

                    {/* Step 1: Email */}
                    {step === STEP_EMAIL && (
                        <form onSubmit={handleSendOTP} className="space-y-5">
                            <Input
                                label="College Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@college.ac.in"
                                required
                            />

                            {detectedCollege && (
                                <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <GraduationCap size={18} className="text-green-600 dark:text-green-400 shrink-0" />
                                    <span className="text-sm text-green-700 dark:text-green-300">
                                        <span className="font-bold">{detectedCollege.name}</span>
                                        {detectedCollege.isDemo && ' — Demo mode'}
                                    </span>
                                </div>
                            )}

                            {email && email.includes('@') && !detectedCollege && (
                                <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                                    Not a recognized college email. Use your .edu or .ac.in address.
                                </div>
                            )}

                            <Button
                                type="submit"
                                loading={isLoading}
                                size="lg"
                                className="w-full"
                                disabled={!detectedCollege}
                            >
                                <Mail size={18} /> Send Verification Code
                            </Button>
                        </form>
                    )}

                    {/* Step 2: OTP */}
                    {step === STEP_OTP && (
                        <form onSubmit={handleVerifyOTP} className="space-y-6">
                            <button
                                type="button"
                                onClick={() => setStep(STEP_EMAIL)}
                                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
                            >
                                <ArrowLeft size={14} /> Change email
                            </button>

                            <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => otpRefs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors"
                                    />
                                ))}
                            </div>

                            <Button type="submit" loading={isLoading} size="lg" className="w-full">
                                <CheckCircle size={18} /> Verify Email
                            </Button>

                            <p className="text-center text-sm text-gray-500 dark:text-zinc-400">
                                {resendTimer > 0 ? (
                                    <span>Resend in {resendTimer}s</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResendOTP}
                                        className="text-brand font-semibold hover:text-brand-hover hover:underline transition-colors"
                                    >
                                        Resend code
                                    </button>
                                )}
                            </p>
                        </form>
                    )}

                    {/* Step 3: Profile */}
                    {step === STEP_DETAILS && (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <CheckCircle size={18} className="text-green-600 dark:text-green-400 shrink-0" />
                                <span className="text-sm text-green-700 dark:text-green-300">
                                    <span className="font-bold">{email}</span> verified
                                </span>
                            </div>

                            {/* Avatar */}
                            <div className="flex justify-center">
                                <label className="relative cursor-pointer group">
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="w-24 h-24 rounded-full object-cover ring-4 ring-brand-light"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-zinc-600 group-hover:border-brand transition-colors">
                                            <User size={32} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 right-0 w-8 h-8 bg-brand rounded-full flex items-center justify-center shadow-lg">
                                        <Upload size={14} className="text-white" />
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Full Name"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="Your name"
                                    required
                                />
                                <Input
                                    label="Username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Pick a username"
                                    required
                                />
                            </div>

                            <Select
                                label="Gender"
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                placeholder="Select gender"
                                options={[
                                    { value: 'male', label: 'Male' },
                                    { value: 'female', label: 'Female' },
                                    { value: 'other', label: 'Other' },
                                    { value: 'prefer-not-to-say', label: 'Prefer not to say' }
                                ]}
                            />

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                                    Interests <span className="text-gray-400 dark:text-zinc-500 font-normal">(pick up to 5)</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {INTEREST_OPTIONS.map(interest => (
                                        <button
                                            key={interest}
                                            type="button"
                                            onClick={() => toggleInterest(interest)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                formData.interests.includes(interest)
                                                    ? 'bg-brand text-white hover:bg-brand-hover'
                                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                            }`}
                                        >
                                            {interest}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <Input
                                        label="Password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Min 6 chars"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Input
                                        label="Confirm"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Again"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <Button type="submit" loading={isLoading} size="lg" className="w-full">
                                Create Account
                            </Button>
                        </form>
                    )}

                    <p className="text-center text-sm text-gray-500 dark:text-zinc-400 mt-8">
                        Already have an account?{' '}
                        <Link to="/login" className="text-brand font-semibold hover:text-brand-hover hover:underline transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
