const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// إعدادات الخادم
const PORT = process.env.PORT || 3000;

// استخدام CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ التغيير 1: خدمة الملفات الثابتة من المجلد الحالي (بدون public/)
app.use(express.static(__dirname));

// ✅ التغيير 2: إدارة الألعاب النشطة مع تحسينات
const activeGames = {};
const waitingPlayers = [];

// ✅ التغيير 3: التحقق من وجود index.html وإرساله مباشرة
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>خادم جولة سعودية</title>
        <style>
          * { font-family: 'Arial', sans-serif; box-sizing: border-box; }
          body { margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; color: white; }
          .container { max-width: 600px; padding: 40px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2); }
          h1 { font-size: 2.5rem; margin-bottom: 20px; }
          .status { display: inline-block; padding: 10px 20px; background: rgba(16, 185, 129, 0.8); border-radius: 50px; font-weight: bold; margin: 20px 0; }
          .info { background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: right; }
          .warning { background: rgba(255, 193, 7, 0.2); padding: 15px; border-radius: 10px; margin: 20px 0; border-right: 5px solid #ffc107; }
          .links a { display: inline-block; margin: 10px; padding: 12px 24px; background: rgba(255, 255, 255, 0.2); color: white; text-decoration: none; border-radius: 10px; transition: all 0.3s; }
          .links a:hover { background: rgba(255, 255, 255, 0.3); transform: translateY(-2px); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 خادم جولة سعودية</h1>
          <p>خادم اللعبة التفاعلية يعمل بنجاح!</p>
          
          <div class="warning">
            <strong>⚠️ ملاحظة:</strong> ملف index.html غير موجود في المجلد الرئيسي
            <br>قم بوضع ملف index.html في نفس مجلد server.js
          </div>
          
          <div class="status">✅ حالة الخادم: نشط</div>
          
          <div class="info">
            <h3>📊 معلومات الخادم:</h3>
            <p>🆔 البورت: ${PORT}</p>
            <p>🔗 عنوان URL: ${req.protocol}://${req.get('host')}</p>
            <p>📁 المسار الحالي: ${__dirname}</p>
            <p>👥 اتصالات Socket: ${Object.keys(io.sockets.sockets).length || 0}</p>
            <p>🎮 ألعاب نشطة: ${Object.keys(activeGames).length}</p>
            <p>⏳ لاعبين في الانتظار: ${waitingPlayers.length}</p>
          </div>
          
          <div class="links">
            <a href="/" onclick="location.reload()">🔄 تحديث الصفحة</a>
            <a href="/files">📁 عرض الملفات</a>
            <a href="/socket.io/socket.io.js">📦 ملف Socket.io</a>
          </div>
        </div>
        
        <script src="/socket.io/socket.io.js"></script>
        <script>
          const socket = io();
          socket.on('connect', () => console.log('✅ متصل بالخادم'));
        </script>
      </body>
      </html>
    `);
  }
});

// ✅ التغيير 4: نقطة نهاية لفحص الملفات
app.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(__dirname);
    res.json({
      currentDirectory: __dirname,
      files: files,
      hasIndexHtml: fs.existsSync(path.join(__dirname, 'index.html')),
      serverUptime: process.uptime(),
      activeGames: Object.keys(activeGames).length,
      waitingPlayers: waitingPlayers.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ التغيير 5: كل الطلبات الأخرى ترجع إلى index.html إذا موجود
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>404 - الصفحة غير موجودة</h1>
      <p>ملف index.html غير موجود في: ${__dirname}</p>
      <a href="/files">📁 عرض الملفات المتاحة</a>
    `);
  }
});

// ✅ التغيير 6: دالة للتحقق من سلامة حالة اللعبة
function validateGameState(game) {
  if (!game || !game.state || !game.players || game.players.length === 0) {
    return false;
  }
  
  // التحقق من أن currentPlayerIndex ضمن النطاق
  if (game.state.currentPlayerIndex < 0 || 
      game.state.currentPlayerIndex >= game.players.length) {
    console.log(`⚠️ إصلاح currentPlayerIndex للعبة ${game.gameId}`);
    game.state.currentPlayerIndex = 0;
    game.state.version = (game.state.version || 0) + 1;
  }
  
  // التأكد من وجود اتجاه صحيح
  if (Math.abs(game.state.direction) !== 1) {
    game.state.direction = 1;
  }
  
  // تحديث الطابع الزمني
  game.state.timestamp = Date.now();
  game.lastActivity = Date.now();
  
  return true;
}

// ✅ التغيير 7: دالة لإعادة تعيين الأدوار بشكل صحيح
function resetGameTurns(game) {
  if (!game || !game.players || game.players.length === 0) return;
  
  // التأكد من أن currentPlayerIndex صحيح
  if (game.state.currentPlayerIndex >= game.players.length) {
    game.state.currentPlayerIndex = 0;
  }
  
  if (game.state.currentPlayerIndex < 0) {
    game.state.currentPlayerIndex = 0;
  }
  
  // التأكد من أن الاتجاه صحيح
  if (Math.abs(game.state.direction) !== 1) {
    game.state.direction = 1;
  }
  
  game.state.version = (game.state.version || 0) + 1;
  game.lastActivity = Date.now();
}

// ✅ التغيير 8: دالة للعثور على لعبة اللاعب مع تحسينات
function findPlayerGame(socketId) {
  for (const gameId in activeGames) {
    const game = activeGames[gameId];
    if (game && game.players && game.players.some(p => p.socketId === socketId)) {
      return game;
    }
  }
  return null;
}

// ✅ التغيير 9: دالة لإنشاء مجموعة بطاقات محسنة
function createDeck() {
  const deck = [];
  const cities = ['مكة', 'المدينة المنورة', 'الرياض', 'جدة', 'الدمام', 'الدرعية', 'أبها', 'العلا', 'نيوم'];
  const colors = ['أحمر', 'أزرق', 'أخضر', 'أصفر'];
  
  // إنشاء 82 بطاقة متنوعة
  for (let i = 0; i < 82; i++) {
    deck.push({
      id: `card_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      type: i < 40 ? 'city' : 'special',
      color: colors[i % 4],
      city: cities[i % 9],
      value: (i % 9) + 1,
      timestamp: Date.now()
    });
  }
  
  // خلط البطاقات
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

// ✅ التغيير 10: دالة لحساب checksum محسنة
function calculateChecksum(state) {
  const data = JSON.stringify({
    players: state.players ? state.players.map(p => ({id: p.id, name: p.name})) : [],
    currentCard: state.currentCard ? state.currentCard.id : null,
    version: state.version || 0,
    currentPlayerIndex: state.currentPlayerIndex || 0
  });
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36) + '_' + Date.now().toString(36);
}

// ✅ التغيير 11: دالة لمطابقة اللاعبين محسنة
function tryMatchPlayers() {
  const eligiblePlayers = waitingPlayers.filter(player => {
    const socket = io.sockets.sockets.get(player.socketId);
    return socket && socket.connected;
  });
  
  if (eligiblePlayers.length >= 2) {
    console.log(`🤝 مطابقة ${eligiblePlayers.length} لاعبين...`);
    
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const players = eligiblePlayers.splice(0, 2);
    
    // إزالة اللاعبين من قائمة الانتظار الأصلية
    players.forEach(player => {
      const index = waitingPlayers.findIndex(p => p.socketId === player.socketId);
      if (index !== -1) waitingPlayers.splice(index, 1);
    });
    
    // إنشاء حالة اللعبة
    const gameState = {
      version: 1,
      players: players.map((p, index) => ({
        id: p.socketId,
        name: p.playerName,
        hand: [],
        announced: false,
        icon: p.icon,
        color: p.color,
        isAI: false,
        socketId: p.socketId,
        isOnline: true,
        isLocal: false,
        playerIndex: index
      })),
      currentCard: null,
      currentPlayerIndex: 0,
      direction: 1,
      deckCount: 82,
      phase: 'starting',
      timestamp: Date.now(),
      checksum: '',
      gameId: gameId,
      localPlayerIndex: 0,
      maxPlayers: 2,
      gameStarted: false
    };
    
    // إنشاء كائن اللعبة
    const game = {
      gameId: gameId,
      players: players,
      state: gameState,
      deck: createDeck(),
      created: Date.now(),
      lastSync: Date.now(),
      lastActivity: Date.now()
    };
    
    // توزيع البطاقات
    game.players.forEach((player, index) => {
      const playerState = gameState.players.find(p => p.id === player.socketId);
      if (playerState) {
        playerState.hand = game.deck.splice(0, 5).map((card, i) => ({
          ...card,
          handIndex: i,
          playerId: player.socketId
        }));
      }
    });
    
    // اختيار بطاقة بداية
    const validCards = game.deck.filter(card => card.type === "city");
    if (validCards.length > 0) {
      gameState.currentCard = validCards[0];
      const cardIndex = game.deck.findIndex(c => c.id === validCards[0].id);
      if (cardIndex !== -1) game.deck.splice(cardIndex, 1);
    } else if (game.deck.length > 0) {
      gameState.currentCard = game.deck.pop();
    }
    
    gameState.deckCount = game.deck.length;
    gameState.checksum = calculateChecksum(gameState);
    
    // التحقق من سلامة الحالة قبل الحفظ
    if (validateGameState(game)) {
      activeGames[gameId] = game;
      
      // إعلام اللاعبين
      players.forEach((player, index) => {
        const socket = io.sockets.sockets.get(player.socketId);
        if (socket) {
          socket.join(gameId);
          
          const playerSpecificState = {
            ...gameState,
            localPlayerIndex: index,
            myPlayerId: player.socketId,
            myHand: gameState.players[index].hand,
            serverTime: new Date().toISOString()
          };
          
          socket.emit('game-found', {
            gameId: gameId,
            players: game.players.map(p => ({
              name: p.playerName,
              icon: p.icon,
              color: p.color,
              socketId: p.socketId,
              isOnline: true
            })),
            state: playerSpecificState,
            localPlayerIndex: index,
            message: 'تم العثور على لعبة!',
            serverTime: new Date().toISOString()
          });
          
          console.log(`✅ ${player.socketId} انضم للعبة ${gameId}`);
        }
      });
      
      // بدء اللعبة بعد تأخير
      setTimeout(() => {
        io.to(gameId).emit('game-started', {
          gameId: gameId,
          currentCard: gameState.currentCard,
          currentPlayerIndex: 0,
          direction: 1,
          message: 'بدأت اللعبة! دور اللاعب الأول',
          turnOrder: gameState.players.map(p => p.name),
          timestamp: Date.now()
        });
        game.state.gameStarted = true;
      }, 2000);
      
      console.log(`🎮 لعبة جديدة: ${gameId} مع ${players.length} لاعبين`);
    } else {
      console.log(`❌ فشل إنشاء لعبة ${gameId}`);
      waitingPlayers.push(...players);
    }
  }
}

// ✅ التغيير 12: معالجة اتصالات Socket.io مع تحسينات
io.on('connection', (socket) => {
  console.log(`👤 لاعب جديد متصل: ${socket.id}`);
  
  // ✅ إرسال ترحيب مع تأخير بسيط
  setTimeout(() => {
    socket.emit('welcome', {
      message: 'مرحباً بك في جولة سعودية!',
      serverTime: new Date().toISOString(),
      playerId: socket.id,
      activeGames: Object.keys(activeGames).length,
      waitingPlayers: waitingPlayers.length,
      connectionId: socket.id,
      timestamp: Date.now()
    });
  }, 300);
  
  // ✅ حدث جديد للتحقق من حالة اللعبة
  socket.on('check-game-status', (data) => {
    const game = findPlayerGame(socket.id);
    
    if (game && validateGameState(game)) {
      socket.emit('game-status-response', {
        hasGame: true,
        gameId: game.gameId,
        players: game.players.map(p => p.playerName),
        currentPlayerIndex: game.state.currentPlayerIndex,
        gameStarted: game.state.gameStarted || false,
        timestamp: Date.now()
      });
    } else {
      socket.emit('game-status-response', {
        hasGame: false,
        message: 'لا توجد لعبة نشطة',
        suggestions: ['انقر على "البحث عن لعبة" للبدء'],
        timestamp: Date.now()
      });
    }
  });
  
  // البحث عن لعبة
  socket.on('find-game-enhanced', (data) => {
    console.log(`🔍 ${socket.id} يبحث عن لعبة:`, data.playerName);
    
    const playerInfo = {
      socketId: socket.id,
      playerName: data.playerName || `لاعب_${socket.id.substr(0, 5)}`,
      icon: data.icon || '👤',
      color: data.color || '#667eea',
      playerCount: data.playerCount || 2,
      clientInfo: data.clientInfo || {},
      timestamp: Date.now()
    };
    
    waitingPlayers.push(playerInfo);
    
    socket.emit('search-status', {
      status: 'waiting',
      position: waitingPlayers.length,
      message: 'جاري البحث عن لاعبين...',
      timestamp: Date.now()
    });
    
    tryMatchPlayers();
  });
  
  // إلغاء البحث
  socket.on('cancel-search', () => {
    const index = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (index !== -1) waitingPlayers.splice(index, 1);
    
    socket.emit('search-cancelled', {
      message: 'تم إلغاء البحث عن لعبة',
      timestamp: Date.now()
    });
  });
  
  // ✅ طلب مزامنة كاملة محسن
  socket.on('request-full-sync', (data) => {
    console.log(`🔄 ${socket.id} طلب مزامنة كاملة`);
    
    const game = findPlayerGame(socket.id);
    
    if (game && validateGameState(game)) {
      socket.emit('full-state-sync', {
        ...game.state,
        debugInfo: {
          playersCount: game.players.length,
          playerIndex: game.players.findIndex(p => p.socketId === socket.id),
          serverTime: new Date().toISOString(),
          version: game.state.version || 1
        }
      });
    } else {
      socket.emit('no-active-game-info', {
        code: 'NO_GAME',
        message: 'لا توجد لعبة نشطة للاعب',
        suggestions: [
          'انقر على "البحث عن لعبة" للبدء',
          'تحقق من اتصال الشبكة',
          'جرب تحديث الصفحة'
        ],
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // طلب مزامنة اللاعبين
  socket.on('request-player-sync', (data) => {
    const game = findPlayerGame(socket.id);
    
    if (game) {
      socket.emit('player-list-update', {
        players: game.players,
        timestamp: Date.now(),
        gameId: game.gameId
      });
    }
  });
  
  // لعب بطاقة
  socket.on('play-card', (data) => {
    const game = findPlayerGame(socket.id);
    
    if (!game) {
      socket.emit('sync-error', {
        code: 'NO_GAME',
        message: 'لا توجد لعبة نشطة'
      });
      return;
    }
    
    // التحقق من أن الدور للاعب
    const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex !== game.state.currentPlayerIndex) {
      socket.emit('invalid-move', {
        message: 'ليس دورك للعب'
      });
      return;
    }
    
    // تحديث حالة اللعبة
    game.state.version = (game.state.version || 0) + 1;
    game.state.timestamp = Date.now();
    game.lastActivity = Date.now();
    
    // بث التحديث لجميع اللاعبين
    io.to(game.gameId).emit('game-state-update', {
      players: game.players,
      currentCard: data.card,
      currentPlayerIndex: game.state.currentPlayerIndex,
      direction: game.state.direction,
      deckCount: game.deck.length,
      version: game.state.version,
      timestamp: Date.now()
    });
    
    // تحديث الدور
    let nextPlayerIndex = (game.state.currentPlayerIndex + game.state.direction) % game.players.length;
    if (nextPlayerIndex < 0) nextPlayerIndex = game.players.length - 1;
    
    game.state.currentPlayerIndex = nextPlayerIndex;
    game.state.version++;
    game.lastActivity = Date.now();
    
    io.to(game.gameId).emit('turn-update', {
      currentPlayerIndex: nextPlayerIndex,
      direction: game.state.direction,
      timestamp: Date.now(),
      playerName: game.players[nextPlayerIndex]?.playerName
    });
  });
  
  // تحديث حالة من العميل
  socket.on('state-update-ack', (data) => {
    const game = findPlayerGame(socket.id);
    
    if (game && game.state.version === data.version) {
      game.lastSync = Date.now();
      game.lastActivity = Date.now();
    }
  });
  
  // إرسال نبض التزامن
  socket.on('sync-ping', (data) => {
    socket.emit('sync-pong', {
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      gameId: data.gameId,
      latency: Date.now() - (data.clientTimestamp || Date.now())
    });
  });
  
  // انضمام لاعب لغرفة
  socket.on('join-game', (data) => {
    if (activeGames[data.gameId]) {
      socket.join(data.gameId);
      socket.emit('game-joined', {
        gameId: data.gameId,
        players: activeGames[data.gameId].players,
        state: activeGames[data.gameId].state,
        timestamp: Date.now()
      });
    }
  });
  
  // قطع الاتصال
  socket.on('disconnect', (reason) => {
    console.log(`👋 ${socket.id} انقطع: ${reason}`);
    
    // إزالة من قائمة الانتظار
    const waitIndex = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (waitIndex !== -1) waitingPlayers.splice(waitIndex, 1);
    
    // التعامل مع الألعاب النشطة
    const game = findPlayerGame(socket.id);
    
    if (game) {
      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
      
      if (playerIndex !== -1) {
        const playerName = game.players[playerIndex].playerName;
        
        // إزالة اللاعب من اللعبة
        game.players.splice(playerIndex, 1);
        
        // إذا كان اللاعب المنقطع هو صاحب الدور الحالي، انتقل للاعب التالي
        if (playerIndex === game.state.currentPlayerIndex) {
          game.state.currentPlayerIndex = game.state.currentPlayerIndex % game.players.length;
        }
        
        // إعلام اللاعبين الآخرين
        io.to(game.gameId).emit('player-left', {
          playerName: playerName,
          players: game.players,
          message: `${playerName} غادر اللعبة`,
          timestamp: Date.now()
        });
        
        // إذا بقي لاعب واحد فقط، إنهاء اللعبة
        if (game.players.length <= 1) {
          if (game.players.length === 1) {
            io.to(game.gameId).emit('game-ended', {
              winner: game.players[0].playerName,
              reason: 'غادر جميع اللاعبين الآخرين',
              timestamp: Date.now()
            });
          }
          
          delete activeGames[game.gameId];
          console.log(`🗑️ تم حذف اللعبة ${game.gameId}`);
        }
      }
    }
  });
  
  // ✅ إرسال حالة الخادم كل 30 ثانية بدلاً من دقيقة
  const statusInterval = setInterval(() => {
    socket.emit('server-status', {
      uptime: process.uptime(),
      activeGames: Object.keys(activeGames).length,
      waitingPlayers: waitingPlayers.length,
      totalConnections: Object.keys(io.sockets.sockets).length,
      timestamp: new Date().toISOString(),
      serverTime: new Date().toLocaleString('ar-SA')
    });
  }, 30000);
  
  socket.on('disconnect', () => {
    clearInterval(statusInterval);
  });
});

// ✅ التغيير 13: استدعاء resetGameTurns دورياً كل 30 ثانية
setInterval(() => {
  for (const gameId in activeGames) {
    const game = activeGames[gameId];
    if (game && Date.now() - game.lastActivity > 30000) { // 30 ثانية بدون نشاط
      resetGameTurns(game);
    }
  }
}, 30000);

// ✅ التغيير 14: تنظيف الألعاب الميتة كل دقيقة
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const gameId in activeGames) {
    const game = activeGames[gameId];
    // إذا مرت 5 دقائق بدون نشاط أو لا يوجد لاعبين
    if (now - game.lastActivity > 300000 || 
        !game.players || 
        game.players.length === 0) {
      delete activeGames[gameId];
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 تم تنظيف ${cleanedCount} لعبة ميتة`);
  }
}, 60000);

// ✅ التغيير 15: بدء الخادم مع تحسينات
server.listen(PORT, () => {
  console.log(`
  🚀 خادم جولة سعودية يعمل!
  📍 البورت: ${PORT}
  🌐 العنوان: http://localhost:${PORT}
  📁 المجلد الحالي: ${__dirname}
  🕒 الوقت: ${new Date().toLocaleString('ar-SA')}
  
  📊 إحصائيات بدء التشغيل:
  👥 اتصالات نشطة: ${Object.keys(io.sockets.sockets).length}
  🎮 ألعاب نشطة: ${Object.keys(activeGames).length}
  ⏳ لاعبين في الانتظار: ${waitingPlayers.length}
  ✅ index.html موجود: ${fs.existsSync(path.join(__dirname, 'index.html'))}
  `);
  
  if (!fs.existsSync(path.join(__dirname, 'index.html'))) {
    console.log('⚠️  تحذير: ملف index.html غير موجود في المجلد الحالي!');
    console.log('📁 قم بإنشاء ملف index.html في: ', __dirname);
  }
});

// ✅ التغيير 16: معالجة إغلاق الخادم مع تحسينات
process.on('SIGINT', () => {
  console.log('\n👋 إغلاق الخادم...');
  
  // إعلام جميع اللاعبين
  io.emit('server-shutdown', {
    message: 'يتم إغلاق الخادم للصيانة',
    timestamp: new Date().toISOString(),
    reconnectAfter: 60 // إعادة الاتصال بعد 60 ثانية
  });
  
  // حفظ حالة الألعاب قبل الإغلاق (اختياري)
  const backupFile = path.join(__dirname, `games_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    activeGames: activeGames,
    waitingPlayers: waitingPlayers,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log(`📁 تم حفظ نسخة احتياطية في: ${backupFile}`);
  
  setTimeout(() => {
    server.close(() => {
      console.log('✅ تم إيقاف السيرفر بنجاح');
      process.exit(0);
    });
  }, 2000);
});

// ✅ التغيير 17: معالجة أخطاء غير متوقعة
process.on('uncaughtException', (error) => {
  console.error('💥 خطأ غير متوقع:', error);
  // لا نوقف السيرفر بل نسجل الخطأ فقط
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 وعد مرفوض:', reason);
});