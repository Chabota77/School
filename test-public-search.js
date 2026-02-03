// Mock browser environment
const localStorageMock = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = value.toString(); },
    clear() { this.store = {}; }
};

global.window = {};
global.localStorage = localStorageMock;

const SchoolData = require('./js/data.js');
// data.js assigns to window.SchoolData, but since we require it, it executes.
// Verify if it exports anything. It doesn't use module.exports.
// But since we set window.SchoolData, we can access it from there.

const db = window.SchoolData.getDB();

console.log('--- PUBLIC SEARCH TEST ---');

// Test 1: Search by Name
// Test 1: Search by Name
const testName = 'John Doe'; // Matches S001 in data.js
const studentByName = db.students.find(s => s.name.toLowerCase().includes(testName.toLowerCase()));
console.log(`Search by Name '${testName}':`, studentByName ? 'FOUND' : 'NOT FOUND');
if (studentByName) console.log(studentByName);

// Test 2: Search by ID
const testId = studentByName ? studentByName.id : 'S001';
const studentById = db.students.find(s => s.id == testId);
console.log(`Search by ID '${testId}':`, studentById ? 'FOUND' : 'NOT FOUND');
if (studentById) console.log(studentById);

// Test 3: Search logic as implemented in app.js
function testAppLogic(nameInput, idInput) {
    let student = null;
    if (idInput) {
        student = db.students.find(s => s.id == idInput);
    } else if (nameInput) {
        student = db.students.find(s => s.name.toLowerCase().includes(nameInput.toLowerCase()));
    }
    return student;
}

console.log('--- APP LOGIC SIMULATION ---');
console.log('Only Name:', testAppLogic('John', '') ? 'PASS' : 'FAIL');
console.log('Only ID:', testAppLogic('', testId) ? 'PASS' : 'FAIL');
console.log('Both (ID priority):', testAppLogic('NonExistent', testId) ? 'PASS' : 'FAIL'); // Should find by ID even if name is weird, though in UI user probably enters one.
