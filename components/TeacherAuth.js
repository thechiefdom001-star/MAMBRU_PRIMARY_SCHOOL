import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

export const TeacherAuth = ({ settings, onLogin, onClose }) => {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('teacher');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (settings?.googleScriptUrl) {
            googleSheetSync.setSettings(settings);
        }
    }, [settings]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }

        if (!settings?.googleScriptUrl) {
            setError('Google Sheet not configured. Please configure in Settings.');
            return;
        }

        setLoading(true);

        try {
            const result = await googleSheetSync.loginTeacher(username, password);

            if (result.success) {
                setSuccess('Login successful!');
                
                const teacherData = {
                    username: result.username,
                    name: result.name || result.username,
                    teacherId: result.teacherId,
                    role: result.role || 'teacher',
                    isTeacher: true
                };

                localStorage.setItem('et_teacher_session', JSON.stringify(teacherData));
                
                setTimeout(() => {
                    onLogin(teacherData);
                }, 500);
            } else {
                setError(result.error || 'Invalid username or password');
            }
        } catch (err) {
            setError('Login failed. Please try again.');
            console.error('Login error:', err);
        }

        setLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }

        if (password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!settings?.googleScriptUrl) {
            setError('Google Sheet not configured. Please configure in Settings.');
            return;
        }

        setLoading(true);

        try {
            const result = await googleSheetSync.registerTeacher(
                username,
                password,
                '',
                name || username,
                role
            );

            if (result.success) {
                setSuccess('Account created! You can now login.');
                setMode('login');
                setPassword('');
                setConfirmPassword('');
            } else {
                setError(result.error || 'Registration failed');
            }
        } catch (err) {
            setError('Registration failed. Please try again.');
            console.error('Register error:', err);
        }

        setLoading(false);
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setName('');
    };

    return html`
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <!-- Header -->
                <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
                    <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span class="text-3xl">👩‍🏫</span>
                    </div>
                    <h2 class="text-xl font-bold">Teacher Portal</h2>
                    <p class="text-blue-100 text-sm mt-1">
                        ${mode === 'login' ? 'Sign in to your account' : 'Create your account'}
                    </p>
                </div>

                <!-- Form -->
                <div class="p-6">
                    ${error && html`
                        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            <span class="font-bold">Error:</span> ${error}
                        </div>
                    `}

                    ${success && html`
                        <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            <span class="font-bold">Success:</span> ${success}
                        </div>
                    `}

                    ${mode === 'login' ? html`
                        <form onSubmit=${handleLogin} class="space-y-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Username</label>
                                <input
                                    type="text"
                                    value=${username}
                                    onInput=${e => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Password</label>
                                <div class="relative">
                                    <input
                                        type=${showPassword ? 'text' : 'password'}
                                        value=${password}
                                        onInput=${e => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick=${() => setShowPassword(!showPassword)}
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        ${showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled=${loading}
                                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
                            >
                                ${loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>

                        <div class="mt-4 text-center">
                            <p class="text-sm text-slate-500">
                                Don't have an account?
                                <button
                                    onClick=${() => switchMode('register')}
                                    class="text-blue-600 hover:text-blue-700 font-bold"
                                >
                                    Register here
                                </button>
                            </p>
                        </div>
                    ` : html`
                        <form onSubmit=${handleRegister} class="space-y-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Your Name</label>
                                <input
                                    type="text"
                                    value=${name}
                                    onInput=${e => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Username (login name)</label>
                                <input
                                    type="text"
                                    value=${username}
                                    onInput=${e => setUsername(e.target.value.toLowerCase())}
                                    placeholder="Choose a username"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Role</label>
                                <select
                                    value=${role}
                                    onChange=${e => setRole(e.target.value)}
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="teacher">Teacher</option>
                                    <option value="class_teacher">Class Teacher</option>
                                    <option value="head_teacher">Head Teacher</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Password</label>
                                <input
                                    type="password"
                                    value=${password}
                                    onInput=${e => setPassword(e.target.value)}
                                    placeholder="Create a password (min 4 chars)"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value=${confirmPassword}
                                    onInput=${e => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled=${loading}
                                class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
                            >
                                ${loading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>

                        <div class="mt-4 text-center">
                            <p class="text-sm text-slate-500">
                                Already have an account?
                                <button
                                    onClick=${() => switchMode('login')}
                                    class="text-blue-600 hover:text-blue-700 font-bold"
                                >
                                    Sign in here
                                </button>
                            </p>
                        </div>
                    `}

                    <div class="mt-6 pt-4 border-t border-slate-100 text-center">
                        <button
                            onClick=${onClose}
                            class="text-sm text-slate-500 hover:text-slate-700"
                        >
                            Continue without logging in (Guest mode)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export default TeacherAuth;
