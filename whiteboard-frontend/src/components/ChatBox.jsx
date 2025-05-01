import React, { useState, useEffect, useRef } from 'react';

const ChatBox = ({ onSendMessage, messages, isDrawing, currentWord, hasGuessed }) => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatMessage = (msg) => {
    if (!msg || !msg.message) return "";
    
    // Handle system messages
    if (msg.isSystem) {
      // Always use the provided username if available
      const username = msg.username || extractUsernameFromMessage(msg.message);
      
      if (!username) return ""; // Skip if no username can be found

      if (msg.message.includes('joined')) {
        return `${username} joined!`;
      }
     
      if (msg.message.includes('turn to draw')) {
        return `${username}'s turn to draw!`;
      }
      return msg.message;
    }
    
    // Handle correct guesses
    if (msg.isCorrect) return `guessed correctly!`;
    
    // Regular messages
    return msg.message || "";
  };

  // Helper to extract username from message text
  const extractUsernameFromMessage = (messageText) => {
    if (!messageText) return null;
    // Match patterns like "username's turn" or "username joined"
    const match = messageText.match(/^(\w+)(?:'s| joined| guessed)/);
    return match ? match[1] : null;
  };

  const showChatInput = currentWord && !hasGuessed && !isDrawing;

  return (
    <div className="absolute right-4 bottom-4 w-80 bg-white rounded-lg shadow-lg flex flex-col h-[400px]">
      <div className="p-3 border-b font-semibold flex justify-between items-center">
        <span>Chat</span>
        {currentWord && hasGuessed && (
          <span className="text-sm bg-green-100 px-2 py-1 rounded">You guessed it!</span>
        )}
        {isDrawing && currentWord && (
          <span className="text-sm bg-yellow-100 px-2 py-1 rounded">You're drawing!</span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, i) => {
          const displayText = formatMessage(msg);
          if (!displayText) return null;
          
          return (
            <div 
              key={i} 
              className={`p-2 rounded ${
                msg.isCorrect ? 'bg-green-100 border-l-4 border-green-500' : 
                msg.isSystem ? 'bg-gray-100 text-gray-600 text-sm italic' : 'bg-gray-50'
              }`}
            >
              {msg.isSystem ? (
                <span>{displayText}</span>
              ) : (
                <>
                  <strong className={msg.isCorrect ? 'text-green-700' : ''}>
                    {msg.username}:
                  </strong> {displayText}
                  {msg.isCorrect && (
                    <span className="float-right text-green-600">✓</span>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {showChatInput && (
        <form onSubmit={handleSubmit} className="p-3 border-t">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your guess..."
            autoComplete="off"
          />
        </form>
      )}

      {!currentWord && (
        <div className="p-3 border-t text-sm text-gray-500">
          Waiting for word selection...
        </div>
      )}
    </div>
  );
};

export default ChatBox;
// import React, { useState, useEffect, useRef } from 'react';

// const ChatBox = ({ onSendMessage, messages, isDrawing, currentWord, hasGuessed }) => {
//   const [message, setMessage] = useState('');
//   const messagesEndRef = useRef(null);

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (message.trim()) {
//       onSendMessage(message);
//       setMessage('');
//     }
//   };

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

  
//   // const formatMessage = (msg) => {
//   //   console.log("Raw message object:", JSON.stringify(msg, null, 2));
    
//   //   if (!msg) return "";
    
//   //   // Extract username from message if not provided directly
//   //   const extractUsername = (text) => {
//   //     if (msg.username) return msg.username;
//   //     const match = text.match(/^([^ ]+)/);
//   //     return match ? match[1] : 'A player';
//   //   };
  
//   //   // Handle system messages
//   //   if (msg.isSystem) {
//   //     const content = msg.message || "";
//   //     const username = extractUsername(content);
      
//   //     if (content.includes('joined')) {
//   //       return `${username} joined!`;
//   //     }
//   //     if (content.includes('guessed')) {
//   //       return `${username} guessed correctly!`;
//   //     }
//   //     return content
//   //       .replace('+ points', '')
//   //       .replace('! +', '!')
//   //       .replace('undefined', '');
//   //   }
    
    
//   //   if (msg.isCorrect) return "";
//   //   return msg.message || "";
//   // };
//   // Determine if chat input should be shown
  
//   const formatMessage = (msg) => {
//     if (!msg) return "";
    
//     // Handle system messages
//     if (msg.isSystem) {
//       const content = msg.message || "";
      
//       // If username is provided in the message object, use that
//       if (msg.username && msg.username !== 'System') {
//         if (content.includes('guessed')) {
//           return `${msg.username} guessed correctly!`;
//         }
//         if (content.includes('turn to draw')) {
//           return `${msg.username}'s turn to draw!`;
//         }
//         return content.replace('System', msg.username);
//       }
      
//       // Otherwise try to extract username from message content
//       const usernameMatch = content.match(/(\w+)'s turn to draw!/) || 
//                            content.match(/(\w+) guessed/);
//       const username = usernameMatch ? usernameMatch[1] : 'A player';
      
//       if (content.includes('guessed')) {
//         return `${username} guessed correctly!`;
//       }
//       if (content.includes('turn to draw')) {
//         return `${username}'s turn to draw!`;
//       }
//       return content.replace('System', username);
//     }
    
//     // Handle correct guesses - return empty string as we'll handle this specially in render
//     if (msg.isCorrect) return "";
    
//     // Regular messages
//     return msg.message || "";
//   };
//   const showChatInput = currentWord && !hasGuessed && !isDrawing;

//   return (
//     <div className="absolute right-4 bottom-4 w-80 bg-white rounded-lg shadow-lg flex flex-col h-[400px]">
//       <div className="p-3 border-b font-semibold flex justify-between items-center">
//         <span>Chat</span>
//         {currentWord && hasGuessed && (
//           <span className="text-sm bg-green-100 px-2 py-1 rounded">You guessed it!</span>
//         )}
//         {isDrawing && currentWord && (
//           <span className="text-sm bg-yellow-100 px-2 py-1 rounded">You're drawing!</span>
//         )}
//       </div>
      
//       <div className="flex-1 overflow-y-auto p-3 space-y-2">
//         {messages.map((msg, i) => {
//           const displayText = formatMessage(msg);
//           return (
//             <div 
//               key={i} 
//               className={`p-2 rounded ${
//                 msg.isCorrect ? 'bg-green-100 border-l-4 border-green-500' : 
//                 msg.isSystem ? 'bg-gray-100 text-gray-600 text-sm italic' : 'bg-gray-50'
//               }`}
//             >
//               {msg.isSystem ? (
//                 <span>{displayText}</span>
//               ) : (
//                 <>
//                   <strong className={msg.isCorrect ? 'text-green-700' : ''}>
//                     {msg.username}:
//                   </strong> {displayText}
//                   {msg.isCorrect && (
//                     <span className="float-right text-green-600">✓</span>
//                   )}
//                 </>
//               )}
//             </div>
//           );
//         })}
//         <div ref={messagesEndRef} />
//       </div>

//       {showChatInput && (
//         <form onSubmit={handleSubmit} className="p-3 border-t">
//           <input
//             type="text"
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//             className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
//             placeholder="Type your guess..."
//             autoComplete="off"
//           />
//         </form>
//       )}

//       {!currentWord && (
//         <div className="p-3 border-t text-sm text-gray-500">
//           Waiting for word selection...
//         </div>
//       )}
//     </div>
//   );
// };

// export default ChatBox;
// import React, { useState, useEffect, useRef } from 'react';

// const ChatBox = ({ onSendMessage, messages, isDrawing, currentWord, hasGuessed }) => {
//   const [message, setMessage] = useState('');
//   const messagesEndRef = useRef(null);

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (message.trim()) {
//       onSendMessage(message);
//       setMessage('');
//     }
//   };

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   // Determine if chat input should be shown
//   const showChatInput = currentWord && !hasGuessed && !isDrawing;

//   return (
//     <div className="absolute right-4 bottom-4 w-80 bg-white rounded-lg shadow-lg flex flex-col h-[400px]">
//       <div className="p-3 border-b font-semibold flex justify-between items-center">
//         <span>Chat</span>
//         {currentWord && hasGuessed && (
//           <span className="text-sm bg-green-100 px-2 py-1 rounded">You guessed it!</span>
//         )}
//         {isDrawing && currentWord && (
//           <span className="text-sm bg-yellow-100 px-2 py-1 rounded">You're drawing!</span>
//         )}
//       </div>
//       <div className="flex-1 overflow-y-auto p-3 space-y-2">
//         {messages.map((msg, i) => (
//           <div 
//             key={i} 
//             className={`p-2 rounded ${
//               msg.isCorrect ? 'bg-green-100 border-l-4 border-green-500' : 
//               msg.isSystem ? 'bg-gray-100 text-gray-600 text-sm' : 'bg-gray-50'
//             }`}
//           >
//             {msg.isSystem ? (
//               <span>{msg.message}</span>
//             ) : (
//               <>
//                 <strong className={msg.isCorrect ? 'text-green-700' : ''}>
//                   {msg.username}:
//                 </strong> {msg.message}
//                 {msg.isCorrect && (
//                   <span className="float-right text-green-600 font-bold">+{msg.points}</span>
//                 )}
//               </>
//             )}
//           </div>
//         ))}
//         <div ref={messagesEndRef} />
//       </div>
//       {showChatInput && (
//         <form onSubmit={handleSubmit} className="p-3 border-t">
//           <input
//             type="text"
//             value={message}
//             onChange={(e) => setMessage(e.target.value)}
//             className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
//             placeholder="Type your guess..."
//             autoComplete="off"
//           />
//         </form>
//       )}
//       {!currentWord && (
//         <div className="p-3 border-t text-sm text-gray-500">
//           Waiting for word selection...
//         </div>
//       )}
//     </div>
//   );
// };

// export default ChatBox;

