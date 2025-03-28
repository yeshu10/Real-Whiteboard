// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const { Server } = require('socket.io');
// const http = require('http');
// const dotenv = require('dotenv');
// const drawingRoutes = require('./routes/drawingRoutes');

// dotenv.config();

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: '*' } });

// // Middleware
// app.use(cors());
// app.use(express.json());

// // MongoDB Connection
// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('MongoDB Connected'))
//   .catch((err) => console.error('MongoDB Connection Failed:', err));

// // API Routes
// app.use('/api/drawings', drawingRoutes);

// // Socket.IO Logic
// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);

//   socket.on('draw', (data) => {
//     socket.broadcast.emit('draw', data); // Broadcast to all except sender
//   });

//   socket.on('clear', () => {
//     socket.broadcast.emit('clear'); // Broadcast to clear the canvas for everyone
//   });

//   socket.on('disconnect', () => {
//     console.log('A user disconnected:', socket.id);
//   });
// });

// // Start Server
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const dotenv = require('dotenv');
const drawingRoutes = require('./routes/drawingRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*' 
  } 
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error('MongoDB Connection Failed:', err));

// API Routes
app.use('/api/drawings', drawingRoutes);

// Store active rooms and their users (optional, for tracking)
const activeRooms = new Map();

// Socket.IO Logic with Room Support
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a room
  socket.on('joinRoom', (roomId, username) => {
    socket.join(roomId);
    
    // Track room users (optional)
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Set());
    }
    activeRooms.get(roomId).add(socket.id);
    
    console.log(`${username || 'Anonymous'} joined room: ${roomId}`);
    
    // Notify others in the room about new user
    socket.to(roomId).emit('userJoined', { 
      userId: socket.id, 
      username: username || 'Anonymous' 
    });
    
    // Send current room users to the new user (optional)
    const usersInRoom = Array.from(activeRooms.get(roomId))
      .filter(id => id !== socket.id);
    socket.emit('roomUsers', usersInRoom);
  });

  // Drawing events - only broadcast to same room
  socket.on('draw', (data) => {
    if (data.roomId) {
      socket.to(data.roomId).emit('draw', data); // Broadcast to room except sender
    }
  });

  socket.on('clear', (roomId) => {
    if (roomId) {
      socket.to(roomId).emit('clear'); // Broadcast clear to room
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    
    // Remove user from room tracking (optional)
    for (const [roomId, users] of activeRooms.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        socket.to(roomId).emit('userLeft', socket.id);
        
        // Clean up empty rooms
        if (users.size === 0) {
          activeRooms.delete(roomId);
        }
        break;
      }
    }
  });

  // Optional: Room management events
  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    if (activeRooms.has(roomId)) {
      activeRooms.get(roomId).delete(socket.id);
      socket.to(roomId).emit('userLeft', socket.id);
    }
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
