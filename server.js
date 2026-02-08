require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// إعدادات اللعبة
const gameRooms = new Map(); // تخزين الغرف
const playerRooms = new Map(); // تتبع اللاعبين والغرف
const MAX_PLAYERS_PER_ROOM = 4;
const WAITING_TIME = 60000; // 60 ثانية للانتظار

// مسارات API
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    playersOnline: io.engine.clientsCount,
    activeRooms: gameRooms.size,
    version: '1.0.0'
  });
});

app.get('/api/rooms', (req, res) => {
  const rooms = Array.from(gameRooms.values()).map(room => ({
    id: room.id,
    players: room.players.length,
    status: room.status,
    gameMode: room.gameMode,
    created: room.created
  }));
  res.json(rooms);
});

// نظام WebSocket
io.on('connection', (socket) => {
  console.log('مستخدم جديد متصل:', socket.id);

  // إرسال حالة الاتصال
  socket.emit('connected', {
    message: 'مرحباً بك في جولة سعودية!',
    serverTime: new Date().toISOString(),
    playersOnline: io.engine.clientsCount
  });

  // البحث عن لعبة
  socket.on('find-game', (playerData) => {
    try {
      const player = {
        id: socket.id,
        name: playerData.playerName || 'اللاعب',
        icon: playerData.icon || '👤',
        color: playerData.color || '#3b82f6',
        socket: socket
      };

      // البحث عن غرفة فيها لاعبين ينتظرون
      let foundRoom = null;
      for (const [roomId, room] of gameRooms.entries()) {
        if (room.players.length < MAX_PLAYERS_PER_ROOM && 
            room.status === 'waiting' && 
            room.gameMode === playerData.gameMode) {
          foundRoom = room;
          break;
        }
      }

      if (!foundRoom) {
        // إنشاء غرفة جديدة
        const roomId = generateRoomId();
        const newRoom = {
          id: roomId,
          players: [player],
          status: 'waiting',
          gameMode: playerData.gameMode || 'online',
          created: Date.now(),
          waitingStart: Date.now()
        };
        gameRooms.set(roomId, newRoom);
        playerRooms.set(socket.id, roomId);

        socket.join(roomId);
        socket.emit('waiting', {
          message: 'جاري البحث عن لاعبين...',
          roomId: roomId,
          players: 1,
          estimatedTime: '30-60 ثانية'
        });

        console.log(`تم إنشاء غرفة جديدة: ${roomId}`);

        // بدء مهلة الانتظار
        setTimeout(() => {
          const room = gameRooms.get(roomId);
          if (room && room.status === 'waiting' && room.players.length < 2) {
            // إلغاء الغرفة إذا لم يكتمل العدد
            room.players.forEach(p => {
              p.socket.emit('game-cancelled', {
                message: 'انتهى وقت الانتظار، لم يتم العثور على لاعبين كافيين'
              });
              playerRooms.delete(p.id);
            });
            gameRooms.delete(roomId);
            console.log(`تم حذف الغرفة ${roomId} بسبب انتهاء وقت الانتظار`);
          }
        }, WAITING_TIME);

      } else {
        // الانضمام إلى غرفة موجودة
        foundRoom.players.push(player);
        playerRooms.set(socket.id, foundRoom.id);
        socket.join(foundRoom.id);

        console.log(`اللاعب ${player.name} انضم إلى الغرفة ${foundRoom.id}`);

        // إعلام جميع اللاعبين في الغرفة
        io.to(foundRoom.id).emit('player-joined', {
          playerName: player.name,
          playersCount: foundRoom.players.length,
          roomId: foundRoom.id
        });

        // إذا اكتمل عدد اللاعبين، ابدأ اللعبة
        if (foundRoom.players.length >= 2) {
          foundRoom.status = 'playing';
          startGame(foundRoom);
        }
      }
    } catch (error) {
      console.error('خطأ في البحث عن لعبة:', error);
      socket.emit('error', { message: 'حدث خطأ في البحث عن لعبة' });
    }
  });

  // إلغاء البحث
  socket.on('cancel-search', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = gameRooms.get(roomId);
      if (room && room.status === 'waiting') {
        room.players = room.players.filter(p => p.id !== socket.id);
        playerRooms.delete(socket.id);
        
        if (room.players.length === 0) {
          gameRooms.delete(roomId);
          console.log(`تم حذف الغرفة ${roomId} (لا يوجد لاعبين)`);
        } else {
          io.to(roomId).emit('player-left', {
            playerId: socket.id,
            playersCount: room.players.length
          });
        }
        
        socket.leave(roomId);
        socket.emit('search-cancelled', { message: 'تم إلغاء البحث' });
      }
    }
  });

  // لعب بطاقة
  socket.on('play-card', (data) => {
    try {
      const roomId = playerRooms.get(socket.id);
      if (!roomId) {
        socket.emit('error', { message: 'أنت غير موجود في أي غرفة' });
        return;
      }

      const room = gameRooms.get(roomId);
      if (!room || room.status !== 'playing') {
        socket.emit('error', { message: 'اللعبة لم تبدأ بعد أو انتهت' });
        return;
      }

      // إرسال حركة اللاعب إلى جميع اللاعبين في الغرفة
      socket.to(roomId).emit('card-played', {
        playerId: socket.id,
        card: data.card,
        cardIndex: data.cardIndex,
        timestamp: Date.now()
      });

      // تحديث حالة اللعبة
      if (room.gameState) {
        room.gameState.currentCard = data.card;
        room.gameState.currentPlayerIndex = (room.gameState.currentPlayerIndex + 1) % room.players.length;
      }

      // إرسال تحديث الحالة
      io.to(roomId).emit('game-update', {
        currentCard: data.card,
        currentPlayerIndex: room.gameState?.currentPlayerIndex || 0,
        players: room.players.map(p => ({
          id: p.id,
          name: p.name,
          handSize: p.handSize || 0,
          announced: p.announced || false
        }))
      });

    } catch (error) {
      console.error('خطأ في لعب البطاقة:', error);
      socket.emit('error', { message: 'حدث خطأ في لعب البطاقة' });
    }
  });

  // سحب بطاقة
  socket.on('draw-card', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = gameRooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    // إعلام اللاعبين أن اللاعب سحب بطاقة
    socket.to(roomId).emit('player-drew', {
      playerId: socket.id,
      timestamp: Date.now()
    });
  });

  // إعلان آخر بطاقة
  socket.on('announce-uno', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    socket.to(roomId).emit('uno-announced', {
      playerId: socket.id,
      timestamp: Date.now()
    });
  });

  // انقطاع الاتصال
  socket.on('disconnect', () => {
    console.log('مستخدم منقطع:', socket.id);
    
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = gameRooms.get(roomId);
      if (room) {
        // إزالة اللاعب من الغرفة
        const player = room.players.find(p => p.id === socket.id);
        room.players = room.players.filter(p => p.id !== socket.id);
        
        // إعلام اللاعبين المتبقين
        if (player) {
          socket.to(roomId).emit('player-left', {
            playerId: socket.id,
            playerName: player.name,
            playersCount: room.players.length
          });
        }

        // إذا بقي لاعب واحد فقط، أنهِ اللعبة
        if (room.players.length < 2) {
          room.players.forEach(p => {
            p.socket.emit('game-ended', {
              reason: 'غادر اللاعبون الآخرون',
              winner: room.players[0]?.name || 'لا أحد'
            });
            playerRooms.delete(p.id);
          });
          gameRooms.delete(roomId);
          console.log(`تم إنهاء الغرفة ${roomId} بسبب نقص اللاعبين`);
        }
      }
      playerRooms.delete(socket.id);
    }
  });

  // رسالة نصية
  socket.on('send-message', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    const room = gameRooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to(roomId).emit('new-message', {
      playerId: socket.id,
      playerName: player.name,
      message: data.message,
      timestamp: Date.now()
    });
  });

  // طلب الحالة الحالية
  socket.on('get-game-state', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) {
      socket.emit('game-state', { error: 'لا توجد غرفة نشطة' });
      return;
    }

    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('game-state', { error: 'الغرفة غير موجودة' });
      return;
    }

    socket.emit('game-state', {
      roomId: room.id,
      status: room.status,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color
      })),
      gameState: room.gameState || null
    });
  });
});

// بدء اللعبة
function startGame(room) {
  try {
    // تهيئة اللعبة
    room.gameState = {
      currentPlayerIndex: 0,
      direction: 1,
      deckSize: 82,
      startedAt: Date.now()
    };

    const playerData = room.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      icon: player.icon,
      color: player.color,
      position: index,
      handSize: 5, // كل لاعب يبدأ بـ 5 بطاقات
      announced: false
    }));

    // إرسال بيانات بدء اللعبة
    io.to(room.id).emit('game-started', {
      players: playerData,
      currentPlayerIndex: 0,
      direction: 1,
      roomId: room.id,
      timestamp: Date.now()
    });

    console.log(`بدأت اللعبة في الغرفة ${room.id} بعدد ${room.players.length} لاعبين`);

  } catch (error) {
    console.error('خطأ في بدء اللعبة:', error);
    
    // إعلام جميع اللاعبين بالخطأ
    room.players.forEach(player => {
      player.socket.emit('error', { 
        message: 'حدث خطأ في بدء اللعبة، سيتم إعادة المحاولة' 
      });
    });
  }
}

// توليد معرف غرفة
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomId = '';
  for (let i = 0; i < 6; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return roomId;
}

// تنظيف الغرف المهجورة كل 5 دقائق
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [roomId, room] of gameRooms.entries()) {
    // حذف الغرف التي توقفت عن الانتظار منذ أكثر من 10 دقائق
    if (room.status === 'waiting' && now - room.waitingStart > 10 * 60 * 1000) {
      gameRooms.delete(roomId);
      cleaned++;
    }
    // حذف الغرف الفارغة
    else if (room.players.length === 0) {
      gameRooms.delete(roomId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`تم تنظيف ${cleaned} غرفة مهجورة`);
  }
}, 5 * 60 * 1000);

// بدء الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🌐 يمكن الوصول عبر: http://localhost:${PORT}`);
  console.log(`⚡ WebSocket جاهز على ws://localhost:${PORT}`);
  console.log(`🎮 عدد الغرف النشطة: ${gameRooms.size}`);
});