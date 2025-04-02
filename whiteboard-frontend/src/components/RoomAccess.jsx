import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RoomAccess = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [action, setAction] = useState('');
  const navigate = useNavigate();

  const generateRoomId = () => Math.random().toString(36).substring(2, 7);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300">
      <div className="bg-blue-300 p-8 rounded-xl shadow-lg w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🎨 Collaborative Drawing</h1>
          <p className="text-gray-600">Create or join a drawing room</p>
        </div>

        {/* Username Input */}
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your name"
          />
        </div>

        {/* Action Buttons */}
        {!action && (
          <div className="flex flex-col space-y-4 mb-6">
            <button
              onClick={handleCreateRoom}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg transition transform hover:scale-105"
            >
              🎨 Create Room
            </button>
            <div className="flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="mx-4 text-gray-500">or</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <button
              onClick={handleJoinRoom}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition transform hover:scale-105"
            >
              🚪 Join Room
            </button>
          </div>
        )}

        {/* Room ID Section */}
        {action === 'create' && (
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">Your Room ID</label>
            <div className="flex items-center">
              <input
                type="text"
                value={roomId}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-lg"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  alert('Room ID copied to clipboard!');
                }}
                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded-lg"
                title="Copy to clipboard"
              >
                📋 Copy
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">Share this ID to collaborate</p>
          </div>
        )}

        {action === 'join' && (
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter room ID"
            />
          </div>
        )}

        {/* Proceed Button */}
        {action && (
          <button
            onClick={proceedToCanvas}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition transform hover:scale-105"
          >
            {action === 'create' ? '🎨 Start Drawing' : '🚀 Join Room'}
          </button>
        )}
      </div>
    </div>
  );
};

export default RoomAccess;

// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { io } from 'socket.io-client';

// const RoomAccess = () => {
//   const [username, setUsername] = useState('');
//   const [roomId, setRoomId] = useState('');
//   const [action, setAction] = useState(''); 
//   const navigate = useNavigate();

//   const generateRoomId = () => {
//     return Math.random().toString(36).substring(2, 7);
//   };

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
//     <div className="min-h-screen flex items-center justify-center bg-gray-100">
//       <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md mx-4">
//         <div className="text-center mb-8">
//           <h1 className="text-3xl font-bold text-gray-800 mb-2">
//             Collaborative Drawing App
//           </h1>
//           <p className="text-gray-600">Create or join a drawing room</p>
//         </div>
        
//         {/* Username Input */}
//         <div className="mb-6">
//           <label className="block text-gray-700 font-medium mb-2">Username</label>
//           <div className="relative">
//             <input
//               type="text"
//               value={username}
//               onChange={(e) => setUsername(e.target.value)}
//               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//               placeholder="Your creative name"
//             />
//           </div>
//         </div>

//         {/* Action Buttons */}
//         {!action && (
//           <div className="flex flex-col space-y-4 mb-6">
//             <button
//               onClick={handleCreateRoom}
//               className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition"
//             >
//               🎨 Create New Room
//             </button>
//             <div className="flex items-center">
//               <div className="flex-grow border-t border-gray-300"></div>
//               <span className="mx-4 text-gray-500">or</span>
//               <div className="flex-grow border-t border-gray-300"></div>
//             </div>
//             <button
//               onClick={handleJoinRoom}
//               className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition"
//             >
//               🚪 Join Existing Room
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
//                 className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono"
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
//             <p className="text-sm text-gray-500 mt-2">
//               Share this ID with friends to collaborate
//             </p>
//           </div>
//         )}

//         {action === 'join' && (
//           <div className="mb-6">
//             <label className="block text-red-700 font-medium mb-2">Room ID</label>
//             <div className="relative">
//               <input
//                 type="text"
//                 value={roomId}
//                 onChange={(e) => setRoomId(e.target.value)}
//                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 placeholder="Enter room ID"
//               />
//             </div>
//           </div>
//         )}

//         {/* Proceed Button */}
//         {action && (
//           <button
//             onClick={proceedToCanvas}
//             className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-semibold transition"
//           >
//             {action === 'create' ? '🎨 Start Drawing' : '🚀 Join Room'}
//           </button>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RoomAccess;

// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { io } from 'socket.io-client';

// const RoomAccess = () => {
//   const [username, setUsername] = useState('');
//   const [roomId, setRoomId] = useState('');
//   const [action, setAction] = useState(''); 
//   const navigate = useNavigate();

//   const generateRoomId = () => {
//     return Math.random().toString(36).substring(2, 7);
//   };

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
//     <div className="min-h-screen flex items-center justify-center bg-gray-100">
//       <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
//         <h1 className="text-2xl font-bold text-center mb-6">Collaborative Drawing App</h1>
        
       
//         <div className="mb-4">
//           <label className="block text-gray-700 mb-2">Username</label>
//           <input
//             type="text"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//             className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//             placeholder="Enter your username"
//           />
//         </div>

      
//         {!action && (
//           <div className="flex space-x-4 mb-6">
//             <button
//               onClick={handleCreateRoom}
//               className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition"
//             >
//               Create Room
//             </button>
//             <button
//               onClick={handleJoinRoom}
//               className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition"
//             >
//               Join Room
//             </button>
//           </div>
//         )}

        
//         {action === 'create' && (
//           <div className="mb-6">
//             <label className="block text-gray-700 mb-2">Your Room ID</label>
//             <div className="flex items-center">
//               <input
//                 type="text"
//                 value={roomId}
//                 readOnly
//                 className="flex-1 px-4 py-2 border rounded-lg bg-gray-100 font-mono"
//               />
//               <button
//                 onClick={() => navigator.clipboard.writeText(roomId)}
//                 className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-3 rounded-lg"
//                 title="Copy to clipboard"
//               >
//                 📋
//               </button>
//             </div>
//             <p className="text-sm text-gray-500 mt-2">
//               Share this ID with others to join your room
//             </p>
//           </div>
//         )}

//         {action === 'join' && (
//           <div className="mb-6">
//             <label className="block text-gray-700 mb-2">Room ID to Join</label>
//             <input
//               type="text"
//               value={roomId}
//               onChange={(e) => setRoomId(e.target.value)}
//               className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
//               placeholder="Enter room ID"
//             />
//           </div>
//         )}

        
//         {action && (
//           <button
//             onClick={proceedToCanvas}
//             className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg transition"
//           >
//             {action === 'create' ? 'Start Drawing' : 'Join Room'}
//           </button>
//         )}
//       </div>
//     </div>
//   );
// };

// export default RoomAccess;