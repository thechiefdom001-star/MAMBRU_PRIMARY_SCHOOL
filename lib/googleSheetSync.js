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
            
            const response = await fetch(url.toString());
            const text = await response.text();
            
            try {
                const data = JSON.parse(text);
                
                // Clean corrupted selectedFees data (Java object references)
                if (data.students && Array.isArray(data.students)) {
                    data.students = data.students.map(s => {
                        if (s.selectedFees && typeof s.selectedFees === 'string') {
                            if (s.selectedFees.includes('java.lang.Object') || s.selectedFees.startsWith('[L')) {
                                s.selectedFees = 't1,t2,t3';
                            }
                        }
                        return s;
                    });
                }
                
                return {
                    success: true,
                    students: data.students || [],
                    assessments: data.assessments || [],
                    attendance: data.attendance || []
                };
            } catch (e) {
                console.warn('Parse error:', e.message);
                return { success: false, error: 'Invalid response from Google' };
            }
        } catch (error) {
            console.warn('Fetch error:', error.message);
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
            // Use GET request with encoded data (more reliable for Apps Script)
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'addAssessment');
            url.searchParams.set('data', JSON.stringify({ assessment }));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });
            
            const text = await response.text();
            
            try {
                const result = JSON.parse(text);
                if (result.success) {
                    return { 
                        success: true, 
                        message: result.message || 'Saved to Google Sheet',
                        updatedData: result.updatedAssessment || {}
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

    async bulkPushStudents(students) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'bulkPushStudents');
            
            const response = await fetch(url.toString(), {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({ students })
            });
            const text = await response.text();
            
            if (response.ok && (text.includes('success') || text.includes('added') || text.includes('updated'))) {
                return { success: true, count: students.length, message: `Bulk pushed ${students.length} students` };
            }
            return { success: false, error: `Unexpected response` };
        } catch (error) {
            console.error('bulkPushStudents error:', error);
            return { success: false, error: error.message };
        }
    }

    async bulkPushAssessments(assessments) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'bulkPushAssessments');
            
            const response = await fetch(url.toString(), {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({ assessments })
            });
            const text = await response.text();
            
            if (response.ok) {
                return { success: true, count: assessments.length, message: `Bulk pushed ${assessments.length} assessments` };
            }
            return { success: false, error: `Unexpected response` };
        } catch (error) {
            console.error('bulkPushAssessments error:', error);
            return { success: false, error: error.message };
        }
    }

    async bulkPushAttendance(attendance) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'bulkPushAttendance');
            
            const response = await fetch(url.toString(), {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({ attendance })
            });
            const text = await response.text();
            
            if (response.ok) {
                return { success: true, count: attendance.length, message: `Bulk pushed ${attendance.length} records` };
            }
            return { success: false, error: `Unexpected response` };
        } catch (error) {
            console.error('bulkPushAttendance error:', error);
            return { success: false, error: error.message };
        }
    }

    async pushStudentsInParallel(students, batchSize = 5) {
        if (!students || students.length === 0) {
            return { success: true, count: 0 };
        }

        const results = [];
        // Push in batches to avoid overwhelming the server
        for (let i = 0; i < students.length; i += batchSize) {
            const batch = students.slice(i, i + batchSize);
            const batchPromises = batch.map(s => this.pushStudent(s));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        const successCount = results.filter(r => r.success).length;
        return { success: successCount === students.length, count: successCount, total: students.length };
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

            // Push all students
            if (studentCount > 0) {
                const result = await this.replaceAllRecords('Students', localData.students, STUDENT_HEADERS);
                results.push(`Students: ${result.success ? result.count : 'Failed'}`);
            }

            // Push all assessments
            if (assessmentCount > 0) {
                const result = await this.replaceAllRecords('Assessments', localData.assessments, ASSESSMENT_HEADERS);
                results.push(`Assessments: ${result.success ? result.count : 'Failed'}`);
            }

            // Push attendance
            if (attendanceCount > 0) {
                const result = await this.replaceAllRecords('Attendance', localData.attendance, ATTENDANCE_HEADERS);
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
                body: payload
            });
            
            if (!response.ok) {
                return { success: false, error: 'HTTP ' + response.status + ': ' + response.statusText };
            }
            
            const text = await response.text();
            
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

    // Track this device as active
    async setActive(deviceName = 'Admin') {
        if (!this.isConfigured()) return { success: false };

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'setActive');
            url.searchParams.set('device', deviceName);
            url.searchParams.set('timestamp', Date.now().toString());

            const response = await fetch(url.toString());
            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('setActive error:', error);
            return { success: false };
        }
    }

    // Get active users info
    async getActiveUsers() {
        if (!this.isConfigured()) return { success: false, activeCount: 0, activeUsers: [] };

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getActiveUsers');

            const response = await fetch(url.toString());
            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('getActiveUsers error:', error);
            return { success: false, activeCount: 0, activeUsers: [] };
        }
    }

    async setActiveUser(deviceName) {
        if (!this.isConfigured()) return { success: false };

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'setActive');
            url.searchParams.set('device', deviceName);
            url.searchParams.set('timestamp', Date.now().toString());

            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });
            const text = await response.text();
            
            // Parse response or treat success if response is ok
            try {
                const data = JSON.parse(text);
                return data;
            } catch (parseError) {
                return { success: response.ok };
            }
        } catch (error) {
            console.warn('setActiveUser error:', error);
            return { success: false };
        }
    }
}

export const googleSheetSync = new GoogleSheetSync();
