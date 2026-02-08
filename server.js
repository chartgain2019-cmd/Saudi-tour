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
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// إعدادات الخادم
const PORT = process.env.PORT || 3000;

// استخدام CORS
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ خدمة الملفات الثابتة من المجلد الحالي (بدون public/)
app.use(express.static(__dirname));

// ✅ إدارة الألعاب النشطة
const activeGames = {};
const waitingPlayers = [];

// ✅ التحقق من وجود index.html وإرساله مباشرة
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    // ✅ إضافة رؤوس CORS للصور
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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
          .fix-box { background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 10px; margin: 10px 0; }
        </style>
        <script src="https://unpkg.com/hotkeys-js/dist/hotkeys.min.js"></script>
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
          
          <div class="fix-box">
            <h3>🔧 الإصلاحات التلقائية:</h3>
            <p>✅ مكتبة hotkeys محملة</p>
            <p>✅ CORS مفعل للصور</p>
            <p>✅ نظام إصلاح الألعاب المعطلة يعمل</p>
          </div>
          
          <div class="links">
            <a href="/" onclick="location.reload()">🔄 تحديث الصفحة</a>
            <a href="/files">📁 عرض الملفات</a>
            <a href="/fix-games">🛠️ إصلاح الألعاب</a>
            <a href="/socket.io/socket.io.js">📦 ملف Socket.io</a>
          </div>
        </div>
        
        <script src="/socket.io/socket.io.js"></script>
        <script>
          const socket = io();
          socket.on('connect', () => {
            console.log('✅ متصل بالخادم - معرف الجلسة:', socket.id);
            document.getElementById('status').innerHTML = '✅ متصل - ' + socket.id;
          });
          
          // اختبار hotkeys
          if (typeof hotkeys !== 'undefined') {
            console.log('✅ مكتبة hotkeys جاهزة');
            hotkeys('ctrl+shift+s', function(event, handler) {
              event.preventDefault();
              console.log('اختصار تم تفعيله');
            });
          }
          
          // إضافة crossorigin للصور الديناميكية
          document.addEventListener('DOMContentLoaded', function() {
            const images = document.querySelectorAll('img[src*="i.ibb.co"]');
            images.forEach(img => {
              img.setAttribute('crossorigin', 'anonymous');
            });
          });
        </script>
      </body>
      </html>
    `);
  }
});

// ✅ نقطة نهاية لفحص الملفات
app.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(__dirname);
    res.json({
      currentDirectory: __dirname,
      files: files,
      hasIndexHtml: fs.existsSync(path.join(__dirname, 'index.html')),
      serverUptime: process.uptime(),
      activeGames: Object.keys(activeGames).length,
      waitingPlayers: waitingPlayers.length,
      socketConnections: Object.keys(io.sockets.sockets).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ نقطة نهاية لإصلاح الألعاب
app.get('/fix-games', (req, res) => {
  const brokenGames = [];
  const fixedGames = [];
  
  for (const gameId in activeGames) {
    const game = activeGames[gameId];
    let issues = [];
    
    if (!game) {
      delete activeGames[gameId];
      brokenGames.push({ gameId, issue: 'Game object is null' });
      continue;
    }
    
    // التحقق من المشاكل
    if (!game.players || !Array.isArray(game.players)) {
      issues.push('Players array is invalid');
      game.players = [];
    }
    
    if (!game.state) {
      issues.push('Game state is missing');
      game.state = createInitialGameState(gameId, game.players);
    }
    
    // إصلاح currentPlayerIndex
    if (game.state.currentPlayerIndex >= game.players.length || 
        game.state.currentPlayerIndex < 0) {
      issues.push(`currentPlayerIndex out of range: ${game.state.currentPlayerIndex}`);
      game.state.currentPlayerIndex = 0;
    }
    
    if (issues.length > 0) {
      brokenGames.push({ gameId, issues });
      validateAndFixGameState(game);
      fixedGames.push(gameId);
    }
  }
  
  // تنظيف قائمة الانتظار من اللاعبين غير المتصلين
  const initialWaitingCount = waitingPlayers.length;
  for (let i = waitingPlayers.length - 1; i >= 0; i--) {
    const player = waitingPlayers[i];
    const socket = io.sockets.sockets.get(player.socketId);
    if (!socket || !socket.connected) {
      waitingPlayers.splice(i, 1);
    }
  }
  
  res.json({
    message: 'تم إصلاح الألعاب',
    totalGames: Object.keys(activeGames).length,
    brokenGames: brokenGames.length,
    brokenGamesList: brokenGames,
    fixedGames: fixedGames,
    waitingPlayersRemoved: initialWaitingCount - waitingPlayers.length,
    currentWaitingPlayers: waitingPlayers.length,
    timestamp: new Date().toISOString()
  });
});

// ✅ كل الطلبات الأخرى ترجع إلى index.html إذا موجود
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>404 - الصفحة غير موجودة</h1>
      <p>ملف index.html غير موجود في: ${__dirname}</p>
      <a href="/files">📁 عرض الملفات المتاحة</a>
      <a href="/">🏠 العودة للصفحة الرئيسية</a>
    `);
  }
});

// ✅ دالة لإنشاء حالة لعبة ابتدائية
function createInitialGameState(gameId, players) {
  return {
    version: 1,
    players: players.map((p, index) => ({
      id: p.socketId,
      name: p.playerName || `لاعب_${index + 1}`,
      hand: [],
      icon: p.icon || '👤',
      color: p.color || '#667eea',
      isOnline: true,
      playerIndex: index,
      socketId: p.socketId
    })),
    currentCard: null,
    currentPlayerIndex: 0,
    direction: 1,
    deckCount: 82,
    phase: 'starting',
    timestamp: Date.now(),
    checksum: '',
    gameId: gameId,
    gameStarted: false,
    maxPlayers: 2
  };
}

// ✅ دالة للتحقق من سلامة حالة اللعبة
function validateAndFixGameState(game) {
  if (!game || !game.state) {
    console.log(`❌ Game or game.state is missing`);
    return false;
  }

  // التأكد من وجود players array
  if (!game.state.players || !Array.isArray(game.state.players)) {
    console.log(`❌ game.state.players is not an array for game ${game.gameId}`);
    game.state.players = [];
  }

  if (!game.players || !Array.isArray(game.players)) {
    console.log(`❌ game.players is not an array for game ${game.gameId}`);
    game.players = [];
  }

  // مزامنة بين game.players و game.state.players
  if (game.state.players.length !== game.players.length) {
    console.log(`🔄 مزامنة players arrays للعبة ${game.gameId}`);
    game.state.players = game.players.map((p, index) => {
      const existingState = game.state.players[index] || {};
      return {
        id: p.socketId,
        name: p.playerName || existingState.name || `لاعب_${index + 1}`,
        hand: existingState.hand || [],
        icon: p.icon || existingState.icon || '👤',
        color: p.color || existingState.color || '#667eea',
        isOnline: true,
        playerIndex: index,
        socketId: p.socketId,
        ...existingState
      };
    });
  }

  // إصلاح currentPlayerIndex
  if (typeof game.state.currentPlayerIndex !== 'number' ||
      game.state.currentPlayerIndex < 0 ||
      game.state.currentPlayerIndex >= game.state.players.length) {
    console.log(`🛠️ إصلاح currentPlayerIndex للعبة ${game.gameId}: ${game.state.currentPlayerIndex} -> 0`);
    game.state.currentPlayerIndex = 0;
  }

  // التأكد من وجود اتجاه صحيح
  if (Math.abs(game.state.direction) !== 1) {
    game.state.direction = 1;
  }

  // تحديث الطابع الزمني والإصدار
  game.state.timestamp = Date.now();
  game.state.version = (game.state.version || 0) + 1;
  game.lastActivity = Date.now();

  // إضافة أي حقول مفقودة
  if (!game.state.gameId) game.state.gameId = game.gameId;
  if (!game.state.deckCount) game.state.deckCount = 82;
  if (!game.state.phase) game.state.phase = 'playing';
  if (!game.state.currentCard) game.state.currentCard = { type: 'city', color: 'أحمر', city: 'مكة' };
  
  // حساب checksum جديد
  game.state.checksum = calculateChecksum(game.state);

  return true;
}

// ✅ دالة للعثور على لعبة اللاعب
function findPlayerGame(socketId) {
  for (const gameId in activeGames) {
    const game = activeGames[gameId];
    
    if (!game || !game.players) continue;
    
    // البحث عن اللاعب في game.players
    const playerIndex = game.players.findIndex(p => p.socketId === socketId);
    
    if (playerIndex !== -1) {
      // التأكد من صحة حالة اللعبة
      validateAndFixGameState(game);
      return game;
    }
    
    // البحث عن اللاعب في game.state.players
    if (game.state && game.state.players) {
      const playerInState = game.state.players.find(p => p.id === socketId || p.socketId === socketId);
      if (playerInState) {
        console.log(`🔍 عثر على اللاعب في game.state للعبة ${gameId}`);
        validateAndFixGameState(game);
        return game;
      }
    }
  }
  
  return null;
}

// ✅ دالة لإنشاء مجموعة بطاقات
function createDeck() {
  const deck = [];
  const cities = ['مكة', 'المدينة المنورة', 'الرياض', 'جدة', 'الدمام', 'الدرعية', 'أبها', 'العلا', 'نيوم'];
  const colors = ['أحمر', 'أزرق', 'أخضر', 'أصفر'];
  
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

// ✅ دالة لحساب checksum
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

// ✅ دالة لمطابقة اللاعبين
function tryMatchPlayers() {
  // فلترة اللاعبين المتصلين فقط
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
    const gameState = createInitialGameState(gameId, players);
    gameState.localPlayerIndex = 0;
    
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
      if (playerState && game.deck.length >= 5) {
        playerState.hand = game.deck.splice(0, 5).map((card, i) => ({
          ...card,
          handIndex: i,
          playerId: player.socketId
        }));
      }
    });
    
    // اختيار بطاقة بداية
    if (game.deck.length > 0) {
      const validCards = game.deck.filter(card => card.type === "city");
      if (validCards.length > 0) {
        gameState.currentCard = validCards[0];
        const cardIndex = game.deck.findIndex(c => c.id === validCards[0].id);
        if (cardIndex !== -1) game.deck.splice(cardIndex, 1);
      } else {
        gameState.currentCard = game.deck.pop();
      }
    }
    
    gameState.deckCount = game.deck.length;
    gameState.checksum = calculateChecksum(gameState);
    
    // التحقق من سلامة الحالة قبل الحفظ
    if (validateAndFixGameState(game)) {
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
            myHand: gameState.players[index]?.hand || [],
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
        game.state.phase = 'playing';
      }, 2000);
      
      console.log(`🎮 لعبة جديدة: ${gameId} مع ${players.length} لاعبين`);
    } else {
      console.log(`❌ فشل إنشاء لعبة ${gameId}`);
      waitingPlayers.push(...players);
    }
  }
}

// ✅ نظام الإصلاح التلقائي
setInterval(() => {
  const now = Date.now();
  let fixedCount = 0;
  let removedCount = 0;
  
  // إصلاح الألعاب النشطة
  for (const gameId in activeGames) {
    const game = activeGames[gameId];
    
    if (!game) {
      delete activeGames[gameId];
      removedCount++;
      continue;
    }
    
    // إصلاح حالة اللعبة
    if (validateAndFixGameState(game)) {
      fixedCount++;
    }
    
    // تنظيف الألعاب القديمة (أكثر من 30 دقيقة بدون نشاط)
    if (now - game.lastActivity > 1800000) { // 30 دقيقة
      console.log(`🗑️ تنظيف لعبة قديمة: ${gameId}`);
      delete activeGames[gameId];
      removedCount++;
    }
  }
  
  // تنظيف قائمة الانتظار
  for (let i = waitingPlayers.length - 1; i >= 0; i--) {
    const player = waitingPlayers[i];
    const socket = io.sockets.sockets.get(player.socketId);
    
    if (!socket || !socket.connected || (now - player.timestamp > 300000)) { // 5 دقائق
      waitingPlayers.splice(i, 1);
    }
  }
  
  if (fixedCount > 0 || removedCount > 0) {
    console.log(`🧹 الإصلاح التلقائي: أصلحت ${fixedCount} لعبة، أزلت ${removedCount} لعبة`);
  }
}, 30000); // كل 30 ثانية

// ✅ معالجة اتصالات Socket.io
io.on('connection', (socket) => {
  console.log(`👤 لاعب جديد متصل: ${socket.id}`);
  
  // ✅ إرسال تأكيد الاتصال مع معرف الجلسة
  socket.emit('connection-established', {
    sessionId: socket.id,
    serverTime: new Date().toISOString(),
    message: 'تم الاتصال بالخادم بنجاح',
    activeGames: Object.keys(activeGames).length,
    waitingPlayers: waitingPlayers.length
  });
  
  // ✅ حدث للتحقق من حالة اللعبة
  socket.on('check-game-status', (data) => {
    const game = findPlayerGame(socket.id);
    
    if (game && validateAndFixGameState(game)) {
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
    
    // التحقق من أن اللاعب ليس في لعبة بالفعل
    const existingGame = findPlayerGame(socket.id);
    if (existingGame) {
      socket.emit('already-in-game', {
        gameId: existingGame.gameId,
        message: 'أنت بالفعل في لعبة نشطة'
      });
      return;
    }
    
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
  
  // ✅ طلب مزامنة كاملة
  socket.on('request-full-sync', (data) => {
    console.log(`🔄 ${socket.id} طلب مزامنة كاملة`);
    
    const game = findPlayerGame(socket.id);
    
    if (game && validateAndFixGameState(game)) {
      // إرسال حالة مخصصة للاعب
      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
      const playerSpecificState = {
        ...game.state,
        localPlayerIndex: playerIndex,
        myPlayerId: socket.id,
        myHand: game.state.players[playerIndex]?.hand || [],
        debugInfo: {
          playersCount: game.players.length,
          playerIndex: playerIndex,
          serverTime: new Date().toISOString(),
          version: game.state.version || 1,
          checksum: game.state.checksum
        }
      };
      
      socket.emit('full-state-sync', playerSpecificState);
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
    
    // التحقق من أن اللعبة بدأت
    if (!game.state.gameStarted) {
      socket.emit('invalid-move', {
        message: 'اللعبة لم تبدأ بعد'
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
        
        // تحديث حالة اللاعب ليكون غير متصل
        game.players[playerIndex].isOnline = false;
        if (game.state.players[playerIndex]) {
          game.state.players[playerIndex].isOnline = false;
        }
        
        // إعلام اللاعبين الآخرين
        io.to(game.gameId).emit('player-disconnected', {
          playerName: playerName,
          players: game.players,
          message: `${playerName} فقد الاتصال`,
          timestamp: Date.now()
        });
        
        // إذا بقي لاعب واحد فقط متصل، إنهاء اللعبة بعد 60 ثانية
        const connectedPlayers = game.players.filter(p => {
          const socket = io.sockets.sockets.get(p.socketId);
          return socket && socket.connected;
        });
        
        if (connectedPlayers.length <= 1) {
          setTimeout(() => {
            const stillConnected = game.players.filter(p => {
              const socket = io.sockets.sockets.get(p.socketId);
              return socket && socket.connected;
            });
            
            if (stillConnected.length <= 1) {
              if (stillConnected.length === 1) {
                io.to(game.gameId).emit('game-ended', {
                  winner: stillConnected[0].playerName,
                  reason: 'غادر جميع اللاعبين الآخرين',
                  timestamp: Date.now()
                });
              }
              
              delete activeGames[game.gameId];
              console.log(`🗑️ تم حذف اللعبة ${game.gameId} لعدم وجود لاعبين`);
            }
          }, 60000);
        }
      }
    }
  });
  
  // إرسال حالة الخادم
  const statusInterval = setInterval(() => {
    socket.emit('server-status', {
      uptime: process.uptime(),
      activeGames: Object.keys(activeGames).length,
      waitingPlayers: waitingPlayers.length,
      totalConnections: Object.keys(io.sockets.sockets).length,
      timestamp: new Date().toISOString(),
      serverTime: new Date().toLocaleString('ar-SA'),
      memoryUsage: process.memoryUsage()
    });
  }, 30000);
  
  socket.on('disconnect', () => {
    clearInterval(statusInterval);
  });
});

// ✅ بدء الخادم
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

// ✅ معالجة إغلاق الخادم
process.on('SIGINT', () => {
  console.log('\n👋 إغلاق الخادم...');
  
  // إعلام جميع اللاعبين
  io.emit('server-shutdown', {
    message: 'يتم إغلاق الخادم للصيانة',
    timestamp: new Date().toISOString(),
    reconnectAfter: 60
  });
  
  // حفظ حالة الألعاب
  const backupFile = path.join(__dirname, `games_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({
    activeGames: activeGames,
    waitingPlayers: waitingPlayers,
    timestamp: new Date().toISOString(),
    serverUptime: process.uptime()
  }, null, 2));
  
  console.log(`📁 تم حفظ نسخة احتياطية في: ${backupFile}`);
  
  setTimeout(() => {
    server.close(() => {
      console.log('✅ تم إيقاف السيرفر بنجاح');
      process.exit(0);
    });
  }, 2000);
});

// ✅ معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
  console.error('💥 خطأ غير متوقع:', error);
  // نسخة احتياطية سريعة
  try {
    const errorBackup = path.join(__dirname, `error_backup_${Date.now()}.json`);
    fs.writeFileSync(errorBackup, JSON.stringify({
      error: error.toString(),
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, null, 2));
  } catch (e) {
    console.error('فشل حفظ النسخة الاحتياطية:', e);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 وعد مرفوض:', reason);
});