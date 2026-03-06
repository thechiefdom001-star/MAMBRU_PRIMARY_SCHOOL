import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export const Staff = ({ data, setData }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newStaff, setNewStaff] = useState({ 
        name: '', 
        role: '', 
        contact: '',
        employeeNo: '',
        nssfNo: '',
        shifNo: '',
        taxNo: ''
    });

    const handleAdd = (e) => {
        e.preventDefault();
        if (editingId) {
            const updated = data.staff.map(s => s.id === editingId ? { ...newStaff, id: editingId } : s);
            setData({ ...data, staff: updated });
            setEditingId(null);
        } else {
            const id = 'S-' + Date.now();
            setData({ ...data, staff: [...(data.staff || []), { ...newStaff, id }] });
        }
        setShowAdd(false);
        resetForm();
    };

    const resetForm = () => {
        setNewStaff({ 
            name: '', 
            role: '', 
            contact: '',
            employeeNo: '',
            nssfNo: '',
            shifNo: '',
            taxNo: ''
        });
        setEditingId(null);
    };

    const handleEdit = (staffMember) => {
        setNewStaff(staffMember);
        setEditingId(staffMember.id);
        setShowAdd(true);
    };

    const handleDelete = (id) => {
        if (confirm('Remove staff member from registry?')) {
            setData({ ...data, staff: (data.staff || []).filter(s => s.id !== id) });
        }
    };

    const staffList = data.staff || [];

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Support Staff Registry</h2>
                    <p class="text-slate-500 text-sm">Management of non-teaching personnel</p>
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    <button onClick=${() => window.print()} class="flex-1 md:flex-none bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-200">Print List</button>
                    <button 
                        onClick=${() => { if(showAdd) resetForm(); setShowAdd(!showAdd); }}
                        class="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-blue-700"
                    >
                        ${showAdd ? 'Cancel' : 'Add Staff'}
                    </button>
                </div>
            </div>

            ${showAdd && html`
                <form onSubmit=${handleAdd} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4 no-print animate-in slide-in-from-top-2">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                            <input placeholder="e.g. Jane Doe" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.name} onInput=${(e) => setNewStaff({...newStaff, name: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Job Role</label>
                            <input placeholder="e.g. Bursar, Security, Cook" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.role} onInput=${(e) => setNewStaff({...newStaff, role: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Contact Number</label>
                            <input placeholder="e.g. 07..." required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.contact} onInput=${(e) => setNewStaff({...newStaff, contact: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Employee No.</label>
                            <input placeholder="e.g. S-001" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.employeeNo} onInput=${(e) => setNewStaff({...newStaff, employeeNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">NSSF No.</label>
                            <input placeholder="e.g. 100..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.nssfNo} onInput=${(e) => setNewStaff({...newStaff, nssfNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">SHIF No.</label>
                            <input placeholder="e.g. S-..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.shifNo} onInput=${(e) => setNewStaff({...newStaff, shifNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Tax (PIN) No.</label>
                            <input placeholder="e.g. A00..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.taxNo} onInput=${(e) => setNewStaff({...newStaff, taxNo: e.target.value})} />
                        </div>
                    </div>
                    <button class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">
                        ${editingId ? 'Update Staff Member' : 'Register Staff Member'}
                    </button>
                </form>
            `}

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left min-w-[600px]">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Staff Name</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Role / Position</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Contact</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${staffList.map(s => html`
                            <tr key=${s.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                <td class="px-6 py-4">
                                    <div class="font-bold text-sm">${s.name}</div>
                                    <div class="text-[10px] text-slate-400 uppercase font-medium">ID: ${s.id}</div>
                                </td>
                                <td class="px-6 py-4">
                                    <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${s.role}</span>
                                </td>
                                <td class="px-6 py-4 text-slate-600 text-sm font-medium">${s.contact || 'N/A'}</td>
                                <td class="px-6 py-4 no-print">
                                    <div class="flex gap-2">
                                        <button onClick=${() => handleEdit(s)} class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Edit</button>
                                        <button onClick=${() => handleDelete(s.id)} class="text-red-500 text-[10px] font-bold uppercase hover:underline">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `)}
                        ${staffList.length === 0 && html`<tr><td colspan="4" class="p-12 text-center text-slate-300">No support staff registered yet.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};