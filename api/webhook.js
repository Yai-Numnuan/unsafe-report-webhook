// LINE Webhook for Unsafe-Report System
// Deploy to Vercel
// รองรับการเลือกหลายหน่วยงาน + ปุ่ม จป.เทคนิค

const crypto = require('crypto');

// LINE Configuration (ตั้งค่าใน Vercel Environment Variables)
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Firebase Configuration
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

// ปุ่มสำเร็จรูป จป.เทคนิค - แต่ละ กฟส.S ดูแลหน่วยงานไหนบ้าง
const JSP_PRESETS = {
    "จป. กฟส.ป่าซาง": [8, 9, 10, 21],      // ผปร./ผบค./ผบง. กฟส.ป่าซาง + กฟส.นครเจดีย์
    "จป. กฟส.บ้านโฮ่ง": [11, 12, 13, 22],   // ผปร./ผบค./ผบง. กฟส.บ้านโฮ่ง + กฟส.เวียงหนองล่อง
    "จป. กฟส.ลี้": [14, 15, 16, 23, 24],    // ผปร./ผบค./ผบง. กฟส.ลี้ + กฟส.ทุ่งหัวช้าง + กฟส.แม่ตืน
    "จป. กฟส.บ้านธิ": [17, 18, 19]          // ผปร./ผบค./ผบง. กฟส.บ้านธิ
};

// ======================= MESSAGE HANDLERS =======================

// Handle Follow Event (เมื่อมีคนเพิ่มเพื่อน)
async function handleFollow(event) {
    const welcomeMessage = {
        type: 'text',
        text: `📌 ส่วนนี้เฉพาะ:\n• หัวหน้าหน่วยงาน\n• หรือผู้ที่ได้รับมอบหมาย\n\n📝 กรุณาพิมพ์ "ลงทะเบียน" เพื่อรับการแจ้งเตือนเฉพาะหน่วยงานของคุณ`
    };
    
    await replyLineMessage(event.replyToken, [welcomeMessage]);
}

// Handle Text Message
async function handleTextMessage(event) {
    const userId = event.source.userId;
    const text = event.message.text.trim();
    const textLower = text.toLowerCase();
    
    // ตรวจสอบคำสั่ง
    if (textLower === 'ลงทะเบียน' || textLower === 'register') {
        await handleRegister(event);
    } else if (textLower === 'เสร็จสิ้น' || textLower === 'done') {
        await handleFinishRegistration(event);
    } else if (textLower === 'ยกเลิก' || textLower === 'cancel') {
        await handleCancelRegistration(event);
    } else if (textLower === 'ล้างข้อมูล' || textLower === 'reset') {
        await handleResetRegistration(event);
    } else if (textLower === 'สถานะ' || textLower === 'status') {
        await handleStatus(event);
    } else if (textLower === 'ช่วยเหลือ' || textLower === 'help') {
        await handleHelp(event);
    } else if (JSP_PRESETS[text]) {
        // ปุ่ม จป.เทคนิค
        await handleJSPPreset(event, text);
    } else if (text.match(/^(ผ[ปกมบคสร][บกตสพรนค]?\.|กฟ[จสย]\.|อื่นๆ)/)) {
        // เลือกหน่วยงานทีละอัน
        await handleSelectUnit(event, text);
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
    const userId = event.source.userId;
    
    // ดึงข้อมูลหน่วยงานจาก Firebase
    let units = await firebaseGet('units');
    
    // ถ้าไม่มีข้อมูลใน Firebase ให้ใช้ข้อมูล default และบันทึกลง Firebase
    if (!units || Object.keys(units).length === 0) {
        await firebaseSet('units', UNITS);
        units = UNITS;
    }
    
    const unitsArray = Array.isArray(units) ? units : Object.values(units);
    
    // เริ่มต้น session การลงทะเบียน (เก็บหน่วยงานที่เลือกไว้ชั่วคราว)
    await firebaseSet(`registrationSession/${userId}`, {
        selectedUnits: [],
        startedAt: new Date().toISOString()
    });
    
    // สร้าง Flex Message Carousel
    const flexMessage = {
        type: 'flex',
        altText: 'เลือกหน่วยงานของคุณ',
        contents: {
            type: 'carousel',
            contents: [
                // Bubble 1: กฟจ.ลำพูน (หน่วยงาน 1-7)
                createUnitBubble('🏢 กฟจ.ลำพูน', unitsArray.slice(0, 7)),
                // Bubble 2: กฟส.S (หน่วยงาน 8-19)
                createUnitBubble('🏢 กฟส.S', unitsArray.slice(7, 19)),
                // Bubble 3: กฟส.XS และอื่นๆ (หน่วยงาน 20-25)
                createUnitBubble('🏢 กฟส.XS และอื่นๆ', unitsArray.slice(19, 25)),
                // Bubble 4: ปุ่ม จป.เทคนิค
                createJSPBubble()
            ]
        }
    };
    
    await replyLineMessage(event.replyToken, [
        {
            type: 'text',
            text: '📋 กรุณาเลือกหน่วยงานของคุณ:\n\n👉 เลื่อนซ้าย-ขวา เพื่อดูหน่วยงานทั้งหมด\n👉 กดเลือกได้หลายหน่วยงาน\n👉 กดซ้ำเพื่อยกเลิกหน่วยงานที่เลือกผิด\n👉 พิมพ์ "เสร็จสิ้น" เมื่อเลือกครบแล้ว\n\n💡 จป.เทคนิค: เลื่อนไปการ์ดสุดท้าย'
        },
        flexMessage
    ]);
}

// สร้าง Bubble สำหรับหน่วยงาน
function createUnitBubble(title, units) {
    return {
        type: 'bubble',
        size: 'kilo',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [{
                type: 'text',
                text: title,
                weight: 'bold',
                size: 'md',
                color: '#1a73e8'
            }]
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: units.map(unit => ({
                type: 'button',
                action: {
                    type: 'message',
                    label: unit.name,
                    text: unit.name
                },
                style: 'secondary',
                height: 'sm'
            }))
        }
    };
}

// สร้าง Bubble สำหรับ จป.เทคนิค
function createJSPBubble() {
    return {
        type: 'bubble',
        size: 'kilo',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [{
                type: 'text',
                text: '👷 จป.เทคนิค',
                weight: 'bold',
                size: 'md',
                color: '#e65100'
            }]
        },
        body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
                {
                    type: 'button',
                    action: {
                        type: 'message',
                        label: 'จป. กฟส.ป่าซาง',
                        text: 'จป. กฟส.ป่าซาง'
                    },
                    style: 'primary',
                    height: 'sm',
                    color: '#e65100'
                },
                {
                    type: 'button',
                    action: {
                        type: 'message',
                        label: 'จป. กฟส.บ้านโฮ่ง',
                        text: 'จป. กฟส.บ้านโฮ่ง'
                    },
                    style: 'primary',
                    height: 'sm',
                    color: '#e65100'
                },
                {
                    type: 'button',
                    action: {
                        type: 'message',
                        label: 'จป. กฟส.ลี้',
                        text: 'จป. กฟส.ลี้'
                    },
                    style: 'primary',
                    height: 'sm',
                    color: '#e65100'
                },
                {
                    type: 'button',
                    action: {
                        type: 'message',
                        label: 'จป. กฟส.บ้านธิ',
                        text: 'จป. กฟส.บ้านธิ'
                    },
                    style: 'primary',
                    height: 'sm',
                    color: '#e65100'
                }
            ]
        }
    };
}

// Handle จป.เทคนิค Preset
async function handleJSPPreset(event, presetName) {
    const userId = event.source.userId;
    const profile = await getLineProfile(userId);
    
    const unitIds = JSP_PRESETS[presetName];
    const unitsArray = UNITS;
    
    // หาชื่อหน่วยงานจาก IDs
    const selectedUnits = unitIds.map(id => {
        const unit = unitsArray.find(u => u.id === id);
        return unit ? { id: unit.id, name: unit.name } : null;
    }).filter(u => u !== null);
    
    // บันทึกข้อมูลผู้ใช้ลง Firebase
    const userData = {
        odUserId: userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        units: selectedUnits,
        unitNames: selectedUnits.map(u => u.name),
        role: presetName,
        registeredAt: new Date().toISOString(),
        status: 'active'
    };
    
    await firebaseSet(`lineUsers/${userId}`, userData);
    
    // ลบ session
    await firebaseSet(`registrationSession/${userId}`, null);
    
    const unitList = selectedUnits.map(u => `  • ${u.name}`).join('\n');
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: `✅ ลงทะเบียนสำเร็จ!\n\n👤 ชื่อ: ${profile.displayName}\n👷 ตำแหน่ง: ${presetName}\n\n🏢 หน่วยงานที่รับแจ้งเตือน:\n${unitList}\n\n📬 คุณจะได้รับการแจ้งเตือนเมื่อมีรายงานใหม่จากหน่วยงานเหล่านี้`
    }]);
}

// Handle Unit Selection (เลือกทีละหน่วยงาน - รองรับ Toggle)
async function handleSelectUnit(event, unitName) {
    const userId = event.source.userId;
    
    // ดึง session การลงทะเบียน
    let session = await firebaseGet(`registrationSession/${userId}`);
    
    // ถ้าไม่มี session ให้สร้างใหม่
    if (!session) {
        session = {
            selectedUnits: [],
            startedAt: new Date().toISOString()
        };
    }
    
    // หา unit จากชื่อ
    const unitsArray = UNITS;
    let selectedUnit = unitsArray.find(u => u.name === unitName);
    
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
    
    // ตรวจสอบว่าเลือกซ้ำหรือไม่ (Toggle)
    const existingIndex = session.selectedUnits.findIndex(u => u.id === selectedUnit.id);
    
    if (existingIndex !== -1) {
        // ถ้ามีอยู่แล้ว → ลบออก (Toggle OFF)
        session.selectedUnits.splice(existingIndex, 1);
        
        // บันทึก session
        await firebaseSet(`registrationSession/${userId}`, session);
        
        if (session.selectedUnits.length === 0) {
            await replyLineMessage(event.replyToken, [{
                type: 'text',
                text: `🔴 ยกเลิก "${selectedUnit.name}" แล้ว\n\n📋 ยังไม่มีหน่วยงานที่เลือก\n\n👉 กดเลือกหน่วยงานใหม่`
            }]);
        } else {
            const unitList = session.selectedUnits.map(u => `  • ${u.name}`).join('\n');
            await replyLineMessage(event.replyToken, [{
                type: 'text',
                text: `🔴 ยกเลิก "${selectedUnit.name}" แล้ว\n\n📋 หน่วยงานที่เลือกไว้ (${session.selectedUnits.length} หน่วยงาน):\n${unitList}\n\n👉 กดเลือกหน่วยงานเพิ่มได้อีก\n👉 กดซ้ำเพื่อยกเลิก\n👉 พิมพ์ "เสร็จสิ้น" เมื่อเลือกครบแล้ว`
            }]);
        }
        return;
    }
    
    // ถ้ายังไม่มี → เพิ่มเข้าไป (Toggle ON)
    session.selectedUnits.push({
        id: selectedUnit.id,
        name: selectedUnit.name
    });
    
    // บันทึก session
    await firebaseSet(`registrationSession/${userId}`, session);
    
    const unitList = session.selectedUnits.map(u => `  • ${u.name}`).join('\n');
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: `🟢 เพิ่ม "${selectedUnit.name}" แล้ว\n\n📋 หน่วยงานที่เลือกไว้ (${session.selectedUnits.length} หน่วยงาน):\n${unitList}\n\n👉 กดเลือกหน่วยงานเพิ่มได้อีก\n👉 กดซ้ำเพื่อยกเลิก\n👉 พิมพ์ "เสร็จสิ้น" เมื่อเลือกครบแล้ว`
    }]);
}

// Handle Finish Registration
async function handleFinishRegistration(event) {
    const userId = event.source.userId;
    const profile = await getLineProfile(userId);
    
    // ดึง session การลงทะเบียน
    const session = await firebaseGet(`registrationSession/${userId}`);
    
    if (!session || !session.selectedUnits || session.selectedUnits.length === 0) {
        await replyLineMessage(event.replyToken, [{
            type: 'text',
            text: '❌ คุณยังไม่ได้เลือกหน่วยงาน\n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มต้นใหม่'
        }]);
        return;
    }
    
    // บันทึกข้อมูลผู้ใช้ลง Firebase
    const userData = {
        odUserId: userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        units: session.selectedUnits,
        unitNames: session.selectedUnits.map(u => u.name),
        registeredAt: new Date().toISOString(),
        status: 'active'
    };
    
    await firebaseSet(`lineUsers/${userId}`, userData);
    
    // ลบ session
    await firebaseSet(`registrationSession/${userId}`, null);
    
    const unitList = session.selectedUnits.map(u => `  • ${u.name}`).join('\n');
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: `✅ ลงทะเบียนสำเร็จ!\n\n👤 ชื่อ: ${profile.displayName}\n\n🏢 หน่วยงานที่รับแจ้งเตือน (${session.selectedUnits.length} หน่วยงาน):\n${unitList}\n\n📬 คุณจะได้รับการแจ้งเตือนเมื่อมีรายงานใหม่จากหน่วยงานเหล่านี้`
    }]);
}

// Handle Cancel Registration
async function handleCancelRegistration(event) {
    const userId = event.source.userId;
    
    // ลบ session
    await firebaseSet(`registrationSession/${userId}`, null);
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: '🔄 ยกเลิกการลงทะเบียนแล้ว\n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มต้นใหม่'
    }]);
}

// Handle Reset Registration (ล้างข้อมูลทั้งหมด)
async function handleResetRegistration(event) {
    const userId = event.source.userId;
    
    // ลบข้อมูลผู้ใช้
    await firebaseSet(`lineUsers/${userId}`, null);
    await firebaseSet(`registrationSession/${userId}`, null);
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: '🗑️ ล้างข้อมูลการลงทะเบียนแล้ว\n\nพิมพ์ "ลงทะเบียน" เพื่อลงทะเบียนใหม่'
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
    
    // รองรับทั้งแบบเดิม (unitName) และแบบใหม่ (unitNames)
    let unitList;
    if (userData.unitNames && userData.unitNames.length > 0) {
        unitList = userData.unitNames.map(name => `  • ${name}`).join('\n');
    } else if (userData.unitName) {
        unitList = `  • ${userData.unitName}`;
    } else {
        unitList = '  (ไม่มีข้อมูล)';
    }
    
    const roleText = userData.role ? `\n👷 ตำแหน่ง: ${userData.role}` : '';
    
    await replyLineMessage(event.replyToken, [{
        type: 'text',
        text: `📊 สถานะการลงทะเบียน\n\n👤 ชื่อ: ${userData.displayName}${roleText}\n\n🏢 หน่วยงานที่รับแจ้งเตือน:\n${unitList}\n\n📅 ลงทะเบียนเมื่อ: ${new Date(userData.registeredAt).toLocaleDateString('th-TH')}\n✅ สถานะ: พร้อมรับการแจ้งเตือน\n\n💡 พิมพ์ "ล้างข้อมูล" เพื่อลงทะเบียนใหม่`
    }]);
}

// Handle Help Command
async function handleHelp(event) {
    const helpText = `📖 คู่มือการใช้งาน Unsafe-Report Bot

🔹 คำสั่งที่ใช้ได้:

1️⃣ "ลงทะเบียน" - ลงทะเบียนเข้าใช้งานระบบ
2️⃣ "เสร็จสิ้น" - บันทึกหน่วยงานที่เลือก
3️⃣ "ยกเลิก" - ยกเลิกการเลือกหน่วยงาน
4️⃣ "ล้างข้อมูล" - ล้างการลงทะเบียนเพื่อเริ่มใหม่
5️⃣ "สถานะ" - ตรวจสอบสถานะการลงทะเบียน
6️⃣ "ช่วยเหลือ" - แสดงคู่มือการใช้งาน

💡 วิธีลงทะเบียน:
• พิมพ์ "ลงทะเบียน"
• กดเลือกหน่วยงาน (เลือกได้หลายหน่วยงาน)
• พิมพ์ "เสร็จสิ้น" เมื่อเลือกครบ

👷 สำหรับ จป.เทคนิค:
• เลื่อนไปการ์ดสุดท้าย
• กดปุ่ม จป. ของ กฟส. ที่ดูแล

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

// ส่งการแจ้งเตือนไปยังผู้ใช้ที่ลงทะเบียนหน่วยงานนั้น
async function notifyUnitHead(unitName, message) {
    // ดึงข้อมูล LINE Users ทั้งหมด
    const lineUsers = await firebaseGet('lineUsers');
    
    if (!lineUsers) return { success: false, message: 'No LINE users registered' };
    
    // หา users ที่ลงทะเบียนหน่วยงานนี้ (รองรับทั้งแบบเดิมและแบบใหม่)
    const targetUsers = Object.values(lineUsers).filter(user => {
        if (user.status !== 'active') return false;
        
        // แบบใหม่: มี unitNames array
        if (user.unitNames && user.unitNames.length > 0) {
            return user.unitNames.includes(unitName);
        }
        
        // แบบเดิม: มี unitName เดียว
        if (user.unitName) {
            return user.unitName === unitName;
        }
        
        return false;
    });
    
    if (targetUsers.length === 0) {
        return { success: false, message: 'No users found for this unit' };
    }
    
    // ส่งข้อความไปยังทุกคนที่ลงทะเบียนหน่วยงานนี้
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
