# ต้นฉบับ Super GameDev Camp

คัดลอกจาก https://github.com/PepesX231/super-gamedev-camp
commit: `9cb44bc9113664c5065d7c2d1895e4c413ba56b1`

ใช้หน้าตา เนื้อหา ภาพ โมเดล 3D และฟอร์มตัวอย่างของต้นฉบับเป็นพื้นฐาน
การปรับเพื่อให้เปิดบน Vercel ได้: เพิ่ม npm build/static export, ตั้งค่า Vercel,
และใช้ฟอนต์เดิมกับ Three.js เวอร์ชันเดิมจากไฟล์ในเว็บแทน CDN

```sh
npm ci
npm run build
npm run dev
```

`npm run dev` เปิดเซิร์ฟเวอร์เดิมที่พอร์ต 4321; หน้าเว็บอยู่ที่ `/superdev/index.html`
`npm run preview` เปิดไฟล์ `dist/` ที่พอร์ต 4173
root index จะพาไป `/superdev/` ตามต้นฉบับ

ปรับอนิเมชันให้ใช้ภาพฉากหลังที่เตรียมจากโมเดลเดิมและภาพกาแล็กซี แทนการวาด WebGL/SVG ซ้ำทุกเฟรม
ฉากหลังเลื่อนด้วย scroll timeline เมื่อเบราว์เซอร์รองรับ และใช้ requestAnimationFrame เป็นทางเลือกสำรอง
โมเดลในเนื้อหายังเป็น 3D โดยแชร์ scene ระหว่างภาพเล็กกับภาพรายละเอียด รวมชิ้นส่วนวัสดุเดียวกัน
และวาดสดเฉพาะโมเดลที่กำลังดู/ชี้เมาส์ ส่วนภาพอื่นลอยด้วย CSS ต่อเนื่อง

ไฟล์ภาพฉากหลังเตรียมไว้ใน `superdev/assets/img/motion/` แล้ว การ build ปกติไม่ต้องใช้ Python หรือ Chromium
หากแก้โมเดลต้นฉบับและต้องการสร้างภาพใหม่ ให้เปิด `npm run dev` แล้วรัน `python3 tools/bake-motion-assets.py`
คำสั่งนี้ต้องมี Python Playwright และ Chromium; ตัวถอดรหัสฉากต้นฉบับอยู่ที่ `tools/bake-bg-scene.mjs`

เนื้อหายังเป็น Super GameDev Camp 4 วันตามต้นฉบับ ไม่ได้เปลี่ยนเป็น AI Kickstarter Camp
ฟอร์มสมัครเป็นตัวอย่างและไม่มีการบันทึกหรือรับชำระเงินจริง

เวอร์ชัน Aikick ก่อนคัดลอกสำรองไว้ที่ `/workspace/exports/Aikick-before-superdev-20261007.zip`
แต่ละ cloud task มี checkout แยกอยู่แล้ว ใช้ `/workspace/Aikick` โดยไม่ต้องสร้าง worktree เพิ่มเว้นแต่ผู้ใช้ขอ
