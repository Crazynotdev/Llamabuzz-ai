// Moteur IA local si backend indisponible
class LocalAIEngine {
  constructor() {
    this.knowledge = [];
    this.context = [];
  }

  async generateResponse(input, memory, personality) {
    const lower = input.toLowerCase();
    
    let response = "";
    
    if(lower.includes("bonjour") || lower.includes("salut")) {
      response = "Bonjour ! 🌟 Je suis ton assistant IA locale. Comment puis-je t'aider aujourd'hui ?";
    }
    else if(lower.includes("mémoire") || lower.includes("souviens")) {
      if(memory.length > 0) {
        const facts = memory.map(m => `- ${m.fact}`).join("\n");
        response = `📚 Voici ce dont je me souviens :\n${facts}`;
      } else {
        response = "Je n'ai pas encore de souvenirs. Parle-moi de toi, je retiendrai !";
      }
    }
    else if(lower.includes("apprend") || lower.includes("entraîne")) {
      response = "💡 J'apprends en continu ! Plus on parle, plus je deviens intelligent. Chaque conversation m'améliore.";
    }
    else {
      const templates = [
        `Intéressant ! ${memory.length > 0 ? "En me rappelant ce que tu m'as dit précédemment, " : ""}je pense que...`,
        `Merci pour ton message. Basé sur notre conversation, voici mon analyse...`,
        `Excellente réflexion ! Continue à me parler, je mémorise tout pour mieux t'aider.`
      ];
      response = templates[Math.floor(Math.random() * templates.length)];
      response += ` (Mode ${personality} activé)`;
    }
    
    return response;
  }
}

export const localAI = new LocalAIEngine();
