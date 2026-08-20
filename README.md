# CodePath LiveLab

A real-time HTML/CSS/JavaScript teaching editor for live web-development classes.

## Features
- Teacher creates a 6-character live room
- Students join using room code + name
- Separate HTML, CSS and JavaScript editors
- Live browser preview using iframe `srcdoc`
- Teacher code broadcasts to every student in real time
- Every student's code is sent live to the teacher
- Teacher can click any online student and inspect their code + preview
- Online student list and disconnect handling
- Responsive dark dashboard UI
- Live activity, search, announcements, focus mode, practice lock, console capture, local autosave and project download

## Tech Stack
- HTML
- CSS
- Vanilla JavaScript
- Node.js
- Express
- Socket.IO / WebSockets

## Run locally

Install Node.js 18 or newer.

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Teacher:
```text
http://localhost:3000/teacher
```

Student:
```text
http://localhost:3000/student
```

For testing on one laptop:
1. Open Teacher page and create a room.
2. Copy the room code.
3. Open Student page in another browser/incognito tab.
4. Join with a student name + room code.
5. Type in either editor and watch the live synchronization.

## Use on multiple devices in the same Wi-Fi/LAN
Run the server on the teacher computer and find its local IP address, for example `192.168.1.10`.
Students can open:

```text
http://192.168.1.10:3000/student
```

Your OS firewall must allow incoming traffic on port 3000.

Optional `.env` values:
```text
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/codepath-livelab
```

Classroom state is held in memory for live isolation. Student projects autosave to local storage and download as `index.html`, `style.css`, and `script.js`.

## Deploy online
This is a Node.js app and needs a host that supports long-running Node servers/WebSockets, such as Render, Railway, Fly.io, VPS, etc.

Build command:
```text
npm install
```

Start command:
```text
npm start
```

## Important security note
Student/teacher JavaScript preview is placed in a sandboxed iframe. This demo is appropriate for classroom practice, but a production platform should add authentication, persistent database storage, rate limiting, room passwords, stronger content/security policies, audit logging, and possibly a separate isolated code-execution environment.
