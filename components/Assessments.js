import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

export const Assessments = ({ data, setData }) => {
    const [selectedGrade, setSelectedGrade] = useState('GRADE 1');
    const [selectedStream, setSelectedStream] = useState('ALL');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [selectedExamType, setSelectedExamType] = useState('Opener');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');

    const streams = data?.settings?.streams || [];
    const subjects = Storage.getSubjectsForGrade(selectedGrade);

    useEffect(() => {
        if (!subjects.includes(selectedSubject)) {
            setSelectedSubject(subjects[0]);
        }
    }, [selectedGrade]);
    
    const students = (data?.students || []).filter(s => {
        const inGrade = s.grade === selectedGrade;
        if (!inGrade) return false;
        
        const inStream = selectedStream === 'ALL' || s.stream === selectedStream;
        if (!inStream) return false;
        
        // For Senior School, filter students by their chosen electives
        const seniorGrades = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
        if (seniorGrades.includes(selectedGrade)) {
            const core = ['English', 'Kiswahili', 'Mathematics', 'CSL'];
            if (core.includes(selectedSubject)) return true;
            return (s.seniorElectives || []).includes(selectedSubject);
        }
        return true;
    });

    const updateAssessment = (studentId, field, value) => {
        const studentIdStr = String(studentId);
        const academicYear = data.settings?.academicYear || '2025/2026';
        
        const existing = data.assessments.find(a => 
            String(a.studentId) === studentIdStr && 
            a.subject === selectedSubject && 
            a.term === selectedTerm && 
            a.examType === selectedExamType &&
            a.academicYear === academicYear
        );
        const otherAssessments = data.assessments.filter(a => 
            !(String(a.studentId) === studentIdStr && a.subject === selectedSubject && a.term === selectedTerm && a.examType === selectedExamType && a.academicYear === academicYear)
        );
        
        let level = existing?.level || 'ME2';
        let score = existing?.score || 0;

        if (field === 'score') {
            score = Number(value);
            level = Storage.getGradeInfo(score).level;
        } else {
            level = value;
        }

        const newAssessment = {
            id: existing?.id || ('A-' + Date.now() + Math.random().toString().slice(2, 6)),
            studentId: studentIdStr,
            subject: selectedSubject,
            term: selectedTerm,
            examType: selectedExamType,
            level,
            score,
            academicYear: academicYear,
            date: new Date().toISOString().split('T')[0]
        };
        setData({ ...data, assessments: [...otherAssessments, newAssessment] });
        
        // Auto-sync to Google Sheet
        if (data.settings.googleScriptUrl) {
            syncToGoogle([newAssessment]);
        }
    };
    
    const syncToGoogle = async (assessments) => {
        if (!data.settings.googleScriptUrl || isSyncing) return;
        
        setIsSyncing(true);
        setSyncStatus('Syncing to Google Sheet...');
        googleSheetSync.setSettings(data.settings);
        
        try {
            const updatedAssessments = [];
            
            for (const assessment of assessments) {
                const student = (data.students || []).find(s => String(s.id) === String(assessment.studentId));
                const enriched = {
                    ...assessment,
                    studentName: student?.name || 'Unknown',
                    grade: student?.grade || ''
                };
                
                // Use updateRecord for existing assessments, pushAssessment for new ones
                // The assessment already has an `id`; updateRecord will find and update its row.
                let result;
                if (assessment.id) {
                    result = await googleSheetSync.updateRecord('Assessments', enriched);
                    if (!result.success) {
                        // Fallback to push (new row) if record not found on sheet yet
                        result = await googleSheetSync.pushAssessment(enriched);
                    }
                } else {
                    result = await googleSheetSync.pushAssessment(enriched);
                }
                
                if (result.success) {
                    const updatedAssessment = { ...assessment, ...(result.updatedData || {}) };
                    updatedAssessments.push(updatedAssessment);
                } else {
                    updatedAssessments.push(assessment);
                }
            }
            
            // Merge back any changes returned from Google
            if (updatedAssessments.length > 0) {
                const currentAssessments = [...data.assessments];
                updatedAssessments.forEach(updated => {
                    const idx = currentAssessments.findIndex(a => a.id === updated.id);
                    if (idx >= 0) {
                        currentAssessments[idx] = updated;
                    }
                });
                setData({ ...data, assessments: currentAssessments });
            }
            
            setSyncStatus('✓ Synced!');
            setTimeout(() => setSyncStatus(''), 2000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('Sync failed');
            setTimeout(() => setSyncStatus(''), 3000);
        }
        
        setIsSyncing(false);
    };
    
    const deleteAssessment = async (assessmentId) => {
        if (!confirm('Delete this assessment record?')) return;
        
        const updatedAssessments = data.assessments.filter(a => a.id !== assessmentId);
        setData({ ...data, assessments: updatedAssessments });
        
        // Delete from Google Sheet
        if (data.settings.googleScriptUrl) {
            setSyncStatus('Deleting from Sheet...');
            googleSheetSync.setSettings(data.settings);
            const resp = await googleSheetSync.deleteAssessment(assessmentId);
            setSyncStatus(resp.success ? '✓ Deleted from Sheet!' : '⚠ Local deleted, Sheet sync pending');
            setTimeout(() => setSyncStatus(''), 2500);
        }
    };

    // Detect and sync deletions made in Google Sheet
    const handleSyncDeletions = async () => {
        if (!data.settings.googleScriptUrl) {
            setSyncStatus('⚠ Google Sheet not connected');
            setTimeout(() => setSyncStatus(''), 2000);
            return;
        }

        setSyncStatus('Checking for remote deletions...');
        googleSheetSync.setSettings(data.settings);
        
        try {
            const deletionInfo = await googleSheetSync.detectDeletions('Assessments', data.assessments || []);
            
            if (deletionInfo.deletionCount > 0) {
                const updatedAssessments = data.assessments.filter(a => !deletionInfo.deletedIds.includes(String(a.id)));
                setData({ ...data, assessments: updatedAssessments });
                setSyncStatus(`✓ Synced! Removed ${deletionInfo.deletionCount} deleted assessment(s)`);
            } else {
                setSyncStatus('✓ No remote changes detected');
            }
            
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('⚠ Sync check failed - please try again');
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };
    
    const syncAllToGoogle = async () => {
        if (!data.settings.googleScriptUrl) {
            alert('Google Sheet not configured. Go to Settings > Teacher Data Sync.');
            return;
        }
        
        if (!confirm('Sync all current assessments to Google Sheet?')) return;
        
        const currentAssessments = data.assessments.filter(a => 
            a.grade === selectedGrade && 
            a.term === selectedTerm && 
            a.examType === selectedExamType
        );
        
        await syncToGoogle(currentAssessments);
    };

    const levels = [
        { id: 'EE1', label: 'EE1', title: 'Exceptional (90-100)' },
        { id: 'EE2', label: 'EE2', title: 'Very Good (75-89)' },
        { id: 'ME1', label: 'ME1', title: 'Good (58-74)' },
        { id: 'ME2', label: 'ME2', title: 'Fair (41-57)' },
        { id: 'AE1', label: 'AE1', title: 'Needs Impr. (31-40)' },
        { id: 'AE2', label: 'AE2', title: 'Below Avg. (21-30)' },
        { id: 'BE1', label: 'BE1', title: 'Well Below (11-20)' },
        { id: 'BE2', label: 'BE2', title: 'Minimal (1-10)' }
    ];

    return html`
        <div class="space-y-6">
            <div class="flex justify-between items-start no-print">
                <div>
                    <h2 class="text-2xl font-bold">CBC Competency Tracker</h2>
                    <p class="text-slate-500">Assess students based on curriculum sub-strands</p>
                </div>
                ${data.settings.googleScriptUrl && html`
                    <div class="flex items-center gap-2">
                        ${syncStatus && html`
                            <span class="text-xs font-bold ${syncStatus.includes('✓') ? 'text-green-600' : 'text-blue-600'}">${syncStatus}</span>
                        `}
                        <button 
                            onClick=${syncAllToGoogle}
                            disabled=${isSyncing}
                            class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                            <span>${isSyncing ? '⏳' : '📤'}</span>
                            ${isSyncing ? 'Syncing...' : 'Sync to Sheet'}
                        </button>
                        <button 
                            onClick=${handleSyncDeletions}
                            class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                            title="Check for assessments deleted in Google Sheet"
                        >
                            <span>↻</span> Sync from Sheet
                        </button>
                    </div>
                `}
            </div>

            <div class="flex flex-col md:flex-row flex-wrap gap-4 no-print">
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Grade</label>
                    <select 
                        class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[120px]"
                        value=${selectedGrade}
                        onChange=${(e) => { setSelectedGrade(e.target.value); setSelectedStream('ALL'); }}
                    >
                        ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Stream</label>
                    <select 
                        class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[100px]"
                        value=${selectedStream}
                        onChange=${(e) => setSelectedStream(e.target.value)}
                    >
                        <option value="ALL">All</option>
                        ${streams.map(s => html`<option value=${s}>${s}</option>`)}
                    </select>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Term</label>
                    <select 
                        class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[100px]"
                        value=${selectedTerm}
                        onChange=${(e) => setSelectedTerm(e.target.value)}
                    >
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Exam Cycle</label>
                    <select 
                        class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[140px]"
                        value=${selectedExamType}
                        onChange=${(e) => setSelectedExamType(e.target.value)}
                    >
                        <option value="Opener">Opener (CAT 1)</option>
                        <option value="Mid-Term">Mid-Term (CAT 2)</option>
                        <option value="End-Term">End-Term Exam</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1 flex-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Subject</label>
                    <select 
                        class="p-3 bg-white border border-slate-200 rounded-xl outline-none w-full"
                        value=${selectedSubject}
                        onChange=${(e) => setSelectedSubject(e.target.value)}
                    >
                        ${subjects.map(s => html`<option value=${s}>${s}</option>`)}
                    </select>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
                ${students.length === 0 ? html`
                    <div class="p-12 text-center text-slate-400">No students found in this grade.</div>
                ` : html`
                    <div class="divide-y divide-slate-50">
                        ${students.map(student => {
                            const assessment = data.assessments.find(a => 
                                String(a.studentId) === String(student.id) && 
                                a.subject === selectedSubject && 
                                a.term === selectedTerm && 
                                a.examType === selectedExamType
                            );
                            return html`
                                <div key=${student.id} class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <p class="font-bold">${student.name}</p>
                                        <p class="text-xs text-slate-400">Adm: ${student.admissionNo}</p>
                                    </div>
                                    <div class="flex flex-col md:flex-row items-center gap-4">
                                        <div class="flex items-center gap-2">
                                            <label class="text-[10px] font-bold text-slate-400 uppercase">Score</label>
                                            <input 
                                                type="number" 
                                                min="0" max="100"
                                                value=${assessment?.score || ''}
                                                onBlur=${(e) => updateAssessment(student.id, 'score', e.target.value)}
                                                class="w-16 p-2 bg-slate-50 border border-slate-100 rounded text-center font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="0-100"
                                            />
                                            ${assessment && html`
                                                <button 
                                                    onClick=${() => deleteAssessment(assessment.id)}
                                                    title="Delete"
                                                    class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-xs font-bold"
                                                >
                                                    ✕
                                                </button>
                                            `}
                                        </div>
                                        <div class="flex gap-1">
                                            ${levels.map(l => html`
                                                <button
                                                    onClick=${() => updateAssessment(student.id, 'level', l.id)}
                                                    title=${l.title}
                                                    class=${`w-10 h-10 rounded-lg text-[10px] font-bold transition-all border ${
                                                        assessment?.level === l.id 
                                                        ? 'bg-blue-600 text-white border-blue-600 scale-105' 
                                                        : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    ${l.label}
                                                </button>
                                            `)}
                                        </div>
                                    </div>
                                </div>
                            `;
                        })}
                    </div>
                `}
            </div>

            <div class="space-y-3 mt-8">
                <h3 class="text-lg font-bold">Assessment Records (All Entries)</h3>
                <p class="text-xs text-slate-500">View, edit, and delete all assessment entries</p>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-200">
                                <th class="px-4 py-2 text-left font-bold text-slate-600">Student Name</th>
                                <th class="px-4 py-2 text-left font-bold text-slate-600">Subject</th>
                                <th class="px-4 py-2 text-left font-bold text-slate-600">Term</th>
                                <th class="px-4 py-2 text-left font-bold text-slate-600">Exam Type</th>
                                <th class="px-4 py-2 text-center font-bold text-slate-600">Score</th>
                                <th class="px-4 py-2 text-center font-bold text-slate-600">Level</th>
                                <th class="px-4 py-2 text-center font-bold text-slate-600">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${data.assessments.length === 0 ? html`
                                <tr>
                                    <td colspan="7" class="px-4 py-6 text-center text-slate-400">No assessment records yet</td>
                                </tr>
                            ` : data.assessments.map(assessment => {
                                const student = (data.students || []).find(s => String(s.id) === String(assessment.studentId));
                                return html`
                                    <tr key=${assessment.id} class="hover:bg-blue-50">
                                        <td class="px-4 py-3">${student?.name || 'Unknown'}</td>
                                        <td class="px-4 py-3">${assessment.subject}</td>
                                        <td class="px-4 py-3">${assessment.term}</td>
                                        <td class="px-4 py-3">${assessment.examType}</td>
                                        <td class="px-4 py-3 text-center font-bold">
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="100"
                                                value=${assessment.score}
                                                onChange=${(e) => {
                                                    const updated = {
                                                        ...assessment,
                                                        score: Number(e.target.value),
                                                        level: Storage.getGradeInfo(Number(e.target.value)).level
                                                    };
                                                    const updatedAssessments = data.assessments.map(a => a.id === assessment.id ? updated : a);
                                                    setData({ ...data, assessments: updatedAssessments });
                                                    syncToGoogle([updated]);
                                                }}
                                                class="w-12 p-1 text-center bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">${assessment.level}</span>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <button 
                                                onClick=${() => deleteAssessment(assessment.id)}
                                                title="Delete assessment"
                                                class="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-bold"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            })}
                        </tbody>
                    </table>
                </div>
                <p class="text-xs text-slate-400 mt-2">${data.assessments.length} total records</p>
            </div>
        </div>
    `;
};