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

// ✅ التغيير الأول: خدمة الملفات الثابتة من المجلد الحالي (بدون public/)
app.use(express.static(__dirname));

// ✅ التغيير الثاني: التحقق من وجود index.html وإرساله مباشرة
app.get('/', (req, res) => {
  // المسار الكامل لملف index.html في المجلد الحالي
  const indexPath = path.join(__dirname, 'index.html');
  
  // التحقق من وجود الملف
  if (fs.existsSync(indexPath)) {
    // ✅ إذا الملف موجود، أرسله مباشرة
    res.sendFile(indexPath);
  } else {
    // إذا الملف غير موجود، أرسل صفحة افتراضية
    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>خادم جولة سعودية</title>
        <style>
          * {
            font-family: 'Arial', sans-serif;
            box-sizing: border-box;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: white;
          }
          
          .container {
            max-width: 600px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          }
          
          h1 {
            font-size: 2.5rem;
            margin-bottom: 20px;
          }
          
          p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            line-height: 1.6;
          }
          
          .status {
            display: inline-block;
            padding: 10px 20px;
            background: rgba(16, 185, 129, 0.8);
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
          }
          
          .info {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: right;
          }
          
          .links {
            margin-top: 30px;
          }
          
          .links a {
            display: inline-block;
            margin: 10px;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            transition: all 0.3s;
          }
          
          .links a:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
          }
          
          .warning {
            background: rgba(255, 193, 7, 0.2);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-right: 5px solid #ffc107;
          }
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
          
          <div class="status">
            ✅ حالة الخادم: نشط
          </div>
          
          <div class="info">
            <h3>📊 معلومات الخادم:</h3>
            <p>🆔 البورت: ${PORT}</p>
            <p>🔗 عنوان URL: ${req.protocol}://${req.get('host')}</p>
            <p>📁 المسار الحالي: ${__dirname}</p>
            <p>👥 اتصالات Socket: ${Object.keys(io.sockets.sockets).length}</p>
            <p>🎮 ألعاب نشطة: ${Object.keys(activeGames || {}).length}</p>
          </div>
          
          <div class="links">
            <a href="/" onclick="location.reload()">🔄 تحديث الصفحة</a>
            <a href="/socket.io/socket.io.js">📦 ملف Socket.io</a>
            <a href="#" onclick="showFileStructure()">📁 هيكل الملفات</a>
          </div>
        </div>
        
        <script src="/socket.io/socket.io.js"></script>
        <script>
          const socket = io();
          
          socket.on('connect', () => {
            console.log('✅ متصل بالخادم');
          });
          
          socket.on('server-status', (data) => {
            console.log('📊 حالة الخادم:', data);
          });
          
          function showFileStructure() {
            fetch('/?file-structure=1')
              .then(response => response.text())
              .then(data => {
                alert('📁 الملفات في المجلد:\n' + data);
              });
          }
        </script>
      </body>
      </html>
    `);
  }
});

// ✅ التغيير الثالث: إضافة نقطة نهاية لفحص الملفات
app.get('/files', (req, res) => {
  const files = fs.readdirSync(__dirname);
  res.json({
    currentDirectory: __dirname,
    files: files,
    hasIndexHtml: fs.existsSync(path.join(__dirname, 'index.html'))
  });
});

// ✅ التغيير الرابع: كل الطلبات الأخرى ترجع إلى index.html إذا موجود
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

// إدارة الألعاب النشطة
const activeGames = {};
const waitingPlayers = [];

// معالجة اتصالات Socket.io
io.on('connection', (socket) => {
  console.log(`👤 لاعب جديد متصل: ${socket.id}`);
  
  // إرسال ترحيب
  socket.emit('welcome', {
    message: 'مرحباً بك في جولة سعودية!',
    serverTime: new Date().toISOString(),
    playerId: socket.id,
    activeGames: Object.keys(activeGames).length,
    waitingPlayers: waitingPlayers.length
  });
  
  // البحث عن لعبة
  socket.on('find-game-enhanced', (data) => {
    console.log(`🔍 ${socket.id} يبحث عن لعبة:`, data.playerName);
    
    const playerInfo = {
      socketId: socket.id,
      playerName: data.playerName,
      icon: data.icon,
      color: data.color,
      playerCount: data.playerCount || 2,
      clientInfo: data.clientInfo,
      timestamp: Date.now()
    };
    
    // إضافة اللاعب لقائمة الانتظار
    waitingPlayers.push(playerInfo);
    
    // تحديث اللاعب
    socket.emit('search-status', {
      status: 'waiting',
      position: waitingPlayers.length,
      message: 'جاري البحث عن لاعبين...'
    });
    
    // محاولة إنشاء لعبة إذا كان هناك لاعبين
    tryMatchPlayers();
  });
  
  // إلغاء البحث
  socket.on('cancel-search', () => {
    console.log(`❌ ${socket.id} ألغى البحث`);
    
    const index = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }
    
    socket.emit('search-cancelled', {
      message: 'تم إلغاء البحث عن لعبة'
    });
  });
  
  // طلب مزامنة كاملة
  socket.on('request-full-sync', (data) => {
    console.log(`🔄 ${socket.id} طلب مزامنة كاملة`);
    
    const game = findPlayerGame(socket.id);
    
    if (game) {
      socket.emit('full-state-sync', game.state);
    } else {
      socket.emit('sync-error', {
        code: 'NO_GAME',
        message: 'لا توجد لعبة نشطة للاعب'
      });
    }
  });
  
  // طلب مزامنة اللاعبين
  socket.on('request-player-sync', (data) => {
    console.log(`👥 ${socket.id} طلب مزامنة اللاعبين`);
    
    const game = findPlayerGame(socket.id);
    
    if (game) {
      socket.emit('player-list-update', {
        players: game.players,
        timestamp: Date.now()
      });
    }
  });
  
  // لعب بطاقة
  socket.on('play-card', (data) => {
    console.log(`🎴 ${socket.id} لعب بطاقة:`, data.cardIndex);
    
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
    game.state.version++;
    game.state.timestamp = Date.now();
    
    // بث التحديث لجميع اللاعبين
    io.to(game.gameId).emit('game-state-update', {
      players: game.players,
      currentCard: data.card,
      currentPlayerIndex: game.state.currentPlayerIndex,
      direction: game.state.direction,
      deckCount: game.deck.length,
      version: game.state.version
    });
    
    // تحديث الدور
    let nextPlayerIndex = (game.state.currentPlayerIndex + game.state.direction) % game.players.length;
    if (nextPlayerIndex < 0) nextPlayerIndex = game.players.length - 1;
    
    game.state.currentPlayerIndex = nextPlayerIndex;
    
    // إرسال تحديث الدور
    io.to(game.gameId).emit('turn-update', {
      currentPlayerIndex: nextPlayerIndex,
      direction: game.state.direction,
      timestamp: Date.now()
    });
  });
  
  // تحديث حالة من العميل
  socket.on('state-update-ack', (data) => {
    console.log(`✅ ${socket.id} أكد تحديث الحالة:`, data.version);
    
    const game = findPlayerGame(socket.id);
    
    if (game && game.state.version === data.version) {
      game.lastSync = Date.now();
    }
  });
  
  // إرسال نبض التزامن
  socket.on('sync-ping', (data) => {
    socket.emit('sync-pong', {
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      gameId: data.gameId
    });
  });
  
  // انضمام لاعب لغرفة
  socket.on('join-game', (data) => {
    console.log(`🎮 ${socket.id} انضم للعبة:`, data.gameId);
    
    if (activeGames[data.gameId]) {
      socket.join(data.gameId);
      socket.emit('game-joined', {
        gameId: data.gameId,
        players: activeGames[data.gameId].players,
        state: activeGames[data.gameId].state
      });
    }
  });
  
  // قطع الاتصال
  socket.on('disconnect', (reason) => {
    console.log(`👋 ${socket.id} انقطع: ${reason}`);
    
    // إزالة من قائمة الانتظار
    const waitIndex = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (waitIndex !== -1) {
      waitingPlayers.splice(waitIndex, 1);
    }
    
    // التعامل مع الألعاب النشطة
    const game = findPlayerGame(socket.id);
    
    if (game) {
      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
      
      if (playerIndex !== -1) {
        const playerName = game.players[playerIndex].playerName;
        
        // إزالة اللاعب من اللعبة
        game.players.splice(playerIndex, 1);
        
        // إعلام اللاعبين الآخرين
        io.to(game.gameId).emit('player-left', {
          playerName: playerName,
          players: game.players,
          message: `${playerName} غادر اللعبة`
        });
        
        // إذا بقي لاعب واحد فقط، إنهاء اللعبة
        if (game.players.length <= 1) {
          if (game.players.length === 1) {
            io.to(game.gameId).emit('game-ended', {
              winner: game.players[0].playerName,
              reason: 'غادر جميع اللاعبين الآخرين'
            });
          }
          
          // حذف اللعبة
          delete activeGames[game.gameId];
          console.log(`🗑️ تم حذف اللعبة ${game.gameId}`);
        }
      }
    }
  });
  
  // إرسال حالة الخادم كل دقيقة
  const statusInterval = setInterval(() => {
    socket.emit('server-status', {
      uptime: process.uptime(),
      activeGames: Object.keys(activeGames).length,
      waitingPlayers: waitingPlayers.length,
      totalConnections: Object.keys(io.sockets.sockets).length,
      timestamp: new Date().toISOString()
    });
  }, 60000);
  
  socket.on('disconnect', () => {
    clearInterval(statusInterval);
  });
});

// دالة لمطابقة اللاعبين
function tryMatchPlayers() {
  if (waitingPlayers.length >= 2) {
    console.log(`🤝 مطابقة ${waitingPlayers.length} لاعبين...`);
    
    // إنشاء لعبة جديدة
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // أخذ أول لاعبين
    const players = waitingPlayers.splice(0, 2);
    
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
        isLocal: false
      })),
      currentCard: null,
      currentPlayerIndex: 0,
      direction: 1,
      deckCount: 82,
      phase: 'starting',
      timestamp: Date.now(),
      checksum: '',
      gameId: gameId,
      localPlayerIndex: 0
    };
    
    // إنشاء كائن اللعبة
    const game = {
      gameId: gameId,
      players: players,
      state: gameState,
      deck: createDeck(),
      created: Date.now(),
      lastSync: Date.now()
    };
    
    // توزيع البطاقات
    game.players.forEach(player => {
      const playerState = gameState.players.find(p => p.id === player.socketId);
      if (playerState) {
        playerState.hand = game.deck.splice(0, 5);
      }
    });
    
    // اختيار بطاقة البداية
    let startCard;
    do {
      startCard = game.deck.pop();
    } while (startCard && startCard.type !== "city");
    
    gameState.currentCard = startCard;
    gameState.deckCount = game.deck.length;
    gameState.checksum = calculateChecksum(gameState);
    
    // حفظ اللعبة
    activeGames[gameId] = game;
    
    // إعلام اللاعبين
    players.forEach((player, index) => {
      const socket = io.sockets.sockets.get(player.socketId);
      if (socket) {
        socket.join(gameId);
        
        // تحديد مؤشر اللاعب المحلي
        gameState.localPlayerIndex = index;
        
        socket.emit('game-found', {
          gameId: gameId,
          players: game.players.map(p => ({
            name: p.playerName,
            icon: p.icon,
            color: p.color,
            socketId: p.socketId
          })),
          state: gameState,
          localPlayerIndex: index,
          message: 'تم العثور على لعبة!'
        });
        
        console.log(`✅ ${player.socketId} انضم للعبة ${gameId}`);
      }
    });
    
    // بدء اللعبة بعد تأخير قصير
    setTimeout(() => {
      io.to(gameId).emit('game-started', {
        gameId: gameId,
        currentCard: gameState.currentCard,
        currentPlayerIndex: 0,
        direction: 1,
        message: 'بدأت اللعبة!'
      });
    }, 2000);
    
    console.log(`🎮 لعبة جديدة: ${gameId} مع ${players.length} لاعبين`);
  }
}

// دالة للعثور على لعبة اللاعب
function findPlayerGame(socketId) {
  for (const gameId in activeGames) {
    const game = activeGames[gameId];
    if (game.players.some(p => p.socketId === socketId)) {
      return game;
    }
  }
  return null;
}

// دالة لإنشاء مجموعة بطاقات (مبسطة)
function createDeck() {
  const deck = [];
  
  // إضافة بعض البطاقات الوهمية للاختبار
  for (let i = 0; i < 82; i++) {
    deck.push({
      id: `card_${i}`,
      type: i < 40 ? 'city' : 'special',
      color: i % 4 === 0 ? 'أحمر' : i % 4 === 1 ? 'أزرق' : i % 4 === 2 ? 'أخضر' : 'أصفر',
      city: i % 9 === 0 ? 'مكة' : 
            i % 9 === 1 ? 'المدينة المنورة' : 
            i % 9 === 2 ? 'الرياض' : 
            i % 9 === 3 ? 'جدة' : 
            i % 9 === 4 ? 'الدمام' : 
            i % 9 === 5 ? 'الدرعية' : 
            i % 9 === 6 ? 'أبها' : 
            i % 9 === 7 ? 'العلا' : 'نيوم'
    });
  }
  
  return deck;
}

// دالة لحساب checksum
function calculateChecksum(state) {
  const data = JSON.stringify({
    players: state.players.map(p => ({id: p.id, name: p.name})),
    currentCard: state.currentCard ? state.currentCard.type : null,
    version: state.version
  });
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

// بدء الخادم
server.listen(PORT, () => {
  console.log(`
  🚀 خادم جولة سعودية يعمل!
  📍 البورت: ${PORT}
  🌐 العنوان: http://localhost:${PORT}
  📁 المجلد الحالي: ${__dirname}
  📄 الملفات في المجلد: ${fs.readdirSync(__dirname).join(', ')}
  🕒 الوقت: ${new Date().toLocaleString('ar-SA')}
  
  📊 إحصائيات:
  👥 اتصالات نشطة: ${Object.keys(io.sockets.sockets).length}
  🎮 ألعاب نشطة: ${Object.keys(activeGames).length}
  ⏳ لاعبين في الانتظار: ${waitingPlayers.length}
  ✅ index.html موجود: ${fs.existsSync(path.join(__dirname, 'index.html'))}
  `);
  
  // تحقق من وجود index.html
  if (!fs.existsSync(path.join(__dirname, 'index.html'))) {
    console.log('⚠️  تحذير: ملف index.html غير موجود في المجلد الحالي!');
    console.log('📁 قم بإنشاء ملف index.html في: ', __dirname);
  }
});

// معالجة إغلاق الخادم
process.on('SIGINT', () => {
  console.log('\n👋 إغلاق الخادم...');
  
  // إعلام جميع اللاعبين
  io.emit('server-shutdown', {
    message: 'يتم إغلاق الخادم للصيانة',
    timestamp: new Date().toISOString()
  });
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});