const variants = {
    primary: 'bg-brand hover:bg-brand-hover text-white shadow-sm',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    outline: 'border-2 border-brand text-brand hover:bg-brand-light dark:hover:bg-brand/10',
    ghost: 'text-brand hover:bg-brand-light dark:hover:bg-brand/10'
}

const sizes = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-5 text-sm',
    lg: 'h-12 px-8 text-base'
}

export default function Button({
    children, variant = 'primary', size = 'md',
    className = '', disabled = false, loading = false, ...props
}) {
    return (
        <button
            className={`${variants[variant]} ${sizes[size]} rounded-lg font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {children}
        </button>
    )
}
