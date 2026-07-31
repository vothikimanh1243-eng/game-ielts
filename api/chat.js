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
    // 1. TÍNH NĂNG TẠO CÂU HỎI TRẮC NGHIỆM ĐỘNG BỞI AI
    if (action === 'generate_questions') {
      const prompt = `Bạn là một chuyên gia khảo thí tiếng Anh. Hãy tạo ra đúng 5 câu hỏi trắc nghiệm tiếng Anh ở cấp độ CEFR: ${level}, độ khó: ${diff}.
Mỗi câu hỏi phải có:
- "q": Nội dung câu hỏi (bằng tiếng Việt hoặc tiếng Anh phù hợp cấp độ).
- "options": Một mảng gồm đúng 4 lựa chọn đáp án.
- "correct": Chỉ số của đáp án đúng trong mảng options (từ 0 đến 3).

YÊU CẦU BẮT BUỘC: Chỉ trả về duy nhất một chuỗi JSON hợp lệ dưới dạng một mảng (Array) gồm 5 object, tuyệt đối không kèm theo bất kỳ lời chào, giải thích hay markdown code block nào bên ngoài (không dùng \`\`\`json). Ví dụ format:
[
  {"q": "...", "options": ["A", "B", "C", "D"], "correct": 0}
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
