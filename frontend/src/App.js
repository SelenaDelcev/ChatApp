import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { styled } from '@mui/material/styles';

const App = () => {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'You are a helpful assistant' }
  ]);
  const [userMessage, setUserMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newMessage = {
      role: 'user',
      content: userMessage
    };

    try {
      const response = await axios.post('https://chatdemobackend.azurewebsites.net/chat', newMessage, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      setMessages(response.data.messages);
      setUserMessage(''); 
    } catch (error) {
      console.error('Network or Server Error:', error);
      if (error.response) {
        console.error('Error Response Data:', error.response.data);
        console.error('Error Response Status:', error.response.status);
        console.error('Error Response Headers:', error.response.headers);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error Message:', error.message);
      }
    }
  };

  const handleFileUpload = (e) => {
    console.log('File uploaded:', e.target.files[0]);
    const file = e.target.files[0];
    if (file) {
      const newMessages = [...messages, { role: 'user', content: `Uploaded file: ${file.name}` }];
      setMessages(newMessages);
    }
  };

  const VisuallyHiddenInput = styled('input')({
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      height: 1,
      overflow: 'hidden',
      position: 'absolute',
      bottom: 0,
      left: 0,
      whiteSpace: 'nowrap',
      width: 1,
  });

  const getMessageContent = (message) => {
    if (typeof message.content === 'object') {
      return message.content.content;
    }
    return message.content;
  };

  return (
    <div className="App">
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <p>{getMessageContent(message)}</p>
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
          <Button
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUploadIcon />}
          >
            Upload file
            <VisuallyHiddenInput type="file" onChange={handleFileUpload}/>
          </Button>
        </form>
      </div>
    </div>
  );
};

export default App;
