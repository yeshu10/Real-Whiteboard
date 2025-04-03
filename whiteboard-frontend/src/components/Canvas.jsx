import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import GameControls from './GameControls';
import ChatBox from './ChatBox';

const socket = io('http://localhost:5000');

// WordSelection component (add this before Canvas component)
const WordSelection = ({ onWordSelect }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold mb-4 text-center">Select Word Difficulty</h3>
        <div className="flex flex-col space-y-3">
          <button 
            onClick={() => onWordSelect('easy')}
            className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg transition text-lg"
          >
            Easy
          </button>
          <button 
            onClick={() => onWordSelect('medium')}
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-lg transition text-lg"
          >
            Medium
          </button>
          <button 
            onClick={() => onWordSelect('hard')}
            className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg transition text-lg"
          >
            Hard
          </button>
        </div>
      </div>
    </div>
  );
};

const Canvas = () => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [pointerSize, setPointerSize] = useState(5);
  const [selectedColor, setSelectedColor] = useState('black');
  const [lastPos, setLastPos] = useState(null);
  
  // Game state
  const [gameState, setGameState] = useState('waiting');
  const [currentWord, setCurrentWord] = useState('');
  const [isDrawingTurn, setIsDrawingTurn] = useState(false);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState({});
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [score, setScore] = useState(0);
  const [currentDrawer, setCurrentDrawer] = useState(null);

  // Get room info from URL
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const username = queryParams.get('username');
  const roomId = queryParams.get('join') || queryParams.get('roomId'); 
  const isCreator = !location.search.includes('join');

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.7;
    canvas.height = window.innerHeight * 0.7;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.strokeStyle = selectedColor;
    context.lineWidth = pointerSize;
    contextRef.current = context;

    // Join room
    socket.emit('joinRoom', roomId, username);

    // Game event listeners
    socket.on('userJoined', ({ users }) => {
      setUsers(users);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `${users[socket.id]?.username} joined the game`
      }]);
    });

    socket.on('userLeft', ({ users, username }) => {
      setUsers(users);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `${username} left the game`
      }]);
    });

    socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft }) => {
      setUsers(users);
      setGameState(gameState);
      setCurrentRound(currentRound);
      setCurrentWord(currentWord || '');
      setCurrentDrawer(currentDrawer);
      setTimeLeft(timeLeft || 0);
      setIsDrawingTurn(socket.id === currentDrawer?.id);
      setScore(users[socket.id]?.score || 0);
    });

    socket.on('gameStarted', ({ currentRound, currentDrawerIndex }) => {
      setCurrentRound(currentRound);
      setGameState('wordSelection');
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `Round ${currentRound} started!`
      }]);
    });

    socket.on('turnStarted', ({ drawerId, drawerName }) => {
      setCurrentDrawer({ id: drawerId, username: drawerName });
      setGameState('wordSelection');
      setCurrentWord('');
      setIsDrawingTurn(socket.id === drawerId);
      setHasGuessed(false);
      
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `${drawerName}'s turn to draw!`
      }]);
    });

    socket.on('yourTurn', () => {
      setIsDrawingTurn(true);
      setGameState('wordSelection');
      setMessages(prev => [...prev, {
        isSystem: true,
        message: "It's your turn to draw! Select a word difficulty."
      }]);
    });

    socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
      setCurrentWord(word);
      setGameState('drawing');
      setIsDrawingTurn(socket.id === drawerId);
      setTimeLeft(timeLeft);
      setHasGuessed(false);
    });

    socket.on('timerUpdate', (seconds) => {
      setTimeLeft(seconds);
    });

    socket.on('correctGuess', ({ username, points, users }) => {
      setUsers(users);
      setScore(users[socket.id]?.score || 0);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `${username} guessed correctly! +${points} points`
      }]);
    });

    socket.on('newMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('roundEnded', ({ users, currentRound }) => {
      setGameState('waiting');
      setCurrentWord('');
      setIsDrawingTurn(false);
      setUsers(users);
      setScore(users[socket.id]?.score || 0);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `Round ${currentRound} ended!`
      }]);
    });

    socket.on('gameEnded', (users) => {
      setGameState('ended');
      setUsers(users);
      setScore(users[socket.id]?.score || 0);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: 'Game ended! Final scores: ' + 
          Object.values(users).map(u => `${u.username}: ${u.score}`).join(', ')
      }]);
    });

    // Drawing events
    socket.on('draw', (data) => {
      const context = contextRef.current;
      context.lineWidth = data.size;
      context.strokeStyle = data.color;
      context.beginPath();
      context.moveTo(data.prevX, data.prevY);
      context.lineTo(data.x, data.y);
      context.stroke();
    });

    socket.on('clear', () => {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('roomState');
      socket.off('gameStarted');
      socket.off('turnStarted');
      socket.off('wordSelected');
      socket.off('timerUpdate');
      socket.off('correctGuess');
      socket.off('newMessage');
      socket.off('roundEnded');
      socket.off('gameEnded');
      socket.off('draw');
      socket.off('clear');
    };
  }, []);

  const handleStartGame = () => {
    socket.emit('startGame', roomId);
  };

  const handleWordSelect = (difficulty) => {
    socket.emit('selectWord', { roomId, difficulty });
  };

  const handleEndGame = () => {
    socket.emit('endGame', roomId);
  };

  const handleSendMessage = (message) => {
    socket.emit('sendMessage', { roomId, message, username });
    if (message.toLowerCase() === currentWord.toLowerCase()) {
      setHasGuessed(true);
    }
  };

  const startDrawing = (e) => {
    if (!isDrawingTurn) return;
    
    const { offsetX, offsetY } = e.nativeEvent;
    setLastPos({ x: offsetX, y: offsetY });
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    setIsDrawing(false);
    setLastPos(null);
  };

  const draw = (e) => {
    if (!isDrawing || !isDrawingTurn) return;

    const { offsetX, offsetY } = e.nativeEvent;
    const context = contextRef.current;

    if (tool === 'pencil') {
      context.lineWidth = pointerSize;
      context.strokeStyle = selectedColor;
      context.beginPath();
      context.moveTo(lastPos.x, lastPos.y);
      context.lineTo(offsetX, offsetY);
      context.stroke();

      socket.emit('draw', {
        prevX: lastPos.x,
        prevY: lastPos.y,
        x: offsetX,
        y: offsetY,
        size: pointerSize,
        color: selectedColor,
        roomId
      });

      setLastPos({ x: offsetX, y: offsetY });
    } else if (tool === 'erase') {
      context.clearRect(
        offsetX - pointerSize / 2,
        offsetY - pointerSize / 2,
        pointerSize,
        pointerSize
      );
    }
  };

  const clearCanvas = () => {
    if (!isDrawingTurn) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear', roomId);
  };

  return (
    <div className="relative h-screen bg-gray-100 overflow-hidden">
      {/* Word Selection Overlay */}
      {gameState === 'wordSelection' && isDrawingTurn && (
        <WordSelection onWordSelect={handleWordSelect} />
      )}

      {/* Game Controls */}
      <GameControls
        isCreator={isCreator}
        gameState={gameState}
        users={users}
        currentRound={currentRound}
        maxRounds={maxRounds}
        timeLeft={timeLeft}
        currentDrawer={currentDrawer}
        onStartGame={handleStartGame}
        onWordSelect={handleWordSelect}
        onEndGame={handleEndGame}
        isDrawingTurn={isDrawingTurn}
      />

      {/* Main Content Area */}
      <div className="flex h-[calc(100%-60px)] mt-[60px]">
        {/* Drawing Canvas Area (75% width) */}
        <div className="w-3/4 p-4">
          <div className="relative h-full">
            {gameState === 'drawing' && !isDrawingTurn && !hasGuessed && (
              <div className="absolute top-0 left-0 right-0 text-center z-10">
                <div className="inline-block bg-white px-4 py-2 rounded-lg shadow-md">
                  Guess what's being drawn!
                </div>
              </div>
            )}
            
            {isDrawingTurn && currentWord && (
              <div className="absolute top-0 left-0 right-0 text-center z-10">
                <div className="inline-block bg-yellow-100 px-4 py-2 rounded-lg shadow-md">
                  You're drawing: {currentWord}
                </div>
              </div>
            )}
            
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseUp={finishDrawing}
              onMouseMove={draw}
              className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
              style={{ 
                cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
                opacity: isDrawingTurn ? 1 : 0.9
              }}
            />
          </div>
        </div>

        {/* Chat Box Area (25% width) */}
        <div className="w-1/4 p-4 border-l border-gray-200">
          <ChatBox
            onSendMessage={handleSendMessage}
            messages={messages}
            isDrawing={isDrawingTurn}
            currentWord={currentWord}
            hasGuessed={hasGuessed}
          />
        </div>
      </div>

      {/* Toolbar (only for drawer) */}
      {isDrawingTurn && gameState === 'drawing' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
          <button
            className={`px-3 py-1 rounded ${
              tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
            }`}
            onClick={() => setTool('pencil')}
          >
            ✏️ Pencil
          </button>
          <button
            className={`px-3 py-1 rounded ${
              tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}
            onClick={() => setTool('erase')}
          >
            🧹 Eraser
          </button>
          <button 
            className="px-3 py-1 bg-red-500 text-white rounded"
            onClick={clearCanvas}
          >
            🗑️ Clear
          </button>
          <div className="flex items-center space-x-2">
            <span>Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={pointerSize}
              onChange={(e) => setPointerSize(Number(e.target.value))}
              className="w-20"
            />
          </div>
          <div className="flex items-center space-x-1">
            {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Score Display */}
      <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
        <div className="font-bold">{username}</div>
        <div className="text-lg">{score} points</div>
      </div>

      {/* Current Drawer Display */}
      <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
        Current drawer: {currentDrawer?.username || 'None'}
      </div>
    </div>
  );
};

export default Canvas;

// import React, { useRef, useEffect, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import GameControls from './GameControls';
// import ChatBox from './ChatBox';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null);
  
//   // Game state
//   const [gameState, setGameState] = useState('waiting');
//   const [currentWord, setCurrentWord] = useState('');
//   const [isDrawingTurn, setIsDrawingTurn] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [users, setUsers] = useState({});
//   const [currentRound, setCurrentRound] = useState(0);
//   const [maxRounds] = useState(3);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);

//   // Get room info from URL
//   const location = useLocation();
//   const navigate = useNavigate();
//   const queryParams = new URLSearchParams(location.search);
//   const username = queryParams.get('username');
//   const roomId = queryParams.get('join') || queryParams.get('roomId'); 
//   const isCreator = !location.search.includes('join');

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth * 0.7;
//     canvas.height = window.innerHeight * 0.7;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     context.strokeStyle = selectedColor;
//     context.lineWidth = pointerSize;
//     contextRef.current = context;

//     // Join room
//     socket.emit('joinRoom', roomId, username);

//     // Game event listeners
//     socket.on('userJoined', ({ users }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${users[socket.id]?.username} joined the game`
//       }]);
//     });

//     socket.on('userLeft', ({ users, username }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} left the game`
//       }]);
//     });

//     socket.on('gameStarted', (round) => {
//       setCurrentRound(round);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${round} started!`
//       }]);
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
      
//       if (socket.id === drawerId) {
//         setMessages(prev => [...prev, {
//           isSystem: true,
//           message: `You're drawing: ${word}`
//         }]);
//       } else {
//         setMessages(prev => [...prev, {
//           isSystem: true,
//           message: `Someone is drawing a word...`
//         }]);
//       }
//     });

//     socket.on('timerUpdate', (seconds) => {
//       setTimeLeft(seconds);
//     });

//     socket.on('correctGuess', ({ username, points, users }) => {
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//     });

//     socket.on('newMessage', (msg) => {
//       setMessages(prev => [...prev, msg]);
//     });

//     socket.on('roundEnded', ({ word, users }) => {
//       setGameState('waiting');
//       setCurrentWord('');
//       setIsDrawingTurn(false);
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ended! The word was: ${word}`
//       }]);
//     });

//     socket.on('gameEnded', (users) => {
//       setGameState('ended');
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: 'Game ended! Final scores: ' + 
//           Object.values(users).map(u => `${u.username}: ${u.score}`).join(', ')
//       }]);
//     });

//     // Drawing events - REMOVED the isDrawingTurn check so everyone sees drawings
//     socket.on('draw', (data) => {
//       const context = contextRef.current;
//       context.lineWidth = data.size;
//       context.strokeStyle = data.color;
//       context.beginPath();
//       context.moveTo(data.prevX, data.prevY);
//       context.lineTo(data.x, data.y);
//       context.stroke();
//     });

//     socket.on('clear', () => {
//       const canvas = canvasRef.current;
//       const context = canvas.getContext('2d');
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });

//     return () => {
//       socket.off('userJoined');
//       socket.off('userLeft');
//       socket.off('gameStarted');
//       socket.off('wordSelected');
//       socket.off('timerUpdate');
//       socket.off('correctGuess');
//       socket.off('newMessage');
//       socket.off('roundEnded');
//       socket.off('gameEnded');
//       socket.off('draw');
//       socket.off('clear');
//     };
//   }, []);

//   const handleStartGame = () => {
//     socket.emit('startGame', roomId);
//   };

//   const handleWordSelect = (difficulty) => {
//     socket.emit('selectWord', { roomId, difficulty });
//   };

//   const handleEndGame = () => {
//     socket.emit('endGame', roomId);
//   };

//   const handleSendMessage = (message) => {
//     socket.emit('sendMessage', { roomId, message, username });
//     if (message.toLowerCase() === currentWord.toLowerCase()) {
//       setHasGuessed(true);
//     }
//   };

//   const startDrawing = (e) => {
//     if (!isDrawingTurn) return;
    
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const draw = (e) => {
//     if (!isDrawing || !isDrawingTurn) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;
//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//         roomId
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   const clearCanvas = () => {
//     if (!isDrawingTurn) return;
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear', roomId);
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         onStartGame={handleStartGame}
//         onWordSelect={handleWordSelect}
//         onEndGame={handleEndGame}
//         isDrawingTurn={isDrawingTurn}
//       />

//       {/* Main Content Area */}
//       <div className="flex h-[calc(100%-60px)] mt-[60px]">
//         {/* Drawing Canvas Area (75% width) */}
//         <div className="w-3/4 p-4">
//           <div className="relative h-full">
//             {gameState === 'drawing' && !isDrawingTurn && !hasGuessed && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-white px-4 py-2 rounded-lg shadow-md">
//                   Guess what's being drawn!
//                 </div>
//               </div>
//             )}
            
//             {isDrawingTurn && currentWord && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-yellow-100 px-4 py-2 rounded-lg shadow-md">
//                   You're drawing: {currentWord}
//                 </div>
//               </div>
//             )}
            
//             <canvas
//               ref={canvasRef}
//               onMouseDown={startDrawing}
//               onMouseUp={finishDrawing}
//               onMouseMove={draw}
//               className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
//               style={{ 
//                 cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
//                 opacity: isDrawingTurn ? 1 : 0.9
//               }}
//             />
//           </div>
//         </div>

//         {/* Chat Box Area (25% width) */}
//         <div className="w-1/4 p-4 border-l border-gray-200">
//           <ChatBox
//             onSendMessage={handleSendMessage}
//             messages={messages}
//             isDrawing={isDrawingTurn}
//             currentWord={currentWord}
//             hasGuessed={hasGuessed}
//           />
//         </div>
//       </div>

//       {/* Toolbar (only for drawer) */}
//       {isDrawingTurn && (
//         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
//             }`}
//             onClick={() => setTool('pencil')}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
//             }`}
//             onClick={() => setTool('erase')}
//           >
//             🧹 Eraser
//           </button>
//           <button 
//             className="px-3 py-1 bg-red-500 text-white rounded"
//             onClick={clearCanvas}
//           >
//             🗑️ Clear
//           </button>
//           <div className="flex items-center space-x-2">
//             <span>Size:</span>
//             <input
//               type="range"
//               min="1"
//               max="20"
//               value={pointerSize}
//               onChange={(e) => setPointerSize(Number(e.target.value))}
//               className="w-20"
//             />
//           </div>
//           <div className="flex items-center space-x-1">
//             {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
//               <button
//                 key={color}
//                 className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
//                 style={{ backgroundColor: color }}
//                 onClick={() => setSelectedColor(color)}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Score Display */}
//       <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         <div className="font-bold">{username}</div>
//         <div className="text-lg">{score} points</div>
//       </div>
//     </div>
//   );
// };

// export default Canvas;

// import React, { useRef, useEffect, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import GameControls from './GameControls';
// import ChatBox from './ChatBox';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null);
  
//   // Game state
//   const [gameState, setGameState] = useState('waiting');
//   const [currentWord, setCurrentWord] = useState('');
//   const [isDrawingTurn, setIsDrawingTurn] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [users, setUsers] = useState({});
//   const [currentRound, setCurrentRound] = useState(0);
//   const [maxRounds] = useState(3);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);

//   // Get room info from URL
//   const location = useLocation();
//   const navigate = useNavigate();
//   const queryParams = new URLSearchParams(location.search);
//   const username = queryParams.get('username');
//   const roomId = queryParams.get('roomId');
//   const isCreator = !location.search.includes('join');

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth * 0.7;
//     canvas.height = window.innerHeight * 0.7;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     context.strokeStyle = selectedColor;
//     context.lineWidth = pointerSize;
//     contextRef.current = context;

//     // Join room
//     socket.emit('joinRoom', roomId, username);

//     // Game event listeners
//     socket.on('userJoined', ({ users }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${users[socket.id]?.username} joined the game`
//       }]);
//     });

//     socket.on('userLeft', ({ users, username }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} left the game`
//       }]);
//     });

//     socket.on('gameStarted', (round) => {
//       setCurrentRound(round);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${round} started!`
//       }]);
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
      
//       if (socket.id === drawerId) {
//         setMessages(prev => [...prev, {
//           isSystem: true,
//           message: `You're drawing: ${word}`
//         }]);
//       } else {
//         setMessages(prev => [...prev, {
//           isSystem: true,
//           message: `Someone is drawing a word...`
//         }]);
//       }
//     });

//     socket.on('timerUpdate', (seconds) => {
//       setTimeLeft(seconds);
//     });

//     socket.on('correctGuess', ({ username, points, users }) => {
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//     });

//     socket.on('newMessage', (msg) => {
//       setMessages(prev => [...prev, msg]);
//     });

//     socket.on('roundEnded', ({ word, users }) => {
//       setGameState('waiting');
//       setCurrentWord('');
//       setIsDrawingTurn(false);
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ended! The word was: ${word}`
//       }]);
//     });

//     socket.on('gameEnded', (users) => {
//       setGameState('ended');
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: 'Game ended! Final scores: ' + 
//           Object.values(users).map(u => `${u.username}: ${u.score}`).join(', ')
//       }]);
//     });

//     // Drawing events - REMOVED the isDrawingTurn check so everyone sees drawings
//     socket.on('draw', (data) => {
//       const context = contextRef.current;
//       context.lineWidth = data.size;
//       context.strokeStyle = data.color;
//       context.beginPath();
//       context.moveTo(data.prevX, data.prevY);
//       context.lineTo(data.x, data.y);
//       context.stroke();
//     });

//     socket.on('clear', () => {
//       const canvas = canvasRef.current;
//       const context = canvas.getContext('2d');
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });

//     return () => {
//       socket.off('userJoined');
//       socket.off('userLeft');
//       socket.off('gameStarted');
//       socket.off('wordSelected');
//       socket.off('timerUpdate');
//       socket.off('correctGuess');
//       socket.off('newMessage');
//       socket.off('roundEnded');
//       socket.off('gameEnded');
//       socket.off('draw');
//       socket.off('clear');
//     };
//   }, []);

//   const handleStartGame = () => {
//     socket.emit('startGame', roomId);
//   };

//   const handleWordSelect = (difficulty) => {
//     socket.emit('selectWord', { roomId, difficulty });
//   };

//   const handleEndGame = () => {
//     socket.emit('endGame', roomId);
//   };

//   const handleSendMessage = (message) => {
//     socket.emit('sendMessage', { roomId, message, username });
//     if (message.toLowerCase() === currentWord.toLowerCase()) {
//       setHasGuessed(true);
//     }
//   };

//   const startDrawing = (e) => {
//     if (!isDrawingTurn) return;
    
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const draw = (e) => {
//     if (!isDrawing || !isDrawingTurn) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;
//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//         roomId
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   const clearCanvas = () => {
//     if (!isDrawingTurn) return;
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear', roomId);
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         onStartGame={handleStartGame}
//         onWordSelect={handleWordSelect}
//         onEndGame={handleEndGame}
//         isDrawingTurn={isDrawingTurn}
//       />

//       {/* Main Content Area */}
//       <div className="flex h-[calc(100%-60px)] mt-[60px]">
//         {/* Drawing Canvas Area (75% width) */}
//         <div className="w-3/4 p-4">
//           <div className="relative h-full">
//             {gameState === 'drawing' && !isDrawingTurn && !hasGuessed && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-white px-4 py-2 rounded-lg shadow-md">
//                   Guess what's being drawn!
//                 </div>
//               </div>
//             )}
            
//             {isDrawingTurn && currentWord && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-yellow-100 px-4 py-2 rounded-lg shadow-md">
//                   You're drawing: {currentWord}
//                 </div>
//               </div>
//             )}
            
//             <canvas
//               ref={canvasRef}
//               onMouseDown={startDrawing}
//               onMouseUp={finishDrawing}
//               onMouseMove={draw}
//               className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
//               style={{ 
//                 cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
//                 opacity: isDrawingTurn ? 1 : 0.9
//               }}
//             />
//           </div>
//         </div>

//         {/* Chat Box Area (25% width) */}
//         <div className="w-1/4 p-4 border-l border-gray-200">
//           <ChatBox
//             onSendMessage={handleSendMessage}
//             messages={messages}
//             isDrawing={isDrawingTurn}
//             currentWord={currentWord}
//             hasGuessed={hasGuessed}
//           />
//         </div>
//       </div>

//       {/* Toolbar (only for drawer) */}
//       {isDrawingTurn && (
//         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
//             }`}
//             onClick={() => setTool('pencil')}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
//             }`}
//             onClick={() => setTool('erase')}
//           >
//             🧹 Eraser
//           </button>
//           <button 
//             className="px-3 py-1 bg-red-500 text-white rounded"
//             onClick={clearCanvas}
//           >
//             🗑️ Clear
//           </button>
//           <div className="flex items-center space-x-2">
//             <span>Size:</span>
//             <input
//               type="range"
//               min="1"
//               max="20"
//               value={pointerSize}
//               onChange={(e) => setPointerSize(Number(e.target.value))}
//               className="w-20"
//             />
//           </div>
//           <div className="flex items-center space-x-1">
//             {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
//               <button
//                 key={color}
//                 className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
//                 style={{ backgroundColor: color }}
//                 onClick={() => setSelectedColor(color)}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Score Display */}
//       <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         <div className="font-bold">{username}</div>
//         <div className="text-lg">{score} points</div>
//       </div>
//     </div>
//   );
// };

// export default Canvas;
// import React, { useRef, useEffect, useState } from 'react';
// import { useLocation } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import GameControls from './GameControls';
// import ChatBox from './ChatBox';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   // Refs and drawing state
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null);

//   // Game state
//   const [gameState, setGameState] = useState('waiting');
//   const [currentWord, setCurrentWord] = useState('');
//   const [isDrawingTurn, setIsDrawingTurn] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [users, setUsers] = useState({});
//   const [currentRound, setCurrentRound] = useState(0);
//   const [maxRounds] = useState(3);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);

//   // Get room info from URL
//   const location = useLocation();
//   const queryParams = new URLSearchParams(location.search);
//   const username = queryParams.get('username');
//   const roomId = queryParams.get('roomId');
//   const isCreator = !location.search.includes('join');

//   // Initialize canvas and socket connections
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth * 0.7;
//     canvas.height = window.innerHeight * 0.7;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     context.strokeStyle = selectedColor;
//     context.lineWidth = pointerSize;
//     contextRef.current = context;

//     // Join room
//     socket.emit('joinRoom', roomId, username);

//     // Socket event listeners
//     socket.on('userJoined', ({ users }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${users[socket.id]?.username} joined the game`
//       }]);
//     });

//     socket.on('userLeft', ({ users, username }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} left the game`
//       }]);
//     });

//     socket.on('gameStarted', (round) => {
//       setCurrentRound(round);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${round} started!`
//       }]);
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
      
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: socket.id === drawerId 
//           ? `You're drawing: ${word}`
//           : `Someone is drawing a word...`
//       }]);
//     });

//     // Handle drawing events - CRITICAL: No isDrawingTurn check here
//     socket.on('draw', (data) => {
//       const context = contextRef.current;
//       context.lineWidth = data.size;
//       context.strokeStyle = data.color;
//       context.beginPath();
//       context.moveTo(data.prevX, data.prevY);
//       context.lineTo(data.x, data.y);
//       context.stroke();
//     });

//     socket.on('clear', () => {
//       const canvas = canvasRef.current;
//       const context = canvas.getContext('2d');
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });

//     return () => {
//       socket.off('draw');
//       socket.off('clear');
//     };
//   }, []);

//   // Drawing functions
//   const startDrawing = (e) => {
//     if (!isDrawingTurn) return;
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const draw = (e) => {
//     if (!isDrawing || !isDrawingTurn) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;
//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       // Emit to all players
//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//         roomId
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const clearCanvas = () => {
//     if (!isDrawingTurn) return;
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear', roomId);
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         onStartGame={() => socket.emit('startGame', roomId)}
//         onWordSelect={(difficulty) => socket.emit('selectWord', { roomId, difficulty })}
//         isDrawingTurn={isDrawingTurn}
//       />

//       {/* Main Content Area */}
//       <div className="flex h-[calc(100%-60px)] mt-[60px]">
//         {/* Drawing Canvas Area (70% width) */}
//         <div className="w-[70%] p-4">
//           <div className="relative h-full">
//             {isDrawingTurn && currentWord && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-yellow-100 px-4 py-2 rounded-lg shadow-md">
//                   You're drawing: {currentWord}
//                 </div>
//               </div>
//             )}
            
//             {gameState === 'drawing' && !isDrawingTurn && !hasGuessed && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-blue-100 px-4 py-2 rounded-lg shadow-md">
//                   Guess what's being drawn!
//                 </div>
//               </div>
//             )}
            
//             <canvas
//               ref={canvasRef}
//               onMouseDown={startDrawing}
//               onMouseUp={finishDrawing}
//               onMouseMove={draw}
//               className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
//               style={{ 
//                 cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
//                 pointerEvents: isDrawingTurn ? 'auto' : 'none',
//                 opacity: isDrawingTurn ? 1 : 0.9
//               }}
//             />
//           </div>
//         </div>

//         {/* Chat Box Area (30% width) */}
//         <div className="w-[30%] p-4 border-l border-gray-200">
//           <ChatBox
//             onSendMessage={(message) => socket.emit('sendMessage', { 
//               roomId, 
//               message, 
//               username 
//             })}
//             messages={messages}
//             isDrawing={isDrawingTurn}
//             currentWord={currentWord}
//             hasGuessed={hasGuessed}
//           />
//         </div>
//       </div>

//       {/* Drawing Tools (only for drawer) */}
//       {isDrawingTurn && (
//         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
//           <button
//             onClick={() => setTool('pencil')}
//             className={`px-3 py-1 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
//             }`}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             onClick={() => setTool('erase')}
//             className={`px-3 py-1 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
//             }`}
//           >
//             🧹 Eraser
//           </button>
//           <button 
//             onClick={clearCanvas}
//             className="px-3 py-1 bg-red-500 text-white rounded"
//           >
//             🗑️ Clear
//           </button>
//           <div className="flex items-center space-x-2">
//             <span>Size:</span>
//             <input
//               type="range"
//               min="1"
//               max="20"
//               value={pointerSize}
//               onChange={(e) => setPointerSize(Number(e.target.value))}
//               className="w-20"
//             />
//           </div>
//           <div className="flex items-center space-x-1">
//             {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
//               <button
//                 key={color}
//                 className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
//                 style={{ backgroundColor: color }}
//                 onClick={() => setSelectedColor(color)}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Score Display */}
//       <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         <div className="font-bold">{username}</div>
//         <div className="text-lg">{score} points</div>
//       </div>
//     </div>
//   );
// };

// export default Canvas;
// import React, { useRef, useEffect, useState } from 'react';
// import { useLocation } from 'react-router-dom';
// import { io } from 'socket.io-client';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null);
//   const [roomUsers, setRoomUsers] = useState([]);
  
//   // Get room ID and username from URL params
//   const location = useLocation();
//   const queryParams = new URLSearchParams(location.search);
//   const username = queryParams.get('username');
//   const roomId = queryParams.get('roomId');

//   const colorPalette = [
//     'black', 'red', 'blue', 'green', 'yellow', 'purple',
//     'orange', 'pink', 'brown', 'gray', 'cyan', 'lime',
//   ];

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     contextRef.current = context;

//     // Join room when component mounts
//     if (roomId && username) {
//       socket.emit('joinRoom', roomId, username);
//     }

//     // Socket event listeners
//     socket.on('draw', ({ prevX, prevY, x, y, size, color }) => {
//       const context = contextRef.current;
//       context.lineWidth = size;
//       context.strokeStyle = color;
//       context.beginPath();
//       context.moveTo(prevX, prevY);
//       context.lineTo(x, y);
//       context.stroke();
//     });

//     socket.on('clear', () => {
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });

//     socket.on('userJoined', (user) => {
//       setRoomUsers(prev => [...prev, user]);
//     });

//     socket.on('userLeft', (userId) => {
//       setRoomUsers(prev => prev.filter(user => user.userId !== userId));
//     });

//     socket.on('roomUsers', (users) => {
//       setRoomUsers(users);
//     });

//     // Clean up on unmount
//     return () => {
//       socket.off('draw');
//       socket.off('clear');
//       socket.off('userJoined');
//       socket.off('userLeft');
//       socket.off('roomUsers');
//       if (roomId) {
//         socket.emit('leaveRoom', roomId);
//       }
//     };
//   }, [roomId, username]);

//   const clearCanvas = () => {
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear', roomId);
//   };

//   const startDrawing = (e) => {
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const draw = (e) => {
//     if (!isDrawing) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;

//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//         roomId: roomId
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   return (
//     <div className="relative h-screen bg-gray-100">
//       {/* Room Info Bar */}
//       <div className="absolute top-4 right-4 z-10 bg-white shadow-md rounded-lg p-4">
//         <div className="flex items-center space-x-2 mb-2">
//           <span className="font-semibold">Room:</span>
//           <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
//             {roomId}
//           </span>
//           <button 
//             onClick={() => navigator.clipboard.writeText(roomId)}
//             className="text-gray-500 hover:text-gray-700"
//             title="Copy room ID"
//           >
//             📋
//           </button>
//         </div>
//         <div>
//           <span className="font-semibold">Users:</span>
//           <div className="mt-1 space-y-1">
//             {roomUsers.map(user => (
//               <div key={user.userId} className="flex items-center">
//                 <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
//                 <span>{user.username}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Toolbar */}
//       <div className="absolute top-4 left-4 z-10 bg-white shadow-md rounded-lg p-4 space-y-4">
//         <div className="flex space-x-4">
//           <button
//             className={`px-4 py-2 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'
//             }`}
//             onClick={() => setTool('pencil')}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             className={`px-4 py-2 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600'
//             }`}
//             onClick={() => setTool('erase')}
//           >
//             🧹 Eraser
//           </button>
//           <button className="px-4 py-2 bg-red-500 text-white rounded" onClick={clearCanvas}>
//             🗑️ Clear
//           </button>
//         </div>

//         {/* Pointer Size */}
//         <div className="flex items-center space-x-2">
//           <label className="text-gray-700 font-medium">Pointer Size:</label>
//           <input
//             type="range"
//             min="2"
//             max="20"
//             value={pointerSize}
//             onChange={(e) => setPointerSize(Number(e.target.value))}
//             className="w-24"
//           />
//         </div>

//         {/* Color Palette */}
//         <div className="grid grid-cols-4 gap-2">
//           {colorPalette.map((color) => (
//             <button
//               key={color}
//               className={`w-8 h-8 rounded-full border-2 ${
//                 selectedColor === color ? 'border-gray-700' : 'border-transparent'
//               }`}
//               style={{ backgroundColor: color }}
//               onClick={() => setSelectedColor(color)}
//             />
//           ))}
//         </div>
//       </div>

//       {/* Canvas */}
//       <canvas
//         ref={canvasRef}
//         onMouseDown={startDrawing}
//         onMouseUp={finishDrawing}
//         onMouseMove={draw}
//         className="w-full h-full bg-white"
//       />
//     </div>
//   );
// };

// export default Canvas;// import React, { useRef, useEffect, useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import GameControls from './GameControls';
// import ChatBox from './ChatBox';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null);
  
//   // Game state
//   const [gameState, setGameState] = useState('waiting');
//   const [currentWord, setCurrentWord] = useState('');
//   const [isDrawingTurn, setIsDrawingTurn] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [users, setUsers] = useState({});
//   const [currentRound, setCurrentRound] = useState(0);
//   const [maxRounds] = useState(3);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);

//   // Get room info from URL
//   const location = useLocation();
//   const navigate = useNavigate();
//   const queryParams = new URLSearchParams(location.search);
//   const username = queryParams.get('username');
//   const roomId = queryParams.get('roomId');
//   const isCreator = !location.search.includes('join');

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth * 0.7;
//     canvas.height = window.innerHeight * 0.7;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     context.strokeStyle = selectedColor;
//     context.lineWidth = pointerSize;
//     contextRef.current = context;

//     // Join room
//     socket.emit('joinRoom', roomId, username);

//     // Game event listeners
//     socket.on('userJoined', ({ users }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${users[socket.id]?.username} joined the game`
//       }]);
//     });

//     socket.on('userLeft', ({ users, username }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} left the game`
//       }]);
//     });

//     socket.on('gameStarted', (round) => {
//       setCurrentRound(round);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${round} started!`
//       }]);
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
      
//       if (socket.id === drawerId) {
//         setMessages(prev => [...prev, {
//           isSystem: true,
//           message: `You're drawing: ${word}`
//         }]);
//       } else {
//         setMessages(prev => [...prev, {
//           isSystem: true,
//           message: `Someone is drawing a word...`
//         }]);
//       }
//     });

//     socket.on('timerUpdate', (seconds) => {
//       setTimeLeft(seconds);
//     });

//     socket.on('correctGuess', ({ username, points, users }) => {
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//     });

//     socket.on('newMessage', (msg) => {
//       setMessages(prev => [...prev, msg]);
//     });

//     socket.on('roundEnded', ({ word, users }) => {
//       setGameState('waiting');
//       setCurrentWord('');
//       setIsDrawingTurn(false);
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ended! The word was: ${word}`
//       }]);
//     });

//     socket.on('gameEnded', (users) => {
//       setGameState('ended');
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: 'Game ended! Final scores: ' + 
//           Object.values(users).map(u => `${u.username}: ${u.score}`).join(', ')
//       }]);
//     });

//     // Drawing events - REMOVED the isDrawingTurn check so everyone sees drawings
//     socket.on('draw', (data) => {
//       const context = contextRef.current;
//       context.lineWidth = data.size;
//       context.strokeStyle = data.color;
//       context.beginPath();
//       context.moveTo(data.prevX, data.prevY);
//       context.lineTo(data.x, data.y);
//       context.stroke();
//     });

//     socket.on('clear', () => {
//       const canvas = canvasRef.current;
//       const context = canvas.getContext('2d');
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });

//     return () => {
//       socket.off('userJoined');
//       socket.off('userLeft');
//       socket.off('gameStarted');
//       socket.off('wordSelected');
//       socket.off('timerUpdate');
//       socket.off('correctGuess');
//       socket.off('newMessage');
//       socket.off('roundEnded');
//       socket.off('gameEnded');
//       socket.off('draw');
//       socket.off('clear');
//     };
//   }, []);

//   const handleStartGame = () => {
//     socket.emit('startGame', roomId);
//   };

//   const handleWordSelect = (difficulty) => {
//     socket.emit('selectWord', { roomId, difficulty });
//   };

//   const handleEndGame = () => {
//     socket.emit('endGame', roomId);
//   };

//   const handleSendMessage = (message) => {
//     socket.emit('sendMessage', { roomId, message, username });
//     if (message.toLowerCase() === currentWord.toLowerCase()) {
//       setHasGuessed(true);
//     }
//   };

//   const startDrawing = (e) => {
//     if (!isDrawingTurn) return;
    
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const draw = (e) => {
//     if (!isDrawing || !isDrawingTurn) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;
//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//         roomId
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   const clearCanvas = () => {
//     if (!isDrawingTurn) return;
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear', roomId);
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         onStartGame={handleStartGame}
//         onWordSelect={handleWordSelect}
//         onEndGame={handleEndGame}
//         isDrawingTurn={isDrawingTurn}
//       />

//       {/* Main Content Area */}
//       <div className="flex h-[calc(100%-60px)] mt-[60px]">
//         {/* Drawing Canvas Area (75% width) */}
//         <div className="w-3/4 p-4">
//           <div className="relative h-full">
//             {gameState === 'drawing' && !isDrawingTurn && !hasGuessed && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-white px-4 py-2 rounded-lg shadow-md">
//                   Guess what's being drawn!
//                 </div>
//               </div>
//             )}
            
//             {isDrawingTurn && currentWord && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-yellow-100 px-4 py-2 rounded-lg shadow-md">
//                   You're drawing: {currentWord}
//                 </div>
//               </div>
//             )}
            
//             <canvas
//               ref={canvasRef}
//               onMouseDown={startDrawing}
//               onMouseUp={finishDrawing}
//               onMouseMove={draw}
//               className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
//               style={{ 
//                 cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
//                 opacity: isDrawingTurn ? 1 : 0.9
//               }}
//             />
//           </div>
//         </div>

//         {/* Chat Box Area (25% width) */}
//         <div className="w-1/4 p-4 border-l border-gray-200">
//           <ChatBox
//             onSendMessage={handleSendMessage}
//             messages={messages}
//             isDrawing={isDrawingTurn}
//             currentWord={currentWord}
//             hasGuessed={hasGuessed}
//           />
//         </div>
//       </div>

//       {/* Toolbar (only for drawer) */}
//       {isDrawingTurn && (
//         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
//             }`}
//             onClick={() => setTool('pencil')}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
//             }`}
//             onClick={() => setTool('erase')}
//           >
//             🧹 Eraser
//           </button>
//           <button 
//             className="px-3 py-1 bg-red-500 text-white rounded"
//             onClick={clearCanvas}
//           >
//             🗑️ Clear
//           </button>
//           <div className="flex items-center space-x-2">
//             <span>Size:</span>
//             <input
//               type="range"
//               min="1"
//               max="20"
//               value={pointerSize}
//               onChange={(e) => setPointerSize(Number(e.target.value))}
//               className="w-20"
//             />
//           </div>
//           <div className="flex items-center space-x-1">
//             {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
//               <button
//                 key={color}
//                 className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
//                 style={{ backgroundColor: color }}
//                 onClick={() => setSelectedColor(color)}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Score Display */}
//       <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         <div className="font-bold">{username}</div>
//         <div className="text-lg">{score} points</div>
//       </div>
//     </div>
//   );
// };

// export default Canvas;
// import React, { useRef, useEffect, useState } from 'react';
// import { useLocation } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import GameControls from './GameControls';
// import ChatBox from './ChatBox';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   // Refs and drawing state
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null);

//   // Game state
//   const [gameState, setGameState] = useState('waiting');
//   const [currentWord, setCurrentWord] = useState('');
//   const [isDrawingTurn, setIsDrawingTurn] = useState(false);
//   const [messages, setMessages] = useState([]);
//   const [users, setUsers] = useState({});
//   const [currentRound, setCurrentRound] = useState(0);
//   const [maxRounds] = useState(3);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);

//   // Get room info from URL
//   const location = useLocation();
//   const queryParams = new URLSearchParams(location.search);
//   const username = queryParams.get('username');
//   const roomId = queryParams.get('roomId');
//   const isCreator = !location.search.includes('join');

//   // Initialize canvas and socket connections
//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth * 0.7;
//     canvas.height = window.innerHeight * 0.7;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     context.strokeStyle = selectedColor;
//     context.lineWidth = pointerSize;
//     contextRef.current = context;

//     // Join room
//     socket.emit('joinRoom', roomId, username);

//     // Socket event listeners
//     socket.on('userJoined', ({ users }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${users[socket.id]?.username} joined the game`
//       }]);
//     });

//     socket.on('userLeft', ({ users, username }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} left the game`
//       }]);
//     });

//     socket.on('gameStarted', (round) => {
//       setCurrentRound(round);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${round} started!`
//       }]);
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
      
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: socket.id === drawerId 
//           ? `You're drawing: ${word}`
//           : `Someone is drawing a word...`
//       }]);
//     });

//     // Handle drawing events - CRITICAL: No isDrawingTurn check here
//     socket.on('draw', (data) => {
//       const context = contextRef.current;
//       context.lineWidth = data.size;
//       context.strokeStyle = data.color;
//       context.beginPath();
//       context.moveTo(data.prevX, data.prevY);
//       context.lineTo(data.x, data.y);
//       context.stroke();
//     });

//     socket.on('clear', () => {
//       const canvas = canvasRef.current;
//       const context = canvas.getContext('2d');
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });

//     return () => {
//       socket.off('draw');
//       socket.off('clear');
//     };
//   }, []);

//   // Drawing functions
//   const startDrawing = (e) => {
//     if (!isDrawingTurn) return;
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const draw = (e) => {
//     if (!isDrawing || !isDrawingTurn) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;
//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       // Emit to all players
//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//         roomId
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const clearCanvas = () => {
//     if (!isDrawingTurn) return;
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear', roomId);
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         onStartGame={() => socket.emit('startGame', roomId)}
//         onWordSelect={(difficulty) => socket.emit('selectWord', { roomId, difficulty })}
//         isDrawingTurn={isDrawingTurn}
//       />

//       {/* Main Content Area */}
//       <div className="flex h-[calc(100%-60px)] mt-[60px]">
//         {/* Drawing Canvas Area (70% width) */}
//         <div className="w-[70%] p-4">
//           <div className="relative h-full">
//             {isDrawingTurn && currentWord && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-yellow-100 px-4 py-2 rounded-lg shadow-md">
//                   You're drawing: {currentWord}
//                 </div>
//               </div>
//             )}
            
//             {gameState === 'drawing' && !isDrawingTurn && !hasGuessed && (
//               <div className="absolute top-0 left-0 right-0 text-center z-10">
//                 <div className="inline-block bg-blue-100 px-4 py-2 rounded-lg shadow-md">
//                   Guess what's being drawn!
//                 </div>
//               </div>
//             )}
            
//             <canvas
//               ref={canvasRef}
//               onMouseDown={startDrawing}
//               onMouseUp={finishDrawing}
//               onMouseMove={draw}
//               className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
//               style={{ 
//                 cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
//                 pointerEvents: isDrawingTurn ? 'auto' : 'none',
//                 opacity: isDrawingTurn ? 1 : 0.9
//               }}
//             />
//           </div>
//         </div>

//         {/* Chat Box Area (30% width) */}
//         <div className="w-[30%] p-4 border-l border-gray-200">
//           <ChatBox
//             onSendMessage={(message) => socket.emit('sendMessage', { 
//               roomId, 
//               message, 
//               username 
//             })}
//             messages={messages}
//             isDrawing={isDrawingTurn}
//             currentWord={currentWord}
//             hasGuessed={hasGuessed}
//           />
//         </div>
//       </div>

//       {/* Drawing Tools (only for drawer) */}
//       {isDrawingTurn && (
//         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
//           <button
//             onClick={() => setTool('pencil')}
//             className={`px-3 py-1 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
//             }`}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             onClick={() => setTool('erase')}
//             className={`px-3 py-1 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
//             }`}
//           >
//             🧹 Eraser
//           </button>
//           <button 
//             onClick={clearCanvas}
//             className="px-3 py-1 bg-red-500 text-white rounded"
//           >
//             🗑️ Clear
//           </button>
//           <div className="flex items-center space-x-2">
//             <span>Size:</span>
//             <input
//               type="range"
//               min="1"
//               max="20"
//               value={pointerSize}
//               onChange={(e) => setPointerSize(Number(e.target.value))}
//               className="w-20"
//             />
//           </div>
//           <div className="flex items-center space-x-1">
//             {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
//               <button
//                 key={color}
//                 className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
//                 style={{ backgroundColor: color }}
//                 onClick={() => setSelectedColor(color)}
//               />
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Score Display */}
//       <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         <div className="font-bold">{username}</div>
//         <div className="text-lg">{score} points</div>
//       </div>
//     </div>
//   );
// };

// export default Canvas;
// import React, { useRef, useEffect, useState } from 'react';
// import { useLocation } from 'react-router-dom';
// import { io } from 'socket.io-client';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const [isDrawing, setIsDrawing] = useState(false);
//   const [tool, setTool] = useState('pencil');
//   const [pointerSize, setPointerSize] = useState(5);
//   const [selectedColor, setSelectedColor] = useState('black');
//   const [lastPos, setLastPos] = useState(null);
//   const [roomUsers, setRoomUsers] = useState([]);
  
//   // Get room ID and username from URL params
//   const location = useLocation();
//   const queryParams = new URLSearchParams(location.search);
//   const username = queryParams.get('username');
//   const roomId = queryParams.get('roomId');

//   const colorPalette = [
//     'black', 'red', 'blue', 'green', 'yellow', 'purple',
//     'orange', 'pink', 'brown', 'gray', 'cyan', 'lime',
//   ];

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;

//     const context = canvas.getContext('2d');
//     context.lineCap = 'round';
//     contextRef.current = context;

//     // Join room when component mounts
//     if (roomId && username) {
//       socket.emit('joinRoom', roomId, username);
//     }

//     // Socket event listeners
//     socket.on('draw', ({ prevX, prevY, x, y, size, color }) => {
//       const context = contextRef.current;
//       context.lineWidth = size;
//       context.strokeStyle = color;
//       context.beginPath();
//       context.moveTo(prevX, prevY);
//       context.lineTo(x, y);
//       context.stroke();
//     });

//     socket.on('clear', () => {
//       context.clearRect(0, 0, canvas.width, canvas.height);
//     });

//     socket.on('userJoined', (user) => {
//       setRoomUsers(prev => [...prev, user]);
//     });

//     socket.on('userLeft', (userId) => {
//       setRoomUsers(prev => prev.filter(user => user.userId !== userId));
//     });

//     socket.on('roomUsers', (users) => {
//       setRoomUsers(users);
//     });

//     // Clean up on unmount
//     return () => {
//       socket.off('draw');
//       socket.off('clear');
//       socket.off('userJoined');
//       socket.off('userLeft');
//       socket.off('roomUsers');
//       if (roomId) {
//         socket.emit('leaveRoom', roomId);
//       }
//     };
//   }, [roomId, username]);

//   const clearCanvas = () => {
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     socket.emit('clear', roomId);
//   };

//   const startDrawing = (e) => {
//     const { offsetX, offsetY } = e.nativeEvent;
//     setLastPos({ x: offsetX, y: offsetY });
//     setIsDrawing(true);
//   };

//   const finishDrawing = () => {
//     setIsDrawing(false);
//     setLastPos(null);
//   };

//   const draw = (e) => {
//     if (!isDrawing) return;

//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;

//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;

//       context.beginPath();
//       context.moveTo(lastPos.x, lastPos.y);
//       context.lineTo(offsetX, offsetY);
//       context.stroke();

//       socket.emit('draw', {
//         prevX: lastPos.x,
//         prevY: lastPos.y,
//         x: offsetX,
//         y: offsetY,
//         size: pointerSize,
//         color: selectedColor,
//         roomId: roomId
//       });

//       setLastPos({ x: offsetX, y: offsetY });
//     } else if (tool === 'erase') {
//       context.clearRect(
//         offsetX - pointerSize / 2,
//         offsetY - pointerSize / 2,
//         pointerSize,
//         pointerSize
//       );
//     }
//   };

//   return (
//     <div className="relative h-screen bg-gray-100">
//       {/* Room Info Bar */}
//       <div className="absolute top-4 right-4 z-10 bg-white shadow-md rounded-lg p-4">
//         <div className="flex items-center space-x-2 mb-2">
//           <span className="font-semibold">Room:</span>
//           <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-mono">
//             {roomId}
//           </span>
//           <button 
//             onClick={() => navigator.clipboard.writeText(roomId)}
//             className="text-gray-500 hover:text-gray-700"
//             title="Copy room ID"
//           >
//             📋
//           </button>
//         </div>
//         <div>
//           <span className="font-semibold">Users:</span>
//           <div className="mt-1 space-y-1">
//             {roomUsers.map(user => (
//               <div key={user.userId} className="flex items-center">
//                 <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
//                 <span>{user.username}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>

//       {/* Toolbar */}
//       <div className="absolute top-4 left-4 z-10 bg-white shadow-md rounded-lg p-4 space-y-4">
//         <div className="flex space-x-4">
//           <button
//             className={`px-4 py-2 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'
//             }`}
//             onClick={() => setTool('pencil')}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             className={`px-4 py-2 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600'
//             }`}
//             onClick={() => setTool('erase')}
//           >
//             🧹 Eraser
//           </button>
//           <button className="px-4 py-2 bg-red-500 text-white rounded" onClick={clearCanvas}>
//             🗑️ Clear
//           </button>
//         </div>

//         {/* Pointer Size */}
//         <div className="flex items-center space-x-2">
//           <label className="text-gray-700 font-medium">Pointer Size:</label>
//           <input
//             type="range"
//             min="2"
//             max="20"
//             value={pointerSize}
//             onChange={(e) => setPointerSize(Number(e.target.value))}
//             className="w-24"
//           />
//         </div>

//         {/* Color Palette */}
//         <div className="grid grid-cols-4 gap-2">
//           {colorPalette.map((color) => (
//             <button
//               key={color}
//               className={`w-8 h-8 rounded-full border-2 ${
//                 selectedColor === color ? 'border-gray-700' : 'border-transparent'
//               }`}
//               style={{ backgroundColor: color }}
//               onClick={() => setSelectedColor(color)}
//             />
//           ))}
//         </div>
//       </div>

//       {/* Canvas */}
//       <canvas
//         ref={canvasRef}
//         onMouseDown={startDrawing}
//         onMouseUp={finishDrawing}
//         onMouseMove={draw}
//         className="w-full h-full bg-white"
//       />
//     </div>
//   );
// };

// export default Canvas;