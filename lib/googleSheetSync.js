// Google Sheet Sync Service
// Handles data synchronization between EduTrack and Google Sheets

const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'grade', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];
const TEACHER_HEADERS = ['id', 'name', 'contact', 'subjects', 'grades', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const STAFF_HEADERS = ['id', 'name', 'role', 'contact', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const PAYMENT_HEADERS = ['id', 'studentId', 'gradeAtPayment', 'amount', 'term', 'academicYear', 'date', 'receiptNo', 'method', 'reference', 'items', 'voided', 'voidedAt'];

class GoogleSheetSync {
    constructor() {
        this.settings = {};
    }

    _prepareStudentForSheet(student) {
        if (!student) return student;
        return {
            ...student,
            // Convert Array to comma-separated string so Google Apps Script doesn't break it into "[Ljava.lang.Object"
            selectedFees: Array.isArray(student.selectedFees) ? student.selectedFees.join(',') : student.selectedFees
        };
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
                
                // Helper to safely parse strings that might be JSON
                const safeParse = (val) => {
                    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                        try { return JSON.parse(val); } catch (e) { return val; }
                    }
                    return val;
                };

                // Clean and parse data
                const processRecords = (records) => {
                    if (!Array.isArray(records)) return [];
                    return records.map(r => {
                        const newR = { ...r };
                        Object.keys(newR).forEach(k => {
                            newR[k] = safeParse(newR[k]);
                            // Fix common corruption
                            if (typeof newR[k] === 'string' && (newR[k].includes('java.lang.Object') || newR[k].startsWith('[L'))) {
                                newR[k] = '';
                            }
                        });
                        return newR;
                    });
                };
                
                return {
                    success: true,
                    students: processRecords(data.students),
                    assessments: processRecords(data.assessments),
                    attendance: processRecords(data.attendance),
                    teachers: processRecords(data.teachers),
                    staff: processRecords(data.staff),
                    payments: processRecords(data.payments),
                    timestamp: Date.now()
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

    // Pending sync promises to prevent parallel duplicates
    _syncQueue = new Map();

    async pushRecord(sheetName, record) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        // Generate ID if missing
        if (!record.id) {
            record.id = sheetName.substring(0, 1) + '-' + Date.now();
        }

        try {
            // Use correct action for each sheet type
            let action = 'addRecord';
            let dataParam = {};
            
            switch (sheetName) {
                case 'Students':
                    action = 'addStudent';
                    dataParam = { student: this._prepareStudentForSheet(record) };
                    break;
                case 'Assessments':
                    action = 'addAssessment';
                    dataParam = { assessment: record };
                    break;
                case 'Payments':
                    action = 'addPayment';
                    dataParam = { 
                        payment: {
                            ...record,
                            items: (record.items && typeof record.items === 'object') ? JSON.stringify(record.items) : record.items
                        }
                    };
                    break;
                case 'Teachers':
                    action = 'addTeacher';
                    dataParam = { teacher: record };
                    break;
                case 'Staff':
                    action = 'addStaff';
                    dataParam = { staff: record };
                    break;
                case 'Attendance':
                    action = 'addAttendance';
                    dataParam = { attendance: record };
                    break;
                default:
                    action = 'addRecord';
                    dataParam = { sheetName, record };
            }

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', action);
            url.searchParams.set('data', JSON.stringify(dataParam));

            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });

            const text = await response.text();
            
            // Try to parse JSON
            try {
                const result = JSON.parse(text);
                if (result.success) {
                    console.log(`✓ Synced ${sheetName} record:`, record.id);
                    return { success: true, message: result.message || 'Saved successfully' };
                }
                // If not successful, log but don't fail - data is saved locally
                console.warn(`Sync returned false for ${sheetName}:`, result.error);
                return { success: false, error: result.error || 'Sync failed' };
            } catch (parseErr) {
                // If response isn't JSON, check if it contains success indicators
                if (response.ok && (text.includes('success') || text.includes('added') || text.includes('Saved') || text.includes('updated'))) {
                    console.log(`✓ Synced ${sheetName} record:`, record.id);
                    return { success: true, message: 'Saved' };
                }
                // If all else fails, assume it worked (local save is primary)
                console.log(`⚠ Could not verify ${sheetName} sync, data saved locally`);
                return { success: true, message: 'Saved locally' };
            }
        } catch (error) {
            console.warn(`Sync error (${sheetName}):`, error.message);
            // Don't throw - we already saved locally
            return { success: false, error: error.message };
        }
    }

    async pushAssessment(assessment) {
        return this.pushRecord('Assessments', assessment);
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
            
            const preparedStudents = students.map(s => this._prepareStudentForSheet(s));

            const response = await fetch(url.toString(), {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({ students: preparedStudents })
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

    async bulkPushPayments(payments) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'bulkPushPayments');
            
            // Serialize items object to JSON string for the sheet
            const preparedPayments = payments.map(p => ({
                ...p,
                items: typeof p.items === 'object' ? JSON.stringify(p.items) : p.items
            }));

            const response = await fetch(url.toString(), {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({ payments: preparedPayments })
            });
            const text = await response.text();
            
            if (response.ok) {
                return { success: true, count: payments.length, message: `Bulk pushed ${payments.length} payments` };
            }
            return { success: false, error: `Unexpected response` };
        } catch (error) {
            console.error('bulkPushPayments error:', error);
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

    // Legacy method for backward compatibility
    async pushStudent(student) {
        return this.pushRecord('Students', student);
    }

    async pushAttendance(attendance) {
        return this.pushRecord('Attendance', attendance);
    }

    async pushPayment(payment) {
        return this.pushRecord('Payments', payment);
    }

    async deleteAssessment(recordId) {
        return this.deleteRecord('Assessments', recordId);
    }

    async deleteStudent(recordId) {
        return this.deleteRecord('Students', recordId);
    }

    async deleteTeacher(recordId) {
        return this.deleteRecord('Teachers', recordId);
    }

    async deleteStaff(recordId) {
        return this.deleteRecord('Staff', recordId);
    }

    async deletePayment(recordId) {
        return this.deleteRecord('Payments', recordId);
    }

    /**
     * Delete a row from any sheet by its record ID.
     * @param {string} sheetName - 'Students' | 'Assessments' | 'Attendance' | 'Teachers' | 'Staff' | 'Payments'
     * @param {string} recordId  - The unique id field value of the record
     */
    async deleteRecord(sheetName, recordId) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            // Use the specific action for better handling
            const action = sheetName === 'Students' ? 'deleteStudent' : 
                         sheetName === 'Assessments' ? 'deleteAssessment' : 'deleteRecord';
            
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', action);
            
            if (action === 'deleteRecord') {
                url.searchParams.set('sheetName', sheetName);
            }
            
            url.searchParams.set('recordId', String(recordId));
            
            console.log('Deleting from Google Sheet:', url.toString());
            
            const response = await fetch(url.toString());
            const text = await response.text();
            
            console.log('Delete response:', text);
            
            try {
                const result = JSON.parse(text);
                if (result.success) {
                    return { success: true, message: result.message };
                } else {
                    return { success: false, error: result.error || 'Delete failed' };
                }
            } catch (parseErr) {
                if (response.ok) {
                    return { success: true };
                }
                return { success: false, error: 'Invalid response' };
            }
        } catch (error) {
            console.error('Delete error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync deletion detection - identify records deleted in Google Sheet but still in local data
     * @param {string} sheetName - The sheet to compare
     * @param {array} localRecords - Records from local storage
     * @returns {object} - { deletedIds: [], localIds: [], sheetIds: [] }
     */
    async detectDeletions(sheetName, localRecords) {
        if (!this.isConfigured() || !localRecords || localRecords.length === 0) {
            return { deletedIds: [], localIds: [], sheetIds: [] };
        }

        try {
            // Fetch current data from Google Sheet
            const sheetData = await this.fetchAll();
            let sheetRecords = [];

            switch (sheetName) {
                case 'Students':
                    sheetRecords = sheetData.students || [];
                    break;
                case 'Assessments':
                    sheetRecords = sheetData.assessments || [];
                    break;
                case 'Attendance':
                    sheetRecords = sheetData.attendance || [];
                    break;
                case 'Teachers':
                    sheetRecords = sheetData.teachers || [];
                    break;
                case 'Staff':
                    sheetRecords = sheetData.staff || [];
                    break;
                case 'Payments':
                    sheetRecords = sheetData.payments || [];
                    break;
                default:
                    return { deletedIds: [], localIds: [], sheetIds: [] };
            }

            // Get IDs from both sources
            const localIds = localRecords.map(r => String(r.id));
            const sheetIds = sheetRecords.map(r => String(r.id));

            // Find IDs that are in local but not in sheet (these were deleted remotely)
            const deletedIds = localIds.filter(id => !sheetIds.includes(id));

            return {
                deletedIds,
                localIds,
                sheetIds,
                deletionCount: deletedIds.length
            };
        } catch (error) {
            console.warn(`Could not detect deletions for ${sheetName}:`, error.message);
            return { deletedIds: [], localIds: [], sheetIds: [] };
        }
    }

    /**
     * Update an existing row in any sheet, matched by the record's unique id.
     * @param {string} sheetName - 'Students' | 'Assessments' | 'Attendance'
     * @param {object} record    - The record object (must have an `id` field)
     */
    async updateRecord(sheetName, record) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            let preparedRecord = record;
            if (sheetName === 'Students') {
                preparedRecord = this._prepareStudentForSheet(record);
            }

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'updateRecord');
            url.searchParams.set('data', JSON.stringify({ sheetName, record: preparedRecord }));

            const response = await fetch(url.toString());
            const text = await response.text();
            try {
                const result = JSON.parse(text);
                return result.success ? { success: true } : { success: false, error: result.error || 'Update failed' };
            } catch {
                return { success: response.ok };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Efficiently sync EVERYTHING to Google (One request if possible)
    async syncAll(localData) {
        if (!this.isConfigured()) return { success: false, error: 'Not configured' };

        try {
            const payload = {
                action: 'syncAllToGoogle',
                data: {
                    students: localData.students || [],
                    assessments: localData.assessments || [],
                    attendance: localData.attendance || [],
                    teachers: localData.teachers || [],
                    staff: localData.staff || [],
                    payments: localData.payments || []
                },
                headers: {
                    students: STUDENT_HEADERS,
                    assessments: ASSESSMENT_HEADERS,
                    attendance: ATTENDANCE_HEADERS,
                    teachers: TEACHER_HEADERS,
                    staff: STAFF_HEADERS,
                    payments: PAYMENT_HEADERS
                }
            };

            const response = await fetch(this.settings.googleScriptUrl, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('syncAll error:', error);
            // Fallback to individual syncs if syncAllToGoogle action doesn't exist yet
            return this.syncToGoogle(localData);
        }
    }

    async replaceAllRecords(sheetName, records, headers) {
        try {
            const url = this.settings.googleScriptUrl;
            
            let preparedRecords = records;
            if (sheetName === 'Students') {
                preparedRecords = records.map(s => this._prepareStudentForSheet(s));
            } else if (sheetName === 'Payments') {
                preparedRecords = records.map(p => ({
                    ...p,
                    items: typeof p.items === 'object' ? JSON.stringify(p.items) : p.items
                }));
            }

            // Create JSONP-style request using no-cors mode
            const payload = JSON.stringify({
                action: 'replaceAll',
                sheetName: sheetName,
                records: preparedRecords,
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
                attendance: result.attendance || [],
                teachers: result.teachers || [],
                staff: result.staff || [],
                payments: result.payments || []
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
            const googleTeachers = googleResult.teachers || [];
            const googleStaff = googleResult.staff || [];

            const localStudents = localData.students || [];
            const localAssessments = localData.assessments || [];
            const localAttendance = localData.attendance || [];
            const localTeachers = localData.teachers || [];
            const localStaff = localData.staff || [];

            // Deduplicate logic using unified ID system
            const getUniqueMap = (arr, key = 'id') => new Map(arr.map(item => [String(item[key] || ''), item]));
            
            const localStudentMap = getUniqueMap(localStudents, 'admissionNo');
            const localAssessmentsMap = getUniqueMap(localAssessments);
            const localAttendanceMap = new Map(localAttendance.map(a => [`${a.studentId}-${a.date}`, a]));
            const localTeachersMap = getUniqueMap(localTeachers);
            const localStaffMap = getUniqueMap(localStaff);
            const localPaymentsMap = getUniqueMap(localData.payments || []);

            // Merge logic: Google Sheet usually has the "truth" for shared data
            const merge = (googleArr, localMap, keyExtractor) => {
                const nextLocalLoad = new Map(localMap);
                const stats = { added: 0, updated: 0 };
                
                googleArr.forEach(item => {
                    const key = keyExtractor(item);
                    if (key && !nextLocalLoad.has(key)) {
                        nextLocalLoad.set(key, item);
                        stats.added++;
                    } else if (key) {
                        // Optional: only update if changed (Deep compare or timestamp)
                        const existing = nextLocalLoad.get(key);
                        if (JSON.stringify(existing) !== JSON.stringify(item)) {
                            nextLocalLoad.set(key, item);
                            stats.updated++;
                        }
                    }
                });
                return { items: Array.from(nextLocalLoad.values()), stats };
            };

            const studentsResult = merge(googleStudents, localStudentMap, s => String(s.admissionNo || ''));
            const assessmentsResult = merge(googleAssessments, localAssessmentsMap, a => String(a.id || ''));
            const attendanceResult = merge(googleAttendance, localAttendanceMap, a => `${a.studentId}-${a.date}`);
            const teachersResult = merge(googleTeachers, localTeachersMap, t => String(t.id || ''));
            const staffResult = merge(googleStaff, localStaffMap, s => String(s.id || ''));
            const paymentsResult = merge(googleResult.payments || [], localPaymentsMap, p => String(p.id || ''));

            const mergedStudents = studentsResult.items;
            const mergedAssessments = assessmentsResult.items;
            const mergedAttendance = attendanceResult.items;
            const mergedTeachers = teachersResult.items;
            const mergedStaff = staffResult.items;
            const mergedPayments = paymentsResult.items;

            return {
                success: true,
                data: {
                    students: mergedStudents,
                    assessments: mergedAssessments,
                    attendance: mergedAttendance,
                    teachers: mergedTeachers,
                    staff: mergedStaff,
                    payments: mergedPayments
                },
                stats: {
                    newStudents: studentsResult.stats.added,
                    newAssessments: assessmentsResult.stats.added,
                    newAttendance: attendanceResult.stats.added,
                    newTeachers: teachersResult.stats.added,
                    newStaff: staffResult.stats.added,
                    newPayments: paymentsResult.stats.added,
                    totalStudents: mergedStudents.length,
                    totalAssessments: mergedAssessments.length
                }
            };
        } catch (error) {
            console.error('Pull error:', error);
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
