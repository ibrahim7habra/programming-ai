import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

// خدمة ملفات الواجهة الأمامية من مجلد public إن وجدت
app.use(express.static(path.join(process.cwd(), "public")));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// تحديد وضع السؤال: أخبار يومية أم تعلم ذكاء اصطناعي وبرمجة
function detectMode(message = "") {
  const isNews = /(أخبار|خبر|النهاردة|اليوم|جديد|تحديثات|اخبار|news|latest|today)/i.test(message);
  if (isNews) return "news";

  const isAI = /(ذكاء اصطناعي|تعلم الآلة|تعلم الالة|machine learning|deep learning|neural|llm|prompt|ai\b|نموذج)/i.test(message);
  if (isAI) return "ai";

  return "programming";
}

function getSystemPrompt(mode) {
  if (mode === "news") {
    return `أنت مساعد ذكي متخصص في متابعة الأخبار اليومية وتأثيرها على البرمجة والذكاء الاصطناعي.
- لخّص الأخبار المتاحة باللغة العربية بوضوح واختصار منظم.
- وضّح أهمية كل خبر للمطورين أو لمجال الذكاء الاصطناعي.
- لا تخترع أخباراً غير موجودة في البيانات المرفقة، وإذا لم تتوفر أخبار فوضّح ذلك بوضوح.`;
  }

  if (mode === "ai") {
    return `أنت مدرّب ومساعد متخصص في تعلم الذكاء الاصطناعي (AI & Machine Learning).
- اشرح المفاهيم خطوة بخطوة بأسلوب مبسط وعملي مع أمثلة واضحة.
- اربط الشرح بالتطبيق العملي وكيفية بناء الأنظمة والنماذج.
- اختم بنصيحة أو خطوة عملية تالية لتعميق الفهم.`;
  }

  return `أنت مساعد برمجة ذكي (Programming AI).
- اشرح الأكواد والمفاهيم البرمجية بوضوح ومنطق عملي.
- قدّم حلولاً دقيقة وأمثلة كود نظيفة عند الحاجة، وساعد في اكتشاف الأخطاء وتحسين الأداء.`;
}

async function getDailyNewsContext() {
  // 1. قراءة ملف الأخبار المحدّث عبر GitHub Actions إن وُجد
  try {
    const filePath = path.join(process.cwd(), "data", "daily-news.json");
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(raw.articles) && raw.articles.length > 0) {
        return raw.articles
          .slice(0, 6)
          .map(
            (a, i) =>
              `${i + 1}. ${a.title} (${a.source || "مصدر"}) - ${a.description || ""}`
          )
          .join("\n");
      }
    }
  } catch (err) {
    console.warn("Warning reading data/daily-news.json:", err.message);
  }

  // 2. جلب الأخبار مباشرة من News API باستخدام NEWS_API_KEY
  if (!NEWS_API_KEY) {
    return "لا توجد أخبار محلية متاحة ولم يتم ضبط NEWS_API_KEY بعد.";
  }

  const query = encodeURIComponent("programming OR software OR artificial intelligence");
  const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&max=6&apikey=${NEWS_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`News API returned status ${res.status}`);
  }

  const data = await res.json();
  const articles = data.articles || [];

  if (articles.length === 0) {
    return "لم يتم العثور على أخبار جديدة حالياً.";
  }

  return articles
    .map(
      (a, i) =>
        `${i + 1}. ${a.title} (${a.source?.name || "Source"}) - ${a.description || ""}`
    )
    .join("\n");
}

async function askGemini({ systemInstruction, prompt, history = [] }) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in environment variables.");
  }

  const contents = [];

  // إضافة سجل المحادثة السابق إن وُجد
  for (const item of history) {
    if (!item?.content) continue;
    contents.push({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: String(item.content) }],
    });
  }

  // إضافة الرسالة الحالية
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  return (
    result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || "لم أتمكن من توليد رد حالياً."
  );
}

// مسار الدردشة الرئيسي
app.post("/api/chat", async (req, res) => {
  try {
