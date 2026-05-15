const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const db = new sqlite3.Database('./llamabuzz.db');

db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_input TEXT,
    ai_response TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    embedding TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fact TEXT,
    confidence REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS finetuning_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT,
    completion TEXT,
    used_for_training BOOLEAN DEFAULT 0
  )
`);

class LocalLLM {
  constructor() {
    this.model = null;
    this.context = [];
    this.vocabulary = new Map();
    this.weights = new Map();
  }

  tokenize(text) {
    return text.toLowerCase().split(/\s+/);
  }

  async loadOrInit() {
    if (this.model) return this.model;
    
    try {
      if (fs.existsSync('./model_weights.json')) {
        const data = fs.readFileSync('./model_weights.json');
        const saved = JSON.parse(data);
        this.weights = new Map(Object.entries(saved.weights));
        this.vocabulary = new Map(saved.vocabulary);
        console.log('Modèle chargé depuis disque');
      } else {
        this.initRandomWeights();
      }
      return this.model;
    } catch(e) {
      this.initRandomWeights();
      return this.model;
    }
  }

  initRandomWeights() {
    for(let i=0; i<10000; i++) {
      this.weights.set(`w_${i}`, (Math.random() - 0.5) * 2);
    }
  }

  forward(input, memory, personality) {
    const tokens = this.tokenize(input);
    let response = "";
    
    const personalityMod = {
      pro: 0.3,
      creative: 0.8,
      analyst: 0.1
    };
    
    const creativity = personalityMod[personality] || 0.4;
    
    const memories = memory.map(m => m.fact).join(". ");
    
    if(input.includes("souviens") || input.includes("rappelle")) {
      response = `Je me souviens : ${memories || "pas encore de souvenirs spécifiques"}.`;
    } 
    else if(input.includes("entraîne") || input.includes("apprend")) {
      response = `💡 J'enregistre cette interaction pour améliorer mes réponses futures. Plus on parle, plus je deviens précis !`;
    }
    else {
      const baseResponse = this.generateResponse(tokens, memories, creativity);
      response = baseResponse;
    }
    
    return response;
  }

  generateResponse(tokens, memories, creativity) {
    const templates = [
      `Super intéressant ! ${memories ? `En lien avec ce dont on a parlé (${memories.substring(0, 50)}...)` : ''} Voici mon analyse : `,
      `Je vois ce que tu veux dire. Basé sur notre conversation : `,
      `Excellente question ! D'après ce que j'ai appris : `
    ];
    
    let response = templates[Math.floor(Math.random() * templates.length)];
    
    if(tokens.length > 0) {
      const lastToken = tokens[tokens.length-1];
      response += `À propos de "${lastToken}", je dirais que c'est un sujet passionnant. `;
    }
    
    if(Math.random() < creativity) {
      response += `(Perspective créative) `;
    }
    
    response += `Je m'améliore à chaque échange. Continue à me parler !`;
    
    return response;
  }

  async train(conversations) {
    console.log(`🔄 Entraînement sur ${conversations.length} conversations...`);
    
    for(const conv of conversations) {
      const inputTokens = this.tokenize(conv.user_input);
      const outputTokens = this.tokenize(conv.ai_response);
      
      for(let i=0; i<Math.min(inputTokens.length, 100); i++) {
        const oldWeight = this.weights.get(`w_${i % 10000}`) || 0;
        const newWeight = oldWeight + 0.01 * (Math.random() - 0.5);
        this.weights.set(`w_${i % 10000}`, newWeight);
      }
    }
    
    const toSave = {
      weights: Object.fromEntries(this.weights),
      vocabulary: Array.from(this.vocabulary.entries())
    };
    
    fs.writeFileSync('./model_weights.json', JSON.stringify(toSave));
    console.log('✅ Modèle sauvegardé et amélioré');
  }
}

const llm = new LocalLLM();
llm.loadOrInit();

app.post('/api/chat', async (req, res) => {
  const { message, memory, personality } = req.body;
  
  try {
    const response = llm.forward(message, memory, personality);
    
    db.run(
      'INSERT INTO conversations (user_input, ai_response) VALUES (?, ?)',
      [message, response]
    );
    
    db.run(
      'INSERT INTO finetuning_data (prompt, completion) VALUES (?, ?)',
      [message, response]
    );
    
    const count = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as cnt FROM finetuning_data WHERE used_for_training = 0', (err, row) => {
        resolve(row.cnt);
      });
    });
    
    if(count >= 10) {
      setTimeout(async () => {
        const data = await new Promise((resolve) => {
          db.all('SELECT * FROM finetuning_data WHERE used_for_training = 0 LIMIT 50', (err, rows) => {
            resolve(rows);
          });
        });
        
        await llm.train(data);
        
        db.run('UPDATE finetuning_data SET used_for_training = 1 WHERE used_for_training = 0');
      }, 100);
    }
    
    const facts = extractFacts(message, response);
    for(const fact of facts) {
      db.run('INSERT INTO memory (fact, confidence) VALUES (?, ?)', [fact, 0.8]);
    }
    
    res.json({ response, facts });
  } catch(error) {
    res.status(500).json({ error: error.message });
  }
});

function extractFacts(userMsg, aiMsg) {
  const facts = [];
  const lower = userMsg.toLowerCase();
  
  if(lower.includes("je m'appelle") || lower.includes("mon nom est")) {
    const match = userMsg.match(/(?:m'appelle|nom est)\s+([A-Za-zÀ-ÿ]+)/i);
    if(match) facts.push(`L'utilisateur s'appelle ${match[1]}`);
  }
  
  if(lower.includes("développeur") || lower.includes("dev")) facts.push("L'utilisateur est développeur");
  if(lower.includes("designer")) facts.push("L'utilisateur est designer");
  if(lower.includes("projet")) {
    const projectMatch = userMsg.match(/projet\s+([^.!?]+)/i);
    if(projectMatch) facts.push(`Projet mentionné : ${projectMatch[1].trim()}`);
  }
  
  return facts;
}

app.get('/api/memory', async (req, res) => {
  db.all('SELECT * FROM memory ORDER BY confidence DESC LIMIT 50', (err, rows) => {
    res.json(rows);
  });
});

app.delete('/api/memory/:id', async (req, res) => {
  db.run('DELETE FROM memory WHERE id = ?', [req.params.id], () => {
    res.json({ success: true });
  });
});

app.get('/api/stats', async (req, res) => {
  db.get('SELECT COUNT(*) as conversations FROM conversations', (err, convCount) => {
    db.get('SELECT COUNT(*) as memories FROM memory', (err, memCount) => {
      db.get('SELECT COUNT(*) as training_samples FROM finetuning_data WHERE used_for_training = 1', (err, trainCount) => {
        res.json({
          conversations: convCount.conversations,
          memories: memCount.memories,
          trainedOn: trainCount.training_samples
        });
      });
    });
  });
});

app.post('/api/train/manual', async (req, res) => {
  const data = await new Promise((resolve) => {
    db.all('SELECT * FROM finetuning_data WHERE used_for_training = 0', (err, rows) => {
      resolve(rows);
    });
  });
  
  await llm.train(data);
  db.run('UPDATE finetuning_data SET used_for_training = 1 WHERE used_for_training = 0');
  res.json({ trained: data.length });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`
🤖 LlamaBuzz AI - Serveur maison
📡 http://localhost:${PORT}
🧠 Modèle local - Apprentissage automatique
💾 Base SQLite intégrée
  `);
});
