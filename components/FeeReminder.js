import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export const FeeReminder = ({ data }) => {
    const [filterGrade, setFilterGrade] = useState('ALL');
    const [selectedStudentId, setSelectedStudentId] = useState('ALL');
    const [selectedTerm, setSelectedTerm] = useState('ALL');

    const students = data.students || [];
    const payments = data.payments || [];
    const settings = data.settings || {};

    const feeColumns = [
        { key: 'admission', label: 'Admission' },
        { key: 'diary', label: 'Diary' },
        { key: 'development', label: 'Development' },
        { key: 't1', label: 'Term 1 Tuition' },
        { key: 't2', label: 'Term 2 Tuition' },
        { key: 't3', label: 'Term 3 Tuition' },
        { key: 'boarding', label: 'Boarding' },
        { key: 'breakfast', label: 'Breakfast' },
        { key: 'lunch', label: 'Lunch' },
        { key: 'trip', label: 'Educational Trip' },
        { key: 'bookFund', label: 'Book Fund' },
        { key: 'caution', label: 'Caution Money' },
        { key: 'uniform', label: 'School Uniform' },
        { key: 'studentCard', label: 'Student ID Card' },
        { key: 'remedial', label: 'Remedial Classes' },
        { key: 'assessmentFee', label: 'Assessment Fee' },
        { key: 'projectFee', label: 'Project Fee' },
        { key: 'activityFees', label: 'Activity Fees' },
        { key: 'tieAndBadge', label: 'Tie & Badge' },
        { key: 'academicSupport', label: 'Academic Support' },
        { key: 'pta', label: 'PTA Levy' }
    ];

    const calculateArrears = (student) => {
        const feeStructure = settings.feeStructures?.find(f => f.grade === student.grade);
        if (!feeStructure) return { items: [], totalDue: 0, totalPaid: 0, balance: 0, currentYearPaid: 0 };

        let selectedKeys = student.selectedFees;
        if (typeof selectedKeys === 'string') {
            selectedKeys = selectedKeys.split(',').map(f => f.trim()).filter(f => f);
        } else if (!Array.isArray(selectedKeys)) {
            selectedKeys = ['t1', 't2', 't3'];
        }
        
        const itemized = feeColumns
            .filter(col => selectedKeys.includes(col.key))
            .map(col => {
                const due = Number(feeStructure[col.key]) || 0;
                const paid = payments
                    .filter(p => String(p.studentId) === String(student.id))
                    .reduce((sum, p) => sum + (Number(p.items?.[col.key]) || 0), 0);
                
                return { label: col.label, due, paid, balance: due - paid, key: col.key };
            })
            .filter(item => item.due > 0 || item.paid > 0);

        const currentYearPaid = payments
            .filter(p => String(p.studentId) === String(student.id))
            .reduce((sum, p) => sum + Number(p.amount), 0);

        if (Number(student.previousArrears) > 0) {
            itemized.unshift({ 
                label: 'Balance Brought Forward', 
                due: Number(student.previousArrears), 
                paid: 0, 
                balance: Number(student.previousArrears),
                key: 'prev'
            });
        }

        const totalDue = itemized.reduce((sum, i) => sum + i.due, 0);
        const totalPaid = currentYearPaid;
        
        return {
            items: itemized,
            totalDue,
            totalPaid,
            balance: totalDue - totalPaid,
            currentYearPaid
        };
    };

    const filteredStudents = students.filter(s => {
        const matchGrade = filterGrade === 'ALL' || s.grade === filterGrade;
        const matchStudent = selectedStudentId === 'ALL' || s.id === selectedStudentId;
        const finance = calculateArrears(s);
        const hasArrears = finance.balance > 0;
        
        return matchGrade && matchStudent && hasArrears;
    });

    return html`
        <div class="space-y-6 fee-reminder-container">
            <!-- Header Section -->
            <div class="bg-gradient-to-r from-[#7FFFD4] via-[#7FFFD4] to-[#7FFFD4] rounded-2xl p-6 text-slate-800 shadow-lg border border-[#5FD3B3] no-print">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-white/40 rounded-xl flex items-center justify-center backdrop-blur">
                            <span class="text-2xl">📋</span>
                        </div>
                        <div>
                            <h2 class="text-2xl font-black tracking-tight text-slate-800">Fee Balance Notices</h2>
                            <p class="text-slate-600 text-sm">Generate professional reminder letters for parents</p>
                        </div>
                    </div>
                    <div class="flex gap-3 items-center">
                        <div class="bg-white/40 backdrop-blur px-4 py-2 rounded-xl border border-[#5FD3B3]">
                            <p class="text-xs text-slate-600 uppercase">Students with Arrears</p>
                            <p class="text-xl font-black text-slate-800">${filteredStudents.length}</p>
                        </div>
                        <button onClick=${() => window.print()} class="bg-slate-800 text-white hover:bg-slate-700 px-6 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-colors">
                            <span>🖨️</span> Print All
                        </button>
                    </div>
                </div>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 no-print">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Academic Term</label>
                        <select 
                            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value=${selectedTerm}
                            onChange=${e => setSelectedTerm(e.target.value)}
                        >
                            <option value="ALL">Full Academic Year</option>
                            <option value="T1">Term 1 Only</option>
                            <option value="T2">Term 2 Only</option>
                            <option value="T3">Term 3 Only</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Grade/Class</label>
                        <select 
                            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value=${filterGrade}
                            onChange=${e => { setFilterGrade(e.target.value); setSelectedStudentId('ALL'); }}
                        >
                            <option value="ALL">All Grades</option>
                            ${settings.grades?.map(g => html`<option value=${g}>${g}</option>`)}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Student</label>
                        <select 
                            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value=${selectedStudentId}
                            onChange=${e => setSelectedStudentId(e.target.value)}
                        >
                            <option value="ALL">All Students with Arrears</option>
                            ${students.filter(s => filterGrade === 'ALL' || s.grade === filterGrade).map(s => html`
                                <option value=${s.id}>${s.name} — ${s.admissionNo}</option>
                            `)}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Print Styles -->
            <style>
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }

                    .no-print {
                        display: none !important;
                    }

                    /* Container */
                    .fee-reminder-container {
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Full-page reminder cards */
                    .reminder-card {
                        display: flex !important;
                        flex-direction: column;
                        width: 100% !important;
                        min-height: 277mm !important; /* A4 height (297) - 20mm total margin */
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        page-break-after: always;
                        page-break-inside: avoid;
                        box-sizing: border-box;
                        background: white !important;
                        box-shadow: none !important;
                    }

                    .reminder-card:last-child {
                        page-break-after: avoid;
                    }

                    /* Reset rounding and shadows for cleaner print */
                    .reminder-card, 
                    .reminder-card div {
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }

                    /* Text sizes */
                    .reminder-card h1 { font-size: 18pt !important; }
                    .reminder-card h2 { font-size: 13pt !important; }
                    .reminder-card p { font-size: 11pt !important; }
                    .reminder-card table { font-size: 10pt !important; }

                    /* Force colors to show */
                    .print-header-bg {
                        background-color: #f1f5f9 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color: #000 !important;
                    }

                    .bg-blue-50 {
                        background-color: #eff6ff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    .bg-red-50 {
                        background-color: #fef2f2 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .bg-slate-800 {
                        background-color: #1e293b !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color: white !important;
                    }

                    .text-red-600 {
                        color: #dc2626 !important;
                        -webkit-print-color-adjust: exact !important;
                    }

                    .text-green-600 {
                        color: #16a34a !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                }
            </style>

            <!-- Fee Reminder Cards -->
            <div class="space-y-6">
                ${filteredStudents.length === 0 && html`
                    <div class="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                        <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-4xl">✓</span>
                        </div>
                        <h3 class="text-xl font-bold text-slate-700 mb-2">All Fees Clear!</h3>
                        <p class="text-slate-400">No students with outstanding balances in the selected filters.</p>
                    </div>
                `}
                
                ${filteredStudents.map((student, idx) => {
                    const finance = calculateArrears(student);
                    const dueItems = finance.items.filter(item => {
                        if (selectedTerm === 'ALL') return true;
                        const termKey = selectedTerm.toLowerCase();
                        return item.key === 'prev' || !['t1', 't2', 't3'].includes(item.key) || item.key === termKey;
                    });
                    
                    return html`
                        <div class="reminder-card bg-white rounded-2xl shadow-sm overflow-hidden">
                            <!-- Professional Header -->
                            <div class="print-header-bg bg-slate-50 text-slate-800 p-6 border-b border-slate-200">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-4">
                                        ${settings.schoolLogo && html`
                                            <img src="${settings.schoolLogo}" class="w-16 h-16 rounded-lg object-contain bg-white p-1" />
                                        `}
                                        <div>
                                            <h1 class="text-xl font-black uppercase tracking-wider text-slate-800">${settings.schoolName || 'SCHOOL NAME'}</h1>
                                            <p class="text-xs text-slate-600 font-medium uppercase tracking-widest">${settings.schoolAddress || ''}</p>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="bg-white/40 backdrop-blur px-4 py-2 rounded-lg border border-slate-300 print:bg-white">
                                            <p class="text-xs text-slate-600 uppercase font-bold">Notice Date</p>
                                            <p class="font-bold text-slate-800">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Notice Title -->
                            <div class="bg-white border-b border-slate-200 py-3 px-6">
                                <h2 class="text-center font-black text-slate-800 uppercase tracking-widest text-sm">
                                    📨 Official Fee Balance Notice 
                                    ${selectedTerm !== 'ALL' ? `— ${selectedTerm}` : ''}
                                    <span class="mx-2 text-slate-300">|</span> 
                                    ${settings.academicYear || '2025/2026'}
                                </h2>
                            </div>

                            <!-- Student & Amount Details -->
                            <div class="p-6 flex-grow">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <!-- Student Info -->
                                    <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                        <div class="flex items-center gap-2 mb-3">
                                            <span class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">👤</span>
                                            <p class="text-xs font-bold text-blue-600 uppercase">Student Details</p>
                                        </div>
                                        <p class="text-lg font-black text-slate-800 mb-1">${student.name}</p>
                                        <div class="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <p class="text-xs text-slate-400">Grade</p>
                                                <p class="font-bold text-slate-700">${student.grade} ${student.stream || ''}</p>
                                            </div>
                                            <div>
                                                <p class="text-xs text-slate-400">Admission No.</p>
                                                <p class="font-bold text-slate-700 font-mono">${student.admissionNo}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Balance Summary -->
                                    <div class="bg-red-50 rounded-xl p-4 border border-red-100">
                                        <div class="flex items-center gap-2 mb-3">
                                            <span class="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold">💰</span>
                                            <p class="text-xs font-bold text-red-600 uppercase">Outstanding Balance</p>
                                        </div>
                                        <p class="text-3xl font-black text-red-600 mb-2">${settings.currency} ${finance.balance.toLocaleString()}</p>
                                        <div class="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <p class="text-xs text-slate-400">Total Due</p>
                                                <p class="font-bold text-slate-700">${settings.currency} ${finance.totalDue.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p class="text-xs text-slate-400">Amount Paid</p>
                                                <p class="font-bold text-green-600">${settings.currency} ${finance.totalPaid.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Fee Breakdown Table -->
                                <div class="border border-slate-200 rounded-xl overflow-hidden mb-6">
                                    <table class="w-full text-sm">
                                        <thead class="bg-slate-800 text-white">
                                            <tr>
                                                <th class="p-3 text-left font-bold text-xs uppercase">Fee Item</th>
                                                <th class="p-3 text-right font-bold text-xs uppercase">Amount Due</th>
                                                <th class="p-3 text-right font-bold text-xs uppercase">Amount Paid</th>
                                                <th class="p-3 text-right font-bold text-xs uppercase">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-100">
                                            ${dueItems.map(item => html`
                                                <tr class="${item.balance > 0 ? 'bg-red-50/30' : 'bg-white'}">
                                                    <td class="p-3 font-medium">${item.label}</td>
                                                    <td class="p-3 text-right font-mono">${item.due.toLocaleString()}</td>
                                                    <td class="p-3 text-right font-mono text-green-600">${item.paid.toLocaleString()}</td>
                                                    <td class="p-3 text-right font-bold font-mono ${item.balance > 0 ? 'text-red-600' : 'text-slate-400'}">
                                                        ${item.balance > 0 ? item.balance.toLocaleString() : '-'}
                                                    </td>
                                                </tr>
                                            `)}
                                        </tbody>
                                        <tfoot class="bg-slate-50 font-bold border-t border-slate-200">
                                            <tr>
                                                <td class="p-3 text-left uppercase text-xs">Total</td>
                                                <td class="p-3 text-right">${finance.totalDue.toLocaleString()}</td>
                                                <td class="p-3 text-right text-green-600">${finance.totalPaid.toLocaleString()}</td>
                                                <td class="p-3 text-right text-red-600 text-lg">${finance.balance.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <!-- Urgent Notice -->
                                <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 print:bg-white print:border-slate-300">
                                    <p class="text-sm text-amber-900 leading-relaxed">
                                        <strong class="font-bold">Dear Parent/Guardian,</strong><br />
                                        This is a friendly reminder that there is an outstanding balance of 
                                        <strong class="text-lg text-red-600 font-black">${settings.currency} ${finance.balance.toLocaleString()}</strong> 
                                        on your child's school fees account. Please arrange payment at your earliest convenience to avoid interruption of learning services.
                                    </p>
                                </div>

                                <!-- Payment Methods -->
                                ${(settings.bankName || settings.mpesaPaybill || settings.airtelPaybill) && html`
                                    <div class="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200 print:bg-white print:border-slate-300">
                                        <p class="text-xs font-bold text-slate-500 uppercase mb-3">💳 Official Payment Channels</p>
                                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            ${settings.bankName && html`
                                                <div class="bg-white rounded-lg p-3 border border-slate-200">
                                                    <p class="font-bold text-slate-700 text-sm">🏦 Bank Info</p>
                                                    <p class="text-xs text-slate-600 font-bold mt-1">${settings.bankName}</p>
                                                    <p class="text-[10px] text-slate-500">A/C: ${settings.bankAccount || 'N/A'}</p>
                                                </div>
                                            `}
                                            ${settings.mpesaPaybill && html`
                                                <div class="bg-white rounded-lg p-3 border border-slate-200">
                                                    <p class="font-bold text-slate-700 text-sm">📱 M-Pesa</p>
                                                    <p class="text-xs text-slate-600 font-bold mt-1">Paybill: ${settings.mpesaPaybill}</p>
                                                    <p class="text-[10px] text-slate-500">A/C: ${settings.mpesaAccountName || 'School Fees'}</p>
                                                </div>
                                            `}
                                            ${settings.airtelPaybill && html`
                                                <div class="bg-white rounded-lg p-3 border border-slate-200">
                                                    <p class="font-bold text-slate-700 text-sm">📱 Airtel</p>
                                                    <p class="text-xs text-slate-600 font-bold mt-1">Paybill: ${settings.airtelPaybill}</p>
                                                    <p class="text-[10px] text-slate-500">A/C: ${settings.airtelAccountName || 'School Fees'}</p>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                `}
                            </div>

                            <!-- Signatures -->
                            <div class="p-6 border-t border-slate-200 bg-slate-50 print:bg-white text-slate-800">
                                <div class="flex justify-between items-end">
                                    <div class="text-center">
                                        <div class="h-16 flex items-end justify-center mb-2">
                                            ${settings.clerkSignature && html`<img src="${settings.clerkSignature}" class="h-14 object-contain" />`}
                                        </div>
                                        <div class="w-40 h-0.5 bg-slate-900 mb-1"></div>
                                        <p class="text-[10px] font-bold uppercase text-slate-800">Authorized Signatory</p>
                                        <p class="text-[9px] text-slate-500">Accounts Department</p>
                                    </div>
                                    <div class="text-center">
                                        <div class="w-16 h-16 opacity-30 flex items-center justify-center mb-2">
                                            ${settings.schoolLogo && html`<img src="${settings.schoolLogo}" class="w-full h-full object-contain filter grayscale" />`}
                                        </div>
                                        <div class="w-32 h-0.5 bg-slate-900 mb-1"></div>
                                        <p class="text-[10px] font-bold uppercase text-slate-800">School Stamp</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                })}
            </div>
        </div>
    `;
};

