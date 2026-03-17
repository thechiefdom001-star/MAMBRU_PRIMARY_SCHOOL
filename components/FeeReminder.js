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
        { key: 't1', label: 'T1 Tuition' },
        { key: 't2', label: 'T2 Tuition' },
        { key: 't3', label: 'T3 Tuition' },
        { key: 'boarding', label: 'Boarding' },
        { key: 'breakfast', label: 'Breakfast' },
        { key: 'lunch', label: 'Lunch' },
        { key: 'trip', label: 'Trip' },
        { key: 'bookFund', label: 'Book Fund' },
        { key: 'caution', label: 'Caution' },
        { key: 'uniform', label: 'Uniform' },
        { key: 'studentCard', label: 'School ID' },
        { key: 'remedial', label: 'Remedials' },
        { key: 'assessmentFee', label: 'Assessment Fee' },
        { key: 'projectFee', label: 'Project Fee' },
        { key: 'activityFees', label: 'Activity Fees' },
        { key: 'tieAndBadge', label: 'Tie & Badge' },
        { key: 'academicSupport', label: 'Academic Support' },
        { key: 'pta', label: 'PTA' }
    ];

    const calculateArrears = (student) => {
        const feeStructure = settings.feeStructures?.find(f => f.grade === student.grade);
        if (!feeStructure) return { items: [], totalDue: 0, totalPaid: 0, balance: 0, currentYearPaid: 0 };

        // Normalize selectedFees in case it's a string from Google Sheets
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
                    .filter(p => p.studentId === student.id)
                    .reduce((sum, p) => sum + (Number(p.items?.[col.key]) || 0), 0);
                
                return { label: col.label, due, paid, balance: due - paid, key: col.key };
            })
            .filter(item => item.due > 0 || item.paid > 0);

        const currentYearPaid = payments
            .filter(p => p.studentId === student.id)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        if (Number(student.previousArrears) > 0) {
            itemized.unshift({ 
                label: 'Arrears Brought Forward', 
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
        
        // Filter: Those with arrears (balance > 0) 
        // especially focused on those who haven't cleared current term/year
        const hasArrears = finance.balance > 0;
        
        return matchGrade && matchStudent && hasArrears;
    });

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Fee Reminders</h2>
                    <p class="text-slate-500">Generate and print fee balance notices for parents</p>
                </div>
                <button onClick=${() => window.print()} class="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-200">
                    Print All Reminders
                </button>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Term Filter</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                        value=${selectedTerm}
                        onChange=${e => setSelectedTerm(e.target.value)}
                    >
                        <option value="ALL">Whole Year</option>
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Grade</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                        value=${filterGrade}
                        onChange=${e => { setFilterGrade(e.target.value); setSelectedStudentId('ALL'); }}
                    >
                        <option value="ALL">All Grades</option>
                        ${settings.grades?.map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Specific Student</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                        value=${selectedStudentId}
                        onChange=${e => setSelectedStudentId(e.target.value)}
                    >
                        <option value="ALL">All Students with Arrears</option>
                        ${students.filter(s => filterGrade === 'ALL' || s.grade === filterGrade).map(s => html`
                            <option value=${s.id}>${s.name} (${s.admissionNo})</option>
                        `)}
                    </select>
                </div>
            </div>

            <div class="space-y-8 print:space-y-0 print:grid print:grid-cols-1">
                <style>
                    @media print {
                        .reminder-card {
                            min-height: 14.5cm;
                            width: 100% !important;
                            padding: 1.5cm !important;
                            border-bottom: 2px dashed #ccc !important;
                            page-break-inside: avoid;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-start;
                            box-sizing: border-box;
                        }
                        .reminder-card:nth-child(2n) {
                            border-bottom: none !important;
                            page-break-after: always;
                        }
                        .reminder-card * {
                            font-size: 11pt !important;
                        }
                        .reminder-card h1 { font-size: 18pt !important; }
                        .reminder-card .text-xl { font-size: 14pt !important; }
                        .reminder-card .text-xs { font-size: 9pt !important; }
                        .reminder-card .text-[10px] { font-size: 8pt !important; }
                        .reminder-card .text-[9px] { font-size: 7pt !important; }
                        /* Force dark header background to print */
                        .fee-reminder-thead {
                            background-color: #1e293b !important;
                            color: #ffffff !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .fee-reminder-thead th {
                            color: #ffffff !important;
                        }
                        /* Stamp visibility */
                        .reminder-stamp {
                            opacity: 0.5 !important;
                        }
                    }
                </style>
                ${filteredStudents.map(student => {
                    const finance = calculateArrears(student);
                    return html`
                        <div class="bg-white p-3 sm:p-8 rounded-2xl border border-slate-100 shadow-sm print:shadow-none print:border-0 print:p-0 print:mb-0 page-break reminder-card overflow-hidden">
                            <!-- Header -->
                            <div class="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-2 sm:gap-4 border-b-2 border-slate-900 pb-4 mb-4 w-full">
                                <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                                    <img src="${settings.schoolLogo}" class="w-12 h-12 sm:w-20 sm:h-20 object-contain" />
                                    <div>
                                        <h1 class="text-base sm:text-2xl font-black uppercase text-slate-900 leading-tight">${settings.schoolName}</h1>
                                        <p class="text-[8px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-widest">Excellence in Education</p>
                                    </div>
                                </div>
                                <div class="text-center sm:text-right hidden sm:block">
                                    <h1 class="text-base sm:text-lg font-black uppercase text-slate-700">Fee Statement</h1>
                                    <p class="text-[9px] sm:text-[10px] font-bold text-slate-500 leading-tight max-w-[250px] sm:ml-auto">${settings.schoolAddress}</p>
                                </div>
                            </div>
                            <div class="flex justify-center mb-4 sm:mb-6 w-full">
                                <div class="w-full text-center" style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                    <div style="border-top: 2px solid #0f172a; margin-bottom: 4px;"></div>
                                    <p class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-900 py-1"
                                       style="color:#0f172a; letter-spacing:0.12em;">
                                        Official Fee Balance Notice${selectedTerm !== 'ALL' ? ` — ${selectedTerm}` : ''} &nbsp;•&nbsp; ${settings.academicYear}
                                    </p>
                                    <div style="border-top: 2px solid #0f172a; margin-top: 4px;"></div>
                                </div>
                            </div>

                            <!-- Student Info -->
                            <div class="grid grid-cols-2 gap-4 sm:gap-8 mb-4">
                                <div class="space-y-0.5 sm:space-y-1">
                                    <p class="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase">Parent/Guardian of:</p>
                                    <p class="text-sm sm:text-xl font-black text-blue-800">${student.name}</p>
                                    <p class="text-[10px] sm:text-xs font-bold text-slate-600">${student.grade} - ${student.stream || 'No Stream'}</p>
                                    <p class="text-[10px] sm:text-xs font-mono text-slate-500">Adm No: ${student.admissionNo}</p>
                                </div>
                                <div class="text-right space-y-0.5 sm:space-y-1">
                                    <p class="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase">Date of Notice</p>
                                    <p class="text-[10px] sm:text-sm font-bold">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>

                            <p class="text-[10px] sm:text-sm text-slate-700 mb-4 sm:mb-6 leading-tight">
                                Dear Parent, this is to kindly remind you of the outstanding school fee balance. 
                                Below is a detailed account status breakdown:
                            </p>

                            <!-- Breakdown Table -->
                            <div class="border border-slate-900 rounded-lg overflow-x-auto no-scrollbar mb-4 sm:mb-6 w-full max-w-full">
                                <table class="w-full text-xs sm:text-sm">
                                    <thead class="bg-slate-900 text-white fee-reminder-thead" style="print-color-adjust:exact; -webkit-print-color-adjust:exact; background-color:#1e293b; color:#fff;">
                                        <tr>
                                            <th class="p-1.5 sm:p-3 text-left uppercase text-[7px] sm:text-[10px] font-black" style="color:#fff;">Description</th>
                                            <th class="p-1.5 sm:p-3 text-right uppercase text-[7px] sm:text-[10px] font-black" style="color:#fff;">Due</th>
                                            <th class="p-1.5 sm:p-3 text-right uppercase text-[7px] sm:text-[10px] font-black" style="color:#fff;">Paid</th>
                                            <th class="p-1.5 sm:p-3 text-right uppercase text-[7px] sm:text-[10px] font-black" style="color:#fff;">Bal</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-200">
                                        ${finance.items
                                            .filter(item => {
                                                if (selectedTerm === 'ALL') return true;
                                                const termKey = selectedTerm.toLowerCase();
                                                return item.key === 'prev' || !['t1', 't2', 't3'].includes(item.key) || item.key === termKey;
                                            })
                                            .map(item => html`
                                            <tr>
                                                <td class="p-1.5 sm:p-2 font-bold text-[9px] sm:text-xs">${item.label}</td>
                                                <td class="p-1.5 sm:p-2 text-right font-mono text-[9px] sm:text-xs">${item.due.toLocaleString()}</td>
                                                <td class="p-1.5 sm:p-2 text-right font-mono text-green-600 text-[9px] sm:text-xs">${item.paid.toLocaleString()}</td>
                                                <td class="p-1.5 sm:p-2 text-right font-black text-[9px] sm:text-xs ${item.balance > 0 ? 'text-red-600' : 'text-slate-400'}">
                                                    ${item.balance.toLocaleString()}
                                                </td>
                                            </tr>
                                        `)}
                                    </tbody>
                                    <tfoot class="bg-slate-50 border-t border-slate-900">
                                        <tr>
                                            <td class="p-1.5 sm:p-4 font-black uppercase text-[7px] sm:text-[10px]">TOTAL ARREARS</td>
                                            <td class="p-1.5 sm:p-4 text-right font-bold text-[8px] sm:text-xs">${finance.totalDue.toLocaleString()}</td>
                                            <td class="p-1.5 sm:p-4 text-right font-bold text-green-600 text-[8px] sm:text-xs">${finance.totalPaid.toLocaleString()}</td>
                                            <td class="p-1.5 sm:p-4 text-right font-black text-[10px] sm:text-xl text-red-600 whitespace-nowrap">
                                                ${settings.currency} ${finance.balance.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <!-- Footer/Sign-off -->
                            <div class="space-y-6 pt-4">
                                <p class="text-xs text-slate-600 italic">
                                    Please clear the outstanding balance of <b>${settings.currency} ${finance.balance.toLocaleString()}</b> as soon as possible to ensure 
                                    uninterrupted learning for the student. If payment has been made recently, kindly disregard this notice.
                                </p>

                                <!-- Payment Options -->
                                ${(settings.bankName || settings.mpesaPaybill || settings.airtelPaybill) && html`
                                    <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4">
                                        <p class="text-[9px] font-black uppercase text-slate-500 mb-2">Payment Options</p>
                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[9px]">
                                            ${settings.bankName && html`
                                                <div class="flex items-start gap-2">
                                                    <span class="text-green-600">🏦</span>
                                                    <div>
                                                        <p class="font-bold text-slate-700">${settings.bankName}</p>
                                                        <p class="text-slate-500">A/C No: ${settings.bankAccount || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            `}
                                            ${settings.mpesaPaybill && html`
                                                <div class="flex items-start gap-2">
                                                    <span class="text-green-600">📱</span>
                                                    <div>
                                                        <p class="font-bold text-slate-700">M-Pesa Paybill</p>
                                                        <p class="text-slate-500">${settings.mpesaPaybill} (A/C: ${settings.mpesaAccountName || 'School Fees'})</p>
                                                    </div>
                                                </div>
                                            `}
                                            ${settings.airtelPaybill && html`
                                                <div class="flex items-start gap-2">
                                                    <span class="text-red-600">📱</span>
                                                    <div>
                                                        <p class="font-bold text-slate-700">Airtel Money</p>
                                                        <p class="text-slate-500">${settings.airtelPaybill} (A/C: ${settings.airtelAccountName || 'School Fees'})</p>
                                                    </div>
                                                </div>
                                            `}
                                        </div>
                                    </div>
                                `}
                                
                                <div class="flex justify-between items-end pt-4 print:pt-2">
                                    <div class="text-center w-48">
                                        <div class="h-10 flex items-center justify-center mb-1">
                                            ${settings.clerkSignature && html`<img src="${settings.clerkSignature}" class="h-full object-contain" />`}
                                        </div>
                                        <div class="h-0.5 bg-slate-900 mb-1 w-full"></div>
                                        <p class="text-[9px] font-black uppercase text-slate-500">Accounts Dept</p>
                                    </div>
                                    <div class="text-center w-48 flex flex-col items-center">
                                        <div class="w-16 h-16 reminder-stamp" style="opacity:0.5;">
                                            <img src="${settings.schoolLogo}" class="w-full h-full object-contain" />
                                        </div>
                                        <p class="text-[9px] font-black uppercase text-slate-500">Official Stamp</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                })}

                ${filteredStudents.length === 0 && html`
                    <div class="bg-white p-20 rounded-2xl border border-dashed border-slate-200 text-center">
                        <span class="text-5xl mb-4 block">✅</span>
                        <h3 class="text-lg font-bold text-slate-700">No Arrears Found</h3>
                        <p class="text-slate-400">All students in the selected filter have cleared their fees.</p>
                    </div>
                `}
            </div>
        </div>
    `;
};