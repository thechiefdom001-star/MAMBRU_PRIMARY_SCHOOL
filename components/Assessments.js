import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const Assessments = ({ data, setData, isAdmin, teacherSession }) => {
    const [selectedGrade, setSelectedGrade] = useState('GRADE 1');
    const [selectedStream, setSelectedStream] = useState('ALL');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [selectedExamType, setSelectedExamType] = useState('Opener');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [historySearchTerm, setHistorySearchTerm] = useState('');

    const streams = data?.settings?.streams || [];
    const subjects = Storage.getSubjectsForGrade(selectedGrade);

    // Track activity helper
    const trackActivity = async (action, assessment, oldData = null) => {
        if (!data.settings?.googleScriptUrl) return;
        
        try {
            googleSheetSync.setSettings(data.settings);
            const student = data.students?.find(s => String(s.id) === String(assessment.studentId));
            
            await googleSheetSync.trackActivity(
                action,
                'Assessments',
                assessment.id,
                student?.name || assessment.studentName || 'Unknown Student',
                `${assessment.subject} - ${assessment.term} ${assessment.examType}: Score ${assessment.score}`,
                oldData,
                assessment
            );
        } catch (err) {
            console.warn('Activity tracking failed:', err.message);
        }
    };

    // Create a robust student lookup map - rebuild when data.students changes
    const studentLookup = useMemo(() => {
        const map = new Map();
        if (data?.students) {
            data.students.forEach(s => {
                // Key by ID (both string and number variants)
                map.set(String(s.id), s);
                map.set(String(Number(s.id)), s);
                // Also key by admissionNo for Google Sheet data matching
                if (s.admissionNo) {
                    map.set(String(s.admissionNo).toLowerCase().trim(), s);
                    map.set(String(s.admissionNo).toUpperCase().trim(), s);
                }
            });
        }
        return map;
    }, [data?.students]);

    // Helper function to find student for an assessment
    const findStudentForAssessment = (assessment) => {
        // Try various ID formats
        let student = studentLookup.get(String(assessment.studentId));
        if (student) return student;
        
        student = studentLookup.get(String(Number(assessment.studentId)));
        if (student) return student;
        
        // Try matching by admissionNo stored in assessment (if synced from another device)
        if (assessment.studentAdmissionNo) {
            student = studentLookup.get(String(assessment.studentAdmissionNo).toLowerCase().trim());
            if (student) return student;
            student = studentLookup.get(String(assessment.studentAdmissionNo).toUpperCase().trim());
            if (student) return student;
        }
        
        // Try matching by studentName if available
        if (assessment.studentName) {
            const nameLower = assessment.studentName.toLowerCase().trim();
            student = data?.students?.find(s => 
                s.name && s.name.toLowerCase().trim() === nameLower
            );
            if (student) return student;
        }
        
        return null;
    };

    useEffect(() => {
        if (!subjects.includes(selectedSubject)) {
            setSelectedSubject(subjects[0]);
        }
    }, [selectedGrade]);
    
    const filteredStudents = (data?.students || []).filter(s => {
        const inGrade = s.grade === selectedGrade;
        if (!inGrade) return false;
        
        const inStream = selectedStream === 'ALL' || s.stream === selectedStream;
        if (!inStream) return false;

        const matchesSearch = !searchTerm || 
            (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (s.admissionNo && s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        
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
            grade: selectedGrade,
            subject: selectedSubject,
            term: selectedTerm,
            examType: selectedExamType,
            level,
            score,
            academicYear: academicYear,
            date: new Date().toISOString().split('T')[0]
        };
        
        // Track activity
        const action = existing ? 'EDIT' : 'ADD';
        trackActivity(action, newAssessment, existing);
        
        // 1. SAVE LOCALLY FIRST
        const updatedAssessments = [...otherAssessments, newAssessment];
        setData({ ...data, assessments: updatedAssessments });
        console.log('✓ Assessment saved locally:', newAssessment.id, '- Subject:', newAssessment.subject);
        
        // 2. SYNC TO GOOGLE SHEET (fire and forget, don't block)
        if (data.settings?.googleScriptUrl) {
            syncToGoogleSilent(newAssessment).catch(err => {
                console.warn('⚠ Auto-sync failed:', err.message, '- Will retry later');
            });
        }
    };
    
    // Silent async sync - doesn't block UI
    const syncToGoogleSilent = async (assessment) => {
        if (!data.settings?.googleScriptUrl) return;
        
        try {
            googleSheetSync.setSettings(data.settings);
            googleSheetSync.setStudents(data.students || []);
            
            const student = (data.students || []).find(s => 
                String(s.id) === String(assessment.studentId) || 
                String(s.admissionNo) === String(assessment.studentId)
            );
            const enriched = {
                ...assessment,
                studentId: String(student?.id || assessment.studentId || ''),
                studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
                studentName: student?.name || 'Unknown',
                grade: student?.grade || assessment.grade || ''
            };
            
            const result = await googleSheetSync.pushAssessment(enriched);
            if (result.success) {
                console.log('Assessment synced to Google:', assessment.id);
            } else {
                console.warn('Assessment sync returned false:', result.error);
            }
        } catch (err) {
            console.warn('Assessment sync error:', err.message);
            throw err;
        }
    };
    
    const syncToGoogle = async (assessments) => {
        if (!data.settings?.googleScriptUrl) {
            setSyncStatus('Google Sheet not configured');
            return;
        }
        
        setIsSyncing(true);
        setSyncStatus('Syncing to Google Sheet...');
        googleSheetSync.setSettings(data.settings);
        // Set students list for enrichment in sync service
        googleSheetSync.setStudents(data.students || []);
        
        try {
            let successCount = 0;
            let failCount = 0;
            
            for (const assessment of assessments) {
                try {
                    // Enrich assessment with student data before syncing
                    const student = (data.students || []).find(s => 
                        String(s.id) === String(assessment.studentId) || 
                        String(s.admissionNo) === String(assessment.studentId)
                    );
                    const enriched = {
                        ...assessment,
                        // Ensure studentId is always a string
                        studentId: String(student?.id || assessment.studentId || ''),
                        studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
                        studentName: student?.name || assessment.studentName || 'Unknown',
                        grade: student?.grade || assessment.grade || ''
                    };
                    
                    const result = await googleSheetSync.pushAssessment(enriched);
                    if (result.success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (singleErr) {
                    failCount++;
                    console.warn('Single assessment sync failed:', singleErr.message);
                }
            }
            
            setSyncStatus(`✓ Synced: ${successCount} success, ${failCount} failed`);
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('Sync failed - saved locally');
            setTimeout(() => setSyncStatus(''), 3000);
        }
        
        setIsSyncing(false);
    };
    
    const deleteAssessment = async (assessmentId) => {
        if (!confirm('Delete this assessment record?')) return;
        
        const assessmentToDelete = data.assessments.find(a => a.id === assessmentId);
        const updatedAssessments = data.assessments.filter(a => a.id !== assessmentId);
        
        // Track activity before deleting
        if (assessmentToDelete) {
            trackActivity('DELETE', assessmentToDelete);
        }
        
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
    
    const fetchFromGoogle = async () => {
        if (!data.settings.googleScriptUrl) {
            alert('Google Sheet not configured. Go to Settings > Teacher Data Sync.');
            return;
        }
        
        if (!confirm('Fetch assessments from Google Sheet? This will merge with existing data.')) return;
        
        setSyncStatus('Fetching from Google Sheet...');
        setIsSyncing(true);
        googleSheetSync.setSettings(data.settings);
        
        try {
            const result = await googleSheetSync.fetchAll();
            
            if (result.success && result.assessments) {
                // Merge assessments from Google Sheet with local data
                const localAssessments = data.assessments || [];
                const remoteAssessments = result.assessments || [];
                const localStudents = data.students || [];
                
                // Merge, using robust ID matching
                const mergedAssessments = [...localAssessments];
                let addedCount = 0;
                
                remoteAssessments.forEach(remote => {
                    // Normalize the remote assessment
                    const normalizedRemote = {
                        ...remote,
                        studentId: String(remote.studentId || ''),
                        studentAdmissionNo: remote.studentAdmissionNo || '',
                        studentName: remote.studentName || ''
                    };
                    
                    // Check if this assessment already exists locally
                    const exists = mergedAssessments.some(a => 
                        a.id === normalizedRemote.id ||
                        // Match by composite key with flexible ID matching
                        ((
                            String(a.studentId) === String(normalizedRemote.studentId) ||
                            (normalizedRemote.studentAdmissionNo && String(a.studentAdmissionNo || '').toLowerCase() === String(normalizedRemote.studentAdmissionNo || '').toLowerCase()) ||
                            (normalizedRemote.studentName && a.studentName && normalizedRemote.studentName.toLowerCase().trim() === a.studentName.toLowerCase().trim())
                        ) &&
                         a.subject === normalizedRemote.subject && 
                         a.term === normalizedRemote.term && 
                         a.examType === normalizedRemote.examType &&
                         a.academicYear === normalizedRemote.academicYear)
                    );
                    if (!exists) {
                        // Try to match with local students using multiple strategies
                        let matchedStudent = null;
                        
                        // Strategy 1: Match by studentId
                        if (normalizedRemote.studentId) {
                            matchedStudent = localStudents.find(s => 
                                String(s.id) === normalizedRemote.studentId ||
                                String(s.id) === String(Number(normalizedRemote.studentId))
                            );
                        }
                        
                        // Strategy 2: Match by admission number
                        if (!matchedStudent && normalizedRemote.studentAdmissionNo) {
                            matchedStudent = localStudents.find(s => 
                                s.admissionNo && 
                                String(s.admissionNo).toLowerCase() === normalizedRemote.studentAdmissionNo.toLowerCase()
                            );
                        }
                        
                        // Strategy 3: Match by name
                        if (!matchedStudent && normalizedRemote.studentName) {
                            matchedStudent = localStudents.find(s => 
                                s.name && 
                                s.name.toLowerCase().trim() === normalizedRemote.studentName.toLowerCase().trim()
                            );
                        }
                        
                        // Strategy 4: Match by grade + subject + term + exam (if studentId is empty but other data matches)
                        if (!matchedStudent && !normalizedRemote.studentId && !normalizedRemote.studentAdmissionNo) {
                            // Try to find by exact match on other fields
                            const existingByMatch = mergedAssessments.find(a =>
                                a.subject === normalizedRemote.subject &&
                                a.term === normalizedRemote.term &&
                                a.examType === normalizedRemote.examType &&
                                a.academicYear === normalizedRemote.academicYear
                            );
                            if (existingByMatch) {
                                normalizedRemote.studentId = existingByMatch.studentId;
                                normalizedRemote.studentAdmissionNo = existingByMatch.studentAdmissionNo || '';
                            }
                        }
                        
                        mergedAssessments.push({
                            ...normalizedRemote,
                            studentId: matchedStudent?.id || normalizedRemote.studentId || '',
                            studentAdmissionNo: matchedStudent?.admissionNo || normalizedRemote.studentAdmissionNo || '',
                            studentName: matchedStudent?.name || normalizedRemote.studentName || 'Unknown'
                        });
                        addedCount++;
                    }
                });
                
                setData({ ...data, assessments: mergedAssessments });
                setSyncStatus(`✓ Fetched ${addedCount} new assessment(s) from Google`);
            } else {
                setSyncStatus('⚠ Failed to fetch from Google Sheet');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            setSyncStatus('⚠ Fetch failed');
        }
        
        setTimeout(() => { setSyncStatus(''); setIsSyncing(false); }, 3000);
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
                            onClick=${fetchFromGoogle}
                            class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                            title="Fetch assessments from Google Sheet"
                        >
                            <span>↓</span> Pull from Sheet
                        </button>
                        <${PrintButtons} />
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
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Quick Search</label>
                    <div class="relative">
                        <input 
                            type="text"
                            placeholder="Student name..."
                            class="p-3 pl-8 bg-white border border-slate-200 rounded-xl outline-none w-full md:w-48 text-sm"
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
                ${filteredStudents.length === 0 ? html`
                    <div class="p-12 text-center text-slate-400">No students found matching your filters/search.</div>
                ` : html`
                    <div class="divide-y divide-slate-50">
                        ${filteredStudents.map(student => {
                            const assessment = data.assessments.find(a => 
                                (String(a.studentId) === String(student.id) || 
                                 String(a.studentId) === String(student.admissionNo) ||
                                 a.studentAdmissionNo === student.admissionNo) && 
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
                <div class="flex justify-between items-end">
                    <div>
                        <h3 class="text-lg font-bold">Assessment Records (All Entries)</h3>
                        <p class="text-xs text-slate-500">View, edit, and delete all assessment entries</p>
                    </div>
                    <div class="relative no-print">
                        <input 
                            type="text"
                            placeholder="Search records..."
                            class="p-2 pl-8 bg-slate-50 border border-slate-100 rounded-lg outline-none w-64 text-xs font-bold"
                            value=${historySearchTerm}
                            onInput=${(e) => setHistorySearchTerm(e.target.value)}
                        />
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                </div>
                
                <div class="assessments-container overflow-x-auto">
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
                            ${data.assessments
                                .filter(a => {
                                    if (!historySearchTerm) return true;
                                    const s = findStudentForAssessment(a);
                                    const searchLower = historySearchTerm.toLowerCase();
                                    return (s && s.name && s.name.toLowerCase().includes(searchLower)) ||
                                           (a.studentName && a.studentName.toLowerCase().includes(searchLower)) ||
                                           (a.subject && a.subject.toLowerCase().includes(searchLower)) ||
                                           (a.term && a.term.toLowerCase().includes(searchLower));
                                })
                                .length === 0 ? html`
                                    <tr>
                                        <td colspan="7" class="px-4 py-6 text-center text-slate-400">No matching assessment records found</td>
                                    </tr>
                                ` : data.assessments
                                    .filter(a => {
                                        if (!historySearchTerm) return true;
                                        const s = findStudentForAssessment(a);
                                        const searchLower = historySearchTerm.toLowerCase();
                                        return (s && s.name && s.name.toLowerCase().includes(searchLower)) ||
                                               (a.studentName && a.studentName.toLowerCase().includes(searchLower)) ||
                                               (a.subject && a.subject.toLowerCase().includes(searchLower)) ||
                                               (a.term && a.term.toLowerCase().includes(searchLower));
                                    })
                                    .slice().reverse().map(assessment => {
                                        const student = findStudentForAssessment(assessment);
                                        return html`
                                            <tr key=${assessment.id} class="hover:bg-blue-50">
                                                <td class="px-4 py-3">${student?.name || assessment.studentName || 'Unknown'}</td>
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
                                                            // 1. SAVE LOCALLY FIRST
                                                            const updated = {
                                                                ...assessment,
                                                                score: Number(e.target.value),
                                                                level: Storage.getGradeInfo(Number(e.target.value)).level
                                                            };
                                                            const updatedAssessments = data.assessments.map(a => a.id === assessment.id ? updated : a);
                                                            setData({ ...data, assessments: updatedAssessments });
                                                            console.log('Score updated locally:', assessment.id);
                                                            
                                                            // 2. SYNC TO GOOGLE (silent)
                                                            if (data.settings?.googleScriptUrl) {
                                                                syncToGoogleSilent(updated).catch(() => {});
                                                            }
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