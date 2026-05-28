import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = ({ label, type = "text", description, ...props }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
        <div className="mb-4">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">{label}</label>
            <div className="relative">
                <input
                    type={isPassword ? (showPassword ? "text" : "password") : type}
                    className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 hover:border-slate-500 hover:scale-[1.01] focus:scale-[1.02] focus:shadow-[0_0_15px_-3px_rgba(37,99,235,0.3)] ${isPassword ? 'pr-10' : ''}`}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {description && (
                <p className="text-xs text-slate-500 mt-1">{description}</p>
            )}
        </div>
    );
};

export default Input;
