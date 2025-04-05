// components/GameResults.js
import React from 'react';

const GameResults = ({ users, onClose }) => {
  // Sort users by score (descending)
  const sortedUsers = [...users].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-center">Game Results</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Final Scores:</h3>
          <ul className="space-y-2">
            {sortedUsers.map((user, index) => (
              <li key={user.id} className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="font-medium mr-2">
                    {index === 0 ? '🏆' : ''} {user.username}
                  </span>
                </div>
                <span className="font-bold">{user.score} pts</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default GameResults;