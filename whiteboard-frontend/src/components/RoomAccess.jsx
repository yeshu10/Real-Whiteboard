import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const RoomAccess = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [action, setAction] = useState(''); // 'create' or 'join'
  const navigate = useNavigate();

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 7);
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setAction('create');
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    setAction('join');
  };

  const proceedToCanvas = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }
    navigate(`/canvas?username=${encodeURIComponent(username)}&roomId=${roomId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Collaborative Drawing App</h1>
        
        {/* Username Input */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your username"
          />
        </div>

        {/* Action Buttons (Create/Join) */}
        {!action && (
          <div className="flex space-x-4 mb-6">
            <button
              onClick={handleCreateRoom}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition"
            >
              Create Room
            </button>
            <button
              onClick={handleJoinRoom}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition"
            >
              Join Room
            </button>
          </div>
        )}

        {/* Room ID Input (shown after selecting action) */}
        {action === 'create' && (
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Your Room ID</label>
            <div className="flex items-center">
              <input
                type="text"
                value={roomId}
                readOnly
                className="flex-1 px-4 py-2 border rounded-lg bg-gray-100 font-mono"
              />
              <button
                onClick={() => navigator.clipboard.writeText(roomId)}
                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-3 rounded-lg"
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Share this ID with others to join your room
            </p>
          </div>
        )}

        {action === 'join' && (
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Room ID to Join</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter room ID"
            />
          </div>
        )}

        {/* Proceed Button (shown after selecting action) */}
        {action && (
          <button
            onClick={proceedToCanvas}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg transition"
          >
            {action === 'create' ? 'Start Drawing' : 'Join Room'}
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomAccess;