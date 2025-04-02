import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RoomAccess = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [action, setAction] = useState('');
  const navigate = useNavigate();

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
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
    const url = action === 'create' 
      ? `/canvas?username=${encodeURIComponent(username)}&roomId=${roomId}`
      : `/canvas?username=${encodeURIComponent(username)}&join=${roomId}`;
    navigate(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-purple-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
            Draw & Guess
          </h1>
          <p className="text-gray-600">Create or join a drawing game</p>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your name"
          />
        </div>

        {!action && (
          <div className="flex flex-col space-y-4 mb-6">
            <button
              onClick={handleCreateRoom}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] shadow-md"
            >
              🎨 Create New Game
            </button>
            <div className="flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="mx-4 text-gray-500">or</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <button
              onClick={handleJoinRoom}
              className="w-full bg-gradient-to-r from-blue-400 to-cyan-400 hover:from-blue-500 hover:to-cyan-500 text-white py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] shadow-md"
            >
              🚪 Join Existing Game
            </button>
          </div>
        )}

        {action === 'create' && (
          <div className="mb-6 animate-fade-in">
            <label className="block text-gray-700 font-medium mb-2">Your Game Code</label>
            <div className="flex items-center">
              <input
                type="text"
                value={roomId}
                readOnly
                className="flex-1 px-4 py-3 border-2 border-purple-200 rounded-lg bg-purple-50 font-mono text-xl text-center tracking-widest"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  alert('Game code copied to clipboard!');
                }}
                className="ml-2 bg-purple-100 hover:bg-purple-200 text-purple-700 p-3 rounded-lg transition"
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
            <p className="text-sm text-purple-600 mt-2 text-center">
              Share this code with friends to play together
            </p>
          </div>
        )}

        {action === 'join' && (
          <div className="mb-6 animate-fade-in">
            <label className="block text-gray-700 font-medium mb-2">Game Code</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg font-mono text-xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ABCDE"
              maxLength="5"
            />
          </div>
        )}

        {action && (
          <button
            onClick={proceedToCanvas}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-3 px-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-[1.02] shadow-lg"
          >
            {action === 'create' ? '🎮 Start Game' : '🚀 Join Game'}
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomAccess;
// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';

// const RoomAccess = () => {
//   const [username, setUsername] = useState('');
//   const [roomId, setRoomId] = useState('');
//   const [action, setAction] = useState('');
//   const navigate = useNavigate();

//   const generateRoomId = () => Math.random().toString(36).substring(2, 7);

//   const handleCreateRoom = () => {
//     if (!username.trim()) {
//       alert('Please enter a username');
//       return;
//     }
//     const newRoomId = generateRoomId();
//     setRoomId(newRoomId);
//     setAction('create');
//   };

//   const handleJoinRoom = () => {
//     if (!username.trim()) {
//       alert('Please enter a username');
//       return;
//     }
//     setAction('join');
//   };

//   const proceedToCanvas = () => {
//     if (!roomId.trim()) {
//       alert('Please enter a room ID');
//       return;
//     }
//     navigate(`/canvas?username=${encodeURIComponent(username)}&roomId=${roomId}`);
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300">
//       <div className="bg-blue-300 p-8 rounded-xl shadow-lg w-full max-w-md mx-4">
//         <div className="text-center mb-8">
//           <h1 className="text-3xl font-bold text-gray-800 mb-2">🎨 Collaborative Drawing</h1>
//           <p className="text-gray-600">Create or join a drawing room</p>
//         </div>

//         {/* Username Input */}
//         <div className="mb-6">
//           <label className="block text-gray-700 font-medium mb-2">Username</label>
//           <input
//             type="text"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//             placeholder="Enter your name"
//           />
//         </div>

//         {/* Action Buttons */}
//         {!action && (
//           <div className="flex flex-col space-y-4 mb-6">
//             <button
//               onClick={handleCreateRoom}
//               className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition transform hover:scale-105"
//             >
//               🎨 Create Room
//             </button>
//             <div className="flex items-center">
//               <div className="flex-grow border-t border-gray-300"></div>
//               <span className="mx-4 text-gray-500">or</span>
//               <div className="flex-grow border-t border-gray-300"></div>
//             </div>
//             <button
//               onClick={handleJoinRoom}
//               className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition transform hover:scale-105"
//             >
//               🚪 Join Room
//             </button>
//           </div>
//         )}

//         {/* Room ID Section */}
//         {action === 'create' && (
//           <div className="mb-6">
//             <label className="block text-gray-700 font-medium mb-2">Your Room ID</label>
//             <div className="flex items-center">
//               <input
//                 type="text"
//                 value={roomId}
//                 readOnly
//                 className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-lg"
//               />
//               <button
//                 onClick={() => {
//                   navigator.clipboard.writeText(roomId);
//                   alert('Room ID copied to clipboard!');
//                 }}
//                 className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded-lg"
//                 title="Copy to clipboard"
//               >
//                 📋 Copy
//               </button>
//             </div>
//             <p className="text-sm text-gray-500 mt-2">Share this ID to collaborate</p>
//           </div>
//         )}

//         {action === 'join' && (
//           <div className="mb-6">
//             <label className="block text-gray-700 font-medium mb-2">Room ID</label>
//             <input
//               type="text"
//               value={roomId}
//               onChange={(e) => setRoomId(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               placeholder="Enter room ID"
//             />
//           </div>
//         )}

//         {/* Proceed Button */}
//         {action && (
//           <button
//             onClick={proceedToCanvas}
//             className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition transform hover:scale-105"
//           >
//             {action === 'create' ? '🎨 Start Drawing' : '🚀 Join Room'}
//           </button>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RoomAccess;

