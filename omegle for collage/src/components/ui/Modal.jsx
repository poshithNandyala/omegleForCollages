import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
    const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset'
        return () => { document.body.style.overflow = 'unset' }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className={`relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl ${sizes[size]} w-full max-h-[90vh] overflow-auto`}>
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <X size={18} className="text-gray-500 dark:text-zinc-400" />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    )
}
