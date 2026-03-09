// Google Sheet Sync Service
// Handles data synchronization between EduTrack and Google Sheets

const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];

class GoogleSheetSync {
    constructor() {
        this.settings = {};
    }

    setSettings(settings) {
        this.settings = settings;
    }

    isConfigured() {
        return this.settings.googleScriptUrl && this.settings.googleScriptUrl.includes('script.google.com');
    }

    async ping() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'ping');
            
            const response = await fetch(url.toString());
            const data = await response.json();
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async fetchAll() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getAll');
            
            console.log('Fetching from Google:', url.toString());
            const response = await fetch(url.toString());
            const text = await response.text();
            
            console.log('Fetch response:', text.substring(0, 300));
            
            try {
                const data = JSON.parse(text);
                return {
                    success: true,
                    students: data.students || [],
                    assessments: data.assessments || [],
                    attendance: data.attendance || []
                };
            } catch (e) {
                console.log('Parse error, response was:', text.substring(0, 200));
                return { success: false, error: 'Invalid response from Google' };
            }
        } catch (error) {
            console.log('Fetch error:', error.message);
            return { success: false, error: error.message };
        }
    }

    async fetchAssessments(term, grade) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getAssessments');
            if (term) url.searchParams.set('term', term);
            if (grade) url.searchParams.set('grade', grade);
            
            const response = await fetch(url.toString());
            const data = await response.json();
            
            return {
                success: true,
                assessments: data.assessments || []
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async pushAssessment(assessment) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            console.log('Pushing assessment to Google:', assessment);
            
            // Use GET request with encoded data (more reliable for Apps Script)
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'addAssessment');
            url.searchParams.set('data', JSON.stringify({ assessment }));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });
            
            console.log('Response status:', response.status);
            const text = await response.text();
            console.log('Response:', text.substring(0, 300));
            
            try {
                const result = JSON.parse(text);
                if (result.success) {
                    // Return success with any updated data from Google
                    return { 
                        success: true, 
                        message: result.message || 'Saved to Google Sheet',
                        updatedData: result.updatedAssessment || {} // Google might return updated data
                    };
                }
            } catch (parseError) {
                // If JSON parsing fails, check for success indicators in text
                if (response.ok && (text.includes('success') || text.includes('added'))) {
                    return { success: true, message: 'Saved to Google Sheet' };
                }
            }
            
            return { success: false, error: 'Failed to save to Google Sheet' };
        } catch (error) {
            console.error('Push error:', error);
            return { success: false, error: error.message };
        }
    }

    async pushBulkAssessments(assessments) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const response = await fetch(this.settings.googleScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'bulkAddAssessments',
                    assessments: assessments
                })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async pushStudent(student) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'addStudent');
            url.searchParams.set('data', JSON.stringify({ student }));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });
            const text = await response.text();
            if (response.ok && (text.includes('success') || text.includes('added'))) {
                return { success: true, message: 'Student added to Google Sheet' };
            }
            // treat non-OK or unexpected text as error
            return { success: false, error: `Unexpected response: ${text}` };
        } catch (error) {
            console.error('pushStudent error:', error);
            return { success: false, error: error.message };
        }
    }

    async pushAttendance(attendance) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const response = await fetch(this.settings.googleScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'addAttendance',
                    attendance: attendance
                })
            });
            
            if (!response.ok) {
                const text = await response.text();
                return { success: false, error: `HTTP ${response.status}: ${text}` };
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('pushAttendance error:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteAssessment(recordId) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'deleteAssessment');
            url.searchParams.set('data', JSON.stringify({ recordId }));
            
            const response = await fetch(url.toString());
            return { success: true, message: 'Deleted' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Sync local data TO Google Sheet
    async syncToGoogle(localData) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const results = [];
            const studentCount = localData.students?.length || 0;
            const assessmentCount = localData.assessments?.length || 0;
            const attendanceCount = localData.attendance?.length || 0;

            console.log('Pushing to Google Sheet:', { studentCount, assessmentCount, attendanceCount });

            // Push all students
            if (studentCount > 0) {
                console.log('Pushing students...', localData.students.slice(0, 2));
                const result = await this.replaceAllRecords('Students', localData.students, STUDENT_HEADERS);
                console.log('Students result:', result);
                results.push(`Students: ${result.success ? result.count : 'Failed'}`);
            }

            // Push all assessments
            if (assessmentCount > 0) {
                console.log('Pushing assessments...', localData.assessments.slice(0, 2));
                const result = await this.replaceAllRecords('Assessments', localData.assessments, ASSESSMENT_HEADERS);
                console.log('Assessments result:', result);
                results.push(`Assessments: ${result.success ? result.count : 'Failed'}`);
            }

            // Push attendance
            if (attendanceCount > 0) {
                console.log('Pushing attendance...');
                const result = await this.replaceAllRecords('Attendance', localData.attendance, ATTENDANCE_HEADERS);
                console.log('Attendance result:', result);
                results.push(`Attendance: ${result.success ? result.count : 'Failed'}`);
            }

            return { success: true, message: results.join(', '), counts: { studentCount, assessmentCount, attendanceCount } };
        } catch (error) {
            console.error('Sync error:', error);
            return { success: false, error: error.message };
        }
    }

    async replaceAllRecords(sheetName, records, headers) {
        try {
            const url = this.settings.googleScriptUrl;
            console.log('Pushing to:', url);
            
            // Create JSONP-style request using no-cors mode
            const payload = JSON.stringify({
                action: 'replaceAll',
                sheetName: sheetName,
                records: records,
                headers: headers
            });
            
            // Try with no-cors mode first (won't get response but should work)
            // But we need response, so use regular fetch
            const response = await fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: payload
            });
            
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            if (!response.ok) {
                return { success: false, error: 'HTTP ' + response.status + ': ' + response.statusText };
            }
            
            const text = await response.text();
            console.log('Response length:', text.length);
            
            if (!text || text.trim() === '') {
                return { success: true, message: 'Request sent (no response)' };
            }
            
            try {
                const data = JSON.parse(text);
                return data;
            } catch (e) {
                return { success: true, message: 'Data sent, response: ' + text.substring(0, 100) };
            }
        } catch (error) {
            console.error('Replace error:', error);
            // If CORS error, try with GET approach
            if (error.message && error.message.includes('CORS')) {
                return { success: false, error: 'CORS error. Enable CORS in script or use a proxy.' };
            }
            return { success: false, error: error.message };
        }
    }

    // Sync FROM Google Sheet to local storage
    async syncFromGoogle() {
        const result = await this.fetchAll();
        
        if (!result.success) {
            return result;
        }

        return {
            success: true,
            data: {
                students: result.students || [],
                assessments: result.assessments || [],
                attendance: result.attendance || []
            }
        };
    }

    // Pull from Google Sheet - only add NEW records, don't touch existing
    async pullFromGoogle(localData) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            // Get Google Sheet data
            const googleResult = await this.fetchAll();
            if (!googleResult.success) {
                return googleResult;
            }

            const googleStudents = googleResult.students || [];
            const googleAssessments = googleResult.assessments || [];
            const googleAttendance = googleResult.attendance || [];

            const localStudents = localData.students || [];
            const localAssessments = localData.assessments || [];
            const localAttendance = localData.attendance || [];

            // Find only NEW students (by admissionNo - don't duplicate)
            const localStudentIds = new Set(localStudents.map(s => s.admissionNo));
            const newStudents = googleStudents.filter(gs => !localStudentIds.has(gs.admissionNo));
            
            // Find only NEW assessments (don't duplicate by unique combo)
            const newAssessments = googleAssessments.filter(ga => {
                return !localAssessments.some(la => 
                    la.studentId === ga.studentId && 
                    la.subject === ga.subject && 
                    la.term === ga.term && 
                    la.examType === ga.examType &&
                    la.academicYear === ga.academicYear
                );
            });

            // Find only NEW attendance records
            const newAttendance = googleAttendance.filter(ga => {
                return !localAttendance.some(la => 
                    la.studentId === ga.studentId && 
                    la.date === ga.date
                );
            });

            // Merge: keep local + add new from Google
            const mergedStudents = [...localStudents, ...newStudents];
            const mergedAssessments = [...localAssessments, ...newAssessments];
            const mergedAttendance = [...localAttendance, ...newAttendance];

            console.log('Sync result:', {
                newStudents: newStudents.length,
                newAssessments: newAssessments.length,
                newAttendance: newAttendance.length
            });

            return {
                success: true,
                data: {
                    students: mergedStudents,
                    assessments: mergedAssessments,
                    attendance: mergedAttendance
                },
                stats: {
                    newStudents: newStudents.length,
                    newAssessments: newAssessments.length,
                    newAttendance: newAttendance.length,
                    totalStudents: mergedStudents.length,
                    totalAssessments: mergedAssessments.length
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Two-way sync (kept for backward compatibility)
    async twoWaySync(localData) {
        return this.pullFromGoogle(localData);
    }

    // Merge two arrays by ID, keeping the newer version
    mergeById(local, remote) {
        const merged = new Map();

        // Add all local items
        local.forEach(item => {
            if (item.id) {
                merged.set(item.id, { ...item, source: 'local' });
            }
        });

        // Merge remote items (overwrite if newer)
        remote.forEach(item => {
            if (item.id) {
                const existing = merged.get(item.id);
                if (!existing) {
                    merged.set(item.id, { ...item, source: 'google' });
                }
                // Could add timestamp comparison here for true "newer wins"
            }
        });

        return Array.from(merged.values());
    }
}

export const googleSheetSync = new GoogleSheetSync();
