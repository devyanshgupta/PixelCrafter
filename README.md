# 🎨 PixelCrafter - Professional Canvas-Based Image Editor
**It is a Project developed using Emergent AI Agent**

A modern, full-stack web application inspired by Photoshop, built with React, FastAPI, and MongoDB. PixelCrafter offers powerful image editing capabilities with AI assistance, multi-layer support, and real-time collaboration.

## ✨ Features

### 🖼️ Canvas Editor
- **Multi-layer image editing** with full layer management
- **Professional tools**: Brush, shapes, text, eraser
- **Image import/export** with drag-and-drop support
- **Undo/Redo functionality** for all operations
- **Zoom and pan** with smooth controls
- **Layer panel** similar to Photoshop interface

### 🤖 AI Assistant
- **Gemini-powered chat assistant** for design guidance
- **Color palette suggestions** and design tips
- **Filter and effect recommendations**
- **Creative inspiration** for various design projects
- **Interactive design troubleshooting**

### 👥 Collaboration
- **Real-time collaborative editing** via WebSockets
- **Multi-user cursor visibility** and actions
- **Live project synchronization**
- **Shared workspace management**

### 🔐 Authentication & Projects
- **JWT-based authentication** with secure login/registration
- **Project save/load functionality** with MongoDB storage
- **User workspace management**
- **Project sharing and collaboration**

### 📱 Responsive Design
- **Mobile and tablet optimized** interface
- **Adaptive toolbar and panels**
- **Touch-friendly controls**
- **Cross-device compatibility**

## 🚀 Tech Stack

### Frontend
- **React 18** with modern hooks
- **TailwindCSS** for responsive styling
- **Fabric.js** for canvas manipulation
- **WebSocket** for real-time features

### Backend
- **FastAPI** with async/await support
- **MongoDB** with Motor async driver
- **JWT Authentication** with bcrypt
- **WebSocket** for collaboration
- **Gemini AI Integration** via emergentintegrations

### Database
- **MongoDB** for document storage
- **Base64 image storage** for reliability
- **Indexed queries** for performance

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas)
- Gemini API Key (for AI features)

## ⚡ Quick Start

### 1. Clone and Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd pixelcrafter

# Backend setup
cd backend
pip install -r requirements.txt

# Frontend setup
cd ../frontend
yarn install
```

### 2. Environment Configuration

#### Backend Environment (.env)
Create `/app/backend/.env`:
```env
MONGO_URL=mongodb://localhost:27017
JWT_SECRET=your-super-secret-jwt-key-change-in-production
GEMINI_API_KEY=your-gemini-api-key-here
```

#### Frontend Environment (.env)
Create `/app/frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 3. Get Your Gemini API Key

1. **Visit Google AI Studio**: https://aistudio.google.com/app/apikey
2. **Sign in** with your Google account
3. **Create API Key** - click "Create API Key"
4. **Copy the key** and add it to your backend `.env` file
5. **Save the file** and restart the backend server

**Available Gemini Models:**
- `gemini-2.5-flash-preview-04-17` (Latest)
- `gemini-2.5-pro-preview-05-06` (Most Capable)
- `gemini-2.0-flash` (Fast & Efficient) ⭐ **Default**
- `gemini-2.0-flash-lite` (Lightweight)
- `gemini-1.5-flash` (Stable)
- `gemini-1.5-pro` (High Quality)

### 4. Start the Application

#### Development Mode
```bash
# Terminal 1: Start Backend
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2: Start Frontend  
cd frontend
yarn start
```

#### Production Mode (Docker)
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

## 🎯 Usage Guide

### Getting Started
1. **Register/Login** with your credentials
2. **Create a new project** with custom dimensions
3. **Upload images** via drag-and-drop or file picker
4. **Use editing tools** from the toolbar
5. **Manage layers** in the layer panel
6. **Ask AI assistant** for design help
7. **Save and collaborate** on projects

### Editing Tools
- **Select Tool** (↗️): Move and transform objects
- **Brush Tool** (🖌️): Free-hand drawing with customizable size/color
- **Eraser Tool** (🧽): Remove parts of drawings
- **Text Tool** (T): Add and edit text layers
- **Shapes**: Add rectangles (⬜) and circles (⭕)
- **Image Upload** (📁): Import JPG, PNG, SVG files

### Layer Management
- **Toggle visibility** with eye icon
- **Adjust opacity** with slider controls
- **Reorder layers** by z-index
- **Select active layer** for editing
- **Layer naming** and organization

### AI Assistant Features
- **Design Tips**: "How can I improve this layout?"
- **Color Advice**: "What colors work well with blue?"
- **Filter Suggestions**: "Which filters suit portrait photos?"
- **Creative Ideas**: "Give me ideas for a logo design"

### Collaboration
- **Real-time editing** with other users
- **Cursor tracking** shows collaborator actions
- **Live synchronization** of all changes
- **WebSocket-based** instant updates

## 🔧 Configuration Options

### Canvas Settings
```javascript
// Default canvas configuration
const canvasConfig = {
  width: 1920,
  height: 1080,
  backgroundColor: '#ffffff'
};
```

### Brush Settings
```javascript
// Customizable brush options
const brushSettings = {
  size: 1-50,        // Brush size range
  color: '#000000',  // Hex color codes
  opacity: 0.1-1.0   // Transparency level
};
```

### AI Model Configuration
```python
# Backend Gemini model selection
GEMINI_MODEL = "gemini-2.0-flash"  # Change in environment or code
```

## 🐛 Troubleshooting

### Common Issues

#### "AI assistant is not configured"
```
Error: AI assistant is not configured. Please add GEMINI_API_KEY to environment variables.
```
**Solution**: Add your Gemini API key to `/app/backend/.env` and restart the backend server.

#### Canvas not loading
**Solution**: Ensure Fabric.js is properly installed:
```bash
cd frontend
yarn add fabric@5.3.0
```

#### WebSocket connection failed
**Solution**: Check if backend is running on correct port:
```bash
# Verify backend is running
curl http://localhost:8001/api/health
```

#### MongoDB connection error
**Solution**: Ensure MongoDB is running:
```bash
# Local MongoDB
mongod

# Or check your MONGO_URL in .env
```

#### Image upload not working
**Solution**: Check file size limits and formats. Supported: JPG, PNG, SVG up to 10MB.

### Performance Optimization

#### Large Image Handling
- Use **chunked uploads** for files >5MB
- Enable **image compression** in browser
- Implement **progressive loading**

#### Canvas Performance
```javascript
// Optimize canvas rendering
canvas.renderOnAddRemove = false;
canvas.skipTargetFind = true; // When not interactive
canvas.selection = false;     // Disable selection when not needed
```

## 🚀 Deployment

### Environment Setup
1. **Production Environment Variables**
```env
# Backend (.env)
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/pixelcrafter
JWT_SECRET=super-secure-production-secret-key
GEMINI_API_KEY=your-production-gemini-key

# Frontend (.env.production)
REACT_APP_BACKEND_URL=https://your-backend-domain.com
```

### Docker Deployment
```dockerfile
# Use provided Dockerfile
docker build -t pixelcrafter .
docker run -p 3000:3000 -p 8001:8001 pixelcrafter
```

### Cloud Deployment Options

#### Vercel (Frontend)
```bash
# Deploy frontend
cd frontend
npx vercel --prod
```

#### Railway/Render (Backend)
```bash
# Deploy backend
cd backend
railway up  # or render deploy
```

#### MongoDB Atlas (Database)
1. Create cluster at https://cloud.mongodb.com
2. Get connection string
3. Update MONGO_URL in production environment

## 📁 Project Structure

```
pixelcrafter/
├── 📁 backend/                 # FastAPI backend
│   ├── server.py              # Main application
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment variables
├── 📁 frontend/               # React frontend
│   ├── 📁 src/
│   │   ├── App.js            # Main component
│   │   ├── App.css           # Styles
│   │   └── index.js          # Entry point
│   ├── 📁 public/            # Static assets
│   ├── package.json          # Node dependencies
│   ├── tailwind.config.js    # Tailwind configuration
│   └── .env                  # Environment variables
├── 📁 tests/                 # Test files
├── 📁 scripts/               # Utility scripts
├── docker-compose.yml        # Container orchestration
├── Dockerfile               # Container definition
└── README.md               # This file
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### Image Operations
- `POST /api/projects/{id}/upload-image` - Upload image
- `POST /api/projects/{id}/filters/blur` - Apply blur filter
- `POST /api/projects/{id}/filters/brightness` - Adjust brightness
- `POST /api/projects/{id}/export` - Export project

### AI Assistant
- `POST /api/chat` - Send message to AI
- `GET /api/chat/history/{session_id}` - Get chat history

### Collaboration
- `WebSocket /api/ws/collaborate/{project_id}` - Real-time collaboration

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Style
- **Frontend**: ESLint + Prettier
- **Backend**: Black + isort
- **Commits**: Conventional commits format

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Fabric.js** for canvas manipulation
- **TailwindCSS** for styling framework
- **FastAPI** for backend framework
- **Google Gemini** for AI capabilities
- **MongoDB** for database solution

## 📞 Support

- **Issues**: Create GitHub issue
- **Discussions**: GitHub Discussions
- **Email**: support@pixelcrafter.com

---

**Built with ❤️ by the PixelCrafter team**

*Happy editing! 🎨*
