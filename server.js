// server.js - خادم اللعبة الجماعية "جولة سعودية"
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // يمكنك تغييره ليكون أكثر أماناً
    methods: ["GET", "POST"]
  }
});

// استخدام CORS للسماح بالطلبات من أي مصدر
app.use(cors());

// خدمة الملفات الثابتة من المجلد الحالي
app.use(express.static(__dirname));

// تخزين بيانات الغرف
const rooms = new Map();

// توليد رمز غرفة عشوائي
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// إعداد نظام الألوان للاعبين
const PLAYER_COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'];

// إنشاء غرفة جديدة
function createRoom(hostName, hostIcon = '👑', hostColor = '#fbbf24') {
  const roomCode = generateRoomCode();
  
  const room = {
    code: roomCode,
    host: null, // سيتم تعيينه عند انضمام المضيف
    players: [],
    gameState: null,
    started: false,
    createdAt: Date.now(),
    maxPlayers: 4
  };
  
  rooms.set(roomCode, room);
  console.log(`✅ تم إنشاء غرفة جديدة: ${roomCode}`);
  return roomCode;
}

// الانضمام إلى غرفة
function joinRoom(roomCode, playerName, playerIcon = '👤', playerColor = '#3b82f6') {
  const room = rooms.get(roomCode);
  
  if (!room) {
    throw new Error('الغرفة غير موجودة');
  }
  
  if (room.started) {
    throw new Error('اللعبة بدأت بالفعل في هذه الغرفة');
  }
  
  if (room.players.length >= room.maxPlayers) {
    throw new Error('الغرفة ممتلئة');
  }
  
  // التحقق من عدم وجود لاعب بنفس الاسم
  const existingPlayer = room.players.find(p => p.name === playerName);
  if (existingPlayer) {
    throw new Error('هذا الاسم مستخدم بالفعل في الغرفة');
  }
  
  return room;
}

// بدء اللعبة في غرفة
function startGame(roomCode) {
  const room = rooms.get(roomCode);
  
  if (!room) {
    throw new Error('الغرفة غير موجودة');
  }
  
  if (room.started) {
    throw new Error('اللعبة بدأت بالفعل');
  }
  
  if (room.players.length < 2) {
    throw new Error('يجب أن يكون هناك لاعبين على الأقل');
  }
  
  // التحقق من أن جميع اللاعبين جاهزون
  const allReady = room.players.every(p => p.ready);
  if (!allReady) {
    throw new Error('جميع اللاعبين يجب أن يكونوا جاهزين');
  }
  
  room.started = true;
  
  // إنشاء حالة اللعبة
  room.gameState = {
    roomCode: roomCode,
    players: room.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      icon: player.icon,
      color: player.color,
      hand: [],
      announced: false,
      isAI: false,
      isOnline: true
    })),
    deck: [],
    currentCard: null,
    currentPlayerIndex: 0,
    direction: 1,
    drawPileCards: 0
  };
  
  // إنشاء وتوزيع البطاقات
  const deck = createDeck();
  room.gameState.deck = deck;
  
  room.gameState.players.forEach(player => {
    player.hand = deck.splice(0, 7);
  });
  
  // اختيار بطاقة بداية
  do {
    room.gameState.currentCard = deck.splice(0, 1)[0];
  } while (room.gameState.currentCard.type !== "city");
  
  room.gameState.drawPileCards = deck.length;
  
  console.log(`🎮 بدأت اللعبة في الغرفة: ${roomCode}`);
  return room.gameState;
}

// إنشاء مجموعة بطاقات (مطابق للكود في المقدمة)
function createDeck() {
  const CITIES = [
    { name: "مكة", color: "أحمر" },
    { name: "المدينة المنورة", color: "أخضر" },
    { name: "الرياض", color: "أحمر" },
    { name: "جدة", color: "أزرق" },
    { name: "الدمام", color: "أزرق" },
    { name: "الدرعية", color: "أحمر" },
    { name: "أبها", color: "أصفر" },
    { name: "العلا", color: "برتقالي" },
    { name: "نيوم", color: "بنفسجي" }
  ];
  
  const COLORS = [
    { name: "أحمر", value: "#ef4444" },
    { name: "أزرق", value: "#3b82f6" },
    { name: "أخضر", value: "#10b981" },
    { name: "أصفر", value: "#fbbf24" }
  ];
  
  const SPECIAL_CARDS = [
    { type: "skip", name: "تخطي" },
    { type: "reverse", name: "عكس" },
    { type: "draw2", name: "+2" },
    { type: "wildColor", name: "تغيير لون" },
    { type: "wildCity", name: "تغيير مدينة" }
  ];
  
  const deck = [];
  
  // إضافة بطاقات المدن
  CITIES.forEach(city => {
    COLORS.forEach(color => {
      for (let i = 0; i < 2; i++) {
        deck.push({
          type: "city",
          city: city.name,
          color: color.name,
          colorValue: color.value,
          // في الخادم نحتاج فقط للبيانات، الصور ستأتي من العميل
        });
      }
    });
  });
  
  // إضافة البطاقات الخاصة
  SPECIAL_CARDS.forEach(specialCard => {
    for (let i = 0; i < 4; i++) {
      deck.push({
        type: specialCard.type,
        name: specialCard.name,
        color: null,
        colorValue: specialCard.type.includes("wild") ? "#6b21a8" : "#8b5cf6"
      });
    }
  });
  
  // خلط البطاقات
  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// تنظيف الغرف القديمة تلقائياً كل ساعة
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [roomCode, room] of rooms.entries()) {
    if (now - room.createdAt > oneHour) {
      if (room.players.length === 0) {
        rooms.delete(roomCode);
        console.log(`🗑️ تم تنظيف الغرفة القديمة: ${roomCode}`);
      }
    }
  }
}, 60 * 60 * 1000); // كل ساعة

// نقطة نهاية للتحقق من حالة الخادم
app.get('/status', (req, res) => {
  res.json({
    status: '✅ الخادم يعمل',
    rooms: rooms.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// نقطة نهاية للحصول على قائمة الغرف المتاحة
app.get('/rooms', (req, res) => {
  const availableRooms = Array.from(rooms.values())
    .filter(room => !room.started && room.players.length < room.maxPlayers)
    .map(room => ({
      code: room.code,
      players: room.players.length,
      maxPlayers: room.maxPlayers,
      host: room.players.find(p => p.id === room.host)?.name || 'غير معروف'
    }));
  
  res.json({
    rooms: availableRooms,
    total: availableRooms.length
  });
});

// إعداد Socket.io
io.on('connection', (socket) => {
  console.log(`🔗 لاعب متصل: ${socket.id}`);
  
  // استقبال طلب إنشاء غرفة
  socket.on('create-room', (data) => {
    try {
      const { name, icon, color } = data;
      
      // إنشاء غرفة جديدة
      const roomCode = createRoom(name, icon, color);
      const room = rooms.get(roomCode);
      
      // إضافة المضيف كأول لاعب
      const player = {
        id: socket.id,
        name: name,
        icon: icon || '👑',
        color: color || '#fbbf24',
        ready: false
      };
      
      room.players.push(player);
      room.host = socket.id;
      
      // انضم المقبس إلى غرفة Socket.io
      socket.join(roomCode);
      
      // تخزين معلومات الغرفة في المقبس
      socket.data.roomCode = roomCode;
      socket.data.playerName = name;
      
      console.log(`👑 ${name} أنشأ الغرفة: ${roomCode}`);
      
      // إرسال تأكيد للاعب
      socket.emit('room-created', {
        roomCode: roomCode,
        room: room
      });
      
      // إرسال تحديث لجميع اللاعبين في الغرفة (في حال وجود آخرين)
      io.to(roomCode).emit('room-updated', room);
      
    } catch (error) {
      console.error('❌ خطأ في إنشاء الغرفة:', error.message);
      socket.emit('error', `فشل إنشاء الغرفة: ${error.message}`);
    }
  });
  
  // استقبال طلب الانضمام إلى غرفة
  socket.on('join-room', (data) => {
    try {
      const { roomCode, playerName, icon, color } = data;
      
      // التحقق من وجود الغرفة
      const room = joinRoom(roomCode, playerName, icon, color);
      
      // إضافة اللاعب الجديد
      const player = {
        id: socket.id,
        name: playerName,
        icon: icon || '👤',
        color: color || PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
        ready: false
      };
      
      room.players.push(player);
      
      // انضم المقبس إلى غرفة Socket.io
      socket.join(roomCode);
      
      // تخزين معلومات الغرفة في المقبس
      socket.data.roomCode = roomCode;
      socket.data.playerName = playerName;
      
      console.log(`👤 ${playerName} انضم إلى الغرفة: ${roomCode}`);
      
      // إرسال تأكيد للاعب الجديد
      socket.emit('joined-room', {
        roomCode: roomCode,
        room: room
      });
      
      // إرسال تحديث لجميع اللاعبين في الغرفة
      io.to(roomCode).emit('room-updated', room);
      
    } catch (error) {
      console.error('❌ خطأ في الانضمام إلى الغرفة:', error.message);
      socket.emit('error', `فشل الانضمام إلى الغرفة: ${error.message}`);
    }
  });
  
  // تبديل حالة الاستعداد
  socket.on('toggle-ready', (roomCode) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room) {
        throw new Error('الغرفة غير موجودة');
      }
      
      const player = room.players.find(p => p.id === socket.id);
      
      if (!player) {
        throw new Error('اللاعب غير موجود في الغرفة');
      }
      
      // تبديل حالة الاستعداد
      player.ready = !player.ready;
      
      console.log(`✅ ${player.name} ${player.ready ? 'أصبح جاهزاً' : 'لم يعد جاهزاً'}`);
      
      // إرسال تحديث لجميع اللاعبين في الغرفة
      io.to(roomCode).emit('room-updated', room);
      
    } catch (error) {
      console.error('❌ خطأ في تبديل الاستعداد:', error.message);
      socket.emit('error', `فشل تبديل الاستعداد: ${error.message}`);
    }
  });
  
  // بدء اللعبة
  socket.on('start-game', (roomCode) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room) {
        throw new Error('الغرفة غير موجودة');
      }
      
      // التحقق من أن المرسل هو المضيف
      if (room.host !== socket.id) {
        throw new Error('فقط المضيف يمكنه بدء اللعبة');
      }
      
      // بدء اللعبة
      const gameState = startGame(roomCode);
      
      // إرسال إشعار بدء اللعبة للجميع
      io.to(roomCode).emit('game-starting');
      
      // بعد 3 ثوانٍ، إرسال حالة اللعبة
      setTimeout(() => {
        io.to(roomCode).emit('game-started', gameState);
      }, 3000);
      
    } catch (error) {
      console.error('❌ خطأ في بدء اللعبة:', error.message);
      socket.emit('error', `فشل بدء اللعبة: ${error.message}`);
    }
  });
  
  // لعب بطاقة
  socket.on('play-card', (data) => {
    try {
      const { roomCode, cardIndex } = data;
      const room = rooms.get(roomCode);
      
      if (!room || !room.gameState) {
        throw new Error('اللعبة غير نشطة');
      }
      
      const player = room.gameState.players.find(p => p.id === socket.id);
      
      if (!player) {
        throw new Error('اللاعب غير موجود في اللعبة');
      }
      
      // التحقق من أن الدور للاعب
      const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
      if (currentPlayer.id !== socket.id) {
        throw new Error('ليس دورك للعب الآن');
      }
      
      // التحقق من أن الفهرس صالح
      if (cardIndex < 0 || cardIndex >= player.hand.length) {
        throw new Error('بطاقة غير صالحة');
      }
      
      const card = player.hand[cardIndex];
      
      // هنا يجب إضافة منطق التحقق من إمكانية لعب البطاقة
      // (يمكن استيراد دالة canPlayCard من الكود الأمامي)
      
      // لعب البطاقة
      player.hand.splice(cardIndex, 1);
      room.gameState.currentCard = card;
      
      // التحقق من الفوز
      if (player.hand.length === 0) {
        room.gameState.winner = player;
        io.to(roomCode).emit('game-ended', {
          winner: player,
          gameState: room.gameState
        });
        
        // إعادة تعيين الغرفة بعد انتهاء اللعبة
        setTimeout(() => {
          room.started = false;
          room.gameState = null;
          room.players.forEach(p => p.ready = false);
          io.to(roomCode).emit('room-updated', room);
        }, 10000);
        
        return;
      }
      
      // تبديل الدور
      room.gameState.currentPlayerIndex = 
        (room.gameState.currentPlayerIndex + room.gameState.direction + room.gameState.players.length) 
        % room.gameState.players.length;
      
      // تحديث حالة اللعبة للجميع
      io.to(roomCode).emit('game-updated', room.gameState);
      
    } catch (error) {
      console.error('❌ خطأ في لعب البطاقة:', error.message);
      socket.emit('error', `فشل لعب البطاقة: ${error.message}`);
    }
  });
  
  // سحب بطاقة
  socket.on('draw-card', (roomCode) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room || !room.gameState) {
        throw new Error('اللعبة غير نشطة');
      }
      
      const player = room.gameState.players.find(p => p.id === socket.id);
      
      if (!player) {
        throw new Error('اللاعب غير موجود في اللعبة');
      }
      
      // التحقق من أن الدور للاعب
      const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
      if (currentPlayer.id !== socket.id) {
        throw new Error('ليس دورك للعب الآن');
      }
      
      // التحقق من وجود بطاقات في كومة السحب
      if (room.gameState.deck.length === 0) {
        throw new Error('لا توجد بطاقات للسحب');
      }
      
      // سحب بطاقة
      const drawnCard = room.gameState.deck.pop();
      player.hand.push(drawnCard);
      room.gameState.drawPileCards = room.gameState.deck.length;
      
      // تحديث حالة اللعبة للجميع
      io.to(roomCode).emit('game-updated', room.gameState);
      
    } catch (error) {
      console.error('❌ خطأ في سحب البطاقة:', error.message);
      socket.emit('error', `فشل سحب البطاقة: ${error.message}`);
    }
  });
  
  // إعلان UNO
  socket.on('announce-uno', (roomCode) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room || !room.gameState) {
        throw new Error('اللعبة غير نشطة');
      }
      
      const player = room.gameState.players.find(p => p.id === socket.id);
      
      if (!player) {
        throw new Error('اللاعب غير موجود في اللعبة');
      }
      
      // التحقق من أن اللاعب لديه بطاقتين
      if (player.hand.length !== 2) {
        throw new Error('يمكن الإعلان فقط عندما يكون لديك بطاقتين');
      }
      
      // تحديث حالة الإعلان
      player.announced = true;
      
      // إرسال إشعار للجميع
      io.to(roomCode).emit('player-announced-uno', {
        playerName: player.name,
        gameState: room.gameState
      });
      
    } catch (error) {
      console.error('❌ خطأ في إعلان UNO:', error.message);
      socket.emit('error', `فشل إعلان UNO: ${error.message}`);
    }
  });
  
  // مغادرة الغرفة
  socket.on('leave-room', (roomCode) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room) {
        throw new Error('الغرفة غير موجودة');
      }
      
      const player = room.players.find(p => p.id === socket.id);
      
      if (player) {
        console.log(`🚪 ${player.name} غادر الغرفة: ${roomCode}`);
        
        // إزالة اللاعب من الغرفة
        room.players = room.players.filter(p => p.id !== socket.id);
        
        // إذا كان اللاعب هو المضيف، نقل المضيفية
        if (room.host === socket.id && room.players.length > 0) {
          room.host = room.players[0].id;
          room.players[0].icon = '👑';
          room.players[0].color = '#fbbf24';
        }
        
        // إذا كانت اللعبة بدأت، إنهاؤها
        if (room.started) {
          room.started = false;
          room.gameState = null;
          room.players.forEach(p => p.ready = false);
        }
        
        // إذا لم يبقَ أي لاعب، حذف الغرفة
        if (room.players.length === 0) {
          rooms.delete(roomCode);
          console.log(`🗑️ تم حذف الغرفة الفارغة: ${roomCode}`);
        } else {
          // إرسال تحديث للاعبين المتبقين
          io.to(roomCode).emit('player-left', {
            playerName: player.name,
            room: room
          });
        }
      }
      
      // مغادرة غرفة Socket.io
      socket.leave(roomCode);
      
      // تنظيف بيانات المقبس
      delete socket.data.roomCode;
      delete socket.data.playerName;
      
    } catch (error) {
      console.error('❌ خطأ في مغادرة الغرفة:', error.message);
    }
  });
  
  // قطع الاتصال
  socket.on('disconnect', () => {
    console.log(`🔌 لاعب انقطع: ${socket.id}`);
    
    // إذا كان اللاعب في غرفة، معالجة مغادرته
    const roomCode = socket.data.roomCode;
    if (roomCode) {
      socket.emit('leave-room', roomCode);
    }
  });
});

// بدء الخادم
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ===========================================
  🚀 خادم "جولة سعودية" يعمل على المنفذ ${PORT}
  ===========================================
  
  🔗 رابط الخادم المحلي: http://localhost:${PORT}
  🌐 رابط حالة الخادم: http://localhost:${PORT}/status
  📋 قائمة الغرف المتاحة: http://localhost:${PORT}/rooms
  
  📌 تعليمات التشغيل:
  1. افتح اللعبة في متصفح: http://localhost:${PORT}
  2. اختر "اللعب الجماعي"
  3. أنشئ غرفة جديدة أو انضم إلى غرفة موجودة
  
  ===========================================
  `);
});