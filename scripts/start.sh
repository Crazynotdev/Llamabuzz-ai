#!/bin/bash
echo "🤖 Démarrage de LlamaBuzz AI..."

# Backend
cd backend
npm start &
BACKEND_PID=$!

# Frontend
cd ../frontend
npm start &
FRONTEND_PID=$!

echo "✅ Backend: http://localhost:3001"
echo "✅ Frontend: http://localhost:3000"
echo "📱 App prête pour Capacitor"

wait $BACKEND_PID $FRONTEND_PID
