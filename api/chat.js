export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, text, level, diff } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GROQ_API_KEY trên Vercel Environment Variables!' });
  }

  try {
    // 1. TÍNH NĂNG TẠO CÂU HỎI TRẮC NGHIỆM (CHỈ DẠNG: CÂU HỎI TIẾNG ANH & GHÉP TỪ)
    if (action === 'generate_questions') {
      const prompt = `Bạn là một giáo viên tiếng Anh chuyên nghiệp. Hãy tạo ra đúng 5 câu hỏi trắc nghiệm hoàn toàn phù hợp với cấp độ CEFR: ${level} và độ khó: ${diff}.

YÊU CẦU BẮT BUỘC VỀ DẠNG CÂU HỎI: Chỉ sử dụng 2 dạng bài tập sau cho toàn bộ 5 câu:
1. Dạng Câu hỏi tiếng Anh / Dịch câu: Cho một câu tiếng Việt (hoặc ngữ cảnh) và yêu cầu chọn câu tiếng Anh chuẩn xác (Ví dụ: "Hãy chọn câu tiếng Anh đúng để dịch câu: 'Tên bạn là gì?'" hoặc các câu giao tiếp/ngữ pháp nâng cao hơn tùy level).
2. Dạng Ghép từ / Sắp xếp từ: Cho các từ bị xáo trộn hoặc yêu cầu chọn trật tự đúng để sắp xếp thành một câu tiếng Anh hoàn chỉnh (Ví dụ: "Sắp xếp các từ sau thành câu đúng: [is / what / name / your / ?]").

Mỗi câu hỏi phải có cấu trúc JSON chính xác gồm:
- "q": Nội dung câu hỏi (bằng tiếng Việt kết hợp tiếng Anh rõ ràng).
- "options": Một mảng gồm đúng 4 lựa chọn đáp án bằng tiếng Anh.
- "correct": Chỉ số của đáp án đúng trong mảng options (từ 0 đến 3).

YÊU CẦU ĐỊNH DẠNG TUYỆT ĐỐI: Chỉ trả về duy nhất một chuỗi JSON hợp lệ dưới dạng một mảng (Array) gồm đúng 5 object, không kèm theo bất kỳ lời chào, giải thích hay markdown code block nào bên ngoài (không dùng \`\`\`json). Ví dụ format:
[
  {"q": "Hãy chọn câu tiếng Anh đúng để dịch câu: 'Tên bạn là gì?'", "options": ["What is your name?", "How are you?", "Who are you?", "Where are you from?"], "correct": 0}
]`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let rawContent = data.choices[0].message.content.trim();
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const questionsArray = JSON.parse(rawContent);
      return res.status(200).json({ questions: questionsArray });
    }

    // 2. TÍNH NĂNG CHẤM BÀI WRITING
    if (action === 'evaluate_writing' || !action) {
      if (!text) {
        return res.status(400).json({ error: 'Thiếu nội dung văn bản cần chấm!' });
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "Bạn là trợ lý chấm bài viết tiếng Anh. Hãy phát hiện lỗi ngữ pháp, chính tả, từ vựng và đưa ra gợi ý sửa chuẩn xác bằng tiếng Anh kèm giải thích ngắn bằng tiếng Việt. Trả về kết quả dạng danh sách thẻ HTML <li>."
            },
            {
              role: "user",
              content: `Chấm và sửa giúp tôi đoạn viết tiếng Anh sau: "${text}"`
            }
          ],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const aiReply = data.choices[0].message.content;
      return res.status(200).json({ reply: aiReply });
    }

    return res.status(400).json({ error: 'Action không hợp lệ!' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
