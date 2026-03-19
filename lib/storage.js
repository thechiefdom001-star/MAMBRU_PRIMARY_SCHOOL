export const Storage = {
    key: 'edutrack_cbc_data',

    // Helper to get storage (localStorage or sessionStorage as fallback)
    getStorage() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return localStorage;
        } catch (e) {
            console.warn('localStorage not available, using sessionStorage');
            return sessionStorage;
        }
    },

    defaultData: {
        archives: [],
        students: [
            { id: '1', name: 'John Doe', grade: 'GRADE 1', admissionNo: '2024/001', admissionDate: '2024-01-10', assessmentNo: 'ASN-001', upiNo: 'UPI-789X', stream: 'North', parentContact: '0711222333', selectedFees: ['t1', 't2', 't3', 'bookFund', 'caution', 'studentCard'] },
            { id: '2', name: 'Jane Smith', grade: 'GRADE 2', admissionNo: '2024/002', admissionDate: '2024-02-15', assessmentNo: 'ASN-002', upiNo: 'UPI-456Y', stream: 'South', parentContact: '0722333444', selectedFees: ['t1', 't2', 't3', 'breakfast', 'lunch'] }
        ],
        assessments: [
            { id: 'a1', studentId: '1', subject: 'Mathematics', level: 'EE', score: 85, date: '2024-03-20' },
            { id: 'a2', studentId: '1', subject: 'English Language', level: 'ME', score: 72, date: '2024-03-20' }
        ],
        payments: [
            { id: 'p1', studentId: '1', amount: 20000, date: '2024-03-01', receiptNo: 'RCP-001' }
        ],
        paymentPrompts: [],
        teachers: [
            { id: 't1', name: 'Peter Mwangi', contact: '0712345678', subjects: 'Mathematics, Science', grades: 'GRADE 1, GRADE 2', employeeNo: 'T-001', nssfNo: 'NSSF-123', shifNo: 'SHIF-456', taxNo: 'A001234567X' }
        ],
        staff: [
            { id: 's1', name: 'Alice Wambui', role: 'Bursar', contact: '0722000111', employeeNo: 'S-001', nssfNo: 'NSSF-789', shifNo: 'SHIF-012', taxNo: 'A009876543Z' },
            { id: 's2', name: 'John Kamau', role: 'Driver', contact: '0733000222', employeeNo: 'S-002', nssfNo: 'NSSF-345', shifNo: 'SHIF-678', taxNo: 'A005556667Y' }
        ],
        remarks: [],
        attendance: [],
        transport: {
            routes: [
                { id: 'r1', name: 'Route A - City Center', fee: 5000 },
                { id: 'r2', name: 'Route B - Westlands', fee: 6500 }
            ],
            assignments: []
        },
        library: {
            books: [
                { id: 'b1', title: 'The River and the Source', author: 'Margaret Ogola', isbn: '978-9966-882-05-9', status: 'Available', quantity: 10 },
                { id: 'b2', title: 'Kidagaa Kimemwozea', author: 'Ken Walibora', isbn: '978-9966-10-142-2', status: 'Available', quantity: 5 }
            ],
            transactions: []
        },
        payroll: [],
        settings: {
            schoolName: 'Evergreen Academy',
            schoolAddress: '123 Academic Drive, Nairobi, Kenya',
            schoolLogo: 'school_logo.png',
            principalSignature: '',
            clerkSignature: '',
            academicYear: '2025/2026',
            currency: 'KES.',
            theme: 'light',
            primaryColor: '#2563eb',
            secondaryColor: '#64748b',
            weeksPerTerm: 12,
            termDates: {
                T1: { start: '2025-01-06', end: '2025-04-04' },
                T2: { start: '2025-04-22', end: '2025-08-08' },
                T3: { start: '2025-08-25', end: '2025-11-21' }
            },
            grades: ['PP1', 'PP2', 'GRADE 1', 'GRADE 2', 'GRADE 3', 'GRADE 4', 'GRADE 5', 'GRADE 6', 'GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'],
            streams: ['A', 'B', 'C'],
            feeStructures: [
                { grade: 'PP1', t1: 15000, t2: 12000, t3: 12000, admission: 2000, diary: 500, development: 5000, boarding: 0, breakfast: 3000, lunch: 5000, trip: 2000, bookFund: 1000, caution: 2000, uniform: 4500, studentCard: 500, remedial: 0, assessmentFee: 1000, projectFee: 500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'PP2', t1: 15000, t2: 12000, t3: 12000, admission: 2000, diary: 500, development: 5000, boarding: 0, breakfast: 3000, lunch: 5000, trip: 2000, bookFund: 1000, caution: 2000, uniform: 4500, studentCard: 500, remedial: 0, assessmentFee: 1000, projectFee: 500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 1', t1: 25000, t2: 20000, t3: 20000, admission: 3000, diary: 500, development: 5000, boarding: 15000, breakfast: 3500, lunch: 6000, trip: 2500, bookFund: 1500, caution: 2000, uniform: 5000, studentCard: 500, remedial: 2000, assessmentFee: 1500, projectFee: 1000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 2', t1: 25000, t2: 20000, t3: 20000, admission: 3000, diary: 500, development: 5000, boarding: 15000, breakfast: 3500, lunch: 6000, trip: 2500, bookFund: 1500, caution: 2000, uniform: 5000, studentCard: 500, remedial: 2000, assessmentFee: 1500, projectFee: 1000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 3', t1: 25000, t2: 20000, t3: 20000, admission: 3000, diary: 500, development: 5000, boarding: 15000, breakfast: 3500, lunch: 6000, trip: 2500, bookFund: 1500, caution: 2000, uniform: 5000, studentCard: 500, remedial: 2000, assessmentFee: 1500, projectFee: 1000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 4', t1: 30000, t2: 25000, t3: 25000, admission: 3000, diary: 500, development: 5000, boarding: 20000, breakfast: 4000, lunch: 7000, trip: 3000, bookFund: 2000, caution: 2000, uniform: 5500, studentCard: 500, remedial: 2500, assessmentFee: 2000, projectFee: 1500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 5', t1: 30000, t2: 25000, t3: 25000, admission: 3000, diary: 500, development: 5000, boarding: 20000, breakfast: 4000, lunch: 7000, trip: 3000, bookFund: 2000, caution: 2000, uniform: 5500, studentCard: 500, remedial: 2500, assessmentFee: 2000, projectFee: 1500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 6', t1: 30000, t2: 25000, t3: 25000, admission: 3000, diary: 500, development: 5000, boarding: 20000, breakfast: 4000, lunch: 7000, trip: 3000, bookFund: 2000, caution: 2000, uniform: 5500, studentCard: 500, remedial: 2500, assessmentFee: 2000, projectFee: 1500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 7', t1: 35000, t2: 30000, t3: 30000, admission: 5000, diary: 500, development: 7500, boarding: 25000, breakfast: 4500, lunch: 8000, trip: 4000, bookFund: 2500, caution: 3000, uniform: 6000, studentCard: 1000, remedial: 3000, assessmentFee: 3000, projectFee: 2000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 8', t1: 35000, t2: 30000, t3: 30000, admission: 5000, diary: 500, development: 7500, boarding: 25000, breakfast: 4500, lunch: 8000, trip: 4000, bookFund: 2500, caution: 3000, uniform: 6000, studentCard: 1000, remedial: 3000, assessmentFee: 3000, projectFee: 2000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 9', t1: 35000, t2: 30000, t3: 30000, admission: 5000, diary: 500, development: 7500, boarding: 25000, breakfast: 4500, lunch: 8000, trip: 4000, bookFund: 2500, caution: 3000, uniform: 6000, studentCard: 1000, remedial: 3000, assessmentFee: 3000, projectFee: 2000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 10', t1: 45000, t2: 40000, t3: 40000, admission: 10000, diary: 1000, development: 10000, boarding: 30000, breakfast: 5000, lunch: 10000, trip: 5000, bookFund: 5000, caution: 5000, uniform: 8000, studentCard: 1000, remedial: 5000, assessmentFee: 5000, projectFee: 3000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 11', t1: 45000, t2: 40000, t3: 40000, admission: 10000, diary: 1000, development: 10000, boarding: 30000, breakfast: 5000, lunch: 10000, trip: 5000, bookFund: 5000, caution: 5000, uniform: 8000, studentCard: 1000, remedial: 5000, assessmentFee: 5000, projectFee: 3000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 12', t1: 45000, t2: 40000, t3: 40000, admission: 10000, diary: 1000, development: 10000, boarding: 30000, breakfast: 5000, lunch: 10000, trip: 5000, bookFund: 5000, caution: 5000, uniform: 8000, studentCard: 1000, remedial: 5000, assessmentFee: 5000, projectFee: 3000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 }
            ]
        }
    },

    load() {
        try {
            const storage = this.getStorage();
            const stored = storage.getItem(this.key);
            if (!stored) {
                console.log('No stored data found, using defaults');
                return this.getDefaultData();
            }
            
            const parsed = JSON.parse(stored);
            if (!parsed || typeof parsed !== 'object') {
                console.log('Invalid stored data, using defaults');
                return this.getDefaultData();
            }

            console.log('Data loaded. Students:', parsed.students?.length || 0, 'Payments:', parsed.payments?.length || 0);
            
            // Ensure all required arrays exist
            const loadedData = {
                ...parsed,
                students: parsed.students || [],
                payments: parsed.payments || [],  // CRITICAL: preserve payments
                assessments: parsed.assessments || [],
                attendance: parsed.attendance || [],
                teachers: parsed.teachers || [],
                staff: parsed.staff || [],
                remarks: parsed.remarks || [],
                archives: parsed.archives || [],
                paymentPrompts: parsed.paymentPrompts || []
            };
            
            return loadedData;
        } catch (e) {
            console.error("Storage load error:", e);
            return this.getDefaultData();
        }
    },

    getDefaultData() {
        // Return a deep copy of defaultData
        return JSON.parse(JSON.stringify(this.defaultData));
    },

    deduplicateData(data) {
        if (!data) return data;

        // Deduplicate assessments by unique composite key
        const assessments = data.assessments || [];
        const uniqueAssessments = [];
        const assessKeys = new Set();
        
        for (const a of assessments) {
            const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
            if (!assessKeys.has(key)) {
                assessKeys.add(key);
                uniqueAssessments.push(a);
            }
        }
        
        // Deduplicate students by admissionNo (case-insensitive)
        const students = data.students || [];
        const uniqueStudents = [];
        const studentKeys = new Set();
        
        for (const s of students) {
            const key = String(s.admissionNo || '').toLowerCase().trim();
            if (!key) continue; // Skip empty admission numbers
            if (!studentKeys.has(key)) {
                studentKeys.add(key);
                uniqueStudents.push(s);
            }
        }
        
        // Deduplicate attendance
        const attendance = data.attendance || [];
        const uniqueAttendance = [];
        const attKeys = new Set();
        
        for (const att of attendance) {
            const key = `${att.studentId}-${att.date}`;
            if (!attKeys.has(key)) {
                attKeys.add(key);
                uniqueAttendance.push(att);
            }
        }

        // Deduplicate payments
        const payments = data.payments || [];
        const uniquePayments = [];
        const payKeys = new Set();
        
        for (const p of payments) {
            const key = String(p.id || '').trim();
            if (!key) continue;
            if (!payKeys.has(key)) {
                payKeys.add(key);
                uniquePayments.push(p);
            }
        }

        return {
            ...data,
            students: uniqueStudents,
            assessments: uniqueAssessments,
            attendance: uniqueAttendance,
            payments: uniquePayments
        };
    },


    ensureDataIntegrity(rawData) {
        const defaults = this.getDefaultData();
        
        // Clean out duplicates before we ensure the integrity of the format
        const data = this.deduplicateData(rawData);
        
        // Ensure settings exist
        const settings = data.settings || {};
        
        // Ensure fee structures exist - this is critical for fees to work
        let feeStructures = settings.feeStructures;
        if (!feeStructures || !Array.isArray(feeStructures) || feeStructures.length === 0) {
            console.log('No fee structures found, using defaults');
            feeStructures = defaults.settings.feeStructures;
        }

        // Ensure students exist - preserve ALL students from data
        const students = data.students || [];

        // Ensure payments exist
        const payments = data.payments || [];

        // IMPORTANT: Spread data FIRST so it overrides defaults
        return {
            ...defaults,
            ...data,
            students: students,  // Explicitly preserve students
            payments: payments,
            assessments: data.assessments || [],
            attendance: data.attendance || [],
            teachers: data.teachers || [],
            staff: data.staff || [],
            remarks: data.remarks || [],
            paymentPrompts: data.paymentPrompts || [],
            archives: data.archives || [],
            transport: { ...defaults.transport, ...(data.transport || {}) },
            library: { ...defaults.library, ...(data.library || {}) },
            payroll: data.payroll || [],
            settings: {
                ...defaults.settings,
                ...settings,
                grades: settings.grades?.length > 0 ? settings.grades : defaults.settings.grades,
                streams: settings.streams?.length > 0 ? settings.streams : defaults.settings.streams,
                feeStructures: feeStructures,
                termDates: settings.termDates || defaults.settings.termDates,
                academicYear: settings.academicYear || defaults.settings.academicYear,
                currency: settings.currency || defaults.settings.currency
            }
        };
    },

    save(data) {
        try {
            if (!data) return;
            
            // DON'T run ensureDataIntegrity on save - it might strip data
            // Just save what's given, but ensure payments array exists
            const dataToSave = {
                ...data,
                payments: data.payments || [],
                students: data.students || [],
                assessments: data.assessments || [],
                attendance: data.attendance || [],
                teachers: data.teachers || [],
                staff: data.staff || [],
                remarks: data.remarks || []
            };
            
            const storage = this.getStorage();
            const jsonStr = JSON.stringify(dataToSave);
            
            try {
                storage.setItem(this.key, jsonStr);
                console.log('✓ Data saved - Students:', dataToSave.students?.length || 0, 'Payments:', dataToSave.payments?.length || 0);
            } catch (storageErr) {
                console.warn('Storage error:', storageErr.message);
                // Try saving with reduced data if too large
                if (storageErr.name === 'QuotaExceededError') {
                    const reducedData = {
                        ...dataToSave,
                        assessments: dataToSave.assessments?.slice(0, 1000) || [],
                        attendance: dataToSave.attendance?.slice(0, 1000) || []
                    };
                    storage.setItem(this.key, JSON.stringify(reducedData));
                }
            }
        } catch (e) {
            console.error("Storage save error:", e);
        }
    },

    async pushToCloud(data) {
        const ws = window.websim;
        if (!ws || !ws.upload || !ws.postComment) {
            return { error: "Websim Cloud API not available" };
        }
        try {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const file = new File([blob], `edutrack_sync_${Date.now()}.json`, { type: 'application/json' });
            const url = await ws.upload(file);
            const result = await ws.postComment({
                content: `[DATA_SYNC] ${url}`
            });
            return result;
        } catch (e) {
            console.error("Cloud push failed:", e);
            return { error: e.message };
        }
    },

    async pullFromCloud(projectId) {
        const ws = window.websim;
        if (!ws) return null;
        try {
            const response = await fetch(`/api/v1/projects/${projectId}/comments?first=50&sort_by=newest`);
            const result = await response.json();
            // Find the most recent sync comment from the end (newest)
            const syncComment = (result.comments?.data || []).find(c => c.comment.raw_content.includes('[DATA_SYNC]'));
            if (syncComment) {
                const match = syncComment.comment.raw_content.match(/\[DATA_SYNC\]\s+(https?:\/\/[^\s\)]+)/);
                if (match && match[1]) {
                    const dataResponse = await fetch(match[1]);
                    return await dataResponse.json();
                }
            }
        } catch (e) {
            console.error("Cloud pull failed:", e);
        }
        return null;
    },

    getGradeInfo(score) {
        const s = Number(score);
        if (s >= 90) return { level: 'EE1', points: 8, label: 'Exceeding Expectations', desc: 'Exceptional' };
        if (s >= 75) return { level: 'EE2', points: 7, label: 'Exceeding Expectations', desc: 'Very Good' };
        if (s >= 58) return { level: 'ME1', points: 6, label: 'Meeting Expectations', desc: 'Good' };
        if (s >= 41) return { level: 'ME2', points: 5, label: 'Meeting Expectations', desc: 'Fair' };
        if (s >= 31) return { level: 'AE1', points: 4, label: 'Approaching Expectations', desc: 'Needs Improvement' };
        if (s >= 21) return { level: 'AE2', points: 3, label: 'Approaching Expectations', desc: 'Below Average' };
        if (s >= 11) return { level: 'BE1', points: 2, label: 'Below Expectations', desc: 'Well Below Average' };
        if (s > 0) return { level: 'BE2', points: 1, label: 'Below Expectations', desc: 'Minimal' };
        return { level: '-', points: 0, label: 'Not Assessed', desc: 'No Data' };
    },

    getOverallLevel(totalPoints, subjectCount) {
        const avgPoints = subjectCount > 0 ? totalPoints / subjectCount : 0;
        if (avgPoints >= 7.5) return 'EE';
        if (avgPoints >= 5.5) return 'ME';
        if (avgPoints >= 3.5) return 'AE';
        if (avgPoints >= 1.5) return 'BE';
        return '-';
    },

    getStudentAttendance(studentId, attendanceData, term = null) {
        let records = attendanceData.filter(a => a.studentId === studentId);
        if (term) {
            records = records.filter(a => a.term === term);
        }
        if (records.length === 0) return null;
        const present = records.filter(a => a.status === 'Present' || a.status === 'Late').length;
        const total = records.length;
        return total > 0 ? Math.round((present / total) * 100) : null;
    },

    getTermDates(settings, term) {
        const academicYear = settings.academicYear || '2025/2026';
        const year = academicYear.split('/')[0];

        if (settings.termDates && settings.termDates[term]) {
            return settings.termDates[term];
        }

        if (term === 'T1') return { start: `${year}-01-06`, end: `${year}-04-04` };
        if (term === 'T2') return { start: `${year}-04-21`, end: `${year}-08-08` };
        return { start: `${year}-08-25`, end: `${year}-11-21` };
    },

    getWeeksInTerm(settings, term) {
        const dates = this.getTermDates(settings, term);
        const start = new Date(dates.start);
        const end = new Date(dates.end);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return Math.ceil(days / 7);
    },

    getWeeksForTerm(settings, term) {
        const dates = this.getTermDates(settings, term);
        const start = new Date(dates.start);
        const weeks = [];
        while (start <= new Date(dates.end)) {
            const weekStart = new Date(start);
            const weekDates = [];
            for (let i = 0; i < 5; i++) {
                if (weekStart > new Date(dates.end)) break;
                weekDates.push(weekStart.toISOString().split('T')[0]);
                weekStart.setDate(weekStart.getDate() + 1);
            }
            weeks.push({ weekNum: weeks.length + 1, dates: weekDates });
            start.setDate(start.getDate() + 7 - start.getDay() + 1);
        }
        return weeks;
    },

    calculateKenyanPayroll(basicSalary, extraEarnings = {}, extraDeductions = {}) {
        const basic = Number(basicSalary) || 0;
        const earningsObj = extraEarnings || {};
        const deductionsObj = extraDeductions || {};

        const totalExtraEarnings = Object.values(earningsObj).reduce((a, b) => a + (Number(b) || 0), 0);

        // Gross for Tax Purpose (Basic + Allowances)
        const gross = basic + totalExtraEarnings;

        // 1. NSSF (New Rates 2024 Tier I & II - approx 6% capped at 2,160)
        const nssf = Math.min(gross * 0.06, 2160);

        // 2. Taxable Income
        const taxableIncome = gross - nssf;

        // 3. PAYE Calculation
        let tax = 0;
        if (gross > 24000) {
            let remaining = taxableIncome;

            // Band 1: 0 - 24,000 @ 10%
            const b1 = Math.min(remaining, 24000);
            tax += b1 * 0.10;
            remaining -= b1;

            // Band 2: Next 8,333 @ 25%
            if (remaining > 0) {
                const b2 = Math.min(remaining, 8333);
                tax += b2 * 0.25;
                remaining -= b2;
            }

            // Band 3: Next 467,667 @ 30%
            if (remaining > 0) {
                const b3 = Math.min(remaining, 467667);
                tax += b3 * 0.30;
                remaining -= b3;
            }

            // Band 4: Next 300,000 @ 32.5%
            if (remaining > 0) {
                const b4 = Math.min(remaining, 300000);
                tax += b4 * 0.325;
                remaining -= b4;
            }

            // Band 5: Over 800,000 @ 35%
            if (remaining > 0) {
                tax += remaining * 0.35;
            }

            // Apply Personal Relief
            tax = Math.max(0, tax - 2400);
        }

        // 4. SHIF (2.75% of Gross)
        const shif = gross * 0.0275;

        // 5. Housing Levy (AHL - 1.5% of Gross)
        const ahl = gross * 0.015;

        // 6. NITA (Employer pays, but often recorded - 50 KES)
        const nita = 50;

        const totalStatutory = nssf + tax + shif + ahl;
        const totalExtraDeductions = Object.values(deductionsObj).reduce((a, b) => a + (Number(b) || 0), 0);

        const netPay = gross - totalStatutory - totalExtraDeductions;

        return {
            basic,
            extraEarnings: earningsObj,
            extraDeductions: deductionsObj,
            gross,
            nssf,
            paye: tax,
            shif,
            ahl,
            nita,
            totalStatutory,
            totalExtraDeductions,
            totalDeductions: totalStatutory + totalExtraDeductions,
            netPay
        };
    },

    numberToWords(num) {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

        const convert_thousands = (n) => {
            if (n >= 1000) return convert_hundreds(Math.floor(n / 1000)) + " Thousand " + convert_hundreds(n % 1000);
            else return convert_hundreds(n);
        };

        const convert_hundreds = (n) => {
            if (n > 99) return ones[Math.floor(n / 100)] + " Hundred " + convert_tens(n % 100);
            else return convert_tens(n);
        };

        const convert_tens = (n) => {
            if (n < 10) return ones[n];
            else if (n >= 10 && n < 20) return teens[n - 10];
            else return tens[Math.floor(n / 10)] + " " + ones[n % 10];
        };

        if (num === 0) return "Zero";

        let wholeNumber = Math.floor(num);
        let decimal = Math.round((num - wholeNumber) * 100);

        let result = "";
        if (wholeNumber >= 1000000) {
            result += convert_thousands(Math.floor(wholeNumber / 1000000)) + " Million " + convert_thousands(wholeNumber % 1000000);
        } else {
            result += convert_thousands(wholeNumber);
        }

        result = result.trim() + " Shillings";
        if (decimal > 0) {
            result += " and " + convert_tens(decimal) + " Cents";
        } else {
            result += " Only";
        }

        return result;
    },

    getStudentFinancials(student, payments, settings) {
        const currentYear = settings.academicYear;
        const structure = settings.feeStructures?.find(f => f.grade === student.grade);
        const selectedKeys = Array.isArray(student.selectedFees) ? student.selectedFees : ['t1', 't2', 't3'];

        let baseDue = structure ? selectedKeys.reduce((sum, key) => sum + (structure[key] || 0), 0) : 0;
        const previousArrears = Number(student.previousArrears) || 0;

        // Filter payments by current academic year
        const yearPayments = (payments || []).filter(p => p.academicYear === currentYear);

        // Apply category discounts
        if (student.category === 'Sponsored') {
            baseDue = 0;
        } else if (student.category === 'Staff') {
            baseDue = baseDue * 0.5;
        }

        // Total Due is cumulative: Arrears B/F + Current Term/Year Fees
        const totalDue = previousArrears + baseDue;

        // Sum all payments for this student - filter out voided payments
        const totalPaid = (payments || [])
            .filter(p => String(p.studentId) === String(student.id) && !p.voided)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        return {
            totalDue, // Includes Balance Brought Forward
            totalPaid,
            balance: totalDue - totalPaid,
            baseDue,
            previousArrears
        };
    },

    parseSelectedFees(fees) {
        // Handle null, undefined, empty
        if (!fees || fees === '') {
            return ['t1', 't2', 't3'];
        }
        
        // Handle Java object strings from Google Sheets
        if (typeof fees === 'string') {
            // Skip Java object references like "[Ljava.lang.Object;@4e3c55b4"
            if (fees.includes('java.lang.Object') || fees.startsWith('[L')) {
                return ['t1', 't2', 't3'];
            }
            // Handle comma-separated like "t1,t2,t3"
            if (fees.includes(',')) {
                return fees.split(',').map(f => f.trim()).filter(f => f && !f.includes('java'));
            }
            // Handle single value like "t1"
            if (fees.trim()) {
                return [fees.trim()];
            }
            return ['t1', 't2', 't3'];
        }
        
        // Handle array
        if (Array.isArray(fees)) {
            // Filter out any Java objects
            return fees.filter(f => f && typeof f === 'string' && !f.includes('java.lang.Object'));
        }
        
        return ['t1', 't2', 't3'];
    },

    normalizeAssessments(assessments) {
        return (assessments || []).map(a => ({
            ...a,
            score: typeof a.score === 'string' ? Number(a.score) : a.score,
            studentId: String(a.studentId || ''),
            academicYear: a.academicYear || this.load().settings.academicYear || '2025/2026'
        })).filter(a => !isNaN(a.score) && a.studentId);
    },

    // Replace local data with Google Sheet data (for clean sync)
    replaceWithGoogleData(existingData, googleData) {
        if (!googleData) return existingData;
        
        // Get all students from Google
        const googleStudents = googleData.students || [];
        
        // Get settings grades for normalization
        const settingsGrades = (existingData.settings?.grades || []);
        
        // Helper to normalize grade
        const normalizeGrade = (grade) => {
            if (!grade) return 'GRADE 1';
            if (settingsGrades.includes(grade)) return grade;
            const gradeNum = grade.replace(/[^0-9]/g, '');
            if (gradeNum) {
                const matched = settingsGrades.find(g => g.includes(gradeNum));
                if (matched) return matched;
            }
            return grade;
        };
        
        // Normalize the data first
        const normalizedStudents = googleStudents.map((student, index) => {
            const admNo = student.admissionNo ? String(student.admissionNo).trim() : '';
            const normalizedGrade = normalizeGrade(student.grade);
            
            return {
                ...student,
                id: student.id || `student_${index}`, // Ensure ID exists
                grade: normalizedGrade,
                stream: student.stream || '',
                selectedFees: this.parseSelectedFees(student.selectedFees),
                previousArrears: Number(student.previousArrears) || 0,
                // Ensure admission number exists
                admissionNo: admNo || `ADM-${index + 1}`
            };
        });

        // Deduplicate students by admissionNo (case-insensitive, keep FIRST occurrence)
        const uniqueStudents = [];
        const seenAdmNos = new Set();
        for (const s of normalizedStudents) {
            const admLower = String(s.admissionNo || '').toLowerCase();
            if (!admLower) continue; // Skip empty admission numbers
            if (!seenAdmNos.has(admLower)) {
                seenAdmNos.add(admLower);
                uniqueStudents.push(s);
            }
            // If duplicate, skip it
        }
        
        // Also deduplicate local students that might have been added locally
        const localStudents = existingData.students || [];
        const localUnique = [];
        const localSeen = new Set();
        for (const s of localStudents) {
            const admLower = String(s.admissionNo || '').toLowerCase();
            if (!admLower) {
                localUnique.push(s);
                continue;
            }
            if (!localSeen.has(admLower)) {
                localSeen.add(admLower);
                localUnique.push(s);
            }
        }
        
        // Merge: prefer Google data, but keep local-only students that don't exist in Google
        const googleAdmNos = new Set(uniqueStudents.map(s => String(s.admissionNo || '').toLowerCase()));
        for (const s of localUnique) {
            const admLower = String(s.admissionNo || '').toLowerCase();
            if (admLower && !googleAdmNos.has(admLower)) {
                uniqueStudents.push(s);
            }
        }
        
        // Deduplicate and MERGE assessments
        const googleAssessments = googleData.assessments || [];
        const localAssessments = Array.isArray(existingData.assessments) ? existingData.assessments : [];
        const uniqueAssessments = [];
        const seenAssessKeys = new Set();
        
        // Process Google data first
        for (const assess of googleAssessments) {
            const key = `${assess.studentId}-${assess.subject}-${assess.term}-${assess.examType}-${assess.academicYear}`;
            if (!seenAssessKeys.has(key)) {
                seenAssessKeys.add(key);
                uniqueAssessments.push(assess);
            }
        }

        // Add local assessments that don't exist in Google yet
        for (const assess of localAssessments) {
            const key = `${assess.studentId}-${assess.subject}-${assess.term}-${assess.examType}-${assess.academicYear}`;
            if (!seenAssessKeys.has(key)) {
                seenAssessKeys.add(key);
                uniqueAssessments.push(assess);
            }
        }
        
        // Deduplicate and MERGE attendance
        const googleAttendance = googleData.attendance || [];
        const localAttendance = Array.isArray(existingData.attendance) ? existingData.attendance : [];
        const uniqueAttendance = [];
        const seenAttKeys = new Set();
        
        for (const att of googleAttendance) {
            const key = `${att.studentId}-${att.date}`;
            if (!seenAttKeys.has(key)) {
                seenAttKeys.add(key);
                uniqueAttendance.push(att);
            }
        }

        for (const att of localAttendance) {
            const key = `${att.studentId}-${att.date}`;
            if (!seenAttKeys.has(key)) {
                seenAttKeys.add(key);
                uniqueAttendance.push(att);
            }
        }
        
        // Deduplicate and normalize payments - MERGE LOCAL AND GOOGLE
        const googlePayments = googleData.payments || [];
        const localPayments = Array.isArray(existingData.payments) ? existingData.payments : [];
        const uniquePayments = [];
        const seenPaymentIds = new Set();
        
        // Add Google payments first (they are the truth)
        for (const payment of googlePayments) {
            if (!payment.id) continue;
            const pid = String(payment.id);
            if (!seenPaymentIds.has(pid)) {
                seenPaymentIds.add(pid);
                uniquePayments.push({
                    ...payment,
                    studentId: String(payment.studentId)
                });
            }
        }

        // Add local payments that aren't in Google yet
        for (const payment of localPayments) {
            if (!payment.id) continue;
            const pid = String(payment.id);
            if (!seenPaymentIds.has(pid)) {
                seenPaymentIds.add(pid);
                uniquePayments.push({
                    ...payment,
                    studentId: String(payment.studentId)
                });
            }
        }

        // Deduplicate teachers
        const googleTeachers = googleData.teachers || [];
        const uniqueTeachers = [];
        const seenTeacherIds = new Set();
        for (const teacher of googleTeachers) {
            if (!teacher.id) continue;
            if (!seenTeacherIds.has(teacher.id)) {
                seenTeacherIds.add(teacher.id);
                uniqueTeachers.push(teacher);
            }
        }

        // Deduplicate staff
        const googleStaff = googleData.staff || [];
        const uniqueStaff = [];
        const seenStaffIds = new Set();
        for (const staffMember of googleStaff) {
            if (!staffMember.id) continue;
            if (!seenStaffIds.has(staffMember.id)) {
                seenStaffIds.add(staffMember.id);
                uniqueStaff.push(staffMember);
            }
        }
        
        return {
            ...existingData,
            students: uniqueStudents,
            assessments: uniqueAssessments,
            attendance: uniqueAttendance,
            payments: uniquePayments,
            teachers: uniqueTeachers,
            staff: uniqueStaff
        };
    },

    normalizeStudents(students) {
        return (students || []).map(s => ({
            ...s,
            stream: s.stream || '',
            selectedFees: this.parseSelectedFees(s.selectedFees),
            previousArrears: Number(s.previousArrears) || 0
        }));
    },

    mergeData(existingData, incomingData, type) {
        if (!incomingData) return existingData;

        switch (type) {
            case 'students': {
                const existing = [...(existingData.students || [])];
                const incoming = this.normalizeStudents(incomingData.students || []);
                incoming.forEach(newS => {
                    const idx = existing.findIndex(s => s.admissionNo === newS.admissionNo);
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newS };
                    else existing.push(newS);
                });
                return { ...existingData, students: existing };
            }
            case 'assessments': {
                const existing = [...(existingData.assessments || [])];
                const incoming = this.normalizeAssessments(incomingData.assessments || []);
                incoming.forEach(newA => {
                    const idx = existing.findIndex(a =>
                        a.studentId === newA.studentId &&
                        a.subject === newA.subject &&
                        a.term === newA.term &&
                        a.examType === newA.examType &&
                        a.academicYear === newA.academicYear
                    );
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newA };
                    else existing.push(newA);
                });
                return { ...existingData, assessments: existing };
            }
            case 'payments': {
                const existing = [...(existingData.payments || [])];
                const incoming = incomingData.payments || [];
                incoming.forEach(newP => {
                    const idx = existing.findIndex(p => p.id === newP.id || p.receiptNo === newP.receiptNo);
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newP };
                    else existing.push(newP);
                });
                console.log('Merged payments:', existing.length);
                return { ...existingData, payments: existing };
            }
            case 'remarks': {
                const existing = [...(existingData.remarks || [])];
                const incoming = incomingData.remarks || [];
                incoming.forEach(newR => {
                    const idx = existing.findIndex(r => r.studentId === newR.studentId);
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newR };
                    else existing.push(newR);
                });
                return { ...existingData, remarks: existing };
            }
            case 'senior-school': {
                const existing = [...(existingData.students || [])];
                const incoming = incomingData.students || [];
                incoming.forEach(newS => {
                    const idx = existing.findIndex(s => s.admissionNo === newS.admissionNo);
                    if (idx > -1) {
                        existing[idx] = {
                            ...existing[idx],
                            seniorPathway: newS.seniorPathway,
                            seniorElectives: newS.seniorElectives
                        };
                    }
                });
                return { ...existingData, students: existing };
            }
            case 'all': {
                // Combine existing and incoming students, updating duplicates and deduplicating
                const existingStudents = existingData.students || [];
                const incomingStudents = this.normalizeStudents(incomingData.students || []);

                // Deduplicate incoming by admissionNo
                const uniqueIncoming = incomingStudents.filter((s, index, arr) =>
                    arr.findIndex(x => x.admissionNo === s.admissionNo) === index
                );

                const mergedStudents = [...existingStudents];
                uniqueIncoming.forEach(s => {
                    const idx = mergedStudents.findIndex(x => x.admissionNo === s.admissionNo);
                    if (idx > -1) {
                        // merge updates from sheet
                        mergedStudents[idx] = { ...mergedStudents[idx], ...s };
                    } else {
                        mergedStudents.push(s);
                    }
                });
                // Deduplicate final merged students by admissionNo, keeping the last occurrence
                const dedupedStudents = mergedStudents.filter((s, index, arr) => 
                    arr.findLastIndex(x => x.admissionNo === s.admissionNo) === index
                );

                // do same for assessments
                const existingAssessments = existingData.assessments || [];
                const incomingAssessments = this.normalizeAssessments(incomingData.assessments || []);
                const uniqueIncomingAssess = incomingAssessments.filter((a, index, arr) =>
                    arr.findIndex(x =>
                        `${x.studentId}-${x.subject}-${x.term}-${x.examType}-${x.academicYear}` ===
                        `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`
                    ) === index
                );
                const mergedAssessments = [...existingAssessments];
                uniqueIncomingAssess.forEach(a => {
                    const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
                    const exists = mergedAssessments.some(x =>
                        `${x.studentId}-${x.subject}-${x.term}-${x.examType}-${x.academicYear}` === key
                    );
                    if (!exists) {
                        mergedAssessments.push(a);
                    }
                });
                // Deduplicate final merged assessments
                const dedupedAssessments = mergedAssessments.filter((a, index, arr) => 
                    arr.findLastIndex(x => 
                        `${x.studentId}-${x.subject}-${x.term}-${x.examType}-${x.academicYear}` === 
                        `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`
                    ) === index
                );

                // Merge payments - keep existing, add new ones from sheet
                const existingPayments = existingData.payments || [];
                const incomingPayments = incomingData.payments || [];
                const mergedPayments = [...existingPayments];
                incomingPayments.forEach(p => {
                    const exists = mergedPayments.some(x => x.id === p.id || x.receiptNo === p.receiptNo);
                    if (!exists) {
                        mergedPayments.push(p);
                    }
                });

                // attendance
                const existingAttendance = existingData.attendance || [];
                const incomingAttendance = incomingData.attendance || [];
                const mergedAttendance = [...existingAttendance];
                incomingAttendance.forEach(a => {
                    const exists = mergedAttendance.some(x => x.id === a.id);
                    if (!exists) mergedAttendance.push(a);
                });

                // staff
                const existingStaff = existingData.staff || [];
                const incomingStaff = incomingData.staff || [];
                const mergedStaff = [...existingStaff];
                incomingStaff.forEach(s => {
                    const idx = mergedStaff.findIndex(x => x.id === s.id);
                    if (idx > -1) mergedStaff[idx] = { ...mergedStaff[idx], ...s };
                    else mergedStaff.push(s);
                });

                // teachers
                const existingTeachers = existingData.teachers || [];
                const incomingTeachers = incomingData.teachers || [];
                const mergedTeachers = [...existingTeachers];
                incomingTeachers.forEach(t => {
                    const idx = mergedTeachers.findIndex(x => x.id === t.id);
                    if (idx > -1) mergedTeachers[idx] = { ...mergedTeachers[idx], ...t };
                    else mergedTeachers.push(t);
                });

                console.log('Merge complete - Students:', dedupedStudents.length, 'Assessments:', dedupedAssessments.length, 'Payments:', mergedPayments.length);

                return {
                    ...existingData,
                    settings: { ...existingData.settings, ...(incomingData.settings || {}) },
                    students: dedupedStudents,
                    assessments: dedupedAssessments,
                    attendance: mergedAttendance,
                    payments: mergedPayments,
                    teachers: mergedTeachers,
                    staff: mergedStaff,
                    remarks: existingData.remarks || [],
                    archives: existingData.archives || [],
                    paymentPrompts: existingData.paymentPrompts || [],
                    payroll: existingData.payroll || [],
                    transport: existingData.transport || { routes: [], assignments: [] },
                    library: existingData.library || { books: [], transactions: [] }
                };
            }
            default:
                return { ...existingData, ...incomingData };
        }
    },

    archiveYear(data, nextYearLabel) {
        const snapshot = {
            academicYear: data.settings.academicYear,
            archivedAt: new Date().toISOString(),
            students: JSON.parse(JSON.stringify(data.students)),
            assessments: JSON.parse(JSON.stringify(data.assessments)),
            payments: JSON.parse(JSON.stringify(data.payments)),
            remarks: JSON.parse(JSON.stringify(data.remarks)),
            payroll: JSON.parse(JSON.stringify(data.payroll)),
            transport: JSON.parse(JSON.stringify(data.transport || { routes: [], assignments: [] })),
            library: JSON.parse(JSON.stringify(data.library || { books: [], transactions: [] })),
            settings: JSON.parse(JSON.stringify(data.settings))
        };

        return {
            ...data,
            archives: [...(data.archives || []), snapshot],
            // Reset for new year
            assessments: [],
            payments: [],
            remarks: [],
            payroll: [],
            transport: { ...(data.transport || {}), assignments: [] },
            library: { ...(data.library || {}), transactions: [] },
            settings: {
                ...data.settings,
                academicYear: nextYearLabel
            }
        };
    },

    // Restore an archived academic year back into the active dataset (undo archive).
    // Pass the academicYear string (e.g. '2025/2026') to restore that snapshot.
    restoreArchive(data, academicYear) {
        if (!data.archives || data.archives.length === 0) return data;
        const idx = (data.archives || []).findIndex(a => a.academicYear === academicYear);
        if (idx === -1) return data;

        const snapshot = JSON.parse(JSON.stringify(data.archives[idx]));

        // Remove the snapshot from archives
        const updatedArchives = (data.archives || []).filter((_, i) => i !== idx);

        // Merge snapshot back into active area: restore assessments, payments, remarks, payroll, transport, library, and settings
        const restored = {
            ...data,
            assessments: snapshot.assessments || [],
            payments: snapshot.payments || [],
            remarks: snapshot.remarks || [],
            payroll: snapshot.payroll || [],
            transport: snapshot.transport || { routes: [], assignments: [] },
            library: snapshot.library || { books: [], transactions: [] },
            settings: { ...data.settings, ...snapshot.settings },
            archives: updatedArchives
        };

        // Set academicYear to restored snapshot year for clarity
        restored.settings.academicYear = snapshot.academicYear || restored.settings.academicYear;

        return restored;
    },

    getSubjectsForGrade(grade, student = null) {
        const seniorGrades = ['GRADE 10', 'GRADE 11', 'GRADE 12'];

        if (grade === 'PP1' || grade === 'PP2') {
            return ['Mathematics activities', 'Language activities', 'Literacy', 'Kiswahili', 'Environmental Activities', 'Creative Activities', 'Religious Education Activities'];
        } else if (grade === 'GRADE 1' || grade === 'GRADE 2' || grade === 'GRADE 3') {
            return ['INDIGENOUS LANGUAGE ACTIVITIES', 'KISWAHILI/KSL ACTIVITIES', 'ENGLISH LANGUAGE ACTIVITIES', 'MATHEMATIC ACTIVITIES', 'RELIGIOUS EDUCATION ACTIVITIES', 'ENVIRONMENTAL ACTIVITIES', 'CREATIVE ART ACTIVITIES'];
        } else if (grade === 'GRADE 4' || grade === 'GRADE 5' || grade === 'GRADE 6') {
            return ['ENGLISH', 'KISWAHILI/KSL', 'MATHEMATICS', 'AGRICULTURE', 'SOCIAL STUDIES', 'RELIGIOUS EDUCATION', 'CREATIVE ARTS', 'SCIENCE & TECHNOLOGY'];
        } else if (['GRADE 7', 'GRADE 8', 'GRADE 9'].includes(grade)) {
            return ['ENGLISH', 'MATHEMATICS', 'KISWAHILI/KSL', 'SOCIAL STUDIES', 'PRE-TECHNICAL STUDIES', 'CREATIVE ARTS & SPORTS', 'AGRICULTURE & NUTRITION', 'INTEGRATED SCIENCE', 'RELIGIOUS EDUCATION'];
        } else if (seniorGrades.includes(grade)) {
            // Core subjects
            const core = ['English', 'Kiswahili', 'Mathematics', 'CSL'];
            if (student && student.seniorElectives) {
                return [...core, ...student.seniorElectives];
            }

            // For general list (like Assessment dropdown), return core + common electives
            return [...core,
                'Biology', 'Chemistry', 'Physics', 'Agriculture', 'Computer Studies',
                'History and Citizenship', 'Geography', 'CRE', 'IRE', 'Accounting',
                'Economics', 'Fine Arts', 'Music and Dance', 'Sports Science', 'Business Studies',
                'Physical Education', 'ICT'
            ];
        }
        return ['Mathematics', 'English', 'Science'];
    },

    getStreams(settings) {
        return settings.streams || ['A', 'B', 'C'];
    },

    getGradeWithStream(grade, stream) {
        if (!stream || stream === '') return grade;
        return `${grade} ${stream}`;
    },

    getGradeFromCombined(combined) {
        if (!combined) return '';
        const streamMatch = combined.match(/^(.+?)\s+([A-Z])$/);
        if (streamMatch) {
            return { grade: streamMatch[1], stream: streamMatch[2] };
        }
        return { grade: combined, stream: '' };
    }
};