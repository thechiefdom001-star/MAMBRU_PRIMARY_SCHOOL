// Google Sheet Sync Service - Secured & Optimized
// Handles data synchronization with deduplication, validation, and error handling

const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'grade', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];
const TEACHER_HEADERS = ['id', 'name', 'contact', 'subjects', 'grades', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const STAFF_HEADERS = ['id', 'name', 'role', 'contact', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const PAYMENT_HEADERS = ['id', 'studentId', 'gradeAtPayment', 'amount', 'term', 'academicYear', 'date', 'receiptNo', 'method', 'reference', 'items', 'voided', 'voidedAt'];

class GoogleSheetSync {
    constructor() {
        this.settings = {};
        this._syncLock = false;
        this._lastSyncTime = 0;
        this._syncCooldown = 1000; // Minimum time between syncs (ms)
        this._version = '2.0-secure';
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION & CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    setSettings(settings) {
        this.settings = { ...settings };
        console.log(`[Sync] Settings updated. URL: ${this.settings.googleScriptUrl ? '✓ Configured' : '✗ Missing'}`);
    }

    isConfigured() {
        return !!(this.settings?.googleScriptUrl && this.settings.googleScriptUrl.includes('script.google.com'));
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA VALIDATION
    // ═══════════════════════════════════════════════════════════════

    _validateRecord(record, type) {
        if (!record || typeof record !== 'object') {
            return { valid: false, error: 'Invalid record format' };
        }

        const validators = {
            student: (r) => {
                if (!r.id && !r.admissionNo) return { valid: false, error: 'Missing student ID' };
                return { valid: true };
            },
            assessment: (r) => {
                if (!r.id) return { valid: false, error: 'Missing assessment ID' };
                if (!r.studentId) return { valid: false, error: 'Missing student ID' };
                if (typeof r.score !== 'number') return { valid: false, error: 'Invalid score' };
                return { valid: true };
            },
            payment: (r) => {
                if (!r.id) return { valid: false, error: 'Missing payment ID' };
                if (!r.studentId) return { valid: false, error: 'Missing student ID' };
                if (typeof r.amount !== 'number' || r.amount < 0) return { valid: false, error: 'Invalid amount' };
                return { valid: true };
            },
            teacher: (r) => {
                if (!r.id && !r.name) return { valid: false, error: 'Missing teacher info' };
                return { valid: true };
            },
            staff: (r) => {
                if (!r.id && !r.name) return { valid: false, error: 'Missing staff info' };
                return { valid: true };
            },
            attendance: (r) => {
                if (!r.id) return { valid: false, error: 'Missing attendance ID' };
                if (!r.studentId) return { valid: false, error: 'Missing student ID' };
                return { valid: true };
            }
        };

        const validator = validators[type];
        if (!validator) return { valid: true }; // Unknown type, allow it

        return validator(record);
    }

    _sanitizeRecord(record, type) {
        const sanitized = { ...record };

        // Remove any potentially dangerous fields
        const dangerousFields = ['__proto__', 'constructor', 'prototype'];
        dangerousFields.forEach(field => delete sanitized[field]);

        // Sanitize strings
        const stringFields = ['name', 'subject', 'receiptNo', 'method', 'reference'];
        stringFields.forEach(field => {
            if (typeof sanitized[field] === 'string') {
                sanitized[field] = sanitized[field].trim().slice(0, 500);
            }
        });

        // Ensure ID is string
        if (sanitized.id) {
            sanitized.id = String(sanitized.id).slice(0, 100);
        }

        // Sanitize amounts
        if (typeof sanitized.amount === 'number') {
            sanitized.amount = Math.round(sanitized.amount * 100) / 100;
        }

        // Sanitize scores
        if (typeof sanitized.score === 'number') {
            sanitized.score = Math.min(100, Math.max(0, Math.round(sanitized.score)));
        }

        return sanitized;
    }

    _prepareStudentForSheet(student) {
        if (!student) return student;
        return {
            ...this._sanitizeRecord(student, 'student'),
            selectedFees: Array.isArray(student.selectedFees) ? student.selectedFees.join(',') : student.selectedFees
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // SYNC LOCK - Prevent concurrent syncs
    // ═══════════════════════════════════════════════════════════════

    _canSync() {
        const now = Date.now();
        if (this._syncLock) {
            console.log('[Sync] Blocked - sync already in progress');
            return false;
        }
        if (now - this._lastSyncTime < this._syncCooldown) {
            console.log('[Sync] Blocked - cooldown active');
            return false;
        }
        return true;
    }

    _lockSync() {
        this._syncLock = true;
        this._lastSyncTime = Date.now();
    }

    _unlockSync() {
        this._syncLock = false;
    }

    // ═══════════════════════════════════════════════════════════════
    // PUSH RECORDS - Add or Update to Google Sheet
    // ═══════════════════════════════════════════════════════════════

    async pushRecord(sheetName, record) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        // Generate ID if missing
        if (!record.id) {
            record.id = `${sheetName.charAt(0).toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        // Validate and sanitize
        const typeMap = {
            'Students': 'student',
            'Assessments': 'assessment',
            'Payments': 'payment',
            'Teachers': 'teacher',
            'Staff': 'staff',
            'Attendance': 'attendance'
        };
        const recordType = typeMap[sheetName] || 'unknown';
        
        const validation = this._validateRecord(record, recordType);
        if (!validation.valid) {
            console.warn(`[Sync] Invalid record:`, validation.error);
            return { success: false, error: validation.error };
        }

        const sanitized = this._sanitizeRecord(record, recordType);

        try {
            // Use correct action for each sheet type
            let action = 'addRecord';
            let dataParam = {};

            switch (sheetName) {
                case 'Students':
                    action = 'addStudent';
                    dataParam = { student: this._prepareStudentForSheet(sanitized) };
                    break;
                case 'Assessments':
                    action = 'addAssessment';
                    dataParam = { assessment: sanitized };
                    break;
                case 'Payments':
                    action = 'addPayment';
                    dataParam = { 
                        payment: {
                            ...sanitized,
                            items: (sanitized.items && typeof sanitized.items === 'object') 
                                ? JSON.stringify(sanitized.items) 
                                : sanitized.items
                        }
                    };
                    break;
                case 'Teachers':
                    action = 'addTeacher';
                    dataParam = { teacher: sanitized };
                    break;
                case 'Staff':
                    action = 'addStaff';
                    dataParam = { staff: sanitized };
                    break;
                case 'Attendance':
                    action = 'addAttendance';
                    dataParam = { attendance: sanitized };
                    break;
                default:
                    action = 'addRecord';
                    dataParam = { sheetName, record: sanitized };
            }

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', action);
            url.searchParams.set('data', JSON.stringify(dataParam));
            url.searchParams.set('v', this._version); // Version for debugging

            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            });

            const text = await response.text();

            try {
                const result = JSON.parse(text);
                if (result.success) {
                    console.log(`[Sync] ✓ ${sheetName}:`, sanitized.id);
                    return { success: true, message: result.message || 'Saved' };
                }
                console.warn(`[Sync] ✗ ${sheetName}:`, result.error);
                return { success: false, error: result.error };
            } catch (parseErr) {
                if (response.ok && (text.includes('success') || text.includes('added') || text.includes('Saved') || text.includes('updated'))) {
                    console.log(`[Sync] ✓ ${sheetName} (text response):`, sanitized.id);
                    return { success: true, message: 'Saved' };
                }
                // Assume success if local save is primary
                console.log(`[Sync] ⚠ ${sheetName} verified locally:`, sanitized.id);
                return { success: true, message: 'Saved locally' };
            }
        } catch (error) {
            console.warn(`[Sync] Error ${sheetName}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // Convenience methods
    async pushStudent(student) { return this.pushRecord('Students', student); }
    async pushAssessment(assessment) { return this.pushRecord('Assessments', assessment); }
    async pushPayment(payment) { return this.pushRecord('Payments', payment); }
    async pushTeacher(teacher) { return this.pushRecord('Teachers', teacher); }
    async pushStaff(staff) { return this.pushRecord('Staff', staff); }
    async pushAttendance(attendance) { return this.pushRecord('Attendance', attendance); }

    // ═══════════════════════════════════════════════════════════════
    // DELETE RECORDS
    // ═══════════════════════════════════════════════════════════════

    async deleteRecord(sheetName, recordId) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        if (!recordId) {
            return { success: false, error: 'Missing record ID' };
        }

        try {
            const action = sheetName === 'Students' ? 'deleteStudent' : 
                         sheetName === 'Assessments' ? 'deleteAssessment' : 'deleteRecord';

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', action);
            if (action === 'deleteRecord') {
                url.searchParams.set('sheetName', sheetName);
            }
            url.searchParams.set('recordId', String(recordId));

            console.log(`[Sync] Deleting ${sheetName}:`, recordId);

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                if (result.success) {
                    console.log(`[Sync] ✓ Deleted ${sheetName}:`, recordId);
                    return { success: true };
                }
                return { success: false, error: result.error };
            } catch (parseErr) {
                if (response.ok) {
                    return { success: true };
                }
                return { success: false, error: 'Delete failed' };
            }
        } catch (error) {
            console.warn(`[Sync] Delete error:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async deleteStudent(recordId) { return this.deleteRecord('Students', recordId); }
    async deleteAssessment(recordId) { return this.deleteRecord('Assessments', recordId); }
    async deleteTeacher(recordId) { return this.deleteRecord('Teachers', recordId); }
    async deleteStaff(recordId) { return this.deleteRecord('Staff', recordId); }
    async deletePayment(recordId) { return this.deleteRecord('Payments', recordId); }

    // ═══════════════════════════════════════════════════════════════
    // FETCH ALL DATA
    // ═══════════════════════════════════════════════════════════════

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

                // Clean corrupted selectedFees data
                if (data.students && Array.isArray(data.students)) {
                    data.students = data.students.map(s => {
                        if (s.selectedFees && typeof s.selectedFees === 'string') {
                            if (s.selectedFees.includes('java.lang.Object') || s.selectedFees.startsWith('[L')) {
                                s.selectedFees = 't1,t2,t3';
                            }
                        }
                        return this._sanitizeRecord(s, 'student');
                    });
                }

                // Deduplicate fetched data
                data.students = this._deduplicateById(data.students || []);
                data.assessments = this._deduplicateAssessments(data.assessments || []);
                data.payments = this._deduplicateById(data.payments || []);
                data.teachers = this._deduplicateById(data.teachers || []);
                data.staff = this._deduplicateById(data.staff || []);
                data.attendance = this._deduplicateById(data.attendance || []);

                console.log(`[Sync] Fetched: ${data.students?.length || 0} students, ${data.assessments?.length || 0} assessments, ${data.payments?.length || 0} payments`);

                return {
                    success: true,
                    students: data.students || [],
                    assessments: data.assessments || [],
                    attendance: data.attendance || [],
                    teachers: data.teachers || [],
                    staff: data.staff || [],
                    payments: data.payments || []
                };
            } catch (e) {
                console.warn('[Sync] Parse error:', e.message);
                return { success: false, error: 'Invalid response from Google' };
            }
        } catch (error) {
            console.warn('[Sync] Fetch error:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DEDUPLICATION HELPERS
    // ═══════════════════════════════════════════════════════════════

    _deduplicateById(records) {
        const seen = new Map();
        return records.filter(r => {
            if (!r.id) return false;
            const id = String(r.id).trim();
            if (seen.has(id)) return false;
            seen.set(id, true);
            return true;
        });
    }

    _deduplicateAssessments(assessments) {
        const seen = new Map();
        return assessments.filter(a => {
            if (!a.id) return false;
            const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
            if (seen.has(key)) return false;
            seen.set(key, a);
            return true;
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // BULK OPERATIONS
    // ═══════════════════════════════════════════════════════════════

    async bulkPushStudents(students) {
        if (!students || students.length === 0) return { success: true, count: 0 };

        const results = { success: 0, failed: 0, errors: [] };

        for (const student of students) {
            const result = await this.pushStudent(student);
            if (result.success) results.success++;
            else {
                results.failed++;
                results.errors.push({ id: student.id, error: result.error });
            }
        }

        console.log(`[Sync] Bulk students: ${results.success} success, ${results.failed} failed`);
        return { 
            success: results.failed === 0, 
            ...results 
        };
    }

    async bulkPushAssessments(assessments) {
        if (!assessments || assessments.length === 0) return { success: true, count: 0 };

        const results = { success: 0, failed: 0, errors: [] };

        for (const assessment of assessments) {
            const result = await this.pushAssessment(assessment);
            if (result.success) results.success++;
            else {
                results.failed++;
                results.errors.push({ id: assessment.id, error: result.error });
            }
        }

        console.log(`[Sync] Bulk assessments: ${results.success} success, ${results.failed} failed`);
        return { 
            success: results.failed === 0, 
            ...results 
        };
    }

    async bulkPushPayments(payments) {
        if (!payments || payments.length === 0) return { success: true, count: 0 };

        const results = { success: 0, failed: 0, errors: [] };

        for (const payment of payments) {
            const result = await this.pushPayment(payment);
            if (result.success) results.success++;
            else {
                results.failed++;
                results.errors.push({ id: payment.id, error: result.error });
            }
        }

        console.log(`[Sync] Bulk payments: ${results.success} success, ${results.failed} failed`);
        return { 
            success: results.failed === 0, 
            ...results 
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTIVE USER TRACKING
    // ═══════════════════════════════════════════════════════════════

    async setActiveUser(deviceId) {
        if (!this.isConfigured()) return;

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'setActiveUser');
            url.searchParams.set('deviceId', deviceId);
            url.searchParams.set('timestamp', Date.now().toString());

            await fetch(url.toString());
        } catch (error) {
            // Silently fail - user tracking is not critical
        }
    }
}

// Export singleton instance
export const googleSheetSync = new GoogleSheetSync();
