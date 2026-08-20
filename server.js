const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
try { require("dotenv").config(); } catch { /* dotenv is optional for local fallback */ }

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
const PORT = process.env.PORT || 9001;
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "CODEPATH";

app.use(express.static(path.join(__dirname, "public")));
app.get("/teacher", (_, res) => res.sendFile(path.join(__dirname, "public", "teacher.html")));
app.get("/student", (_, res) => res.sendFile(path.join(__dirname, "public", "student.html")));
app.get("/health", (_, res) => res.json({ ok: true, rooms: rooms.size }));

const rooms = new Map();
let activeRoomId = "";

const starterCode = () => ({
  html: `<div class="container">
  <h1>Hello Web Developers 👋</h1>
  <p>Start editing your HTML, CSS and JavaScript.</p>
  <button id="btn">Click Me</button>
</div>`,
  css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: Arial, sans-serif;
  background: #f4f7fb;
}
.container {
  width: min(500px, 85%);
  padding: 30px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,.1);
}
button {
  padding: 10px 18px;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}`,
  js: `document.getElementById("btn")?.addEventListener("click", () => {
  alert("JavaScript is working!");
});`
});

function cleanCode(code = {}) {
  return {
    html: String(code.html ?? "").slice(0, 250000),
    css: String(code.css ?? "").slice(0, 250000),
    js: String(code.js ?? "").slice(0, 250000)
  };
}

function newRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id;
  do {
    id = Array.from({length: 6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  } while (rooms.has(id));
  return id;
}

function connectedTeacher(room) {
  return room?.teacher?.socketId ? io.sockets.sockets.get(room.teacher.socketId) : null;
}

function studentsFor(room) {
  return [...room.students.entries()].map(([socketId, s]) => ({
    socketId,
    name: s.name,
    joinedAt: s.joinedAt,
    lastActivity: s.lastActivity,
    language: s.language,
    locked: room.locked
  }));
}

io.on("connection", socket => {
  socket.on("create-room", ({teacherName, classTitle, password} = {}, ack = () => {}) => {
    if (String(password || "").trim().toUpperCase() !== TEACHER_PASSWORD.toUpperCase()) {
      return ack({ok:false, message:"Incorrect teacher password."});
    }
    const name = String(teacherName || "Teacher").trim().slice(0, 40) || "Teacher";
    const roomId = newRoomId();

    rooms.set(roomId, {
      teacher: { socketId: socket.id, name, code: starterCode(), lastRun: null },
      students: new Map(),
      title: String(classTitle || "Web Development Live Class").trim().slice(0, 80) || "Web Development Live Class",
      locked: false,
      createdAt: Date.now()
    });
    activeRoomId = roomId;

    socket.join(roomId);
    socket.data.role = "teacher";
    socket.data.roomId = roomId;

    ack({
      ok: true,
      roomId,
      teacherName: name,
      classTitle: rooms.get(roomId).title,
      teacherCode: rooms.get(roomId).teacher.code,
      students: []
    });
  });

  socket.on("join-student", ({roomId, studentName} = {}, ack = () => {}) => {
    let id = String(roomId || "").trim().toUpperCase();
    const name = String(studentName || "").trim().slice(0, 40);
    let room = rooms.get(id);

    if (!id) {
      const activeRoom = rooms.get(activeRoomId);
      room = activeRoom && connectedTeacher(activeRoom) ? activeRoom : null;
      id = room ? activeRoomId : "";
      for (const [candidateId, candidateRoom] of [...rooms.entries()].reverse()) {
        if (room) break;
        if (connectedTeacher(candidateRoom)) {
          id = candidateId;
          room = candidateRoom;
          break;
        }
      }
    }

    if (!name) return ack({ok:false, message:"Please enter your name."});
    if (!room) {
      socket.data.role = "practice-student";
      return ack({
        ok:true,
        roomId:"PRACTICE",
        teacherName:"Practice mode",
        classTitle:"Personal Practice",
        practiceOnly:true,
        locked:false,
        teacherCode:starterCode(),
        teacherLastRun:null,
        myCode:starterCode()
      });
    }
    if (!connectedTeacher(room)) {
      rooms.delete(id);
      return ack({ok:false, message:"Teacher is not connected."});
    }

    room.students.set(socket.id, { name, code: starterCode(), lastRun: null, joinedAt: Date.now(), lastActivity: Date.now(), language: "html" });
    socket.join(id);
    socket.data.role = "student";
    socket.data.roomId = id;

    connectedTeacher(room)?.emit("student-list", studentsFor(room));
    connectedTeacher(room)?.emit("student-code-update", {
      socketId: socket.id,
      name,
      code: room.students.get(socket.id).code,
      lastRun: room.students.get(socket.id).lastRun
    });

    ack({
      ok:true,
      roomId:id,
      teacherName:room.teacher.name,
      classTitle: room.title,
      locked: room.locked,
      teacherCode:room.teacher.code,
      teacherLastRun: room.teacher.lastRun,
      myCode:room.students.get(socket.id).code
    });
  });

  socket.on("teacher-code-update", ({code} = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "teacher" || room.teacher.socketId !== socket.id) return;
    room.teacher.code = cleanCode(code);
    socket.to(socket.data.roomId).emit("teacher-code-update", {
      teacherName: room.teacher.name,
      code: room.teacher.code,
      lastRun: room.teacher.lastRun
    });
  });

  socket.on("teacher-run", ({html, css, js, mode = "html", output = [], runVersion} = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "teacher" || room.teacher.socketId !== socket.id) return;
    room.teacher.lastRun = { html: String(html ?? "").slice(0, 250000), css: String(css ?? "").slice(0, 250000), js: String(js ?? "").slice(0, 250000), mode: ["html", "css", "js"].includes(mode) ? mode : "html", output: Array.isArray(output) ? output.slice(0, 200) : [], runVersion: Number(runVersion) || Date.now() };
    socket.to(socket.data.roomId).emit("teacher-run", { teacherName: room.teacher.name, ...room.teacher.lastRun });
  });

  socket.on("student-code-update", ({code} = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "student") return;
    const student = room.students.get(socket.id);
    if (!student) return;

    student.code = cleanCode(code);
    student.lastActivity = Date.now();
    connectedTeacher(room)?.emit("student-code-update", {
      socketId: socket.id,
      name: student.name,
      code: student.code
    });
  });

  socket.on("student-code-change", ({language, code} = {}) => {
    const room = rooms.get(socket.data.roomId);
    const student = room?.students.get(socket.id);
    if (!room || !student || socket.data.role !== "student") return;
    const key = ["html", "css", "js"].includes(language) ? language : null;
    if (!key) return;
    student.code[key] = String(code ?? "").slice(0, 250000);
    student.lastActivity = Date.now();
    connectedTeacher(room)?.emit("student-code-change", { socketId: socket.id, name: student.name, language: key, code: student.code[key], lastActivity: student.lastActivity });
  });

  socket.on("student-run", ({html, css, js, mode = "html", output = [], runVersion} = {}) => {
    const room = rooms.get(socket.data.roomId);
    const student = room?.students.get(socket.id);
    if (!room || !student || socket.data.role !== "student") return;
    student.lastRun = { html: String(html ?? "").slice(0, 250000), css: String(css ?? "").slice(0, 250000), js: String(js ?? "").slice(0, 250000), mode: ["html", "css", "js"].includes(mode) ? mode : "html", output: Array.isArray(output) ? output.slice(0, 200) : [], runVersion: Number(runVersion) || Date.now() };
    connectedTeacher(room)?.emit("student-run", { socketId: socket.id, name: student.name, ...student.lastRun });
  });

  socket.on("student-activity", ({language} = {}) => {
    const room = rooms.get(socket.data.roomId);
    const student = room?.students.get(socket.id);
    if (!room || !student || socket.data.role !== "student") return;
    student.language = ["html", "css", "js"].includes(language) ? language : student.language;
    student.lastActivity = Date.now();
    connectedTeacher(room)?.emit("student-activity", { socketId: socket.id, language: student.language, lastActivity: student.lastActivity });
  });

  socket.on("teacher-announcement", ({message} = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "teacher" || room.teacher.socketId !== socket.id) return;
    const text = String(message || "").trim().slice(0, 240);
    if (text) socket.to(socket.data.roomId).emit("announcement", { message: text, sentAt: Date.now() });
  });

  socket.on("set-lock", ({locked} = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "teacher" || room.teacher.socketId !== socket.id) return;
    room.locked = Boolean(locked);
    io.to(socket.data.roomId).emit("practice-lock", { locked: room.locked });
    connectedTeacher(room)?.emit("student-list", studentsFor(room));
  });

  socket.on("teacher-focus", ({focused} = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "teacher" || room.teacher.socketId !== socket.id) return;
    socket.to(socket.data.roomId).emit("teacher-focus", { focused: Boolean(focused) });
  });

  socket.on("end-room", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "teacher" || room.teacher.socketId !== socket.id) return;
    io.to(socket.data.roomId).emit("room-closed", {message: "This live class has ended."});
    rooms.delete(socket.data.roomId);
    if (activeRoomId === socket.data.roomId) activeRoomId = "";
  });

  socket.on("request-student-code", ({socketId} = {}, ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || socket.data.role !== "teacher") return ack({ok:false});
    const student = room.students.get(socketId);
    if (!student) return ack({ok:false, message:"Student disconnected."});
    ack({ok:true, socketId, name:student.name, code:student.code, lastRun:student.lastRun});
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;

    if (socket.data.role === "teacher" && room.teacher.socketId === socket.id) {
      io.to(socket.data.roomId).emit("room-closed", {message:"Teacher left the live room."});
      rooms.delete(socket.data.roomId);
      if (activeRoomId === socket.data.roomId) activeRoomId = "";
      return;
    }

    if (socket.data.role === "student") {
      room.students.delete(socket.id);
      connectedTeacher(room)?.emit("student-list", studentsFor(room));
      connectedTeacher(room)?.emit("student-left", {socketId: socket.id});
    }
  });
});

server.listen(PORT, () => {
  console.log(`LiveCode Classroom: http://localhost:${PORT}`);
});
