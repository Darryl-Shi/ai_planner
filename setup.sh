#!/bin/bash

echo "🚀 Setting up AI Calendar Assistant..."
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env with your credentials:"
echo "   - Google OAuth credentials from https://console.cloud.google.com/"
echo "   - OpenRouter API key from https://openrouter.ai/keys"
echo ""
echo "2. Run the backend:"
echo "   cd backend && npm run dev"
echo ""
echo "3. Run the frontend (in a new terminal):"
echo "   cd frontend && npm run dev"
echo ""
echo "4. Open http://localhost:5173 in your browser"
echo ""
