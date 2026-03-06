import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { paymentService } from '../lib/paymentService.js';

const html = htm.bind(h);

export const Fees = ({ data, setData }) => {
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [filterGrade, setFilterGrade] = useState('ALL');
    const [filterStream, setFilterStream] = useState('ALL');
    const [paymentItems, setPaymentItems] = useState({});
    const [receipt, setReceipt] = useState(null);
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [promptStudent, setPromptStudent] = useState(null);
    const [promptAmount, setPromptAmount] = useState(0);
    const [promptPhone, setPromptPhone] = useState('');
    const [promptMethod, setPromptMethod] = useState('mpesa');
    const [promptStatus, setPromptStatus] = useState('');
    
    const streams = data?.settings?.streams || [];

    const defaultFeeColumns = [
        { key: 'previousArrears', label: 'Arrears B/F' },
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
    
    const customFeeColumns = (data.settings.customFeeColumns || []).map(cf => ({ key: cf.key, label: cf.label }));
    const feeColumns = [...defaultFeeColumns, ...customFeeColumns];

    const terms = ['T1', 'T2', 'T3'];

    const student = data.students.find(s => s.id === selectedStudentId);
    const feeStructure = student ? data.settings.feeStructures.find(f => f.grade === student.grade) : null;

    useEffect(() => {
        setPaymentItems({});
    }, [selectedStudentId]);

    const handleItemInput = (key, val) => {
        setPaymentItems({ ...paymentItems, [key]: Number(val) });
    };

    const handlePayment = (e) => {
        e.preventDefault();
        if (!student || !feeStructure) return;

        const totalAmount = Object.values(paymentItems).reduce((sum, v) => sum + (v || 0), 0);
        if (totalAmount <= 0) {
            alert("Please enter payment amount for at least one item.");
            return;
        }

        const newPayment = {
            id: 'PAY-' + Date.now(),
            studentId: selectedStudentId,
            gradeAtPayment: student.grade,
            amount: totalAmount,
            items: { ...paymentItems },
            term: selectedTerm,
            academicYear: data.settings.academicYear,
            date: new Date().toLocaleDateString(),
            receiptNo: 'RCP-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        };

        const financials = Storage.getStudentFinancials(student, data.payments, data.settings);
        const balanceAfter = financials.balance - totalAmount;

        const studentPayments = (data.payments || []).filter(p => p.studentId === selectedStudentId);
        const allPaymentsForStudent = [...studentPayments, newPayment];
        
        setData({ ...data, payments: [...(data.payments || []), newPayment] });
        setReceipt({ 
            ...newPayment, 
            studentName: student.name, 
            grade: student.grade, 
            balance: balanceAfter,
            structure: feeStructure,
            history: allPaymentsForStudent,
            term: selectedTerm
        });
        setPaymentItems({});
    };

    const openPromptModal = (student) => {
        const financials = Storage.getStudentFinancials(student, data.payments, data.settings);
        setPromptStudent(student);
        setPromptAmount(financials.balance);
        setPromptPhone(student.parentContact || '');
        setPromptMethod('mpesa');
        setPromptStatus('');
        setShowPromptModal(true);
    };

    const sendPaymentPrompt = async () => {
        if (!promptPhone) {
            alert('Please enter parent phone number');
            return;
        }
        
        const phone = promptPhone.replace(/[^0-9]/g, '');
        if (phone.length < 10) {
            alert('Please enter a valid phone number');
            return;
        }

        setPromptStatus('sending');

        // Initialize payment service with current settings
        paymentService.setSettings(data.settings);

        try {
            const result = await paymentService.sendPaymentPrompt(
                phone,
                promptAmount,
                promptStudent.name,
                promptMethod,
                promptStudent.admissionNo
            );

            const promptData = {
                id: 'PROMPT-' + Date.now(),
                studentId: promptStudent.id,
                studentName: promptStudent.name,
                admissionNo: promptStudent.admissionNo,
                phone: phone,
                amount: promptAmount,
                method: promptMethod,
                academicYear: data.settings.academicYear,
                date: new Date().toLocaleDateString(),
                status: result.success ? 'sent' : 'failed',
                transactionId: result.checkoutRequestId || result.transactionId || null,
                responseMessage: result.message || result.error
            };

            const existingPrompts = data.paymentPrompts || [];
            setData({ ...data, paymentPrompts: [...existingPrompts, promptData] });

            if (result.success) {
                setPromptStatus('sent');
                setTimeout(() => {
                    setShowPromptModal(false);
                    setPromptStatus('');
                }, 2000);
            } else {
                setPromptStatus('error');
                alert(result.error || 'Payment request failed');
            }
        } catch (error) {
            console.error('Payment Error:', error);
            setPromptStatus('error');
            alert('Failed to send payment request: ' + error.message);
        }
    };

    const viewReceipt = (p) => {
        const s = data.students.find(st => st.id === p.studentId);
        if (!s) return;
        
        const financials = Storage.getStudentFinancials(s, data.payments, data.settings);
        const fs = data.settings.feeStructures.find(f => f.grade === s.grade);
        
        const studentPayments = (data.payments || []).filter(pay => pay.studentId === s.id);
        const paymentIndex = studentPayments.findIndex(pay => pay.id === p.id);
        const historyUpToNow = studentPayments.slice(0, paymentIndex + 1);
        
        // Use cumulative balance logic
        const paidUntilNow = historyUpToNow.reduce((sum, pay) => sum + pay.amount, 0);
        const currentBalance = financials.totalDue - paidUntilNow;

        setReceipt({
            ...p,
            studentName: s.name,
            grade: s.grade,
            balance: currentBalance,
            structure: fs,
            history: historyUpToNow
        });
    };

    return html`
        <div class="space-y-6">
            <!-- Payment Prompt Modal -->
            ${showPromptModal && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-black">📱 Send Payment Prompt</h3>
                            <button onClick=${() => setShowPromptModal(false)} class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="bg-blue-50 p-4 rounded-xl">
                                <p class="text-sm font-bold text-blue-800">${promptStudent?.name}</p>
                                <p class="text-xs text-blue-600">${promptStudent?.grade} - Balance: ${data.settings.currency} ${promptAmount?.toLocaleString()}</p>
                            </div>

                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                                <div class="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick=${() => setPromptMethod('mpesa')}
                                        class=${`flex-1 py-3 rounded-xl font-bold text-sm border-2 ${promptMethod === 'mpesa' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        M-Pesa
                                    </button>
                                    <button 
                                        type="button"
                                        onClick=${() => setPromptMethod('airtel')}
                                        class=${`flex-1 py-3 rounded-xl font-bold text-sm border-2 ${promptMethod === 'airtel' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        Airtel
                                    </button>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase">Parent Phone Number</label>
                                <input 
                                    type="tel"
                                    placeholder="e.g. 254712345678"
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-green-500"
                                    value=${promptPhone}
                                    onInput=${(e) => setPromptPhone(e.target.value)}
                                />
                                <p class="text-[10px] text-slate-400">STK push will be sent to this number</p>
                            </div>

                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase">Amount to Pay</label>
                                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span class="text-xl font-black text-green-600">${data.settings.currency} ${promptAmount?.toLocaleString()}</span>
                                </div>
                            </div>

                            ${promptStatus === 'sending' && html`
                                <div class="bg-yellow-50 p-4 rounded-xl text-center">
                                    <p class="text-yellow-700 font-bold">${promptMethod === 'mpesa' ? '📡 Sending M-Pesa STK Push...' : '📡 Sending Airtel Request...'}</p>
                                </div>
                            `}

                            ${promptStatus === 'sent' && html`
                                <div class="bg-green-50 p-4 rounded-xl text-center">
                                    <p class="text-green-700 font-bold">✅ ${promptMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'} request sent!</p>
                                    <p class="text-xs text-green-600">Parent will receive a payment prompt on their phone</p>
                                </div>
                            `}

                            ${promptStatus === 'error' && html`
                                <div class="bg-red-50 p-4 rounded-xl text-center">
                                    <p class="text-red-700 font-bold">❌ Payment request failed</p>
                                    <p class="text-xs text-red-600">Please check API settings in Configuration</p>
                                </div>
                            `}

                            <button 
                                type="button"
                                onClick=${sendPaymentPrompt}
                                disabled=${promptStatus === 'sending'}
                                class=${`w-full py-4 rounded-xl font-bold text-white shadow-lg ${promptStatus === 'sending' ? 'bg-slate-400' : promptMethod === 'mpesa' ? 'bg-green-600 shadow-green-200' : 'bg-red-600 shadow-red-200'}`}
                            >
                                ${promptStatus === 'sending' ? 'Sending...' : `Send ${promptMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'} Prompt`}
                            </button>
                        </div>
                    </div>
                </div>
            `}

            <h2 class="text-2xl font-bold no-print">Fee Management</h2>

            <div class="flex justify-end no-print">
                <button 
                    onClick=${() => {
                        const student = data.students.find(s => s.id === selectedStudentId);
                        if (student) {
                            openPromptModal(student);
                        } else {
                            alert('Please select a student first');
                        }
                    }}
                    class="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-green-200 flex items-center gap-2"
                >
                    📱 Send Payment Prompt
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 no-print">
                    <h3 class="font-bold mb-4">Record New Payment</h3>
                    <form onSubmit=${handlePayment} class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Filter Grade</label>
                                <select 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary font-bold text-primary"
                                    value=${filterGrade}
                                    onChange=${(e) => { setFilterGrade(e.target.value); setFilterStream('ALL'); setSelectedStudentId(''); }}
                                >
                                    <option value="ALL">All Grades</option>
                                    ${(data.settings.grades || []).map(g => html`<option value=${g}>${g}</option>`)}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Stream</label>
                                <select 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary font-bold text-primary"
                                    value=${filterStream}
                                    onChange=${(e) => { setFilterStream(e.target.value); setSelectedStudentId(''); }}
                                >
                                    <option value="ALL">All Streams</option>
                                    ${streams.map(s => html`<option value=${s}>${s}</option>`)}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Select Student</label>
                                <select 
                                    required
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary"
                                    value=${selectedStudentId}
                                    onChange=${(e) => setSelectedStudentId(e.target.value)}
                                >
                                    <option value="">Select Student</option>
                                    ${(data.students || [])
                                        .filter(s => {
                                            if (filterGrade !== 'ALL' && s.grade !== filterGrade) return false;
                                            if (filterStream !== 'ALL' && s.stream !== filterStream) return false;
                                            return true;
                                        })
                                        .map(s => html`
                                            <option value=${s.id}>${s.name} (${s.grade}${s.stream || ''})</option>
                                        `)}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Academic Term</label>
                                <select 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary font-bold text-primary"
                                    value=${selectedTerm}
                                    onChange=${(e) => setSelectedTerm(e.target.value)}
                                >
                                    ${terms.map(t => html`<option value=${t}>${t}</option>`)}
                                </select>
                            </div>
                        </div>

                        ${feeStructure && html`
                            <div class="space-y-3">
                                <label class="text-xs font-bold text-slate-500 uppercase block">Fee Breakdown (${data.settings.currency})</label>
                                <div class="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 no-scrollbar">
                                    ${feeColumns.map(col => {
                                        // Handle Arrears specially
                                        if (col.key === 'previousArrears') {
                                            const arrearsDue = Number(student.previousArrears) || 0;
                                            // Calculate actual outstanding arrears (Arrears BF - what's already been paid towards it)
                                            const paidArrears = (data.payments || [])
                                                .filter(p => p.studentId === student.id)
                                                .reduce((sum, p) => sum + (Number(p.items?.previousArrears) || 0), 0);
                                            const outstandingArrears = Math.max(0, arrearsDue - paidArrears);

                                            if (outstandingArrears === 0 && arrearsDue === 0) return null;
                                            
                                            return html`
                                                <div class="p-3 bg-orange-50 rounded-xl border-2 border-orange-200 col-span-2 animate-pulse-subtle">
                                                    <div class="flex justify-between items-center mb-1">
                                                        <p class="text-[10px] font-black text-orange-600 uppercase truncate">${col.label}</p>
                                                        <button 
                                                            type="button"
                                                            onClick=${() => handleItemInput(col.key, outstandingArrears)}
                                                            class="text-[9px] bg-orange-600 text-white px-2 py-0.5 rounded font-bold hover:bg-orange-700 transition-colors"
                                                        >
                                                            Pay Full Arrears
                                                        </button>
                                                    </div>
                                                    <p class="text-[10px] text-orange-500 mb-1 font-bold">Outstanding Arrears: ${data.settings.currency} ${outstandingArrears.toLocaleString()}</p>
                                                    <input 
                                                        type="number" 
                                                        placeholder="Enter amount to pay towards arrears..."
                                                        class="w-full bg-white border border-orange-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 font-black text-orange-700"
                                                        value=${paymentItems[col.key] || ''}
                                                        onInput=${(e) => handleItemInput(col.key, e.target.value)}
                                                    />
                                                    <p class="text-[8px] text-orange-400 mt-1 italic">* It is recommended to clear arrears before current fees.</p>
                                                </div>
                                            `;
                                        }

                                        // Term Filter logic: 
                                        // 1. Hide other terms tuition
                                        if (col.key === 't1' && selectedTerm !== 'T1') return null;
                                        if (col.key === 't2' && selectedTerm !== 'T2') return null;
                                        if (col.key === 't3' && selectedTerm !== 'T3') return null;

                                        // Filter items based on student's fee profile
                                        const isSelected = (student.selectedFees || ['t1', 't2', 't3', 'admission', 'diary', 'development']).includes(col.key);
                                        const due = feeStructure[col.key] || 0;
                                        
                                        if (!isSelected || due === 0) return null;
                                        
                                        return html`
                                            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <p class="text-[10px] font-bold text-slate-400 uppercase truncate">${col.label}</p>
                                                <p class="text-[10px] text-slate-500 mb-1">Due: ${due.toLocaleString()}</p>
                                                <input 
                                                    type="number" 
                                                    placeholder="0"
                                                    class="w-full bg-white border border-slate-200 rounded-lg p-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                    value=${paymentItems[col.key] || ''}
                                                    onInput=${(e) => handleItemInput(col.key, e.target.value)}
                                                />
                                            </div>
                                        `;
                                    })}
                                </div>
                                <div class="pt-4 border-t flex justify-between items-center">
                                    <span class="font-bold text-slate-700">Total to Pay:</span>
                                    <span class="text-xl font-black text-blue-600">${data.settings.currency} ${Object.values(paymentItems).reduce((sum, v) => sum + (v || 0), 0).toLocaleString()}</span>
                                </div>
                            </div>
                        `}

                        <button class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50" disabled=${!selectedStudentId}>
                            Generate Receipt
                        </button>
                    </form>
                </div>

                <div class="bg-slate-900 text-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden print:bg-white print:text-black print:shadow-none print:p-0 min-h-[500px] receipt-container">
                    <div class="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl print:hidden"></div>
                    ${receipt ? html`
                        <div class="relative space-y-6 print:space-y-4 print:w-full">
                            <div class="flex flex-col items-center text-center border-b border-slate-800 print:border-black pb-4">
                                <img src="${data.settings.schoolLogo}" class="w-12 h-12 sm:w-16 sm:h-16 mb-2 object-contain" alt="Logo" />
                                <h3 class="text-lg sm:text-2xl font-black uppercase tracking-tight">${data.settings.schoolName}</h3>
                                <p class="text-[9px] sm:text-sm text-slate-400 print:text-slate-600">${data.settings.schoolAddress}</p>
                            </div>
                            
                            <div class="flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div>
                                    <h4 class="text-blue-400 print:text-blue-600 font-bold uppercase tracking-widest text-[9px] sm:text-[10px]">Official Payment Receipt - Term ${receipt.term || 'N/A'}</h4>
                                    <p class="text-[10px] text-slate-400 uppercase font-bold">Academic Year: ${data.settings.academicYear}</p>
                                    <p class="text-xl sm:text-2xl font-black mt-0.5 sm:mt-1">${receipt.receiptNo}</p>
                                </div>
                                <div class="text-left sm:text-right w-full sm:w-auto border-t border-slate-800 sm:border-0 pt-2 sm:pt-0">
                                    <p class="text-slate-400 print:text-slate-600 text-[10px] sm:text-xs">Date: ${receipt.date}</p>
                                </div>
                            </div>

                            <div class="border-t border-slate-800 print:border-black pt-4 space-y-2">
                                <div class="flex justify-between text-xs sm:text-sm">
                                    <span class="text-slate-400 print:text-slate-600">Student:</span>
                                    <span class="font-bold">${receipt.studentName} (${receipt.grade})</span>
                                </div>
                                
                                <div class="mt-4 overflow-x-auto no-scrollbar">
                                    <div class="grid grid-cols-4 text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-800 pb-1 print:border-black min-w-[280px]">
                                        <span>Item</span>
                                        <span class="text-right">Fee</span>
                                        <span class="text-right">Paid</span>
                                        <span class="text-right">Balance</span>
                                    </div>
                                    <div class="space-y-1 min-w-[280px]">
                                        ${feeColumns.map(col => {
                                            const paidNow = receipt.items?.[col.key] || 0;
                                            
                                            // Special logic for Arrears B/F
                                            if (col.key === 'previousArrears') {
                                                const targetStudent = data.students.find(s => s.name === receipt.studentName);
                                                const feeAmount = Number(targetStudent?.previousArrears) || 0;
                                                if (feeAmount === 0 && paidNow === 0) return null;
                                                
                                                const totalPaidForItem = (receipt.history || []).reduce((sum, p) => sum + (p.items?.[col.key] || 0), 0);
                                                const itemBalance = feeAmount - totalPaidForItem;
                                                
                                                return html`
                                                    <div class="grid grid-cols-4 text-[10px] border-b border-slate-800/30 print:border-slate-100 py-1.5 items-center">
                                                        <span class="text-orange-400 print:text-orange-600 truncate pr-1 font-bold">${col.label}</span>
                                                        <span class="text-right text-slate-300 print:text-slate-400 font-medium">${feeAmount.toLocaleString()}</span>
                                                        <span class=${`text-right font-bold ${paidNow > 0 ? 'text-white print:text-black' : 'text-slate-600 print:text-slate-300'}`}>
                                                            ${paidNow > 0 ? paidNow.toLocaleString() : '-'}
                                                        </span>
                                                        <span class="text-right font-mono font-bold ${itemBalance > 0 ? 'text-orange-400 print:text-slate-700' : 'text-green-400 print:text-green-600'}">
                                                            ${itemBalance.toLocaleString()}
                                                        </span>
                                                    </div>
                                                `;
                                            }

                                            // Filter by term if it's a tuition fee
                                            const currentTermKey = receipt.term?.toLowerCase() || '';
                                            const isOtherTerm = ['t1', 't2', 't3'].includes(col.key) && col.key !== currentTermKey;
                                            
                                            // Determine if this item is part of this specific student's profile
                                            const targetStudent = data.students.find(s => s.name === receipt.studentName);
                                            const isSelected = (targetStudent?.selectedFees || ['t1', 't2', 't3']).includes(col.key);
                                            
                                            // Don't show other terms unless there was a payment for them (rare)
                                            if (isOtherTerm && paidNow === 0) return null;

                                            const feeAmount = isSelected ? (receipt.structure?.[col.key] || 0) : 0;
                                            
                                            // Only show if it's selected for the student OR if something was paid anyway (history)
                                            if (feeAmount === 0 && paidNow === 0) return null;

                                            // Calculate cumulative balance for this item up to this receipt
                                            const totalPaidForItem = (receipt.history || []).reduce((sum, p) => sum + (p.items?.[col.key] || 0), 0);
                                            const itemBalance = feeAmount - totalPaidForItem;
                                            
                                            return html`
                                                <div class="grid grid-cols-4 text-[10px] border-b border-slate-800/30 print:border-slate-100 py-1.5 items-center">
                                                    <span class="text-slate-400 print:text-slate-500 truncate pr-1">${col.label}</span>
                                                    <span class="text-right text-slate-300 print:text-slate-400 font-medium">${feeAmount.toLocaleString()}</span>
                                                    <span class=${`text-right font-bold ${paidNow > 0 ? 'text-white print:text-black' : 'text-slate-600 print:text-slate-300'}`}>
                                                        ${paidNow > 0 ? paidNow.toLocaleString() : '-'}
                                                    </span>
                                                    <span class="text-right font-mono font-bold ${itemBalance > 0 ? 'text-orange-400 print:text-slate-700' : 'text-green-400 print:text-green-600'}">
                                                        ${itemBalance.toLocaleString()}
                                                    </span>
                                                </div>
                                            `;
                                        })}
                                    </div>
                                </div>

                                <div class="flex justify-between items-center bg-slate-800 print:bg-slate-100 p-4 rounded-xl mt-6">
                                    <span class="text-slate-400 print:text-slate-600 font-bold uppercase text-xs">Total Amount Paid</span>
                                    <span class="text-2xl font-black text-green-400 print:text-green-700">${data.settings.currency} ${receipt.amount.toLocaleString()}</span>
                                </div>
                                
                                <div class="space-y-1 px-2 pt-2">
                                    <div class="flex justify-between border-t border-slate-800/50 print:border-slate-200 pt-1">
                                        <span class="text-slate-500 print:text-slate-400 text-[9px] font-black uppercase tracking-wider">Overall Account Balance</span>
                                        <span class="font-black text-[12px] text-orange-400 print:text-black">${data.settings.currency} ${receipt.balance.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Bank & Mobile Money Details -->
                            ${(data.settings.bankName || data.settings.mpesaPaybill || data.settings.airtelPaybill) && html`
                                <div class="mt-6 p-4 bg-slate-800/50 print:bg-slate-50 rounded-xl border border-slate-700 print:border-slate-200">
                                    <p class="text-[9px] font-black uppercase text-slate-500 print:text-slate-600 mb-2">Payment Options</p>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[9px]">
                                        ${data.settings.bankName && html`
                                            <div class="flex items-start gap-2">
                                                <span class="text-green-400">🏦</span>
                                                <div>
                                                    <p class="font-bold text-slate-300 print:text-slate-700">${data.settings.bankName}</p>
                                                    <p class="text-slate-500 print:text-slate-500">A/C No: ${data.settings.bankAccount || 'N/A'}</p>
                                                </div>
                                            </div>
                                        `}
                                        ${data.settings.mpesaPaybill && html`
                                            <div class="flex items-start gap-2">
                                                <span class="text-green-400">📱</span>
                                                <div>
                                                    <p class="font-bold text-slate-300 print:text-slate-700">M-Pesa Paybill: ${data.settings.mpesaPaybill}</p>
                                                    <p class="text-slate-500 print:text-slate-500">A/C: ${data.settings.mpesaAccountName || 'School Fees'}</p>
                                                </div>
                                            </div>
                                        `}
                                        ${data.settings.airtelPaybill && html`
                                            <div class="flex items-start gap-2">
                                                <span class="text-red-400">📱</span>
                                                <div>
                                                    <p class="font-bold text-slate-300 print:text-slate-700">Airtel Paybill: ${data.settings.airtelPaybill}</p>
                                                    <p class="text-slate-500 print:text-slate-500">A/C: ${data.settings.airtelAccountName || 'School Fees'}</p>
                                                </div>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            `}

                            <div class="pt-8 text-center hidden print:block">
                                <div class="flex justify-around mb-8 items-end h-16">
                                    <div class="text-center w-32">
                                        <div class="h-10 flex items-center justify-center mb-1">
                                            ${data.settings.clerkSignature && html`<img src="${data.settings.clerkSignature}" class="h-full object-contain" />`}
                                        </div>
                                        <div class="border-t border-black pt-1 text-[8px] font-bold uppercase">Accounts Clerk</div>
                                    </div>
                                    <div class="text-center w-32">
                                        <div class="h-10 flex items-center justify-center mb-1">
                                            <img src="${data.settings.schoolLogo}" class="h-full object-contain opacity-20 grayscale" />
                                        </div>
                                        <div class="border-t border-black pt-1 text-[8px] font-bold uppercase">School Stamp</div>
                                    </div>
                                </div>
                                <p class="text-[10px] italic">Thank you for your payment.</p>
                            </div>
                            
                            <button onClick=${() => window.print()} class="w-full py-3 bg-blue-600 text-white rounded-xl font-bold no-print shadow-lg shadow-blue-500/30">
                                Print Receipt
                            </button>
                        </div>
                    ` : html`
                        <div class="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                            <span class="text-4xl">🧾</span>
                            <p>Select a student and enter item-wise payments to generate a detailed receipt</p>
                        </div>
                    `}
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-8 no-print">
                <div class="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h3 class="font-bold">Transaction History</h3>
                    <div class="flex items-center gap-4">
                        <select 
                            class="bg-slate-50 border-0 rounded-lg text-[10px] font-bold uppercase p-2 outline-none focus:ring-1 focus:ring-primary"
                            value=${filterGrade}
                            onChange=${e => setFilterGrade(e.target.value)}
                        >
                            <option value="ALL">All Grades</option>
                            ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                        </select>
                        <span class="text-xs text-slate-400">${(data.payments || []).length} Total</span>
                    </div>
                </div>
                <div class="overflow-x-auto no-scrollbar">
                    <table class="w-full text-left min-w-[500px]">
                        <thead class="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                            <tr>
                                <th class="px-6 py-3">Receipt #</th>
                                <th class="px-6 py-3">Student</th>
                                <th class="px-6 py-3">Date</th>
                                <th class="px-6 py-3 text-right">Amount</th>
                                <th class="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${(data.payments || [])
                                .filter(p => {
                                    if (filterGrade === 'ALL') return true;
                                    const s = data.students.find(st => st.id === p.studentId);
                                    return s?.grade === filterGrade;
                                })
                                .slice().reverse().map(p => {
                                const s = data.students.find(st => st.id === p.studentId);
                                return html`
                                    <tr key=${p.id} class="hover:bg-slate-50">
                                        <td class="px-6 py-4 font-mono text-xs">${p.receiptNo}</td>
                                        <td class="px-6 py-4 font-medium text-sm">${s?.name || 'Unknown'}</td>
                                        <td class="px-6 py-4 text-xs text-slate-500">${p.date}</td>
                                        <td class="px-6 py-4 text-right font-bold text-slate-700">${data.settings.currency} ${p.amount.toLocaleString()}</td>
                                        <td class="px-6 py-4 text-center">
                                            <div class="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick=${() => viewReceipt(p)}
                                                    class="text-blue-600 text-[10px] font-bold uppercase hover:underline"
                                                >
                                                    View
                                                </button>
                                                <button 
                                                    onClick=${() => handleDeletePayment(p.id)}
                                                    class="text-red-500 text-[10px] font-bold uppercase hover:underline"
                                                >
                                                    Void
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            })}
                        </tbody>
                    </table>
                </div>
                ${(!data.payments || data.payments.length === 0) && html`
                    <div class="p-12 text-center text-slate-300">No transactions recorded yet.</div>
                `}
            </div>
            <style>
                @media print {
                    .no-print { display: none !important; }
                    .bg-slate-900 { background-color: white !important; color: black !important; }
                    .text-white { color: black !important; }
                    .text-blue-400 { color: #2563eb !important; }
                    .text-green-400 { color: #166534 !important; }
                    .text-orange-400 { color: #9a3412 !important; }
                    .border-slate-800 { border-color: #000 !important; }
                    
                    /* Reset mobile constraints for printing */
                    body, html { height: auto !important; overflow: visible !important; }
                    #app { height: auto !important; overflow: visible !important; }
                    main { overflow: visible !important; position: static !important; }
                    .receipt-container { 
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        z-index: 9999 !important;
                    }
                    .bg-slate-900.print\:bg-white { background: white !important; }
                }
            </style>
        </div>
    `;
};