import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import { v4 as uuidv4 } from 'uuid';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [sessionId, setSessionId] = useState('');
  const websocketRef = useRef(null);

  useEffect(() => {
    const storedSessionId = sessionStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = uuidv4();
      sessionStorage.setItem('sessionId', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      const websocket = new WebSocket(`wss://chatappdemobackend.azurewebsites.net/ws`);
      websocket.onopen = () => {
        console.log('WebSocket connection opened');
        websocketRef.current = websocket;
      };

      websocket.onmessage = (event) => {
        const data = event.data;
        if (data === "[DONE]") {
          return;
        }
        setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: data }]);
      };

      websocket.onclose = () => {
        console.log('WebSocket connection closed');
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return () => {
        websocket.close();
      };
    }
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!websocketRef.current) {
      console.error('WebSocket is not connected');
      return;
    }

    const newMessage = {
      role: sessionId,
      content: userMessage
    };

    setMessages(prevMessages => [...prevMessages, { role: 'user', content: userMessage }]);
    setUserMessage('');
    websocketRef.current.send(JSON.stringify(newMessage));
  };

  const getMessageContent = (message) => {
    if (typeof message.content === 'object') {
      return { __html: message.content.content };
    }
    return { __html: message.content };
  };

  return (
    <div className="App">
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <p dangerouslySetInnerHTML={getMessageContent(message)} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="message-input">
          <input
            type="text"
            placeholder="Type your message..."
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
          />
          <Button type="submit" variant="contained" endIcon={<SendIcon />}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default App;
