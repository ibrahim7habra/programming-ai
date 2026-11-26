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

// تحديد نوع السؤال: أخبار يومية أم تعلم ذكاء اصطناعي أم برمجة
function detectMode(message = "") {
  const isNews = /(أخبار|خبر|النهاردة|اليوم|جديد|تحديثات|اخبار|news|latest|today)/i.test(message);
  if (isNews) return "news";

  const isAI = /(ذكاء اصطناعي|تعلم الآلة|تعلم الالة|machine learning|deep learning|neural|llm|prompt|\bai\b|نموذج)/i.test(message);
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
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8
 
