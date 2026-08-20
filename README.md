# CodePath LiveLab

Real-time HTML, CSS and JavaScript classroom compiler for teachers and students.

## Live App

- **Home:** https://codepath-livelab-production.up.railway.app
- **Teacher:** https://codepath-livelab-production.up.railway.app/teacher
- **Student:** https://codepath-livelab-production.up.railway.app/student
- **Health:** https://codepath-livelab-production.up.railway.app/health
- **GitHub:** https://github.com/khushisoni2004/WEBDEV_EDITOR

## Features

- Teacher-created rooms with shareable codes
- Separate HTML, CSS and JavaScript editors
- Instant sandboxed browser preview and console output
- Live teacher code broadcast to all students
- Live student code and last-run output monitoring
- Responsive mobile-friendly student workspace
- Save, reset, download, announcements, focus mode and practice lock

## Run Locally

Requires Node.js 18+.

```bash
git clone https://github.com/khushisoni2004/WEBDEV_EDITOR.git
cd WEBDEV_EDITOR
npm install
npm start
```

Open `http://localhost:9001`.

- Teacher: `http://localhost:9001/teacher`
- Student: `http://localhost:9001/student`

Set a different port with `.env`:

```env
PORT=9001
```

## Classroom Test

1. Open Teacher and create a room.
2. Copy the six-character room code.
3. Open Student in another browser or phone.
4. Join with the student name and room code.
5. Type code and click **Run** to test live sync and output.

## Deployment

The app requires a long-running Node.js server with WebSocket support. Railway is configured for the live deployment above.

Start command:

```bash
npm start
```

Live classroom state is kept in memory; student drafts are saved locally in the browser.
