const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// بيانات التخزين المؤقت للغرف واللاعبين
const rooms = new Map(); // مفتاحها هو room.id
const roomCodes = new Map(); // مفتاحها هو room.code -> room.id

// توليد معرف فريد للغرفة
function generateRoomId() {
  return 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// توليد رمز غرفة فريد (6 أحرف)
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// الحصول على الغرف العامة فقط
function getPublicRooms() {
  const publicRooms = [];
  for (const room of rooms.values()) {
    if (room.type === 'public') {
      publicRooms.push({
        id: room.id,
        code: room.code,
        name: room.name,
        type: room.type,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        host: room.players.find(p => p.id === room.host)?.name || 'Unknown',
        createdAt: room.createdAt
      });
    }
  }
  return publicRooms;
}

// تحديث حالة الغرفة وإرسالها للجميع في الغرفة
function updateRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // إرسال تحديث الغرفة لكل لاعب في الغرفة
  room.players.forEach(player => {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit('room-updated', { room: getRoomInfo(room) });
    }
  });

  // تحديث قائمة الغرف العامة للجميع
  io.emit('public-rooms-list', getPublicRooms());
}

// الحصول على معلومات الغرفة دون بيانات حساسة
function getRoomInfo(room) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    type: room.type,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    host: room.host,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      ready: p.ready,
      socketId: p.socketId
    })),
    createdAt: room.createdAt,
    gameState: room.gameState || null
  };
}

// بدء اللعبة في غرفة
function startGameInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // هنا يجب إنشاء حالة اللعبة (Game State)
  // بما أن اللعبة تحتوي على بطاقات خاصة، نحتاج إلى إنشاء مجموعة أوراق وتوزيعها
  // ولكن حالياً، سنقوم بإرسال حدث بدء اللعبة مع بيانات بسيطة
  room.gameState = {
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      hand: [] // سيتم ملؤها لاحقاً
    })),
    currentCard: null,
    currentPlayerIndex: 0,
    direction: 1,
    deck: []
  };

  // إرسال حدث بدء اللعبة لكل لاعب في الغرفة
  room.players.forEach(player => {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit('game-started', {
        room: getRoomInfo(room),
        gameState: room.gameState
      });
    }
  });
}

// حدث اتصال سوكيت جديد
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // إنشاء غرفة جديدة
  socket.on('create-room', (data) => {
    const { playerName, roomName, roomType, customCode, icon, color } = data;

    // توليد معرف الغرفة
    const roomId = generateRoomId();
    let roomCode = customCode || generateRoomCode();

    // التأكد من أن رمز الغرفة فريد
    while (roomCodes.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const newRoom = {
      id: roomId,
      code: roomCode,
      name: roomName || `غرفة ${roomCode}`,
      type: roomType || 'public',
      host: socket.id,
      maxPlayers: 4,
      players: [
        {
          id: socket.id,
          name: playerName,
          icon: icon || '👤',
          color: color || '#667eea',
          ready: false,
          socketId: socket.id
        }
      ],
      createdAt: new Date().toISOString(),
      gameState: null
    };

    // تخزين الغرفة
    rooms.set(roomId, newRoom);
    roomCodes.set(roomCode, roomId);

    // انضمام السوكيت إلى غرفة (غرفة سوكيت)
    socket.join(roomId);

    // إرسال تأكيد إنشاء الغرفة للاعب
    socket.emit('room-created', {
      room: getRoomInfo(newRoom)
    });

    // تحديث قائمة الغرف العامة للجميع
    io.emit('public-rooms-list', getPublicRooms());

    console.log(`Room created: ${roomCode} by ${playerName}`);
  });

  // الحصول على قائمة الغرف العامة
  socket.on('get-public-rooms', () => {
    socket.emit('public-rooms-list', getPublicRooms());
  });

  // الانضمام إلى غرفة
  socket.on('join-room', (data) => {
    const { roomCode, playerName, icon, color } = data;
    const roomId = roomCodes.get(roomCode);

    if (!roomId) {
      socket.emit('error', 'رمز الغرفة غير صحيح');
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'الغرفة غير موجودة');
      return;
    }

    // التحقق من عدد اللاعبين
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error', 'الغرفة ممتلئة');
      return;
    }

    // التحقق من عدم وجود لاعب بنفس الاسم
    const existingPlayer = room.players.find(p => p.name === playerName);
    if (existingPlayer) {
      socket.emit('error', 'اسم اللاعب موجود بالفعل في الغرفة');
      return;
    }

    // إضافة اللاعب الجديد
    const newPlayer = {
      id: socket.id,
      name: playerName,
      icon: icon || '👤',
      color: color || '#3b82f6',
      ready: false,
      socketId: socket.id
    };
    room.players.push(newPlayer);

    // انضمام السوكيت إلى غرفة
    socket.join(roomId);

    // إرسال تأكيد الانضمام للاعب الجديد
    socket.emit('joined-room', {
      room: getRoomInfo(room)
    });

    // إرسال تحديث الغرفة للجميع في الغرفة
    updateRoom(roomId);

    // إرسال رسالة ترحيبية في الدردشة
    const welcomeMessage = {
      type: 'system',
      message: `🎮 انضم ${playerName} إلى الغرفة`,
      timestamp: new Date().toISOString()
    };
    io.to(roomId).emit('chat-message', welcomeMessage);

    console.log(`${playerName} joined room ${roomCode}`);
  });

  // تبديل حالة الاستعداد
  socket.on('toggle-ready', () => {
    // البحث عن الغرفة التي يوجد بها اللاعب
    for (const room of rooms.values()) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.ready = !player.ready;
        updateRoom(room.id);
        break;
      }
    }
  });

  // بدء اللعبة (فقط المضيف)
  socket.on('start-game', () => {
    for (const room of rooms.values()) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player && room.host === socket.id) {
        // التحقق من شروط بدء اللعبة
        const playerCount = room.players.length;
        const isValidCount = playerCount === 2 || playerCount === 4;
        const allReady = room.players.every(p => p.ready);

        if (!isValidCount) {
          socket.emit('error', 'مطلوب 2 أو 4 لاعبين لبدء اللعبة');
          return;
        }

        if (!allReady) {
          socket.emit('error', 'جميع اللاعبين يجب أن يكونوا جاهزين');
          return;
        }

        // بدء العد التنازلي
        let countdown = 5;
        const countdownInterval = setInterval(() => {
          io.to(room.id).emit('game-countdown', { countdown });
          countdown--;

          if (countdown < 0) {
            clearInterval(countdownInterval);
            startGameInRoom(room.id);
          }
        }, 1000);

        io.to(room.id).emit('game-starting', { countdown: 5 });
        break;
      }
    }
  });

  // طرد لاعب (فقط المضيف)
  socket.on('kick-player', (data) => {
    const { playerId } = data;

    for (const room of rooms.values()) {
      if (room.host === socket.id) {
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
          const kickedPlayer = room.players[playerIndex];
          room.players.splice(playerIndex, 1);

          // إرسال حدث الطرد للاعب المطرود
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('kicked-from-room', { reason: 'تم طردك من الغرفة بواسطة المضيف' });
            playerSocket.leave(room.id);
          }

          // تحديث الغرفة للباقين
          updateRoom(room.id);

          // إرسال رسالة في الدردشة
          const kickMessage = {
            type: 'system',
            message: `🚫 تم طرد ${kickedPlayer.name} من الغرفة`,
            timestamp: new Date().toISOString()
          };
          io.to(room.id).emit('chat-message', kickMessage);
        }
        break;
      }
    }
  });

  // مغادرة الغرفة
  socket.on('leave-room', () => {
    for (const room of rooms.values()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const leftPlayer = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        // إذا كان المضيف هو الذي غادر، نقوم بنقل المضيف إلى لاعب آخر
        if (room.host === socket.id && room.players.length > 0) {
          room.host = room.players[0].id;
        }

        // إذا لم يبق أي لاعب، نقوم بحذف الغرفة
        if (room.players.length === 0) {
          rooms.delete(room.id);
          roomCodes.delete(room.code);
        } else {
          // تحديث الغرفة للباقين
          updateRoom(room.id);
        }

        // إرسال رسالة مغادرة
        socket.emit('left-room', { message: 'غادرت الغرفة بنجاح' });
        socket.leave(room.id);

        // إرسال رسالة في الدردشة للغرفة إذا كانت لا تزال موجودة
        if (rooms.has(room.id)) {
          const leaveMessage = {
            type: 'system',
            message: `👋 ${leftPlayer.name} غادر الغرفة`,
            timestamp: new Date().toISOString()
          };
          io.to(room.id).emit('chat-message', leaveMessage);
        }

        // تحديث قائمة الغرف العامة
        io.emit('public-rooms-list', getPublicRooms());
        break;
      }
    }
  });

  // إرسال رسالة دردشة
  socket.on('chat-message', (data) => {
    const { message } = data;

    // البحث عن الغرفة التي يوجد بها اللاعب
    for (const room of rooms.values()) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        const chatMessage = {
          type: 'player',
          playerId: player.id,
          playerName: player.name,
          message: message,
          timestamp: new Date().toISOString()
        };
        io.to(room.id).emit('chat-message', chatMessage);
        break;
      }
    }
  });

  // عند انقطع الاتصال
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);

    // البحث عن اللاعب في أي غرفة ومعالجتها كما في مغادرة الغرفة
    for (const room of rooms.values()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const leftPlayer = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        if (room.host === socket.id && room.players.length > 0) {
          room.host = room.players[0].id;
        }

        if (room.players.length === 0) {
          rooms.delete(room.id);
          roomCodes.delete(room.code);
        } else {
          updateRoom(room.id);
        }

        // إرسال رسالة في الدردشة عن انقطع الاتصال
        if (rooms.has(room.id)) {
          const disconnectMessage = {
            type: 'system',
            message: `🔌 ${leftPlayer.name} انقطع عن الاتصال`,
            timestamp: new Date().toISOString()
          };
          io.to(room.id).emit('chat-message', disconnectMessage);
        }

        io.emit('public-rooms-list', getPublicRooms());
        break;
      }
    }
  });
});

// نقطة نهاية (Endpoint) للتحقق من صحة الخادم
app.get('/', (req, res) => {
  res.json({ 
    message: 'Saudi Tour Server is running',
    rooms: rooms.size,
    players: Array.from(rooms.values()).reduce((acc, room) => acc + room.players.length, 0)
  });
});

// تشغيل الخادم على المنفذ المحدد أو 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});