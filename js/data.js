/**
 * Data Initialization and Storage (NORMALIZED SCHEMA)
 * Relational Data Model for School Management System
 */

const DEFAULT_DATA = {
    // metadata
    academicYears: [
        { id: '2025', name: '2025', current: false },
        { id: '2026', name: '2026', current: true },
        { id: '2027', name: '2027', current: false }
    ],
    terms: [
        { id: 'T1', name: 'Term 1', yearId: '2026', current: true },
        { id: 'T2', name: 'Term 2', yearId: '2026', current: false },
        { id: 'T3', name: 'Term 3', yearId: '2026', current: false }
    ],
    classes: [
        { id: 'C7A', name: 'Grade 7A', level: 7 },
        { id: 'C8A', name: 'Grade 8A', level: 8 },
        { id: 'C9B', name: 'Grade 9B', level: 9 }
    ],
    subjects: [
        { id: 'MATH', name: 'Mathematics' },
        { id: 'ENG', name: 'English' },
        { id: 'SCI', name: 'Science' },
        { id: 'SOC', name: 'Social Studies' }
    ],

    // entities
    users: [
        { id: 'U1', username: 'admin', password: 'password', role: 'admin', name: 'Admin User' },
        { id: 'U2', username: 'teacher', password: 'password', role: 'teacher', name: 'Teacher User', relatedId: 'T001' },
        { id: 'U3', username: 'student', password: 'password', role: 'student', name: 'Student User', relatedId: '2600001' },
        { id: 'U4', username: 'accountant', password: 'password', role: 'accountant', name: 'Accountant User' },
        { id: 'U5', username: 'info', password: 'password', role: 'info_officer', name: 'Info Officer' }
    ],

    teachers: [
        { id: 'T001', userId: 'U2', name: 'Mr. John Banda', subjectIds: ['MATH'], classIds: ['C7A'], status: 'Active', email: 'john.banda@school.com', phone: '+260977123456' },
        { id: 'T002', userId: null, name: 'Ms. Ruth Mwila', subjectIds: ['ENG'], classIds: ['C9B'], status: 'On Leave', email: 'ruth.mwila@school.com', phone: '+260966654321' },
        { id: 'T003', userId: null, name: 'Mrs. Grace Phiri', subjectIds: ['SCI'], classIds: ['C8A'], status: 'Active', email: 'grace.phiri@school.com', phone: '+260955987654' }
    ],
    students: [
        { id: '2600001', userId: 'U3', name: 'John Doe', classId: 'C7A', status: 'Enrolled', guardian: 'Mr. Doe', phone: '0977000000', rollNo: '2600001' },
        { id: '2600002', userId: null, name: 'Jane Smith', classId: 'C7A', status: 'Enrolled', guardian: 'Mrs. Smith', phone: '0977000001', rollNo: '2600002' },
        { id: '2600003', userId: null, name: 'Michael Banda', classId: 'C7A', status: 'Enrolled', guardian: 'Mr. Banda', phone: '0977000002', rollNo: '2600003' }
    ],

    // relationships
    enrollments: [
        // Mapping students to classes/years (Implicit in students.classId for current year, but distinct for history)
        // For now, students.classId is the main source of truth for "Current Enrollment"
    ],
    results: [
        // Normalized Results: Student + Subject + Term = Score
        { id: 'R1', studentId: '2600001', subjectId: 'MATH', termId: 'T1', score: 85, yearId: '2026' },
        { id: 'R2', studentId: '2600001', subjectId: 'ENG', termId: 'T1', score: 78, yearId: '2026' },
        { id: 'R3', studentId: '2600001', subjectId: 'SCI', termId: 'T1', score: 92, yearId: '2026' },
        { id: 'R4', studentId: '2600001', subjectId: 'SOC', termId: 'T1', score: 88, yearId: '2026' },

        { id: 'R5', studentId: '2600002', subjectId: 'MATH', termId: 'T1', score: 90, yearId: '2026' },
        { id: 'R6', studentId: '2600002', subjectId: 'ENG', termId: 'T1', score: 85, yearId: '2026' },
    ],

    announcements: [
        { id: 1, title: 'School Reopens', content: 'School reopens on 10th January for all learners.', date: '2026-01-05', audience: 'Everyone' },
        { id: 2, title: 'Sports Day', content: 'Annual inter-house sports competition coming soon.', date: '2026-02-15', audience: 'Everyone' }
    ],
    admissions: [], // Pending admissions
    publishedResults: [], // Stores strings like "2026-T1"
    galleryImages: [
        { id: 1, url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=500&q=80', caption: 'Graduation Day 2025', category: 'Events' },
        { id: 2, url: 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?w=500&q=80', caption: 'Science Fair', category: 'Academic' }
    ],
    payments: [],
    tuitionPayments: [], // { id, studentId, amount, date, termId, status }
    attendance: [], // { id, studentId, date, status, classId, teacherId, yearId, termId }

};

// --- CORE FUNCTIONS ---

function initData() {
    const stored = localStorage.getItem('bf_school_data');
    if (!stored) {
        localStorage.setItem('bf_school_data', JSON.stringify(DEFAULT_DATA));
        localStorage.setItem('bf_data_version', '1.2'); // Add versioning to force updates
        console.log('Database initialized with normalized data.');
    } else {
        const storedVersion = localStorage.getItem('bf_data_version');
        const CURRENT_VERSION = '1.2';

        // Force update if version mismatch (or missing)
        if (storedVersion !== CURRENT_VERSION) {
            console.log('Data version mismatch. Merging new default users...');
            const db = JSON.parse(stored);

            // Merge Users (Ensure Accountant/Info exist)
            const newUsers = DEFAULT_DATA.users;
            newUsers.forEach(nu => {
                if (!db.users.find(u => u.username === nu.username)) {
                    db.users.push(nu);
                }
            });

            // Update version
            localStorage.setItem('bf_data_version', CURRENT_VERSION);
            localStorage.setItem('bf_school_data', JSON.stringify(db));
            console.log('Data migration complete.');
            window.location.reload();
            return;
        }

        const db = JSON.parse(stored);

        // Strict Schema Check: Ensure critical collections exist AND are populated
        const requiredKeys = ['academicYears', 'terms', 'classes', 'students', 'publishedResults'];
        const isCorrupt = requiredKeys.some(key => !db[key]); // Check existence
        const isEmpty = (db.academicYears && db.academicYears.length === 0) || (db.terms && db.terms.length === 0);

        // MIGRATION: Fix Student IDs (Migration for "2500000" or "S001" to "260000X")
        if (db.students && db.students.some(s => s.id === '2500000' || s.id.startsWith('S'))) {
            console.warn('Old/Bad Student IDs detected. Migrating to YYXXXXX format...');

            // Loop and re-assign IDs
            const year = '26'; // Defaulting migration to 2026
            let counter = 1;

            const idMap = {}; // Map old ID to new ID to fix foreign keys

            db.students.forEach(s => {
                const newId = `${year}${String(counter).padStart(5, '0')}`;
                idMap[s.id] = newId;
                s.id = newId;
                s.rollNo = newId;
                counter++;
            });

            // Update Foreign Keys (Results, Users, Payments)
            if (db.results) db.results.forEach(r => { if (idMap[r.studentId]) r.studentId = idMap[r.studentId]; });
            if (db.users) db.users.forEach(u => { if (idMap[u.relatedId]) u.relatedId = idMap[u.relatedId]; });
            if (db.tuitionPayments) db.tuitionPayments.forEach(p => { if (idMap[p.studentId]) p.studentId = idMap[p.studentId]; });

            // Should save immediately
            localStorage.setItem('bf_school_data', JSON.stringify(db));
            console.log('Migration Complete. IDs fixed.');
            window.location.reload();
            return; // Stop here, reload triggers
        }


        if (isCorrupt || isEmpty) {
            console.warn('Corrupt (missing keys) or Empty data detected. Factory Resetting...');
            localStorage.setItem('bf_school_data', JSON.stringify(DEFAULT_DATA));
            window.location.reload();
        }
    }
}

function getDB() {
    initData();
    return JSON.parse(localStorage.getItem('bf_school_data'));
}

function saveDB(data) {
    localStorage.setItem('bf_school_data', JSON.stringify(data));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- ACCESSORS (The "API") ---

const SchoolData = {
    initData,
    getDB,
    saveDB,

    // Generic
    getCollection: (name) => {
        const db = getDB();
        return db[name] || [];
    },
    addItem: (collection, item) => {
        const db = getDB();
        if (!db[collection]) db[collection] = [];
        item.id = item.id || generateId();
        db[collection].push(item);
        saveDB(db);
        return item;
    },
    deleteItem: (collection, id) => {
        const db = getDB();
        if (!db[collection]) return;
        db[collection] = db[collection].filter(i => i.id != id);
        saveDB(db);
    },
    updateItem: (collection, id, updates) => {
        const db = getDB();
        const index = db[collection].findIndex(i => i.id == id);
        if (index > -1) {
            db[collection][index] = { ...db[collection][index], ...updates };
            saveDB(db);
            return db[collection][index];
        }
        return null;
    },

    // Specific Queries
    getStudentResults: (studentId, termId) => {
        const db = getDB();
        // Join Results with Subjects
        const validResults = db.results.filter(r => r.studentId === studentId && (termId ? r.termId === termId : true));

        // Map to easier format: { SubjectName: Score }
        const mapped = {};
        validResults.forEach(r => {
            const subject = db.subjects.find(s => s.id === r.subjectId);
            if (subject) mapped[subject.name] = r.score;
        });
        return mapped;
    },

    getStudentByClass: (classId) => {
        const db = getDB();
        return db.students.filter(s => s.classId === classId);
    },

    getClasses: () => getDB().classes,
    getSubjects: () => getDB().subjects,
    getTerms: () => getDB().terms,
    getAdmissions: () => getDB().admissions || [],

    // Publish Logic
    publishResults: (year, term) => {
        const db = getDB();
        if (!db.publishedResults) db.publishedResults = [];
        const key = `${year}-${term}`;
        if (!db.publishedResults.includes(key)) {
            db.publishedResults.push(key);
            saveDB(db);
        }
    },
    unpublishResults: (year, term) => {
        const db = getDB();
        if (!db.publishedResults) return;
        const key = `${year}-${term}`;
        db.publishedResults = db.publishedResults.filter(k => k !== key);
        saveDB(db);
    },
    isPublished: (year, term) => {
        const db = getDB();
        return (db.publishedResults || []).includes(`${year}-${term}`);
    },

    // Student ID Logic
    generateStudentId: (yearInput) => {
        const db = getDB();

        // Determine Year (YY)
        let yearFull;
        if (yearInput) {
            yearFull = String(yearInput);
        } else {
            // Default to current academic year or system year
            const currentYearObj = db.academicYears.find(y => y.current);
            yearFull = currentYearObj ? currentYearObj.name : new Date().getFullYear().toString();
        }

        const yy = yearFull.slice(-2); // "26" for 2026

        // Find max sequence for this year
        // We filter students whose ID starts with "S" + "YY" wait...
        // Format requested is YYXXXXX (e.g. 2600001). 
        // Our existing IDs are like "S001".
        // The user wants "student number the student roll number".
        // Let's use the new format as the actual ID if possible, or store it as 'studentNumber' and keep internal ID.
        // But user said "make the student number the student roll number".
        // Existing system uses IDs like "S001" for relationships. Changing strict ID format might break existing relationships if not careful.
        // However, for *new* students, we can just use the new format as the ID string.
        // e.g. ID = "2600001".

        // Let's iterate all students to find matching YY prefix
        const students = db.students || [];

        // Filter those mimicking the pattern ^YY\d{5}$
        const pattern = new RegExp(`^${yy}\\d{5}$`);
        const matchingIds = students
            .filter(s => pattern.test(s.id))
            .map(s => parseInt(s.id.slice(2))); // Get the XXXXX part

        let nextSeq = 1;
        if (matchingIds.length > 0) {
            nextSeq = Math.max(...matchingIds) + 1;
        }

        const nextId = `${yy}${String(nextSeq).padStart(5, '0')}`;
        return nextId;
    },

    addStudent: (studentData) => {
        const db = getDB();

        // Generate Auto ID
        const newId = SchoolData.generateStudentId();

        // Use this as the primary ID
        studentData.id = newId;
        studentData.rollNo = newId; // Redundant but requested "student number is roll number"

        // Add to collection
        if (!db.students) db.students = [];
        db.students.push(studentData);
        saveDB(db);
        return studentData;
    },

    // Gallery
    getGallery: () => getDB().galleryImages || []
};

// Expose globally
window.SchoolData = SchoolData;

// Initialize immediately
initData();
