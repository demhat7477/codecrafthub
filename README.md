# CodeCraftHub

A simple personalized learning platform where developers track the courses they want to learn.
CodeCraftHub is a beginner-friendly REST API built with **Node.js** and **Express**. It stores all data in a plain JSON text file (`courses.json`), so you need no database.

## Features

- Full CRUD for courses (create, read, update, delete)
- Data stored in `courses.json`; the file is created automatically on first start
- Each course has: `id` (auto), `name`, `description`, `target_date` (YYYY-MM-DD), `status`, `created_at` (auto)
- Status validation: `Not Started`, `In Progress`, `Completed`
  (the German values `Nicht begonnen`, `In Bearbeitung`, `Abgeschlossen` are accepted too and saved as the English value)
- Date validation (format and real calendar date, e.g. `2025-02-30` is rejected)
- Error handling for missing fields, unknown courses, invalid status/date, invalid JSON and file read/write errors
- **Bonus:** statistics endpoint (`GET /api/courses/stats`) and search (`GET /api/courses/search?q=term`)
- Automated tests with Node's built-in test runner (no extra packages)

## Project structure

```
codecrafthub/
├── app.js          # Express application (all routes and helpers)
├── test.js         # Automated API tests (npm test)
├── courses.json    # Data file (auto-created, ignored by git)
├── package.json    # Project info and dependencies
└── README.md       # This file
```

## Installation

Requirements: [Node.js](https://nodejs.org/) 18 or newer (includes npm).

```bash
git clone https://github.com/<your-user>/codecrafthub.git
cd codecrafthub
npm install
```

## Running the application

```bash
npm start
```

You should see:

```
============================================================
CodeCraftHub API is starting...
============================================================
Data will be stored in: /path/to/codecrafthub/courses.json
API is available at: http://localhost:5000
============================================================
```

To use another port: `PORT=3000 npm start`

Run the automated tests:

```bash
npm test
```

## API endpoints

| Method | Endpoint                       | Description                |
|--------|--------------------------------|----------------------------|
| POST   | `/api/courses`                 | Add a new course           |
| GET    | `/api/courses`                 | Get all courses            |
| GET    | `/api/courses/:id`             | Get one course             |
| PUT    | `/api/courses/:id`             | Update a course            |
| DELETE | `/api/courses/:id`             | Delete a course            |
| GET    | `/api/courses/stats`           | Statistics (bonus)         |
| GET    | `/api/courses/search?q=term`   | Search name/description (bonus) |

All responses are JSON with a `success` field. Errors look like:

```json
{ "success": false, "error": "Course with ID 99 not found" }
```

### Add a course (POST)

```bash
curl -X POST http://localhost:5000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Python Basics",
    "description": "Learn Python fundamentals",
    "target_date": "2025-12-31",
    "status": "Not Started"
  }'
```

Response `201 Created`:

```json
{
  "success": true,
  "message": "Course added successfully",
  "course": {
    "id": 1,
    "name": "Python Basics",
    "description": "Learn Python fundamentals",
    "target_date": "2025-12-31",
    "status": "Not Started",
    "created_at": "2025-11-04 10:30:00"
  }
}
```

### Get all courses (GET)

```bash
curl http://localhost:5000/api/courses
```

```json
{ "success": true, "count": 1, "courses": [ { "id": 1, "name": "Python Basics", "...": "..." } ] }
```

### Get one course (GET)

```bash
curl http://localhost:5000/api/courses/1
```

### Update a course (PUT)

Only the fields you send are changed. `id` and `created_at` never change.

```bash
curl -X PUT http://localhost:5000/api/courses/1 \
  -H "Content-Type: application/json" \
  -d '{ "status": "In Progress" }'
```

### Delete a course (DELETE)

```bash
curl -X DELETE http://localhost:5000/api/courses/1
```

```json
{ "success": true, "message": "Course deleted successfully", "deleted_course": { "id": 1, "...": "..." } }
```

### Statistics (GET, bonus)

```bash
curl http://localhost:5000/api/courses/stats
```

```json
{
  "success": true,
  "stats": {
    "total_courses": 3,
    "by_status": { "Not Started": 1, "In Progress": 1, "Completed": 1 }
  }
}
```

### Search (GET, bonus)

```bash
curl "http://localhost:5000/api/courses/search?q=python"
```

## Status codes

| Code | Meaning                                             |
|------|-----------------------------------------------------|
| 200  | OK                                                  |
| 201  | Course created                                      |
| 400  | Bad request (missing fields, invalid status/date/ID, invalid JSON) |
| 404  | Course or route not found                           |
| 500  | Server error (e.g. `courses.json` cannot be read or written) |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Error: Cannot find module 'express'` | Run `npm install` in the project folder. |
| `EADDRINUSE: address already in use :::5000` | Another program uses port 5000. Stop it or start with `PORT=3000 npm start`. On macOS, AirPlay Receiver often uses port 5000. |
| `curl: (7) Failed to connect` | The server is not running. Start it with `npm start` in a separate terminal. |
| `Invalid JSON in request body` | Check your JSON (double quotes, no trailing commas) and send the header `Content-Type: application/json`. |
| `Missing required fields` | POST needs `name`, `description`, `target_date` and `status`. |
| `Status must be one of ...` | Use exactly `Not Started`, `In Progress` or `Completed` (case-sensitive). |
| `500 Failed to read courses` | `courses.json` contains invalid JSON. Fix it, or delete it (it will be recreated empty). |
| curl on Windows PowerShell | Use `curl.exe` and escape the quotes, or use a tool like Postman / Thunder Client. |

## License

Apache 2.0 (based on the IBM Skills Network lab "CodeCraftHub").
