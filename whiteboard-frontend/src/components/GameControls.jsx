import React, { useState, useEffect } from 'react';

const GameControls = ({ 
  isCreator, 
  gameState, 
  users, 
  currentRound, 
  maxRounds,
  timeLeft,
  onStartGame, 
  onWordSelect,
  onEndGame,
  isDrawingTurn
}) => {
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [difficulty, setDifficulty] = useState('easy');

  const handleStart = () => {
    setShowWordSelection(true);
    onStartGame();
  };

  const handleWordSelect = () => {
    setShowWordSelection(false);
    onWordSelect(difficulty);
  };

  return (
    <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-md z-10 min-w-[250px]">
      <div className="mb-2">
        <div className="font-semibold">Round: {currentRound}/{maxRounds}</div>
        {timeLeft > 0 && <div className="text-sm">Time left: {timeLeft}s</div>}
      </div>
      
      {gameState === 'waiting' && isCreator && (
        <button
          onClick={handleStart}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded w-full"
        >
          Start Round {currentRound + 1}
        </button>
      )}
      
      {showWordSelection && (
        <div className="space-y-3">
          <h3 className="font-bold">Select difficulty:</h3>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button
            onClick={handleWordSelect}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
          >
            Select Word
          </button>
        </div>
      )}
      
      {isDrawingTurn && gameState === 'drawing' && (
        <div className="bg-yellow-100 p-2 rounded text-center">
          You're drawing!
        </div>
      )}
      
      {gameState === 'waiting' && isCreator && currentRound > 0 && (
        <button
          onClick={onEndGame}
          className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-full"
        >
          End Game
        </button>
      )}
      
      <div className="mt-4">
        <h4 className="font-semibold border-b pb-1">Players:</h4>
        <ul className="space-y-1 mt-1">
          {Object.entries(users).map(([id, user]) => (
            <li key={id} className="flex justify-between">
              <span>{user.username}</span>
              <span className="font-bold">{user.score} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GameControls;