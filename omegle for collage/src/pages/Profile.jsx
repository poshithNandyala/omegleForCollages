import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { User, Camera, Save, Mail, AtSign } from 'lucide-react'
import { Input, Button } from '../components/ui'
import useAuthStore from '../stores/authStore'
import api from '../lib/axios'

const INTEREST_OPTIONS = [
    'Music', 'Gaming', 'Sports', 'Movies', 'Anime', 'Coding',
    'Art', 'Travel', 'Books', 'Fitness', 'Photography', 'Cooking',
    'Dance', 'Science', 'Memes', 'Fashion'
]

export default function Profile() {
    const { user, updateUser } = useAuthStore()
    const [formData, setFormData] = useState({
        fullName: user?.fullName || '',
        bio: user?.bio || '',
        interests: user?.interests || []
    })
    const [avatar, setAvatar] = useState(null)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const fileInputRef = useRef(null)

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
        setIsLoading(true)
        try {
            const data = new FormData()
            data.append('fullName', formData.fullName)
            data.append('bio', formData.bio)
            data.append('interests', JSON.stringify(formData.interests))
            if (avatar) data.append('avatar', avatar)
            const response = await api.patch('/users/profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            updateUser(response.data.data)
            toast.success('Profile updated!')
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed')
        } finally { setIsLoading(false) }
    }

    return (
        <div className="flex-1 bg-gray-50 dark:bg-zinc-950">
            <div className="w-full max-w-[1400px] mx-auto px-6 py-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-6">Your Profile</h1>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Avatar & info card */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-8 text-center">
                            <div className="relative inline-block cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                {(avatarPreview || user?.avatar) ? (
                                    <img src={avatarPreview || user?.avatar} alt="Avatar"
                                        className="w-28 h-28 rounded-full object-cover ring-4 ring-brand-light mx-auto" />
                                ) : (
                                    <div className="w-28 h-28 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-zinc-600 hover:border-brand transition-colors mx-auto">
                                        <User size={40} className="text-gray-400 dark:text-zinc-500" />
                                    </div>
                                )}
                                <div className="absolute bottom-0 right-0 w-9 h-9 bg-brand rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-zinc-900">
                                    <Camera size={16} className="text-white" />
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mt-5">{user?.fullName}</h2>
                            <div className="flex items-center justify-center gap-1.5 mt-1 text-sm text-brand font-medium">
                                <AtSign size={14} /> {user?.username}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-gray-500 dark:text-zinc-400">
                                <Mail size={14} /> {user?.email}
                            </div>
                            {user?.college && (
                                <div className="mt-4 px-4 py-2.5 bg-brand-light dark:bg-brand/10 rounded-lg text-sm text-brand font-semibold">
                                    {user.college}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Edit form */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-8">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-6">Edit Profile</h2>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <Input label="Full Name" name="fullName" value={formData.fullName}
                                    onChange={handleChange} placeholder="Your full name" />

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">Bio</label>
                                    <textarea name="bio" value={formData.bio} onChange={handleChange}
                                        placeholder="Write something about yourself..."
                                        rows={4} maxLength={200}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand resize-none" />
                                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 text-right">{formData.bio.length}/200</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                                        Interests <span className="text-gray-400 dark:text-zinc-500 font-normal">(pick up to 5)</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {INTEREST_OPTIONS.map(interest => (
                                            <button key={interest} type="button" onClick={() => toggleInterest(interest)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                    formData.interests.includes(interest)
                                                        ? 'bg-brand text-white'
                                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                                }`}>
                                                {interest}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Button type="submit" loading={isLoading} size="lg">
                                        <Save size={16} /> Save Changes
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
