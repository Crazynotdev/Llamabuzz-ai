#!/bin/bash
echo "🚀 Installation de LlamaBuzz CrazyTech AI"

# Backend
cd backend
npm install
echo "✅ Backend installé"

# Frontend
cd ../frontend
npm install
echo "✅ Frontend installé"

# Dossier pour les modèles
mkdir -p ../models
mkdir -p ../data

echo "🎉 Installation terminée !"
echo "Lancement : ./start.sh"
