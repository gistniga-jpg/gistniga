const RiveScript = require('rivescript');
const path = require('path');

class ChatBot {
  constructor() {
    this.bot = new RiveScript({ utf8: true });
  }

  async load() {
    const brainPath = path.join(__dirname, 'brain');
    try {
      await this.bot.loadDirectory(brainPath);
      this.bot.sortReplies();
      console.log('[CHATBOT] Brain loaded successfully.');
    } catch (error) {
      console.error('[CHATBOT] Error loading brain:', error);
    }
  }

  async getReply(username, message) {
    if (!username || !message) return '...';
    try {
      const reply = await this.bot.reply(username, message);
      return reply;
    } catch (error) {
      console.error(`[CHATBOT] Error getting reply for user ${username}:`, error);
      return "I'm sorry, I seem to be having some trouble thinking right now.";
    }
  }
}

// Create and export a single instance of the ChatBot
module.exports = new ChatBot();