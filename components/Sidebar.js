import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export const Sidebar = ({ currentView, setView, isCollapsed, setCollapsed, isMobileOpen, setIsMobileOpen }) => {
    const [expandedGroups, setExpandedGroups] = useState(['academics', 'finance', 'administration']);

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => 
            prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
        );
    };

    const navigation = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { 
            id: 'academics', 
            label: 'Academic Wing', 
            icon: '🎓',
            items: [
                { id: 'students', label: 'Students', icon: '👥' },
                { id: 'senior-school', label: 'Senior School', icon: '🏅' },
                { id: 'assessments', label: 'Assessments', icon: '📝' },
                { id: 'attendance', label: 'Attendance', icon: '✅' },
                { id: 'marklist', label: 'Marklist', icon: '🏆' },
                { id: 'timetable', label: 'Timetable', icon: '📅' },
                { id: 'result-analysis', label: 'Result Analysis', icon: '📈' },
            ]
        },
        { 
            id: 'finance', 
            label: 'Finance Office', 
            icon: '💰',
            items: [
                { id: 'fees', label: 'Collect Fees', icon: '💳' },
                { id: 'fees-register', label: 'Fee Register', icon: '📋' },
                { id: 'fee-reminder', label: 'Fee Reminders', icon: '🔔' },
                { id: 'payroll', label: 'Payroll', icon: '🏦' },
            ]
        },
        { 
            id: 'administration', 
            label: 'Administration', 
            icon: '🏛️',
            items: [
                { id: 'teachers', label: 'Teachers', icon: '👨‍🏫' },
                { id: 'staff', label: 'Support Staff', icon: '🛠️' },
                { id: 'transport', label: 'Transport', icon: '🚌' },
                { id: 'library', label: 'Library', icon: '📚' },
                { id: 'archives', label: 'Archives', icon: '🗄️' },
            ]
        },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    const handleLinkClick = (id) => {
        setView(id);
    };

    const isMini = isCollapsed;

    const renderMenuItem = (item) => html`
        <button
            type="button"
            key=${item.id}
            onClick=${() => handleLinkClick(item.id)}
            class=${`w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                currentView === item.id ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            } ${isMini ? 'justify-center' : ''}`}
        >
            <span class=${`text-lg ${isMini ? '' : 'mr-3'}`}>${item.icon}</span>
            ${!isMini && html`<span class="truncate text-sm font-medium">${item.label}</span>`}
            ${isMini && html`
                <div class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    ${item.label}
                </div>
            `}
        </button>
    `;

    return html`
        <aside class=${`flex flex-col bg-slate-950 text-white h-full overflow-hidden shrink-0 transition-all duration-300 no-print z-[50] shadow-2xl ${
            isMini ? 'w-16 md:w-20' : 'w-0 md:w-64'
        } ${isMobileOpen ? 'w-64' : ''}`}>
            
            <div class=${`p-4 border-b border-slate-900 flex items-center ${isMini ? 'justify-center' : 'justify-between'}`}>
                ${(!isMini || isMobileOpen) && html`<span class="font-black text-xs uppercase tracking-tighter text-slate-500">Navigation</span>`}
                <button 
                    type="button"
                    onClick=${() => setCollapsed(!isCollapsed)}
                    class=${`p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors ${isMobileOpen ? 'hidden md:block' : ''}`}
                >
                    ${isMini ? '➡️' : '⬅️'}
                </button>
                ${isMobileOpen && html`
                    <button onClick=${() => setIsMobileOpen(false)} class="md:hidden p-2 text-slate-500">✕</button>
                `}
            </div>

            <nav class="flex-1 space-y-2 p-3 overflow-y-auto no-scrollbar">
                ${navigation.map(node => {
                    if (node.items) {
                        const isExpanded = expandedGroups.includes(node.id) && !isMini;
                        return html`
                            <div class="space-y-1">
                                <button 
                                    type="button"
                                    onClick=${() => toggleGroup(node.id)}
                                    class=${`w-full flex items-center p-2 rounded-lg text-slate-500 hover:text-white transition-colors ${isMini ? 'justify-center' : 'justify-between'}`}
                                >
                                    <div class="flex items-center">
                                        <span class=${`text-lg ${isMini ? '' : 'mr-3'}`}>${node.icon}</span>
                                        ${!isMini && html`<span class="text-[10px] font-black uppercase tracking-widest">${node.label}</span>`}
                                    </div>
                                    ${!isMini && html`<span class="text-[8px] transition-transform ${isExpanded ? 'rotate-180' : ''}">▼</span>`}
                                </button>
                                ${isExpanded && html`
                                    <div class="pl-2 space-y-1 animate-in slide-in-from-left-2 duration-200">
                                        ${node.items.map(item => renderMenuItem(item))}
                                    </div>
                                `}
                                ${isMini && html`
                                    <div class="flex flex-col gap-1 items-center">
                                        ${node.items.map(item => html`
                                            <button 
                                                type="button"
                                                onClick=${() => handleLinkClick(item.id)}
                                                class=${`p-2 rounded-lg transition-all ${currentView === item.id ? 'bg-primary/20 text-primary' : 'text-slate-600 hover:text-slate-300'}`}
                                                title=${item.label}
                                            >
                                                <span class="text-xs">${item.icon}</span>
                                            </button>
                                        `)}
                                    </div>
                                `}
                            </div>
                        `;
                    }
                    return renderMenuItem(node);
                })}
            </nav>

            <div class="p-4 border-t border-slate-900 mt-auto">
                <div class=${`flex items-center ${isMini ? 'justify-center' : 'gap-3'}`}>
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">AD</div>
                    ${(!isMini || isMobileOpen) && html`
                        <div class="overflow-hidden">
                            <p class="text-[10px] font-bold truncate">Administrator</p>
                            <p class="text-[8px] text-slate-500">Online</p>
                        </div>
                    `}
                </div>
            </div>
        </aside>
    `;
};