import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

export const Students = ({ data, setData, onSelectStudent }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');
    const [filterGrade, setFilterGrade] = useState('ALL');
    const [filterStream, setFilterStream] = useState('ALL');
    const [filterFinance, setFilterFinance] = useState('ALL');

    const defaultFeeOptions = [
        { key: 'admission', label: 'Admission' }, { key: 'diary', label: 'Diary' }, { key: 'development', label: 'Development' },
        { key: 't1', label: 'T1 Tuition' }, { key: 't2', label: 'T2 Tuition' }, { key: 't3', label: 'T3 Tuition' },
        { key: 'boarding', label: 'Boarding' }, { key: 'breakfast', label: 'Breakfast' }, { key: 'lunch', label: 'Lunch' },
        { key: 'trip', label: 'Trip' }, { key: 'bookFund', label: 'Books' }, { key: 'caution', label: 'Caution' },
        { key: 'uniform', label: 'Uniform' }, { key: 'studentCard', label: 'School ID' }, { key: 'remedial', label: 'Remedials' },
        { key: 'assessmentFee', label: 'Assessment Fee' }, { key: 'projectFee', label: 'Project Fee' },
        { key: 'activityFees', label: 'Activity Fees' }, { key: 'tieAndBadge', label: 'Tie & Badge' }, { key: 'academicSupport', label: 'Academic Support' },
        { key: 'pta', label: 'PTA' }
    ];

    const customFeeOptions = (data.settings.customFeeColumns || []).map(cf => ({ key: cf.key, label: cf.label }));
    const feeOptions = [...defaultFeeOptions, ...customFeeOptions];

    const [editingId, setEditingId] = useState(null);
    const streams = data.settings.streams || ['A', 'B', 'C'];
    const [newStudent, setNewStudent] = useState({
        name: '',
        grade: data.settings.grades[0] || 'GRADE 1',
        stream: streams[0] || '',
        category: 'Normal',
        admissionNo: '',
        admissionDate: new Date().toISOString().slice(0, 10),
        assessmentNo: '',
        upiNo: '',
        parentContact: '',
        previousArrears: 0,
        selectedFees: ['t1', 't2', 't3', 'admission', 'diary', 'development', 'pta']
    });

    const handleAdd = async (e) => {
        e.preventDefault();

        // Save student first
        if (editingId) {
            const updatedStudent = { ...newStudent, id: editingId };
            const updated = data.students.map(s => s.id === editingId ? updatedStudent : s);
            setData({ ...data, students: updated });
            setEditingId(null);

            // also sync update to Google
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Updating Google...');
                googleSheetSync.setSettings(data.settings);
                const resp = await googleSheetSync.pushStudent(updatedStudent);
                if (!resp.success) {
                    console.warn('Failed to update student on Google:', resp.error);
                }
                setSyncStatus('✓ Synced!');
                setTimeout(() => setSyncStatus(''), 2000);
            }
        } else {
            const id = Date.now().toString();
            const newStudentWithId = { ...newStudent, id };
            setData({ ...data, students: [...(data.students || []), newStudentWithId] });

            // Sync to Google Sheet
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Syncing to Google...');
                googleSheetSync.setSettings(data.settings);
                const resp = await googleSheetSync.pushStudent(newStudentWithId);
                if (!resp.success) {
                    console.warn('Failed to add student to Google:', resp.error);
                }
                setSyncStatus('✓ Synced!');
                setTimeout(() => setSyncStatus(''), 2000);
            }
        }
        setShowAdd(false);
        resetForm();
    };

    const resetForm = () => {
        setNewStudent({
            name: '',
            grade: data.settings.grades[0] || 'GRADE 1',
            category: 'Normal',
            admissionNo: '',
            assessmentNo: '',
            upiNo: '',
            parentContact: '',
            stream: streams[0] || '',
            previousArrears: 0,
            selectedFees: ['t1', 't2', 't3', 'admission', 'diary', 'development', 'pta']
        });
        setEditingId(null);
    };

    const handleEdit = (student) => {
        setNewStudent({ ...student, category: student.category || 'Normal' });
        setEditingId(student.id);
        setShowAdd(true);
    };

    const handlePromote = (student) => {
        const grades = data.settings.grades;
        const currentIndex = grades.indexOf(student.grade);

        if (currentIndex === -1 || currentIndex === grades.length - 1) {
            alert("No further grade to promote to.");
            return;
        }

        const nextGrade = grades[currentIndex + 1];
        if (!confirm(`Promote ${student.name} to ${nextGrade}? Current balance will be carried as arrears.`)) return;

        // Calculate current balance
        const financials = Storage.getStudentFinancials(student, data.payments, data.settings);

        const updatedStudents = data.students.map(s => {
            if (s.id === student.id) {
                return {
                    ...s,
                    grade: nextGrade,
                    previousArrears: financials.balance,
                    // We don't reset selectedFees, user might want to edit them
                };
            }
            return s;
        });

        setData({ ...data, students: updatedStudents });
        alert(`${student.name} promoted to ${nextGrade}. Arrears: ${data.settings.currency} ${financials.balance.toLocaleString()}`);
    };

    const handleDelete = (id) => {
        if (confirm('Are you sure you want to delete this student? This will not remove their payment history but they will no longer appear in active lists.')) {
            setData({ ...data, students: data.students.filter(s => s.id !== id) });
        }
    };

    const toggleFee = (key) => {
        const current = newStudent.selectedFees || [];
        const updated = current.includes(key)
            ? current.filter(k => k !== key)
            : [...current, key];
        setNewStudent({ ...newStudent, selectedFees: updated });
    };

    const filteredStudents = (data.students || []).filter(s => {
        const matchesGrade = filterGrade === 'ALL' || s.grade === filterGrade;
        const matchesStream = filterStream === 'ALL' || s.stream === filterStream;

        if (filterFinance === 'ALL') return matchesGrade && matchesStream;

        const feeStructure = data.settings.feeStructures?.find(f => f.grade === s.grade);
        const selectedKeys = s.selectedFees || ['t1', 't2', 't3'];
        const totalDue = (Number(s.previousArrears) || 0) + (feeStructure ? selectedKeys.reduce((sum, key) => sum + (feeStructure[key] || 0), 0) : 0);
        const totalPaid = (data.payments || []).filter(p => p.studentId === s.id).reduce((sum, p) => sum + Number(p.amount), 0);
        const balance = totalDue - totalPaid;

        if (filterFinance === 'FULL') return matchesGrade && matchesStream && balance <= 0 && totalDue > 0;
        if (filterFinance === 'HALF') return matchesGrade && matchesStream && totalPaid >= (totalDue / 2) && balance > 0;
        if (filterFinance === 'ARREARS') return matchesGrade && matchesStream && balance > 0;

        return matchesGrade && matchesStream;
    });

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold">Students Directory</h2>
                    <p class="text-slate-500 text-sm">Manage student enrollment and registration data</p>
                </div>
                ${syncStatus && html`
                    <span class="text-xs font-bold ${syncStatus.includes('✓') ? 'text-green-600' : 'text-blue-600'}">${syncStatus}</span>
                `}
                <div class="flex flex-wrap gap-2 no-print w-full md:w-auto">
                    <select 
                        class="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        value=${filterGrade}
                        onChange=${(e) => setFilterGrade(e.target.value)}
                    >
                        <option value="ALL">All Grades</option>
                        ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                    <select 
                        class="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        value=${filterStream}
                        onChange=${(e) => setFilterStream(e.target.value)}
                    >
                        <option value="ALL">All Streams</option>
                        ${streams.map(s => html`<option value=${s}>Stream ${s}</option>`)}
                    </select>
                    <select 
                        class="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        value=${filterFinance}
                        onChange=${(e) => setFilterFinance(e.target.value)}
                    >
                        <option value="ALL">All Payments</option>
                        <option value="FULL">Full Fees Paid</option>
                        <option value="HALF">Half Fees Paid+</option>
                        <option value="ARREARS">With Arrears</option>
                    </select>
                    <button onClick=${() => window.print()} class="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-200">Print List</button>
                    <button 
                        onClick=${() => { if (showAdd) resetForm(); setShowAdd(!showAdd); }}
                        class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-blue-700"
                    >
                        ${showAdd ? 'Cancel' : 'Add Student'}
                    </button>
                </div>
            </div>

            <div class="print-only mb-6 flex flex-col items-center text-center">
                <img src="${data.settings.schoolLogo}" class="w-16 h-16 mb-2 object-contain" alt="Logo" />
                <h1 class="text-2xl font-black uppercase">${data.settings.schoolName}</h1>
                <h2 class="text-sm font-bold uppercase text-slate-500 mt-1">Class Register: ${filterGrade === 'ALL' ? 'All Students' : filterGrade} (${data.settings.academicYear})</h2>
                <p class="text-[10px] text-slate-400 mt-1">Printed on ${new Date().toLocaleDateString()}</p>
            </div>

            ${showAdd && html`
                <form onSubmit=${handleAdd} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-300 no-print">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                            <input 
                                placeholder="e.g. John Doe" 
                                required 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.name}
                                onInput=${(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Admission Number</label>
                            <input 
                                placeholder="ADM/2024/001" 
                                required 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.admissionNo}
                                onInput=${(e) => setNewStudent({ ...newStudent, admissionNo: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Admission Date</label>
                            <input 
                                type="date"
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                value=${newStudent.admissionDate}
                                onChange=${(e) => setNewStudent({ ...newStudent, admissionDate: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Grade / Class</label>
                            <select 
                                class="w-full p-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.grade}
                                onChange=${(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                            >
                                ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Student Category</label>
                            <select 
                                class="w-full p-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                value=${newStudent.category || 'Normal'}
                                onChange=${(e) => setNewStudent({ ...newStudent, category: e.target.value })}
                            >
                                <option value="Normal">Normal (Full Fees)</option>
                                <option value="Staff">Staff Child (50% Off)</option>
                                <option value="Sponsored">Sponsored (100% Off)</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Assessment Number</label>
                            <input 
                                placeholder="ASN-123456" 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.assessmentNo}
                                onInput=${(e) => setNewStudent({ ...newStudent, assessmentNo: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">UPI Number</label>
                            <input 
                                placeholder="UPI-XXXX" 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.upiNo}
                                onInput=${(e) => setNewStudent({ ...newStudent, upiNo: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Stream</label>
                            <select
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.stream}
                                onChange=${(e) => setNewStudent({ ...newStudent, stream: e.target.value })}
                            >
                                ${streams.map(s => html`<option value=${s}>Stream ${s}</option>`)}
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Parent Contact</label>
                            <input 
                                placeholder="e.g. 0712345678" 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.parentContact}
                                onInput=${(e) => setNewStudent({ ...newStudent, parentContact: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-orange-600 uppercase ml-1">Prev. Arrears (Bal B/F)</label>
                            <input 
                                type="number"
                                placeholder="0.00" 
                                class="w-full p-3 bg-orange-50 rounded-lg border-0 focus:ring-2 focus:ring-orange-500 outline-none font-bold text-orange-700"
                                value=${newStudent.previousArrears}
                                onInput=${(e) => setNewStudent({ ...newStudent, previousArrears: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div class="space-y-2 pt-2 border-t border-slate-100">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Applicable Fee Items (Fee Profile)</label>
                        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            ${feeOptions.map(opt => html`
                                <label key=${opt.key} class=${`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${(newStudent.selectedFees || []).includes(opt.key)
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-slate-100 text-slate-400'
        }`}>
                                    <input 
                                        type="checkbox" 
                                        class="hidden"
                                        checked=${(newStudent.selectedFees || []).includes(opt.key)}
                                        onChange=${() => toggleFee(opt.key)}
                                    />
                                    <span class="text-[10px] font-bold uppercase truncate">${opt.label}</span>
                                </label>
                            `)}
                        </div>
                    </div>
                    <button class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">
                        ${editingId ? 'Update Student Information' : 'Register Student'}
                    </button>
                </form>
            `}

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left min-w-[800px]">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Name</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Adm No</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Adm Date</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">UPI No</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Assess No</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Parent Contact</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Grade</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${filteredStudents.map(student => html`
                            <tr key=${student.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                <td class="px-6 py-4">
                                    <div class="font-bold text-sm">${student.name}</div>
                                    <div class="text-[9px] text-slate-400 uppercase">${student.stream || 'No Stream'}</div>
                                </td>
                                <td class="px-6 py-4 text-slate-500 text-sm font-mono">${student.admissionNo}</td>
                                <td class="px-6 py-4 text-slate-500 text-xs font-mono">${student.admissionDate || '-'}</td>
                                <td class="px-6 py-4 text-slate-500 text-xs font-mono">${student.upiNo || '-'}</td>
                                <td class="px-6 py-4 text-slate-500 text-xs font-mono">${student.assessmentNo || '-'}</td>
                                <td class="px-6 py-4 text-slate-700 text-xs font-bold">${student.parentContact || '-'}</td>
                                <td class="px-6 py-4">
                                    <div class="flex flex-col gap-1">
                                        <span class="bg-slate-200 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">${student.grade}${student.stream || ''}</span>
                                        ${['GRADE 10', 'GRADE 11', 'GRADE 12'].includes(student.grade) && html`
                                            <span class="text-[8px] font-black text-blue-600 uppercase tracking-tighter">
                                                ${student.seniorPathway ? student.seniorPathway.replace(/([A-Z])/g, ' $1') : 'No Pathway'}
                                            </span>
                                        `}
                                    </div>
                                </td>
                                <td class="px-6 py-4 no-print">
                                    <div class="flex items-center gap-3">
                                        <button 
                                            onClick=${() => handlePromote(student)}
                                            class="bg-blue-50 text-blue-600 px-2 py-1 rounded font-black text-[9px] hover:bg-blue-600 hover:text-white transition-all uppercase"
                                            title="Promote to Next Grade"
                                        >
                                            Promote
                                        </button>
                                        <button 
                                            onClick=${() => onSelectStudent(student.id)}
                                            class="text-blue-600 font-bold text-[10px] hover:underline uppercase tracking-tight"
                                        >
                                            Report
                                        </button>
                                        <button 
                                            onClick=${() => handleEdit(student)}
                                            class="text-slate-600 font-bold text-[10px] hover:underline uppercase tracking-tight"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick=${() => handleDelete(student.id)}
                                            class="text-red-500 font-bold text-[10px] hover:underline uppercase tracking-tight"
                                        >
                                            Del
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
                ${filteredStudents.length === 0 && html`
                    <div class="p-12 text-center text-slate-300">No students found matching current filters.</div>
                `}
            </div>
        </div>
    `;
};