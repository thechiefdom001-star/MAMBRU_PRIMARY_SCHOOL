import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';

const html = htm.bind(h);

export const Payroll = ({ data, setData }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [activePayslip, setActivePayslip] = useState(null);
    const [editingStaff, setEditingStaff] = useState(null);

    const allStaff = useMemo(() => [
        ...(data.teachers || []).map(t => ({ ...t, type: 'Teaching' })),
        ...(data.staff || []).map(s => ({ ...s, type: 'Support' }))
    ], [data.teachers, data.staff]);

    const payroll = data.payroll || [];

    const handleSaveEntry = (staffId, values) => {
        const others = payroll.filter(p => !(p.staffId === staffId && p.month === selectedMonth));
        
        const calcs = Storage.calculateKenyanPayroll(
            values.basic, 
            { 
                overtime: values.overtime, 
                houseAllowance: values.houseAllowance,
                bonus: values.bonus,
                otherAllowance: values.otherAllowance
            },
            { 
                sacco: values.sacco, 
                advance: values.advance, 
                loan: values.loan,
                welfare: values.welfare,
                otherDeduction: values.otherDeduction
            }
        );
        
        const entry = {
            staffId,
            month: selectedMonth,
            academicYear: data.settings.academicYear,
            ...calcs,
            updatedAt: new Date().toISOString()
        };

        setData({ ...data, payroll: [...others, entry] });
        setEditingStaff(null);
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Payroll Management</h2>
                    <p class="text-slate-500">Kenyan Statutory Deductions (PAYE, SHIF, NSSF, AHL)</p>
                </div>
                <div class="flex gap-2">
                    <input 
                        type="month" 
                        class="p-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold"
                        value=${selectedMonth}
                        onChange=${e => setSelectedMonth(e.target.value)}
                    />
                    <button onClick=${() => window.print()} class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium">Batch Print</button>
                </div>
            </div>

            <div class=${`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar ${activePayslip ? 'no-print' : ''}`}>
                <table class="w-full text-left text-xs md:text-sm min-w-[900px]">
                    <thead class="bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                            <th class="px-4 py-4">Employee</th>
                            <th class="px-4 py-4 text-right">Gross Pay</th>
                            <th class="px-4 py-4 text-right">PAYE</th>
                            <th class="px-4 py-4 text-right">NSSF</th>
                            <th class="px-4 py-4 text-right">SHIF</th>
                            <th class="px-4 py-4 text-right">AHL</th>
                            <th class="px-4 py-4 text-right">Net Pay</th>
                            <th class="px-4 py-4 text-center no-print">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${allStaff.map(staff => {
                            const entry = payroll.find(p => p.staffId === staff.id && p.month === selectedMonth);
                            const totalStatutory = (entry?.nssf || 0) + (entry?.shif || 0) + (entry?.ahl || 0);
                            
                            return html`
                                <tr key=${staff.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                    <td class="px-4 py-4">
                                        <div class="font-bold">${staff.name}</div>
                                        <div class="text-[10px] text-slate-400 uppercase">${staff.role || staff.subjects || 'Staff'}</div>
                                    </td>
                                    <td class="px-4 py-4 text-right">
                                        <div class="font-bold text-slate-700">${entry?.gross?.toLocaleString() || '-'}</div>
                                        ${entry && html`<div class="text-[8px] text-slate-400">Basic: ${entry.basic?.toLocaleString()}</div>`}
                                    </td>
                                    <td class="px-4 py-4 text-right text-red-500 font-medium">${entry?.paye?.toLocaleString() || '-'}</td>
                                    <td class="px-4 py-4 text-right text-red-400 text-xs">${entry?.nssf?.toLocaleString() || '-'}</td>
                                    <td class="px-4 py-4 text-right text-red-400 text-xs">${Math.round(entry?.shif || 0).toLocaleString() || '-'}</td>
                                    <td class="px-4 py-4 text-right text-red-400 text-xs">${Math.round(entry?.ahl || 0).toLocaleString() || '-'}</td>
                                    <td class="px-4 py-4 text-right font-black text-green-600">${entry?.netPay?.toLocaleString() || '-'}</td>
                                    <td class="px-4 py-4 text-center no-print">
                                        <div class="flex justify-center gap-2">
                                            <button 
                                                onClick=${() => setEditingStaff({ staff, entry })}
                                                class="text-[10px] font-bold uppercase bg-slate-50 text-slate-600 px-3 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                disabled=${!entry}
                                                onClick=${() => setActivePayslip({ staff, entry })}
                                                class="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-30"
                                            >
                                                Payslip
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        })}
                    </tbody>
                </table>
            </div>

            <!-- Entry Editor Modal -->
            ${editingStaff && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center p-4 no-print overflow-y-auto pt-10">
                    <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in-95 mb-10">
                        <div class="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
                            <h3 class="font-black text-lg">Edit Payroll Entry</h3>
                            <button onClick=${() => setEditingStaff(null)} class="text-slate-400 p-2">✕</button>
                        </div>
                        <form class="p-6 space-y-6" onSubmit=${(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            handleSaveEntry(editingStaff.staff.id, {
                                basic: formData.get('basic'),
                                overtime: formData.get('overtime'),
                                houseAllowance: formData.get('houseAllowance'),
                                bonus: formData.get('bonus'),
                                otherAllowance: formData.get('otherAllowance'),
                                sacco: formData.get('sacco'),
                                advance: formData.get('advance'),
                                loan: formData.get('loan'),
                                welfare: formData.get('welfare'),
                                otherDeduction: formData.get('otherDeduction')
                            });
                        }}>
                            <div class="space-y-4">
                                <h4 class="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-1">Primary Earnings</h4>
                                <div class="grid grid-cols-1 gap-4">
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Basic Salary</label>
                                        <input name="basic" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none border focus:ring-1 focus:ring-primary" defaultValue=${editingStaff.entry?.basic || ''} required />
                                    </div>
                                </div>

                                <h4 class="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-1 pt-2">Additional Earnings</h4>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Overtime</label>
                                        <input name="overtime" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraEarnings?.overtime || ''} />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">House Allowance</label>
                                        <input name="houseAllowance" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraEarnings?.houseAllowance || ''} />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Bonus</label>
                                        <input name="bonus" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraEarnings?.bonus || ''} />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Other Allowances</label>
                                        <input name="otherAllowance" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraEarnings?.otherAllowance || ''} />
                                    </div>
                                </div>

                                <h4 class="text-[10px] font-black text-red-600 uppercase tracking-widest border-b pb-1 pt-2">Other Deductions</h4>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">SACCO Contribution</label>
                                        <input name="sacco" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraDeductions?.sacco || ''} />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Salary Advance</label>
                                        <input name="advance" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraDeductions?.advance || ''} />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Loan Recovery</label>
                                        <input name="loan" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraDeductions?.loan || ''} />
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Welfare/Union</label>
                                        <input name="welfare" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraDeductions?.welfare || ''} />
                                    </div>
                                    <div class="space-y-1 col-span-2">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Misc. Deductions</label>
                                        <input name="otherDeduction" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" defaultValue=${editingStaff.entry?.extraDeductions?.otherDeduction || ''} />
                                    </div>
                                </div>
                            </div>
                            <button type="submit" class="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-blue-200 mt-4">Save Entry</button>
                        </form>
                    </div>
                </div>
            `}

            <!-- Payslip Modal -->
            ${activePayslip && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center p-4 no-print overflow-y-auto pt-4 md:pt-10">
                    <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl animate-in zoom-in-95 mb-10 print:shadow-none print:m-0 print:w-full print:max-w-none">
                        <div class="p-8 space-y-8 print:p-0" id="printable-payslip">
                            <div class="flex justify-between items-start border-b pb-6">
                                <div class="flex items-center gap-4">
                                    <img src="${data.settings.schoolLogo}" class="w-16 h-16 object-contain" />
                                    <div>
                                        <h2 class="text-xl font-black uppercase">${data.settings.schoolName}</h2>
                                        <p class="text-xs text-slate-400">${data.settings.schoolAddress}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase mb-2 inline-block">Official Payslip</div>
                                    <p class="text-sm font-bold text-slate-700">Month: ${months[new Date(activePayslip.entry.month).getMonth()]} ${new Date(activePayslip.entry.month).getFullYear()}</p>
                                    <p class="text-xs text-slate-500">Academic Year: ${data.settings.academicYear}</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm print:gap-2">
                                <div class="space-y-1">
                                    <p class="text-[9px] text-slate-400 font-bold uppercase">Employee Information</p>
                                    <div class="flex flex-wrap gap-x-4 gap-y-1 items-center">
                                        <p class="font-black text-base mr-2">${activePayslip.staff.name}</p>
                                        <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold uppercase">${activePayslip.staff.role || 'Teacher'}</span>
                                    </div>
                                    <div class="mt-2 grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-x-4 gap-y-1 text-[8px] uppercase font-bold text-slate-400">
                                        <div class="border-b border-slate-100 pb-0.5">Emp #: <span class="text-slate-900">${activePayslip.staff.employeeNo || '-'}</span></div>
                                        <div class="border-b border-slate-100 pb-0.5">KRA PIN: <span class="text-slate-900">${activePayslip.staff.taxNo || '-'}</span></div>
                                        <div class="border-b border-slate-100 pb-0.5">NSSF: <span class="text-slate-900">${activePayslip.staff.nssfNo || '-'}</span></div>
                                        <div class="border-b border-slate-100 pb-0.5">SHIF: <span class="text-slate-900">${activePayslip.staff.shifNo || '-'}</span></div>
                                    </div>
                                </div>
                                <div class="flex justify-between md:justify-end items-end gap-6 text-right">
                                    <div>
                                        <p class="text-[9px] text-slate-400 font-bold uppercase">Payment Date</p>
                                        <p class="font-bold text-xs">${new Date().toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p class="text-[9px] text-slate-400 font-bold uppercase">Currency</p>
                                        <p class="font-bold text-xs">${data.settings.currency}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="border rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-x border-slate-200">
                                <!-- Earnings Column -->
                                <div class="flex flex-col">
                                    <div class="bg-slate-50 font-bold text-[10px] uppercase p-3 border-b flex justify-between">
                                        <span>Earnings</span>
                                        <span class="text-right">(${data.settings.currency})</span>
                                    </div>
                                    <div class="p-3 space-y-1.5 text-xs flex-1">
                                        <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                            <span>Basic Salary</span>
                                            <span class="font-bold">${activePayslip.entry.basic.toLocaleString()}</span>
                                        </div>
                                        ${Object.entries(activePayslip.entry.extraEarnings || {}).map(([key, val]) => (val > 0) && html`
                                            <div class="flex justify-between text-slate-500 border-b border-dashed border-slate-100 pb-1">
                                                <span class="capitalize">${key.replace(/([A-Z])/g, ' $1')}</span>
                                                <span class="font-medium">${Number(val).toLocaleString()}</span>
                                            </div>
                                        `)}
                                    </div>
                                    <div class="p-3 bg-blue-50/30 border-t flex justify-between font-bold text-blue-900 text-xs uppercase">
                                        <span>Gross Earnings</span>
                                        <span>${activePayslip.entry.gross.toLocaleString()}</span>
                                    </div>
                                </div>
                                
                                <!-- Deductions Column -->
                                <div class="flex flex-col">
                                    <div class="bg-slate-50 font-bold text-[10px] uppercase p-3 border-b flex justify-between">
                                        <span>Deductions</span>
                                        <span class="text-right">(${data.settings.currency})</span>
                                    </div>
                                    <div class="p-3 space-y-1.5 text-xs flex-1">
                                        <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                            <span class="text-slate-500">PAYE (Tax)</span>
                                            <span class="font-bold text-red-500">-${activePayslip.entry.paye.toLocaleString()}</span>
                                        </div>
                                        <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                            <span class="text-slate-500">NSSF</span>
                                            <span class="font-bold text-red-500">-${activePayslip.entry.nssf.toLocaleString()}</span>
                                        </div>
                                        <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                            <span class="text-slate-500">SHIF</span>
                                            <span class="font-bold text-red-500">-${activePayslip.entry.shif.toLocaleString()}</span>
                                        </div>
                                        <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                            <span class="text-slate-500">Housing Levy</span>
                                            <span class="font-bold text-red-500">-${activePayslip.entry.ahl.toLocaleString()}</span>
                                        </div>
                                        ${Object.entries(activePayslip.entry.extraDeductions || {}).map(([key, val]) => (val > 0) && html`
                                            <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                                <span class="text-slate-500 capitalize">${key}</span>
                                                <span class="font-bold text-red-500">-${Number(val).toLocaleString()}</span>
                                            </div>
                                        `)}
                                    </div>
                                    <div class="p-3 bg-red-50/30 border-t flex justify-between font-bold text-red-900 text-xs uppercase">
                                        <span>Total Deductions</span>
                                        <span>-${activePayslip.entry.totalDeductions.toLocaleString()}</span>
                                    </div>
                                </div>

                                <!-- Net Pay Row -->
                                <div class="col-span-full p-3 bg-blue-600 flex flex-col print:bg-slate-100 border-t border-slate-200">
                                    <div class="flex justify-between items-center">
                                        <span class="font-black text-white uppercase text-[10px] print:text-slate-900 tracking-widest">Net Pay (Take Home)</span>
                                        <span class="text-xl font-black text-white print:text-slate-900">${data.settings.currency} ${activePayslip.entry.netPay.toLocaleString()}</span>
                                    </div>
                                    <div class="mt-1 border-t border-white/20 pt-1 print:border-slate-900/10">
                                        <p class="text-[8px] font-bold text-blue-100 print:text-slate-500 uppercase">Amount in Words:</p>
                                        <p class="text-[10px] font-medium text-white print:text-slate-900 italic">${Storage.numberToWords(activePayslip.entry.netPay)}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="flex justify-between items-end pt-8 h-20">
                                <div class="text-center w-40 border-t border-slate-200 print:border-black pt-2">
                                    <p class="text-[8px] font-bold uppercase text-slate-400 print:text-black">Employee Signature</p>
                                </div>
                                <div class="text-center w-40 pt-2">
                                    <div class="h-12 flex items-center justify-center mb-1">
                                        ${data.settings.principalSignature && html`<img src="${data.settings.principalSignature}" class="h-full object-contain" />`}
                                    </div>
                                    <div class="border-t border-slate-200 print:border-black w-full"></div>
                                    <p class="text-[8px] font-bold uppercase text-slate-400 print:text-black">Director / Principal</p>
                                </div>
                            </div>
                        </div>
                        <div class="bg-slate-900 p-4 flex gap-3 no-print">
                            <button onClick=${() => setActivePayslip(null)} class="flex-1 py-3 text-white font-bold hover:bg-slate-800 rounded-xl">Close</button>
                            <button onClick=${() => window.print()} class="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-900">Print Payslip</button>
                        </div>
                    </div>
                </div>
            `}
            
            <style>
                @media print {
                    .no-print { display: none !important; }
                    #printable-payslip { 
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    /* Ensure modal container doesn't restrict print height */
                    .fixed { position: static !important; display: block !important; }
                    .backdrop-blur-sm { backdrop-filter: none !important; background: none !important; }
                    .bg-black\/60 { background: none !important; }
                    .overflow-y-auto { overflow: visible !important; }
                    main { overflow: visible !important; }
                }
            </style>
        </div>
    `;
};