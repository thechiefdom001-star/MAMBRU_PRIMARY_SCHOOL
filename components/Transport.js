import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export const Transport = ({ data, setData }) => {
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedRouteId, setSelectedRouteId] = useState('');
    const [showAddRoute, setShowAddRoute] = useState(false);
    const [newRoute, setNewRoute] = useState({ name: '', fee: '' });

    const transport = data.transport || { routes: [], assignments: [] };

    const handleAddRoute = (e) => {
        e.preventDefault();
        const routeId = 'r-' + Date.now();
        const updatedRoutes = [...transport.routes, { ...newRoute, id: routeId, fee: Number(newRoute.fee) }];
        setData({
            ...data,
            transport: { ...transport, routes: updatedRoutes }
        });
        setNewRoute({ name: '', fee: '' });
        setShowAddRoute(false);
    };

    const handleDeleteRoute = (id) => {
        if (confirm('Delete this route? This will affect capacity calculations.')) {
            setData({
                ...data,
                transport: {
                    ...transport,
                    routes: transport.routes.filter(r => r.id !== id)
                }
            });
        }
    };

    const handleAssign = (e) => {
        e.preventDefault();
        const existing = transport.assignments.filter(a => a.studentId !== selectedStudentId);
        const newAssignment = { studentId: selectedStudentId, routeId: selectedRouteId };
        setData({
            ...data,
            transport: { ...transport, assignments: [...existing, newAssignment] }
        });
        setSelectedStudentId('');
        setSelectedRouteId('');
    };

    const handleDeleteAssignment = (studentId) => {
        if (confirm('Remove transport assignment for this student?')) {
            setData({
                ...data,
                transport: {
                    ...transport,
                    assignments: transport.assignments.filter(a => a.studentId !== studentId)
                }
            });
        }
    };

    return html`
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <div class="no-print">
                    <h2 class="text-2xl font-bold">School Transport</h2>
                    <p class="text-slate-500">Manage routes and student assignments</p>
                </div>
                <div class="flex gap-2 no-print">
                    <button onClick=${() => setShowAddRoute(!showAddRoute)} class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm">
                        ${showAddRoute ? 'Close Form' : 'Add New Route'}
                    </button>
                    <button onClick=${() => window.print()} class="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm">Print Sheet</button>
                </div>
            </div>

            ${showAddRoute && html`
                <form onSubmit=${handleAddRoute} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 no-print">
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Route Name</label>
                        <input 
                            required 
                            placeholder="e.g. Route C - Eastlands"
                            class="w-full p-3 bg-slate-50 rounded-xl outline-none border-0"
                            value=${newRoute.name}
                            onInput=${e => setNewRoute({...newRoute, name: e.target.value})}
                        />
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Termly Fee</label>
                        <input 
                            required 
                            type="number"
                            placeholder="0"
                            class="w-full p-3 bg-slate-50 rounded-xl outline-none border-0"
                            value=${newRoute.fee}
                            onInput=${e => setNewRoute({...newRoute, fee: e.target.value})}
                        />
                    </div>
                    <div class="flex items-end">
                        <button class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">Save Route</button>
                    </div>
                </form>
            `}

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm no-print">
                    <h3 class="font-bold mb-4">Assign Transport</h3>
                    <form onSubmit=${handleAssign} class="space-y-4">
                        <select 
                            required 
                            class="w-full p-3 bg-slate-50 rounded-xl outline-none border-0"
                            value=${selectedStudentId}
                            onChange=${e => setSelectedStudentId(e.target.value)}
                        >
                            <option value="">Select Student</option>
                            ${(data.students || []).map(s => html`<option value=${s.id}>${s.name} (${s.grade})</option>`)}
                        </select>
                        <select 
                            required 
                            class="w-full p-3 bg-slate-50 rounded-xl outline-none border-0"
                            value=${selectedRouteId}
                            onChange=${e => setSelectedRouteId(e.target.value)}
                        >
                            <option value="">Select Route</option>
                            ${transport.routes.map(r => html`<option value=${r.id}>${r.name} (${data.settings.currency} ${r.fee})</option>`)}
                        </select>
                        <button class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100">Confirm Assignment</button>
                    </form>
                </div>

                <div class="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="p-4 border-b border-slate-50 flex justify-between items-center">
                        <h3 class="font-bold">Route Capacity (Graphical)</h3>
                        <span class="text-xs text-slate-400">Total Routes: ${transport.routes.length}</span>
                    </div>
                    <div class="p-6 space-y-6">
                        ${transport.routes.map(route => {
                            const studentCount = transport.assignments.filter(a => a.routeId === route.id).length;
                            const pct = Math.min((studentCount / 20) * 100, 100); // Assuming capacity 20
                            return html`
                                <div class="space-y-2">
                                    <div class="flex justify-between items-end">
                                        <div>
                                            <p class="font-bold text-sm text-slate-700">${route.name}</p>
                                            <p class="text-xs text-slate-400">${data.settings.currency} ${route.fee} per term</p>
                                        </div>
                                        <div class="text-right">
                                            <div class="flex items-center gap-2">
                                                <span class="text-xs font-bold text-blue-600">${studentCount}/20</span>
                                                <button onClick=${() => handleDeleteRoute(route.id)} class="text-red-400 hover:text-red-600 transition-colors no-print">
                                                    <span class="text-[10px]">🗑️</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div class="h-full bg-blue-500 rounded-full transition-all duration-500" style=${{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            `;
                        })}
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left min-w-[600px]">
                    <thead class="bg-slate-50 border-b">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Student</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Assigned Route</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Termly Fee</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${transport.assignments.map(a => {
                            const student = data.students.find(s => s.id === a.studentId);
                            const route = transport.routes.find(r => r.id === a.routeId);
                            return html`
                                <tr class="hover:bg-slate-100 even:bg-slate-50">
                                    <td class="px-6 py-4 font-medium text-sm">${student?.name || 'Unknown'}</td>
                                    <td class="px-6 py-4 text-slate-600 text-sm">${route?.name || 'None'}</td>
                                    <td class="px-6 py-4 font-bold text-sm">${data.settings.currency} ${route?.fee || 0}</td>
                                    <td class="px-6 py-4 no-print">
                                        <button onClick=${() => handleDeleteAssignment(a.studentId)} class="text-red-500 text-[10px] font-bold uppercase hover:underline">Remove</button>
                                    </td>
                                </tr>
                            `;
                        })}
                        ${transport.assignments.length === 0 && html`<tr><td colspan="3" class="p-12 text-center text-slate-300">No transport assignments yet</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};