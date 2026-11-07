require('dotenv').config();
const { createGeminiService } = require('../src/services/geminiService');

(async () => {
  try {
    const result = await createGeminiService().checkModel();
    console.log(`Model ${result.model}: có quyền truy cập và hỗ trợ generateContent.`);
    console.log('Đây chỉ là kiểm tra metadata, không sinh nội dung. Hãy kiểm tra dự án Google AI Studio vẫn ở Free Tier/chưa bật billing.');
  } catch (error) {
    // Do not print raw SDK errors, stack traces or the key.
    console.error(`${error.code || 'GEMINI_UNAVAILABLE'}: ${error.code ? error.message : 'Chưa xác minh được model Gemini.'}`);
    process.exitCode = 1;
  }
})();
