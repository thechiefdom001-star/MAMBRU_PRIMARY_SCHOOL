/**
 * Assessment Matrix Component
 * 
 * Displays and manages assessments in a matrix layout:
 * - Each grade has its own view
 * - Subjects are columns
 * - Students are rows
 * - Marks entered at intersections
 */

import { h } from 'preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const AssessmentMatrix = ({ 
  data, 
  setData, 
  isAdmin, 
  teacherSession, 
  allowedSubjects = [], 
  allowedGrades = [],
  allowedReligion = '' 
}) => {
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('T1');
  const [selectedExamType, setSelectedExamType] = useState('Opener');
  const [selectedStream, setSelectedStream] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [cellBeingEdited, setCellBeingEdited] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showGoogleSync, setShowGoogleSync] = useState(false);
  
  const tableRef = useRef(null);

  // Determine available grades
  const allSettingsGrades = data?.settings?.grades || [];
  let availableGrades;
  
  if (isAdmin) {
    availableGrades = allSettingsGrades;
  } else {
    const allowedLower = allowedGrades.map(g => g.toLowerCase());
    availableGrades = allSettingsGrades.filter(g => 
      allowedLower.some(ag => g.toLowerCase().includes(ag) || ag.includes(g.toLowerCase()))
    );
  }

  // Auto-select first grade
  useEffect(() => {
    if (!selectedGrade && availableGrades.length > 0) {
      setSelectedGrade(availableGrades[0]);
    }
  }, [availableGrades, selectedGrade]);

  // Get students for selected grade
  const students = useMemo(() => {
    return (data?.students || [])
      .filter(s => {
        if (!selectedGrade || !s.grade) return false;
        
        const sGrade = String(s.grade).toLowerCase().trim();
        const selGrade = String(selectedGrade).toLowerCase().trim();
        
        // Smart match: exact, or one contains the other (e.g. "Grade 8" vs "Grade 8 North")
        const inGrade = sGrade === selGrade || sGrade.startsWith(selGrade) || selGrade.startsWith(sGrade);
        if (!inGrade) return false;
        
        const inStream = selectedStream === 'ALL' || s.stream === selectedStream;
        if (!inStream) return false;
        
        // Filter by religion if needed
        const matchesReligion = !allowedReligion || !s.religion || (s.religion && s.religion.toLowerCase() === allowedReligion.toLowerCase());
        return matchesReligion;
      })
      .sort((a, b) => String(a.name).localeCompare(b.name));
  }, [data?.students, selectedGrade, selectedStream, allowedReligion]);

  // Get subjects for selected grade
  const subjects = useMemo(() => {
    if (!selectedGrade) return [];
    
    const defaultSubjects = Storage.getSubjectsForGrade(selectedGrade) || [];
    const rawCustom = data?.settings?.gradeSubjects?.[selectedGrade] || '';
    const customSubjects = rawCustom.split(',').map(s => s.trim()).filter(Boolean);
    
    const gradeSubjects = [...new Set([...defaultSubjects, ...customSubjects])];
    
    // Filter by teacher's allowed subjects if not admin
    if (!isAdmin && allowedSubjects.length > 0) {
      const allowedLower = allowedSubjects.map(s => s.toLowerCase());
      return gradeSubjects.filter(s => 
        allowedLower.some(as => s.toLowerCase().includes(as) || as.includes(s.toLowerCase()))
      );
    }
    
    // Filter by religion
    if (allowedReligion) {
      return gradeSubjects.filter(s => {
        if (s.toUpperCase().includes('CRE')) return allowedReligion === 'christian';
        if (s.toUpperCase().includes('IRE')) return allowedReligion === 'islam';
        if (s.toUpperCase().includes('HRE')) return allowedReligion === 'hindu';
        return true;
      });
    }
    
    return gradeSubjects;
  }, [selectedGrade, isAdmin, allowedSubjects, allowedReligion, data?.settings?.gradeSubjects]);

  // Helper: find assessment for a student+subject combo using multi-strategy matching
  const findAssessment = (assessments, student, subject, term, examType, academicYear) => {
    const subjectLower = subject.toLowerCase();
    const studentIdStr = String(student.id || '');
    const studentAdmLower = String(student.admissionNo || '').toLowerCase();
    const studentNameLower = String(student.name || '').toLowerCase();

    return assessments.find(a => {
      // 1. Student matching (ID, Admission No, or Name)
      const studentMatch =
        String(a.studentId) === studentIdStr ||
        String(a.studentId).toLowerCase() === studentAdmLower ||
        (a.studentAdmissionNo && String(a.studentAdmissionNo).toLowerCase() === studentAdmLower) ||
        (a.studentName && String(a.studentName).toLowerCase() === studentNameLower && studentNameLower.length > 2);

      if (!studentMatch) return false;

      // 2. Subject matching (Case-insensitive)
      const subjectMatch = String(a.subject || '').toLowerCase().trim() === subjectLower.trim();
      if (!subjectMatch) return false;

      // 3. Term matching (Relaxed: "T1" should match "Term 1" or "T1")
      const termLower = String(term || '').toLowerCase().trim();
      const aTermLower = String(a.term || '').toLowerCase().trim();
      const termMatch = aTermLower === termLower || 
                       aTermLower.includes(termLower) || 
                       termLower.includes(aTermLower);
      if (!termMatch) return false;

      // 4. Exam Type matching (Relaxed: "Opener" matches "Opener Exams")
      const examLower = String(examType || '').toLowerCase().trim();
      const aExamLower = String(a.examType || '').toLowerCase().trim();
      const examMatch = aExamLower === examLower || 
                       aExamLower.includes(examLower) || 
                       examLower.includes(aExamLower);
      if (!examMatch) return false;

      // 5. Academic year - Priority to student match, don't let a year mismatch hide the data
      // unless specifically asked to filter strictly. For the matrix, we want to see the marks.
      return true;
    });
  };

  // Get assessment matrix data
  const matrixData = useMemo(() => {
    const academicYear = data.settings?.academicYear || '2025/2026';
    const allAssessments = data.assessments || [];
    
    console.log(`[MatrixData] Building matrix for: Grade=${selectedGrade}, Term=${selectedTerm}, ExamType=${selectedExamType}`);
    console.log(`[MatrixData] Academic Year: ${academicYear}`);
    console.log(`[MatrixData] Students: ${students.length}, Subjects: ${subjects.length}`, subjects);
    console.log(`[MatrixData] Total assessments available: ${allAssessments.length}`);
    
    if (allAssessments.length > 0) {
      console.log(`[MatrixData] Sample assessments:`, allAssessments.slice(0, 3));
    }
    
    const matrixRows = students.map((student, studentIdx) => {
      const row = {
        studentId: student.id,
        studentName: student.name,
        scores: {}
      };
      
      subjects.forEach((subject, subjectIdx) => {
        const assessment = findAssessment(allAssessments, student, subject, selectedTerm, selectedExamType, academicYear);
        const score = (assessment?.score !== undefined && assessment?.score !== null) ? assessment.score : '';
        row.scores[subject] = score;
        
        if (studentIdx === 0) {
          // Log first student's matching for debugging
          console.log(`[MatrixData] Student 0 subject "${subject}":`, {
            assessment,
            score,
            searched: {
              studentId: student.id,
              admissionNo: student.admissionNo,
              name: student.name
            }
          });
        }
      });
      
      return row;
    });
    
    const totalScores = matrixRows.reduce((sum, row) => sum + Object.values(row.scores).filter(s => s !== '').length, 0);
    console.log(`[MatrixData] ✓ Built matrix with ${matrixRows.length} students, ${totalScores} total marks`);
    
    return matrixRows;
  }, [data.assessments, data.students, students, subjects, selectedTerm, selectedExamType, data.settings?.academicYear]);

  // Update assessment score
  const updateScore = (studentId, subject, score) => {
    const academicYear = data.settings?.academicYear || '2025/2026';
    const student = students.find(s => s.id === studentId);
    
    if (!student) return;

    // Find existing assessment
    const existing = (data.assessments || []).find(a =>
      String(a.studentId) === String(studentId) &&
      a.subject === subject &&
      a.term === selectedTerm &&
      a.examType === selectedExamType &&
      a.academicYear === academicYear
    );

    // Remove existing
    const otherAssessments = (data.assessments || []).filter(a =>
      !(String(a.studentId) === String(studentId) &&
        a.subject === subject &&
        a.term === selectedTerm &&
        a.examType === selectedExamType &&
        a.academicYear === academicYear)
    );

    // Validate and normalize score
    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      alert('Please enter a valid score between 0 and 100');
      return;
    }

    // Calculate level
    const level = Storage.getGradeInfo(numScore).level;

    // Create new assessment
    const newAssessment = {
      id: existing?.id || ('A-' + Date.now() + Math.random().toString().slice(2, 6)),
      studentId: String(studentId),
      studentAdmissionNo: student.admissionNo || '',
      studentName: student.name || '',
      grade: selectedGrade,
      subject: subject,
      term: selectedTerm,
      examType: selectedExamType,
      level: level,
      score: Math.round(numScore),
      rawScore: Math.round(numScore), // For matrix, raw == percentage
      maxScore: 100,
      academicYear: academicYear,
      date: new Date().toISOString().split('T')[0]
    };

    // Update locally
    const updatedAssessments = [...otherAssessments, newAssessment];
    setData({ ...data, assessments: updatedAssessments });

    // Sync to Google quietly
    if (data.settings?.googleScriptUrl) {
      syncScoreToGoogle(newAssessment).catch(err => {
        console.warn('Auto-sync failed:', err.message);
      });
    }
  };

  // Sync individual score to Google
  const syncScoreToGoogle = async (assessment) => {
    if (!data.settings?.googleScriptUrl) return;
    
    try {
      googleSheetSync.setSettings(data.settings);
      googleSheetSync.setStudents(data.students || []);
      
      const student = (data.students || []).find(s => String(s.id) === String(assessment.studentId));
      const enriched = {
        ...assessment,
        studentId: String(student?.id || assessment.studentId || ''),
        studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
        studentName: student?.name || 'Unknown',
        grade: student?.grade || assessment.grade || ''
      };
      
      await googleSheetSync.pushAssessment(enriched);
      
      // Also update the specific matrix sheet cell dynamically
      try {
        const url = new URL(data.settings.googleScriptUrl);
        url.searchParams.set('action', 'UPDATE_MATRIX_CELL');
        url.searchParams.set('studentId', assessment.studentId);
        url.searchParams.set('subject', assessment.subject);
        url.searchParams.set('score', assessment.score);
        url.searchParams.set('grade', assessment.grade);
        url.searchParams.set('term', assessment.term);
        url.searchParams.set('examType', assessment.examType);
        
        fetch(url.toString(), { method: 'GET', mode: 'cors' })
          .then(r => r.json())
          .then(res => {
            if (res && res.success) console.log('[Matrix] Cell updated in Google Sheet');
            else console.warn('[Matrix] Cell update failed:', res?.error || 'Unknown error');
          })
          .catch(err => {
            console.warn('[Matrix] Cell update error:', err.message);
          });
      } catch (e) {
        console.warn('[Matrix] Dynamic update error:', e.message);
      }
    } catch (err) {
      console.warn('Score sync error:', err.message);
    }
  };

  // Create Google Sheet matrix
  const createGoogleMatrix = async () => {
    if (!data.settings?.googleScriptUrl) {
      alert('Google Sheet not configured');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('Creating matrix sheet...');

    try {
      const url = new URL(data.settings.googleScriptUrl);
      url.searchParams.set('action', 'CREATE_MATRIX');
      url.searchParams.set('grade', selectedGrade);
      url.searchParams.set('term', selectedTerm);
      url.searchParams.set('examType', selectedExamType);
      url.searchParams.set('subjects', JSON.stringify(subjects));

      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors'
      });

      const result = await response.json();

      if (result.success) {
        setSyncStatus(`✓ Matrix created! Open Google Sheet tab: "${result.sheetName}"`);
        setShowGoogleSync(false);
        setTimeout(() => setSyncStatus(''), 5000);
      } else {
        setSyncStatus(`✗ Error: ${result.error}`);
      }
    } catch (err) {
      setSyncStatus(`✗ Failed to create matrix: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync marks back from a Google Sheet matrix tab into the app
  const syncFromGoogleMatrix = async () => {
    if (!data.settings?.googleScriptUrl) {
      alert('Google Sheet not configured');
      return;
    }

    const sheetName = `MX_${selectedGrade}_${selectedTerm}_${selectedExamType}`.replace(/\//g, '-').replace(/\s+/g, '_').substring(0, 31);

    console.log(`[Sync] Starting sync for: ${sheetName}`);
    console.log(`[Sync] Grade: ${selectedGrade}, Term: ${selectedTerm}, ExamType: ${selectedExamType}`);
    console.log(`[Sync] Students available: ${students.length}, Subjects: ${subjects.join(', ')}`);

    if (!confirm(`This will pull marks from the Google Sheet tab "${sheetName}" if it exists.\nIf it doesn't exist, it will pull any marks directly from the main Assessments database instead.\n\nContinue?`)) return;

    setIsSyncing(true);
    setSyncStatus('Syncing marks from Google Sheet...');

    try {
      // Step 1: Tell GAS to convert the matrix sheet into normalized assessment records
      const syncUrl = new URL(data.settings.googleScriptUrl);
      syncUrl.searchParams.set('action', 'SYNC_MATRIX');
      syncUrl.searchParams.set('sheetName', sheetName);
      
      console.log(`[Sync] Calling endpoint: ${syncUrl.toString()}`);
      const syncResp = await fetch(syncUrl.toString(), { method: 'GET', mode: 'cors' });
      
      console.log(`[Sync] Response status: ${syncResp.status} ${syncResp.statusText}`);
      
      let syncResult = { success: true, imported: 0 };
      if (syncResp.ok) {
        const attemptResult = await syncResp.json();
        console.log(`[Sync] Backend response:`, attemptResult);
        
        if (!attemptResult.success) {
          // If the error isn't just a missing sheet, fail out
          if (!attemptResult.error || !attemptResult.error.includes('not found')) {
            setSyncStatus(`✗ Sync failed: ${attemptResult.error}`);
            console.error(`[Sync] Backend error: ${attemptResult.error}`);
            setIsSyncing(false);
            return;
          } else {
            console.log(`[Sync] ${attemptResult.error}. Falling back to master Assessments sheet.`);
          }
        } else {
          syncResult = attemptResult;
          console.log(`[Sync] Sync successful. Imported marker: ${attemptResult.imported}`);
        }
      }

      // Step 2: Use synced records directly if available, otherwise fetch all from master
      let finalAssessmentsToMerge = null;

      if (syncResult && syncResult.assessments && syncResult.assessments.length > 0) {
          finalAssessmentsToMerge = syncResult.assessments;
          console.log(`[Sync] ✓ Got ${finalAssessmentsToMerge.length} records from SYNC response`);
          console.log(`[Sync] Sample records:`, finalAssessmentsToMerge.slice(0, 3));
      } else {
          console.log(`[Sync] No assessments in SYNC response. Fetching full data from master Assessments sheet...`);
          const fetchUrl = new URL(data.settings.googleScriptUrl);
          fetchUrl.searchParams.set('action', 'getAll');
          console.log(`[Sync] Calling getAll: ${fetchUrl.toString()}`);
          
          const fetchResp = await fetch(fetchUrl.toString(), { method: 'GET', mode: 'cors' });
          const fetchResult = await fetchResp.json();
          
          console.log(`[Sync] getAll response:`, fetchResult);
          
          if (fetchResult.success && fetchResult.assessments && fetchResult.assessments.length > 0) {
              finalAssessmentsToMerge = fetchResult.assessments;
              console.log(`[Sync] ✓ Got ${finalAssessmentsToMerge.length} records from getAll`);
              console.log(`[Sync] Sample records:`, finalAssessmentsToMerge.slice(0, 3));
          } else {
              console.warn('[Sync] No assessments returned from backend');
              console.log('[Sync] Full getAll response:', fetchResult);
          }
      }

      if (finalAssessmentsToMerge && finalAssessmentsToMerge.length > 0) {
        console.log(`[Sync] Processing ${finalAssessmentsToMerge.length} remote assessments for merging...`);
        
        // ⭐ NEW LOGIC: Backend returns COMPLETE merged set, so use it directly
        // The backend now returns finalAssessments (all merged records), not parsedAssessments (only new ones)
        // So we should use it as-is instead of trying to merge again with stale local data
        
        const remoteAssessments = finalAssessmentsToMerge.map(a => ({
          ...a,
          studentId: String(a.studentId || ''),
          score: Number(a.score),
          rawScore: Number(a.rawScore || a.score),
          maxScore: Number(a.maxScore || 100)
        })).filter(a => Number.isFinite(a.score) && a.score >= 0);

        console.log(`[Sync] After validation: ${remoteAssessments.length} records ready to use`);
        console.log(`[Sync] Backend returned complete merged set - replacing local data with authoritative remote data`);

        // Simply use the remote assessments as the complete source of truth
        // No need to merge with potentially stale local data
        console.log(`[Sync] Total assessments from backend: ${remoteAssessments.length}`);

        setData({ ...data, assessments: remoteAssessments });
        console.log('[Sync] ✓ setData called - grid will refresh with updated marks from Google Sheet');
        
        // Save to localStorage immediately
        Storage.save({ ...data, assessments: remoteAssessments });
        console.log('[Sync] ✓ Saved to localStorage');
        
        const sourceMessage = syncResult && syncResult.imported > 0 
          ? `✓ Synced ${syncResult.imported} marks from Tab "${sheetName}"!` 
          : `✓ Synced marks from Assessments sheet.`;
        setSyncStatus(`${sourceMessage} Grid updated with latest data.`);
        console.log(`[Sync] ✓ SUCCESS: ${remoteAssessments.length} total marks now visible in matrix`);
      } else {
        setSyncStatus(`✗ No assessments returned from backend. Check console and try again.`);
        console.error('[Sync] No assessment data received from any source');
      }

      setTimeout(() => setSyncStatus(''), 5000);
    } catch (err) {
      setSyncStatus(`✗ Sync failed: ${err.message}`);
      console.error('[Sync] Exception:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle cell click for editing
  const handleCellClick = (studentId, subject, currentValue) => {
    setCellBeingEdited({ studentId, subject });
    setEditValue(String(currentValue));
  };

  // Handle cell input change
  const handleCellChange = (e) => {
    setEditValue(e.target.value);
  };

  // Save edited cell
  const saveCellEdit = () => {
    if (cellBeingEdited) {
      updateScore(cellBeingEdited.studentId, cellBeingEdited.subject, editValue);
      setCellBeingEdited(null);
      setEditValue('');
    }
  };

  // Cancel edit
  const cancelCellEdit = () => {
    setCellBeingEdited(null);
    setEditValue('');
  };

  // Handle keyboard in cell edit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveCellEdit();
    } else if (e.key === 'Escape') {
      cancelCellEdit();
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    let csv = `Grade,${selectedGrade}\nTerm,${selectedTerm}\nExam Type,${selectedExamType}\nDate,${new Date().toLocaleDateString()}\n\n`;
    
    csv += ['Admission No', 'Name', ...subjects].join(',') + '\n';
    
    matrixData.forEach(row => {
      const scores = subjects.map(s => row.scores[s] || '').join(',');
      csv += `${row.studentId},${row.studentName},${scores}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Assessment_${selectedGrade}_${selectedTerm}_${selectedExamType}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
  
  // Import from CSV
  const handleMatrixImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        
        // Robust CSV row split (handles quoted newlines)
        const rows = [];
        let currentRow = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char === '"') inQuotes = !inQuotes;
          if ((char === '\n' || char === '\r') && !inQuotes) {
            if (currentRow.trim()) rows.push(currentRow);
            currentRow = '';
            if (char === '\r' && text[i+1] === '\n') i++; // Skip \n in \r\n
          } else {
            currentRow += char;
          }
        }
        if (currentRow.trim()) rows.push(currentRow);

        if (rows.length === 0) {
          alert('CSV file is empty');
          return;
        }
        
        // Find header row (it's the first one that starts with 'Student ID' or 'ID')
        const headerIndex = rows.findIndex(l => {
          const clean = l.replace(/^"|"$/g, '').toLowerCase();
          return clean.startsWith('student id') || clean.startsWith('id') || clean.includes('admission');
        });

        if (headerIndex === -1) {
          alert('Invalid CSV format. Header row must contain "Student ID" or "ID"');
          return;
        }
        
        // Helper to parse CSV line correctly with quotes and escaped quotes
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') { // Escaped quote ""
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
              continue;
            }
            if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const academicYear = data.settings?.academicYear || '2025/2026';
        let updatedAssessments = [...(data.assessments || [])];
        let updatedStudents = [...(data.students || [])];
        let updatedGradeSubjects = { ...(data.settings?.gradeSubjects || {}) };
        
        const header = parseCSVLine(rows[headerIndex]);
        const headerLower = header.map(h => h.toLowerCase());
        
        // Find special columns
        const gradeCol = headerLower.findIndex(h => h.includes('grade') || h === 'class');
        const termCol = headerLower.findIndex(h => h === 'term' || h.includes('semester'));
        const examCol = headerLower.findIndex(h => h.includes('exam') || h.includes('type') || h === 'exam type');
        const streamCol = headerLower.findIndex(h => h.includes('stream') || h.includes('house'));
        const nameCol = headerLower.findIndex(h => h.includes('name'));
        const idCol = headerLower.findIndex(h => h === 'student id' || h === 'id' || h.includes('admission') || h.includes('admNo'));
        
        // Subjects start from wherever they aren't special
        const specialCols = [idCol >= 0 ? idCol : 0, nameCol >= 0 ? nameCol : 1, gradeCol, termCol, examCol, streamCol].filter(c => c >= 0);
        const importedSubjectsInfo = header.map((name, index) => ({ name: name.trim(), index }))
          .filter(info => !specialCols.includes(info.index) && info.name);

        let importCount = 0;
        let studentCount = 0;
        let newStudentsCount = 0;
        let subjectsAddedCount = 0;
        let skippedRows = [];
        
        console.log('[Import] Subjects detected:', importedSubjectsInfo.map(s => s.name));
        
        // Cache grade configurations using a shared mutable map so additions persist
        const gradeListCache = {};
        const getGradeConfig = (grade) => {
          if (!gradeListCache[grade]) {
            const defaults = Storage.getSubjectsForGrade(grade) || [];
            const raw = updatedGradeSubjects[grade] || '';
            const custom = raw.split(',').map(s => s.trim()).filter(Boolean);
            gradeListCache[grade] = [...new Set([...defaults, ...custom])];
          }
          return gradeListCache[grade]; // Returns same array reference
        };

        // Process data rows
        for (let i = headerIndex + 1; i < rows.length; i++) {
          const rowValues = parseCSVLine(rows[i]);
          if (rowValues.length < 2) continue;

          // 1. Identify Student dynamically
          const actualIdIdx = idCol >= 0 ? idCol : 0;
          let studentIdStr = String(rowValues[actualIdIdx] || '').trim();
          if (studentIdStr.startsWith('=') && studentIdStr.includes('"')) {
            studentIdStr = studentIdStr.replace(/="|"$/g, '');
          }
          if (!studentIdStr) continue;

          // 2. Determine Scope (Grade/Term/Exam) - prefer row values if available
          const rowGrade = gradeCol >= 0 && rowValues[gradeCol] ? rowValues[gradeCol].trim().toUpperCase() : selectedGrade;
          const rowTerm = termCol >= 0 && rowValues[termCol] ? rowValues[termCol].trim() : selectedTerm;
          const rowExam = examCol >= 0 && rowValues[examCol] ? rowValues[examCol].trim() : selectedExamType;
          const rowStream = streamCol >= 0 && rowValues[streamCol] ? rowValues[streamCol].trim() : (selectedStream !== 'ALL' ? selectedStream : '');

          let student = updatedStudents.find(s => 
            String(s.id).trim() === studentIdStr || 
            (s.admissionNo && String(s.admissionNo).trim() === studentIdStr)
          );
          
          if (!student) {
            const actualNameIdx = nameCol >= 0 ? nameCol : 1;
            const studentName = String(rowValues[actualNameIdx] || 'New Student').trim();
            student = {
              id: studentIdStr,
              admissionNo: studentIdStr,
              name: studentName,
              grade: rowGrade,
              stream: rowStream || (data.settings?.streams?.[0] || 'A'),
              religion: allowedReligion || ''
            };
            updatedStudents.push(student);
            newStudentsCount++;
          }

          studentCount++;
          
          // 3. Process each subject mark
          importedSubjectsInfo.forEach(subInfo => {
            let scoreVal = rowValues[subInfo.index];
            if (scoreVal === undefined || scoreVal === null) return;
            
            // Comprehensive cleaning for numeric values
            scoreVal = String(scoreVal).replace(/[%\s]/g, '');
            if (scoreVal.includes('/')) { // Handle fractions like "45/50"
              const parts = scoreVal.split('/');
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] > 0) {
                scoreVal = (Number(parts[0]) / Number(parts[1])) * 100;
              }
            }
            
            // Ensure subject exists in that specific row's grade configuration
            const gradeList = getGradeConfig(rowGrade);
            let targetSubject = gradeList.find(s => s.toLowerCase() === subInfo.name.toLowerCase());
            
            if (!targetSubject) {
              // Auto-add subject to the specific grade detected for this row
              gradeList.push(subInfo.name);
              updatedGradeSubjects[rowGrade] = gradeList.join(', ');
              targetSubject = subInfo.name;
              subjectsAddedCount++;
            }

            // Strip any Excel formula wrappers from score
            let scoreStr = String(scoreVal).replace(/[%\s]/g, '').replace(/^="?|"?$/g, '');
            let numScore = NaN;

            if (scoreStr.includes('/')) {
              // Handle raw fractions like "45/50" -> convert to percentage
              const parts = scoreStr.split('/');
              const num = Number(parts[0]), den = Number(parts[1]);
              if (!isNaN(num) && !isNaN(den) && den > 0) {
                numScore = Math.round((num / den) * 100);
              }
            } else {
              numScore = Number(scoreStr);
              // If score is in raw marks style (>100), treat as raw/maxScore percentage
              // We just clamp it to 0-100 as a percentage
              if (numScore > 100) numScore = 100;
            }

            if (scoreStr === '' || scoreStr === '-') return; // Skip empty cells
            if (isNaN(numScore) || numScore < 0) return;     // Skip invalid
            // Find existing with multi-strategy matching
            const studentAdmLower = String(student.admissionNo || '').toLowerCase();
            const existingIdx = updatedAssessments.findIndex(a => {
              const idMatch =
                String(a.studentId) === String(student.id) ||
                String(a.studentId).toLowerCase() === studentAdmLower ||
                (a.studentAdmissionNo && String(a.studentAdmissionNo).toLowerCase() === studentAdmLower);
              return idMatch &&
                     String(a.subject).toLowerCase() === targetSubject.toLowerCase() &&
                     a.term === rowTerm &&
                     a.examType === rowExam &&
                     (!a.academicYear || a.academicYear === academicYear);
            });

            const newAssessment = {
              id: (existingIdx > -1) ? updatedAssessments[existingIdx].id : ('A-' + Date.now() + Math.random().toString().slice(2, 6)),
              studentId: String(student.id),
              studentAdmissionNo: student.admissionNo || '',
              studentName: student.name || '',
              grade: student.grade || rowGrade,
              subject: targetSubject,
              term: rowTerm,
              examType: rowExam,
              level: Storage.getGradeInfo(numScore).level,
              score: Math.round(numScore),
              rawScore: Math.round(numScore),
              maxScore: 100,
              academicYear: academicYear,
              date: new Date().toISOString().split('T')[0]
            };
            
            if (existingIdx > -1) updatedAssessments[existingIdx] = newAssessment;
            else updatedAssessments.push(newAssessment);
            
            importCount++;
            
            if (data.settings?.googleScriptUrl) {
              syncScoreToGoogle(newAssessment).catch(() => {});
            }
          });
        }
        
        setData({ 
          ...data, 
          assessments: updatedAssessments, 
          students: updatedStudents,
          settings: { ...data.settings, gradeSubjects: updatedGradeSubjects }
        });
        
        let summary = `Import Complete! \n\n• Imported ${importCount} marks \n• Processed ${studentCount} students`;
        if (newStudentsCount > 0) summary += `\n• Created ${newStudentsCount} new student records`;
        if (subjectsAddedCount > 0) summary += `\n• Added ${subjectsAddedCount} missing subjects to grades`;
        
        alert(summary + "\n\nNote: If some marks aren't visible, check that you have the correct Term and Exam Type selected in the dropdowns.");
        
      } catch (err) {
        console.error('[Import] Critical Error:', err);
        alert('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };


  const streams = data?.settings?.streams || [];

  return html`
    <div class="p-6 max-w-full">
      <!-- Print Header (only visible on paper) -->
      <div class="print-only mb-8 text-center border-b-2 border-slate-900 pb-6">
          <div class="flex flex-col items-center">
              <img src="${data.settings?.schoolLogo || ''}" class="w-24 h-24 mb-3 object-contain" alt="Logo" />
              <h1 class="text-3xl font-black uppercase text-slate-900">${data.settings?.schoolName || 'EDU-TRACK SCHOOL'}</h1>
              <div class="flex gap-4 mt-2 text-sm font-bold text-slate-600 uppercase justify-center">
                  <span>${selectedGrade}</span>
                  <span>•</span>
                  <span>${selectedTerm}</span>
                  <span>•</span>
                  <span>${selectedExamType}</span>
              </div>
              <div class="mt-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">
                  Academic Year: ${data.settings?.academicYear || '2025/2026'}
              </div>
          </div>
      </div>

      <!-- Header -->
      <div class="mb-8 flex justify-between items-start no-print">
        <div>
          <h1 class="text-4xl font-bold text-slate-900 mb-2">📊 Assessment Matrix</h1>
          <p class="text-slate-600">Enter marks directly in the table - subjects are columns, students are rows</p>
        </div>
        <${PrintButtons} />
      </div>

      <!-- Controls Row -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 no-print">
        <!-- Grade Select -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Grade/Class</label>
          <select 
            value=${selectedGrade}
            onChange=${(e) => setSelectedGrade(e.target.value)}
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ${availableGrades.map(grade => html`
              <option value=${grade}>${grade}</option>
            `)}
          </select>
        </div>

        <!-- Streams Select (if available) -->
        ${streams.length > 0 ? html`
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Stream</label>
            <select 
              value=${selectedStream}
              onChange=${(e) => setSelectedStream(e.target.value)}
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Streams</option>
              ${streams.map(stream => html`
                <option value=${stream}>${stream}</option>
              `)}
            </select>
          </div>
        ` : ''}

        <!-- Term Select -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Term</label>
          <select 
            value=${selectedTerm}
            onChange=${(e) => setSelectedTerm(e.target.value)}
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="T1">Term 1</option>
            <option value="T2">Term 2</option>
            <option value="T3">Term 3</option>
          </select>
        </div>

        <!-- Exam Type Select -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Exam Type</label>
          <select 
            value=${selectedExamType}
            onChange=${(e) => setSelectedExamType(e.target.value)}
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="Opener">Opener</option>
            <option value="Mid-Term">Mid-Term</option>
            <option value="End-Term">End-Term</option>
          </select>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 items-end">
          <button
            onClick=${exportToCSV}
            class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-1"
            title="Download CSV"
          >
            📥 Export
          </button>
          <label class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition cursor-pointer flex items-center justify-center gap-1" title="Import from CSV/Excel">
            📤 Import
            <input type="file" accept=".csv" onChange=${handleMatrixImport} class="hidden" />
          </label>
          ${isAdmin ? html`
            <button
              onClick=${() => setShowGoogleSync(!showGoogleSync)}
              class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1"
              title="Create matrix in Google Sheets"
            >
              ☁️ Sheet
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Google Sync Status -->
      ${syncStatus ? html`
        <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg no-print">
          <p class="text-blue-800">${syncStatus}</p>
        </div>
      ` : ''}

      <!-- Diagnostic Info (Show what data is loaded) -->
      <div class="mb-4 p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-700 no-print">
        <details class="cursor-pointer">
          <summary class="font-semibold hover:text-slate-900">📋 Data Status</summary>
          <div class="mt-2 space-y-1 font-mono">
            <div>Total Assessments: <span class="font-bold text-blue-600">${(data.assessments || []).length}</span></div>
            <div>Total Students: <span class="font-bold text-green-600">${(data.students || []).length}</span></div>
            <div>Selected Grade: <span class="font-bold text-purple-600">${selectedGrade}</span></div>
            <div>Students in ${selectedGrade}: <span class="font-bold text-orange-600">${students.length}</span></div>
            <div>Subjects: <span class="font-bold text-indigo-600">${subjects.length}</span> (${subjects.join(', ')})</div>
            <div>Matrix Rows (with any marks): <span class="font-bold text-red-600">${matrixData.length}</span></div>
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #ccc">
              🔍 Open browser console (F12) and filter logs by "[Sync]" or "[MatrixData]" for detailed debug info during sync
            </div>
          </div>
        </details>
      </div>

      <!-- Google Sheet Creation & Sync Panel -->
      ${showGoogleSync ? html`
        <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg no-print">
          <h3 class="font-bold text-amber-900 mb-3">Google Sheets Matrix Workflow</h3>
          <p class="text-sm text-amber-800 mb-2">
            1. First, <strong>Create Matrix</strong> to generate a custom spreadsheet tab for <strong>${selectedGrade}</strong> - <strong>${selectedTerm}</strong> - <strong>${selectedExamType}</strong>.
          </p>
          <p class="text-sm text-amber-800 mb-4">
            2. Then, enter the marks directly inside Google Sheets. Finally, come back here and click <strong>Sync Marks from Sheet</strong>.
          </p>
          
          <div class="flex gap-2">
            <button
              onClick=${createGoogleMatrix}
              disabled=${isSyncing}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-opacity-50 transition"
            >
              ${isSyncing ? '⏳ Working...' : '✓ Create Matrix Tab'}
            </button>
            <button
              onClick=${syncFromGoogleMatrix}
              disabled=${isSyncing}
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-opacity-50 transition flex items-center gap-1"
            >
              ⬇️ Sync Marks from Sheet
            </button>
            <button
              onClick=${() => setShowGoogleSync(false)}
              class="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Matrix Table -->
      <div class="overflow-x-auto border border-slate-200 rounded-lg shadow-sm" ref=${tableRef}>
        ${subjects.length === 0 ? html`
          <div class="p-8 text-center bg-slate-50">
            <p class="text-slate-600">No subjects found for this grade</p>
          </div>
        ` : matrixData.length === 0 ? html`
          <div class="p-8 text-center bg-slate-50">
            <p class="text-slate-600">No students in this grade/stream</p>
          </div>
        ` : html`
          <table class="w-full border-collapse">
            <!-- Header Row -->
            <thead>
              <tr class="bg-blue-600 text-white sticky top-0">
                <th class="border border-slate-300 px-4 py-3 text-left font-semibold w-24">Student ID</th>
                <th class="border border-slate-300 px-4 py-3 text-left font-semibold min-w-28">Student Name</th>
                ${subjects.map(subject => html`
                  <th class="border border-slate-300 px-4 py-3 text-center font-semibold min-w-24 whitespace-nowrap bg-blue-700">
                    ${subject}
                  </th>
                `)}
              </tr>
            </thead>
            <!-- Data Rows -->
            <tbody>
              ${matrixData.map((row, idx) => html`
                <tr class=${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td class="border border-slate-300 px-4 py-3 font-mono text-sm text-slate-700">
                    ${row.studentId}
                  </td>
                  <td class="border border-slate-300 px-4 py-3 font-medium text-slate-900">
                    ${row.studentName}
                  </td>
                  ${subjects.map(subject => {
                    const isEditing = cellBeingEdited?.studentId === row.studentId && cellBeingEdited?.subject === subject;
                    const value = row.scores[subject];
                    
                    return html`
                      <td 
                        class="border border-slate-300 px-2 py-2 text-center cursor-pointer hover:bg-blue-100 transition"
                        onClick=${() => handleCellClick(row.studentId, subject, value)}
                      >
                        ${isEditing ? html`
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value=${editValue}
                            onChange=${handleCellChange}
                            onKeyDown=${handleKeyDown}
                            onBlur=${saveCellEdit}
                            class="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                        ` : html`
                          <span class="text-slate-900 font-medium">
                            ${value !== '' && value !== null && value !== undefined ? value : '-'}
                          </span>
                        `}
                      </td>
                    `;
                  })}
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>

      <!-- Summary Stats -->
      ${matrixData.length > 0 && subjects.length > 0 ? html`
        <div class="mt-6 grid grid-cols-4 gap-4">
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-sm text-blue-600">Total Students</p>
            <p class="text-2xl font-bold text-blue-900">${matrixData.length}</p>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <p class="text-sm text-green-600">Subjects</p>
            <p class="text-2xl font-bold text-green-900">${subjects.length}</p>
          </div>
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p class="text-sm text-purple-600">Total Marks Entered</p>
            <p class="text-2xl font-bold text-purple-900">
              ${matrixData.reduce((sum, row) => sum + subjects.filter(s => row.scores[s]).length, 0)}
            </p>
          </div>
          <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p class="text-sm text-orange-600">Average Coverage</p>
            <p class="text-2xl font-bold text-orange-900">
              ${((matrixData.reduce((sum, row) => sum + subjects.filter(s => row.scores[s]).length, 0) / (matrixData.length * subjects.length)) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      ` : ''}
    </div>
  `;
};
