const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

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
app.use(express.static(path.join(__dirname))); // خدمة الملفات الثابتة من الدليل الحالي

// مسار الرئيسي يخدم الملف index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// حالة الخادم
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    playersOnline: io.engine.clientsCount,
    serverTime: new Date().toISOString()
  });
});

// تخزين الغرف واللاعبين
const gameRooms = new Map();
const playerRooms = new Map();

// معالجة اتصال socket
io.on('connection', (socket) => {
  console.log('مستخدم جديد متصل:', socket.id);

  // إرسال رسالة ترحيبية
  socket.emit('connected', {
    message: 'مرحباً بك في جولة سعودية!',
    socketId: socket.id
  });

  // البحث عن لعبة
  socket.on('find-game', (playerData) => {
    const player = {
      id: socket.id,
      name: playerData.playerName || 'اللاعب',
      icon: playerData.icon || '👤',
      color: playerData.color || '#3b82f6',
      socket: socket
    };

    // البحث عن غرفة فيها لاعب ينتظر
    let foundRoom = null;
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.length < 2 && room.status === 'waiting') {
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
        created: Date.now()
      };
      gameRooms.set(roomId, newRoom);
      playerRooms.set(socket.id, roomId);

      socket.join(roomId);
      socket.emit('waiting', {
        message: 'جاري البحث عن لاعبين...',
        roomId: roomId,
        players: 1
      });

      console.log(`تم إنشاء غرفة جديدة: ${roomId}`);

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

      // بدء اللعبة
      foundRoom.status = 'playing';
      startGame(foundRoom);
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
        }
        
        socket.leave(roomId);
        socket.emit('search-cancelled', { message: 'تم إلغاء البحث' });
      }
    }
  });

  // لعب بطاقة
  socket.on('play-card', (data) => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

    // إرسال حركة اللاعب إلى جميع اللاعبين في الغرفة
    socket.to(roomId).emit('card-played', {
      playerId: socket.id,
      card: data.card,
      cardIndex: data.cardIndex,
      timestamp: Date.now()
    });
  });

  // سحب بطاقة
  socket.on('draw-card', () => {
    const roomId = playerRooms.get(socket.id);
    if (!roomId) return;

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

  // انقطاع الاتصال
  socket.on('disconnect', () => {
    console.log('مستخدم منقطع:', socket.id);
    
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const room = gameRooms.get(roomId);
      if (room) {
        // إزالة اللاعب من الغرفة
        room.players = room.players.filter(p => p.id !== socket.id);
        
        // إعلام اللاعبين المتبقين
        socket.to(roomId).emit('player-left', {
          playerId: socket.id,
          playersCount: room.players.length
        });

        // إذا بقي لاعب واحد فقط، أنهِ اللعبة
        if (room.players.length < 2) {
          room.players.forEach(p => {
            p.socket.emit('game-ended', {
              reason: 'غادر اللاعبون الآخرون',
              winner: room.players[0]?.name || 'لا أحد'
            });
          });
          gameRooms.delete(roomId);
        }
      }
      playerRooms.delete(socket.id);
    }
  });
});

function startGame(room) {
  // إعداد بيانات اللاعبين للعبة
  const playerData = room.players.map((player, index) => ({
    id: player.id,
    name: player.name,
    icon: player.icon,
    color: player.color,
    position: index
  }));

  // إرسال بيانات بدء اللعبة
  io.to(room.id).emit('game-started', {
    players: playerData,
    currentPlayerIndex: 0,
    direction: 1,
    roomId: room.id,
    timestamp: Date.now()
  });

  console.log(`بدأت اللعبة في الغرفة ${room.id} مع ${room.players.length} لاعبين`);
}

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
    if (room.status === 'waiting' && now - room.created > 10 * 60 * 1000) {
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
});