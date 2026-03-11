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
  ACTIVITY: 'Activity'  // For tracking active users
};

// Column headers for each sheet
const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];

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
    
    // Handle deleteAssessment via GET
    if (action === 'deleteAssessment' && postData.recordId) {
      response = deleteRecord(SHEET_NAMES.ASSESSMENTS, 'id', postData.recordId, ASSESSMENT_HEADERS);
      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    switch (action) {
      case 'getAll':
        response = {
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          assessments: getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS),
          attendance: getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS)
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
    // Handle both JSON body and form data
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
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
      data = {
        action: e.parameter.action,
        sheetName: e.parameter.sheetName,
        records: e.parameter.records ? JSON.parse(e.parameter.records) : [],
        headers: e.parameter.headers ? JSON.parse(e.parameter.headers) : []
      };
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
        
      case 'bulkAddAssessments':
        response = bulkAddRecords(SHEET_NAMES.ASSESSMENTS, data.assessments, ASSESSMENT_HEADERS);
        break;
        
      case 'syncAll':
        // Full sync - returns everything
        response = {
          success: true,
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          assessments: getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS),
          attendance: getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS)
        };
        break;
        
      case 'replaceAll':
        console.log('replaceAll called:', data.sheetName, data.records ? data.records.length : 0);
        // Replace all records in a sheet (clear and write)
        response = replaceAllRecords(data.sheetName, data.records, data.headers);
        console.log('replaceAll result:', response);
        break;
        
      case 'deleteRecord':
        // Delete a specific record by ID
        const deleteSheet = data.sheetName || SHEET_NAMES.ASSESSMENTS;
        const deleteHeaders = deleteSheet === SHEET_NAMES.STUDENTS ? STUDENT_HEADERS :
                             deleteSheet === SHEET_NAMES.ASSESSMENTS ? ASSESSMENT_HEADERS : ATTENDANCE_HEADERS;
        response = deleteRecord(deleteSheet, 'id', data.recordId, deleteHeaders);
        break;
        
      case 'deleteAssessment':
        response = deleteRecord(SHEET_NAMES.ASSESSMENTS, 'id', data.recordId, ASSESSMENT_HEADERS);
        break;
        
      case 'deleteStudent':
        response = deleteRecord(SHEET_NAMES.STUDENTS, 'id', data.recordId, STUDENT_HEADERS);
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
