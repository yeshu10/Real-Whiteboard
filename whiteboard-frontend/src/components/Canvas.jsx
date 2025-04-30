import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import GameControls from './GameControls';
import ChatBox from './ChatBox';
import WordSelection from './WordSelection';


const socket = io('http://localhost:5000');

   
const FlashMessage = ({ message, duration = 2000 }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  if (!visible) return null;

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
      <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse text-xl font-bold">
        {message}
      </div>
    </div>
  );
};

// WinnerModal component
const WinnerModal = ({ users, onClose }) => {
  const sortedUsers = Object.values(users || {}).sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sortedUsers[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-3xl font-bold mb-6 text-center">Game Over!</h3>
        
        {winner && (
          <div className="text-center mb-6">
            <div className="text-xl font-semibold">Winner:</div>
            <div className="text-4xl font-bold text-yellow-500 my-3">
              {winner.username}
            </div>
            <div className="text-2xl">with {winner.score || 0} points!</div>
          </div>
        )}
        
        <h4 className="font-semibold border-b pb-2 mb-3 text-lg">Final Rankings:</h4>
        <ul className="space-y-3 mb-6">
          {sortedUsers.map((user, index) => (
            <li key={user.id} className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="font-bold w-8 text-lg">{index + 1}.</span>
                <span className="text-lg">{user.username}</span>
              </div>
              <span className="font-bold text-lg">{user.score || 0} pts</span>
            </li>
          ))}
        </ul>
        
        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition text-lg"
        >
          Close
        </button>
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
  const [maxRounds, setMaxRounds] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [score, setScore] = useState(0);
  const [currentDrawer, setCurrentDrawer] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

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
    console.log('Joining room:', roomId, 'as user:', username);
    socket.emit('joinRoom', roomId, username);

    socket.on('userJoined', ({ users, newUser }) => {
      console.log('User joined:', newUser?.username);
      setUsers(users);
      setMessages(prev => [
        ...prev,
        {
          isSystem: true,
          message: `${newUser?.username || 'A user'} joined the game`
        }
      ]);
    });
    
    socket.on('userLeft', ({ users, username }) => {
      console.log('User left:', username);
      setUsers(users);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `${username} left the game`
      }]);
    });

    socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft, maxRounds }) => {
      console.log('Received room state:', {
        gameState,
        currentRound,
        maxRounds,
        currentDrawer: currentDrawer?.username,
        timeLeft
      });
      setUsers(users);
      setGameState(gameState);
      setCurrentRound(currentRound);
      setCurrentWord(currentWord || '');
      setCurrentDrawer(currentDrawer);
      setTimeLeft(timeLeft || 0);
      setIsDrawingTurn(socket.id === currentDrawer?.id);
      setScore(users[socket.id]?.score || 0);
      setMaxRounds(maxRounds || 5);
      
      if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
        clearCanvas();
      }
    });
    
    socket.on('gameStarted', ({ currentRound, currentDrawer, maxRounds }) => {
      console.log('Game started - Round:', currentRound, 'of', maxRounds, 'Drawer:', currentDrawer?.username);
      setCurrentRound(currentRound);
      setMaxRounds(maxRounds);
      setCurrentDrawer(currentDrawer);
      setGameState('wordSelection');
      setIsDrawingTurn(socket.id === currentDrawer?.id);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `Round ${currentRound} of ${maxRounds} started!`
      }]);
      
      if (socket.id === currentDrawer?.id) {
        clearCanvas();
      }
    });

    socket.on('turnStarted', ({ drawerId, drawerName }) => {
      console.log('Turn started for:', drawerName);
      setCurrentDrawer({ id: drawerId, username: drawerName });
      setGameState('wordSelection');
      setCurrentWord('');
      setIsDrawingTurn(socket.id === drawerId);
      setHasGuessed(false);
      
      clearCanvas();
      
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `${drawerName}'s turn to draw!`
      }]);
    });

    socket.on('yourTurn', () => {
      console.log('Your turn to draw');
      setIsDrawingTurn(true);
      setGameState('wordSelection');
      setMessages(prev => [...prev, {
        isSystem: true,
        message: "It's your turn to draw! Select a word difficulty."
      }]);
      clearCanvas();
    });

    socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
      console.log('Word selected:', word, 'by drawer:', drawerId === socket.id ? 'you' : 'someone else');
      setCurrentWord(word);
      setGameState('drawing');
      setIsDrawingTurn(socket.id === drawerId);
      setTimeLeft(timeLeft);
      setHasGuessed(false);
    });

    socket.on('timerUpdate', (seconds) => {
      console.log('Time left:', seconds);
      setTimeLeft(seconds);
    });

    socket.on('correctGuess', ({ username, points, users, isRoundOver }) => {
      console.log('Correct guess by:', username, 'Round over:', isRoundOver);
      setUsers(users);
      setScore(users[socket.id]?.score || 0);
      setMessages(prev => [...prev, {
        isSystem: true,
        message: `${username} guessed correctly! +${points} points`
      }]);
      
      setFlashMessage(`${username} guessed the word!`);
      setTimeout(() => setFlashMessage(null), 2000);

      if (isRoundOver) {
        setCurrentWord('');
      }
    });

    socket.on('newMessage', (msg) => {
      console.log('New message:', msg);
      setMessages(prev => [...prev, msg]);
    });

// Add this useEffect to handle round transitions


// Modified roundEnded handler (just add the timeout)
socket.on('roundEnded', ({ users, currentRound, maxRounds }) => {
  console.log('Round ended - Current:', currentRound, 'Max:', maxRounds);
  setGameState('waiting');
  setCurrentWord('');
  setIsDrawingTurn(false);
  setUsers(users);
  setCurrentRound(currentRound);
  setMaxRounds(maxRounds);
  
  setMessages(prev => [
    ...prev,
    { isSystem: true, message: `Round ${currentRound-1} completed!` }
  ]);

  if (currentRound <= maxRounds) {
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { isSystem: true, message: `Starting Round ${currentRound}...` }
      ]);
    }, 1500); // 1.5s delay before next round starts
  }
});

// Keep your existing roundStarted handler exactly as is

// Enhanced roundStarted handler
socket.on('roundStarted', ({ currentRound, currentDrawer, maxRounds }) => {
  console.log('Round started - Round:', currentRound, 'Drawer:', currentDrawer?.username);
  setGameState(currentDrawer?.id === socket.id ? 'wordSelection' : 'waiting');
  setCurrentWord('');
  setCurrentRound(currentRound);
  setMaxRounds(maxRounds);
  setCurrentDrawer(currentDrawer);
  setIsDrawingTurn(currentDrawer?.id === socket.id);
  setHasGuessed(false);
  
  if (currentDrawer?.id === socket.id) {
    setMessages(prev => [...prev, {
      isSystem: true,
      message: "🎨 Your turn to draw!"
    }]);
  } else {
    setMessages(prev => [...prev, {
      isSystem: true,
      message: `🖌️ Waiting for ${currentDrawer?.username} to draw...`
    }]);
  }
});
    socket.on('gameEnded', (users) => {
      console.log('Game ended, final scores:', users);
      setGameState('ended');
      setUsers(users);
      setScore(users[socket.id]?.score || 0);
      setShowWinnerModal(true);
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

  useEffect(() => {
    if (gameState === 'waiting' && currentRound <= maxRounds) {
      // This will help trigger the next round
      console.log(`Ready for round ${currentRound}/${maxRounds}`);
    }
  }, [gameState, currentRound, maxRounds]);

  // Add this useEffect to track state changes
useEffect(() => {
  console.log('Game State Update:', {
    gameState,
    currentRound,
    maxRounds,
    currentDrawer: currentDrawer?.username,
    isDrawingTurn,
    timeLeft
  });
}, [gameState, currentRound, maxRounds, currentDrawer, isDrawingTurn, timeLeft]);
  const handleStartGame = (rounds) => {
    socket.emit('startGame', roomId, rounds);
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
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (isDrawingTurn) {
      socket.emit('clear', roomId);
    }
  };

  const closeWinnerModal = () => {
    setShowWinnerModal(false);
  };

  return (
    <div className="relative h-screen bg-gray-100 overflow-hidden">
      {/* Flash Message */}
      {flashMessage && <FlashMessage message={flashMessage} />}

      {/* Word Selection Overlay */}
      {gameState === 'wordSelection' && isDrawingTurn && (
        <WordSelection onWordSelect={handleWordSelect} />
      )}

      {/* Winner Modal */}
      {showWinnerModal && (
        <WinnerModal users={users} onClose={closeWinnerModal} />
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

// // WordSelection component
// const WordSelection = ({ onWordSelect }) => {
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
//       <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
//         <h3 className="text-xl font-bold mb-4 text-center">Select Word Difficulty</h3>
//         <div className="flex flex-col space-y-3">
//           <button 
//             onClick={() => onWordSelect('easy')}
//             className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Easy
//           </button>
//           <button 
//             onClick={() => onWordSelect('medium')}
//             className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Medium
//           </button>
//           <button 
//             onClick={() => onWordSelect('hard')}
//             className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Hard
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// // FlashMessage component
// const FlashMessage = ({ message, duration = 2000 }) => {
//   const [visible, setVisible] = useState(true);

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setVisible(false);
//     }, duration);

//     return () => clearTimeout(timer);
//   }, [duration]);

//   if (!visible) return null;

//   return (
//     <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
//       <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse text-xl font-bold">
//         {message}
//       </div>
//     </div>
//   );
// };

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
//   const [maxRounds, setMaxRounds] = useState(3);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);
//   const [currentDrawer, setCurrentDrawer] = useState(null);
//   const [flashMessage, setFlashMessage] = useState(null);

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

//     socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft, maxRounds }) => {
//       setUsers(users);
//       setGameState(gameState);
//       setCurrentRound(currentRound);
//       setCurrentWord(currentWord || '');
//       setCurrentDrawer(currentDrawer);
//       setTimeLeft(timeLeft || 0);
//       setIsDrawingTurn(socket.id === currentDrawer?.id);
//       setScore(users[socket.id]?.score || 0);
//       setMaxRounds(maxRounds || 3);
      
//       // Clear canvas if it's our turn to draw
//       if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
//         clearCanvas();
//       }
//     });
    
//     socket.on('gameStarted', ({ currentRound, currentDrawer, maxRounds }) => {
//       setCurrentRound(currentRound);
//       setMaxRounds(maxRounds);
//       setCurrentDrawer(currentDrawer);
//       setGameState('wordSelection');
//       setIsDrawingTurn(socket.id === currentDrawer?.id);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} of ${maxRounds} started!`
//       }]);
      
//       if (socket.id === currentDrawer?.id) {
//         clearCanvas();
//       }
//     });

//     socket.on('turnStarted', ({ drawerId, drawerName }) => {
//       setCurrentDrawer({ id: drawerId, username: drawerName });
//       setGameState('wordSelection');
//       setCurrentWord('');
//       setIsDrawingTurn(socket.id === drawerId);
//       setHasGuessed(false);
      
//       // Clear canvas when turn starts
//       clearCanvas();
      
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${drawerName}'s turn to draw!`
//       }]);
//     });

//     socket.on('yourTurn', () => {
//       setIsDrawingTurn(true);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: "It's your turn to draw! Select a word difficulty."
//       }]);
//       clearCanvas();
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
//     });

//     socket.on('timerUpdate', (seconds) => {
//       setTimeLeft(seconds);
//     });

//     socket.on('correctGuess', ({ username, points, users, isRoundOver }) => {
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} guessed correctly! +${points} points`
//       }]);
      
//       // Show flash message for correct guess
//       setFlashMessage(`${username} guessed the word!`);
//       setTimeout(() => setFlashMessage(null), 2000);

//       // If round is over, clear the word immediately
//       if (isRoundOver) {
//         setCurrentWord('');
//       }
//     });

//     socket.on('newMessage', (msg) => {
//       setMessages(prev => [...prev, msg]);
//     });

//     socket.on('roundEnded', ({ users, currentRound }) => {
//       setGameState('waiting');
//       setCurrentWord('');
//       setIsDrawingTurn(false);
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} ended!`
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

//     // Drawing events
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
//       socket.off('roomState');
//       socket.off('gameStarted');
//       socket.off('turnStarted');
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

//   const handleStartGame = (rounds = 3) => {
//     socket.emit('startGame', roomId, rounds);
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
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     if (isDrawingTurn) {
//       socket.emit('clear', roomId);
//     }
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Flash Message */}
//       {flashMessage && <FlashMessage message={flashMessage} />}

//       {/* Word Selection Overlay */}
//       {gameState === 'wordSelection' && isDrawingTurn && (
//         <WordSelection onWordSelect={handleWordSelect} />
//       )}

//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         currentDrawer={currentDrawer}
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
//       {isDrawingTurn && gameState === 'drawing' && (
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

//       {/* Current Drawer Display */}
//       <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         Current drawer: {currentDrawer?.username || 'None'}
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

// // WordSelection component
// const WordSelection = ({ onWordSelect }) => {
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
//       <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
//         <h3 className="text-xl font-bold mb-4 text-center">Select Word Difficulty</h3>
//         <div className="flex flex-col space-y-3">
//           <button 
//             onClick={() => onWordSelect('easy')}
//             className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Easy
//           </button>
//           <button 
//             onClick={() => onWordSelect('medium')}
//             className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Medium
//           </button>
//           <button 
//             onClick={() => onWordSelect('hard')}
//             className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Hard
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// // FlashMessage component
// const FlashMessage = ({ message, duration = 2000 }) => {
//   const [visible, setVisible] = useState(true);

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setVisible(false);
//     }, duration);

//     return () => clearTimeout(timer);
//   }, [duration]);

//   if (!visible) return null;

//   return (
//     <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
//       <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse text-xl font-bold">
//         {message}
//       </div>
//     </div>
//   );
// };

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
//   const [maxRounds, setMaxRounds] = useState(3);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);
//   const [currentDrawer, setCurrentDrawer] = useState(null);
//   const [flashMessage, setFlashMessage] = useState(null);

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

//     socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft, maxRounds }) => {
//       setUsers(users);
//       setGameState(gameState);
//       setCurrentRound(currentRound);
//       setCurrentWord(currentWord || '');
//       setCurrentDrawer(currentDrawer);
//       setTimeLeft(timeLeft || 0);
//       setIsDrawingTurn(socket.id === currentDrawer?.id);
//       setScore(users[socket.id]?.score || 0);
//       setMaxRounds(maxRounds || 3);
      
//       // Clear canvas if it's our turn to draw
//       if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
//         clearCanvas();
//       }
//     });
    

//     socket.on('gameStarted', ({ currentRound, currentDrawerIndex, maxRounds }) => {
//       setCurrentRound(currentRound);
//       setMaxRounds(maxRounds);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} of ${maxRounds} started!`
//       }]);
//     });

//     socket.on('turnStarted', ({ drawerId, drawerName }) => {
//       setCurrentDrawer({ id: drawerId, username: drawerName });
//       setGameState('wordSelection');
//       setCurrentWord('');
//       setIsDrawingTurn(socket.id === drawerId);
//       setHasGuessed(false);
      
//       // Clear canvas when turn starts
//       clearCanvas();
      
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${drawerName}'s turn to draw!`
//       }]);
//     });

//     socket.on('yourTurn', () => {
//       setIsDrawingTurn(true);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: "It's your turn to draw! Select a word difficulty."
//       }]);
//       clearCanvas();
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
//     });

//     socket.on('timerUpdate', (seconds) => {
//       setTimeLeft(seconds);
//     });

//     socket.on('correctGuess', ({ username, points, users, isRoundOver }) => {
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} guessed correctly! +${points} points`
//       }]);
      
//       // Show flash message for correct guess
//       setFlashMessage(`${username} guessed the word!`);
//       setTimeout(() => setFlashMessage(null), 2000);

//       // If round is over, clear the word immediately
//       if (isRoundOver) {
//         setCurrentWord('');
//       }
//     });

//     socket.on('newMessage', (msg) => {
//       setMessages(prev => [...prev, msg]);
//     });

//     socket.on('roundEnded', ({ users, currentRound }) => {
//       setGameState('waiting');
//       setCurrentWord('');
//       setIsDrawingTurn(false);
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} ended!`
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

//     // Drawing events
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
//       socket.off('roomState');
//       socket.off('gameStarted');
//       socket.off('turnStarted');
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

//   const handleStartGame = (rounds = 3) => {
//     socket.emit('startGame', roomId, rounds);
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
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     if (isDrawingTurn) {
//       socket.emit('clear', roomId);
//     }
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Flash Message */}
//       {flashMessage && <FlashMessage message={flashMessage} />}

//       {/* Word Selection Overlay */}
//       {gameState === 'wordSelection' && isDrawingTurn && (
//         <WordSelection onWordSelect={handleWordSelect} />
//       )}

//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         currentDrawer={currentDrawer}
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
//       {isDrawingTurn && gameState === 'drawing' && (
//         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
//             }`}
//             onClick={() => setTool('pencil')}
//           >
//             Easy
//           </button>
//           <button 
//             onClick={() => onWordSelect('medium')}
//             className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Medium
//           </button>
//           <button 
//             onClick={() => onWordSelect('hard')}
//             className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Hard
//           </button>
//         </div>
//       )}

//       {/* Current Drawer Display */}
//       <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         Current drawer: {currentDrawer?.username || 'None'}
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

// // WordSelection component
// const WordSelection = ({ onWordSelect }) => {
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
//       <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
//         <h3 className="text-xl font-bold mb-4 text-center">Select Word Difficulty</h3>
//         <div className="flex flex-col space-y-3">
//           <button 
//             onClick={() => onWordSelect('easy')}
//             className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Easy
//           </button>
//           <button 
//             onClick={() => onWordSelect('medium')}
//             className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Medium
//           </button>
//           <button 
//             onClick={() => onWordSelect('hard')}
//             className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Hard
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// // RoundSelection component
// const RoundSelection = ({ onRoundSelect }) => {
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
//       <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
//         <h3 className="text-xl font-bold mb-4 text-center">Select Number of Rounds</h3>
//         <div className="flex flex-col space-y-3">
//           {[1, 2, 3, 4, 5].map(rounds => (
//             <button 
//               key={rounds}
//               onClick={() => onRoundSelect(rounds)}
//               className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg transition text-lg"
//             >
//               {rounds} {rounds === 1 ? 'Round' : 'Rounds'}
//             </button>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };

// // FlashMessage component
// const FlashMessage = ({ message, duration = 2000 }) => {
//   const [visible, setVisible] = useState(true);

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setVisible(false);
//     }, duration);

//     return () => clearTimeout(timer);
//   }, [duration]);

//   if (!visible) return null;

//   return (
//     <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
//       <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse text-xl font-bold">
//         {message}
//       </div>
//     </div>
//   );
// };

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
//   const [maxRounds, setMaxRounds] = useState(3); // Now mutable
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [hasGuessed, setHasGuessed] = useState(false);
//   const [score, setScore] = useState(0);
//   const [currentDrawer, setCurrentDrawer] = useState(null);
//   const [flashMessage, setFlashMessage] = useState(null);
//   const [showRoundSelection, setShowRoundSelection] = useState(false);

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

//     socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft, maxRounds }) => {
//       setUsers(users);
//       setGameState(gameState);
//       setCurrentRound(currentRound);
//       setCurrentWord(currentWord || '');
//       setCurrentDrawer(currentDrawer);
//       setTimeLeft(timeLeft || 0);
//       setIsDrawingTurn(socket.id === currentDrawer?.id);
//       setScore(users[socket.id]?.score || 0);
//       setMaxRounds(maxRounds || 3);
      
//       // Clear canvas if it's our turn to draw
//       if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
//         clearCanvas();
//       }
//     });

//     socket.on('gameStarted', ({ currentRound, currentDrawerIndex, maxRounds }) => {
//       setCurrentRound(currentRound);
//       setMaxRounds(maxRounds);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} of ${maxRounds} started!`
//       }]);
//     });

//     socket.on('turnStarted', ({ drawerId, drawerName }) => {
//       setCurrentDrawer({ id: drawerId, username: drawerName });
//       setGameState('wordSelection');
//       setCurrentWord('');
//       setIsDrawingTurn(socket.id === drawerId);
//       setHasGuessed(false);
      
//       // Clear canvas when turn starts
//       clearCanvas();
      
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${drawerName}'s turn to draw!`
//       }]);
//     });

//     socket.on('yourTurn', () => {
//       setIsDrawingTurn(true);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: "It's your turn to draw! Select a word difficulty."
//       }]);
//       clearCanvas();
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
//     });

//     socket.on('timerUpdate', (seconds) => {
//       setTimeLeft(seconds);
//     });

//     socket.on('correctGuess', ({ username, points, users, isRoundOver }) => {
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} guessed correctly! +${points} points`
//       }]);
      
//       // Show flash message for correct guess
//       setFlashMessage(`${username} guessed the word!`);
//       setTimeout(() => setFlashMessage(null), 2000);

//       // If round is over, clear the word immediately
//       if (isRoundOver) {
//         setCurrentWord('');
//       }
//     });

//     socket.on('newMessage', (msg) => {
//       setMessages(prev => [...prev, msg]);
//     });

//     socket.on('roundEnded', ({ users, currentRound }) => {
//       setGameState('waiting');
//       setCurrentWord('');
//       setIsDrawingTurn(false);
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} ended!`
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

//     // Drawing events
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
//       socket.off('roomState');
//       socket.off('gameStarted');
//       socket.off('turnStarted');
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
//     if (isCreator) {
//       setShowRoundSelection(true);
//     } else {
//       socket.emit('startGame', roomId);
//     }
//   };

//   const handleRoundSelect = (rounds) => {
//     setShowRoundSelection(false);
//     setMaxRounds(rounds);
//     socket.emit('startGame', roomId, rounds);
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
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     if (isDrawingTurn) {
//       socket.emit('clear', roomId);
//     }
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Flash Message */}
//       {flashMessage && <FlashMessage message={flashMessage} />}

//       {/* Round Selection Overlay */}
//       {showRoundSelection && (
//         <RoundSelection onRoundSelect={handleRoundSelect} />
//       )}

//       {/* Word Selection Overlay */}
//       {gameState === 'wordSelection' && isDrawingTurn && (
//         <WordSelection onWordSelect={handleWordSelect} />
//       )}

//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         currentDrawer={currentDrawer}
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
//       {isDrawingTurn && gameState === 'drawing' && (
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

//       {/* Current Drawer Display */}
//       <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         Current drawer: {currentDrawer?.username || 'None'}
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

// // WordSelection component
// const WordSelection = ({ onWordSelect }) => {
//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
//       <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
//         <h3 className="text-xl font-bold mb-4 text-center">Select Word Difficulty</h3>
//         <div className="flex flex-col space-y-3">
//           <button 
//             onClick={() => onWordSelect('easy')}
//             className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Easy
//           </button>
//           <button 
//             onClick={() => onWordSelect('medium')}
//             className="bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Medium
//           </button>
//           <button 
//             onClick={() => onWordSelect('hard')}
//             className="bg-red-500 hover:bg-red-600 text-white py-3 px-6 rounded-lg transition text-lg"
//           >
//             Hard
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// // FlashMessage component
// const FlashMessage = ({ message, duration = 2000 }) => {
//   const [visible, setVisible] = useState(true);

//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setVisible(false);
//     }, duration);

//     return () => clearTimeout(timer);
//   }, [duration]);

//   if (!visible) return null;

//   return (
//     <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
//       <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse text-xl font-bold">
//         {message}
//       </div>
//     </div>
//   );
// };

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
//   const [currentDrawer, setCurrentDrawer] = useState(null);
//   const [flashMessage, setFlashMessage] = useState(null);

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
//         message: `${drawerName}'s turn to draw!`
//       }]);
//     });

//     socket.on('userLeft', ({ users, username }) => {
//       setUsers(users);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} left the game`
//       }]);
//     });

//     socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft }) => {
//       setUsers(users);
//       setGameState(gameState);
//       setCurrentRound(currentRound);
//       setCurrentWord(currentWord || '');
//       setCurrentDrawer(currentDrawer);
//       setTimeLeft(timeLeft || 0);
//       setIsDrawingTurn(socket.id === currentDrawer?.id);
//       setScore(users[socket.id]?.score || 0);
      
//       // Clear canvas if it's our turn to draw
//       if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
//         clearCanvas();
//       }
//     });

//     socket.on('gameStarted', ({ currentRound, currentDrawerIndex }) => {
//       setCurrentRound(currentRound);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} started!`
//       }]);
//     });

//     socket.on('turnStarted', ({ drawerId, drawerName }) => {
//       setCurrentDrawer({ id: drawerId, username: drawerName });
//       setGameState('wordSelection');
//       setCurrentWord('');
//       setIsDrawingTurn(socket.id === drawerId);
//       setHasGuessed(false);
      
//       // Clear canvas when turn starts
//       clearCanvas();
      
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${drawerName}'s turn to draw!`
//       }]);
//     });

//     socket.on('yourTurn', () => {
//       setIsDrawingTurn(true);
//       setGameState('wordSelection');
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: "It's your turn to draw! Select a word difficulty."
//       }]);
//       clearCanvas();
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       setCurrentWord(word);
//       setGameState('drawing');
//       setIsDrawingTurn(socket.id === drawerId);
//       setTimeLeft(timeLeft);
//       setHasGuessed(false);
//     });

//     socket.on('timerUpdate', (seconds) => {
//       setTimeLeft(seconds);
//     });

//     socket.on('correctGuess', ({ username, points, users }) => {
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `${username} guessed correctly! +${points} points`
//       }]);
      
//       // Show flash message for correct guess
//       setFlashMessage(`${username} guessed the word!`);
//       setTimeout(() => setFlashMessage(null), 2000);
//     });

//     socket.on('newMessage', (msg) => {
//       setMessages(prev => [...prev, msg]);
//     });

//     socket.on('roundEnded', ({ users, currentRound }) => {
//       setGameState('waiting');
//       setCurrentWord('');
//       setIsDrawingTurn(false);
//       setUsers(users);
//       setScore(users[socket.id]?.score || 0);
//       setMessages(prev => [...prev, {
//         isSystem: true,
//         message: `Round ${currentRound} ended!`
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

//     // Drawing events
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
//       socket.off('roomState');
//       socket.off('gameStarted');
//       socket.off('turnStarted');
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
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     context.clearRect(0, 0, canvas.width, canvas.height);
//     if (isDrawingTurn) {
//       socket.emit('clear', roomId);
//     }
//   };

//   return (
//     <div className="relative h-screen bg-gray-100 overflow-hidden">
//       {/* Flash Message */}
//       {flashMessage && <FlashMessage message={flashMessage} />}

//       {/* Word Selection Overlay */}
//       {gameState === 'wordSelection' && isDrawingTurn && (
//         <WordSelection onWordSelect={handleWordSelect} />
//       )}

//       {/* Game Controls */}
//       <GameControls
//         isCreator={isCreator}
//         gameState={gameState}
//         users={users}
//         currentRound={currentRound}
//         maxRounds={maxRounds}
//         timeLeft={timeLeft}
//         currentDrawer={currentDrawer}
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
//       {isDrawingTurn && gameState === 'drawing' && (
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

//       {/* Current Drawer Display */}
//       <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
//         Current drawer: {currentDrawer?.username || 'None'}
//       </div>
//     </div>
//   );
// };

// export default Canvas;
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
