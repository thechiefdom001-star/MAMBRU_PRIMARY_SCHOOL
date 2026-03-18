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
  ACTIVITY: 'Activity'  // For tracking active users
};

// Column headers for each sheet
const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];
const TEACHER_HEADERS = ['id', 'name', 'contact', 'subjects', 'grades', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const STAFF_HEADERS = ['id', 'name', 'role', 'contact', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const PAYMENT_HEADERS = ['id', 'studentId', 'amount', 'term', 'academicYear', 'date', 'receiptNo', 'method', 'reference', 'items', 'voided', 'voidedAt'];

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
  
  // Create Assessments sheet
  let assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  if (!assessmentsSheet) {
    assessmentsSheet = ss.insertSheet(SHEET_NAMES.ASSESSMENTS);
    assessmentsSheet.appendRow(ASSESSMENT_HEADERS);
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
  
  return { success: true, message: 'Sheets initialized successfully' };
}

/**
 * GET endpoint - Return all data as JSON
 */
function doGet(e) {
  initializeSheets();
  
  const action = e.parameter.action || 'getAll';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let response = {};
  
  try {
    // Handle data parameter for GET requests
    let postData = {};
    if (e.parameter.data) {
      try {
        postData = JSON.parse(e.parameter.data);
      } catch (err) {
        // Ignore parse errors
      }
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
          staff: getAllRecords(SHEET_NAMES.STAFF, STAFF_HEADERS)
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
 * Get all records from a sheet
 */
function getAllRecords(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  
  return data.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let value = row[index];
      
      // Clean corrupted selectedFees values (Java object references)
      if (header === 'selectedFees' && typeof value === 'string' && value.includes('java.lang.Object')) {
        value = 't1,t2,t3'; // Default format
      }
      
      // Ensure all values are properly serializable (convert objects/arrays to strings)
      if (value && typeof value === 'object') {
        value = String(value).includes('java.lang') ? '' : JSON.stringify(value);
      }
      
      obj[header] = value;
    });
    return obj;
  });
}

/**
 * Add a new record
 */
function addRecord(sheetName, record, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { success: false, error: 'Sheet not found' };
  }
  
  // Ensure headers exist
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (existingHeaders.length === 0) {
    sheet.appendRow(headers);
  }
  
  // Try to update existing record if the id field matches
  const idIndex = headers.indexOf('id');
  if (idIndex >= 0 && record.id) {
    const allValues = sheet.getDataRange().getValues(); // includes header row
    for (let i = 1; i < allValues.length; i++) {
      if (allValues[i][idIndex] == record.id) {
        // found existing row, update
        const values = headers.map(header => {
          const val = record[header];
          return val !== undefined ? val : '';
        });
        sheet.getRange(i+1, 1, 1, values.length).setValues([values]);
        return { success: true, id: record.id, message: 'Record updated successfully' };
      }
    }
  }

  // if no existing record found, append new one
  const values = headers.map(header => {
    const val = record[header];
    return val !== undefined ? val : '';
  });
  
  sheet.appendRow(values);
  
  return { 
    success: true, 
    id: record.id || values[0],
    message: 'Record added successfully' 
  };
}

/**
 * Update an existing record
 */
function updateRecord(sheetName, keyField, keyValue, record, headers) {
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
  
  // Find row (skip header)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyIndex]) === String(keyValue)) {
      // Update the row
      headers.forEach((header, index) => {
        sheet.getRange(i + 1, index + 1).setValue(record[header] || '');
      });
      
      return { success: true, message: 'Record updated successfully' };
    }
  }
  
  return { success: false, error: 'Record not found' };
}

/**
 * Bulk add records
 */
function bulkAddRecords(sheetName, records, headers) {
  if (!records || records.length === 0) {
    return { success: true, message: 'No records to add' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { success: false, error: 'Sheet not found' };
  }
  
  const values = records.map(record => {
    return headers.map(header => {
      const val = record[header];
      return val !== undefined ? val : '';
    });
  });
  
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  
  return { 
    success: true, 
    count: records.length,
    message: `${records.length} records added successfully` 
  };
}

/**
 * Replace all records in a sheet (clear and write fresh)
 */
function replaceAllRecords(sheetName, records, headers) {
  if (!records) {
    records = [];
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  } else {
    // Clear existing data (keep headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
  }
  
  if (records.length === 0) {
    return { success: true, count: 0, message: 'Sheet cleared' };
  }
  
  const values = records.map(record => {
    return headers.map(header => {
      const val = record[header];
      return val !== undefined ? val : '';
    });
  });
  
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  
  return { 
    success: true, 
    count: records.length,
    message: `${records.length} records written to ${sheetName}` 
  };
}

/**
 * Bulk push records - fast batch add/update for multiple records
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
    const existingData = sheet.getDataRange().getValues();
    const idIndex = headers.indexOf('id');
    const keyIndex = sheetName === SHEET_NAMES.STUDENTS ? headers.indexOf('admissionNo') : -1;
    
    let updatedCount = 0;
    let addedCount = 0;
    
    // Build a map of existing records for faster lookup
    const existingMap = new Map();
    for (let i = 1; i < existingData.length; i++) {
      if (idIndex >= 0 && existingData[i][idIndex]) {
        existingMap.set(String(existingData[i][idIndex]), i);
      } else if (keyIndex >= 0 && existingData[i][keyIndex]) {
        existingMap.set(String(existingData[i][keyIndex]), i);
      }
    }
    
    // Batch updates
    const newRows = [];
    
    for (const record of records) {
      const recordId = String(record.id || record[headers[0]] || '');
      const recordKey = keyIndex >= 0 ? String(record[headers[keyIndex]] || '') : recordId;
      const lookupKey = keyIndex >= 0 ? recordKey : recordId;
      const existingRowIndex = existingMap.get(lookupKey);
      
      const values = headers.map(h => record[h] || '');
      
      if (existingRowIndex) {
        // Update existing row
        sheet.getRange(existingRowIndex + 1, 1, 1, values.length).setValues([values]);
        updatedCount++;
      } else {
        // Collect new rows for batch insert
        newRows.push(values);
        addedCount++;
      }
    }
    
    // Batch insert all new rows at once
    if (newRows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows);
    }
    
    return {
      success: true,
      count: updatedCount + addedCount,
      updated: updatedCount,
      added: addedCount,
      message: `Bulk push: ${addedCount} added, ${updatedCount} updated`
    };
  } catch (error) {
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
