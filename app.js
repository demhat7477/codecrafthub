// =============================================================
// CodeCraftHub - Simple personal learning platform (REST API)
// Tech: Node.js + Express, data stored in a JSON text file.
// =============================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// ---------------- Configuration ----------------
// The JSON file that holds all courses (created automatically).
// DATA_FILE can be overridden with an environment variable (used by the tests).
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'courses.json');
const PORT = process.env.PORT || 5000;

// The only allowed status values.
const VALID_STATUSES = ['Not Started', 'In Progress', 'Completed'];

// German spellings are accepted too and converted to the English value.
const STATUS_ALIASES = {
    'Nicht begonnen': 'Not Started',
    'In Bearbeitung': 'In Progress',
    'Abgeschlossen': 'Completed'
};

// Fields every course must have when it is created.
const REQUIRED_FIELDS = ['name', 'description', 'target_date', 'status'];

// ---------------- Middleware ----------------
// CORS (Cross-Origin Resource Sharing): allows a browser page that runs
// somewhere else (e.g. dashboard.html opened as a file, or a Bolt preview)
// to call this API. Without it the browser blocks the requests.
app.use(cors());

// Turns the JSON body of a request into a JavaScript object (req.body).
app.use(express.json());

// Serve the dashboard: http://localhost:5000/dashboard.html
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ---------------- Helper functions ----------------

// Make sure the data file exists. If not, create it with an empty list.
function ensureDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    }
}

// Read all courses from the JSON file.
// Throws an error if the file cannot be read or contains invalid JSON,
// so the route can answer with a 500 error instead of losing data.
function loadCourses() {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (raw.trim() === '') return [];      // empty file = no courses yet
    const courses = JSON.parse(raw);
    if (!Array.isArray(courses)) {
        throw new Error('courses.json must contain a JSON array');
    }
    return courses;
}

// Write all courses back to the JSON file (pretty-printed).
function saveCourses(courses) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(courses, null, 2));
}

// Next free ID: highest existing ID + 1 (starts at 1).
function getNextId(courses) {
    if (courses.length === 0) return 1;
    return Math.max(...courses.map(c => c.id)) + 1;
}

// Current time as "YYYY-MM-DD HH:MM:SS".
function timestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// Returns the English status, or null if the value is not allowed.
function normalizeStatus(status) {
    if (VALID_STATUSES.includes(status)) return status;
    if (STATUS_ALIASES[status]) return STATUS_ALIASES[status];
    return null;
}

// Checks the format YYYY-MM-DD and that the date really exists
// (e.g. 2025-02-30 is rejected).
function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !isNaN(date) && date.toISOString().startsWith(value);
}

// Checks that a value is a non-empty string.
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

// Validates the fields that were sent. Returns an error message or null.
// "partial" = true is used for updates, where not every field is required.
function validateCourse(data, partial = false) {
    if (!partial) {
        const missing = REQUIRED_FIELDS.filter(f => data[f] === undefined || data[f] === null || data[f] === '');
        if (missing.length > 0) {
            return `Missing required fields: ${missing.join(', ')}`;
        }
    }
    for (const field of ['name', 'description']) {
        if (data[field] !== undefined && !isNonEmptyString(data[field])) {
            return `Field '${field}' must be a non-empty text`;
        }
    }
    if (data.target_date !== undefined && !isValidDate(data.target_date)) {
        return "Field 'target_date' must be a valid date in the format YYYY-MM-DD";
    }
    if (data.status !== undefined && normalizeStatus(data.status) === null) {
        return `Status must be one of: ${VALID_STATUSES.join(', ')}`;
    }
    return null;
}

// Reads the :id from the URL. Returns a number or null if it is not a valid ID.
function parseId(req) {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Sends a uniform error response.
function sendError(res, status, message) {
    return res.status(status).json({ success: false, error: message });
}

// ---------------- Routes ----------------

// Small welcome page so "http://localhost:5000/" shows something useful.
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the CodeCraftHub API',
        dashboard: '/dashboard.html',
        endpoints: [
            'GET    /api/courses',
            'GET    /api/courses/stats',
            'GET    /api/courses/search?q=term',
            'GET    /api/courses/:id',
            'POST   /api/courses',
            'PUT    /api/courses/:id',
            'DELETE /api/courses/:id'
        ]
    });
});

// GET all courses
app.get('/api/courses', (req, res) => {
    try {
        const courses = loadCourses();
        res.status(200).json({ success: true, count: courses.length, courses });
    } catch (error) {
        sendError(res, 500, `Failed to read courses: ${error.message}`);
    }
});

// GET statistics (BONUS)
// IMPORTANT: this route must be defined BEFORE "/api/courses/:id",
// otherwise Express would treat "stats" as an ID.
app.get('/api/courses/stats', (req, res) => {
    try {
        const courses = loadCourses();
        const by_status = {};
        VALID_STATUSES.forEach(s => { by_status[s] = 0; });
        courses.forEach(c => {
            if (by_status[c.status] !== undefined) by_status[c.status]++;
        });
        res.status(200).json({
            success: true,
            stats: { total_courses: courses.length, by_status }
        });
    } catch (error) {
        sendError(res, 500, `Failed to read courses: ${error.message}`);
    }
});

// GET search courses by name or description (BONUS)
// Example: /api/courses/search?q=python
app.get('/api/courses/search', (req, res) => {
    const term = (req.query.q || '').toString().trim().toLowerCase();
    if (term === '') {
        return sendError(res, 400, "Query parameter 'q' is required, e.g. /api/courses/search?q=python");
    }
    try {
        const results = loadCourses().filter(c =>
            String(c.name).toLowerCase().includes(term) ||
            String(c.description).toLowerCase().includes(term)
        );
        res.status(200).json({ success: true, query: term, count: results.length, courses: results });
    } catch (error) {
        sendError(res, 500, `Failed to read courses: ${error.message}`);
    }
});

// GET one course by ID
app.get('/api/courses/:id', (req, res) => {
    const id = parseId(req);
    if (id === null) return sendError(res, 400, 'Course ID must be a positive whole number');
    try {
        const course = loadCourses().find(c => c.id === id);
        if (!course) return sendError(res, 404, `Course with ID ${id} not found`);
        res.status(200).json({ success: true, course });
    } catch (error) {
        sendError(res, 500, `Failed to read courses: ${error.message}`);
    }
});

// POST create a new course
app.post('/api/courses', (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        return sendError(res, 400, 'No data provided. Send a JSON object in the request body.');
    }

    const validationError = validateCourse(data);
    if (validationError) return sendError(res, 400, validationError);

    try {
        const courses = loadCourses();
        const newCourse = {
            id: getNextId(courses),
            name: data.name.trim(),
            description: data.description.trim(),
            target_date: data.target_date,
            status: normalizeStatus(data.status),
            created_at: timestamp()
        };
        courses.push(newCourse);
        saveCourses(courses);
        res.status(201).json({ success: true, message: 'Course added successfully', course: newCourse });
    } catch (error) {
        sendError(res, 500, `Failed to save course: ${error.message}`);
    }
});

// PUT update an existing course (only the fields that are sent are changed)
app.put('/api/courses/:id', (req, res) => {
    const id = parseId(req);
    if (id === null) return sendError(res, 400, 'Course ID must be a positive whole number');

    const data = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        return sendError(res, 400, 'No data provided. Send a JSON object in the request body.');
    }

    const validationError = validateCourse(data, true);
    if (validationError) return sendError(res, 400, validationError);

    try {
        const courses = loadCourses();
        const course = courses.find(c => c.id === id);
        if (!course) return sendError(res, 404, `Course with ID ${id} not found`);

        // id and created_at are never changed by an update.
        if (data.name !== undefined) course.name = data.name.trim();
        if (data.description !== undefined) course.description = data.description.trim();
        if (data.target_date !== undefined) course.target_date = data.target_date;
        if (data.status !== undefined) course.status = normalizeStatus(data.status);

        saveCourses(courses);
        res.status(200).json({ success: true, message: 'Course updated successfully', course });
    } catch (error) {
        sendError(res, 500, `Failed to update course: ${error.message}`);
    }
});

// DELETE a course
app.delete('/api/courses/:id', (req, res) => {
    const id = parseId(req);
    if (id === null) return sendError(res, 400, 'Course ID must be a positive whole number');
    try {
        const courses = loadCourses();
        const index = courses.findIndex(c => c.id === id);
        if (index === -1) return sendError(res, 404, `Course with ID ${id} not found`);

        const [deleted_course] = courses.splice(index, 1);
        saveCourses(courses);
        res.status(200).json({ success: true, message: 'Course deleted successfully', deleted_course });
    } catch (error) {
        sendError(res, 500, `Failed to delete course: ${error.message}`);
    }
});

// ---------------- Error handling ----------------

// Unknown routes -> 404
app.use((req, res) => {
    sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`);
});

// Invalid JSON in the request body (and any other unexpected error)
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return sendError(res, 400, 'Invalid JSON in request body');
    }
    console.error(err);
    sendError(res, 500, 'Internal server error');
});

// ---------------- Start the server ----------------
// Only start listening when this file is run directly (npm start),
// not when it is imported by the tests.
if (require.main === module) {
    ensureDataFile();
    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('CodeCraftHub API is starting...');
        console.log('='.repeat(60));
        console.log(`Data will be stored in: ${path.resolve(DATA_FILE)}`);
        console.log(`API is available at: http://localhost:${PORT}`);
        console.log('='.repeat(60));
        console.log('\nPress CTRL+C to stop the server\n');
    });
}

module.exports = app;
