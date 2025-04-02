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

// Game state management
const gameRooms = new Map();
const wordLists = {
  easy: ['Apple', 'House', 'Dog', 'Car', 'Tree'],
  medium: ['Airplane', 'Elephant', 'Mountain', 'Restaurant', 'Football'],
  hard: ['Quantum Physics', 'Photosynthesis', 'Globalization', 'Cryptocurrency', 'Artificial Intelligence']
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a room with username
  socket.on('joinRoom', (roomId, username) => {
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!gameRooms.has(roomId)) {
      gameRooms.set(roomId, {
        users: new Map(),
        creator: socket.id,
        gameState: 'waiting',
        currentRound: 0,
        maxRounds: 3,
        timer: null
      });
    }
    
    const room = gameRooms.get(roomId);
    room.users.set(socket.id, {
      username,
      score: 0,
      hasGuessed: false
    });
    
    console.log(`${username} joined room: ${roomId}`);
    
    // Notify room about new user
    socket.to(roomId).emit('userJoined', { 
      userId: socket.id, 
      username,
      users: Array.from(room.users.values())
    });
    
    // Send current room state to the new user
    socket.emit('roomState', {
      users: Array.from(room.users.values()),
      gameState: room.gameState,
      currentRound: room.currentRound,
      currentWord: room.currentWord,
      currentDrawer: room.currentDrawer,
      timeLeft: room.timeLeft
    });
  });

  // Drawing events - only broadcast to same room
  socket.on('draw', (data) => {
    if (data.roomId) {
      socket.to(data.roomId).emit('draw', data);
    }
  });

  socket.on('clear', (roomId) => {
    if (roomId) {
      socket.to(roomId).emit('clear');
    }
  });

  // Game control events
  socket.on('startGame', (roomId) => {
    const room = gameRooms.get(roomId);
    if (room && socket.id === room.creator && room.gameState === 'waiting') {
      room.gameState = 'wordSelection';
      room.currentRound++;
      io.to(roomId).emit('gameStarted', room.currentRound);
    }
  });

  socket.on('selectWord', ({ roomId, difficulty }) => {
    const room = gameRooms.get(roomId);
    if (room && room.gameState === 'wordSelection') {
      const words = wordLists[difficulty] || wordLists.easy;
      const randomWord = words[Math.floor(Math.random() * words.length)];
      
      room.currentWord = randomWord;
      room.gameState = 'drawing';
      room.currentDrawer = socket.id;
      room.guessedUsers = [];
      room.startTime = Date.now();
      
      // Set timer for 60 seconds
      room.timer = setTimeout(() => {
        endRound(roomId);
      }, 60000);
      
      io.to(roomId).emit('wordSelected', {
        word: randomWord,
        drawerId: socket.id,
        timeLeft: 60
      });
      
      // Send timer updates every second
      let secondsLeft = 60;
      const timerInterval = setInterval(() => {
        secondsLeft--;
        room.timeLeft = secondsLeft;
        io.to(roomId).emit('timerUpdate', secondsLeft);
        
        if (secondsLeft <= 0) {
          clearInterval(timerInterval);
        }
      }, 1000);
    }
  });

  socket.on('sendMessage', ({ roomId, message, username }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.currentWord) return;
    
    const user = room.users.get(socket.id);
    if (!user || user.hasGuessed) return;
    
    const isCorrect = message.toLowerCase() === room.currentWord.toLowerCase();
    
    io.to(roomId).emit('newMessage', { 
      username, 
      message, 
      isCorrect,
      isSystem: false
    });
    
    if (isCorrect) {
      const points = calculatePoints(room.startTime);
      user.score += points;
      user.hasGuessed = true;
      room.guessedUsers.push(socket.id);
      
      io.to(roomId).emit('correctGuess', { 
        username, 
        points,
        users: Array.from(room.users.values())
      });
      
      // If all users guessed, end round early
      if (room.guessedUsers.length === room.users.size - 1) {
        endRound(roomId);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.users.has(socket.id)) {
        const username = room.users.get(socket.id).username;
        room.users.delete(socket.id);
        
        io.to(roomId).emit('userLeft', {
          userId: socket.id,
          username,
          users: Array.from(room.users.values())
        });
        
        // If creator leaves, end game
        if (room.creator === socket.id) {
          clearTimeout(room.timer);
          io.to(roomId).emit('gameEnded');
          gameRooms.delete(roomId);
        }
      }
    }
  });

  // Helper functions
  function endRound(roomId) {
    const room = gameRooms.get(roomId);
    if (!room) return;
    
    clearTimeout(room.timer);
    
    // Award drawer points
    if (room.currentDrawer && room.users.has(room.currentDrawer)) {
      const drawer = room.users.get(room.currentDrawer);
      drawer.score += room.guessedUsers.length * 20;
    }
    
    io.to(roomId).emit('roundEnded', {
      word: room.currentWord,
      users: Array.from(room.users.values())
    });
    
    // Prepare next round or end game
    if (room.currentRound >= room.maxRounds) {
      io.to(roomId).emit('gameEnded', Array.from(room.users.values()));
      gameRooms.delete(roomId);
    } else {
      room.gameState = 'waiting';
      room.currentWord = null;
      room.currentDrawer = null;
      room.guessedUsers = [];
      
      // Reset guess status for next round
      for (const user of room.users.values()) {
        user.hasGuessed = false;
      }
    }
  }

  function calculatePoints(startTime) {
    const timeElapsed = (Date.now() - startTime) / 1000;
    const maxPoints = 100;
    const minPoints = 50;
    return Math.max(minPoints, maxPoints - Math.floor(timeElapsed / 2));
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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
// const io = new Server(server, { 
//   cors: { 
//     origin: '*' 
//   } 
// });

// // Middleware
// app.use(cors());
// app.use(express.json());

// // MongoDB Connection
// mongoose.connect(process.env.MONGO_URI)
//   .then(() => console.log('MongoDB Connected'))
//   .catch((err) => console.error('MongoDB Connection Failed:', err));

// // API Routes
// app.use('/api/drawings', drawingRoutes);

// // Store active rooms and their users (optional, for tracking)
// const activeRooms = new Map();

// // Socket.IO Logic with Room Support
// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);

//   // Join a room
//   socket.on('joinRoom', (roomId, username) => {
//     socket.join(roomId);
    
//     // Track room users (optional)
//     if (!activeRooms.has(roomId)) {
//       activeRooms.set(roomId, new Set());
//     }
//     activeRooms.get(roomId).add(socket.id);
    
//     console.log(`${username || 'Anonymous'} joined room: ${roomId}`);
    
//     // Notify others in the room about new user
//     socket.to(roomId).emit('userJoined', { 
//       userId: socket.id, 
//       username: username || 'Anonymous' 
//     });
    
//     // Send current room users to the new user (optional)
//     const usersInRoom = Array.from(activeRooms.get(roomId))
//       .filter(id => id !== socket.id);
//     socket.emit('roomUsers', usersInRoom);
//   });

//   // Drawing events - only broadcast to same room
//   socket.on('draw', (data) => {
//     if (data.roomId) {
//       socket.to(data.roomId).emit('draw', data); // Broadcast to room except sender
//     }
//   });

//   socket.on('clear', (roomId) => {
//     if (roomId) {
//       socket.to(roomId).emit('clear'); // Broadcast clear to room
//     }
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     console.log('A user disconnected:', socket.id);
    
//     // Remove user from room tracking (optional)
//     for (const [roomId, users] of activeRooms.entries()) {
//       if (users.has(socket.id)) {
//         users.delete(socket.id);
//         socket.to(roomId).emit('userLeft', socket.id);
        
//         // Clean up empty rooms
//         if (users.size === 0) {
//           activeRooms.delete(roomId);
//         }
//         break;
//       }
//     }
//   });

//   // Optional: Room management events
//   socket.on('leaveRoom', (roomId) => {
//     socket.leave(roomId);
//     if (activeRooms.has(roomId)) {
//       activeRooms.get(roomId).delete(socket.id);
//       socket.to(roomId).emit('userLeft', socket.id);
//     }
//   });
// });

// // Start Server
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
