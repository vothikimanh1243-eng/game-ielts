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
    // 1. TÍNH NĂNG TẠO CÂU HỎI THÔNG MINH BỞI AI
    if (action === 'generate_questions') {
      const prompt = `Bạn là một chuyên gia khảo thí và giáo viên tiếng Anh giàu kinh nghiệm. Hãy tạo ra đúng 5 câu hỏi trắc nghiệm tiếng Anh chất lượng cao, phù hợp hoàn hảo với cấp độ CEFR: ${level} và độ khó: ${diff}.

Yêu cầu chi tiết về nội dung câu hỏi:
- Cân đối giữa các dạng: Dịch câu từ tiếng Việt sang tiếng Anh (ví dụ: các câu giao tiếp cơ bản như "Tên bạn là gì?", "Mẹ tôi nấu ăn", hoặc các câu phức tạp hơn tùy cấp độ C2/B1...), hoàn thiện câu, điền từ vào chỗ trống, và sửa lỗi ngữ pháp.
- Các lựa chọn sai (distractors) phải hợp lý, có tính đánh đố nhẹ theo đúng độ khó ${diff} nhưng chỉ có duy nhất 1 đáp án đúng tuyệt đối.
- Mỗi câu hỏi phải có cấu trúc JSON chính xác gồm:
  - "q": Nội dung câu hỏi (kèm theo tiếng Việt rõ ràng nếu là dạng dịch câu hoặc bài tập ngữ cảnh).
  - "options": Một mảng gồm đúng 4 lựa chọn đáp án bằng tiếng Anh.
  - "correct": Chỉ số của đáp án đúng trong mảng options (từ 0 đến 3).

YÊU CẦU BẮT BUỘC VỀ ĐỊNH DẠNG: Chỉ trả về duy nhất một chuỗi JSON hợp lệ dưới dạng một mảng (Array) gồm đúng 5 object, tuyệt đối không kèm theo bất kỳ lời chào, giải thích hay markdown code block nào bên ngoài (không dùng \`\`\`json). Ví dụ format chuẩn:
[
  {"q": "Hãy chọn câu tiếng Anh chính xác nhất để dịch câu: 'Tên bạn là gì?'", "options": ["What is your name?", "How are you?", "Who are you?", "Where are you from?"], "correct": 0}
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
          temperature: 0.6
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
              content: "Bạn là trợ lý chấm bài viết tiếng Anh tận tâm. Hãy phát hiện lỗi ngữ pháp, chính tả, từ vựng và cấu trúc câu, sau đó đưa ra gợi ý sửa chuẩn xác bằng tiếng Anh kèm giải thích ngắn gọn, dễ hiểu bằng tiếng Việt. Trả về kết quả dạng danh sách thẻ HTML <li>."
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
