export default function Loader({ size = 'md', className = '' }) {
    const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }
    return (
        <div className={`flex items-center justify-center ${className}`}>
            <div className={`${sizes[size]} border-[3px] border-gray-200 dark:border-zinc-700 border-t-brand rounded-full animate-spin`} />
        </div>
    )
}

export function PageLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
            <Loader size="lg" />
        </div>
    )
}
