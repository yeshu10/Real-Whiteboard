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
  const [showRoundSelection, setShowRoundSelection] = useState(false);
  const [difficulty, setDifficulty] = useState('easy');
  const [gameStarted, setGameStarted] = useState(false);
  const [enoughPlayers, setEnoughPlayers] = useState(false);

  // Check if there are enough players
  useEffect(() => {
    const usersArray = Object.values(users || {});
    setEnoughPlayers(usersArray.length >= 2);
  }, [users]);

  const handleStartGame = () => {
    if (enoughPlayers) {
      setShowRoundSelection(true);
    }
  };

  const handleRoundSelect = (rounds) => {
    setShowRoundSelection(false);
    setGameStarted(true);
    onStartGame(rounds);
  };

  const handleWordSelect = () => {
    setShowWordSelection(false);
    onWordSelect(difficulty);
  };

  // Convert users object to array for rendering
  const usersArray = Object.values(users || {});

  return (
    <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-md z-10 min-w-[250px]">

      <div className="mb-2">
        <div className="font-semibold">Round: {currentRound}/{maxRounds}</div>
        {timeLeft > 0 && <div className="text-sm">Time left: {timeLeft}s</div>}
      </div>
      
      {/* Round Selection Modal */}
      {showRoundSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-center">Select Number of Rounds</h3>
            <div className="flex flex-col space-y-3">
              {[1, 2, 3, 4, 5].map(rounds => (
                <button 
                  key={rounds}
                  onClick={() => handleRoundSelect(rounds)}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg transition text-lg"
                >
                  {rounds} {rounds === 1 ? 'Round' : 'Rounds'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Word Selection */}
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
      
      {/* Start Game Button */}
     
      {gameState === 'waiting' && isCreator && !gameStarted && (
        <button
          onClick={handleStartGame}
          className={`px-4 py-2 rounded w-full ${
            enoughPlayers 
              ? 'bg-green-500 hover:bg-green-600 text-white' 
              : 'bg-gray-400 cursor-not-allowed text-gray-700'
          }`}
          disabled={!enoughPlayers}
        >
          {enoughPlayers ? 'Start Game' : 'Need 2+ players'}
        </button>
      )}
      
      {isDrawingTurn && gameState === 'drawing' && (
        <div className="bg-yellow-100 p-2 rounded text-center">
          You're drawing!
        </div>
      )}
      
      {/* End Game Button */}
      {gameState === 'waiting' && isCreator && gameStarted && (
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
          {usersArray.map((user) => (
            <li key={user.id} className="flex justify-between">
              <span>{user.username}</span>
              <span className="font-bold">{user.score || 0} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GameControls;



// import React, { useState, useEffect } from 'react';

// const GameControls = ({ 
//   isCreator, 
//   gameState, 
//   users, 
//   currentRound, 
//   maxRounds,
//   timeLeft,
//   onStartGame, 
//   onWordSelect,
//   onEndGame,
//   isDrawingTurn
// }) => {
//   const [showWordSelection, setShowWordSelection] = useState(false);
//   const [showRoundSelection, setShowRoundSelection] = useState(false);
//   const [difficulty, setDifficulty] = useState('easy');
//   const [gameStarted, setGameStarted] = useState(false);

//   const handleStartGame = () => {
//     setShowRoundSelection(true);
//   };

//   const handleRoundSelect = (rounds) => {
//     setShowRoundSelection(false);
//     setGameStarted(true);
//     onStartGame(rounds); // This will call the handleStartGame in Canvas
//   };

//   const handleWordSelect = () => {
//     setShowWordSelection(false);
//     onWordSelect(difficulty);
//   };

//   // Convert users object to array for rendering
//   const usersArray = Object.values(users || {});

//   return (
//     <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-md z-10 min-w-[250px]">
//       <div className="mb-2">
//         <div className="font-semibold">Round: {currentRound}/{maxRounds}</div>
//         {timeLeft > 0 && <div className="text-sm">Time left: {timeLeft}s</div>}
//       </div>
      
//       {/* Round Selection Modal */}
//       {showRoundSelection && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
//             <h3 className="text-xl font-bold mb-4 text-center">Select Number of Rounds</h3>
//             <div className="flex flex-col space-y-3">
//               {[1, 2, 3, 4, 5].map(rounds => (
//                 <button 
//                   key={rounds}
//                   onClick={() => handleRoundSelect(rounds)}
//                   className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg transition text-lg"
//                 >
//                   {rounds} {rounds === 1 ? 'Round' : 'Rounds'}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Word Selection */}
//       {showWordSelection && (
//         <div className="space-y-3">
//           <h3 className="font-bold">Select difficulty:</h3>
//           <select
//             value={difficulty}
//             onChange={(e) => setDifficulty(e.target.value)}
//             className="w-full p-2 border rounded"
//           >
//             <option value="easy">Easy</option>
//             <option value="medium">Medium</option>
//             <option value="hard">Hard</option>
//           </select>
//           <button
//             onClick={handleWordSelect}
//             className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
//           >
//             Select Word
//           </button>
//         </div>
//       )}
      
//       {/* Start Game Button */}
//       {gameState === 'waiting' && isCreator && !gameStarted && (
//         <button
//           onClick={handleStartGame}
//           className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded w-full"
//         >
//           Start Game
//         </button>
//       )}
      
//       {isDrawingTurn && gameState === 'drawing' && (
//         <div className="bg-yellow-100 p-2 rounded text-center">
//           You're drawing!
//         </div>
//       )}
      
//       {/* End Game Button */}
//       {gameState === 'waiting' && isCreator && gameStarted && (
//         <button
//           onClick={onEndGame}
//           className="mt-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded w-full"
//         >
//           End Game
//         </button>
//       )}
      
//       <div className="mt-4">
//         <h4 className="font-semibold border-b pb-1">Players:</h4>
//         <ul className="space-y-1 mt-1">
//           {usersArray.map((user) => (
//             <li key={user.id} className="flex justify-between">
//               <span>{user.username}</span>
//               <span className="font-bold">{user.score || 0} pts</span>
//             </li>
//           ))}
//         </ul>
//       </div>
//     </div>
//   );
// };

// export default GameControls;