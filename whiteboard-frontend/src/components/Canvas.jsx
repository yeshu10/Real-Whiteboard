import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectUsername, selectRoomId, selectIsCreator, selectScore, selectHasGuessed,
  setUserInfo, setScore, setHasGuessed
} from '../features/user/userSlice';
import {
  selectGameState, selectCurrentWord, selectIsDrawingTurn,
  selectMessages, selectUsers, selectCurrentRound,
  selectTimeLeft, selectCurrentDrawer, selectMaxRounds,
  setGameState, setCurrentWord, setIsDrawingTurn,
  addMessage, setUsers, setCurrentRound,setMaxRounds,
  setTimeLeft, setCurrentDrawer
} from '../features/game/gameSlice';
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
  const [flashMessage, setFlashMessage] = useState(null);
  const [showWordSelection, setShowWordSelection] = useState(false);

  // Redux state
  const dispatch = useDispatch();
  const username = useSelector(selectUsername);
  const roomId = useSelector(selectRoomId);
  const isCreator = useSelector(selectIsCreator);
  const score = useSelector(selectScore);
  const hasGuessed = useSelector(selectHasGuessed);
  const gameState = useSelector(selectGameState);
  const currentWord = useSelector(selectCurrentWord);
  const isDrawingTurn = useSelector(selectIsDrawingTurn);
  const messages = useSelector(selectMessages);
  const users = useSelector(selectUsers);
  const currentRound = useSelector(selectCurrentRound);
  const maxRounds = useSelector(selectMaxRounds);
  const timeLeft = useSelector(selectTimeLeft);
  const currentDrawer = useSelector(selectCurrentDrawer);

  // Get room info from URL
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const urlUsername = queryParams.get('username');
  const urlRoomId = queryParams.get('join') || queryParams.get('roomId'); 
  const urlIsCreator = !location.search.includes('join');

  // Initialize user info
  useEffect(() => {
    dispatch(setUserInfo({
      username: urlUsername,
      roomId: urlRoomId,
      isCreator: urlIsCreator
    }));
  }, [dispatch, urlUsername, urlRoomId, urlIsCreator]);

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
      dispatch(setUsers(users));
      // Only dispatch if we have a valid username
      if (newUser?.username) {
        dispatch(addMessage({
          isSystem: true,
          username: newUser.username, // Ensure username is passed
          message: `${newUser.username} joined the game!`
        }));
      }
    });
    
    socket.on('userLeft', ({ users, username }) => {
      console.log('User left:', username);
      dispatch(setUsers(users));
      dispatch(addMessage({
        isSystem: true,
        message: `${username} left the game`
      }));
    });

    socket.on('roomState', ({ users, gameState, currentRound, currentWord, currentDrawer, timeLeft, maxRounds }) => {
      console.log('Received room state:', {
        gameState,
        currentRound,
        maxRounds,
        currentDrawer: currentDrawer?.username,
        timeLeft
      });
      dispatch(setUsers(users));
      dispatch(setGameState(gameState));
      dispatch(setCurrentRound(currentRound));
      dispatch(setMaxRounds(maxRounds));
      dispatch(setCurrentWord(currentWord || ''));
      dispatch(setCurrentDrawer(currentDrawer));
      dispatch(setTimeLeft(timeLeft || 0));
      dispatch(setIsDrawingTurn(socket.id === currentDrawer?.id));
      dispatch(setScore(users[socket.id]?.score || 0));
      
      if (socket.id === currentDrawer?.id && gameState === 'wordSelection') {
        clearCanvas();
      }
    });
    
    socket.on('gameStarted', ({ currentRound, currentDrawer, maxRounds }) => {
      console.log('Game started - Round:', currentRound, 'of', maxRounds, 'Drawer:', currentDrawer?.username);
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
      console.log('Turn started for:', drawerName);
      dispatch(setCurrentDrawer({ id: drawerId, username: drawerName }));
      dispatch(setGameState('wordSelection'));
      dispatch(setCurrentWord(''));
      dispatch(setIsDrawingTurn(socket.id === drawerId));
      dispatch(setHasGuessed(false));
      
      clearCanvas();

      if (drawerName) {
        dispatch(addMessage({
          isSystem: true,
          username: drawerName, // Explicitly set username
          message: `${drawerName}'s turn to draw!`
        }));
      }
    });
      
    socket.on('yourTurn', () => {
      console.log('Your turn to draw');
      dispatch(setIsDrawingTurn(true));
      dispatch(setGameState('wordSelection'));
      // Use the actual username from Redux
      dispatch(addMessage({
        isSystem: true,
        username: username, // From Redux state
        message: `${username}, it's your turn to draw!`
      }));
      clearCanvas();
    });

    socket.on('wordSelected', ({ word, drawerId, timeLeft }) => {
      console.log('Word selected:', word, 'by drawer:', drawerId === socket.id ? 'you' : 'someone else');
      dispatch(setCurrentWord(word));
      dispatch(setGameState('drawing'));
      dispatch(setIsDrawingTurn(socket.id === drawerId));
      dispatch(setTimeLeft(timeLeft));
      dispatch(setHasGuessed(false));
    });

    socket.on('timerUpdate', (seconds) => {
      console.log('Time left:', seconds);
      dispatch(setTimeLeft(seconds));
    });

    socket.on('correctGuess', ({ username, points, users, isRoundOver }) => {
      console.log('Correct guess by:', username, 'Round over:', isRoundOver);
      dispatch(setUsers(users));
      dispatch(setScore(users[socket.id]?.score || 0));
      dispatch(addMessage({
        isSystem: true,
        message: `${username} guessed correctly! +${points} points`
      }));
      
      setTimeout(() => setFlashMessage(null), 2000);

      if (isRoundOver) {
        dispatch(setCurrentWord(''));
      }
    });

    socket.on('newMessage', (msg) => {
      console.log('New message:', msg);
      dispatch(addMessage(msg));
    });

    socket.on('roundEnded', ({ users, currentRound, maxRounds }) => {
      console.log('Round ended - Current:', currentRound, 'Max:', maxRounds);
      dispatch(setGameState('waiting'));
      dispatch(setCurrentWord(''));
      dispatch(setIsDrawingTurn(false));
      dispatch(setUsers(users));
      dispatch(setCurrentRound(currentRound));
      
      dispatch(addMessage({
        isSystem: true,
        message: `Round ${currentRound-1} completed!`
      }));

      if (currentRound <= maxRounds) {
        setTimeout(() => {
          dispatch(addMessage({
            isSystem: true,
            message: `Starting Round ${currentRound}...`
          }));
        }, 1500);
      }
    });

    socket.on('roundStarted', ({ currentRound, currentDrawer, maxRounds }) => {
      console.log('Round started - Round:', currentRound, 'Drawer:', currentDrawer?.username);
      dispatch(setGameState(currentDrawer?.id === socket.id ? 'wordSelection' : 'waiting'));
      dispatch(setCurrentWord(''));
      dispatch(setCurrentRound(currentRound));
      dispatch(setMaxRounds(maxRounds));
      dispatch(setCurrentDrawer(currentDrawer));
      dispatch(setIsDrawingTurn(currentDrawer?.id === socket.id));
      dispatch(setHasGuessed(false));
      
      if (currentDrawer?.id === socket.id) {
        dispatch(addMessage({
          isSystem: true,
          message: "🎨 Your turn to draw!"
        }));
      } else {
        dispatch(addMessage({
          isSystem: true,
          message: `🖌️ Waiting for ${currentDrawer?.username} to draw...`
        }));
      }
    });

    socket.on('gameEnded', (users) => {
      console.log('Game ended, final scores:', users);
      dispatch(setGameState('ended'));
      dispatch(setUsers(users));
      dispatch(setScore(users[socket.id]?.score || 0));
      dispatch(addMessage({
        isSystem: true,
        message: 'Game ended! Final scores: ' + 
          Object.values(users).map(u => `${u.username}: ${u.score}`).join(', ')
      }));
    });

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
  }, [dispatch, roomId, username]);

  useEffect(() => {
    if (gameState === 'waiting' && currentRound <= maxRounds) {
      console.log(`Ready for round ${currentRound}/${maxRounds}`);
    }
  }, [gameState, currentRound, maxRounds]);

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

  useEffect(() => {
    // Show word selection modal if it's your turn and gameState is 'wordSelection'
    if (isDrawingTurn && gameState === 'wordSelection') {
      setShowWordSelection(true);
    } else {
      setShowWordSelection(false);
    }
  }, [isDrawingTurn, gameState]);

  const handleStartGame = (rounds) => {
    socket.emit('startGame', roomId, rounds);
  };

  const handleWordSelect = (difficulty) => {
    socket.emit('selectWord', { roomId, difficulty });
    setShowWordSelection(false); // Hide modal after selecting
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
    // You can navigate away, reset game, or do nothing here
    // For now, do nothing (modal will stay until game is restarted)
  };

  return (
    <div className="relative h-screen bg-gray-100 overflow-hidden">
      {flashMessage && <FlashMessage message={flashMessage} />}

      {/* Word Selection Overlay */}
      {showWordSelection && (
        <WordSelection onWordSelect={handleWordSelect} />
      )}

      {gameState === 'ended' && (
        <WinnerModal users={users} onClose={closeWinnerModal} />
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

      <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
        Current drawer: {currentDrawer?.username || 'None'}
      </div>
    </div>
  );
};

export default Canvas;