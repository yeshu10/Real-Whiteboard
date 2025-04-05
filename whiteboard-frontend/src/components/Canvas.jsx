import React, { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import {
  setGameState,
  setCurrentWord,
  setIsDrawingTurn,
  setUsers,
  setCurrentRound,
  setMaxRounds,
  setTimeLeft,
  setHasGuessed,
  setScore,
  setCurrentDrawer,
  setFlashMessage,
} from '../features/game/gameSlice'; 
import { addMessage } from '../features/chat/chatSlice';
import {
  setIsDrawing,
  setTool,
  setPointerSize,
  setSelectedColor,
  setLastPos
} from '../features/canvas/canvasSlice';
import GameControls from './GameControls';
import ChatBox from './ChatBox';
import WordSelection from './WordSelection';
import FlashMessage from './FlashMessage';

const socket = io('http://localhost:5000');

const Canvas = () => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const dispatch = useDispatch();
  
  // Select state from Redux store
  const gameState = useSelector(state => state.game.gameState);
  const currentWord = useSelector(state => state.game.currentWord);
  const isDrawingTurn = useSelector(state => state.game.isDrawingTurn);
  const users = useSelector(state => state.game.users);
  const currentRound = useSelector(state => state.game.currentRound);
  const maxRounds = useSelector(state => state.game.maxRounds);
  const timeLeft = useSelector(state => state.game.timeLeft);
  const hasGuessed = useSelector(state => state.game.hasGuessed);
  const score = useSelector(state => state.game.score);
  const currentDrawer = useSelector(state => state.game.currentDrawer);
  const flashMessage = useSelector(state => state.game.flashMessage);
  const messages = useSelector(state => state.game.messages);

  // Canvas specific state
  const isDrawing = useSelector(state => state.canvas.isDrawing);
  const tool = useSelector(state => state.canvas.tool);
  const pointerSize = useSelector(state => state.canvas.pointerSize);
  const selectedColor = useSelector(state => state.canvas.selectedColor);
  const lastPos = useSelector(state => state.canvas.lastPos);

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
    context.strokeStyle = selectedColor || 'black';
    context.lineWidth = pointerSize || 5;
    contextRef.current = context;

    // Join room
    socket.emit('joinRoom', roomId, username);

    // Game event listeners
    socket.on('userJoined', ({ users }) => {
      dispatch(setUsers(users));
      dispatch(addMessage({
        isSystem: true,
        message: `${users[socket.id]?.username} joined the game`
      }));
    });

    socket.on('userLeft', ({ users, username }) => {
      dispatch(setUsers(users));
      dispatch(addMessage({
        isSystem: true,
        message: `${username} left the game`
      }));
    });

    socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft, maxRounds }) => {
      dispatch(setUsers(users));
      dispatch(setGameState(gameState));
      dispatch(setCurrentRound(currentRound));
      dispatch(setCurrentWord(currentWord || ''));
      dispatch(setCurrentDrawer(currentDrawer));
      dispatch(setTimeLeft(timeLeft || 0));
      dispatch(setIsDrawingTurn(socket.id === currentDrawer?.id));
      dispatch(setScore(users[socket.id]?.score || 0));
      dispatch(setMaxRounds(maxRounds || 3));
      
      if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
        clearCanvas();
      }
    });
    
    socket.on('gameStarted', ({ currentRound, currentDrawer, maxRounds }) => {
      dispatch(setCurrentRound(currentRound));
      dispatch(setMaxRounds(maxRounds));
      dispatch(setCurrentDrawer(currentDrawer));
      dispatch(setGameState('wordSelection'));
      dispatch(setIsDrawingTurn(socket.id === currentDrawer?.id));
      dispatch(addMessage({
        isSystem: true,
        message: `Round ${currentRound} of ${maxRounds} started!`
      }));
      
      if (socket.id === currentDrawer?.id) {
        clearCanvas();
      }
    });

    socket.on('turnStarted', ({ drawerId, drawerName }) => {
      dispatch(setCurrentDrawer({ id: drawerId, username: drawerName }));
      dispatch(setGameState('wordSelection'));
      dispatch(setCurrentWord(''));
      dispatch(setIsDrawingTurn(socket.id === drawerId));
      dispatch(setHasGuessed(false));
      
      clearCanvas();
      
      dispatch(addMessage({
        isSystem: true,
        message: `${drawerName}'s turn to draw!`
      }));
    });

    socket.on('yourTurn', () => {
      dispatch(setIsDrawingTurn(true));
      dispatch(setGameState('wordSelection'));
      dispatch(addMessage({
        isSystem: true,
        message: "It's your turn to draw! Select a word difficulty."
      }));
      clearCanvas();
    });

    socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
      dispatch(setCurrentWord(word));
      dispatch(setGameState('drawing'));
      dispatch(setIsDrawingTurn(socket.id === drawerId));
      dispatch(setTimeLeft(timeLeft));
      dispatch(setHasGuessed(false));
    });

    socket.on('timerUpdate', (seconds) => {
      dispatch(setTimeLeft(seconds));
    });

    socket.on('correctGuess', ({ username, points, users, isRoundOver }) => {
      dispatch(setUsers(users));
      dispatch(setScore(users[socket.id]?.score || 0));
      dispatch(addMessage({
        isSystem: true,
        message: `${username} guessed correctly! +${points} points`
      }));
      
      dispatch(setFlashMessage(`${username} guessed the word!`));
      setTimeout(() => dispatch(setFlashMessage(null)), 2000);

      if (isRoundOver) {
        dispatch(setCurrentWord(''));
      }
    });

    socket.on('newMessage', (msg) => {
      dispatch(addMessage(msg));
    });

    socket.on('roundEnded', ({ users, currentRound }) => {
      dispatch(setGameState('waiting'));
      dispatch(setCurrentWord(''));
      dispatch(setIsDrawingTurn(false));
      dispatch(setUsers(users));
      dispatch(setScore(users[socket.id]?.score || 0));
      dispatch(addMessage({
        isSystem: true,
        message: `Round ${currentRound} ended!`
      }));
    });

    socket.on('gameEnded', (users) => {
      dispatch(setGameState('ended'));
      dispatch(setUsers(users));
      dispatch(setScore(users[socket.id]?.score || 0));
      dispatch(addMessage({
        isSystem: true,
        message: 'Game ended! Final scores: ' + 
          Object.values(users).map(u => `${u.username}: ${u.score}`).join(', ')
      }));
    });

    // Drawing events
    socket.on('draw', (data) => {
      console.log("Received draw event:", data);
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
  }, [dispatch, roomId, username]);

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (!isDrawingTurn) return;
    
    const { x, y } = getCanvasCoordinates(e);
    dispatch(setIsDrawing(true));
    dispatch(setLastPos({ x, y }));
    
    const context = contextRef.current;
    context.strokeStyle = selectedColor || 'black';
    context.lineWidth = pointerSize || 5;
    context.beginPath();
    context.moveTo(x, y);
    context.stroke();
  };

  const draw = (e) => {
    if (!isDrawing || !isDrawingTurn) return;

    const { x, y } = getCanvasCoordinates(e);
    const context = contextRef.current;

    if (tool === 'pencil') {
      context.strokeStyle = selectedColor || 'black';
      context.lineWidth = pointerSize || 5;
      context.beginPath();
      context.moveTo(lastPos.x, lastPos.y);
      context.lineTo(x, y);
      context.stroke();

      socket.emit('draw', {
        prevX: lastPos.x,
        prevY: lastPos.y,
        x: x,
        y: y,
        size: pointerSize || 5,
        color: selectedColor || 'black',
        roomId
      });

      dispatch(setLastPos({ x, y }));
    } else if (tool === 'erase') {
      context.clearRect(
        x - (pointerSize || 5) / 2,
        y - (pointerSize || 5) / 2,
        pointerSize || 5,
        pointerSize || 5
      );
    }
  };

  const finishDrawing = () => {
    dispatch(setIsDrawing(false));
    dispatch(setLastPos(null));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (isDrawingTurn) {
      socket.emit('clear', roomId);
    }
  };

  const handleStartGame = (rounds = 3) => {
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
      dispatch(setHasGuessed(true));
    }
  };

  return (
    <div className="relative h-screen bg-gray-100 overflow-hidden">
      {flashMessage && <FlashMessage message={flashMessage} />}

      {gameState === 'wordSelection' && isDrawingTurn && (
        <WordSelection onWordSelect={handleWordSelect} />
      )}

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

      <div className="flex h-[calc(100%-60px)] mt-[60px]">
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
              onMouseLeave={finishDrawing}
              className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
              style={{ 
                cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
                opacity: isDrawingTurn ? 1 : 0.9
              }}
            />
          </div>
        </div>

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

      {isDrawingTurn && gameState === 'drawing' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
          <button
            className={`px-3 py-1 rounded ${
              tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
            }`}
            onClick={() => dispatch(setTool('pencil'))}
          >
            ✏️ Pencil
          </button>
          <button
            className={`px-3 py-1 rounded ${
              tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}
            onClick={() => dispatch(setTool('erase'))}
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
              value={pointerSize || 5}
              onChange={(e) => dispatch(setPointerSize(Number(e.target.value)))}
              className="w-20"
            />
          </div>
          <div className="flex items-center space-x-1">
            {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => dispatch(setSelectedColor(color))}
              />
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
        Current drawer: {currentDrawer?.username || 'None'}
      </div>
    </div>
  );
};

export default Canvas;
// import React, { useRef, useEffect } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { io } from 'socket.io-client';
// import { useSelector, useDispatch } from 'react-redux';
// import {
//   setGameState,
//   setCurrentWord,
//   setIsDrawingTurn,
//   setUsers,
//   setCurrentRound,
//   setMaxRounds,
//   setTimeLeft,
//   setHasGuessed,
//   setScore,
//   setCurrentDrawer,
//   setFlashMessage,
// } from '../features/game/gameSlice'; 
// import {addMessage} from '../features/chat/chatSlice';

// import {  setIsDrawing,
//   setTool,
//   setPointerSize,
//   setSelectedColor,
//   setLastPos} from '../features/canvas/canvasSlice';
// import GameControls from './GameControls';
// import ChatBox from './ChatBox';
// import WordSelection from './WordSelection';
// import FlashMessage from './FlashMessage';

// const socket = io('http://localhost:5000');

// const Canvas = () => {
//   const canvasRef = useRef(null);
//   const contextRef = useRef(null);
//   const dispatch = useDispatch();
  
//   // Select state from Redux store
//   const {
//     isDrawing,
//     tool,
//     pointerSize,
//     selectedColor,
//     lastPos,
//     gameState,
//     currentWord,
//     isDrawingTurn,
//     users,
//     currentRound,
//     maxRounds,
//     timeLeft,
//     hasGuessed,
//     score,
//     currentDrawer,
//     flashMessage,
//     messages
//   } = useSelector(state => state.game);

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
//       dispatch(setUsers(users));
//       dispatch(addMessage({
//         isSystem: true,
//         message: `${users[socket.id]?.username} joined the game`
//       }));
//     });

//     socket.on('userLeft', ({ users, username }) => {
//       dispatch(setUsers(users));
//       dispatch(addMessage({
//         isSystem: true,
//         message: `${username} left the game`
//       }));
//     });

//     socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft, maxRounds }) => {
//       dispatch(setUsers(users));
//       dispatch(setGameState(gameState));
//       dispatch(setCurrentRound(currentRound));
//       dispatch(setCurrentWord(currentWord || ''));
//       dispatch(setCurrentDrawer(currentDrawer));
//       dispatch(setTimeLeft(timeLeft || 0));
//       dispatch(setIsDrawingTurn(socket.id === currentDrawer?.id));
//       dispatch(setScore(users[socket.id]?.score || 0));
//       dispatch(setMaxRounds(maxRounds || 3));
      
//       if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
//         clearCanvas();
//       }
//     });
    
//     socket.on('gameStarted', ({ currentRound, currentDrawer, maxRounds }) => {
//       dispatch(setCurrentRound(currentRound));
//       dispatch(setMaxRounds(maxRounds));
//       dispatch(setCurrentDrawer(currentDrawer));
//       dispatch(setGameState('wordSelection'));
//       dispatch(setIsDrawingTurn(socket.id === currentDrawer?.id));
//       dispatch(addMessage({
//         isSystem: true,
//         message: `Round ${currentRound} of ${maxRounds} started!`
//       }));
      
//       if (socket.id === currentDrawer?.id) {
//         clearCanvas();
//       }
//     });

//     socket.on('turnStarted', ({ drawerId, drawerName }) => {
//       dispatch(setCurrentDrawer({ id: drawerId, username: drawerName }));
//       dispatch(setGameState('wordSelection'));
//       dispatch(setCurrentWord(''));
//       dispatch(setIsDrawingTurn(socket.id === drawerId));
//       dispatch(setHasGuessed(false));
      
//       clearCanvas();
      
//       dispatch(addMessage({
//         isSystem: true,
//         message: `${drawerName}'s turn to draw!`
//       }));
//     });

//     socket.on('yourTurn', () => {
//       dispatch(setIsDrawingTurn(true));
//       dispatch(setGameState('wordSelection'));
//       dispatch(addMessage({
//         isSystem: true,
//         message: "It's your turn to draw! Select a word difficulty."
//       }));
//       clearCanvas();
//     });

//     socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
//       dispatch(setCurrentWord(word));
//       dispatch(setGameState('drawing'));
//       dispatch(setIsDrawingTurn(socket.id === drawerId));
//       dispatch(setTimeLeft(timeLeft));
//       dispatch(setHasGuessed(false));
//     });

//     socket.on('timerUpdate', (seconds) => {
//       dispatch(setTimeLeft(seconds));
//     });

//     socket.on('correctGuess', ({ username, points, users, isRoundOver }) => {
//       dispatch(setUsers(users));
//       dispatch(setScore(users[socket.id]?.score || 0));
//       dispatch(addMessage({
//         isSystem: true,
//         message: `${username} guessed correctly! +${points} points`
//       }));
      
//       dispatch(setFlashMessage(`${username} guessed the word!`));
//       setTimeout(() => dispatch(setFlashMessage(null)), 2000);

//       if (isRoundOver) {
//         dispatch(setCurrentWord(''));
//       }
//     });

//     socket.on('newMessage', (msg) => {
//       dispatch(addMessage(msg));
//     });

//     socket.on('roundEnded', ({ users, currentRound }) => {
//       dispatch(setGameState('waiting'));
//       dispatch(setCurrentWord(''));
//       dispatch(setIsDrawingTurn(false));
//       dispatch(setUsers(users));
//       dispatch(setScore(users[socket.id]?.score || 0));
//       dispatch(addMessage({
//         isSystem: true,
//         message: `Round ${currentRound} ended!`
//       }));
//     });

//     socket.on('gameEnded', (users) => {
//       dispatch(setGameState('ended'));
//       dispatch(setUsers(users));
//       dispatch(setScore(users[socket.id]?.score || 0));
//       dispatch(addMessage({
//         isSystem: true,
//         message: 'Game ended! Final scores: ' + 
//           Object.values(users).map(u => `${u.username}: ${u.score}`).join(', ')
//       }));
//     });

//     // Drawing events
//     socket.on('draw', (data) => {
//       console.log("Received draw event:", data);
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
//   }, [dispatch, roomId, username]);

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
//       dispatch(setHasGuessed(true));
//     }
//   };

//   // const startDrawing = (e) => {
//   //   if (!isDrawingTurn) return;
    
//   //   const { offsetX, offsetY } = e.nativeEvent;
//   //   dispatch(setLastPos({ x: offsetX, y: offsetY }));
//   //   dispatch(setIsDrawing(true));
//   // };

//   // const finishDrawing = () => {
//   //   dispatch(setIsDrawing(false));
//   //   dispatch(setLastPos(null));
//   // };

//   // const draw = (e) => {
//   //   if (!isDrawing || !isDrawingTurn) return;

//   //   const { offsetX, offsetY } = e.nativeEvent;
//   //   const context = contextRef.current;

//   //   if (tool === 'pencil') {
//   //     context.lineWidth = pointerSize;
//   //     context.strokeStyle = selectedColor;
//   //     context.beginPath();
//   //     context.moveTo(lastPos.x, lastPos.y);
//   //     context.lineTo(offsetX, offsetY);
//   //     context.stroke();

//   //     socket.emit('draw', {
//   //       prevX: lastPos.x,
//   //       prevY: lastPos.y,
//   //       x: offsetX,
//   //       y: offsetY,
//   //       size: pointerSize,
//   //       color: selectedColor,
//   //       roomId
//   //     });

//   //     dispatch(setLastPos({ x: offsetX, y: offsetY }));
//   //   } else if (tool === 'erase') {
//   //     context.clearRect(
//   //       offsetX - pointerSize / 2,
//   //       offsetY - pointerSize / 2,
//   //       pointerSize,
//   //       pointerSize
//   //     );
//   //   }
//   // };

//   const startDrawing = (e) => {
//     if (!isDrawingTurn) {
//       console.log("Cannot draw - not your turn");
//       return;
//     }
    
//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;
    
//     console.log("Start drawing at:", offsetX, offsetY);
//     console.log("Current tool:", tool, "Color:", selectedColor, "Size:", pointerSize);
    
//     dispatch(setIsDrawing(true));
//     dispatch(setLastPos({ x: offsetX, y: offsetY }));
    
//     context.beginPath();
//     context.moveTo(offsetX, offsetY);
//     context.stroke();
//   };
  
//   const draw = (e) => {
//     if (!isDrawing) {
//       console.log("Not drawing - isDrawing state is false");
//       return;
//     }
//     if (!isDrawingTurn) {
//       console.log("Cannot draw - not your turn");
//       return;
//     }
//     if (!lastPos) {
//       console.log("No last position set");
//       return;
//     }
  
//     const { offsetX, offsetY } = e.nativeEvent;
//     const context = contextRef.current;
  
//     console.log("Drawing from", lastPos, "to", {x: offsetX, y: offsetY});
  
//     if (tool === 'pencil') {
//       context.lineWidth = pointerSize;
//       context.strokeStyle = selectedColor;
//       context.lineCap = 'round';
//       context.lineJoin = 'round';
      
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
  
//       dispatch(setLastPos({ x: offsetX, y: offsetY }));
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
//     dispatch(setIsDrawing(false));
//     dispatch(setLastPos(null));
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
//       {flashMessage && <FlashMessage message={flashMessage} />}

//       {gameState === 'wordSelection' && isDrawingTurn && (
//         <WordSelection onWordSelect={handleWordSelect} />
//       )}

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

//       <div className="flex h-[calc(100%-60px)] mt-[60px]">
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
//               onMouseLeave={finishDrawing} // Add this to handle mouse leaving canvas
//               className="bg-white border-2 border-gray-300 shadow-lg w-full h-full"
//               style={{ 
//                 cursor: isDrawingTurn ? 'crosshair' : 'not-allowed',
//                 opacity: isDrawingTurn ? 1 : 0.9
//               }}
//             />
//           </div>
//         </div>

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

//       {isDrawingTurn && gameState === 'drawing' && (
//         <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-3 rounded-lg shadow-md flex space-x-4 z-10">
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'pencil' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
//             }`}
//             onClick={() => {
//               console.log("Setting tool to pencil");
//               dispatch(setTool('pencil'));
//             }}
//           >
//             ✏️ Pencil
//           </button>
//           <button
//             className={`px-3 py-1 rounded ${
//               tool === 'erase' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-800'
//             }`}
//             onClick={() => dispatch(setTool('erase'))}
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
//               onChange={(e) => dispatch(setPointerSize(Number(e.target.value)))}
//               className="w-20"
//             />
//           </div>
//           <div className="flex items-center space-x-1">
//             {['black', 'red', 'blue', 'green', 'yellow'].map((color) => (
//               <button
//                 key={color}
//                 className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
//                 style={{ backgroundColor: color }}
//                 onClick={() => dispatch(setSelectedColor(color))}
//               />
//             ))}
//           </div>
//         </div>
//       )}

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
