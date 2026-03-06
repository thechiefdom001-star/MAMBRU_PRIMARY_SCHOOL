import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';

const html = htm.bind(h);

export const Assessments = ({ data, setData }) => {
    const [selectedGrade, setSelectedGrade] = useState('GRADE 1');
    const [selectedStream, setSelectedStream] = useState('ALL');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [selectedExamType, setSelectedExamType] = useState('Opener');

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
        const existing = data.assessments.find(a => 
            a.studentId === studentId && 
            a.subject === selectedSubject && 
            a.term === selectedTerm && 
            a.examType === selectedExamType &&
            a.academicYear === data.settings.academicYear
        );
        const otherAssessments = data.assessments.filter(a => 
            !(a.studentId === studentId && a.subject === selectedSubject && a.term === selectedTerm && a.examType === selectedExamType && a.academicYear === data.settings.academicYear)
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
            id: existing?.id || (Date.now() + Math.random().toString()),
            studentId,
            subject: selectedSubject,
            term: selectedTerm,
            examType: selectedExamType,
            level,
            score,
            academicYear: data.settings.academicYear,
            date: new Date().toISOString().split('T')[0]
        };
        setData({ ...data, assessments: [...otherAssessments, newAssessment] });
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
            <div>
                <h2 class="text-2xl font-bold">CBC Competency Tracker</h2>
                <p class="text-slate-500">Assess students based on curriculum sub-strands</p>
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
                                a.studentId === student.id && 
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
        </div>
    `;
};