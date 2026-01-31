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
        { id: 'U3', username: 'student', password: 'password', role: 'student', name: 'Student User', relatedId: 'S001' }
    ],
    teachers: [
        { id: 'T001', userId: 'U2', name: 'Mr. John Banda', subjectIds: ['MATH'], classIds: ['C7A'], status: 'Active', email: 'john.banda@school.com', phone: '+260977123456' },
        { id: 'T002', userId: null, name: 'Ms. Ruth Mwila', subjectIds: ['ENG'], classIds: ['C9B'], status: 'On Leave', email: 'ruth.mwila@school.com', phone: '+260966654321' },
        { id: 'T003', userId: null, name: 'Mrs. Grace Phiri', subjectIds: ['SCI'], classIds: ['C8A'], status: 'Active', email: 'grace.phiri@school.com', phone: '+260955987654' }
    ],
    students: [
        { id: 'S001', userId: 'U3', name: 'John Doe', classId: 'C7A', status: 'Enrolled', guardian: 'Mr. Doe', phone: '0977000000' },
        { id: 'S002', userId: null, name: 'Jane Smith', classId: 'C7A', status: 'Enrolled', guardian: 'Mrs. Smith', phone: '0977000001' },
        { id: 'S003', userId: null, name: 'Michael Banda', classId: 'C7A', status: 'Enrolled', guardian: 'Mr. Banda', phone: '0977000002' }
    ],

    // relationships
    enrollments: [
        // Mapping students to classes/years (Implicit in students.classId for current year, but distinct for history)
        // For now, students.classId is the main source of truth for "Current Enrollment"
    ],
    results: [
        // Normalized Results: Student + Subject + Term = Score
        { id: 'R1', studentId: 'S001', subjectId: 'MATH', termId: 'T1', score: 85, yearId: '2026' },
        { id: 'R2', studentId: 'S001', subjectId: 'ENG', termId: 'T1', score: 78, yearId: '2026' },
        { id: 'R3', studentId: 'S001', subjectId: 'SCI', termId: 'T1', score: 92, yearId: '2026' },
        { id: 'R4', studentId: 'S001', subjectId: 'SOC', termId: 'T1', score: 88, yearId: '2026' },

        { id: 'R5', studentId: 'S002', subjectId: 'MATH', termId: 'T1', score: 90, yearId: '2026' },
        { id: 'R6', studentId: 'S002', subjectId: 'ENG', termId: 'T1', score: 85, yearId: '2026' },

        { id: 'R7', studentId: 'S003', subjectId: 'MATH', termId: 'T1', score: 75, yearId: '2026' }
    ],

    announcements: [
        { id: 1, title: 'School Reopens', content: 'School reopens on 10th January for all learners.', audience: 'Everyone', date: '2026-01-05' },
        { id: 2, title: 'Sports Day', content: 'Annual inter-house sports competition coming soon.', audience: 'Everyone', date: '2026-02-15' },
        { id: 3, title: 'Parents Meeting', content: 'Parents–Teachers meeting scheduled for next Friday.', audience: 'Parents', date: '2026-03-01' }
    ],
    admissions: [
        { id: 1, student_name: 'David Zulu', class_name: 'Grade 7', date_applied: '2026-01-15', parent_name: 'Mary Zulu', phone: '0977111222', status: 'Pending', email: 'david@zulu.com' },
        { id: 2, student_name: 'Sarah Lungu', class_name: 'Grade 8', date_applied: '2026-01-18', parent_name: 'Peter Lungu', phone: '0966333444', status: 'Pending', email: 'sarah@lungu.com' }
    ],
    publishedResults: [], // Stores strings like "2026-T1"
    galleryImages: [
        { id: 1, url: 'https://images.unsplash.com/photo-1588072432836-e10032774350', caption: 'Learning Through Play', category: 'Classroom' },
        { id: 2, url: 'https://images.unsplash.com/photo-1596495577886-d920f1fb7238', caption: 'Creative Arts & Crafts', category: 'Arts' },
        { id: 3, url: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52', caption: 'Sports & Teamwork', category: 'Sports' },
        { id: 4, url: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e', caption: 'School Assemblies & Events', category: 'Events' }
    ],
    payments: []
};

// --- CORE FUNCTIONS ---

function initData() {
    if (!localStorage.getItem('bf_school_data')) {
        localStorage.setItem('bf_school_data', JSON.stringify(DEFAULT_DATA));
        console.log('Database initialized with normalized data.');
    } else {
        // Optional: Simple migration check could go here
        // For now, we assume if it exists, it's valid, OR the user clears it.
        // To be safe during dev, if we detect old schema (e.g. students have 'grade' string instead of classId), we could wipe it.
        const db = JSON.parse(localStorage.getItem('bf_school_data'));
        if (db.students && db.students.length > 0 && !db.classes) {
            console.warn('Old schema detected. Resetting to new schema...');
            localStorage.setItem('bf_school_data', JSON.stringify(DEFAULT_DATA));
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

    // Gallery
    getGallery: () => getDB().galleryImages || []
};

// Expose globally
window.SchoolData = SchoolData;

// Initialize immediately
initData();
