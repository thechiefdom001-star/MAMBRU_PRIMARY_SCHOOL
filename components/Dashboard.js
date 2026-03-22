import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { ActivityLog } from './ActivityLog.js';

const html = htm.bind(h);

export const Dashboard = ({ data, googleSyncStatus, isAdmin, teacherSession }) => {
    const students = data?.students || [];
    const payments = data?.payments || [];
    const assessments = data?.assessments || [];
    const settings = data?.settings || { currency: 'KES.', grades: [], feeStructures: [] };
    
    const [activeUsers, setActiveUsers] = useState([]);
    const [lastActivity, setLastActivity] = useState(null);

    // Check for active users periodically
    useEffect(() => {
        if (!settings.googleScriptUrl) return;
        
        const checkActiveUsers = async () => {
            try {
                googleSheetSync.setSettings(settings);
                const result = await googleSheetSync.getActiveUsers();
                
                if (result.success) {
                    // result.users contains the array of active user objects
                    setActiveUsers(result.users || []);
                    if (result.users && result.users.length > 0) {
                        const mostRecent = result.users.reduce((prev, curr) => 
                            (parseInt(curr.lastActivity) > parseInt(prev.lastActivity)) ? curr : prev
                        );
                        setLastActivity(new Date(parseInt(mostRecent.lastActivity)));
                } else if (result.lastActivity) {
                        setLastActivity(new Date(parseInt(result.lastActivity)));
                    }
                }
            } catch (error) {
                console.warn('Error checking active users:', error);
            }
        };
        
        // Check immediately and then every 30 seconds
        checkActiveUsers();
        const interval = setInterval(checkActiveUsers, 30000);
        
        return () => clearInterval(interval);
    }, [settings.googleScriptUrl]);

    const totalStudents = students.length;
    const totalTeachers = (data?.teachers || []).length;
    const totalStaff = (data?.staff || []).length;
    const totalFeesCollected = (data?.payments || [])
        .filter(p => !p.voided)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const expectedFees = students.reduce((sum, s) => {
        const fin = Storage.getStudentFinancials(s, data.payments, settings);
        return sum + fin.totalDue;
    }, 0);
    const totalArrears = expectedFees - totalFeesCollected;
    const feePercentage = expectedFees > 0 ? (totalFeesCollected / expectedFees) * 100 : 0;

    const feesPerGrade = (settings.grades || []).map(grade => {
        const gradeStudentIds = students.filter(s => s.grade === grade).map(s => s.id);
        const total = (data?.payments || [])
            .filter(p => gradeStudentIds.includes(p.studentId) && !p.voided)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return { grade, total };
    });
    const maxGradeFee = Math.max(...feesPerGrade.map(f => f.total), 1);

    const assessmentActivity = (settings.grades || []).map(grade => {
        const gradeStudents = students.filter(s => s.grade === grade);
        const totalEnrolled = gradeStudents.length;
        
        const gradeStudentIds = new Set(gradeStudents.map(s => String(s.id)));
        const assessedStudentIds = new Set(
            assessments.filter(a => gradeStudentIds.has(String(a.studentId))).map(a => String(a.studentId))
        );
        
        const studentsAssessed = assessedStudentIds.size;
        const percentage = totalEnrolled > 0 ? (studentsAssessed / totalEnrolled) * 100 : 0;
        
        return {
            grade,
            totalEnrolled,
            studentsAssessed,
            percentage
        };
    });

    return html`
        <div class="space-y-8 animate-in fade-in duration-500">
            <!-- Sync Status Banner -->
            ${googleSyncStatus && html`
                <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="animate-pulse">🔄</span>
                        <span class="font-bold text-sm">${googleSyncStatus}</span>
                    </div>
                </div>
            `}
            ${settings.googleScriptUrl && html`
                <div class="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3 rounded-xl shadow-lg shadow-green-200">
                    <div class="flex items-center gap-3 mb-3">
                        <span class="text-2xl">📊</span>
                        <div>
                            <p class="font-bold">Google Sheet Connected</p>
                            <p class="text-xs text-green-100">Real-time data sync enabled</p>
                        </div>
                    </div>
                    
                    <!-- Active Users Display -->
                    ${activeUsers.length > 0 ? html`
                        <div class="mt-4 pt-4 border-t border-white/20">
                            <p class="text-xs font-bold uppercase text-green-100 mb-3">👥 Online Users (${activeUsers.length})</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                ${activeUsers.map(user => {
                                    const lastTime = new Date(user.lastActivity);
                                    const role = user.device.includes('admin@') ? '👨‍💼 Admin' : '👨‍🏫 Teacher';
                                    const username = user.device.split('@')[1]?.split('-')[0] || 'Unknown';
                                    return html`
                                        <div class="bg-white/10 backdrop-blur rounded-lg p-3 flex items-center gap-3">
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-bold truncate">${role}</p>
                                                <p class="text-xs text-green-100 truncate">${username}</p>
                                                <p class="text-[10px] text-green-200 mt-1">Active: ${lastTime.toLocaleTimeString()}</p>
                                            </div>
                                            <div class="flex-shrink-0">
                                                <span class="inline-flex h-3 w-3 rounded-full bg-green-300 animate-pulse"></span>
                                            </div>
                                        </div>
                                    `;
                                })}
                            </div>
                        </div>
                    ` : html`
                        <div class="mt-4 pt-4 border-t border-white/20">
                            <p class="text-xs text-green-100">No users currently active. Last activity: ${lastActivity ? lastActivity.toLocaleTimeString() : 'N/A'}</p>
                        </div>
                    `}
                </div>
            `}

            <div class="no-print">
                <h1 class="text-3xl font-extrabold tracking-tight">System Overview</h1>
                <p class="text-slate-500 mt-1">Welcome back to ${settings.schoolName || 'the portal'}.</p>
            </div>

            <!-- Horizontally scrollable panels on mobile -->
            <div class="flex overflow-x-auto no-scrollbar md:grid md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0">
                <div class="min-w-[160px] md:min-w-0 flex-1"><${StatCard} title="Students" value=${totalStudents} subtitle="Enrollment" icon="👥" color="blue" /></div>
                <div class="min-w-[160px] md:min-w-0 flex-1"><${StatCard} title="Teachers" value=${totalTeachers} subtitle="Academic" icon="👨‍🏫" color="orange" /></div>
                <div class="min-w-[160px] md:min-w-0 flex-1"><${StatCard} title="Staff" value=${totalStaff} subtitle="Support" icon="🛠️" color="cyan" /></div>
                <div class="min-w-[160px] md:min-w-0 flex-1"><${StatCard} title="Paid" value=${`${settings.currency} ${totalFeesCollected.toLocaleString()}`} subtitle=${`${feePercentage.toFixed(1)}% Target`} icon="💰" color="green" /></div>
                <div class="min-w-[160px] md:min-w-0 flex-1"><${StatCard} title="Arrears" value=${`${settings.currency} ${totalArrears.toLocaleString()}`} subtitle="Outstanding" icon="⚠️" color="red" /></div>
                <div class="min-w-[160px] md:min-w-0 flex-1"><${StatCard} title="Assess" value=${assessments.length} subtitle="CBC Records" icon="📝" color="purple" /></div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Recent Activity
                    </h3>
                    <div class="space-y-1">
                        ${payments.slice(-5).reverse().map((p, idx) => {
        const student = (students || []).find(s => String(s.id) === String(p.studentId));
        return html`
                                <div class=${`flex justify-between items-center p-3 rounded-xl border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                                    <div>
                                        <p class="font-bold text-xs md:text-sm text-slate-700">${student?.name || 'Unknown Student'}</p>
                                        <p class="text-[10px] text-slate-400">Payment Received • ${p.date}</p>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-green-600 font-black text-xs md:text-sm">+${settings.currency} ${p.amount.toLocaleString()}</span>
                                        <p class="text-[8px] text-slate-300 font-mono uppercase">${p.receiptNo || 'N/A'}</p>
                                    </div>
                                </div>
                            `;
    })}
                        ${payments.length === 0 && html`<p class="text-center text-slate-300 py-4 text-sm">No recent payments recorded</p>`}
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-6 flex items-center gap-2">
                        <span class="w-2 h-2 bg-purple-500 rounded-full"></span>
                        Student Enrollment per Grade
                    </h3>
                    <div class="relative h-60 border-l border-b border-slate-200 ml-8 mb-8">
                        <!-- Y-Axis Labels -->
                        <div class="absolute -left-8 h-full w-8 flex flex-col justify-between text-[8px] font-bold text-slate-400 py-1">
                            <span>MAX</span>
                            <span>75%</span>
                            <span>50%</span>
                            <span>25%</span>
                            <span>0</span>
                        </div>
                        <!-- Grid Lines -->
                        <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="h-0"></div>
                        </div>
                        <!-- Bars -->
                        <div class="absolute inset-0 flex items-end justify-between gap-1 px-1">
                            ${(settings.grades || []).map((grade, index) => {
        const count = students.filter(s => s.grade === grade).length;
        const maxCount = Math.max(...settings.grades.map(g => students.filter(s => s.grade === g).length), 1);
        const heightPct = (count / maxCount) * 100;
        const colors = ['bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400', 'bg-pink-400', 'bg-yellow-400', 'bg-cyan-400', 'bg-indigo-400'];
        const color = colors[index % colors.length];

        return html`
                                    <div class="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        <div class=${`w-full ${color} rounded-t-sm opacity-80 hover:opacity-100 transition-all cursor-pointer relative z-10`} style=${{ height: `${heightPct}%` }}>
                                            ${count > 0 && html`<span class="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity z-20">${count}</span>`}
                                        </div>
                                        <!-- X-Axis Label -->
                                        <span class="absolute -bottom-10 text-[8px] font-bold text-slate-400 uppercase rotate-45 origin-left whitespace-nowrap">${grade}</span>
                                    </div>
                                `;
    })}
                        </div>
                    </div>
                    ${totalStudents === 0 && html`<p class="text-center text-slate-300 py-12 text-sm">No enrollment data</p>`}
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                    <h3 class="font-bold mb-6 flex items-center gap-2">
                        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                        Fee Collection per Grade (${settings.currency})
                    </h3>
                    <div class="relative h-60 border-l border-b border-slate-200 ml-16 mb-8">
                        <!-- Y-Axis Labels -->
                        <div class="absolute -left-16 h-full w-14 flex flex-col justify-between text-[8px] font-bold text-slate-400 py-1 text-right pr-2">
                            <span>${(maxGradeFee / 1000).toFixed(0)}K</span>
                            <span>${(maxGradeFee * 0.75 / 1000).toFixed(0)}K</span>
                            <span>${(maxGradeFee * 0.5 / 1000).toFixed(0)}K</span>
                            <span>${(maxGradeFee * 0.25 / 1000).toFixed(0)}K</span>
                            <span>0</span>
                        </div>
                        <!-- Grid Lines -->
                        <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="h-0"></div>
                        </div>
                        <!-- Bars -->
                        <div class="absolute inset-0 flex items-end justify-between gap-1 px-1">
                            ${feesPerGrade.map((item, index) => {
        const heightPct = (item.total / maxGradeFee) * 100;
        const colors = ['bg-emerald-400', 'bg-teal-400', 'bg-cyan-400', 'bg-sky-400', 'bg-blue-400', 'bg-indigo-400', 'bg-violet-400', 'bg-purple-400'];
        const color = colors[index % colors.length];

        return html`
                                    <div class="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        <div class=${`w-full ${color} rounded-t-sm opacity-80 hover:opacity-100 transition-all cursor-pointer relative z-10`} style=${{ height: `${heightPct}%` }}>
                                            <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                                                ${settings.currency} ${item.total.toLocaleString()}
                                            </div>
                                        </div>
                                        <!-- X-Axis Label -->
                                        <span class="absolute -bottom-10 text-[8px] font-bold text-slate-400 uppercase rotate-45 origin-left whitespace-nowrap">${item.grade}</span>
                                    </div>
                                `;
    })}
                        </div>
                    </div>
                    ${totalFeesCollected === 0 && html`<p class="text-center text-slate-300 py-12 text-sm">No fee collection data yet</p>`}
                </div>
                
                <!-- Assessment Activity Component -->
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                    <h3 class="font-bold mb-6 flex items-center gap-2">
                        <span class="w-2 h-2 bg-purple-500 rounded-full"></span>
                        Assessment Activity
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        ${assessmentActivity.map(item => {
                            let colorTheme = { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' };
                            if (item.percentage === 100) colorTheme = { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' };
                            else if (item.percentage >= 75) colorTheme = { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' };
                            else if (item.percentage >= 50) colorTheme = { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' };
                            else if (item.percentage >= 25) colorTheme = { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' };
                            else if (item.percentage > 0) colorTheme = { bg: 'bg-rose-100', text: 'text-rose-700', bar: 'bg-rose-500' };
                            else colorTheme = { bg: 'bg-slate-200', text: 'text-slate-600', bar: 'bg-slate-300' };
                            
                            return html`
                            <div class="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="font-bold text-slate-700 text-sm truncate pr-2">${item.grade}</span>
                                    <span class=${`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${colorTheme.bg} ${colorTheme.text}`}>
                                        ${item.percentage.toFixed(0)}%
                                    </span>
                                </div>
                                <div class="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                                    <div 
                                        class=${`h-2 rounded-full transition-all duration-1000 ${colorTheme.bar}`}
                                        style=${{ width: `${item.percentage}%` }}
                                    ></div>
                                </div>
                                <div class="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                    <span>${item.studentsAssessed} Assessed</span>
                                    <span>${item.totalEnrolled} Total</span>
                                </div>
                            </div>
                        `;
                        })}
                    </div>
                </div>

                <!-- Activity Log -->
                ${isAdmin && html`
                    <div class="lg:col-span-2">
                        <${ActivityLog} 
                            settings=${settings} 
                            isAdmin=${isAdmin}
                            teacherSession=${teacherSession}
                            limit=${25}
                        />
                    </div>
                `}
            </div>
        </div>
    `;
};

const StatCard = ({ title, value, subtitle, icon, color }) => {
    const themes = {
        blue: { bg: 'bg-blue-600', text: 'text-white', sub: 'text-blue-100', iconBg: 'bg-blue-500', stripe: 'rgba(255,255,255,0.05)' },
        green: { bg: 'bg-emerald-600', text: 'text-white', sub: 'text-emerald-100', iconBg: 'bg-emerald-500', stripe: 'rgba(255,255,255,0.05)' },
        purple: { bg: 'bg-purple-600', text: 'text-white', sub: 'text-purple-100', iconBg: 'bg-purple-500', stripe: 'rgba(255,255,255,0.05)' },
        orange: { bg: 'bg-orange-500', text: 'text-white', sub: 'text-orange-100', iconBg: 'bg-orange-400', stripe: 'rgba(255,255,255,0.05)' },
        cyan: { bg: 'bg-cyan-600', text: 'text-white', sub: 'text-cyan-100', iconBg: 'bg-cyan-500', stripe: 'rgba(255,255,255,0.05)' },
        red: { bg: 'bg-rose-600', text: 'text-white', sub: 'text-rose-100', iconBg: 'bg-rose-500', stripe: 'rgba(255,255,255,0.05)' }
    };

    const theme = themes[color] || themes.blue;

    return html`
        <div 
            class=${`${theme.bg} ${theme.text} p-5 md:p-6 rounded-3xl shadow-lg border-0 hover:scale-[1.02] transition-all relative overflow-hidden group h-full`}
            style=${{
            backgroundImage: `linear-gradient(135deg, transparent 25%, ${theme.stripe} 25%, ${theme.stripe} 50%, transparent 50%, transparent 75%, ${theme.stripe} 75%, ${theme.stripe})`,
            backgroundSize: '20px 20px'
        }}
        >
            <div class=${`w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-4 ${theme.iconBg} shadow-inner`}>
                ${icon}
            </div>
            <h4 class=${`${theme.sub} text-[10px] font-black uppercase tracking-widest`}>${title}</h4>
            <p class="text-xl md:text-2xl font-black mt-1 leading-tight">${value}</p>
            <p class=${`${theme.sub} text-[10px] font-bold mt-1 opacity-80`}>${subtitle}</p>
            
            <!-- Decorative circle -->
            <div class="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
        </div>
    `;
};