// LINE Webhook for Unsafe-Report System
// Deploy to Vercel

const crypto = require('crypto');

// LINE Configuration (ตั้งค่าใน Vercel Environment Variables)
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Firebase Configuration - แก้ไข URL ให้ถูกต้อง
const FIREBASE_URL = 'https://unsafe-report-default-rtdb.asia-southeast1.firebasedatabase.app';

// ======================= HELPER FUNCTIONS =======================

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
    return response.json();
}

// Reply LINE Message
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
    return response.json();
}

// Get LINE Profile
async function getLineProfile(userId) {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers: {
            'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        }
    });
    return response.json();
}

// Firebase: Get Data
async function firebaseGet(path) {
    const response = await fetch(`${FIREBASE_URL}/${path}.json`);
    return response.json();
}

// Firebase: Set Data
async function firebaseSet(path, data) {
    const response = await fetch(`${FIREBASE_URL}/${path}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

// Firebase: Update Data
async function firebaseUpdate(path, data) {
    const response = await fetch(`${FIREBASE_URL}/${path}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

// ======================= UNITS DATA =======================

// รายชื่อหน่วยงาน 25 หน่วย - กฟจ.ลำพูน
const UNITS = [
    { id: 1, name: "ผปบ. กฟจ.ลำพูน" },
    { id: 2, name: "ผกส. กฟจ.ลำพูน" },
    { id: 3, name: "ผมต. กฟจ.ลำพูน" },
    { id: 4, name: "ผบส. กฟจ.ลำพูน" },
    { id: 5, name: "ผคพ. กฟจ.ลำพูน" },
    { id: 6, name: "ผบร. กฟจ.ลำพูน" },
    { id: 7, name: "ผสน. กฟจ.ลำพูน" },
    { id: 8, name: "ผปร. กฟส.ป่าซาง" },
    { id: 9, name: "ผบค. กฟส.ป่าซาง" },
    { id: 10, name: "ผบง. กฟส.ป่าซาง" },
    { id: 11, name: "ผปร. กฟส.บ้านโฮ่ง" },
    { id: 12, name: "ผบค. กฟส.บ้านโฮ่ง" },
    { id: 13, name: "ผบง. กฟส.บ้านโฮ่ง" },
    { id: 14, name: "ผปร. กฟส.ลี้" },
    { id: 15, name: "ผบค. กฟส.ลี้" },
    { id: 16, name: "ผบง. กฟส.ลี้" },
    { id: 17, name: "ผปร. กฟส.บ้านธิ" },
    { id: 18, name: "ผบค. กฟส.บ้านธิ" },
    { id: 19, name: "ผบง. กฟส.บ้านธิ" },
    { id: 20, name: "กฟส.แม่ทา" },
    { id: 21, name: "กฟส.นครเจดีย์" },
    { id: 22, name: "กฟส.เวียงหนองล่อง" },
    { id: 23, name: "กฟส.ทุ่งหัวช้าง" },
    { id: 24, name: "กฟส.แม่ตืน" },
    { id: 25, name: "อื่นๆ" }
];

// ======================= MESSAGE HANDLERS =======================

// Handle Follow Event (เมื่อมีคนเพิ่มเพื่อน)
async function handleFollow(event) {
    const userId = event.source.userId;
    const profile = await getLineProfile(userId);
    
    const welcomeMessage = {
        type: 'text',
        text: `🎉 ยินดีต้อนรับคุณ ${profile.displayName} สู่ระบบ Unsafe-Report กฟจ.ลำพูน!\n\n📝 กรุณาลงทะเบียนโดยพิมพ์ "ลงทะเบียน" เพื่อเลือกหน่วยงานของคุณ\n\nหรือพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งที่ใช้ได้`
    };
    
    await replyLineMessage(event.replyToken, [welcomeMessage]);
}

// Handle Text Message
async function handleTextMessage(event) {
    const userId = event.source.userId;
    const text = event.message.text.trim().toLowerCase();
    const originalText = event.message.text.trim();
    
    // ตรวจสอบคำสั่ง
    if (text === 'ลงทะเบียน' || text === 'register') {
        await handleRegister(event);
    } else if (text === 'สถานะ' || text === 'status') {
        await handleStatus(event);
    } else if (text === 'ช่วยเหลือ' || text === 'help') {
        await handleHelp(event);
    } else if (text.startsWith('เลือกหน่วยงาน:') || originalText.match(/^กฟ[จอย]\./)) {
        await handleSelectUnit(event, originalText);
    } else {
        // Default response
        await replyLineMessage(event.replyToken, [{
            type: 'text',
            text: `🤖 สวัสดีครับ!\n\nพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งที่ใช้ได้`
        }]);
    }
}

// Handle Register Command
async function handleRegister(event) {
    // ดึงข้อมูลหน่วยงานจาก Firebase
    let units = await firebaseGet('units');
    
    // ถ้าไม่มีข้อมูลใน Firebase ให้ใช้ข้อมูล default และบันทึกลง Firebase
    if (!units || Object.keys(units).length === 0) {
        // บันทึกข้อมูลหน่วยงานลง Firebase
        await firebaseSet('units', UNITS);
        units = UNITS;
    }
    
    // แปลงเป็น array ถ้าเป็น object
    const unitsArray = Array.isArray(units) ? units : Object.values(units);
    
    // สร้าง Quick Reply สำหรับเลือกหน่วยงาน (แสดงเฉพาะ 13 หน่วยแรกก่อน)
    const quickReplyItems = unitsArray.slice(0, 13).map(unit => ({
        type: 'action',
        action: {
            type: 'message',
            label: unit.name.substring(0, 20), // LINE จำกัด label 20 ตัวอักษร
            text: unit.name
        }
    }));
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: '📋 กรุณาเลือกหน่วยงานของคุณ:\n\n(เลือกจากปุ่มด้านล่าง หรือพิมพ์ชื่อหน่วยงาน)',
        quickReply: {
            items: quickReplyItems
        }
    }]);
}

// Handle Unit Selection
async function handleSelectUnit(event, unitName) {
    const userId = event.source.userId;
    const profile = await getLineProfile(userId);
    
    // หา unit จากชื่อ
    let units = await firebaseGet('units');
    
    // ถ้าไม่มีข้อมูลใน Firebase ให้ใช้ข้อมูล default
    if (!units || Object.keys(units).length === 0) {
        await firebaseSet('units', UNITS);
        units = UNITS;
    }
    
    const unitsArray = Array.isArray(units) ? units : Object.values(units);
    
    // ค้นหาหน่วยงานที่ตรงกัน
    let selectedUnit = unitsArray.find(u => u.name === unitName);
    
    // ถ้าไม่เจอ ลองค้นหาแบบ partial match
    if (!selectedUnit) {
        selectedUnit = unitsArray.find(u => unitName.includes(u.name) || u.name.includes(unitName));
    }
    
    if (!selectedUnit) {
        await replyLineMessage(event.replyToken, [{
            type: 'text',
            text: '❌ ไม่พบหน่วยงานที่เลือก กรุณาลองใหม่อีกครั้ง\n\nพิมพ์ "ลงทะเบียน" เพื่อเลือกหน่วยงาน'
        }]);
        return;
    }
    
    // บันทึกข้อมูลผู้ใช้ลง Firebase
    const userData = {
        odUserId: userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        unitId: selectedUnit.id,
        unitName: selectedUnit.name,
        registeredAt: new Date().toISOString(),
        status: 'active'
    };
    
    await firebaseSet(`lineUsers/${userId}`, userData);
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: `✅ ลงทะเบียนสำเร็จ!\n\n👤 ชื่อ: ${profile.displayName}\n🏢 หน่วยงาน: ${selectedUnit.name}\n\n📬 คุณจะได้รับการแจ้งเตือนเมื่อมีรายงานใหม่ที่เกี่ยวข้องกับหน่วยงานของคุณ`
    }]);
}

// Handle Status Command
async function handleStatus(event) {
    const userId = event.source.userId;
    
    // ดึงข้อมูลผู้ใช้จาก Firebase
    const userData = await firebaseGet(`lineUsers/${userId}`);
    
    if (!userData) {
        await replyLineMessage(event.replyToken, [{
            type: 'text',
            text: '❌ คุณยังไม่ได้ลงทะเบียน\n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มต้นใช้งาน'
        }]);
        return;
    }
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: `📊 สถานะการลงทะเบียน\n\n👤 ชื่อ: ${userData.displayName}\n🏢 หน่วยงาน: ${userData.unitName}\n📅 ลงทะเบียนเมื่อ: ${new Date(userData.registeredAt).toLocaleDateString('th-TH')}\n✅ สถานะ: พร้อมรับการแจ้งเตือน`
    }]);
}

// Handle Help Command
async function handleHelp(event) {
    const helpText = `📖 คู่มือการใช้งาน Unsafe-Report Bot

🔹 คำสั่งที่ใช้ได้:

1️⃣ "ลงทะเบียน" - ลงทะเบียนเข้าใช้งานระบบ
2️⃣ "สถานะ" - ตรวจสอบสถานะการลงทะเบียน
3️⃣ "ช่วยเหลือ" - แสดงคู่มือการใช้งาน

🔔 การแจ้งเตือน:
• เมื่อมีรายงานใหม่มอบหมายให้หน่วยงานของคุณ
• เมื่อรายงานได้รับการอนุมัติ
• เมื่อรายงานถูกตีกลับแก้ไข

🌐 เว็บไซต์: https://unsafe-report.vercel.app`;

    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: helpText
    }]);
}

// ======================= NOTIFICATION FUNCTIONS =======================

// ส่งการแจ้งเตือนไปยังหัวหน้าหน่วยงาน
async function notifyUnitHead(unitName, message) {
    // ดึงข้อมูล LINE Users ทั้งหมด
    const lineUsers = await firebaseGet('lineUsers');
    
    if (!lineUsers) return { success: false, message: 'No LINE users registered' };
    
    // หา users ที่อยู่ในหน่วยงานนี้
    const targetUsers = Object.values(lineUsers).filter(user => 
        user.unitName === unitName && user.status === 'active'
    );
    
    if (targetUsers.length === 0) {
        return { success: false, message: 'No users found for this unit' };
    }
    
    // ส่งข้อความไปยังทุกคนในหน่วยงาน
    const results = await Promise.all(
        targetUsers.map(user => sendLineMessage(user.odUserId, [{ type: 'text', text: message }]))
    );
    
    return { success: true, sent: targetUsers.length };
}

// ======================= MAIN HANDLER =======================

module.exports = async (req, res) => {
    // Handle GET request (for verification)
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'ok',
            message: 'Unsafe-Report LINE Webhook is running',
            timestamp: new Date().toISOString()
        });
    }
    
    // Handle POST request (webhook events)
    if (req.method === 'POST') {
        try {
            const body = JSON.stringify(req.body);
            const signature = req.headers['x-line-signature'];
            
            // Verify signature (optional for testing)
            // if (!verifySignature(body, signature)) {
            //     return res.status(401).json({ error: 'Invalid signature' });
            // }
            
            const events = req.body.events || [];
            
            // Process each event
            for (const event of events) {
                if (event.type === 'follow') {
                    await handleFollow(event);
                } else if (event.type === 'message' && event.message.type === 'text') {
                    await handleTextMessage(event);
                }
            }
            
            return res.status(200).json({ success: true });
            
        } catch (error) {
            console.error('Webhook error:', error);
            return res.status(500).json({ error: error.message });
        }
    }
    
    // Handle other methods
    return res.status(405).json({ error: 'Method not allowed' });
};
