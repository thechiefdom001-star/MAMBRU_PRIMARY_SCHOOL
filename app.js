import { h, render } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import htm from 'htm';
import { Dashboard } from './components/Dashboard.js';
import { Students } from './components/Students.js';
import { Teachers } from './components/Teachers.js';
import { Staff } from './components/Staff.js';
import { Marklist } from './components/Marklist.js';
import { Assessments } from './components/Assessments.js';
import { ResultAnalysis } from './components/ResultAnalysis.js';
import { Timetable } from './components/Timetable.js';
import { Fees } from './components/Fees.js';
import { FeesRegister } from './components/FeesRegister.js';
import { FeeReminder } from './components/FeeReminder.js';
import { Transport } from './components/Transport.js';
import { Library } from './components/Library.js';
import { Payroll } from './components/Payroll.js';
import { SeniorSchool } from './components/SeniorSchool.js';
import { Archives } from './components/Archives.js';
import { Settings } from './components/Settings.js';
import { Attendance } from './components/Attendance.js';
import { Sidebar } from './components/Sidebar.js';
import { TeacherAuth } from './components/TeacherAuth.js';
import { PrintButtons } from './components/PrintButtons.js';
import { Storage } from './lib/storage.js';
import { googleSheetSync } from './lib/googleSheetSync.js';

const html = htm.bind(h);

const App = () => {
    const [view, setView] = useState('dashboard');
    const [data, setData] = useState(() => {
        const loaded = Storage.load();
        console.log('Initial load - Students:', loaded.students?.length || 0, 'Payments:', loaded.payments?.length || 0);
        return loaded;
    });

    // Ensure data is loaded from localStorage on mount
    useEffect(() => {
        const currentData = Storage.load();
        console.log('[App] Loading data from localStorage - Students:', currentData.students?.length || 0, 'Assessments:', currentData.assessments?.length || 0);
        // Always load data, even if students array is empty
        setData(currentData);
    }, []);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(localStorage.getItem('et_is_admin') === 'true');
    
    // Teacher authentication state
    const [teacherSession, setTeacherSession] = useState(() => {
        const saved = localStorage.getItem('et_teacher_session');
        return saved ? JSON.parse(saved) : null;
    });
    const [showTeacherAuth, setShowTeacherAuth] = useState(false);
    
    // Derived authentication state
    const isAuthenticated = isAdmin || teacherSession;
    
    // Enrich teacher session with details from teacher records if available
    const activeTeacher = teacherSession ? (data.teachers || []).find(t => 
        (teacherSession.name && t.name && t.name.toLowerCase() === teacherSession.name.toLowerCase()) || 
        (teacherSession.username && (
            (t.username && t.username.toLowerCase() === teacherSession.username.toLowerCase()) ||
            (t.name && t.name.toLowerCase() === teacherSession.username.toLowerCase())
        ))
    ) : null;
    
    const teacherSubjectsStr = [teacherSession?.subjects, activeTeacher?.subjects].filter(Boolean).join(',');
    const teacherGradesStr = [teacherSession?.grades, activeTeacher?.grades, teacherSession?.classTeacherGrade, activeTeacher?.classTeacherGrade].filter(Boolean).join(',');

    const allowedTeacherSubjects = teacherSubjectsStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
    const allowedTeacherGrades = teacherGradesStr.split(',').map(g => g.trim().toLowerCase()).filter(g => g);
    const allowedTeacherReligion = (teacherSession?.religion || activeTeacher?.religion || '').toLowerCase();

    // Derive selectedStudent from data.students to ensure it's always fresh
    const selectedStudent = selectedStudentId 
        ? (data.students || []).find(s => String(s.id) === String(selectedStudentId)) || null
        : null;
    
    // Check for existing teacher session on load
    useEffect(() => {
        const saved = localStorage.getItem('et_teacher_session');
        if (saved) {
            try {
                const session = JSON.parse(saved);
                if (session.username && session.isTeacher) {
                    setTeacherSession(session);
                }
            } catch (e) {
                localStorage.removeItem('et_teacher_session');
            }
        }
    }, []);

    // Auto-sync with Google Sheet on first load if configured
    // Only auto-sync if there's no local data (first time setup)
    useEffect(() => {
        // Check if this is first load with no local students
        const hasLocalStudents = data?.students?.length > 0;
        const hasGoogleUrl = data?.settings?.googleScriptUrl;
        
        // Only auto-sync if:
        // 1. Has Google URL configured
        // 2. NO local students (first time setup)
        // This prevents overwriting imported data with empty/incomplete Google data
        if (hasGoogleUrl && !hasLocalStudents) {
            console.log('🔄 Auto-syncing with Google Sheet (first time setup)...');
            
            const doAutoSync = async () => {
                setGoogleSyncStatus('Loading from Google Sheet...');
                
                googleSheetSync.setSettings(data.settings);
                
                try {
                    const result = await googleSheetSync.fetchAll();
                    
                    if (result.success) {
                        console.log('Google data loaded:', result.students?.length, 'students');
                        
                        // Replace local data with Google data
                        const merged = Storage.replaceWithGoogleData(data, {
                            students: result.students || [],
                            assessments: result.assessments || [],
                            attendance: result.attendance || [],
                            payments: result.payments || [],
                            teachers: result.teachers || [],
                            staff: result.staff || []
                        });
                        
                        setData(merged);
                        setGoogleSyncStatus('Loaded ' + (merged.students?.length || 0) + ' students from Google');
                        setTimeout(() => setGoogleSyncStatus(''), 3000);
                    }
                } catch (err) {
                    console.error('Auto-sync failed:', err);
                    setGoogleSyncStatus('');
                }
            };
            
            // Small delay to let UI render first
            setTimeout(doAutoSync, 1500);
        } else if (hasLocalStudents) {
            console.log('⏭ Auto-sync SKIPPED - Local data exists:', data.students.length, 'students');
        }
    }, []);

    // Sync selectedStudentId when data.students changes (e.g., after Google sync)
    useEffect(() => {
        if (selectedStudentId && !selectedStudent) {
            console.log('Selected student no longer found in data, clearing selection');
            setSelectedStudentId(null);
        }
    }, [data.students, selectedStudentId, selectedStudent]);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
    const [googleSyncStatus, setGoogleSyncStatus] = useState('');
    const [showForcePushModal, setShowForcePushModal] = useState(false);
    const [forcePushSelection, setForcePushSelection] = useState({
        students: true,
        assessments: true,
        payments: true,
        teachers: true,
        staff: true,
        attendance: true
    });
    const [deviceId, setDeviceId] = useState('');

    // Generate a stable device ID from committed login state
    useEffect(() => {
        // Get username from admin login OR teacher session
        let storedUsername = localStorage.getItem('et_login_username');
        let username = (storedUsername || '').trim().toLowerCase();
        
        // If teacher is logged in, use teacher name
        if (teacherSession && !isAdmin) {
            username = (teacherSession.username || teacherSession.name || '').trim().toLowerCase();
            console.log('📱 Teacher session detected, username:', username);
        }

        if (!username) {
            setDeviceId('');
            return;
        }
        
        const userRole = isAdmin ? 'admin' : 'teacher';
        
        // Check for existing stable session ID or create one
        let stableSessionId = localStorage.getItem('et_session_id');
        if (!stableSessionId) {
            stableSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            localStorage.setItem('et_session_id', stableSessionId);
        }
        
        // Use stable session ID combined with user role for consistent tracking
        const newDeviceId = `${userRole}@${username}#${stableSessionId}`;
        
        console.log('📱 Setting deviceId:', newDeviceId, 'role:', userRole);
        setDeviceId(newDeviceId);
    }, [isAdmin, teacherSession]);

    // Clear session ID on logout to prevent reuse
    useEffect(() => {
        const handleLogoutEvent = () => {
            // Don't clear immediately - wait for new login
        };
        window.addEventListener('edutrack:logout', handleLogoutEvent);
        return () => window.removeEventListener('edutrack:logout', handleLogoutEvent);
    }, []);

    // Initialize login state from localStorage on app load
    useEffect(() => {
        const storedUsername = localStorage.getItem('et_login_username');
        if (storedUsername) {
            setLoginUsername(storedUsername);
        }
    }, []);

    useEffect(() => {
        // Ensure payments are always saved
        if (data.payments && data.payments.length > 0) {
            Storage.save(data);
        }
    }, [data.payments]);
    
    // Save all data changes - but NOT on initial mount
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        // SAFETY CHECK: Don't save if students array is empty but payments exist
        // This indicates data corruption - keep previous data instead
        if ((!data.students || data.students.length === 0) && 
            (data.payments && data.payments.length > 0)) {
            console.error('🚨 SAFETY BLOCK: Attempted to save data with 0 students but', data.payments.length, 'payments. Data corruption detected!');
            alert('⚠️ Data corruption detected! Students data is missing but payments exist.\n\nPlease:\n1. Click "➕ Add Sample Students" in the yellow panel, OR\n2. Sync from Google Sheet, OR\n3. Clear all and reset\n\nThe app has prevented saving this corrupted state.');
            return; // Don't save corrupted data
        }
        // Only save after initial mount when data actually changes
        Storage.save(data);
    }, [data]);

    // Track data changes for debugging
    useEffect(() => {
        console.log('App data updated - Students:', data.students?.length || 0, 'Payments:', data.payments?.length || 0, 'Assessments:', data.assessments?.length || 0);
        console.log('Sample student:', data.students?.[0]);
    }, [data.students, data.payments, data.assessments]);

    useEffect(() => {
        const ws = window.websim;
        if (!ws) return;

        const initCloudSync = async () => {
            try {
                const project = await ws.getCurrentProject();
                const remoteData = await Storage.pullFromCloud(project.id);
                // Only merge if remote data has actual content
                if (remoteData && remoteData.students && remoteData.students.length > 0) {
                    console.log('Cloud data received - Students:', remoteData.students?.length || 0, 'Payments:', remoteData.payments?.length || 0);
                    setData(prev => {
                        const merged = Storage.mergeData(prev, remoteData, 'all');
                        console.log('After merge - Students:', merged.students?.length || 0, 'Payments:', merged.payments?.length || 0);
                        return merged;
                    });
                } else {
                    console.log('Cloud sync: No remote data or empty, keeping local data');
                }
            } catch (err) {
                console.warn("Initial cloud sync skipped:", err);
            }
        };

        const handleRemoteUpdate = async (event) => {
            const { comment } = event;
            if (comment && comment.raw_content && comment.raw_content.includes('[DATA_SYNC]')) {
                const match = comment.raw_content.match(/\[DATA_SYNC\]\s+(https?:\/\/[^\s\)]+)/);
                if (match && match[1]) {
                    setIsSyncing(true);
                    try {
                        const response = await fetch(match[1]);
                        const remoteData = await response.json();
                        setData(prev => Storage.mergeData(prev, remoteData, 'all'));
                    } catch (e) {
                        console.error("Failed to fetch remote update");
                    } finally {
                        setTimeout(() => setIsSyncing(false), 2000);
                    }
                }
            }
        };

        initCloudSync();
        ws.addEventListener('comment:created', handleRemoteUpdate);
        return () => ws.removeEventListener('comment:created', handleRemoteUpdate);
    }, []);

    // Listen for a restore event dispatched by Archives (or anywhere)
    useEffect(() => {
        const handler = (e) => {
            if (e?.detail?.restored) {
                setData(e.detail.restored);
                alert('Archived year restored into active data.');
            }
        };
        window.addEventListener('edutrack:restore', handler);
        return () => window.removeEventListener('edutrack:restore', handler);
    }, []);

    // Track user activity with proper rate limiting and deduplication
    useEffect(() => {
        return;
        if (deviceId.includes('guest')) return;

        let lastTrackTime = 0;
        const MIN_TRACK_INTERVAL = 60000; // Only track once per minute

        const trackUserActivity = async () => {
            const now = Date.now();
            if (now - lastTrackTime < MIN_TRACK_INTERVAL) return; // Rate limit
            lastTrackTime = now;
            
            try {
                googleSheetSync.setSettings(data.settings);
                const result = await googleSheetSync.setActiveUser(deviceId);
                console.log('📡 Activity tracked:', deviceId, 'Result:', result);
            } catch (error) {
                console.warn('Activity tracking error:', error);
            }
        };

        // Track IMMEDIATELY on mount (force first call)
        setTimeout(() => trackUserActivity(), 1000);

        // Track every 2 minutes
        const interval = setInterval(trackUserActivity, 2 * 60 * 1000);

        // Track on user interaction
        let interactionTimeout;
        const handleInteraction = () => {
            clearTimeout(interactionTimeout);
            interactionTimeout = setTimeout(trackUserActivity, 3000);
        };
        window.addEventListener('click', handleInteraction, { passive: true });
        window.addEventListener('keydown', handleInteraction, { passive: true });

        return () => {
            clearInterval(interval);
            clearTimeout(interactionTimeout);
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [data?.settings?.googleScriptUrl, deviceId, isAdmin, teacherSession]);


    // Sync lock to prevent concurrent syncs causing data multiplication
    const [syncLock, setSyncLock] = useState(false);
    const lastSyncRef = useRef(0);
    const SYNC_COOLDOWN = 30000; // 30 seconds minimum between syncs

    // Force push selected local data to Google based on user selection
    const forcePushToGoogle = useCallback(async () => {
        console.log('[ForcePush] Starting - URL:', data?.settings?.googleScriptUrl);
        
        if (!data?.settings?.googleScriptUrl) {
            alert("Google Sheet not configured");
            console.error('[ForcePush] No URL found in settings:', data?.settings);
            return;
        }
        
        // Store URL to verify it doesn't get lost
        const originalUrl = data.settings.googleScriptUrl;
        console.log('[ForcePush] Original URL stored:', originalUrl);
        
        // Close modal and start pushing
        setShowForcePushModal(false);
        
        const sel = forcePushSelection;
        const studentCount = sel.students ? (data.students?.length || 0) : 0;
        const assessmentCount = sel.assessments ? (data.assessments?.length || 0) : 0;
        const paymentCount = sel.payments ? (data.payments?.length || 0) : 0;
        const teacherCount = sel.teachers ? (data.teachers?.length || 0) : 0;
        const staffCount = sel.staff ? (data.staff?.length || 0) : 0;
        
        let selectedItems = [];
        if (sel.students) selectedItems.push(`${studentCount} Students`);
        if (sel.assessments) selectedItems.push(`${assessmentCount} Assessments`);
        if (sel.payments) selectedItems.push(`${paymentCount} Payments`);
        if (sel.teachers) selectedItems.push(`${teacherCount} Teachers`);
        if (sel.staff) selectedItems.push(`${staffCount} Staff`);
        
        if (selectedItems.length === 0) {
            alert("Please select at least one data type to push.");
            return;
        }
        
        if (!confirm(`🚀 FORCE PUSH\n\nPushing to Google Sheet:\n• ${selectedItems.join('\n• ')}\n\nDuplicates will be UPDATED. Continue?`)) {
            return;
        }
        
        setGoogleSyncStatus('🔄 Force pushing to Google...');
        
        googleSheetSync.setSettings(data.settings);
        
        try {
            let totalAdded = 0;
            let totalFailed = 0;
            
            // ========== FORCE PUSH STUDENTS ==========
            if (sel.students) {
                setGoogleSyncStatus(`📤 Pushing ${studentCount} students...`);
                console.log('=== FORCE PUSHING STUDENTS ===');
                
                for (const student of (data.students || [])) {
                    console.log('➕ Student:', student.name, student.id, student.admissionNo);
                    const result = await googleSheetSync.pushStudent(student);
                    console.log('Result:', result);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                        console.warn('❌ Failed student:', student.name, result.error);
                    }
                }
            }
            
            // ========== FORCE PUSH ASSESSMENTS ==========
            if (sel.assessments) {
                setGoogleSyncStatus(`📤 Pushing ${assessmentCount} assessments...`);
                console.log('=== FORCE PUSHING ASSESSMENTS ===');
                
                for (const assessment of (data.assessments || [])) {
                    const student = (data.students || []).find(s => 
                        String(s.id) === String(assessment.studentId) ||
                        String(s.admissionNo) === String(assessment.studentId)
                    );
                    const enriched = {
                        ...assessment,
                        studentId: String(student?.id || assessment.studentId),
                        studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
                        studentName: student?.name || assessment.studentName || 'Unknown',
                        grade: student?.grade || assessment.grade || ''
                    };
                    console.log('➕ Assessment:', enriched.studentName, enriched.subject);
                    const result = await googleSheetSync.pushAssessment(enriched);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            // ========== FORCE PUSH PAYMENTS ==========
            if (sel.payments) {
                setGoogleSyncStatus(`📤 Pushing ${paymentCount} payments...`);
                console.log('=== FORCE PUSHING PAYMENTS ===');
                
                for (const payment of (data.payments || [])) {
                    console.log('➕ Payment:', payment.id, payment.amount);
                    const result = await googleSheetSync.pushPayment(payment);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            // ========== FORCE PUSH TEACHERS ==========
            if (sel.teachers) {
                setGoogleSyncStatus(`📤 Pushing ${teacherCount} teachers...`);
                console.log('=== FORCE PUSHING TEACHERS ===');
                
                for (const teacher of (data.teachers || [])) {
                    console.log('➕ Teacher:', teacher.name, teacher.id);
                    const result = await googleSheetSync.pushTeacher(teacher);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            // ========== FORCE PUSH STAFF ==========
            if (sel.staff) {
                setGoogleSyncStatus(`📤 Pushing ${staffCount} staff...`);
                console.log('=== FORCE PUSHING STAFF ===');
                
                for (const staff of (data.staff || [])) {
                    console.log('➕ Staff:', staff.name, staff.id);
                    const result = await googleSheetSync.pushStaff(staff);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            console.log('=== FORCE PUSH COMPLETE ===');
            console.log('Total Added:', totalAdded, 'Total Failed:', totalFailed);
            
            // DON'T fetch from Google - keep local data as is!
            // This prevents data loss if Google has fewer records
            // User can manually "Get from Google" if they want to pull
            setGoogleSyncStatus('✅ Force push complete! ' + totalAdded + ' records pushed to Google');
            setTimeout(() => setGoogleSyncStatus(''), 8000);
            
            // Save to localStorage
            Storage.save(data);
            console.log('📊 Local data preserved:', data.students?.length, 'students');
            
        } catch (err) {
            console.error('Force push error:', err);
            alert('Force push failed: ' + err.message);
            setGoogleSyncStatus('');
        }
    }, [data, googleSheetSync]);

    // simplified helper for pushing all local changes
    const pushLocalToGoogle = useCallback(async (sheetData) => {
        if (!data?.settings?.googleScriptUrl) return;
        if (syncLock) {
            console.log('⏳ Sync blocked - another sync in progress');
            return false;
        }
        
        const now = Date.now();
        if (now - lastSyncRef.current < SYNC_COOLDOWN) {
            console.log('⏳ Sync blocked - cooldown active');
            return false;
        }
        
        console.log('📤 Syncing all local data to Google Sheet...');
        console.log('📤 Local students to push:', data.students?.length || 0);
        setSyncLock(true);
        lastSyncRef.current = now;
        
        try {
            googleSheetSync.setSettings(data.settings);
            
            // First, get all existing IDs from Google to check for matches
            const existingData = await googleSheetSync.fetchAll();
            const existingStudentIds = new Set((existingData.students || []).map(s => String(s.id)));
            const existingAdmNos = new Set((existingData.students || []).map(s => String(s.admissionNo || '').trim()).filter(Boolean));
            
            console.log('📊 Existing Google student IDs:', existingStudentIds.size);
            console.log('📊 Existing Google admissionNos:', existingAdmNos.size);
            
            let successCount = 0;
            let skipCount = 0;
            
            // Sync students - check for duplicates
            for (const student of (data.students || [])) {
                const localId = String(student.id);
                const localAdmNo = String(student.admissionNo || '').trim();
                
                // Skip if ID or admissionNo already exists
                if (existingStudentIds.has(localId) || (localAdmNo && existingAdmNos.has(localAdmNo))) {
                    console.log('⏭ Skipping duplicate:', localId, localAdmNo);
                    skipCount++;
                    continue;
                }
                
                console.log('➕ Adding student:', student.name, student.id);
                const result = await googleSheetSync.pushStudent(student);
                if (result.success) {
                    successCount++;
                    // Add to existing sets to prevent duplicates within this sync
                    existingStudentIds.add(localId);
                    if (localAdmNo) existingAdmNos.add(localAdmNo);
                } else {
                    console.warn('❌ Failed to add student:', student.name, result.error);
                }
            }
            
            console.log('✅ Sync complete - Added:', successCount, 'Skipped:', skipCount);
            return true;
        } catch (err) {
            console.error('❌ Sync error:', err);
            return false;
        } finally {
            setSyncLock(false);
        }
    }, [data, googleSheetSync, syncLock]);

    const handleGoogleSync = useCallback(async () => {
        if (!data.settings.googleScriptUrl) {
            alert("Google Sheet not configured. Go to Settings > Google Sheet Sync to configure.");
            return;
        }
        
        // Prevent concurrent syncs
        if (isGoogleSyncing) {
            console.log('⏳ Google sync already in progress, skipping...');
            return;
        }
        
        // Check cooldown
        const now = Date.now();
        if (now - lastSyncRef.current < SYNC_COOLDOWN) {
            alert('Please wait a moment before syncing again.');
            return;
        }
        
        setIsGoogleSyncing(true);
        setGoogleSyncStatus('Syncing with Google Sheet...');
        lastSyncRef.current = now;
        
        googleSheetSync.setSettings(data.settings);
        
        try {
            // Fetch ALL data from Google Sheet
            let result = await googleSheetSync.fetchAll();
            
            if (result.success) {
                console.log('Google data raw - students:', result.students?.length, 'assessments:', result.assessments?.length);

                // send any local entries that don't exist yet on sheet
                try {
                    console.log('📤 Pushing local data to Google...');
                    await pushLocalToGoogle(result);
                    console.log('✅ Push to Google completed');
                } catch (pushError) {
                    console.error('❌ Error pushing to Google:', pushError);
                    // Don't stop sync, continue with pull
                }

                // after pushing, re-fetch to get updated sheet state
                result = await googleSheetSync.fetchAll();

                // MERGE local data with Google data (preserve local data, add Google data)
                console.log('🔄 Before merge - local vs Google:', {
                    localStudents: data.students?.length,
                    googleStudents: result.students?.length,
                    localPayments: data.payments?.length,
                    googlePayments: result.payments?.length,
                    localAssessments: data.assessments?.length,
                    googleAssessments: result.assessments?.length
                });
                
                try {
                    // Use mergeData instead of replaceWithGoogleData to preserve local data
                    let merged = { ...data };
                    
                    // Merge students (prefer Google data for duplicates)
                    if (result.students?.length > 0) {
                        merged = Storage.mergeData(merged, { students: result.students }, 'students');
                    }
                    
                    // Merge assessments (prefer Google data for duplicates)
                    if (result.assessments?.length > 0) {
                        merged = Storage.mergeData(merged, { assessments: result.assessments }, 'assessments');
                    }
                    
                    // Merge payments (preserve local payments, add Google ones)
                    if (result.payments?.length > 0) {
                        merged = Storage.mergeData(merged, { payments: result.payments }, 'payments');
                    }
                    
                    // Merge teachers
                    if (result.teachers?.length > 0) {
                        merged = Storage.mergeData(merged, { teachers: result.teachers }, 'teachers');
                    }
                    
                    // Merge staff
                    if (result.staff?.length > 0) {
                        merged = Storage.mergeData(merged, { staff: result.staff }, 'staff');
                    }
                    
                    console.log('✅ After merge - preserved local data:', {
                        students: merged?.students?.length,
                        payments: merged?.payments?.length,
                        assessments: merged?.assessments?.length
                    });
                    
                    setData(merged);
                    Storage.save(merged);
                    setGoogleSyncStatus(`✓ Synced! ${merged.students?.length || 0} students, ${merged.payments?.length || 0} payments (local + Google)`);
                    setTimeout(() => setGoogleSyncStatus(''), 5000);
                } catch (mergeError) {
                    console.error('❌ Error merging data:', mergeError);
                    alert("Data merge failed: " + mergeError.message);
                    setGoogleSyncStatus('');
                }
            } else {
                alert("Sync failed: " + result.error);
                setGoogleSyncStatus('');
            }
        } catch (error) {
            alert("Sync error: " + error.message);
            setGoogleSyncStatus('');
        }
        
        setIsGoogleSyncing(false);
    }, [data, setData, googleSheetSync, pushLocalToGoogle]);

    const handlePullFromGoogle = useCallback(async () => {
        if (!data.settings.googleScriptUrl) {
            alert("Google Sheet not configured. Go to Settings > Google Sheet Sync to configure.");
            return;
        }

        if (isGoogleSyncing) {
            console.log('Google pull already in progress, skipping...');
            return;
        }

        const now = Date.now();
        if (now - lastSyncRef.current < SYNC_COOLDOWN) {
            alert('Please wait a moment before syncing again.');
            return;
        }

        setIsGoogleSyncing(true);
        setGoogleSyncStatus('Loading from Google Sheet...');
        lastSyncRef.current = now;

        googleSheetSync.setSettings(data.settings);

        try {
            const result = await googleSheetSync.fetchAll();

            if (!result.success) {
                alert("Sync failed: " + result.error);
                setGoogleSyncStatus('');
                setIsGoogleSyncing(false);
                return;
            }

            const pulledData = Storage.ensureDataIntegrity(
                Storage.replaceWithGoogleData(
                    {
                        ...data,
                        students: [],
                        assessments: [],
                        attendance: [],
                        payments: [],
                        teachers: [],
                        staff: []
                    },
                    result
                )
            );

            pulledData.settings = {
                ...pulledData.settings,
                googleScriptUrl: data.settings.googleScriptUrl
            };

            console.log('Google pull complete:', {
                students: pulledData.students?.length,
                assessments: pulledData.assessments?.length,
                attendance: pulledData.attendance?.length,
                payments: pulledData.payments?.length,
                teachers: pulledData.teachers?.length,
                staff: pulledData.staff?.length
            });

            setData(pulledData);
            Storage.save(pulledData);
            setGoogleSyncStatus(`✓ Loaded ${pulledData.students?.length || 0} students from Google`);
            setTimeout(() => setGoogleSyncStatus(''), 5000);
        } catch (error) {
            alert("Sync error: " + error.message);
            setGoogleSyncStatus('');
        }

        setIsGoogleSyncing(false);
    }, [data, isGoogleSyncing, setData, googleSheetSync]);

    // when the browser regains connectivity, automatically sync with Google
    // NOTE: Disabled - user must use Force Push to sync data
    useEffect(() => {
        // Auto-sync disabled - imported data stays local
        return () => {};
    }, []);

    // periodic sync every 3 minutes with proper lock check
    // NOTE: Disabled - user controls when to sync via Force Push
    useEffect(() => {
        // Periodic sync disabled - user must use Force Push to sync
        return () => {};
    }, []);

    // FAST SYNC: Push all local data to Google within 30 seconds
    // NOTE: Disabled - user must use Force Push button to sync
    const performFastInitialSync = useCallback(async () => {
        console.log('⚡ Fast sync disabled - use Force Push to sync manually');
        return false;
    }, []);

    // Trigger fast sync within 30 seconds of connection
    // NOTE: Disabled
    useEffect(() => {
        // Fast sync disabled - user controls sync via Force Push
        return () => {};
    }, []);

    // Auto-sync on app load if Google Sheet configured
    // NOTE: Disabled - imported data stays local until Force Push is used
    useEffect(() => {
        console.log('🔄 Auto-load from Google disabled - data stays local');
        // User must use Force Push to sync local data to Google
        // Or use manual "Sync with Google" button to pull from Google
    }, []);

    useEffect(() => {
        if (!data || !data.settings) return;
        // Apply dynamic theme colors
        const root = document.documentElement;
        root.style.setProperty('--primary-color', data.settings.primaryColor || '#2563eb');
        root.style.setProperty('--secondary-color', data.settings.secondaryColor || '#64748b');

        if (data.settings.theme === 'dark') {
            document.body.classList.add('bg-slate-950', 'text-slate-100');
            document.body.classList.remove('bg-gray-50', 'text-slate-900');
        } else {
            document.body.classList.remove('bg-slate-950', 'text-slate-100');
            document.body.classList.add('bg-gray-50', 'text-slate-900');
        }
    }, [data.settings?.primaryColor, data.settings?.secondaryColor, data.settings?.theme]);

    // Report user activity to Google Sheet for "Active Users" visibility
    useEffect(() => {
        if (!data.settings.googleScriptUrl || !deviceId) return;
        
        console.log('📡 App activity useEffect triggered for:', deviceId);
        googleSheetSync.setSettings(data.settings);
        
        // Report activity immediately and frequently
        const reportActivity = () => {
            console.log('📡 Sending activity update:', deviceId);
            googleSheetSync.setActiveUser(deviceId).then(result => {
                console.log('📡 Activity result:', result);
            });
        };
        
        // Initial report - immediate
        setTimeout(reportActivity, 1000);
        
        // Keep session alive every 30 seconds
        const interval = setInterval(reportActivity, 30000);
        
        // Also report on any user interaction
        const handleInteraction = () => {
            setTimeout(reportActivity, 500);
        };
        window.addEventListener('click', handleInteraction, { passive: true });
        window.addEventListener('keydown', handleInteraction, { passive: true });
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [deviceId, data.settings.googleScriptUrl, isAdmin, teacherSession]);

    const handleLogin = (e) => {
        e.preventDefault();
        const normalizedUsername = loginUsername.trim().toLowerCase();

        if (normalizedUsername === 'admin' && loginPassword === 'admin002') {
            setIsAdmin(true);
            localStorage.setItem('et_is_admin', 'true');
            localStorage.setItem('et_login_username', normalizedUsername);
            setLoginUsername(normalizedUsername);
            setShowLoginModal(false);
            setLoginPassword('');
        } else {
            alert('Invalid Admin Credentials');
        }
    };

    const handleTeacherLogin = (teacherData) => {
        setTeacherSession(teacherData);
        setShowTeacherAuth(false);
        console.log('Teacher logged in:', teacherData.username);
    };

    const handleLogout = () => {
        // Create new session ID for next login
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('et_session_id', newSessionId);
        
        setIsAdmin(false);
        setDeviceId('');
        setLoginUsername('');
        localStorage.removeItem('et_is_admin');
        localStorage.removeItem('et_login_username');
        googleSheetSync.setCurrentUser(null);
        
        // Also logout teacher if logged in
        if (teacherSession) {
            setTeacherSession(null);
            localStorage.removeItem('et_teacher_session');
        }
        
        // Dispatch logout event
        window.dispatchEvent(new Event('edutrack:logout'));
        
        setView('dashboard');
    };

    const openTeacherAuth = () => {
        setShowTeacherAuth(true);
    };

    const navigate = (v, params = null) => {
        if (params?.studentId) {
            setSelectedStudentId(params.studentId);
        }
        setView(v);
        setIsMobileMenuOpen(false);
    };

    const handleAcademicPrintSelect = (id, isBatch = false) => {
        setSelectedStudentId(id);
        if (isBatch) {
            setView('batch-reports');
        } else {
            setView('student-detail');
        }
    };

    const handleGranularExport = (type) => {
        let exportObj = {};
        if (type === 'students') exportObj = { students: data.students };
        if (type === 'assessments') exportObj = { assessments: data.assessments, remarks: data.remarks };
        if (type === 'senior-school') {
            const seniorGrades = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
            exportObj = { students: data.students.filter(s => seniorGrades.includes(s.grade)) };
        }
        if (type === 'academic-full') exportObj = { students: data.students, assessments: data.assessments, remarks: data.remarks };

        const dataStr = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `edutrack_${type}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGranularImport = (type) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const incoming = JSON.parse(event.target.result);
                    const merged = Storage.mergeData(data, incoming, type);
                    setData(merged);
                    // Explicitly save to localStorage to ensure data persists
                    Storage.save(merged);
                    console.log(`[Import] ${type} data saved:`, merged.students?.length, 'students');
                    alert(`Successfully integrated ${type} data!`);
                } catch (err) {
                    alert('Error parsing data file.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const AcademicTransferUI = ({ type }) => html`
        <div class="flex gap-2 no-print ml-auto">
            <button 
                onClick=${() => handleGranularExport(type)}
                class="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-slate-200"
                title="Export this section's data"
            >
                📤 Export
            </button>
            <button 
                onClick=${() => handleGranularImport(type)}
                class="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-slate-200"
                title="Import and merge data"
            >
                📥 Import
            </button>
        </div>
    `;

    const renderView = () => {
        switch (view) {
            case 'dashboard': return html`<${Dashboard} data=${data} setData=${setData} googleSyncStatus=${googleSyncStatus} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            case 'batch-reports': {
                const [batchTerm, setBatchTerm] = useState('T1');
                const [batchGrade, setBatchGrade] = useState(selectedStudent?.grade || 'GRADE 1');
                const [batchStream, setBatchStream] = useState(selectedStudent?.stream || 'ALL');
                const streams = data.settings.streams || [];
                
                const gradeStudents = (data.students || []).filter(s => {
                    if (s.grade !== batchGrade) return false;
                    if (batchStream === 'ALL') return true;
                    return s.stream === batchStream;
                });
                
                const gradeLabel = batchGrade + (batchStream !== 'ALL' ? batchStream : '');
                return html`
                    <div class="space-y-8">
                        <div class="flex justify-between items-center no-print bg-white p-4 rounded-xl border mb-6">
                            <button onClick=${() => setView('result-analysis')} class="text-blue-600 font-bold flex items-center gap-1">
                                <span>←</span> Back to Analysis
                            </button>
                            <div class="flex items-center gap-4">
                                <div class="flex flex-col items-center">
                                    <h2 class="font-black">Batch Printing: ${gradeLabel}</h2>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">${gradeStudents.length} Reports Ready</p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <select 
                                    value=${batchGrade}
                                    onChange=${(e) => { setBatchGrade(e.target.value); setBatchStream('ALL'); }}
                                    class="px-3 py-2 border rounded-lg text-sm font-medium"
                                >
                                    ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                                </select>
                                <select 
                                    value=${batchStream}
                                    onChange=${(e) => setBatchStream(e.target.value)}
                                    class="px-3 py-2 border rounded-lg text-sm font-medium"
                                >
                                    <option value="ALL">All Streams</option>
                                    ${streams.map(s => html`<option value=${s}>${s}</option>`)}
                                </select>
                                <select 
                                    value=${batchTerm}
                                    onChange=${(e) => setBatchTerm(e.target.value)}
                                    class="px-3 py-2 border rounded-lg text-sm font-medium"
                                >
                                    <option value="T1">Term 1</option>
                                    <option value="T2">Term 2</option>
                                    <option value="T3">Term 3</option>
                                    <option value="FULL">Full Year</option>
                                </select>
                                <${PrintButtons} />
                            </div>
                        </div>
                        <div class="space-y-12">
                            ${gradeStudents.map((s, idx) => html`
                                <div class=${idx > 0 ? 'page-break pt-8' : ''}>
                                    <${StudentDetail} student=${s} data=${data} setData=${setData} isBatch=${true} initialTerm=${batchTerm} isAdmin=${isAdmin} teacherSession=${teacherSession} />
                                </div>
                            `)}
                        </div>
                    </div>
                `;
            }
            case 'students': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="students" /></div>
                    <${Students} data=${data} setData=${setData} onSelectStudent=${(id) => navigate('student-detail', { studentId: id })} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedReligion=${allowedTeacherReligion} />
                </div>
            `;
            case 'teachers': return html`<${Teachers} data=${data} setData=${setData} />`;
            case 'staff': return html`<${Staff} data=${data} setData=${setData} />`;
            case 'marklist': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="assessments" /></div>
                <${Marklist} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
                </div>
            `;
            case 'assessments': return html`
                <${Assessments} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
            `;
            case 'attendance': return html`
                <${Attendance} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedGrades=${allowedTeacherGrades} />
            `;
            case 'senior-school': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="senior-school" /></div>
                    <${SeniorSchool} data=${data} setData=${setData} />
                </div>
            `;
            case 'timetable': return html`<${Timetable} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            case 'result-analysis': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="academic-full" /></div>
                    <${ResultAnalysis} data=${data} onSelectStudent=${handleAcademicPrintSelect} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
                </div>
            `;
            case 'fees': return html`<${Fees} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            case 'fees-register': return html`<${FeesRegister} data=${data} />`;
            case 'fee-reminder': return html`<${FeeReminder} data=${data} />`;
            case 'transport': return html`<${Transport} data=${data} setData=${setData} />`;
            case 'library': return html`<${Library} data=${data} setData=${setData} />`;
            case 'payroll': return html`<${Payroll} data=${data} setData=${setData} />`;
            case 'archives': return html`<${Archives} data=${data} />`;
            case 'settings': return html`<${Settings} data=${data} setData=${setData} />`;
            case 'student-detail': return html`<${StudentDetail} student=${selectedStudent} data=${data} setData=${setData} onBack=${() => setView('students')} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            default: return html`<${Dashboard} data=${data} setData=${setData} googleSyncStatus=${googleSyncStatus} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
        }
    };

    return html`
        <div class=${`flex flex-col h-screen w-full overflow-hidden ${data.settings.theme === 'dark' ? 'dark text-white' : ''}`}>
            <!-- Dynamic Styles Injection -->
            <style>
                :root {
                    --primary: ${data.settings.primaryColor || '#2563eb'};
                    --secondary: ${data.settings.secondaryColor || '#64748b'};
                }
                .bg-primary { background-color: var(--primary) !important; }
                .text-primary { color: var(--primary) !important; }
                .border-primary { border-color: var(--primary) !important; }
                .focus\:ring-primary:focus { --tw-ring-color: var(--primary) !important; }
                .focus\:border-primary:focus { border-color: var(--primary) !important; }
                
                .bg-secondary { background-color: var(--secondary) !important; }
                .text-secondary { color: var(--secondary) !important; }
                .border-secondary { border-color: var(--secondary) !important; }
                
                /* Override hardcoded blue-600 occurrences for global theme consistency */
                .bg-blue-600 { background-color: var(--primary) !important; }
                .text-blue-600 { color: var(--primary) !important; }
                .border-blue-600 { border-color: var(--primary) !important; }
                .shadow-blue-200 { --tw-shadow-color: var(--primary); shadow: 0 10px 15px -3px var(--primary); }
                
                ${data.settings.theme === 'dark' ? `
                    .bg-white { background-color: #0f172a !important; color: #f1f5f9; }
                    .bg-slate-50 { background-color: #1e293b !important; }
                    .bg-slate-100 { background-color: #334155 !important; }
                    .border-slate-100, .border-slate-50, .border-blue-100 { border-color: #334155 !important; }
                    .text-slate-900 { color: #f8fafc !important; }
                    .text-slate-500, .text-slate-400 { color: #94a3b8 !important; }
                ` : ''}

                /* GLOBAL PRINT STYLES */
                @media print {
                    @page {
                        margin: 10mm;
                    }

                    html, body {
                        width: auto !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }

                    /* Hide header, sidebar, and nav */
                    header,
                    .no-print,
                    [class*="sidebar"],
                    nav,
                    [class*="mobile"] {
                        display: none !important;
                    }

                    /* Main layout for printing */
                    .flex.flex-1.overflow-hidden {
                        display: block !important;
                        flex: none !important;
                        overflow: visible !important;
                    }

                    main {
                        display: block !important;
                        flex: none !important;
                        width: 100% !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .max-w-6xl {
                        max-width: 100% !important;
                    }

                    /* Preserve colors */
                    [class*="bg-"] {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    [class*="text-"] {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    img {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .rounded-2xl, .rounded-xl, .rounded-lg {
                        border-radius: 0.5rem !important; /* Keep some rounding but subtle */
                    }
                }
            </style>

            <!-- Navbar -->
            <header class="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 z-40 no-print">
                <div class="flex items-center gap-3">
                    <button 
                        onClick=${() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        class="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                    >
                        <span class="text-xl">☰</span>
                    </button>
                    <img src="${data.settings.schoolLogo}" class="w-8 h-8 object-contain" />
                    <span class="font-black tracking-tight text-lg hidden sm:block">${data.settings.schoolName}</span>
                </div>
                
                <div class="flex items-center gap-3">
                    <button 
                        onClick=${() => {
                            if (!data.settings.googleScriptUrl) {
                                alert("Google Sheet not configured. Go to Settings > Teacher Data Sync.");
                                return;
                            }
                            handlePullFromGoogle();
                        }}
                        disabled=${isGoogleSyncing}
                        class=${`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${isGoogleSyncing
            ? 'bg-green-50 border-green-200 text-green-600 animate-pulse'
            : googleSyncStatus?.includes('✓')
                ? 'bg-green-100 border-green-300 text-green-700'
                : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-green-500 hover:text-green-600'
        }`}
                    >
                        <span class=${isGoogleSyncing ? 'animate-spin' : ''}>${isGoogleSyncing ? '⏳' : '📥'}</span>
                        <span class="hidden sm:inline">${googleSyncStatus || 'Get from Google'}</span>
                    </button>
                    
                    <button 
                        onClick=${() => {
                            if (!data.settings.googleScriptUrl) {
                                alert("Google Sheet not configured.");
                                return;
                            }
                            // Force immediate sync without cooldown
                            lastSyncRef.current = 0;
                            handleGoogleSync();
                        }}
                        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
                        title="Instant sync - pushes all local data to Google immediately"
                    >
                        <span>⚡</span>
                        <span class="hidden sm:inline">Push to Google</span>
                    </button>

                    <button 
                        onClick=${() => {
                            if (!data.settings.googleScriptUrl) {
                                alert("Google Sheet not configured.");
                                return;
                            }
                            setShowForcePushModal(true);
                        }}
                        disabled=${isGoogleSyncing}
                        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border bg-red-50 border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        title="Force push selected local data to Google"
                    >
                        <span>🔥</span>
                        <span class="hidden sm:inline">Force Push</span>
                    </button>

                    <div class="h-8 w-px bg-slate-100 mx-1 hidden sm:block"></div>

                    ${isAdmin ? html`
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold uppercase">Admin Mode</span>
                            <button onClick=${handleLogout} class="text-xs font-bold text-red-500 hover:underline uppercase">Logout</button>
                        </div>
                    ` : teacherSession ? html`
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1">
                                <span>👩‍🏫</span>
                                ${teacherSession.name || teacherSession.username}
                            </span>
                            <button onClick=${handleLogout} class="text-xs font-bold text-red-500 hover:underline uppercase">Logout</button>
                        </div>
                    ` : html`
                        <div class="flex items-center gap-2">
                            <button onClick=${openTeacherAuth} class="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1">
                                <span>👩‍🏫</span>
                                <span class="hidden sm:inline">Teacher Login</span>
                            </button>
                            <button onClick=${() => setShowLoginModal(true)} class="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-blue-200">
                                Admin
                            </button>
                        </div>
                    `}
                </div>
            </header>

            <div class="flex flex-1 overflow-hidden">
                <${Sidebar} 
                    currentView=${view} 
                    setView=${setView} 
                    isCollapsed=${sidebarCollapsed} 
                    setCollapsed=${setSidebarCollapsed}
                    isMobileOpen=${isMobileMenuOpen}
                    setIsMobileOpen=${setIsMobileMenuOpen}
                    isAdmin=${isAdmin}
                    teacherSession=${teacherSession}
                    onOpenAuth=${openTeacherAuth}
                />
                <main class="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
                    <div class="max-w-6xl mx-auto p-4 md:p-8">
                        ${!isAuthenticated ? html`
                            <div class="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                                <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-5xl">
                                    🔒
                                </div>
                                <h2 class="text-2xl font-bold text-slate-700">Welcome to EduTrack</h2>
                                <p class="text-slate-500 max-w-md">Please log in to access the school management system. Use Teacher Login or Admin Login to continue.</p>
                                <div class="flex gap-3 mt-4">
                                    <button 
                                        onClick=${openTeacherAuth} 
                                        class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                                    >
                                        <span>👩‍🏫</span> Teacher Login
                                    </button>
                                    <button 
                                        onClick=${() => setShowLoginModal(true)} 
                                        class="bg-green-600 text-white px-6 py-3 rounded-xl font-bold"
                                    >
                                        🔐 Admin Login
                                    </button>
                                </div>
                                <button 
                                    onClick=${() => setView('dashboard')} 
                                    class="mt-4 text-slate-400 hover:text-slate-600 text-sm"
                                >
                                    Continue to Dashboard →
                                </button>
                            </div>
                        ` : renderView()}
                    </div>
                </main>
            </div>

            <!-- Login Modal -->
            ${showLoginModal && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div class="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 class="text-2xl font-black mb-2">Administrator Login</h3>
                        <p class="text-slate-400 text-sm mb-6">Enter your security credentials to manage sensitive school data.</p>
                        <form onSubmit=${handleLogin} class="space-y-4">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Username</label>
                                <input 
                                    type="text"
                                    placeholder="Admin username"
                                    class="w-full p-4 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-primary outline-none"
                                    value=${loginUsername}
                                    onInput=${e => setLoginUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                                <input 
                                    type="password"
                                    placeholder="Admin password"
                                    class="w-full p-4 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-primary outline-none"
                                    value=${loginPassword}
                                    onInput=${e => setLoginPassword(e.target.value)}
                                />
                            </div>
                            <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-lg">
                                Sign In
                            </button>
                            <button type="button" onClick=${() => setShowLoginModal(false)} class="w-full text-slate-400 py-2 text-sm">
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>
            `}

            <!-- Teacher Authentication Modal -->
            ${showTeacherAuth && html`
                <${TeacherAuth} 
                    settings=${data.settings}
                    data=${data}
                    setData=${setData}
                    onLogin=${handleTeacherLogin}
                    onClose=${() => setShowTeacherAuth(false)}
                />
            `}

            <!-- Force Push Modal -->
            ${showForcePushModal && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-xl font-black text-red-600">🔥 Force Push to Google</h3>
                            <button onClick=${() => setShowForcePushModal(false)} class="text-2xl text-slate-300 hover:text-slate-500">&times;</button>
                        </div>
                        
                        <p class="text-sm text-slate-500 mb-4">Select data types to push to Google Sheet:</p>
                        
                        <div class="space-y-3 mb-6">
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.students}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, students: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">👥 Students</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.students?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.assessments}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, assessments: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">📝 Assessments</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.assessments?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.payments}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, payments: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">💰 Payments</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.payments?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.teachers}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, teachers: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">👨‍🏫 Teachers</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.teachers?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.staff}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, staff: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">👷 Staff</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.staff?.length || 0} records)</span>
                                </div>
                            </label>
                        </div>
                        
                        <div class="flex gap-3">
                            <button 
                                onClick=${() => setShowForcePushModal(false)}
                                class="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick=${forcePushToGoogle}
                                class="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                                🚀 Push Now
                            </button>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
};

const StudentDetail = ({ student, data, setData, onBack, isBatch = false, initialTerm = 'T1', isAdmin, teacherSession }) => {
    if (!student) return html`<div>Student not found</div>`;

    const [selectedTerm, setSelectedTerm] = useState(initialTerm);

    const settings = data.settings;
    const examTypes = ['Opener', 'Mid-Term', 'End-Term'];
    const isFullYear = selectedTerm === 'FULL';

    const getAssessmentsForTerm = (term) => {
        const academicYear = data.settings.academicYear || settings.academicYear;
        const studentIdStr = String(student.id);
        if (term === 'FULL') {
            return data.assessments.filter(a => String(a.studentId) === studentIdStr && a.academicYear === academicYear);
        }
        return data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === term && a.academicYear === academicYear);
    };

    const assessments = getAssessmentsForTerm(selectedTerm);

    // Calculate totals for summary cards based on subject averages
    let subjects = Storage.getSubjectsForGrade(student.grade, student);
    const isSenior = ['GRADE 10', 'GRADE 11', 'GRADE 12'].includes(student.grade);
    
    if (isSenior) {
        const studentIdStr = String(student.id);
        const academicYear = data.settings.academicYear || settings.academicYear;
        const theirAssessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.academicYear === academicYear);
        const takenSubjects = [...new Set(theirAssessments.map(a => a.subject))];
        let filtered = subjects.filter(s => takenSubjects.includes(s));
        if (filtered.length < 7) {
            filtered = [...new Set([...filtered, ...subjects])].slice(0, 7);
        }
        subjects = filtered.slice(0, 10);
    }

    const subjectAverages = subjects.map(subject => {
        const scores = examTypes.map(type => {
            const match = assessments.find(a => a.subject === subject && a.examType === type);
            if (!match) return null;
            const score = Number(match.score);
            return isNaN(score) ? null : score;
        }).filter(s => s !== null);
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    });

    const validAveragesForOverall = isSenior 
        ? subjectAverages.filter(a => a !== null).sort((a, b) => b - a).slice(0, 7)
        : subjectAverages.filter(a => a !== null);

    const totalMarks = validAveragesForOverall.reduce((sum, avg) => sum + avg, 0);
    const subjectCount = subjects.length;
    // Overall level = calculated from average of subject percentages
    const overallResult = Storage.getOverallLevel(validAveragesForOverall);
    const overallLevel = overallResult.level;
    const overallPercentage = overallResult.percentage;
    const overallAL = overallResult.al;
    const attendancePercentage = isFullYear
        ? Storage.getStudentAttendance(student.id, data.attendance || [])
        : Storage.getStudentAttendance(student.id, data.attendance || [], selectedTerm);

    const getYearSummary = () => {
        const academicYear = data.settings.academicYear || settings.academicYear;
        const studentIdStr = String(student.id);
        const terms = ['T1', 'T2', 'T3'];
        return terms.map(term => {
            const termAssessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === term && a.academicYear === academicYear);
            
            const subjectPoints = {};
            let termPoints = 0;
            
            const termSubjects = subjects.map(subject => {
                const scores = examTypes.map(type => {
                    const match = termAssessments.find(a => a.subject === subject && a.examType === type);
                    return match ? Number(match.score) : null;
                }).filter(s => s !== null);
                
                return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
            });

            const validItems = termSubjects.map((avg, i) => ({ subject: subjects[i], avg })).filter(item => item.avg !== null);
            const consideredItems = isSenior && validItems.length > 7 ? [...validItems].sort((a, b) => b.avg - a.avg).slice(0, 7) : validItems;

            consideredItems.forEach(item => {
                const gradeInfo = Storage.getGradeInfo(item.avg);
                if (gradeInfo) {
                    subjectPoints[item.subject] = gradeInfo.points;
                    termPoints += gradeInfo.points;
                }
            });

            const validAveragesForOverall = consideredItems.map(item => item.avg);
            const termOverall = Storage.getOverallLevel(validAveragesForOverall);
            const termAttendance = Storage.getStudentAttendance(student.id, data.attendance || [], term);
            
            return { term, avgScore: termOverall.percentage, termLevel: termOverall.level, termPercentage: termOverall.percentage, termAL: termOverall.al, termAttendance, subjectPoints, termPoints };
        });
    };

    const yearSummary = isFullYear ? getYearSummary() : [];
    const gradeValues = { 'EE': 4, 'ME': 3, 'AE': 2, 'BE': 1 };

    const t1Data = yearSummary[0] || {};
    const t2Data = yearSummary[1] || {};
    const t3Data = yearSummary[2] || {};

    // Filter out voided payments from balance calculation
    // Important: Use String() conversion for IDs to avoid numeric mismatch
    const paymentsForStudent = (data.payments || []).filter(p => String(p.studentId) === String(student.id) && !p.voided);
    const totalPaid = paymentsForStudent.reduce((sum, p) => sum + Number(p.amount), 0);

    const feeStructure = data.settings.feeStructures.find(f => f.grade === student.grade);
    const feeKeys = ['t1', 't2', 't3', 'breakfast', 'lunch', 'trip', 'bookFund', 'caution', 'uniform', 'studentCard', 'remedial'];

    // Calculate total due: Previous Arrears + Student's selected payable items
    let selectedKeys;
    if (typeof student.selectedFees === 'string') {
        selectedKeys = student.selectedFees.split(',').map(f => f.trim()).filter(f => f);
    } else if (Array.isArray(student.selectedFees)) {
        selectedKeys = student.selectedFees;
    } else {
        selectedKeys = ['t1', 't2', 't3'];
    }
    const previousArrears = Number(student.previousArrears) || 0;
    const currentFeesDue = feeStructure ? selectedKeys.reduce((sum, key) => sum + (feeStructure[key] || 0), 0) : 0;
    const totalDue = previousArrears + currentFeesDue;
    const balance = totalDue - totalPaid;

    const remark = (data.remarks || []).find(r => r.studentId === student.id) || { teacher: '', principal: '' };
    const studentGradeWithStream = student.grade + (student.stream || '');
    const classTeacher = (data.teachers || []).find(t => t.isClassTeacher && t.classTeacherGrade === studentGradeWithStream);
    
    // Check if the current user is the class teacher for this student
    const isThisClassTeacher = teacherSession && (
        (teacherSession.role === 'class_teacher' && teacherSession.classTeacherGrade === studentGradeWithStream) ||
        (teacherSession.role === 'head_teacher') ||
        (teacherSession.role === 'admin') ||
        (classTeacher && (
            (teacherSession.name && classTeacher.name && teacherSession.name.toLowerCase() === classTeacher.name.toLowerCase()) || 
            (teacherSession.username && classTeacher.username && teacherSession.username.toLowerCase() === classTeacher.username.toLowerCase())
        ))
    );

    const handleRemarkChange = (field, val) => {
        const otherRemarks = (data.remarks || []).filter(r => r.studentId !== student.id);
        setData({
            ...data,
            remarks: [...otherRemarks, { ...remark, studentId: student.id, [field]: val }]
        });
    };

    return html`
        <div class="space-y-4 print:space-y-2 student-report-root">
            ${!isBatch && html`
                <button type="button" onClick=${onBack} class="text-blue-600 flex items-center gap-1 no-print">
                    <span class="text-xl">←</span> Back to Students
                </button>
            `}
            
            <div class=${`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-0 print:shadow-none print:p-0 student-report-sheet ${isBatch ? '' : ''}`}>
                <div class="hidden print:flex flex-col items-center text-center border-b pb-2 mb-2">
                    <img src="${settings.schoolLogo}" class="w-12 h-12 mb-1 object-contain" alt="Logo" />
                    <h1 class="text-xl font-black uppercase text-slate-900">${settings.schoolName}</h1>
                    <p class="text-[10px] text-slate-500 font-medium">${settings.schoolAddress}</p>
                    <div class="mt-2 border-t border-slate-200 w-full pt-2">
                        <h2 class="text-sm font-extrabold uppercase tracking-widest text-blue-600">${isFullYear ? 'Annual Comprehensive Report' : 'Progressive Student Report - ' + selectedTerm.replace('T', 'Term ')}</h2>
                    </div>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b pb-2 print:border-b-2 print:border-black">
                    <div class="w-full">
                        <h2 class="text-xl font-black border-b border-slate-100 pb-1 mb-1">${student.name}</h2>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-slate-500 text-[10px]">
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Grade / Class</p>
                                <p class="font-bold text-slate-900">${student.grade}${student.stream ? student.stream : ''}</p>
                            </div>
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Admission No.</p>
                                <p class="font-bold text-slate-900 font-mono">${student.admissionNo}</p>
                            </div>
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Assess/UPI No.</p>
                                <p class="font-bold text-slate-900 font-mono">${student.assessmentNo || student.upiNo || '-'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 no-print items-center">
                        <select 
                            value=${selectedTerm}
                            onChange=${(e) => setSelectedTerm(e.target.value)}
                            class="px-3 py-2 border rounded-lg text-sm font-medium"
                        >
                            <option value="T1">Term 1</option>
                            <option value="T2">Term 2</option>
                            <option value="T3">Term 3</option>
                            <option value="FULL">Full Year</option>
                        </select>
                        ${(isAdmin || isThisClassTeacher) && html`<${PrintButtons} />`}
                    </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-5 print:grid-cols-5 gap-2 mt-4 print:mt-2 student-report-summary">
                    <div class="p-2 bg-blue-50 rounded-lg print:p-1.5 border border-blue-100">
                        <p class="text-[8px] text-blue-600 font-bold uppercase">Fee Balance</p>
                        <p class="text-sm font-bold print:text-[11px]">${data.settings.currency} ${balance.toLocaleString()}</p>
                    </div>
                    <div class="p-2 bg-slate-50 rounded-lg print:p-1.5 border border-slate-100">
                        <p class="text-[8px] text-slate-500 font-bold uppercase">${isFullYear ? 'Year Avg' : 'Total Marks'}</p>
                        <p class="text-sm font-bold print:text-[11px]">${isFullYear
            ? (() => {
                const allScores = [];
                yearSummary.forEach(ys => {
                    subjects.forEach(subject => {
                        const pts = ys.subjectPoints?.[subject] || 0;
                        if (pts > 0) allScores.push(pts);
                    });
                });
                if (allScores.length === 0) return '-';
                const avgPts = allScores.reduce((a, b) => a + b, 0) / allScores.length;
                return Math.round(avgPts * 12.5) + '%';
            })()
            : totalMarks}</p>
                    </div>
                    <div class="p-2 bg-green-50 rounded-lg print:p-1.5 border border-green-100">
                        <p class="text-[8px] text-green-600 font-bold uppercase">Overall %</p>
                        <p class="text-sm font-bold print:text-[11px]">${overallPercentage}%</p>
                    </div>
                    <div class="p-2 bg-blue-50 rounded-lg print:p-1.5 border border-blue-100">
                        <p class="text-[8px] text-blue-600 font-bold uppercase">AL</p>
                        <p class="text-sm font-bold print:text-[11px]">${overallAL}</p>
                    </div>
                    <div class="p-2 bg-orange-50 rounded-lg print:p-1.5 border border-orange-100">
                        <p class="text-[8px] text-orange-600 font-bold uppercase">Grade</p>
                        <p class="text-sm font-bold print:text-[11px]">${overallLevel}</p>
                    </div>
                    <div class="p-2 bg-purple-50 rounded-lg print:p-1.5 border border-purple-100">
                        <p class="text-[8px] text-purple-600 font-bold uppercase">${isFullYear ? 'Year Attend.' : 'Attendance'}</p>
                        <p class="text-sm font-bold print:text-[11px]">${attendancePercentage !== null ? attendancePercentage + '%' : '-'}</p>
                    </div>
                </div>

                ${isFullYear ? html`
                    <!-- Full Year Report: Show all 3 terms for each subject -->
                    <div class="mt-4 print:mt-2">
                        <div class="border rounded-xl overflow-hidden print:border-black print:rounded-none overflow-x-auto no-scrollbar">
                            <table class="w-full text-left student-report-table">
                                <thead class="bg-slate-50 print:bg-white border-b print:border-b-2 print:border-black">
                                    <tr class="text-[9px] uppercase font-black text-slate-500">
                                        <th class="p-2 print:p-1.5" rowspan="2">Learning Area</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-green-50" colspan="3">Term 1</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-blue-50" colspan="3">Term 2</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-purple-50" colspan="3">Term 3</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-orange-50" rowspan="2">Year Avg</th>
                                        <th class="p-2 print:p-1.5 text-center border-l" rowspan="2">Level</th>
                                        <th class="p-2 print:p-1.5 text-center border-l font-black" rowspan="2">Pts</th>
                                    </tr>
                                    <tr class="text-[8px] uppercase font-black text-slate-500">
                                        <th class="p-1 print:p-0.5 text-center border-l bg-green-50">Op</th>
                                        <th class="p-1 print:p-0.5 text-center bg-green-50">Mid</th>
                                        <th class="p-1 print:p-0.5 text-center bg-green-50">End</th>
                                        <th class="p-1 print:p-0.5 text-center border-l bg-blue-50">Op</th>
                                        <th class="p-1 print:p-0.5 text-center bg-blue-50">Mid</th>
                                        <th class="p-1 print:p-0.5 text-center bg-blue-50">End</th>
                                        <th class="p-1 print:p-0.5 text-center border-l bg-purple-50">Op</th>
                                        <th class="p-1 print:p-0.5 text-center bg-purple-50">Mid</th>
                                        <th class="p-1 print:p-0.5 text-center bg-purple-50">End</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y print:divide-black">
                                    ${subjects.map(subject => {
                const academicYear = data.settings.academicYear || settings.academicYear;
                const studentIdStr = String(student.id);
                const t1Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T1' && a.subject === subject && a.academicYear === academicYear);
                const t2Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T2' && a.subject === subject && a.academicYear === academicYear);
                const t3Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T3' && a.subject === subject && a.academicYear === academicYear);

                const getScores = (termAssessments) => {
                    const scores = {};
                    examTypes.forEach(type => {
                        const match = termAssessments.find(a => a.examType === type);
                        if (match) {
                            const score = Number(match.score);
                            scores[type] = isNaN(score) ? null : score;
                        } else {
                            scores[type] = null;
                        }
                    });
                    const valid = Object.values(scores).filter(s => s !== null);
                    return {
                        scores,
                        avg: valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
                    };
                };

                const t1 = getScores(t1Assessments);
                const t2 = getScores(t2Assessments);
                const t3 = getScores(t3Assessments);

                const yearAvgScores = [t1.avg, t2.avg, t3.avg].filter(a => a !== null);
                const yearAvg = yearAvgScores.length > 0 ? Math.round(yearAvgScores.reduce((a, b) => a + b, 0) / yearAvgScores.length) : null;
                const gradeInfo = yearAvg !== null ? Storage.getGradeInfo(yearAvg) : null;

                return html`
                                            <tr class="print:break-inside-avoid hover:bg-slate-50 border-b print:border-black">
                                                <td class="p-2 print:p-1.5 font-bold text-slate-800 print:text-[10px]">${subject}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 border-l bg-green-50/30 print:text-[9px]">${t1.scores['Opener'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-green-50/30 print:text-[9px]">${t1.scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-green-50/30 print:text-[9px]">${t1.scores['End-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 border-l bg-blue-50/30 print:text-[9px]">${t2.scores['Opener'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-blue-50/30 print:text-[9px]">${t2.scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-blue-50/30 print:text-[9px]">${t2.scores['End-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 border-l bg-purple-50/30 print:text-[9px]">${t3.scores['Opener'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-purple-50/30 print:text-[9px]">${t3.scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-purple-50/30 print:text-[9px]">${t3.scores['End-Term'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center font-black text-orange-600 border-l bg-orange-50/30 print:text-[10px]">${yearAvg !== null ? yearAvg + '%' : '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center border-l">
                                                    <span class=${`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${gradeInfo && gradeInfo.level !== '-' ? (
                        gradeInfo.level.startsWith('EE') ? 'bg-green-100 text-green-700' :
                            gradeInfo.level.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                                gradeInfo.level.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                    ) : 'text-slate-300'
                    }`}>
                                                        ${gradeInfo ? gradeInfo.level : '-'}
                                                    </span>
                                                </td>
                                                <td class="p-2 print:p-1.5 text-center border-l font-black text-slate-700 print:text-[10px]">
                                                    ${gradeInfo ? gradeInfo.points : '-'}
                                                </td>
                                            </tr>
                                        `;
            })}
                                </tbody>
                                <tfoot class="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                                    <tr class="print:border-black">
                                        <td class="p-2 print:p-1.5 uppercase text-[9px]">Term Totals</td>
                                        ${(() => {
                const academicYear = data.settings.academicYear || settings.academicYear;
                const studentIdStr = String(student.id);
                return ['T1', 'T2', 'T3'].map(term => {
                const termAssessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === term && a.academicYear === academicYear);
                const sum = termAssessments.reduce((a, b) => a + Number(b.score), 0);
                return html`<td colspan="3" class="p-2 print:p-1.5 text-center border-l text-[10px] print:text-[9px]">${sum || '-'}</td>`;
            })})}
                                        <td class="p-2 print:p-1.5 text-center border-l bg-orange-50/50 text-orange-700 text-[10px] print:text-[10px]">
                                            ${(() => {
                const allTermPoints = [];
                yearSummary.forEach(ys => {
                    subjects.forEach(subject => {
                        const pts = ys.subjectPoints?.[subject] || 0;
                        if (pts > 0) allTermPoints.push(pts);
                    });
                });
                if (allTermPoints.length === 0) return '-';
                const avgPts = allTermPoints.reduce((a, b) => a + b, 0) / allTermPoints.length;
                const avgScore = Math.round(avgPts * 12.5);
                return avgScore + '%';
            })()}
                                        </td>
                                        <td class="p-2 print:p-1.5 text-center border-l font-black text-orange-700 print:text-[10px]">
                                            ${(() => {
                const allTermPoints = [];
                yearSummary.forEach(ys => {
                    subjects.forEach(subject => {
                        const pts = ys.subjectPoints?.[subject] || 0;
                        if (pts > 0) allTermPoints.push(pts);
                    });
                });
                if (allTermPoints.length === 0) return '-';
                const avgPts = allTermPoints.reduce((a, b) => a + b, 0) / allTermPoints.length;
                const avgScore = Math.round(avgPts * 12.5);
                return Storage.getGradeInfo(avgScore)?.level || '-';
            })()}
                                        </td>
                                        <td class="p-2 print:p-1.5 text-center border-l font-black text-orange-700 print:text-[10px]">
                                            ${(() => {
                const allTermPoints = [];
                yearSummary.forEach(ys => {
                    subjects.forEach(subject => {
                        const pts = ys.subjectPoints?.[subject] || 0;
                        if (pts > 0) allTermPoints.push(pts);
                    });
                });
                if (allTermPoints.length === 0) return '-';
                return (allTermPoints.reduce((a, b) => a + b, 0) / allTermPoints.length).toFixed(1);
            })()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ` : html`
                    <!-- Termly Report: Original format -->
                    <div class="mt-4 print:mt-2">
                        <div class="border rounded-xl overflow-hidden print:border-black print:rounded-none overflow-x-auto no-scrollbar">
                            <table class="w-full text-left student-report-table">
                                <thead class="bg-slate-50 print:bg-white border-b print:border-b-2 print:border-black">
                                    <tr class="text-[9px] uppercase font-black text-slate-500">
                                        <th class="p-2 print:p-1.5">Learning Area</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">Opener</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">Mid</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">End</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-blue-50 text-blue-700">Average</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">Level</th>
                                        <th class="p-2 print:p-1.5 text-center border-l font-black">Pts</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y print:divide-black">
                                    ${subjects.map(subject => {
                const scores = {};
                examTypes.forEach(type => {
                    const match = assessments.find(a => a.subject === subject && a.examType === type);
                    scores[type] = match ? Number(match.score) : null;
                });

                const validScores = Object.values(scores).filter(s => s !== null);
                const average = validScores.length > 0
                    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                    : null;

                const gradeInfo = average !== null ? Storage.getGradeInfo(average) : null;

                return html`
                                            <tr class="print:break-inside-avoid hover:bg-slate-50 border-b print:border-black last:border-0">
                                                <td class="p-2 print:p-1.5 font-bold text-slate-800 print:text-[11px]">
                                                    ${subject}
                                                </td>
                                                <td class="p-2 print:p-1.5 text-center text-slate-500 border-l font-medium print:text-[11px]">${scores['Opener'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center text-slate-500 border-l font-medium print:text-[11px]">${scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center text-slate-500 border-l font-medium print:text-[11px]">${scores['End-Term'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center font-black text-blue-600 border-l bg-blue-50/30 print:text-[11px]">${average !== null ? average + '%' : '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center border-l">
                                                    <span class=${`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${gradeInfo && gradeInfo.level !== '-' ? (
                        gradeInfo.level.startsWith('EE') ? 'bg-green-100 text-green-700' :
                            gradeInfo.level.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                                gradeInfo.level.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                    ) : 'text-slate-300'
                    }`}>
                                                        ${gradeInfo ? gradeInfo.level : '-'}
                                                    </span>
                                                </td>
                                                <td class="p-2 print:p-1.5 text-center border-l font-black text-slate-700 print:text-[11px]">
                                                    ${gradeInfo ? gradeInfo.points : '-'}
                                                </td>
                                            </tr>
                                        `;
            })}
                                </tbody>
                                <tfoot class="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                                    <tr class="print:border-black">
                                        <td class="p-2 print:p-1.5 uppercase text-[9px]">Learning Area Totals</td>
                                        ${['Opener', 'Mid-Term', 'End-Term'].map(type => {
                const typeAssessments = assessments.filter(a => a.examType === type);
                let validScores = subjects.map(s => {
                    const m = typeAssessments.find(a => a.subject === s);
                    return m ? Number(m.score) : null;
                }).filter(s => s !== null);
                if (isSenior && validScores.length > 7) validScores = validScores.sort((a,b) => b-a).slice(0,7);
                const sum = validScores.reduce((a, b) => a + b, 0);
                return html`<td class="p-2 print:p-1.5 text-center border-l text-[10px] print:text-[11px]">${sum || '-'}</td>`;
            })}
                                        <td class="p-2 print:p-1.5 text-center border-l bg-blue-50/50 text-blue-700 text-[10px] print:text-[11px]">
                                            ${totalMarks || '-'}
                                        </td>
                                        <td class="p-2 print:p-1.5 text-center border-l font-black text-blue-700 print:text-[11px]">${overallLevel}</td>
                                        <td class="p-2 print:p-1.5 text-center border-l font-black text-slate-700 print:text-[11px]">
                                            ${validAveragesForOverall.reduce((sum, avg) => sum + (Storage.getGradeInfo(avg)?.points || 0), 0) || '-'}
                                        </td>
                                    </tr>
                                    <tr class="bg-white print:border-black">
                                        <td class="p-2 print:p-1.5 uppercase text-[9px] text-blue-600 font-black">Mean Score Average</td>
                                        ${['Opener', 'Mid-Term', 'End-Term'].map(type => {
                const typeAssessments = assessments.filter(a => a.examType === type);
                let validScores = subjects.map(s => {
                    const m = typeAssessments.find(a => a.subject === s);
                    return m ? Number(m.score) : null;
                }).filter(s => s !== null);
                if (isSenior && validScores.length > 7) validScores = validScores.sort((a,b) => b-a).slice(0,7);
                const avg = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
                return html`<td class="p-2 print:p-1.5 text-center border-l text-blue-600 font-black text-[10px] print:text-[11px]">${avg ? avg + '%' : '-'}</td>`;
            })}
                                    <td class="p-2 print:p-1.5 text-center border-l bg-blue-600 text-white text-[10px] print:text-[11px] font-black">
                                        ${overallPercentage}%
                                    </td>
                                    <td class="border-l text-center font-black print:text-[11px]">${overallLevel}</td>
                                    <td class="border-l text-center font-black print:text-[11px]">${Storage.getGradeInfo(overallPercentage)?.points || '-'}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                `}

                <!-- Bar Graph Visualization -->
                <div class="mt-4 print:mt-2 student-report-graph">
                    ${isFullYear ? html`
                        <!-- Full Year: Bar graph showing term comparison per subject -->
                        <div class="bg-white p-3 rounded-xl border border-slate-100 print:border-black">
                            <h3 class="font-black text-[10px] uppercase text-slate-500 mb-3">Subject Performance Comparison</h3>
                            <div class="flex flex-wrap gap-1 justify-center items-end h-32 print:h-24">
                                ${(() => {
                const academicYear = data.settings.academicYear || settings.academicYear;
                const studentIdStr = String(student.id);
                return subjects.map((subject, idx) => {
                const t1Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T1' && a.subject === subject && a.academicYear === academicYear);
                const t2Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T2' && a.subject === subject && a.academicYear === academicYear);
                const t3Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T3' && a.subject === subject && a.academicYear === academicYear);
                const getAvg = (assessments) => {
                    const scores = assessments.map(a => Number(a.score));
                    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                };
                const t1 = getAvg(t1Assessments);
                const t2 = getAvg(t2Assessments);
                const t3 = getAvg(t3Assessments);
                const maxVal = Math.max(t1, t2, t3, 1);
                return html`
                                        <div class="flex flex-col items-center">
                                            <div class="flex items-end gap-0.5 h-20 print:h-16">
                                                <div class="w-3 print:w-2 bg-green-400 rounded-t" style="height: ${(t1 / maxVal) * 100}%" title="T1: ${t1}%"></div>
                                                <div class="w-3 print:w-2 bg-blue-400 rounded-t" style="height: ${(t2 / maxVal) * 100}%" title="T2: ${t2}%"></div>
                                                <div class="w-3 print:w-2 bg-purple-400 rounded-t" style="height: ${(t3 / maxVal) * 100}%" title="T3: ${t3}%"></div>
                                            </div>
                                            <span class="text-[7px] text-slate-500 truncate max-w-[40px] print:max-w-[30px]">${subject.substring(0, 8)}</span>
                                        </div>
                                    `;
                });
            })()}
                            </div>
                            <div class="flex justify-center gap-4 mt-2 text-[8px]">
                                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-green-400 rounded"></span> Term 1</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-400 rounded"></span> Term 2</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-purple-400 rounded"></span> Term 3</span>
                            </div>
                        </div>
                    ` : html`
                        <!-- Termly: Bar graph showing subject averages -->
                        <div class="bg-white p-3 rounded-xl border border-slate-100 print:border-black">
                            <h3 class="font-black text-[10px] uppercase text-slate-500 mb-3">Subject Performance Overview</h3>
                            <div class="flex flex-wrap gap-1 justify-center items-end h-28 print:h-20">
                                ${subjects.map((subject, idx) => {
                const avg = subjectAverages[idx] || 0;
                const maxScore = 100;
                const gradeInfo = avg > 0 ? Storage.getGradeInfo(avg) : null;
                const barColor = gradeInfo?.level?.startsWith('EE') ? 'bg-green-500' :
                    gradeInfo?.level?.startsWith('ME') ? 'bg-blue-500' :
                        gradeInfo?.level?.startsWith('AE') ? 'bg-yellow-500' :
                            gradeInfo?.level?.startsWith('BE') ? 'bg-red-500' : 'bg-slate-300';
                return html`
                                        <div class="flex flex-col items-center">
                                            <div class="text-[8px] font-bold text-slate-600">${avg}%</div>
                                            <div class="w-6 print:w-4 ${barColor} rounded-t" style="height: ${(avg / maxScore) * 80}px"></div>
                                            <span class="text-[7px] text-slate-500 truncate max-w-[50px] print:max-w-[35px]">${subject.substring(0, 10)}</span>
                                        </div>
                                    `;
            })}
                            </div>
                            <div class="flex justify-center gap-3 mt-2 text-[8px]">
                                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-green-500 rounded"></span> EE</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-500 rounded"></span> ME</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-yellow-500 rounded"></span> AE</span>
                                <span class="flex items-center gap-1"><span class="w-2 h-2 bg-red-500 rounded"></span> BE</span>
                            </div>
                        </div>
                    `}
                </div>

                <div class="mt-4 space-y-4 print:mt-2 print:space-y-2">
                    <!-- Teacher/Principal Comments - Only show for termly, full year shows analysis -->
                    ${!isFullYear && html`
                        <div class="flex flex-col md:flex-row gap-4 print:flex-col print:gap-4 student-report-comments">
                            <div class="w-full md:w-[48%] break-inside-avoid print:w-full print:mb-2">
                                <div class="p-3 bg-slate-50 rounded-lg border border-slate-100 print:border-black print:bg-white print:w-full">
                                    <p class="text-[9px] font-bold text-slate-500 uppercase mb-1">Class Teacher's Remarks</p>
                                    <textarea 
                                        class="w-full h-24 bg-transparent border-0 focus:ring-0 text-xs italic outline-none no-print resize-none" 
                                        placeholder="Enter teacher comments..."
                                        value=${remark.teacher}
                                        onInput=${(e) => handleRemarkChange('teacher', e.target.value)}
                                    ></textarea>
                                    <div class="hidden print:block">
                                        <p class="text-xs italic border-b border-dotted border-black pb-2 mb-2 student-report-comment-text" style="min-height: 60px; max-height: 60px; overflow: hidden;">
                                            ${remark.teacher || '____________________________________________'}
                                        </p>
                                    </div>
                                    <div class="flex items-center justify-between border-t border-dotted border-slate-300 print:border-black pt-1 mt-2">
                                        <div class="h-10 w-24 flex items-center justify-center border-b border-slate-300 print:border-black">
                                            <img src="${settings.clerkSignature || settings.schoolLogo}" class="h-full object-contain ${settings.clerkSignature ? '' : 'opacity-20'}" alt="Signature" />
                                        </div>
                                        <span class="text-[8px] text-slate-400 uppercase">Class Teacher</span>
                                    </div>
                                </div>
                            </div>
                            <div class="w-full md:w-[48%] break-inside-avoid print:w-full print:mb-2">
                                <div class="p-3 bg-slate-50 rounded-lg border border-slate-100 print:border-black print:bg-white print:w-full">
                                    <p class="text-[9px] font-bold text-slate-500 uppercase mb-1">Principal's Remarks</p>
                                    <textarea 
                                        class="w-full h-24 bg-transparent border-0 focus:ring-0 text-xs italic outline-none no-print resize-none" 
                                        placeholder="Enter principal comments..."
                                        value=${remark.principal}
                                        onInput=${(e) => handleRemarkChange('principal', e.target.value)}
                                    ></textarea>
                                    <div class="hidden print:block">
                                        <p class="text-xs italic border-b border-dotted border-black pb-2 mb-2 student-report-comment-text" style="min-height: 60px; max-height: 60px; overflow: hidden;">
                                            ${remark.principal || '____________________________________________'}
                                        </p>
                                    </div>
                                    <div class="flex items-center justify-between border-t border-dotted border-slate-300 print:border-black pt-1 mt-2">
                                        <div class="h-10 w-24 flex items-center justify-center border-b border-slate-300 print:border-black">
                                            <img src="${settings.principalSignature || settings.schoolLogo}" class="h-full object-contain ${settings.principalSignature ? '' : 'opacity-20'}" alt="Signature" />
                                        </div>
                                        <span class="text-[8px] text-slate-400 uppercase">Principal</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}

                    ${isFullYear && html`
                        <div class="report-page-break student-report-page2 mt-6 pt-4 border-t-2 border-slate-200 print:border-black">
                            <h3 class="text-lg font-black uppercase text-slate-800 mb-3">Annual Summary</h3>
                            
                            <!-- Term Summary Table -->
                            <div class="mb-4">
                                <h4 class="text-sm font-bold text-slate-600 mb-2">Term-by-Term Summary</h4>
                                <table class="w-full text-xs border-collapse student-report-page2-table">
                                    <thead class="bg-slate-100">
                                        <tr>
                                            <th class="border p-2 text-left">Term</th>
                                            <th class="border p-2 text-center">Avg %</th>
                                            <th class="border p-2 text-center">AL</th>
                                            <th class="border p-2 text-center">Grade</th>
                                            <th class="border p-2 text-center">Attendance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${yearSummary.map(ys => html`
                                            <tr>
                                                <td class="border p-2 font-bold">${ys.term.replace('T', 'Term ')}</td>
                                                <td class="border p-2 text-center">${ys.termPercentage || 0}%</td>
                                                <td class="border p-2 text-center font-bold">${ys.termAL || '-'}</td>
                                                <td class="border p-2 text-center">
                                                    <span class=${`px-2 py-0.5 rounded-full text-[10px] font-bold ${ys.termLevel.startsWith('EE') ? 'bg-green-100 text-green-700' :
                            ys.termLevel.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                                ys.termLevel.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                                    ys.termLevel.startsWith('BE') ? 'bg-red-100 text-red-700' :
                                        'bg-slate-100 text-slate-500'
                }`}>
                                                        ${ys.termLevel}
                                                    </span>
                                                </td>
                                                <td class="border p-2 text-center">${ys.termAttendance !== null ? ys.termAttendance + '%' : '-'}</td>
                                            </tr>
                                        `)}
                                        <tr class="bg-blue-50 font-bold">
                                            <td class="border p-2">YEAR AVERAGE</td>
                                            <td class="border p-2 text-center">${overallPercentage}%</td>
                                            <td class="border p-2 text-center">${overallAL}</td>
                                            <td class="border p-2 text-center">
                                                <span class=${`px-2 py-0.5 rounded-full text-[10px] font-bold ${overallLevel.startsWith('EE') ? 'bg-green-100 text-green-700' :
                            overallLevel.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                                overallLevel.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                                    overallLevel.startsWith('BE') ? 'bg-red-100 text-red-700' :
                                        'bg-slate-100 text-slate-500'
                }`}>
                                                    ${overallLevel}
                                                </span>
                                            </td>
                                            <td class="border p-2 text-center">-</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="mt-4 pt-2 print:mt-2 print:pt-1">
                            <div class="mb-4">
                                <h4 class="text-sm font-bold text-slate-600 mb-2">Subject Performance Across Terms</h4>
                                <table class="w-full text-xs border-collapse student-report-page2-table">
                                    <thead class="bg-slate-100">
                                        <tr>
                                            <th class="border p-2 text-left">Subject</th>
                                            <th class="border p-2 text-center">T1</th>
                                            <th class="border p-2 text-center">T2</th>
                                            <th class="border p-2 text-center">T3</th>
                                            <th class="border p-2 text-center bg-blue-50">Year Avg</th>
                                            <th class="border p-2 text-center">Trend</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(() => {
                const academicYear = data.settings.academicYear || settings.academicYear;
                const studentIdStr = String(student.id);
                return subjects.map(subject => {
                    const termScores = ['T1', 'T2', 'T3'].map(term => {
                        const termAssessments = data.assessments.filter(a =>
                            String(a.studentId) === studentIdStr && a.term === term && a.subject === subject && a.academicYear === academicYear
                        );
                        const scores = examTypes.map(type => {
                            const match = termAssessments.find(a => a.examType === type);
                            return match ? Number(match.score) : null;
                        }).filter(s => s !== null);
                        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                    });
                    const yearAvg = termScores.filter(s => s !== null).length > 0
                        ? Math.round(termScores.reduce((a, b) => a + (b || 0), 0) / termScores.filter(s => s !== null).length)
                        : 0;
                    const trend = termScores[2] !== null && termScores[0] !== null
                        ? (termScores[2] - termScores[0])
                        : null;
                    return html`
                                                <tr>
                                                    <td class="border p-2 font-medium">${subject}</td>
                                                    <td class="border p-2 text-center">${termScores[0] !== null ? termScores[0] + '%' : '-'}</td>
                                                    <td class="border p-2 text-center">${termScores[1] !== null ? termScores[1] + '%' : '-'}</td>
                                                    <td class="border p-2 text-center">${termScores[2] !== null ? termScores[2] + '%' : '-'}</td>
                                                    <td class="border p-2 text-center bg-blue-50 font-bold">${yearAvg > 0 ? yearAvg + '%' : '-'}</td>
                                                    <td class="border p-2 text-center">
                                                        ${trend !== null ? html`
                                                            <span class=${`text-xs font-bold ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                                                ${trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} ${Math.abs(trend)}%
                                                            </span>
                                                        ` : '-'}
                                                    </td>
                                            </tr>
                                        `;
                });
            })()}
                                </tbody>
                                </table>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 student-report-insights">
                                <div class="p-4 bg-green-50 rounded-xl border border-green-200">
                                    <h4 class="text-xs font-bold text-green-700 mb-2">Best Performing Term</h4>
                                    <p class="text-lg font-black text-green-800">
                                        ${(() => {
                const best = yearSummary.reduce((a, b) => a.termPoints > b.termPoints ? a : b);
                return best.termPoints > 0 ? best.term.replace('T', 'Term ') : 'N/A';
            })()}
                                    </p>
                                    <p class="text-xs text-green-600">
                                        ${(() => {
                const best = yearSummary.reduce((a, b) => a.termPoints > b.termPoints ? a : b);
                if (best.termPoints === 0) return '';
                const avgPts = best.termPoints / subjects.length;
                return Math.round(avgPts * 12.5) + '%';
            })()}
                                    </p>
                                </div>
                                <div class="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                    <h4 class="text-xs font-bold text-blue-700 mb-2">Year Average</h4>
                                    <p class="text-lg font-black text-blue-800">
                                        ${(() => {
                const allScores = [];
                yearSummary.forEach(ys => {
                    subjects.forEach(subject => {
                        const pts = ys.subjectPoints?.[subject] || 0;
                        if (pts > 0) allScores.push(pts);
                    });
                });
                if (allScores.length === 0) return '-%';
                const avgPts = allScores.reduce((a, b) => a + b, 0) / allScores.length;
                return Math.round(avgPts * 12.5) + '%';
            })()}
                                    </p>
                                    <p class="text-xs text-blue-600">
                                        ${(() => {
                const allScores = [];
                yearSummary.forEach(ys => {
                    subjects.forEach(subject => {
                        const pts = ys.subjectPoints?.[subject] || 0;
                        if (pts > 0) allScores.push(pts);
                    });
                });
                if (allScores.length === 0) return '';
                const avgPts = allScores.reduce((a, b) => a + b, 0) / allScores.length;
                const avgScore = Math.round(avgPts * 12.5);
                return Storage.getGradeInfo(avgScore)?.label || '';
            })()}
                                    </p>
                                </div>
                                <div class="p-4 bg-purple-50 rounded-xl border border-purple-200">
                                    <h4 class="text-xs font-bold text-purple-700 mb-2">Attendance Rate</h4>
                                    <p class="text-lg font-black text-purple-800">
                                        ${yearSummary.filter(y => y.termAttendance !== null).length > 0
                ? Math.round(yearSummary.reduce((a, b) => a + (b.termAttendance || 0), 0) / yearSummary.filter(y => y.termAttendance !== null).length)
                : 0}%
                                    </p>
                                    <p class="text-xs text-purple-600">Overall Year</p>
                                </div>
                            </div>
                        </div>

                        <!-- Teacher/Principal Comments for Full Year -->
                        <div class="mt-4 pt-3 border-t-2 border-slate-200 print:border-black student-report-comments">
                            <div class="flex flex-col md:flex-row gap-4 print:flex-col print:gap-3">
                                <div class="w-full md:w-[48%] break-inside-avoid print:w-full print:mb-2">
                                    <div class="p-3 bg-slate-50 rounded-lg border border-slate-100 print:border-black print:bg-white print:w-full">
                                        <p class="text-[9px] font-bold text-slate-500 uppercase mb-1">Class Teacher's Annual Remarks</p>
                                        <textarea 
                                            class="w-full h-24 bg-transparent border-0 focus:ring-0 text-xs italic outline-none no-print resize-none" 
                                            placeholder="Enter teacher comments..."
                                            value=${remark.teacher}
                                            onInput=${(e) => handleRemarkChange('teacher', e.target.value)}
                                        ></textarea>
                                        <div class="hidden print:block">
                                            <p class="text-xs italic border-b border-dotted border-black pb-2 mb-2 student-report-comment-text" style="min-height: 60px; max-height: 60px; overflow: hidden;">
                                                ${remark.teacher || '____________________________________________'}
                                            </p>
                                        </div>
                                        <div class="flex items-center justify-between border-t border-dotted border-slate-300 print:border-black pt-1 mt-2">
                                            <div class="h-10 w-24 flex items-center justify-center border-b border-slate-300 print:border-black">
                                                <img src="${settings.clerkSignature || settings.schoolLogo}" class="h-full object-contain ${settings.clerkSignature ? '' : 'opacity-20'}" alt="Signature" />
                                            </div>
                                            <span class="text-[8px] text-slate-400 uppercase">Class Teacher</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="w-full md:w-[48%] break-inside-avoid print:w-full print:mb-2">
                                    <div class="p-3 bg-slate-50 rounded-lg border border-slate-100 print:border-black print:bg-white print:w-full">
                                        <p class="text-[9px] font-bold text-slate-500 uppercase mb-1">Principal's Annual Remarks</p>
                                        <textarea 
                                            class="w-full h-24 bg-transparent border-0 focus:ring-0 text-xs italic outline-none no-print resize-none" 
                                            placeholder="Enter principal comments..."
                                            value=${remark.principal}
                                            onInput=${(e) => handleRemarkChange('principal', e.target.value)}
                                        ></textarea>
                                        <div class="hidden print:block">
                                            <p class="text-xs italic border-b border-dotted border-black pb-2 mb-2 student-report-comment-text" style="min-height: 60px; max-height: 60px; overflow: hidden;">
                                                ${remark.principal || '____________________________________________'}
                                            </p>
                                        </div>
                                        <div class="flex items-center justify-between border-t border-dotted border-slate-300 print:border-black pt-1 mt-2">
                                            <div class="h-10 w-24 flex items-center justify-center border-b border-slate-300 print:border-black">
                                                <img src="${settings.principalSignature || settings.schoolLogo}" class="h-full object-contain ${settings.principalSignature ? '' : 'opacity-20'}" alt="Signature" />
                                            </div>
                                            <span class="text-[8px] text-slate-400 uppercase">Principal</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}

                    <!-- Report Footer -->
                    <div class="mt-6 pt-3 border-t border-slate-200 print:border-black student-report-footer">
                        <div class="flex justify-between items-center text-[8px] text-slate-400">
                            <span>${settings.schoolName} - ${settings.schoolAddress}</span>
                            <span>Academic Year: ${settings.academicYear}</span>
                            <span>${isFullYear ? 'Annual Report' : selectedTerm.replace('T', 'Term ')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

try {
    render(html`<${App} />`, document.getElementById('app'));
} catch (error) {
    console.error('App render failed:', error);
    const root = document.getElementById('app');
    if (root) {
        root.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:Inter,sans-serif;">
                <div style="max-width:760px;width:100%;background:#fff;border:1px solid #fecaca;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
                    <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#991b1b;">Application Failed To Render</h1>
                    <pre style="margin:0;white-space:pre-wrap;word-break:break-word;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;color:#9a3412;font-size:12px;overflow:auto;">${error?.stack || error?.message || String(error)}</pre>
                </div>
            </div>
        `;
    }
}
