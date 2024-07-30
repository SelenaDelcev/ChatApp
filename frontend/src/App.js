import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
//Import Buttons and Additions
import { v4 as uuidv4 } from 'uuid';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
//Import Icons
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileSharpIcon from '@mui/icons-material/AttachFileSharp';
import SaveAltSharpIcon from '@mui/icons-material/SaveAltSharp';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';

const App = () => {
  //State Variables
  const [messages, setMessages] = useState([]); //Message in message container
  const [userMessage, setUserMessage] = useState(''); //Message in input field
  const messagesEndRef = useRef(null); //ScrollBar
  const [sessionId, setSessionId] = useState(''); //SessionId for Users
  const [files, setFiles] = useState([]); //The array in which the added files are placed
  const [tooltipText, setTooltipText] = useState({}); //Tooltip text field
  const [suggestQuestions, setSuggestQuestions] = useState(false); //Flag for suggest questions
  const [userSuggestQuestions, setUserSuggestQuestions] = useState([]);
  const [isAssistantResponding, setIsAssistantResponding] = useState(false); 
  //Audio in/out variables
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioResponse, setAudioResponse] = useState(false); //Flag for audio response
  const audioRef = useRef(null);
  const [audioBase64, setAudioBase64] = useState(null);
  // Language state
  const [language, setLanguage] = useState('sr'); // Default language is Serbian
  // Log
  const [logDataArray, setLogDataArray] = useState([]);

  //Generating sessionId
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
    if(logDataArray.length === 9) {
      saveLogData(logDataArray)
    }
  }, [logDataArray]);

  // Check URL to set language
  useEffect(() => {
    // A function to receive messages from the main page
    const handleMessage = (event) => {
      // Verify that the message is coming from the correct source
      if (event.origin !== 'https://test.georgemposi.com') return;

      if (event.data.type === 'main-url') {
        const path = event.data.url;
        console.log('URL from main page:', path);
        const isEnglish = path.includes('/en/') || path.endsWith('/en');
        console.log('Is English:', isEnglish);
        if (isEnglish) {
          setLanguage('en');
        } else {
          setLanguage('sr');
        }
      }
    };

    // Added listener
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  //Scroll to the last message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to add log entry
  const addLogEntry = (entry) => {
    setLogDataArray(prevLogData => [...prevLogData, entry]);
    console.log(logDataArray)
  };

  // Function to save log data to a text file
  const saveLogData = (logDataArray) => {
    const logData = logDataArray.join('\n');
    const logBlob = new Blob([logData], { type: 'text/plain' });
    const logUrl = URL.createObjectURL(logBlob);
    const logAnchor = document.createElement('a');
    logAnchor.style.display = 'none';
    logAnchor.href = logUrl;
    logAnchor.download = 'Log Frontend.txt';
    document.body.appendChild(logAnchor);
    logAnchor.click();
    window.URL.revokeObjectURL(logUrl);
    document.body.removeChild(logAnchor);
  };

  //Sending an audio message from the user to the backend for transcription
  const handleAudioUpload = async (blob) => {
    console.log('Blob:', blob)
    addLogEntry('Blob size: ' + blob.size); // Add log entry
    addLogEntry('Blob type: ' + blob.type);
    const formData = new FormData();
    formData.append('file', blob, 'audio.mp4');
    console.log('Form data after append audio.mp4:', formData)
    addLogEntry('Form data after append audio.mp4: ' + formData); // Add log entry
    formData.append('session_id', sessionId);
  
    try {
      addLogEntry('Try block');
      const response = await axios.post('https://chatappdemobackend.azurewebsites.net/transcribe', formData);
  
      console.log('Response:',response)
      addLogEntry('Response: ' + JSON.stringify(response)); // Add log entry
      const { transcript } = response.data;
      setUserMessage(transcript); //Set transcript text in input field
      setIsRecording(false);
    } catch (error) {
      addLogEntry('Error uploading audio file:' + error);
      console.error('Error uploading audio file:', error);
      setIsRecording(false);
    }
  };

  const handleVoiceClick = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      console.log("Iskljuceno snimanje");
      addLogEntry("Iskljuceno snimanje"); // Add log entry
    } else {
      console.log("Ukljuceno snimanje");
      addLogEntry("Ukljuceno snimanje"); // Add log entry
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
        console.log("Media Recorder Ref", mediaRecorderRef);
        addLogEntry("Media Recorder Ref: " + mediaRecorderRef); // Add log entry
        let silenceTimeout;

        const resetSilenceTimeout = () => {
          clearTimeout(silenceTimeout);
          silenceTimeout = setTimeout(() => {
            mediaRecorderRef.current.stop();
          }, 5000);
        };

        mediaRecorderRef.current.ondataavailable = (event) => {
          const blob = event.data;
          console.log("Blob:", blob);
          addLogEntry("Blob: " + blob); // Add log entry

          // Save the mp4 file
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = 'audio.mp4';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);

          handleAudioUpload(blob);
        };

        mediaRecorderRef.current.onstart = () => {
          console.log('Recording started');
          addLogEntry('Recording started'); // Add log entry
          resetSilenceTimeout();
        };

        mediaRecorderRef.current.onstop = () => {
          console.log('Recording stopped');
          addLogEntry('Recording stopped'); // Add log entry
          clearTimeout(silenceTimeout);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 2048;
        const dataArray = new Uint8Array(analyser.fftSize);

        const detectSilence = () => {
          analyser.getByteTimeDomainData(dataArray);
          const isSilent = dataArray.every(value => value === 128);
          if (!isSilent) {
            resetSilenceTimeout();
          }
          if (isRecording) {
            requestAnimationFrame(detectSilence);
          }
        };

        detectSilence();
      })
      .catch((error) => {
        setIsRecording(false);
      });
    }
  };

  const handleAudioResponse = (audioBase64) => {
    if (audioResponse) {
      setAudioBase64(audioBase64);
      const audio = new Audio(`data:audio/mp4;base64,${audioBase64}`);
      audioRef.current = audio;
    }
  };

  const getEventSource = () => {
    setIsAssistantResponding(true);
    const eventSource = new EventSource(`https://chatappdemobackend.azurewebsites.net/chat/stream?session_id=${sessionId}`, {
      withCredentials: true
    });

    eventSource.onopen = function() {
      console.log("EventSource connection opened.");
      setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: '' }]);
    };

    eventSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      const content = data.content;

      if (data.suggested_questions) {
        console.log(data.suggested_questions);
      }

      if (data.audio) {
        console.log("Audio data received:", data.audio);
        handleAudioResponse(data.audio);
      }

      // Filtriraj sadržaj da ne uključuje predložena pitanja
      const filteredContent = (language === 'en' ? content.replace(/Suggested questions:.*(?:\n|$)/g, '') : content.replace(/Predložena pitanja:.*(?:\n|$)/g, ''));

      updateLastMessage({ role: 'assistant', content: filteredContent });

      if (!content.endsWith('▌')) {
        eventSource.close();
        updateLastMessage({ role: 'assistant', content: filteredContent.replace('▌', '') });
        setIsAssistantResponding(false);
      }
    };

    eventSource.onerror = function(event) {
      console.error("EventSource failed.", event);
      eventSource.close();
      setIsAssistantResponding(false);
    };
  };

  const handleClearChat = () => {
    setMessages([]);
    sessionStorage.removeItem('sessionId');
    const newSessionId = uuidv4();
    sessionStorage.setItem('sessionId', newSessionId);
    setSessionId(newSessionId);
    setFiles([]);
    setUserSuggestQuestions([]);
    setAudioBase64(null);
  };

  const handleSuggestQuestions = () => {
    setSuggestQuestions(!suggestQuestions);
  };

  const handleAudioResponseClick = () => {
    if (audioRef.current) {
        audioRef.current.pause(); 
        audioRef.current = null;
    }
    if (audioResponse === false) {
      setAudioBase64(null);
    }
    setAudioResponse(!audioResponse);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newMessage = {
      role: 'user',
      content: userMessage
    };
    
    setUserMessage(''); // Clear the input field

    if (files.length > 0) {
      await handleFileSubmit(newMessage);
    } else {
      try { 
        const response = await axios.post('https://chatappdemobackend.azurewebsites.net/chat', {
          message: newMessage,
          suggest_questions: suggestQuestions,
          play_audio_response: audioResponse,
          language: language // send the flag to the backend
        }, {
          headers: {
              'Content-Type': 'application/json',
              'Session-ID': sessionId
          },
          withCredentials: true,
        });

        const data = response.data;

        if (data && data.calendly_url) {
          setMessages((prevMessages) => [
            ...prevMessages,
            { role: 'assistant', content: data.calendly_url, type: 'calendly' },
          ]);
        } else {
          getEventSource();
        }

        // Request suggested questions only if assistant has finished responding
        if (!isAssistantResponding) {
          handleSuggestedQuestionClick(newMessage);
        }

        if (data.suggested_questions) {
          setUserSuggestQuestions(data.suggested_questions.filter(q => q.trim() !== '')); // Update the state with the non-empty suggested questions
        } else {
          setUserSuggestQuestions([]); // Clear suggested questions if not present
        }
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
    }
  };

  const handleSuggestedQuestionClick = async (question) => {
    const newMessage = {
      role: 'user',
      content: question
    };
  
    setMessages(prevMessages => [...prevMessages, newMessage]);
    setUserSuggestQuestions([]);
  
    if (files.length > 0) {
      await handleFileSubmit(newMessage);
    } else {
      try { 
        const response = await axios.post('https://chatappdemobackend.azurewebsites.net/chat', {
          message: newMessage,
          suggest_questions: suggestQuestions, // send the flag to the backend
          play_audio_response: audioResponse, // send the flag to the backend
          language: language // send the flag to the backend
        }, {
          headers: {
              'Content-Type': 'application/json',
              'Session-ID': sessionId
          },
          withCredentials: true,
        });
  
        const data = response.data;
  
        if (data && data.calendly_url) {
          setMessages((prevMessages) => [
            ...prevMessages,
            { role: 'assistant', content: data.calendly_url, type: 'calendly' },
          ]);
        } else {
          getEventSource();
        }
  
        if (data.suggested_questions) {
          setUserSuggestQuestions(data.suggested_questions.filter(q => q.trim() !== '')); // Update the state with the non-empty suggested questions
        } else {
          setUserSuggestQuestions([]); // Clear suggested questions if not present
        }
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
    }
  };

  const updateLastMessage = (newMessage) => {
    setMessages(prevMessages => {
      const lastIndex = prevMessages.length - 1;

      if (prevMessages[lastIndex] && prevMessages[lastIndex].role === 'assistant') {
        const updatedMessages = [...prevMessages];
        updatedMessages[lastIndex] = newMessage;
        return updatedMessages;
      }
      return [...prevMessages, newMessage];
    });
  };

  const sanitizeText = (text) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const handleSaveChat = () => {
    const chatContent = messages.map(msg => `${msg.role}: ${sanitizeText(msg.content.content)}`).join('\n');
    const blob = new Blob([chatContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat.txt';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    setFiles([...files, ...Array.from(e.target.files)]);
  };

  const handleFileDelete = (index) => {
    setFiles(prevFiles => {
      const updatedFiles = prevFiles.filter((_, i) => i !== index);
      console.log('Updated Files:', updatedFiles);
      return updatedFiles;
    });
  };

  const handleFileSubmit = async (newMessage) => {
    if (!files) return;

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('message', newMessage.content);

    setMessages(prevMessages => [...prevMessages, newMessage]);

    try {
      const response = await axios.post('https://chatappdemobackend.azurewebsites.net/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Session-ID': sessionId
        }
      });

      const data = response.data;
      if (data && data.detail) {
        handleErrorMessage(data.detail);
      } else {
        getEventSource();
      }
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  const handleErrorMessage = (errorMessage) => {
    setMessages(prevMessages => [
      ...prevMessages,
      { role: 'assistant', type: 'error', content: errorMessage }
    ]);
  };

  const handleCopyToClipboard = (messageContent, index) => {
    const contentToSanitize = typeof messageContent === 'object' && messageContent !== null ? messageContent.content : messageContent;
    const sanitizedText = sanitizeText(contentToSanitize);
    const textArea = document.createElement('textarea');
    textArea.value = sanitizedText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setTooltipText((prev) => ({
      ...prev,
      [index]: 'Kopirano!'
    }));
    setTimeout(() => {
      setTooltipText((prev) => ({
        ...prev,
        [index]: (language === 'en' ? 'Copy to clipboard' : 'Klikni da kopiraš tekst')
      }));
    }, 3000);
  };

  const getMessageContent = (message) => {
    if (typeof message.content === 'object') {
      return { __html: message.content.content };
    }
    return { __html: message.content };
  };

  const actions = [
    { icon: <DeleteIcon />, name: (language === 'en' ? 'Delete' : 'Obriši'), onClick: handleClearChat },
    {
      icon: (
        <div style={{ position: 'relative' }}>
        <AttachFileSharpIcon style={{ color: files.length > 0 ? 'red' : 'inherit' }} />
          {files.length > 0 && (
            files.map((file, index) => (
              <div key={index} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <CancelOutlinedIcon
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    cursor: 'pointer',
                    color: '#8695a3'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileDelete(index);
                  }}
                />
              </div>
            ))
          )}
        </div>
      ),
      name: files.length > 0 ? files.map(file => file.name).join('\n') : (language === 'en' ? 'Attach files' : 'Dodaj priloge'),
      onClick: () => document.getElementById('fileInput').click()
  },
    { icon: <SaveAltSharpIcon />, name: (language === 'en' ? 'Save' : 'Sačuvaj'), onClick: handleSaveChat },
    { icon: <TipsAndUpdatesIcon style={{ color: suggestQuestions === true ? 'red' : 'inherit' }}/>, name: suggestQuestions === true ? (language === 'en' ? 'Turn off question suggestions' : 'Isključi predloge pitanja') : (language === 'en' ? 'Turn on question suggestions' : 'Predlozi pitanja/odgovora'), onClick: handleSuggestQuestions },
    { icon: <VolumeUpIcon style={{ color: audioResponse === true ? 'red' : 'inherit' }}/>, name: audioResponse === true ? (language === 'en' ? 'Turn off assistant audio response' : 'Isključi audio odgovor asistenta') : (language === 'en' ? 'Turn on assistant audio response' : 'Slušaj odgovor asistenta'), onClick: handleAudioResponseClick },

  ];

  return (
    <div className="App">
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              {message.type === 'calendly' ? (
                <iframe
                  src={message.content}
                  title="Calendly Scheduling"
                ></iframe>
              ) : message.type === 'error' ? (
                <Alert variant="outlined" severity="error" style={{ color: '#black' }}>{message.content}</Alert>
              ) : (
                <Tooltip
                  title={tooltipText[index] || (language === 'en' ? 'Copy to clipboard' : 'Klikni da kopiraš tekst')}
                  placement="top"
                  arrow
                >
                  <div>
                    <div onClick={() => handleCopyToClipboard(message.content, index)}>
                        <p dangerouslySetInnerHTML={getMessageContent(message)} />
                    </div>
                    {message.role === 'assistant' && audioResponse && audioBase64 && index === messages.length - 1 && !isAssistantResponding && (
                        <audio controls autoPlay>
                            <source src={`data:audio/mp4;base64,${audioBase64}`} type="audio/mp4" />
                            Your browser does not support the audio element.
                        </audio>
                    )}
                  </div>
                </Tooltip>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-row-container">
          {!isAssistantResponding && userSuggestQuestions.length > 0 && (
            <div className="suggested-questions">
              {userSuggestQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  onClick={() => handleSuggestedQuestionClick(question)}
                  style={{ marginBottom: '10px' }}
                >
                  {question}
                </Button>
              ))}
            </div>
          )}
          <div className="input-row">
            <form onSubmit={handleSubmit} className="message-input">
              <div className="input-container">
                <input
                  type="text"
                  placeholder={language === 'en' ? 'How can I help you?' : 'Kako vam mogu pomoći?'}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  disabled={isAssistantResponding}
                />
                {userMessage.trim() ? (
                  <Button type="submit" className="send-button">
                    <SendIcon />
                  </Button>
                ) : (
                  <Tooltip title={language === 'en' ? 'Click to start recording': "Kliknite da započnete snimanje"}>
                    <Button
                      className={`send-button ${isRecording ? 'recording' : ''}`}
                      onClick={handleVoiceClick}
                      disabled={isAssistantResponding}
                    >
                      <KeyboardVoiceIcon />
                    </Button>
                  </Tooltip>
                )}
              </div>
            </form>
            <SpeedDial
              ariaLabel="SpeedDial basic example"
              className="speed-dial"
              icon={<SpeedDialIcon />}
            >
              {actions.map((action) => (
                <SpeedDialAction
                  key={action.name}
                  icon={action.icon}
                  tooltipTitle={action.name}
                  onClick={action.onClick}
                />
              ))}
            </SpeedDial>
            <input
              id="fileInput"
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
