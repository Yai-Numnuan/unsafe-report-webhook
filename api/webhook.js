// LINE Webhook for Unsafe-Report System
// Deploy to Vercel

const crypto = require('crypto');

// LINE Configuration (ตั้งค่าใน Vercel Environment Variables)
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Firebase Configuration
const FIREBASE_URL = 'https://line-safe-default-rtdb.asia-southeast1.firebasedatabase.app';

// ==================== HELPER FUNCTIONS ====================

// Verify LINE Signature
function verifySignature(body, signature) {
  const hash = crypto
    .createHmac('SHA256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// Send LINE Message
async function sendLineMessage(userId, messages) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to: userId,
      messages: messages
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('LINE API Error:', error);
    return false;
  }
  return true;
}

// Reply to LINE Message
async function replyLineMessage(replyToken, messages) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: messages
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('LINE Reply Error:', error);
    return false;
  }
  return true;
}

// Get LINE User Profile
async function getLineProfile(userId) {
  const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: {
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
    }
  });
  
  if (!response.ok) return null;
  return await response.json();
}

// Save LINE User to Firebase
async function saveLineUser(userId, userData) {
  const response = await fetch(`${FIREBASE_URL}/lineUsers/${userId}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return response.ok;
}

// Get LINE User from Firebase
async function getLineUser(userId) {
  const response = await fetch(`${FIREBASE_URL}/lineUsers/${userId}.json`);
  if (!response.ok) return null;
  return await response.json();
}

// Get Units from Firebase
async function getUnits() {
  const response = await fetch(`${FIREBASE_URL}/units.json`);
  if (!response.ok) return [];
  const data = await response.json();
  return data || [];
}

// ==================== MESSAGE HANDLERS ====================

// Handle Follow Event (เมื่อมีคนแอด LINE OA)
async function handleFollow(event) {
  const userId = event.source.userId;
  const profile = await getLineProfile(userId);
  
  // บันทึกข้อมูลเบื้องต้น
  await saveLineUser(userId, {
    odisplayName: profile?.displayName || 'Unknown',
    odimension: profile?.pictureUrl || '',
    registeredAt: new Date().toISOString(),
    unitId: null,
    unitName: null
  });
  
  // ส่งข้อความต้อนรับ
  const welcomeMessage = {
    type: 'flex',
    altText: 'ยินดีต้อนรับสู่ระบบ Unsafe-Report',
    contents: {
      type: 'bubble',
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🚨 Unsafe-Report',
            weight: 'bold',
            size: 'xl',
            color: '#DC2626',
            align: 'center'
          },
          {
            type: 'text',
            text: 'ระบบรายงานการปฏิบัติงานที่ไม่ปลอดภัย',
            size: 'sm',
            color: '#666666',
            align: 'center',
            margin: 'sm'
          }
        ],
        paddingAll: '20px',
        backgroundColor: '#FEF2F2'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `สวัสดีคุณ ${profile?.displayName || ''} 👋`,
            weight: 'bold',
            size: 'md'
          },
          {
            type: 'text',
            text: 'ยินดีต้อนรับสู่ระบบแจ้งเตือน Unsafe-Report',
            size: 'sm',
            color: '#666666',
            margin: 'md',
            wrap: true
          },
          {
            type: 'separator',
            margin: 'lg'
          },
          {
            type: 'text',
            text: '📋 กรุณาลงทะเบียนเลือกหน่วยงาน',
            size: 'sm',
            margin: 'lg',
            wrap: true
          },
          {
            type: 'text',
            text: 'พิมพ์ "ลงทะเบียน" เพื่อเริ่มต้น',
            size: 'sm',
            color: '#2563EB',
            margin: 'sm'
          }
        ]
      }
    }
  };
  
  await replyLineMessage(event.replyToken, [welcomeMessage]);
}

// Handle Text Message
async function handleTextMessage(event) {
  const userId = event.source.userId;
  const text = event.message.text.trim().toLowerCase();
  const user = await getLineUser(userId);
  
  // คำสั่ง "ลงทะเบียน"
  if (text === 'ลงทะเบียน' || text === 'register') {
    const units = await getUnits();
    
    if (!units || units.length === 0) {
      await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: '❌ ไม่พบข้อมูลหน่วยงาน กรุณาติดต่อ Admin'
      }]);
      return;
    }
    
    // สร้าง Quick Reply สำหรับเลือกหน่วยงาน
    const quickReplyItems = units.slice(0, 13).map(unit => ({
      type: 'action',
      action: {
        type: 'message',
        label: unit.name.substring(0, 20),
        text: `เลือกหน่วยงาน:${unit.id}`
      }
    }));
    
    await replyLineMessage(event.replyToken, [{
      type: 'text',
      text: '📋 กรุณาเลือกหน่วยงานของคุณ:\n\n(เลือกจากปุ่มด้านล่าง หรือพิมพ์ "เลือกหน่วยงาน:หมายเลข")',
      quickReply: {
        items: quickReplyItems
      }
    }]);
    return;
  }
  
  // เลือกหน่วยงาน
  if (text.startsWith('เลือกหน่วยงาน:')) {
    const unitId = parseInt(text.replace('เลือกหน่วยงาน:', ''));
    const units = await getUnits();
    const unit = units.find(u => u.id === unitId);
    
    if (!unit) {
      await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: '❌ ไม่พบหน่วยงานที่เลือก กรุณาลองใหม่'
      }]);
      return;
    }
    
    const profile = await getLineProfile(userId);
    
    // บันทึกข้อมูลลงทะเบียน
    await saveLineUser(userId, {
      displayName: profile?.displayName || 'Unknown',
      pictureUrl: profile?.pictureUrl || '',
      registeredAt: new Date().toISOString(),
      unitId: unitId,
      unitName: unit.name
    });
    
    await replyLineMessage(event.replyToken, [{
      type: 'flex',
      altText: 'ลงทะเบียนสำเร็จ',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '✅ ลงทะเบียนสำเร็จ!',
              weight: 'bold',
              size: 'lg',
              color: '#16A34A'
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  contents: [
                    { type: 'text', text: 'ชื่อ:', size: 'sm', color: '#666666', flex: 2 },
                    { type: 'text', text: profile?.displayName || '-', size: 'sm', flex: 5 }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  margin: 'sm',
                  contents: [
                    { type: 'text', text: 'หน่วยงาน:', size: 'sm', color: '#666666', flex: 2 },
                    { type: 'text', text: unit.name, size: 'sm', flex: 5, wrap: true }
                  ]
                }
              ]
            },
            {
              type: 'text',
              text: '🔔 คุณจะได้รับแจ้งเตือนเมื่อมีรายงานใหม่',
              size: 'xs',
              color: '#666666',
              margin: 'lg',
              wrap: true
            }
          ]
        }
      }
    }]);
    return;
  }
  
  // คำสั่ง "สถานะ"
  if (text === 'สถานะ' || text === 'status') {
    if (!user || !user.unitId) {
      await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: '❌ คุณยังไม่ได้ลงทะเบียน\n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มต้น'
      }]);
      return;
    }
    
    await replyLineMessage(event.replyToken, [{
      type: 'text',
      text: `📋 สถานะการลงทะเบียน\n\n✅ ลงทะเบียนแล้ว\n👤 ชื่อ: ${user.displayName}\n🏢 หน่วยงาน: ${user.unitName}\n📅 วันที่: ${new Date(user.registeredAt).toLocaleDateString('th-TH')}`
    }]);
    return;
  }
  
  // คำสั่ง "ช่วยเหลือ"
  if (text === 'ช่วยเหลือ' || text === 'help' || text === '?') {
    await replyLineMessage(event.replyToken, [{
      type: 'text',
      text: '📚 คำสั่งที่ใช้ได้:\n\n• ลงทะเบียน - ลงทะเบียนเลือกหน่วยงาน\n• สถานะ - ดูสถานะการลงทะเบียน\n• ช่วยเหลือ - ดูคำสั่งทั้งหมด\n\n🔔 ระบบจะส่งแจ้งเตือนอัตโนมัติเมื่อมีรายงานใหม่ที่เกี่ยวข้องกับหน่วยงานของคุณ'
    }]);
    return;
  }
  
  // ข้อความทั่วไป
  await replyLineMessage(event.replyToken, [{
    type: 'text',
    text: '🤖 สวัสดีครับ!\n\nพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งที่ใช้ได้'
  }]);
}

// ==================== MAIN HANDLER ====================

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Line-Signature');
  
  // Handle OPTIONS (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Handle GET (Health Check)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'ok', 
      message: 'Unsafe-Report LINE Webhook is running',
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle POST (LINE Webhook)
  if (req.method === 'POST') {
    try {
      const signature = req.headers['x-line-signature'];
      const body = JSON.stringify(req.body);
      
      // Verify signature
      if (!verifySignature(body, signature)) {
        console.error('Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      const events = req.body.events;
      
      // Process events
      for (const event of events) {
        console.log('Event:', event.type);
        
        if (event.type === 'follow') {
          await handleFollow(event);
        } else if (event.type === 'message' && event.message.type === 'text') {
          await handleTextMessage(event);
        }
      }
      
      return res.status(200).json({ success: true });
      
    } catch (error) {
      console.error('Webhook Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
