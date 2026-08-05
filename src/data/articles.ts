import { Article } from "./types";
import { getProductBySlug } from "./products";

const baseArticles: Article[] = [
  {
    slug: "simple-skincare-routine",
    title: "รูทีนพื้นฐาน 3 ขั้นตอนที่แพทย์ผิวหนังแนะนำ",
    category: "routine",
    excerpt: "ล้าง–เติมความชุ่มชื้น–ปกป้องผิว จุดเริ่มต้นที่เรียบง่ายแต่ได้ผลสำหรับทุกสภาพผิว",
    body: [
      "การดูแลผิวไม่จำเป็นต้องมีหลายขั้นตอน American Academy of Dermatology (AAD) แนะนำแกนหลักที่ทำสม่ำเสมอได้จริง ได้แก่ ทำความสะอาดอย่างอ่อนโยน เติมความชุ่มชื้น และปกป้องผิวจากแสงแดด รูทีนสั้น ๆ ยังช่วยลดโอกาสระคายเคืองจากการซ้อนผลิตภัณฑ์หลายชนิด",
      "ตอนเช้า ล้างหน้าด้วยผลิตภัณฑ์อ่อนโยนหรือใช้น้ำเปล่าหากผิวแห้งมาก ตามด้วยมอยส์เจอร์ไรเซอร์และกันแดด broad-spectrum SPF 30 ขึ้นไป ส่วนกลางคืนให้ล้างเครื่องสำอางและสิ่งสกปรก แล้วตามด้วยมอยส์เจอร์ไรเซอร์",
      "หากต้องการแก้ปัญหาเฉพาะ เช่น สิวหรือจุดด่างดำ ให้เพิ่มผลิตภัณฑ์ออกฤทธิ์ทีละชนิด ใช้ต่อเนื่องหลายสัปดาห์ และหยุดใช้หากเกิดแสบ บวม หรือผื่นมากผิดปกติ การเริ่มแบบเรียบง่ายทำให้รู้ได้ง่ายว่าผิวตอบสนองต่ออะไร",
    ],
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — Skin care on a budget", url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-budget" },
      { name: "American Academy of Dermatology — Skin care basics", url: "https://www.aad.org/public/everyday-care/skin-care-basics" },
    ],
    readMins: 4,
  },
  {
    slug: "wash-face-without-damaging-barrier",
    title: "ล้างหน้าอย่างไร ไม่ให้เกราะป้องกันผิวเสียสมดุล",
    category: "guide",
    excerpt: "อุณหภูมิน้ำ ความถี่ และวิธีล้างหน้าที่ช่วยลดความแห้งตึงและการระคายเคือง",
    body: [
      "การล้างหน้าที่แรงเกินไปไม่ได้ทำให้ผิวสะอาดขึ้นเสมอไป แต่เพิ่มการระคายเคืองได้ เลือกคลีนเซอร์อ่อนโยน ไม่มีเม็ดสครับและแอลกอฮอล์ ใช้น้ำอุ่นพอดี และใช้ปลายนิ้วนวดแทนผ้าหรือฟองน้ำที่เสียดสีผิว",
      "AAD แนะนำให้ล้างหน้าไม่เกินวันละ 2 ครั้งและหลังเหงื่อออกมาก ล้างจนหมดแล้วซับด้วยผ้านุ่มโดยไม่ถู หากผิวแห้งหรือคัน ให้ลงมอยส์เจอร์ไรเซอร์ขณะที่ผิวยังชื้นเล็กน้อยเพื่อช่วยกักเก็บน้ำ",
      "ผิวมันก็ไม่ควรล้างบ่อยจนเอี๊ยด เพราะความแห้งและระคายเคืองอาจทำให้รูทีนรักษาสิวทนได้ยากขึ้น หากหลังล้างหน้ารู้สึกตึง แสบ หรือเป็นขุยสม่ำเสมอ ควรลดความถี่หรือเปลี่ยนเป็นสูตรอ่อนโยนกว่าเดิม",
    ],
    image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — Face washing 101", url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101" },
    ],
    readMins: 4,
  },
  {
    slug: "choose-and-use-sunscreen",
    title: "เลือกและทากันแดดให้ได้การปกป้องจริง",
    category: "guide",
    excerpt: "อ่านฉลาก SPF, broad-spectrum และ water-resistant พร้อมวิธีทาซ้ำอย่างถูกต้อง",
    body: [
      "มองหากันแดดที่มี 3 ข้อสำคัญ: broad-spectrum เพื่อครอบคลุม UVA และ UVB, SPF 30 ขึ้นไป และ water-resistant หากต้องเหงื่อออกหรือโดนน้ำ สูตรที่ใช้ได้ทุกวันคือสูตรที่เข้ากับผิวและคุณยินดีทาในปริมาณเพียงพอ",
      "ทาก่อนออกกลางแจ้งประมาณ 15 นาทีให้ทั่วบริเวณที่เสื้อผ้าไม่ปกปิด รวมถึงหู คอ และหลังมือ เมื่อต้องอยู่กลางแจ้งให้ทาซ้ำอย่างน้อยทุก 2 ชั่วโมง และทาใหม่หลังว่ายน้ำหรือเหงื่อออกตามเวลาที่ฉลากระบุ",
      "กันแดดไม่สามารถกันรังสี UV ได้ทั้งหมด จึงควรใช้ร่วมกับร่มเงา เสื้อผ้าปกปิด หมวกปีกกว้าง และหลีกเลี่ยงแดดจัด สำหรับเด็กอายุต่ำกว่า 6 เดือนควรปรึกษาบุคลากรทางการแพทย์ก่อนใช้ผลิตภัณฑ์กันแดด",
    ],
    image: "https://images.unsplash.com/photo-1553696590-4b3f68898333?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — Choosing the right sunscreen", url: "https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/choosing-right-sunscreen" },
      { name: "U.S. FDA — Tips to stay safe in the sun", url: "https://www.fda.gov/consumers/consumer-updates/tips-stay-safe-sun-sunscreen-sunglasses" },
    ],
    readMins: 5,
  },
  {
    slug: "acne-prone-skin-routine",
    title: "รูทีนสำหรับผิวเป็นสิวง่าย: เริ่มน้อย แต่สม่ำเสมอ",
    category: "routine",
    excerpt: "จัดรูทีนลดการอุดตันโดยไม่ทำให้ผิวแห้งระคายเคืองเกินจำเป็น",
    body: [
      "เริ่มด้วยคลีนเซอร์อ่อนโยนวันละ 2 ครั้ง หลีกเลี่ยงการขัด ถู หรือบีบสิว เพราะเพิ่มการอักเสบและโอกาสเกิดรอย เลือกผลิตภัณฑ์ที่ระบุว่า non-comedogenic หรือ won’t clog pores ทั้งมอยส์เจอร์ไรเซอร์ กันแดด และเครื่องสำอาง",
      "สารที่มีหลักฐานสำหรับสิวมีหลายชนิด เช่น benzoyl peroxide, salicylic acid และ adapalene แต่ไม่ควรเริ่มทุกตัวพร้อมกัน เลือกหนึ่งตัวตามชนิดสิว ใช้ตามฉลาก และให้เวลาอย่างน้อย 6–8 สัปดาห์เพื่อประเมินแนวโน้มการเปลี่ยนแปลง",
      "มอยส์เจอร์ไรเซอร์ยังสำคัญสำหรับผิวเป็นสิว เพราะยารักษาสิวหลายชนิดทำให้แห้งและระคายเคือง การคงความชุ่มชื้นช่วยให้ผิวทนการรักษาได้ดีขึ้น หากมีสิวก้อนลึก เจ็บ เป็นแผลเป็น หรือไม่ดีขึ้น ควรพบแพทย์ผิวหนัง",
    ],
    image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — Acne: Skin care tips", url: "https://www.aad.org/public/diseases/acne/skin-care/tips" },
      { name: "American Academy of Dermatology — Moisturizer and acne", url: "https://www.aad.org/public/diseases/acne/skin-care/moisturizer" },
    ],
    readMins: 5,
  },
  {
    slug: "moisturizer-and-skin-barrier",
    title: "มอยส์เจอร์ไรเซอร์กับเกราะป้องกันผิว เลือกเนื้อแบบไหนดี",
    category: "ingredient",
    excerpt: "เข้าใจ humectant, emollient และ occlusive เพื่อเลือกความชุ่มชื้นให้เหมาะกับผิว",
    body: [
      "มอยส์เจอร์ไรเซอร์ช่วยลดการสูญเสียน้ำและสนับสนุนเกราะป้องกันผิว โดยสูตรหนึ่งมักผสมสารดึงน้ำ (humectant) เช่น glycerin สารเติมความเรียบลื่น (emollient) และสารเคลือบลดการระเหยของน้ำ (occlusive) ในสัดส่วนต่างกัน",
      "ผิวมันหรืออากาศร้อนชื้นมักสบายกับโลชั่นหรือเจลเนื้อเบาที่ระบุว่า non-comedogenic ส่วนผิวแห้งมากอาจเหมาะกับครีมหรือขี้ผึ้งที่เคลือบผิวได้มากกว่า ทาหลังอาบน้ำหรือล้างหน้าขณะผิวยังหมาดเพื่อช่วยกักน้ำ",
      "คำว่า natural หรือ hypoallergenic ไม่ได้แปลว่าจะไม่แพ้เสมอไป หากผิวไวต่อการระคายเคือง ให้เลือกสูตร fragrance-free รายการส่วนผสมไม่ซับซ้อน และทดสอบบริเวณเล็ก ๆ ก่อนใช้ทั่วหน้า",
    ],
    image: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — Dermatologists' tips for relieving dry skin", url: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin" },
      { name: "DermNet — Emollients and moisturisers", url: "https://dermnetnz.org/topics/emollients-and-moisturisers" },
    ],
    readMins: 5,
  },
  {
    slug: "niacinamide-evidence-guide",
    title: "Niacinamide: ประโยชน์จริงและวิธีเริ่มใช้",
    category: "ingredient",
    excerpt: "วิตามินบี 3 ในสกินแคร์ช่วยเรื่องใดได้บ้าง และทำไมความเข้มข้นสูงไม่จำเป็นต้องดีกว่า",
    body: [
      "Niacinamide หรือ nicotinamide เป็นรูปแบบหนึ่งของวิตามินบี 3 ที่ใช้ในผลิตภัณฑ์ทาผิว งานทบทวนทางผิวหนังรายงานคุณสมบัติสนับสนุนเกราะผิว ลดการสูญเสียน้ำ และอาจช่วยด้านความมัน รอยแดง และสีผิวไม่สม่ำเสมอในบางสูตร",
      "ผลิตภัณฑ์เครื่องสำอางมักใช้ความเข้มข้นราว 2–5% ซึ่งมีข้อมูลการใช้งานรองรับ การเลือกความเข้มข้นสูงมากไม่ได้รับประกันผลที่ดีกว่าและอาจเพิ่มโอกาสระคายเคือง เริ่มวันละครั้งหลังล้างหน้า แล้วตามด้วยมอยส์เจอร์ไรเซอร์",
      "ส่วนผสมชนิดนี้มักใช้ร่วมกับรูทีนพื้นฐานได้ แต่ควรเพิ่มทีละผลิตภัณฑ์ หากมีผิวอักเสบเรื้อรังหรือกำลังใช้ยาทาผิว ให้ขอคำแนะนำจากแพทย์หรือเภสัชกรก่อนปรับรูทีน",
    ],
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "DermNet — Nicotinamide", url: "https://dermnetnz.org/topics/nicotinamide" },
      { name: "PubMed — Nicotinamide: mechanisms and topical use in dermatology", url: "https://pubmed.ncbi.nlm.nih.gov/24993939/" },
    ],
    readMins: 5,
  },
  {
    slug: "retinol-retinoid-beginners",
    title: "Retinol และ Retinoid สำหรับมือใหม่ ใช้อย่างปลอดภัย",
    category: "ingredient",
    excerpt: "เริ่มช้า ลดการระคายเคือง และรู้ว่าเมื่อไรควรปรึกษาแพทย์",
    body: [
      "Retinoid เป็นชื่อกลุ่มอนุพันธ์วิตามินเอ ส่วน retinol เป็นหนึ่งในสมาชิกที่พบในเครื่องสำอาง กลุ่มนี้มีหลักฐานช่วยเรื่องสิวเล็กน้อย สีผิวไม่สม่ำเสมอ ผิวสัมผัส และริ้วรอย แต่ช่วงเริ่มต้นอาจทำให้แห้ง แดง หรือลอกได้",
      "เริ่มจากสูตรอ่อนในตอนกลางคืน 2–3 ครั้งต่อสัปดาห์ ใช้ปริมาณน้อยกับผิวแห้ง และเพิ่มความถี่เมื่อผิวรับได้ ใช้มอยส์เจอร์ไรเซอร์ช่วยลดความแห้ง พร้อมทากันแดด broad-spectrum SPF 30 ขึ้นไปทุกเช้า",
      "ไม่ควรใช้ retinoid ระหว่างตั้งครรภ์ ผู้ที่มีผิวอักเสบ แพ้ง่ายมาก สิวรุนแรง หรือกำลังใช้ยารักษาผิวควรปรึกษาแพทย์ก่อน อย่าเร่งผลด้วยการใช้มากหรือบ่อย เพราะการระคายเคืองไม่ได้แปลว่าผลิตภัณฑ์กำลังทำงานดีขึ้น",
    ],
    image: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — Retinoid or retinol?", url: "https://www.aad.org/public/everyday-care/skin-care-secrets/anti-aging/retinoid-retinol" },
    ],
    readMins: 5,
  },
  {
    slug: "vitamin-c-dark-spots",
    title: "Vitamin C กับผิวหมองและจุดด่างดำ ใช้ให้คุ้มค่า",
    category: "ingredient",
    excerpt: "บทบาทของสารต้านอนุมูลอิสระ วิธีเก็บ และตำแหน่งที่เหมาะในรูทีนตอนเช้า",
    body: [
      "Vitamin C เป็นสารต้านอนุมูลอิสระที่มีบทบาทในการสร้างคอลลาเจน และผลิตภัณฑ์ทาผิวบางสูตรอาจช่วยลดผลจากแสงแดดและทำให้จุดด่างดำดูจางลงเมื่อใช้ต่อเนื่อง แต่ไม่ใช่สิ่งทดแทนกันแดด",
      "นิยมใช้หลังล้างหน้าในตอนเช้า ก่อนมอยส์เจอร์ไรเซอร์และกันแดด สูตร L-ascorbic acid มีข้อมูลการศึกษามาก แต่อาจระคายเคืองได้ง่ายกว่าอนุพันธ์บางชนิด ผู้เริ่มใช้หรือผิวไวควรเริ่มความถี่ต่ำและทดสอบก่อน",
      "วิตามินซีเสื่อมจากแสง อากาศ และความร้อน ควรเลือกบรรจุภัณฑ์ทึบแสง ปิดฝาแน่น และเก็บตามฉลาก หากสีหรือกลิ่นเปลี่ยนชัดเจนควรหยุดใช้ ผลต่อจุดด่างดำต้องอาศัยความสม่ำเสมอและการป้องกันแดดทุกวัน",
    ],
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — Skin care in your 20s", url: "https://www.aad.org/public/everyday-care/skin-care-basics/care/skin-care-in-your-20s" },
      { name: "PubMed Central — The roles of vitamin C in skin health", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5579659/" },
    ],
    readMins: 5,
  },
  {
    slug: "fade-dark-spots-safely",
    title: "รอยดำหลังสิว: ดูแลอย่างไรให้จางโดยไม่ทำร้ายผิว",
    category: "guide",
    excerpt: "แยกรอยดำออกจากแผลเป็น พร้อมแนวทางลดการอักเสบและป้องกันรอยใหม่",
    body: [
      "รอยแบนสีเข้มหลังสิวมักเป็น post-inflammatory hyperpigmentation (PIH) ไม่ใช่แผลเป็นหลุม เกิดจากผิวสร้างเม็ดสีเพิ่มหลังการอักเสบและพบเด่นในสีผิวกลางถึงเข้ม หลายรอยค่อย ๆ จางเองได้แต่ใช้เวลาหลายเดือน",
      "หัวใจคือควบคุมสิวใหม่โดยไม่บีบแกะ และใช้กันแดดทุกวัน เพราะรังสี UV และแสงที่มองเห็นอาจทำให้รอยเข้มขึ้น กันแดด tinted ที่มี iron oxides อาจช่วยเรื่องแสงที่มองเห็นในผู้มีปัญหาฝ้าหรือรอยดำบางราย",
      "ส่วนผสมที่ใช้ดูแลได้มีหลายชนิด เช่น azelaic acid, retinoid หรือ vitamin C แต่ควรเลือกทีละชนิดและหลีกเลี่ยงการผลัดผิวรุนแรง หากรอยเปลี่ยนรูปร่าง นูน มีเลือดออก หรือไม่แน่ใจว่าเป็นรอยสิว ควรให้แพทย์ตรวจ",
    ],
    image: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — How to fade dark spots in darker skin tones", url: "https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots" },
      { name: "DermNet — Postinflammatory hyperpigmentation", url: "https://dermnetnz.org/topics/postinflammatory-hyperpigmentation" },
    ],
    readMins: 6,
  },
  {
    slug: "patch-test-new-skincare",
    title: "Patch Test ก่อนลองสกินแคร์ใหม่ ทำเองอย่างไร",
    category: "qa",
    excerpt: "วิธีทดสอบผลิตภัณฑ์ในบริเวณเล็ก ๆ เพื่อลดความเสี่ยงแพ้และระคายเคือง",
    body: [
      "คำว่า sensitive หรือ hypoallergenic ไม่รับประกันว่าจะเหมาะกับทุกคน ก่อนใช้ผลิตภัณฑ์ใหม่ทั่วหน้า AAD แนะนำให้ทดสอบบริเวณเล็ก ๆ เช่น ท้องแขนหรือข้อพับแขน วันละ 2 ครั้งต่อเนื่อง 7–10 วัน โดยใช้ปริมาณและระยะเวลาสัมผัสตามการใช้งานจริง",
      "หากเป็นผลิตภัณฑ์ล้างออก ให้ทิ้งไว้ตามเวลาที่ฉลากระบุแล้วล้างออก หากเกิดแดง คัน บวม แสบมาก หรือตุ่ม ให้ล้างออกและหยุดใช้ การไม่เกิดปฏิกิริยาจาก patch test ช่วยลดความเสี่ยงแต่ไม่รับประกันว่าจะไม่แพ้เมื่อใช้บนใบหน้า",
      "ทดสอบและเพิ่มผลิตภัณฑ์ทีละตัวเพื่อแยกสาเหตุได้ง่าย หากอาการรุนแรง ลาม มีตุ่มน้ำ หรือบวมบริเวณตาและริมฝีปาก ให้รับคำแนะนำทางการแพทย์ โดยเฉพาะผู้มีประวัติผื่นแพ้สัมผัสควรพิจารณาการทดสอบโดยแพทย์ผิวหนัง",
    ],
    image: "https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1200&q=85",
    sources: [
      { name: "American Academy of Dermatology — How to test skin care products", url: "https://www.aad.org/public/everyday-care/skin-care-secrets/prevent-skin-problems/test-skin-care-products" },
      { name: "DermNet — Patch tests", url: "https://dermnetnz.org/topics/patch-tests" },
    ],
    readMins: 4,
  },
];

const primaryProductByArticle: Record<string, string> = {
  "simple-skincare-routine": "smooth-e-babyface-foam",
  "wash-face-without-damaging-barrier": "smooth-e-white-babyface-foam",
  "choose-and-use-sunscreen": "smooth-e-sun-dry-touch",
  "acne-prone-skin-routine": "smooth-e-acne-5-spot-pore-serum",
  "moisturizer-and-skin-barrier": "smooth-e-cream-cosme-japan",
  "niacinamide-evidence-guide": "smooth-e-pha-aha-acne-spot-and-pore-smooth",
  "retinol-retinoid-beginners": "smooth-e-retinal-plus-deep-wrinkle-repair-30-g",
  "vitamin-c-dark-spots": "smooth-e-dark-spot-clear-vitamin-c-plus-serum",
  "fade-dark-spots-safely": "smooth-e-24k-gold-hydroboost-serum",
  "patch-test-new-skincare": "smooth-e-physical-white-extra-fluid-spf50-pa",
};

export const articles: Article[] = baseArticles.map((article) => {
  const productSlug = primaryProductByArticle[article.slug];
  const product = productSlug ? getProductBySlug(productSlug) : undefined;
  if (!product) return article;

  const shopifyDetails = [
    `ข้อมูลสินค้าจาก Shopify: ${product.name} โดย ${product.brand} ราคา ฿${product.price.toLocaleString("th-TH")} ${product.inStock ? "(มีสินค้า)" : "(สินค้าหมด)"}`,
    product.description ? `รายละเอียดจากหน้าสินค้า: ${product.description}` : "",
    product.ingredients ? `ส่วนผสมสำคัญที่ระบุใน Shopify: ${product.ingredients}` : "",
    product.howToUse ? `วิธีใช้ที่ระบุใน Shopify: ${product.howToUse}` : "",
  ].filter(Boolean);

  return {
    ...article,
    title: `${article.title}: ${product.name}`,
    excerpt: product.shortDesc || article.excerpt,
    image: product.image,
    body: [...article.body, ...shopifyDetails],
    productSlug,
  };
});

export function getArticleBySlug(slug: string) {
  return articles.find((article) => article.slug === slug);
}
