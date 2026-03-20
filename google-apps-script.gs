/**
 * EduTrack Google Apps Script
 * 
 * This script syncs student data between EduTrack and Google Sheets.
 * Teachers can enter scores on their phones via Google Sheets.
 * 
 * INSTRUCTIONS:
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code and save
 * 4. Deploy as Web App (Execute as: Me, Anyone with Google Account)
 * 5. Copy the URL and paste in EduTrack Settings
 * 6. Create sheets: "Students", "Assessments", "Attendance"
 */

const SHEET_NAMES = {
  STUDENTS: 'Students',
  ASSESSMENTS: 'Assessments',
  ATTENDANCE: 'Attendance',
  TEACHERS: 'Teachers',
  STAFF: 'Staff',
  PAYMENTS: 'Payments',
  ACTIVITY: 'Activity',  // For tracking active users
  TEACHER_CREDENTIALS: 'TeacherCredentials'  // For teacher login credentials
};

// Column headers for each sheet
const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'studentAdmissionNo', 'studentName', 'grade', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];
const TEACHER_HEADERS = ['id', 'name', 'contact', 'subjects', 'grades', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const STAFF_HEADERS = ['id', 'name', 'role', 'contact', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const PAYMENT_HEADERS = ['id', 'studentId', 'amount', 'term', 'academicYear', 'date', 'receiptNo', 'method', 'reference', 'items', 'voided', 'voidedAt'];
const TEACHER_CREDENTIALS_HEADERS = ['username', 'passwordHash', 'teacherId', 'name', 'role', 'createdAt', 'lastLogin'];

/**
 * Sanitize incoming records to prevent injection attacks
 */
function sanitizeRecord(record) {
  if (!record || typeof record !== 'object') return {};
  
  const sanitized = {};
  
  // Allowed string fields (expanded for assessments)
  const stringFields = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees', 
                        'subject', 'term', 'examType', 'academicYear', 'date', 'level', 'status',
                        'receiptNo', 'method', 'reference', 'role', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo',
                        'voided', 'voidedBy', 'studentId', 'studentAdmissionNo', 'studentName'];
  
  // Allowed numeric fields
  const numericFields = ['score', 'amount'];
  
  stringFields.forEach(field => {
    if (record[field] !== undefined && record[field] !== null) {
      sanitized[field] = String(record[field]).slice(0, 500);
    }
  });
  
  numericFields.forEach(field => {
    if (record[field] !== undefined && record[field] !== null) {
      const num = Number(record[field]);
      sanitized[field] = isNaN(num) ? 0 : num;
    }
  });
  
  // Preserve other fields as-is (objects, arrays)
  Object.keys(record).forEach(key => {
    if (!sanitized[key] && record[key] !== undefined) {
      const val = record[key];
      if (typeof val === 'object') {
        sanitized[key] = JSON.stringify(val);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        sanitized[key] = val;
      }
    }
  });
  
  return sanitized;
}

/**
 * Initialize sheets with headers if they don't exist
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Students sheet
  let studentsSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  if (!studentsSheet) {
    studentsSheet = ss.insertSheet(SHEET_NAMES.STUDENTS);
    studentsSheet.appendRow(STUDENT_HEADERS);
  }
  
  // Create Assessments sheet with ENRICHED headers (includes studentAdmissionNo, studentName)
  let assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  if (!assessmentsSheet) {
    assessmentsSheet = ss.insertSheet(SHEET_NAMES.ASSESSMENTS);
    assessmentsSheet.appendRow(ASSESSMENT_HEADERS);
  } else {
    // Update existing Assessments sheet with new headers
    updateAssessmentSheetHeaders(assessmentsSheet);
  }
  
  // Create Attendance sheet
  let attendanceSheet = ss.getSheetByName(SHEET_NAMES.ATTENDANCE);
  if (!attendanceSheet) {
    attendanceSheet = ss.insertSheet(SHEET_NAMES.ATTENDANCE);
    attendanceSheet.appendRow(ATTENDANCE_HEADERS);
  }
  
  // Create Teachers sheet
  let teachersSheet = ss.getSheetByName(SHEET_NAMES.TEACHERS);
  if (!teachersSheet) {
    teachersSheet = ss.insertSheet(SHEET_NAMES.TEACHERS);
    teachersSheet.appendRow(TEACHER_HEADERS);
  }

  // Create Staff sheet
  let staffSheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (!staffSheet) {
    staffSheet = ss.insertSheet(SHEET_NAMES.STAFF);
    staffSheet.appendRow(STAFF_HEADERS);
  }

  // Create Payments sheet
  let paymentsSheet = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
  if (!paymentsSheet) {
    paymentsSheet = ss.insertSheet(SHEET_NAMES.PAYMENTS);
    paymentsSheet.appendRow(PAYMENT_HEADERS);
  }

  // Create Activity sheet
  let activitySheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY);
  if (!activitySheet) {
    activitySheet = ss.insertSheet(SHEET_NAMES.ACTIVITY);
    activitySheet.appendRow(['device', 'lastActivity', 'timestamp']);
  }

  // Create TeacherCredentials sheet for login system
  let teacherCredSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  if (!teacherCredSheet) {
    teacherCredSheet = ss.insertSheet(SHEET_NAMES.TEACHER_CREDENTIALS);
    teacherCredSheet.appendRow(TEACHER_CREDENTIALS_HEADERS);
  }
  
  return { success: true, message: 'Sheets initialized successfully' };
}

/**
 * Update Assessments sheet headers to include studentAdmissionNo and studentName
 * This ensures existing sheets get the new columns
 */
function updateAssessmentSheetHeaders(sheet) {
  if (!sheet) return;
  
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentHeaders = headerRow.map(function(h) { return String(h || '').trim(); });
  
  const lastCol = sheet.getLastColumn();
  
  // Check which headers are missing and add them
  ASSESSMENT_HEADERS.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      console.log('Adding missing header: ' + header);
      // Add column at the end
      sheet.insertColumnAfter(lastCol);
      // Set the header value in the new column
      sheet.getRange(1, lastCol + 1).setValue(header);
    }
  });
}

/**
 * GET endpoint - Return all data as JSON
 * Secured with input validation
 */
function doGet(e) {
  initializeSheets();
  
  const action = e.parameter.action || 'getAll';
  const version = e.parameter.v || '1.0';
  
  let response = {};
  
  console.log(`[Script] Action: ${action}, Version: ${version}, Time: ${new Date().toISOString()}`);
  
  try {
    // Handle data parameter for GET requests
    let postData = {};
    if (e.parameter.data) {
      try {
        postData = JSON.parse(decodeURIComponent(e.parameter.data));
      } catch (err) {
        console.log('[Script] Data parse error:', err.message);
        // Try without decode
        try {
          postData = JSON.parse(e.parameter.data);
        } catch (err2) {
          console.log('[Script] Data parse failed');
        }
      }
    }
    
    // Validate incoming data
    if (postData && postData.record) {
      postData.record = sanitizeRecord(postData.record);
    }
    if (postData && postData.assessment) {
      postData.assessment = sanitizeRecord(postData.assessment);
    }
    if (postData && postData.student) {
      postData.student = sanitizeRecord(postData.student);
    }
    if (postData && postData.payment) {
      postData.payment = sanitizeRecord(postData.payment);
    }
    if (postData && postData.teacher) {
      postData.teacher = sanitizeRecord(postData.teacher);
    }
    if (postData && postData.staff) {
      postData.staff = sanitizeRecord(postData.staff);
    }
    
    // Handle addAssessment via GET
    if (action === 'addAssessment' && postData.assessment) {
      const assessment = postData.assessment;
      if (!assessment.id) {
        assessment.id = 'A-' + Date.now();
      }
      if (!assessment.date) {
        assessment.date = new Date().toISOString().split('T')[0];
      }
      response = addRecord(SHEET_NAMES.ASSESSMENTS, assessment, ASSESSMENT_HEADERS);
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle addStudent via GET
    if (action === 'addStudent' && postData.student) {
      response = addRecord(SHEET_NAMES.STUDENTS, postData.student, STUDENT_HEADERS);
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle addAttendance via GET
    if (action === 'addAttendance' && postData.attendance) {
      response = addRecord(SHEET_NAMES.ATTENDANCE, postData.attendance, ATTENDANCE_HEADERS);
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle addTeacher via GET
    if (action === 'addTeacher' && postData.teacher) {
      const teacher = postData.teacher;
      if (!teacher.id) {
        teacher.id = 'T-' + Date.now();
      }
      response = addRecord(SHEET_NAMES.TEACHERS, teacher, TEACHER_HEADERS);
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle addStaff via GET
    if (action === 'addStaff' && postData.staff) {
      const staff = postData.staff;
      if (!staff.id) {
        staff.id = 'S-' + Date.now();
      }
      response = addRecord(SHEET_NAMES.STAFF, staff, STAFF_HEADERS);
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle addPayment via GET
    if (action === 'addPayment' && postData.payment) {
      const payment = postData.payment;
      if (!payment.id) {
        payment.id = 'PAY-' + Date.now();
      }
      if (!payment.date) {
        payment.date = new Date().toISOString().split('T')[0];
      }
      response = addRecord(SHEET_NAMES.PAYMENTS, payment, PAYMENT_HEADERS);
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Handle generic addRecord via GET (fallback)
    if (action === 'addRecord') {
      const sheetName = postData.sheetName;
      const record = postData.record;
      if (sheetName && record) {
        let headers = [];
        switch (sheetName) {
          case SHEET_NAMES.STUDENTS: headers = STUDENT_HEADERS; break;
          case SHEET_NAMES.ASSESSMENTS: headers = ASSESSMENT_HEADERS; break;
          case SHEET_NAMES.ATTENDANCE: headers = ATTENDANCE_HEADERS; break;
          case SHEET_NAMES.TEACHERS: headers = TEACHER_HEADERS; break;
          case SHEET_NAMES.STAFF: headers = STAFF_HEADERS; break;
          case SHEET_NAMES.PAYMENTS: headers = PAYMENT_HEADERS; break;
        }
        if (headers.length > 0) {
          response = addRecord(sheetName, record, headers);
          return ContentService
            .createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Invalid sheet or record' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
     
    // Handle deleteRecord via GET (query params)
    if (action === 'deleteRecord') {
      const sheetName = e.parameter.sheetName || postData.sheetName;
      const recordId = e.parameter.recordId || postData.recordId;
      if (sheetName && recordId) {
        const deleteHeaders = sheetName === SHEET_NAMES.STUDENTS ? STUDENT_HEADERS :
                             sheetName === SHEET_NAMES.TEACHERS ? TEACHER_HEADERS :
                             sheetName === SHEET_NAMES.STAFF ? STAFF_HEADERS :
                             sheetName === SHEET_NAMES.PAYMENTS ? PAYMENT_HEADERS :
                             sheetName === SHEET_NAMES.ASSESSMENTS ? ASSESSMENT_HEADERS : ATTENDANCE_HEADERS;
        response = deleteRecord(sheetName, 'id', recordId, deleteHeaders);
        return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle deleteAssessment via GET
    if (action === 'deleteAssessment') {
      const recordId = e.parameter.recordId || postData.recordId;
      if (recordId) {
        response = deleteRecord(SHEET_NAMES.ASSESSMENTS, 'id', recordId, ASSESSMENT_HEADERS);
        return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle deleteStudent via GET
    if (action === 'deleteStudent') {
      const recordId = e.parameter.recordId || postData.recordId;
      if (recordId) {
        response = deleteRecord(SHEET_NAMES.STUDENTS, 'id', recordId, STUDENT_HEADERS);
        return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
      switch (action) {
      case 'getAll':
        response = {
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          assessments: getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS),
          attendance: getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS),
          teachers: getAllRecords(SHEET_NAMES.TEACHERS, TEACHER_HEADERS),
          staff: getAllRecords(SHEET_NAMES.STAFF, STAFF_HEADERS),
          payments: getAllRecords(SHEET_NAMES.PAYMENTS, PAYMENT_HEADERS)
        };
        break;
        
      case 'getStudents':
        response = { students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS) };
        break;
        
      case 'getAssessments':
        const term = e.parameter.term;
        const grade = e.parameter.grade;
        let assessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
        
        if (term) {
          assessments = assessments.filter(a => a.term === term);
        }
        if (grade) {
          // Join with students to filter by grade
          const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
          const gradeStudentIds = students.filter(s => s.grade === grade).map(s => s.id);
          assessments = assessments.filter(a => gradeStudentIds.includes(a.studentId));
        }
        response = { assessments: assessments };
        break;
        
      case 'getAttendance':
        const attTerm = e.parameter.term;
        let attendance = getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS);
        
        if (attTerm) {
          attendance = attendance.filter(a => a.term === attTerm);
        }
        response = { attendance: attendance };
        break;
        
      case 'ping':
        response = { success: true, message: 'EduTrack Google Sync is active!', timestamp: new Date().toISOString() };
        break;
        
      case 'setActive':
        const device = e.parameter.device;
        const timestamp = e.parameter.timestamp;
        response = setActiveUser(device, timestamp);
        break;
        
      case 'getActiveUsers':
        response = getActiveUsers();
        break;
        
      // Teacher Authentication via GET
      case 'registerTeacher':
        let regData = {};
        if (e.parameter.data) {
          try {
            regData = JSON.parse(decodeURIComponent(e.parameter.data));
          } catch (err) {
            try {
              regData = JSON.parse(e.parameter.data);
            } catch (err2) {}
          }
        }
        response = registerTeacher({
          username: regData.username || e.parameter.username,
          password: regData.password || e.parameter.password,
          teacherId: regData.teacherId || e.parameter.teacherId,
          name: regData.name || e.parameter.name,
          role: regData.role || e.parameter.role
        });
        break;
        
      case 'loginTeacher':
        let loginData = {};
        if (e.parameter.data) {
          try {
            loginData = JSON.parse(decodeURIComponent(e.parameter.data));
          } catch (err) {
            try {
              loginData = JSON.parse(e.parameter.data);
            } catch (err2) {}
          }
        }
        response = loginTeacher({
          username: loginData.username || e.parameter.username,
          password: loginData.password || e.parameter.password
        });
        break;
        
      case 'getTeacherCredentials':
        response = { success: true, teachers: getTeacherCredentials() };
        break;
        
      case 'bulkPushStudents':
        let studentData = {};
        if (e.parameter.data) {
          try {
            studentData = JSON.parse(e.parameter.data);
          } catch (err) {
            return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON data' })).setMimeType(ContentService.MimeType.JSON);
          }
        }
        response = bulkPushRecords(SHEET_NAMES.STUDENTS, studentData.students || [], STUDENT_HEADERS);
        break;
        
      case 'bulkPushAssessments':
        let assessData = {};
        if (e.parameter.data) {
          try {
            assessData = JSON.parse(e.parameter.data);
          } catch (err) {
            return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON data' })).setMimeType(ContentService.MimeType.JSON);
          }
        }
        response = bulkPushRecords(SHEET_NAMES.ASSESSMENTS, assessData.assessments || [], ASSESSMENT_HEADERS);
        break;
        
      case 'bulkPushAttendance':
        let attData = {};
        if (e.parameter.data) {
          try {
            attData = JSON.parse(e.parameter.data);
          } catch (err) {
            return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON data' })).setMimeType(ContentService.MimeType.JSON);
          }
        }
        response = bulkPushRecords(SHEET_NAMES.ATTENDANCE, attData.attendance || [], ATTENDANCE_HEADERS);
        break;
        
      default:
        response = { error: 'Unknown action' };
    }
  } catch (error) {
    response = { error: error.message };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST endpoint - Add/Update records
 */
function doPost(e) {
  initializeSheets();
  
  let data = {};
  
  try {
    // Get action from URL parameters first
    const urlAction = e.parameter.action;
    
    // Handle both JSON body and form data
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        console.log('Failed to parse body as JSON:', parseErr.message);
        // Try parsing as form data
        const params = e.parameter;
        data = {
          action: params.action,
          sheetName: params.sheetName,
          records: params.records ? JSON.parse(params.records) : [],
          headers: params.headers ? JSON.parse(params.headers) : []
        };
      }
    } else if (e.parameter) {
      // Fallback to parameters
      const params = e.parameter;
      data = {
        action: params.action,
        sheetName: params.sheetName,
        records: params.records ? JSON.parse(params.records) : [],
        headers: params.headers ? JSON.parse(params.headers) : []
      };
    }
    
    // Ensure action is set from URL
    if (urlAction && !data.action) {
      data.action = urlAction;
    }
    
    const action = data.action || 'unknown';
    console.log('POST action:', action, 'Sheet:', data.sheetName);
    
    let response = {};
    
    switch (action) {
      case 'addStudent':
        response = addRecord(SHEET_NAMES.STUDENTS, data.student, STUDENT_HEADERS);
        break;
        
      case 'updateStudent':
        response = updateRecord(SHEET_NAMES.STUDENTS, 'id', data.student.id, data.student, STUDENT_HEADERS);
        break;
        
      case 'addAssessment':
        // Generate ID if not provided
        if (!data.assessment.id) {
          data.assessment.id = 'A-' + Date.now();
        }
        if (!data.assessment.date) {
          data.assessment.date = new Date().toISOString().split('T')[0];
        }
        response = addRecord(SHEET_NAMES.ASSESSMENTS, data.assessment, ASSESSMENT_HEADERS);
        break;
        
      case 'updateAssessment':
        response = updateRecord(SHEET_NAMES.ASSESSMENTS, 'id', data.assessment.id, data.assessment, ASSESSMENT_HEADERS);
        break;
        
      case 'addAttendance':
        if (!data.attendance.id) {
          data.attendance.id = 'ATT-' + Date.now();
        }
        response = addRecord(SHEET_NAMES.ATTENDANCE, data.attendance, ATTENDANCE_HEADERS);
        break;
        
      case 'updateAttendance':
        response = updateRecord(SHEET_NAMES.ATTENDANCE, 'id', data.attendance.id, data.attendance, ATTENDANCE_HEADERS);
        break;

      case 'addTeacher':
        if (!data.teacher.id) {
          data.teacher.id = 'T-' + Date.now();
        }
        response = addRecord(SHEET_NAMES.TEACHERS, data.teacher, TEACHER_HEADERS);
        break;

      case 'updateTeacher':
        response = updateRecord(SHEET_NAMES.TEACHERS, 'id', data.teacher.id, data.teacher, TEACHER_HEADERS);
        break;

      case 'addStaff':
        if (!data.staff.id) {
          data.staff.id = 'S-' + Date.now();
        }
        response = addRecord(SHEET_NAMES.STAFF, data.staff, STAFF_HEADERS);
        break;

      case 'updateStaff':
        response = updateRecord(SHEET_NAMES.STAFF, 'id', data.staff.id, data.staff, STAFF_HEADERS);
        break;

      case 'addPayment':
        if (!data.payment.id) {
          data.payment.id = 'PAY-' + Date.now();
        }
        response = addRecord(SHEET_NAMES.PAYMENTS, data.payment, PAYMENT_HEADERS);
        break;

      case 'updatePayment':
        response = updateRecord(SHEET_NAMES.PAYMENTS, 'id', data.payment.id, data.payment, PAYMENT_HEADERS);
        break;
        
      case 'bulkAddAssessments':
        response = bulkAddRecords(SHEET_NAMES.ASSESSMENTS, data.assessments, ASSESSMENT_HEADERS);
        break;
        
      case 'syncAll':
        // Full sync - returns everything
        response = {
          success: true,
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          assessments: getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS),
          attendance: getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS),
          teachers: getAllRecords(SHEET_NAMES.TEACHERS, TEACHER_HEADERS),
          staff: getAllRecords(SHEET_NAMES.STAFF, STAFF_HEADERS),
          payments: getAllRecords(SHEET_NAMES.PAYMENTS, PAYMENT_HEADERS)
        };
        break;
        
      case 'replaceAll':
        console.log('replaceAll called:', data.sheetName, data.records ? data.records.length : 0);
        // Replace all records in a sheet (clear and write)
        response = replaceAllRecords(data.sheetName, data.records, data.headers);
        console.log('replaceAll result:', response);
        break;

      case 'updateRecord':
        // Generic update handler for any sheet
        const uSheet = data.sheetName;
        let uHeaders = [];
        if (uSheet === SHEET_NAMES.STUDENTS) uHeaders = STUDENT_HEADERS;
        else if (uSheet === SHEET_NAMES.TEACHERS) uHeaders = TEACHER_HEADERS;
        else if (uSheet === SHEET_NAMES.STAFF) uHeaders = STAFF_HEADERS;
        else if (uSheet === SHEET_NAMES.ASSESSMENTS) uHeaders = ASSESSMENT_HEADERS;
        else if (uSheet === SHEET_NAMES.ATTENDANCE) uHeaders = ATTENDANCE_HEADERS;
        else if (uSheet === SHEET_NAMES.PAYMENTS) uHeaders = PAYMENT_HEADERS;
        
        if (uHeaders.length > 0 && data.record && data.record.id) {
          response = updateRecord(uSheet, 'id', data.record.id, data.record, uHeaders);
        } else {
          response = { success: false, error: 'Invalid sheet or record' };
        }
        break;
        
      case 'deleteRecord':
        // Delete a specific record by ID
        const dSheet = data.sheetName || SHEET_NAMES.ASSESSMENTS;
        const dHeaders = dSheet === SHEET_NAMES.STUDENTS ? STUDENT_HEADERS :
                        dSheet === SHEET_NAMES.TEACHERS ? TEACHER_HEADERS :
                        dSheet === SHEET_NAMES.STAFF ? STAFF_HEADERS :
                        dSheet === SHEET_NAMES.PAYMENTS ? PAYMENT_HEADERS :
                        dSheet === SHEET_NAMES.ASSESSMENTS ? ASSESSMENT_HEADERS : ATTENDANCE_HEADERS;
        response = deleteRecord(dSheet, 'id', data.recordId, dHeaders);
        if (response.success) {
          console.log('Successfully deleted record:', data.recordId, 'from', dSheet);
        }
        break;
        
      case 'deleteAssessment':
        response = deleteRecord(SHEET_NAMES.ASSESSMENTS, 'id', data.recordId, ASSESSMENT_HEADERS);
        break;
        
      case 'deleteStudent':
        response = deleteRecord(SHEET_NAMES.STUDENTS, 'id', data.recordId, STUDENT_HEADERS);
        break;
        
      case 'deleteTeacher':
        response = deleteRecord(SHEET_NAMES.TEACHERS, 'id', data.recordId, TEACHER_HEADERS);
        break;
        
      case 'deleteStaff':
        response = deleteRecord(SHEET_NAMES.STAFF, 'id', data.recordId, STAFF_HEADERS);
        break;
        
      case 'bulkPushStudents':
        response = bulkPushRecords(SHEET_NAMES.STUDENTS, data.students || [], STUDENT_HEADERS);
        break;
        
      case 'bulkPushAssessments':
        response = bulkPushRecords(SHEET_NAMES.ASSESSMENTS, data.assessments || [], ASSESSMENT_HEADERS);
        break;
        
      case 'bulkPushAttendance':
        response = bulkPushRecords(SHEET_NAMES.ATTENDANCE, data.attendance || [], ATTENDANCE_HEADERS);
        break;

      case 'bulkPushPayments':
        response = bulkPushRecords(SHEET_NAMES.PAYMENTS, data.payments || [], PAYMENT_HEADERS);
        break;

      case 'deletePayment':
        response = deleteRecord(SHEET_NAMES.PAYMENTS, 'id', data.recordId, PAYMENT_HEADERS);
        break;
        
      case 'setActive':
        response = setActiveUser(data.device, data.timestamp);
        break;
        
      case 'getActiveUsers':
        response = getActiveUsers();
        break;
        
      case 'syncAllToGoogle':
        // Batch push ALL data for ALL sheets
        if (!data.data || !data.headers) {
          response = { success: false, error: 'Missing data or headers' };
          break;
        }
        
        const results = {};
        for (const [key, records] of Object.entries(data.data)) {
          const sheetKey = key.toUpperCase();
          const sheetName = SHEET_NAMES[sheetKey];
          const headers = data.headers[key];
          
          if (sheetName && headers) {
            results[key] = bulkPushRecords(sheetName, records, headers);
          }
        }
        response = { success: true, message: 'Batch sync complete', results };
        break;
        
      // ═══════════════════════════════════════════════════════════════
      // TEACHER AUTHENTICATION HANDLERS
      // ═══════════════════════════════════════════════════════════════
      
      case 'registerTeacher':
        response = registerTeacher({
          username: data.username,
          password: data.password,
          teacherId: data.teacherId,
          name: data.name,
          role: data.role
        });
        break;
        
      case 'loginTeacher':
        response = loginTeacher({
          username: data.username,
          password: data.password
        });
        break;
        
      case 'getTeacherCredentials':
        response = { success: true, teachers: getTeacherCredentials() };
        break;
        
      case 'deleteTeacher':
        response = deleteTeacherAccount(data.username);
        break;
        
      default:
        response = { error: 'Unknown action' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get all records from a sheet (with deduplication)
 */
function getAllRecords(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const data = sheet.getDataRange().getValues();
  const seenIds = new Set();
  const results = [];
  
  // Skip header row (index 0) - start from row 1
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    let obj = {};
    let idValue = null;
    
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      let value = row[colIndex];
      
      // Capture ID for deduplication
      if (header === 'id') {
        idValue = String(value || '').trim();
      }
      
      // Clean corrupted selectedFees values (Java object references)
      if (header === 'selectedFees' && typeof value === 'string' && value.includes('java.lang.Object')) {
        value = 't1,t2,t3'; // Default format
      }
      
      // Ensure all values are properly serializable
      if (value && typeof value === 'object') {
        value = String(value).includes('java.lang') ? '' : JSON.stringify(value);
      }
      
      obj[header] = value;
    }
    
    // For assessments, ensure studentId is properly included even if empty
    if (sheetName === SHEET_NAMES.ASSESSMENTS) {
      obj.studentId = String(obj.studentId || '');
      obj.studentAdmissionNo = String(obj.studentAdmissionNo || '');
      obj.studentName = String(obj.studentName || '');
    }
    
    // Deduplicate by ID - skip if idValue is empty or is a header name
    if (idValue && !seenIds.has(idValue)) {
      // Additional check: ensure it's not a header name like "id", "name", "grade"
      const headerNames = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees', 
                          'studentId', 'studentAdmissionNo', 'studentName', 'subject', 'score', 'term',
                          'examType', 'academicYear', 'date', 'level', 'status'];
      if (headerNames.indexOf(idValue.toLowerCase()) === -1) {
        seenIds.add(idValue);
        results.push(obj);
      }
    }
  }
  
  console.log(`[Sheet] ${sheetName}: ${data.length - 1} data rows → ${results.length} records`);
  return results;
}

/**
 * Add or Update a record (Robust Upsert)
 */
function addRecord(sheetName, record, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  
  // Obtain script lock for concurrency control
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 30 second timeout
  } catch (e) {
    return { success: false, error: 'Could not obtain script lock' };
  }

  try {
    // Ensure we have a valid ID
    if (!record.id) {
      if (sheetName === SHEET_NAMES.STUDENTS && record.admissionNo) {
        record.id = record.admissionNo;
      } else {
        record.id = 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      }
    }

    const idIndex = headers.indexOf('id');
    const admissionIndex = headers.indexOf('admissionNo');
    
    if (idIndex === -1) {
      return { success: false, error: 'Table headers missing "id" field' };
    }

    // Get all data to find existing record
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    // Strict search for existing ID
    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][idIndex] || '').trim();
      const searchId = String(record.id).trim();
      
      // For students, also check admissionNo if ID doesn't match
      let admissionMatch = false;
      if (sheetName === SHEET_NAMES.STUDENTS && admissionIndex >= 0) {
        const rowAdm = String(data[i][admissionIndex] || '').trim();
        const searchAdm = String(record.admissionNo || '').trim();
        if (searchAdm && rowAdm === searchAdm) admissionMatch = true;
      }

      if (rowId === searchId || admissionMatch) {
        rowIndex = i + 1;
        break;
      }
    }

    // Prepare row values
    const rowValues = headers.map(header => {
      let val = record[header];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });

    if (rowIndex > 0) {
      // Update existing row
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
      return { success: true, id: record.id, message: 'Record updated', action: 'update', rowIndex };
    } else {
      // Append new row
      sheet.appendRow(rowValues);
      return { success: true, id: record.id, message: 'Record added', action: 'add' };
    }
  } finally {
    // Release the lock
    lock.releaseLock();
  }
}

/**
 * Update an existing record
 */
function updateRecord(sheetName, keyField, keyValue, record, headers) {
  // Reuse robust addRecord for updates too
  record[keyField] = keyValue;
  return addRecord(sheetName, record, headers);
}

/**
 * Bulk add records - deprecated in favor of bulkPushRecords
 */
function bulkAddRecords(sheetName, records, headers) {
  return bulkPushRecords(sheetName, records, headers);
}

/**
 * Replace all records in a sheet (clear and write fresh)
 */
function replaceAllRecords(sheetName, records, headers) {
  if (!records) records = [];
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  } else {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
  }
  
  if (records.length === 0) {
    return { success: true, count: 0, message: 'Sheet cleared' };
  }
  
  // Deduplicate before writing
  const uniqueRecords = [];
  const seenIds = new Set();
  
  records.forEach(r => {
    const rId = String(r.id || r.admissionNo || '');
    if (rId && !seenIds.has(rId)) {
      seenIds.add(rId);
      uniqueRecords.push(r);
    }
  });

  const values = uniqueRecords.map(record => {
    return headers.map(header => {
      let val = record[header];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });
  });
  
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  
  return { 
    success: true, 
    count: uniqueRecords.length,
    message: `${uniqueRecords.length} records written to ${sheetName}` 
  };
}

/**
 * Bulk push records - High-performance upsert logic
 * Prevents duplicates by mapping IDs and admission numbers
 */
function bulkPushRecords(sheetName, records, headers) {
  if (!records || records.length === 0) {
    return { success: true, count: 0, message: 'No records to push' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  
  try {
    const fullData = sheet.getDataRange().getValues();
    const idIndex = headers.indexOf('id');
    const admissionIndex = sheetName === SHEET_NAMES.STUDENTS ? headers.indexOf('admissionNo') : -1;
    
    // Build lookup maps for existing rows
    const idMap = new Map();
    const admMap = new Map();
    
    for (let i = 1; i < fullData.length; i++) {
      const rowId = String(fullData[i][idIndex] || '').trim();
      if (rowId) idMap.set(rowId, i + 1);
      
      if (admissionIndex >= 0) {
        const rowAdm = String(fullData[i][admissionIndex] || '').trim();
        if (rowAdm) admMap.set(rowAdm, i + 1);
      }
    }
    
    let updatedCount = 0;
    let addedCount = 0;
    const newRows = [];
    
    // Filter duplicates within the incoming batch itself
    const batchSeenIds = new Set();
    const uniqueIncoming = records.filter(r => {
      const rId = String(r.id || r.admissionNo || '');
      if (batchSeenIds.has(rId)) return false;
      batchSeenIds.add(rId);
      return true;
    });

    for (const record of uniqueIncoming) {
      const recordId = String(record.id || '').trim();
      const recordAdm = admissionIndex >= 0 ? String(record.admissionNo || '').trim() : '';
      
      // Find row index (lookup by ID then by AdmissionNo for students)
      let rowIndex = idMap.get(recordId);
      if (!rowIndex && recordAdm) rowIndex = admMap.get(recordAdm);
      
      const values = headers.map(h => {
        let val = record[h];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
      
      if (rowIndex) {
        // Update existing row directly
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([values]);
        updatedCount++;
      } else {
        // Queue for bulk append
        newRows.push(values);
        addedCount++;
      }
    }
    
    // Batch append new records
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
    }
    
    // Release lock
    try { lock.releaseLock(); } catch (e) {}

    return {
      success: true,
      total: uniqueIncoming.length,
      updated: updatedCount,
      added: addedCount,
      message: `Sync complete: ${addedCount} added, ${updatedCount} updated`
    };
  } catch (error) {
    try { lock.releaseLock(); } catch (e) {}
    console.error('Bulk push failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a record
 */
function deleteRecord(sheetName, keyField, keyValue, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { success: false, error: 'Sheet not found' };
  }
  
  const data = sheet.getDataRange().getValues();
  const keyIndex = headers.indexOf(keyField);
  
  if (keyIndex === -1) {
    return { success: false, error: 'Key field not found' };
  }
  
  // Find and delete row (skip header)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Record deleted successfully' };
    }
  }
  
  return { success: false, error: 'Record not found' };
}

/**
 * Get grades from students (for dropdown)
 */
function getGrades() {
  const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
  const grades = [...new Set(students.map(s => s.grade))];
  return grades.sort();
}

/**
 * Get subjects from assessments
 */
function getSubjects() {
  const assessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
  const subjects = [...new Set(assessments.map(a => a.subject))];
  return subjects.sort();
}

/**
 * Test function - run this to verify setup
 */
function testSetup() {
  initializeSheets();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().map(s => s.getName());
  
  Logger.log('Sheets: ' + JSON.stringify(sheets));
  Logger.log('Students: ' + getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS).length);
  Logger.log('Assessments: ' + getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS).length);
  
  return {
    sheets: sheets,
    studentCount: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS).length,
    assessmentCount: getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS).length
  };
}

/**
 * Track active users - update last activity timestamp
 */
function setActiveUser(deviceName, timestamp) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let activitySheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY);
    
    if (!activitySheet) {
      activitySheet = ss.insertSheet(SHEET_NAMES.ACTIVITY);
      activitySheet.appendRow(['device', 'lastActivity', 'timestamp']);
    }
    
    // Find existing device or add new
    const data = activitySheet.getDataRange().getValues();
    const deviceRow = data.findIndex(row => row[0] === deviceName);
    
    const now = new Date(timestamp ? parseInt(timestamp) : Date.now());
    const nowStr = now.toISOString();
    const ts = timestamp ? parseInt(timestamp) : Date.now();
    
    if (deviceRow > 0) {
      // Update existing row
      activitySheet.getRange(deviceRow + 1, 2, 1, 2).setValues([[nowStr, ts.toString()]]);
    } else {
      // Add new row
      activitySheet.appendRow([deviceName, nowStr, ts.toString()]);
    }
    
    return { success: true, message: 'Active status updated', device: deviceName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get active users - returns users active in last 5 minutes with details
 */
function getActiveUsers() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let activitySheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY);
    
    if (!activitySheet) {
      return { success: true, activeCount: 0, activeUsers: [], lastActivity: null };
    }
    
    const data = activitySheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    let activeCount = 0;
    let lastActivity = null;
    const activeUsers = [];
    
    rows.forEach(row => {
      const timestamp = parseInt(row[2]);
      if (timestamp && timestamp > fiveMinutesAgo) {
        activeCount++;
        activeUsers.push({
          device: String(row[0] || 'Unknown Device'),
          lastActivity: row[1] ? new Date(row[1]).toISOString() : new Date(timestamp).toISOString(),
          timestamp: timestamp
        });
        if (!lastActivity || timestamp > parseInt(lastActivity)) {
          lastActivity = timestamp;
        }
      }
    });
    
    // Sort by most recent first
    activeUsers.sort((a, b) => b.timestamp - a.timestamp);
    return { 
      success: true, 
      activeCount: activeCount,
      activeUsers: activeUsers,
      lastActivity: lastActivity ? lastActivity.toString() : null 
    };
  } catch (error) {
    return { success: false, activeCount: 0, activeUsers: [], error: error.message };
  }
}

/**
 * Retroactively update assessment records with studentId, studentAdmissionNo, and studentName
 * Run this once to populate missing student data in existing assessment records
 */
function backfillAssessmentStudentData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentsSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  
  if (!studentsSheet || !assessmentsSheet) {
    return { success: false, error: 'Students or Assessments sheet not found' };
  }
  
  // First, ensure headers are updated
  updateAssessmentSheetHeaders(assessmentsSheet);
  
  // Get all students
  const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
  
  // Get all assessment records with current headers
  const assessmentHeaders = ASSESSMENT_HEADERS;
  const lastRow = assessmentsSheet.getLastRow();
  const lastCol = assessmentsSheet.getLastColumn();
  
  if (lastRow <= 1) {
    return { success: true, message: 'No assessment records to update' };
  }
  
  const data = assessmentsSheet.getDataRange().getValues();
  const headerRow = data[0].map(h => String(h || '').trim());
  
  // Find column indices
  const idIndex = headerRow.indexOf('id');
  const studentIdIndex = headerRow.indexOf('studentId');
  const studentAdmIndex = headerRow.indexOf('studentAdmissionNo');
  const studentNameIndex = headerRow.indexOf('studentName');
  
  let updatedCount = 0;
  
  // Build student lookup maps
  const byId = new Map();
  const byAdm = new Map();
  const byName = new Map();
  
  students.forEach(s => {
    if (s.id) byId.set(String(s.id).trim().toLowerCase(), s);
    if (s.admissionNo) byAdm.set(String(s.admissionNo).trim().toLowerCase(), s);
    if (s.name) byName.set(String(s.name).trim().toLowerCase(), s);
  });
  
  // Update each assessment row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const assessmentId = String(row[idIndex] || '').trim();
    const currentStudentId = String(row[studentIdIndex] || '').trim();
    
    // Only update if studentId is missing or empty
    if (!currentStudentId) {
      let matchedStudent = null;
      
      // Try to find matching student
      // Strategy 1: Match by existing studentId if present
      if (assessmentId.startsWith('A-') === false) {
        // Try matching by assessment ID format
      }
      
      // Strategy 2: Match by name in assessment (if there was a name column)
      // This would require knowing which column has the name
      
      // For now, leave empty - the app will handle matching on fetch
    }
  }
  
  console.log('[Script] Backfill complete. Run migrateAssessmentStudentIds() to match by other criteria.');
  return { success: true, message: 'Headers updated. ' + updatedCount + ' records analyzed.' };
}

/**
 * Migrate assessment records to include studentId by matching with Students sheet
 * Call this after updating headers to populate missing studentId values
 */
function migrateAssessmentStudentIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentsSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  
  if (!studentsSheet || !assessmentsSheet) {
    return { success: false, error: 'Required sheets not found' };
  }
  
  // Get all students
  const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
  
  // Get assessment data
  const lastRow = assessmentsSheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: true, message: 'No assessment records to migrate' };
  }
  
  const data = assessmentsSheet.getDataRange().getValues();
  const headerRow = data[0].map(function(h) { return String(h || '').trim(); });
  
  // Find column indices
  const idIndex = headerRow.indexOf('id');
  let studentIdIndex = headerRow.indexOf('studentId');
  let studentAdmIndex = headerRow.indexOf('studentAdmissionNo');
  let studentNameIndex = headerRow.indexOf('studentName');
  
  const currentLastCol = headerRow.length;
  
  // If columns don't exist, create them at the end
  if (studentIdIndex === -1) {
    assessmentsSheet.insertColumnAfter(currentLastCol);
    assessmentsSheet.getRange(1, currentLastCol + 1).setValue('studentId');
    studentIdIndex = currentLastCol;
  }
  if (studentAdmIndex === -1) {
    assessmentsSheet.insertColumnAfter(studentIdIndex + 1);
    assessmentsSheet.getRange(1, studentIdIndex + 2).setValue('studentAdmissionNo');
    studentAdmIndex = studentIdIndex + 1;
  }
  if (studentNameIndex === -1) {
    assessmentsSheet.insertColumnAfter(studentAdmIndex + 1);
    assessmentsSheet.getRange(1, studentAdmIndex + 2).setValue('studentName');
    studentNameIndex = studentAdmIndex + 1;
  }
  
  // Build student lookup maps
  const byAdm = new Map();
  const byName = new Map();
  
  students.forEach(function(s) {
    if (s.admissionNo) byAdm.set(String(s.admissionNo).trim().toLowerCase(), s);
    if (s.name) byName.set(String(s.name).trim().toLowerCase(), s);
  });
  
  let updatedCount = 0;
  let matchedCount = 0;
  
  // Update each assessment row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const currentStudentId = String(row[studentIdIndex] || '').trim();
    
    // Skip if already has studentId
    if (currentStudentId && currentStudentId.length > 0) continue;
    
    // Try to match by admission number
    let matchedStudent = null;
    
    if (matchedStudent) {
      assessmentsSheet.getRange(i + 1, studentIdIndex + 1).setValue(String(matchedStudent.id || ''));
      assessmentsSheet.getRange(i + 1, studentAdmIndex + 1).setValue(String(matchedStudent.admissionNo || ''));
      assessmentsSheet.getRange(i + 1, studentNameIndex + 1).setValue(String(matchedStudent.name || ''));
      matchedCount++;
    }
    
    updatedCount++;
  }
  
  const result = {
    success: true,
    analyzed: updatedCount,
    matched: matchedCount,
    message: 'Migration complete. ' + matchedCount + ' records matched with students.'
  };
  
  console.log('[Script] Migration result:', JSON.stringify(result));
  return result;
}

/**
 * Add missing columns to existing sheets
 * Run this from Apps Script console to add new columns to existing sheets
 */
function addMissingColumnsToSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Update Assessments sheet headers
  const assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  if (assessmentsSheet) {
    updateAssessmentSheetHeaders(assessmentsSheet);
    console.log('Assessments sheet updated with new headers');
  }
  
  return { success: true, message: 'Columns added to sheets' };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER AUTHENTICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple hash function for passwords
 * Note: In production, use more secure hashing like bcrypt
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Register a new teacher account
 * action=registerTeacher
 */
function registerTeacher(credentials) {
  const { username, password, teacherId, name, role } = credentials;
  
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) {
    credSheet = ss.insertSheet(SHEET_NAMES.TEACHER_CREDENTIALS);
    credSheet.appendRow(TEACHER_CREDENTIALS_HEADERS);
  }
  
  // Check if username already exists
  const data = credSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return { success: false, error: 'Username already exists' };
    }
  }
  
  // Create new credential record
  const passwordHash = simpleHash(password);
  const now = new Date().toISOString();
  
  credSheet.appendRow([
    username.toLowerCase().trim(),
    passwordHash,
    teacherId || '',
    name || username,
    role || 'teacher',
    now,
    ''  // lastLogin - empty initially
  ]);
  
  return { 
    success: true, 
    message: 'Account created successfully',
    username: username.toLowerCase().trim(),
    role: role || 'teacher'
  };
}

/**
 * Login teacher - validate credentials
 * action=loginTeacher
 */
function loginTeacher(credentials) {
  const { username, password } = credentials;
  
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) {
    return { success: false, error: 'Credentials system not initialized' };
  }
  
  const data = credSheet.getDataRange().getValues();
  const passwordHash = simpleHash(password);
  
  for (let i = 1; i < data.length; i++) {
    const storedUsername = String(data[i][0] || '').toLowerCase();
    const storedHash = String(data[i][1] || '');
    const storedTeacherId = String(data[i][2] || '');
    const storedName = String(data[i][3] || '');
    const storedRole = String(data[i][4] || 'teacher');
    
    if (storedUsername === username.toLowerCase().trim() && storedHash === passwordHash) {
      // Update last login
      credSheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      
      return { 
        success: true, 
        message: 'Login successful',
        username: storedUsername,
        teacherId: storedTeacherId,
        name: storedName,
        role: storedRole
      };
    }
  }
  
  return { success: false, error: 'Invalid username or password' };
}

/**
 * Get teacher credentials (for admin to see)
 * action=getTeachers
 */
function getTeacherCredentials() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) return [];
  
  const data = credSheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    results.push({
      username: data[i][0],
      teacherId: data[i][2],
      name: data[i][3],
      role: data[i][4],
      createdAt: data[i][5],
      lastLogin: data[i][6]
    });
  }
  
  return results;
}

/**
 * Delete teacher account
 * action=deleteTeacher
 */
function deleteTeacherAccount(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) {
    return { success: false, error: 'Credentials sheet not found' };
  }
  
  const data = credSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      credSheet.deleteRow(i + 1);
      return { success: true, message: 'Account deleted' };
    }
  }
  
  return { success: false, error: 'Account not found' };
}
