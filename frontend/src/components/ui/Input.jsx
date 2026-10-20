import React, { useState } from 'react';
import { Eye, EyeOff, Sparkles, RefreshCw } from 'lucide-react';

export const generateRandomUser = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result; // exatamente 7 caracteres
};

export const generateRandomPassword = () => {
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = uppers + lowers + numbers + symbols;

    let result = [
        uppers.charAt(Math.floor(Math.random() * uppers.length)),
        lowers.charAt(Math.floor(Math.random() * lowers.length)),
        numbers.charAt(Math.floor(Math.random() * numbers.length)),
        symbols.charAt(Math.floor(Math.random() * symbols.length)),
    ];

    for (let i = 4; i < 21; i++) {
        result.push(allChars.charAt(Math.floor(Math.random() * allChars.length)));
    }

    return result.sort(() => Math.random() - 0.5).join('');
};

const Input = ({
    label,
    type = "text",
    description,
    showUserGenerator,
    showPasswordGenerator,
    onChange,
    name,
    ...props
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === 'password';

    const isUserField = showUserGenerator ?? (
        !isPasswordType && (
            (label && (label.toLowerCase().includes('usuário') || label.toLowerCase().includes('usuario') || label.toLowerCase().includes('user'))) ||
            (name && (name.toLowerCase().includes('user') || name.toLowerCase().includes('usuario')))
        )
    );

    const isPasswordField = showPasswordGenerator ?? isPasswordType;

    const handleGenerateUser = () => {
        const newUser = generateRandomUser();
        if (onChange) {
            onChange({
                target: {
                    name,
                    value: newUser
                }
            });
        }
    };

    const handleGeneratePassword = () => {
        const newPassword = generateRandomPassword();
        if (onChange) {
            onChange({
                target: {
                    name,
                    value: newPassword
                }
            });
        }
    };

    let paddingRightClass = 'pr-4';
    if (isPasswordType && isPasswordField) {
        paddingRightClass = 'pr-20';
    } else if (isPasswordType || isUserField || isPasswordField) {
        paddingRightClass = 'pr-10';
    }

    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
                {label && <label className="block text-sm font-medium text-slate-400">{label}</label>}
                {isUserField && (
                    <button
                        type="button"
                        onClick={handleGenerateUser}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
                        title="Gerar usuário aleatório de 7 caracteres"
                    >
                        <Sparkles size={12} /> Gerar Usuário (7 chars)
                    </button>
                )}
                {isPasswordField && (
                    <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
                        title="Gerar senha aleatória de 21 caracteres"
                    >
                        <Sparkles size={12} /> Gerar Senha (21 chars)
                    </button>
                )}
            </div>
            <div className="relative">
                <input
                    type={isPasswordType ? (showPassword ? "text" : "password") : type}
                    name={name}
                    onChange={onChange}
                    className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 hover:border-slate-500 hover:scale-[1.01] focus:scale-[1.02] focus:shadow-[0_0_15px_-3px_rgba(37,99,235,0.3)] ${paddingRightClass}`}
                    {...props}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {isUserField && (
                        <button
                            type="button"
                            onClick={handleGenerateUser}
                            className="text-slate-500 hover:text-blue-400 p-1 rounded hover:bg-slate-800 transition-colors"
                            title="Gerar usuário (7 caracteres)"
                        >
                            <RefreshCw size={16} className="hover:rotate-180 transition-transform duration-300" />
                        </button>
                    )}
                    {isPasswordField && (
                        <button
                            type="button"
                            onClick={handleGeneratePassword}
                            className="text-slate-500 hover:text-blue-400 p-1 rounded hover:bg-slate-800 transition-colors"
                            title="Gerar senha (21 caracteres)"
                        >
                            <RefreshCw size={16} className="hover:rotate-180 transition-transform duration-300" />
                        </button>
                    )}
                    {isPasswordType && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-slate-500 hover:text-slate-300 focus:outline-none p-1 rounded hover:bg-slate-800 transition-colors"
                            title={showPassword ? "Ocultar senha" : "Ver senha"}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    )}
                </div>
            </div>
            {description && (
                <p className="text-xs text-slate-500 mt-1">{description}</p>
            )}
        </div>
    );
};

export default Input;

