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
        maxRounds: 3, // Default value
        currentDrawerIndex: 0,
        playerOrder: [], // Track turn order
        timer: null,
        timerInterval: null,
        currentWord: null,
        timeLeft: 0,
        startTime: null,
        guessedUsers: []
      });
    }
    
    const room = gameRooms.get(roomId);
    room.users.set(socket.id, {
      id: socket.id,
      username,
      score: 0,
      hasGuessed: false
    });

    // Update player order (first come first serve)
    if (!room.playerOrder.includes(socket.id)) {
      room.playerOrder.push(socket.id);
    }
    
    console.log(`${username} joined room: ${roomId}`);
    
    // Notify room about new user
    socket.to(roomId).emit('userJoined', { 
      users: getUsersArray(room),
      newUser: { id: socket.id, username }
    });
    
    // Send current room state to all users
    updateRoomState(roomId);
  });

  // Drawing events
  socket.on('draw', (data) => {
    const room = gameRooms.get(data.roomId);
    if (room && socket.id === room.currentDrawer?.id) {
      socket.to(data.roomId).emit('draw', data);
    }
  });

  socket.on('clear', (roomId) => {
    const room = gameRooms.get(roomId);
    if (room && socket.id === room.currentDrawer?.id) {
      socket.to(roomId).emit('clear');
    }
  });

  // Game control events
  socket.on('startGame', (roomId, maxRounds) => {
    const room = gameRooms.get(roomId);
    if (room && socket.id === room.creator && room.gameState === 'waiting') {
      room.gameState = 'wordSelection';
      room.currentRound = 1;
      room.currentDrawerIndex = 0;
      room.maxRounds = maxRounds;
      resetUserStates(room);
      
      // Set first drawer (creator)
      room.currentDrawer = room.users.get(room.creator);
      
      io.to(roomId).emit('gameStarted', { 
        currentRound: room.currentRound,
        maxRounds: room.maxRounds
      });
      
      // Notify first drawer
      io.to(room.creator).emit('yourTurn');
      io.to(roomId).emit('turnStarted', {
        drawerId: room.creator,
        drawerName: room.currentDrawer.username
      });
      
      updateRoomState(roomId);
    }
  });

  socket.on('selectWord', ({ roomId, difficulty }) => {
    const room = gameRooms.get(roomId);
    const currentDrawer = getCurrentDrawer(room);
    
    if (room && room.gameState === 'wordSelection' && socket.id === currentDrawer.id) {
      const words = wordLists[difficulty] || wordLists.easy;
      const randomWord = words[Math.floor(Math.random() * words.length)];
      
      room.currentWord = randomWord;
      room.gameState = 'drawing';
      room.guessedUsers = [];
      room.startTime = Date.now();
      
      // Set timer for 60 seconds
      clearTimers(room);
      
      room.timeLeft = 60;
      room.timer = setTimeout(() => endTurn(roomId), 60000);
      
      // Send timer updates every second
      room.timerInterval = setInterval(() => {
        room.timeLeft--;
        io.to(roomId).emit('timerUpdate', room.timeLeft);
        
        if (room.timeLeft <= 0) {
          clearInterval(room.timerInterval);
        }
      }, 1000);
      
      io.to(roomId).emit('wordSelected', {
        word: randomWord,
        drawerId: currentDrawer.id,
        timeLeft: 60
      });
      
      updateRoomState(roomId);
    }
  });

  socket.on('sendMessage', ({ roomId, message, username }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.currentWord) return;
    
    const user = room.users.get(socket.id);
    if (!user || user.hasGuessed || socket.id === room.currentDrawer?.id) return;
    
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
        users: getUsersArray(room),
        isRoundOver: room.guessedUsers.length === room.users.size - 1
      });
      
      // If all users guessed, end turn early
      if (room.guessedUsers.length === room.users.size - 1) {
        endTurn(roomId);
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
        
        // Remove from player order
        room.playerOrder = room.playerOrder.filter(id => id !== socket.id);
        
        io.to(roomId).emit('userLeft', {
          userId: socket.id,
          username,
          users: getUsersArray(room)
        });
        
        // If creator leaves or room is empty, clean up
        if (room.creator === socket.id || room.users.size === 0) {
          clearTimers(room);
          io.to(roomId).emit('gameEnded', getUsersArray(room));
          gameRooms.delete(roomId);
        }
        // If drawer disconnects, end turn early
        else if (socket.id === room.currentDrawer?.id) {
          endTurn(roomId);
        } else {
          updateRoomState(roomId);
        }
      }
    }
  });

  // Helper functions
  function getUsersArray(room) {
    return Array.from(room.users.values());
  }

  function getCurrentDrawer(room) {
    if (!room.playerOrder.length) return null;
    const drawerId = room.playerOrder[room.currentDrawerIndex];
    return room.users.get(drawerId);
  }

  function startTurn(roomId) {
    const room = gameRooms.get(roomId);
    if (!room || room.users.size === 0) return;
    
    const drawer = getCurrentDrawer(room);
    if (!drawer) return;
    
    room.currentDrawer = drawer;
    room.guessedUsers = [];
    room.currentWord = null;
    room.gameState = 'wordSelection';
    
    // Notify only the current drawer to select word
    io.to(drawer.id).emit('yourTurn');
    io.to(roomId).emit('turnStarted', {
      drawerId: drawer.id,
      drawerName: drawer.username
    });
    
    updateRoomState(roomId);
  }

  function endTurn(roomId) {
    const room = gameRooms.get(roomId);
    if (!room) return;
    
    clearTimers(room);
    
    // Award drawer points
    if (room.currentDrawer) {
      const drawer = room.users.get(room.currentDrawer.id);
      if (drawer) {
        const correctGuesses = room.guessedUsers ? room.guessedUsers.length : 0;
        drawer.score += correctGuesses * 20;
      }
    }
    
    // Move to next player in order
    room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.playerOrder.length;
    
    // Check if round is complete (all players have drawn)
    if (room.currentDrawerIndex === 0) {
      // Round completed
      if (room.currentRound >= room.maxRounds) {
        io.to(roomId).emit('gameEnded', getUsersArray(room));
        gameRooms.delete(roomId);
      } else {
        room.currentRound++;
        room.gameState = 'waiting';
        io.to(roomId).emit('roundEnded', {
          users: getUsersArray(room),
          currentRound: room.currentRound
        });
      }
    } else {
      // Start next turn
      startTurn(roomId);
    }
    socket.on('roundEnded', ({ users, currentRound }) => {
      const room = gameRooms.get(roomId);
    
      // Reset game state for UI
      setGameState('waiting');
      setCurrentWord('');
      setIsDrawingTurn(false);
      setUsers(users);
      setScore(users[socket.id]?.score || 0);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `Round ${currentRound - 1} ended!`
      }]);
    
      // Check if there are more rounds to play
      if (currentRound < room.maxRounds) {
        // Move to next round
        room.currentRound = currentRound + 1;
        room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.users.size;
        room.currentDrawer = room.users[room.currentDrawerIndex];
        
        // Emit event to notify everyone of the new round
        io.to(roomId).emit('roundStarted', {
          currentRound: room.currentRound,
          drawerId: room.currentDrawer.id
        });
    
        // Notify the next drawer it's their turn
        io.to(room.creator).emit('yourTurn');
        io.to(roomId).emit('turnStarted', {
          drawerId: room.currentDrawer.id,
          drawerName: room.currentDrawer.username
        });
    
        // Update the room state
        updateRoomState(roomId);
    
      } else {
        // Game over: Emit final score and end the game
        io.to(roomId).emit('gameOver', { 
          finalScores: users,
          message: "The game has ended! Final scores are calculated."
        });
      }
    });
    
    updateRoomState(roomId);
  }

  function resetUserStates(room) {
    for (const user of room.users.values()) {
      user.hasGuessed = false;
    }
    room.guessedUsers = [];
  }

  function clearTimers(room) {
    if (room.timer) clearTimeout(room.timer);
    if (room.timerInterval) clearInterval(room.timerInterval);
    room.timer = null;
    room.timerInterval = null;
  }

  function calculatePoints(startTime) {
    const timeElapsed = (Date.now() - startTime) / 1000;
    const maxPoints = 100;
    const minPoints = 50;
    return Math.max(minPoints, maxPoints - Math.floor(timeElapsed / 2));
  }

  function updateRoomState(roomId) {
    const room = gameRooms.get(roomId);
    if (!room) return;
    
    io.to(roomId).emit('roomState', {
      users: getUsersArray(room),
      gameState: room.gameState,
      currentRound: room.currentRound,
      maxRounds: room.maxRounds,
      currentWord: room.currentWord,
      currentDrawer: getCurrentDrawer(room),
      timeLeft: room.timeLeft
    });
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

// // Game state management
// const gameRooms = new Map();
// const wordLists = {
//   easy: ['Apple', 'House', 'Dog', 'Car', 'Tree'],
//   medium: ['Airplane', 'Elephant', 'Mountain', 'Restaurant', 'Football'],
//   hard: ['Quantum Physics', 'Photosynthesis', 'Globalization', 'Cryptocurrency', 'Artificial Intelligence']
// };

// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);

//   // Join a room with username
//   socket.on('joinRoom', (roomId, username) => {
//     socket.join(roomId);
    
//     // Initialize room if it doesn't exist
//     if (!gameRooms.has(roomId)) {
//       gameRooms.set(roomId, {
//         users: new Map(),
//         creator: socket.id,
//         gameState: 'waiting',
//         currentRound: 0,
//         maxRounds: 3,
//         currentDrawerIndex: 0,
//         playerOrder: [], // Track turn order
//         timer: null,
//         timerInterval: null,
//         currentWord: null,
//         timeLeft: 0
//       });
//     }
    
//     const room = gameRooms.get(roomId);
//     room.users.set(socket.id, {
//       id: socket.id,
//       username,
//       score: 0,
//       hasGuessed: false
//     });

//     // Update player order (first come first serve)
//     if (!room.playerOrder.includes(socket.id)) {
//       room.playerOrder.push(socket.id);
//     }
    
//     console.log(`${username} joined room: ${roomId}`);
    
//     // Notify room about new user
//     socket.to(roomId).emit('userJoined', { 
//       users: getUsersArray(room),
//       newUser: { id: socket.id, username }
//     });
    
//     // Send current room state to all users
//     io.to(roomId).emit('roomState', {
//       users: getUsersArray(room),
//       gameState: room.gameState,
//       currentRound: room.currentRound,
//       currentWord: room.currentWord,
//       currentDrawer: getCurrentDrawer(room),
//       timeLeft: room.timeLeft
//     });
//   });

//   // Drawing events
//   socket.on('draw', (data) => {
//     const room = gameRooms.get(data.roomId);
//     if (room && socket.id === room.currentDrawer?.id) {
//       socket.to(data.roomId).emit('draw', data);
//     }
//   });

//   socket.on('clear', (roomId) => {
//     const room = gameRooms.get(roomId);
//     if (room && socket.id === room.currentDrawer?.id) {
//       socket.to(roomId).emit('clear');
//     }
//   });

//   // Game control events
//   socket.on('startGame', (roomId) => {
//     const room = gameRooms.get(roomId);
//     if (room && socket.id === room.creator && room.gameState === 'waiting') {
//       room.gameState = 'wordSelection';
//       room.currentRound = 1;
//       room.currentDrawerIndex = 0;
//       resetUserStates(room);
      
//       // Set first drawer (creator)
//       room.currentDrawer = room.users.get(room.creator);
      
//       io.to(roomId).emit('gameStarted', { 
//         currentRound: room.currentRound
//       });
      
//       // Notify first drawer
//       io.to(room.creator).emit('yourTurn');
//       io.to(roomId).emit('turnStarted', {
//         drawerId: room.creator,
//         drawerName: room.currentDrawer.username
//       });
//     }
//   });

//   socket.on('selectWord', ({ roomId, difficulty }) => {
//     const room = gameRooms.get(roomId);
//     const currentDrawer = getCurrentDrawer(room);
    
//     if (room && room.gameState === 'wordSelection' && socket.id === currentDrawer.id) {
//       const words = wordLists[difficulty] || wordLists.easy;
//       const randomWord = words[Math.floor(Math.random() * words.length)];
      
//       room.currentWord = randomWord;
//       room.gameState = 'drawing';
//       room.guessedUsers = [];
//       room.startTime = Date.now();
      
//       // Set timer for 60 seconds
//       clearTimers(room);
      
//       room.timeLeft = 60;
//       room.timer = setTimeout(() => endTurn(roomId), 60000);
      
//       // Send timer updates every second
//       room.timerInterval = setInterval(() => {
//         room.timeLeft--;
//         io.to(roomId).emit('timerUpdate', room.timeLeft);
        
//         if (room.timeLeft <= 0) {
//           clearInterval(room.timerInterval);
//         }
//       }, 1000);
      
//       io.to(roomId).emit('wordSelected', {
//         word: randomWord,
//         drawerId: currentDrawer.id,
//         timeLeft: 60
//       });
//     }
//   });

//   socket.on('sendMessage', ({ roomId, message, username }) => {
//     const room = gameRooms.get(roomId);
//     if (!room || !room.currentWord) return;
    
//     const user = room.users.get(socket.id);
//     if (!user || user.hasGuessed || socket.id === room.currentDrawer?.id) return;
    
//     const isCorrect = message.toLowerCase() === room.currentWord.toLowerCase();
    
//     io.to(roomId).emit('newMessage', { 
//       username, 
//       message, 
//       isCorrect,
//       isSystem: false
//     });
    
//     if (isCorrect) {
//       const points = calculatePoints(room.startTime);
//       user.score += points;
//       user.hasGuessed = true;
      
//       if (!room.guessedUsers) room.guessedUsers = [];
//       room.guessedUsers.push(socket.id);
      
//       io.to(roomId).emit('correctGuess', { 
//         username, 
//         points,
//         users: getUsersArray(room)
//       });
      
//       // If all users guessed, end turn early
//       if (room.guessedUsers.length === room.users.size - 1) {
//         endTurn(roomId);
//       }
//     }
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     console.log('A user disconnected:', socket.id);
    
//     for (const [roomId, room] of gameRooms.entries()) {
//       if (room.users.has(socket.id)) {
//         const username = room.users.get(socket.id).username;
//         room.users.delete(socket.id);
        
//         // Remove from player order
//         room.playerOrder = room.playerOrder.filter(id => id !== socket.id);
        
//         io.to(roomId).emit('userLeft', {
//           userId: socket.id,
//           username,
//           users: getUsersArray(room)
//         });
        
//         // If creator leaves or room is empty, clean up
//         if (room.creator === socket.id || room.users.size === 0) {
//           clearTimers(room);
//           io.to(roomId).emit('gameEnded', getUsersArray(room));
//           gameRooms.delete(roomId);
//         }
//         // If drawer disconnects, end turn early
//         else if (socket.id === room.currentDrawer?.id) {
//           endTurn(roomId);
//         }
//       }
//     }
//   });

//   // Helper functions
//   function getUsersArray(room) {
//     return Array.from(room.users.values());
//   }

//   function getCurrentDrawer(room) {
//     if (!room.playerOrder.length) return null;
//     const drawerId = room.playerOrder[room.currentDrawerIndex];
//     return room.users.get(drawerId);
//   }

//   function startTurn(roomId) {
//     const room = gameRooms.get(roomId);
//     if (!room || room.users.size === 0) return;
    
//     const drawer = getCurrentDrawer(room);
//     if (!drawer) return;
    
//     room.currentDrawer = drawer;
//     room.guessedUsers = [];
//     room.currentWord = null;
//     room.gameState = 'wordSelection';
    
//     // Notify only the current drawer to select word
//     io.to(drawer.id).emit('yourTurn');
//     io.to(roomId).emit('turnStarted', {
//       drawerId: drawer.id,
//       drawerName: drawer.username
//     });
//   }

//   function endTurn(roomId) {
//     const room = gameRooms.get(roomId);
//     if (!room) return;
    
//     clearTimers(room);
    
//     // Award drawer points
//     if (room.currentDrawer) {
//       const drawer = room.users.get(room.currentDrawer.id);
//       if (drawer) {
//         const correctGuesses = room.guessedUsers ? room.guessedUsers.length : 0;
//         drawer.score += correctGuesses * 20;
//       }
//     }
    
//     // Move to next player in order
//     room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.playerOrder.length;
    
//     // Check if round is complete (all players have drawn)
//     if (room.currentDrawerIndex === 0) {
//       // Round completed
//       if (room.currentRound >= room.maxRounds) {
//         io.to(roomId).emit('gameEnded', getUsersArray(room));
//         gameRooms.delete(roomId);
//       } else {
//         room.currentRound++;
//         room.gameState = 'waiting';
//         io.to(roomId).emit('roundEnded', {
//           users: getUsersArray(room),
//           currentRound: room.currentRound
//         });
//       }
//     } else {
//       // Start next turn
//       startTurn(roomId);
//     }
//   }

//   function resetUserStates(room) {
//     for (const user of room.users.values()) {
//       user.hasGuessed = false;
//     }
//   }

//   function clearTimers(room) {
//     if (room.timer) clearTimeout(room.timer);
//     if (room.timerInterval) clearInterval(room.timerInterval);
//     room.timer = null;
//     room.timerInterval = null;
//   }

//   function calculatePoints(startTime) {
//     const timeElapsed = (Date.now() - startTime) / 1000;
//     const maxPoints = 100;
//     const minPoints = 50;
//     return Math.max(minPoints, maxPoints - Math.floor(timeElapsed / 2));
//   }
// });

// // Start Server
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
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

// // Game state management
// const gameRooms = new Map();
// const wordLists = {
//   easy: ['Apple', 'House', 'Dog', 'Car', 'Tree'],
//   medium: ['Airplane', 'Elephant', 'Mountain', 'Restaurant', 'Football'],
//   hard: ['Quantum Physics', 'Photosynthesis', 'Globalization', 'Cryptocurrency', 'Artificial Intelligence']
// };

// io.on('connection', (socket) => {
//   console.log('A user connected:', socket.id);

//   // Join a room with username
//   socket.on('joinRoom', (roomId, username) => {
//     socket.join(roomId);
    
//     // Initialize room if it doesn't exist
//     if (!gameRooms.has(roomId)) {
//       gameRooms.set(roomId, {
//         users: new Map(),
//         creator: socket.id,
//         gameState: 'waiting',
//         currentRound: 0,
//         maxRounds: 3,
//         timer: null
//       });
//     }
    
//     const room = gameRooms.get(roomId);
//     room.users.set(socket.id, {
//       username,
//       score: 0,
//       hasGuessed: false
//     });
    
//     console.log(`${username} joined room: ${roomId}`);
    
//     // Notify room about new user
//     socket.to(roomId).emit('userJoined', { 
//       userId: socket.id, 
//       username,
//       users: Array.from(room.users.values())
//     });
    
//     // Send current room state to the new user
//     socket.emit('roomState', {
//       users: Array.from(room.users.values()),
//       gameState: room.gameState,
//       currentRound: room.currentRound,
//       currentWord: room.currentWord,
//       currentDrawer: room.currentDrawer,
//       timeLeft: room.timeLeft
//     });
//   });

//   // Drawing events - only broadcast to same room
//   socket.on('draw', (data) => {
//     if (data.roomId) {
//       socket.to(data.roomId).emit('draw', data);
//     }
//   });

//   socket.on('clear', (roomId) => {
//     if (roomId) {
//       socket.to(roomId).emit('clear');
//     }
//   });

//   // Game control events
//   socket.on('startGame', (roomId) => {
//     const room = gameRooms.get(roomId);
//     if (room && socket.id === room.creator && room.gameState === 'waiting') {
//       room.gameState = 'wordSelection';
//       room.currentRound++;
//       io.to(roomId).emit('gameStarted', room.currentRound);
//     }
//   });

//   socket.on('selectWord', ({ roomId, difficulty }) => {
//     const room = gameRooms.get(roomId);
//     if (room && room.gameState === 'wordSelection') {
//       const words = wordLists[difficulty] || wordLists.easy;
//       const randomWord = words[Math.floor(Math.random() * words.length)];
      
//       room.currentWord = randomWord;
//       room.gameState = 'drawing';
//       room.currentDrawer = socket.id;
//       room.guessedUsers = [];
//       room.startTime = Date.now();
      
//       // Set timer for 60 seconds
//       room.timer = setTimeout(() => {
//         endRound(roomId);
//       }, 60000);
      
//       io.to(roomId).emit('wordSelected', {
//         word: randomWord,
//         drawerId: socket.id,
//         timeLeft: 60
//       });
      
//       // Send timer updates every second
//       let secondsLeft = 60;
//       const timerInterval = setInterval(() => {
//         secondsLeft--;
//         room.timeLeft = secondsLeft;
//         io.to(roomId).emit('timerUpdate', secondsLeft);
        
//         if (secondsLeft <= 0) {
//           clearInterval(timerInterval);
//         }
//       }, 1000);
//     }
//   });

//   socket.on('sendMessage', ({ roomId, message, username }) => {
//     const room = gameRooms.get(roomId);
//     if (!room || !room.currentWord) return;
    
//     const user = room.users.get(socket.id);
//     if (!user || user.hasGuessed) return;
    
//     const isCorrect = message.toLowerCase() === room.currentWord.toLowerCase();
    
//     io.to(roomId).emit('newMessage', { 
//       username, 
//       message, 
//       isCorrect,
//       isSystem: false
//     });
    
//     if (isCorrect) {
//       const points = calculatePoints(room.startTime);
//       user.score += points;
//       user.hasGuessed = true;
//       room.guessedUsers.push(socket.id);
      
//       io.to(roomId).emit('correctGuess', { 
//         username, 
//         points,
//         users: Array.from(room.users.values())
//       });
      
//       // If all users guessed, end round early
//       if (room.guessedUsers.length === room.users.size - 1) {
//         endRound(roomId);
//       }
//     }
//   });

//   // Handle disconnection
//   socket.on('disconnect', () => {
//     console.log('A user disconnected:', socket.id);
    
//     for (const [roomId, room] of gameRooms.entries()) {
//       if (room.users.has(socket.id)) {
//         const username = room.users.get(socket.id).username;
//         room.users.delete(socket.id);
        
//         io.to(roomId).emit('userLeft', {
//           userId: socket.id,
//           username,
//           users: Array.from(room.users.values())
//         });
        
//         // If creator leaves, end game
//         if (room.creator === socket.id) {
//           clearTimeout(room.timer);
//           io.to(roomId).emit('gameEnded');
//           gameRooms.delete(roomId);
//         }
//       }
//     }
//   });

//   // Helper functions
//   function endRound(roomId) {
//     const room = gameRooms.get(roomId);
//     if (!room) return;
    
//     clearTimeout(room.timer);
    
//     // Award drawer points
//     if (room.currentDrawer && room.users.has(room.currentDrawer)) {
//       const drawer = room.users.get(room.currentDrawer);
//       drawer.score += room.guessedUsers.length * 20;
//     }
    
//     io.to(roomId).emit('roundEnded', {
//       word: room.currentWord,
//       users: Array.from(room.users.values())
//     });
    
//     // Prepare next round or end game
//     if (room.currentRound >= room.maxRounds) {
//       io.to(roomId).emit('gameEnded', Array.from(room.users.values()));
//       gameRooms.delete(roomId);
//     } else {
//       room.gameState = 'waiting';
//       room.currentWord = null;
//       room.currentDrawer = null;
//       room.guessedUsers = [];
      
//       // Reset guess status for next round
//       for (const user of room.users.values()) {
//         user.hasGuessed = false;
//       }
//     }
//   }

//   function calculatePoints(startTime) {
//     const timeElapsed = (Date.now() - startTime) / 1000;
//     const maxPoints = 100;
//     const minPoints = 50;
//     return Math.max(minPoints, maxPoints - Math.floor(timeElapsed / 2));
//   }
// });

// // Start Server
// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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
