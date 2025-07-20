import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  // Authentication state
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  
  // Project state
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ name: '', width: 1920, height: 1080 });
  
  // Canvas state
  const canvasRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [selectedTool, setSelectedTool] = useState('select');
  const [brushSettings, setBrushSettings] = useState({ size: 10, color: '#000000' });
  const [layers, setLayers] = useState([]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  
  // UI state
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isAiTyping, setIsAiTyping] = useState(false);
  
  // WebSocket for collaboration
  const [ws, setWs] = useState(null);
  const [collaborators, setCollaborators] = useState([]);

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current && !canvas) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: 1920,
        height: 1080,
        backgroundColor: '#ffffff'
      });
      
      // Set up canvas event listeners
      fabricCanvas.on('selection:created', (e) => {
        console.log('Object selected:', e.target);
      });
      
      fabricCanvas.on('selection:cleared', () => {
        console.log('Selection cleared');
      });
      
      fabricCanvas.on('object:modified', (e) => {
        updateLayer(e.target);
      });
      
      setCanvas(fabricCanvas);
    }
    
    return () => {
      if (canvas) {
        canvas.dispose();
      }
    };
  }, []);

  // Update canvas tool
  useEffect(() => {
    if (!canvas) return;
    
    switch (selectedTool) {
      case 'brush':
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush.width = brushSettings.size;
        canvas.freeDrawingBrush.color = brushSettings.color;
        break;
      case 'eraser':
        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
        canvas.freeDrawingBrush.width = brushSettings.size;
        break;
      default:
        canvas.isDrawingMode = false;
        break;
    }
  }, [canvas, selectedTool, brushSettings]);

  // Authentication functions
  const handleAuth = async (e) => {
    e.preventDefault();
    
    try {
      const endpoint = authMode === 'login' ? 'login' : 'register';
      const response = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        setUser(data.user);
        loadProjects();
      } else {
        alert(data.detail || 'Authentication failed');
      }
    } catch (error) {
      alert('Authentication error: ' + error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setProjects([]);
    setCurrentProject(null);
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  // Project functions
  const loadProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const projectData = await response.json();
        setProjects(projectData);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProjectForm)
      });
      
      if (response.ok) {
        const project = await response.json();
        setProjects([...projects, project]);
        setShowNewProjectModal(false);
        setNewProjectForm({ name: '', width: 1920, height: 1080 });
        openProject(project);
      }
    } catch (error) {
      alert('Error creating project: ' + error.message);
    }
  };

  const openProject = async (project) => {
    setCurrentProject(project);
    
    if (canvas) {
      canvas.setWidth(project.width);
      canvas.setHeight(project.height);
      canvas.setBackgroundColor(project.background_color);
      canvas.clear();
      
      // Load project layers
      if (project.layers) {
        setLayers(project.layers);
        // Load layers onto canvas
        project.layers.forEach(layer => {
          loadLayerOnCanvas(layer);
        });
      }
    }
    
    // Set up WebSocket for collaboration
    if (ws) ws.close();
    const websocket = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/api/ws/collaborate/${project.id}`);
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleCollaborationMessage(data);
    };
    
    setWs(websocket);
  };

  const loadLayerOnCanvas = (layer) => {
    if (!canvas) return;
    
    switch (layer.type) {
      case 'image':
        fabric.Image.fromURL(layer.data.src, (img) => {
          img.set({
            left: layer.x,
            top: layer.y,
            scaleX: layer.width / img.width,
            scaleY: layer.height / img.height,
            opacity: layer.opacity,
            visible: layer.visible,
            selectable: true
          });
          img.layerId = layer.id;
          canvas.add(img);
          canvas.renderAll();
        });
        break;
      case 'text':
        const text = new fabric.Text(layer.data.text || 'Text', {
          left: layer.x,
          top: layer.y,
          fontSize: layer.data.fontSize || 20,
          fill: layer.data.color || '#000000',
          opacity: layer.opacity,
          visible: layer.visible
        });
        text.layerId = layer.id;
        canvas.add(text);
        break;
    }
  };

  const updateLayer = (fabricObject) => {
    if (!fabricObject.layerId) return;
    
    const updatedLayers = layers.map(layer => {
      if (layer.id === fabricObject.layerId) {
        return {
          ...layer,
          x: fabricObject.left,
          y: fabricObject.top,
          width: fabricObject.width * fabricObject.scaleX,
          height: fabricObject.height * fabricObject.scaleY,
          opacity: fabricObject.opacity
        };
      }
      return layer;
    });
    
    setLayers(updatedLayers);
    saveProject();
  };

  const saveProject = async () => {
    if (!currentProject) return;
    
    try {
      const token = localStorage.getItem('token');
      const projectData = {
        ...currentProject,
        layers: layers,
        updated_at: new Date().toISOString()
      };
      
      await fetch(`${API_BASE_URL}/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(projectData)
      });
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  // Tool functions
  const addTextLayer = () => {
    if (!canvas) return;
    
    const layerId = `layer_${Date.now()}`;
    const text = new fabric.Text('New Text', {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: '#000000'
    });
    text.layerId = layerId;
    
    const newLayer = {
      id: layerId,
      name: 'Text Layer',
      type: 'text',
      visible: true,
      opacity: 1.0,
      x: 100,
      y: 100,
      width: text.width,
      height: text.height,
      data: { text: 'New Text', fontSize: 20, color: '#000000' },
      z_index: layers.length
    };
    
    canvas.add(text);
    setLayers([...layers, newLayer]);
    canvas.renderAll();
  };

  const addRectangle = () => {
    if (!canvas) return;
    
    const layerId = `layer_${Date.now()}`;
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: '#ff0000'
    });
    rect.layerId = layerId;
    
    const newLayer = {
      id: layerId,
      name: 'Rectangle',
      type: 'shape',
      visible: true,
      opacity: 1.0,
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      data: { shape: 'rectangle', fill: '#ff0000' },
      z_index: layers.length
    };
    
    canvas.add(rect);
    setLayers([...layers, newLayer]);
    canvas.renderAll();
  };

  const addCircle = () => {
    if (!canvas) return;
    
    const layerId = `layer_${Date.now()}`;
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: '#00ff00'
    });
    circle.layerId = layerId;
    
    const newLayer = {
      id: layerId,
      name: 'Circle',
      type: 'shape',
      visible: true,
      opacity: 1.0,
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      data: { shape: 'circle', fill: '#00ff00' },
      z_index: layers.length
    };
    
    canvas.add(circle);
    setLayers([...layers, newLayer]);
    canvas.renderAll();
  };

  const uploadImage = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentProject) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/projects/${currentProject.id}/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        setLayers([...layers, data.layer]);
        loadLayerOnCanvas(data.layer);
      }
    } catch (error) {
      alert('Error uploading image: ' + error.message);
    }
  };

  // Zoom functions
  const zoomIn = () => {
    if (!canvas) return;
    const newZoom = Math.min(zoomLevel + 25, 500);
    setZoomLevel(newZoom);
    canvas.setZoom(newZoom / 100);
    canvas.renderAll();
  };

  const zoomOut = () => {
    if (!canvas) return;
    const newZoom = Math.max(zoomLevel - 25, 25);
    setZoomLevel(newZoom);
    canvas.setZoom(newZoom / 100);
    canvas.renderAll();
  };

  const resetZoom = () => {
    if (!canvas) return;
    setZoomLevel(100);
    canvas.setZoom(1);
    canvas.renderAll();
  };

  // Undo/Redo
  const undo = () => {
    if (!canvas) return;
    // Fabric.js doesn't have built-in undo/redo, would need to implement state management
    console.log('Undo functionality would be implemented here');
  };

  const redo = () => {
    if (!canvas) return;
    console.log('Redo functionality would be implemented here');
  };

  // Chat functions
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { text: chatInput, sender: 'user', timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setIsAiTyping(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          session_id: chatSessionId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const aiMessage = { text: data.response, sender: 'ai', timestamp: new Date() };
        setChatMessages(prev => [...prev, aiMessage]);
      } else {
        const aiMessage = { 
          text: 'Sorry, the AI assistant is not available right now. Please check that the Gemini API key is configured.', 
          sender: 'ai', 
          timestamp: new Date() 
        };
        setChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      const aiMessage = { 
        text: 'Sorry, I encountered an error. Please try again.', 
        sender: 'ai', 
        timestamp: new Date() 
      };
      setChatMessages(prev => [...prev, aiMessage]);
    }
    
    setChatInput('');
    setIsAiTyping(false);
  };

  // Collaboration functions
  const handleCollaborationMessage = (data) => {
    switch (data.type) {
      case 'cursor':
        // Update collaborator cursor position
        console.log('Cursor update:', data);
        break;
      case 'layer_update':
        // Update layer from another user
        console.log('Layer update:', data);
        break;
      default:
        console.log('Unknown collaboration message:', data);
    }
  };

  // Check for existing token on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user info
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(response => response.json())
      .then(userData => {
        if (userData.id) {
          setUser(userData);
          loadProjects();
        } else {
          localStorage.removeItem('token');
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
      });
    }
  }, []);

  // Render authentication form
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🎨 PixelCrafter</h1>
            <p className="text-gray-600">Professional Image Editor</p>
          </div>
          
          <div className="flex mb-6">
            <button
              className={`flex-1 py-2 px-4 rounded-l-lg ${authMode === 'login' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded-r-lg ${authMode === 'register' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <input
                type="text"
                placeholder="Username"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={authForm.username}
                onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={authForm.email}
              onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={authForm.password}
              onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
              required
            />
            <button
              type="submit"
              className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
            >
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render main application
  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">🎨 PixelCrafter</h1>
          {currentProject && (
            <span className="text-gray-400">- {currentProject.name}</span>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors"
          >
            New Project
          </button>
          <button
            onClick={() => setShowChatPanel(!showChatPanel)}
            className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg transition-colors"
          >
            AI Assistant
          </button>
          <span className="text-gray-400">Hello, {user.username}</span>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Projects */}
        <div className="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Projects</h3>
          <div className="space-y-2">
            {projects.map(project => (
              <div
                key={project.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  currentProject?.id === project.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => openProject(project)}
              >
                <div className="font-medium">{project.name}</div>
                <div className="text-sm text-gray-400">
                  {project.width} × {project.height}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {currentProject ? (
            <>
              {/* Toolbar */}
              <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center space-x-4 overflow-x-auto">
                <div className="flex items-center space-x-2">
                  <button
                    className={`p-2 rounded ${selectedTool === 'select' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    onClick={() => setSelectedTool('select')}
                    title="Select Tool"
                  >
                    ↗️
                  </button>
                  <button
                    className={`p-2 rounded ${selectedTool === 'brush' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    onClick={() => setSelectedTool('brush')}
                    title="Brush Tool"
                  >
                    🖌️
                  </button>
                  <button
                    className={`p-2 rounded ${selectedTool === 'eraser' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    onClick={() => setSelectedTool('eraser')}
                    title="Eraser Tool"
                  >
                    🧽
                  </button>
                </div>

                <div className="w-px h-8 bg-gray-600"></div>

                <div className="flex items-center space-x-2">
                  <button
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                    onClick={addTextLayer}
                    title="Add Text"
                  >
                    T
                  </button>
                  <button
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                    onClick={addRectangle}
                    title="Add Rectangle"
                  >
                    ⬜
                  </button>
                  <button
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                    onClick={addCircle}
                    title="Add Circle"
                  >
                    ⭕
                  </button>
                  <label className="p-2 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer" title="Upload Image">
                    📁
                    <input
                      type="file"
                      accept="image/*"
                      onChange={uploadImage}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="w-px h-8 bg-gray-600"></div>

                <div className="flex items-center space-x-2">
                  <button onClick={undo} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Undo">
                    ↶
                  </button>
                  <button onClick={redo} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Redo">
                    ↷
                  </button>
                </div>

                <div className="w-px h-8 bg-gray-600"></div>

                <div className="flex items-center space-x-2">
                  <button onClick={zoomOut} className="p-2 bg-gray-700 hover:bg-gray-600 rounded">-</button>
                  <span className="text-sm w-12 text-center">{zoomLevel}%</span>
                  <button onClick={zoomIn} className="p-2 bg-gray-700 hover:bg-gray-600 rounded">+</button>
                  <button onClick={resetZoom} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs">100%</button>
                </div>

                {selectedTool === 'brush' && (
                  <div className="flex items-center space-x-2">
                    <div className="w-px h-8 bg-gray-600"></div>
                    <label className="text-sm">Size:</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={brushSettings.size}
                      onChange={(e) => setBrushSettings({...brushSettings, size: parseInt(e.target.value)})}
                      className="w-20"
                    />
                    <input
                      type="color"
                      value={brushSettings.color}
                      onChange={(e) => setBrushSettings({...brushSettings, color: e.target.value})}
                      className="w-8 h-8 rounded"
                    />
                  </div>
                )}
              </div>

              {/* Canvas area */}
              <div className="flex-1 flex">
                <div className="flex-1 bg-gray-900 p-4 overflow-auto">
                  <div className="flex items-center justify-center min-h-full">
                    <div className="bg-white rounded-lg shadow-2xl">
                      <canvas ref={canvasRef} className="border border-gray-300 rounded-lg" />
                    </div>
                  </div>
                </div>

                {/* Layers Panel */}
                {showLayerPanel && (
                  <div className="w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Layers</h3>
                      <button
                        onClick={() => setShowLayerPanel(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {layers.map((layer, index) => (
                        <div
                          key={layer.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedLayer?.id === layer.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                          onClick={() => setSelectedLayer(layer)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{layer.name}</span>
                            <span className="text-xs text-gray-400">{layer.type}</span>
                          </div>
                          <div className="flex items-center mt-1 space-x-2">
                            <input
                              type="checkbox"
                              checked={layer.visible}
                              onChange={() => {
                                const updatedLayers = layers.map(l => 
                                  l.id === layer.id ? {...l, visible: !l.visible} : l
                                );
                                setLayers(updatedLayers);
                              }}
                              className="w-4 h-4"
                            />
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={layer.opacity}
                              onChange={(e) => {
                                const updatedLayers = layers.map(l => 
                                  l.id === layer.id ? {...l, opacity: parseFloat(e.target.value)} : l
                                );
                                setLayers(updatedLayers);
                              }}
                              className="flex-1 h-2"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Welcome to PixelCrafter!</h2>
                <p className="text-gray-400 mb-6">Create a new project or select an existing one to start editing.</p>
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg transition-colors"
                >
                  Create New Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Chat Panel */}
        {showChatPanel && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">🤖 AI Assistant</h3>
              <button
                onClick={() => setShowChatPanel(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-gray-400 text-sm">
                  Hi! I'm your design assistant. Ask me about:
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>• Color palettes and combinations</li>
                    <li>• Design tips and best practices</li>
                    <li>• Filter and effect suggestions</li>
                    <li>• Creative inspiration</li>
                  </ul>
                </div>
              )}
              
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.sender === 'user' 
                      ? 'bg-blue-600 ml-4' 
                      : 'bg-gray-700 mr-4'
                  }`}
                >
                  <div className="text-sm">{message.text}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
              
              {isAiTyping && (
                <div className="bg-gray-700 mr-4 p-3 rounded-lg">
                  <div className="text-sm text-gray-400">AI is typing...</div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Ask for design help..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || isAiTyping}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>
            <form onSubmit={createProject} className="space-y-4">
              <input
                type="text"
                placeholder="Project Name"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={newProjectForm.name}
                onChange={(e) => setNewProjectForm({...newProjectForm, name: e.target.value})}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Width"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={newProjectForm.width}
                  onChange={(e) => setNewProjectForm({...newProjectForm, width: parseInt(e.target.value)})}
                  required
                />
                <input
                  type="number"
                  placeholder="Height"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={newProjectForm.height}
                  onChange={(e) => setNewProjectForm({...newProjectForm, height: parseInt(e.target.value)})}
                  required
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 p-3 rounded-lg transition-colors"
                >
                  Create Project
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 p-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showLayerPanel && currentProject && (
        <button
          onClick={() => setShowLayerPanel(true)}
          className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-gray-800 p-2 rounded-l-lg border border-gray-700 hover:bg-gray-700 transition-colors z-40"
        >
          Layers
        </button>
      )}
    </div>
  );
}

export default App;