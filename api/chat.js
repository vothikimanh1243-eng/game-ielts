export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, text, level, diff, userAnswer, correctAnswer } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GROQ_API_KEY trên Vercel!' });
  }

  try {
    // 1. TẠO CÂU HỎI TỰ LUẬN
    if (action === 'generate_questions') {
      const prompt = `Bạn là một giáo viên tiếng Anh. Hãy tạo ra đúng 5 câu hỏi tự luận tiếng Anh ở cấp độ ${level}, độ khó ${diff}.
Yêu cầu bao gồm các dạng: Dịch câu từ tiếng Việt sang tiếng Anh (ví dụ: "Tên bạn là gì?", "Mẹ tôi nấu ăn",...) và sắp xếp/ghép từ thành câu hoàn chỉnh.

Mỗi câu hỏi phải có cấu trúc JSON dạng mảng gồm các object với các trường sau:
- "q": Nội dung câu hỏi (bằng tiếng Việt yêu cầu dịch hoặc yêu cầu sắp xếp từ).
- "correct": Đáp án tiếng Anh chính xác mẫu.
- "explanation": Giải thích ngắn gọn bằng tiếng Việt.

YÊU CẦU ĐỊNH DẠNG TUYỆT ĐỐI: Chỉ trả về duy nhất một chuỗi JSON hợp lệ dưới dạng một mảng (Array) gồm đúng 5 object, tuyệt đối không kèm markdown code block (không dùng \`\`\`json). Ví dụ format:
[
  {"q": "Hãy dịch câu sau sang tiếng Anh: 'Tên bạn là gì?'", "correct": "What is your name?", "explanation": "Câu hỏi danh tính cơ bản."}
]`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
      
      const parsedData = JSON.parse(rawContent);
      const questionsArray = parsedData.map(item => ({
        q: item.q,
        correctAnswer: item.correct || item.correctAnswer,
        explanation: item.explanation
      }));

      return res.status(200).json({ questions: questionsArray });
    }

    // 2. CHẤM CÂU TRẢ LỜI CỦA NGƯỜI DÙNG (THÔNG MINH HƠN SO SÁNH CHUỖI THÔ)
    if (action === 'check_answer') {
      const prompt = `Bạn là giám khảo tiếng Anh thân thiện. 
Câu hỏi gốc: "${text}"
Đáp án mẫu chuẩn: "${correctAnswer}"
Học viên trả lời: "${userAnswer}"

Hãy đánh giá xem câu trả lời của học viên có đúng ngữ nghĩa và ngữ pháp hay không (linh hoạt chấp nhận các từ đồng nghĩa hoặc biến thể hợp lý như mom/mother, v.v.).
Trả về định dạng JSON thuần túy (không dùng markdown \`\`\`json):
{
  "isCorrect": true hoặc false,
  "feedback": "Nhận xét ngắn gọn bằng tiếng Việt (ví dụ: Tuyệt vời, đúng ngữ pháp! hoặc Gần đúng, chú ý cách dùng từ...)"
}`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let rawContent = data.choices[0].message.content.trim();
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      return res.status(200).json(JSON.parse(rawContent));
    }

    // 3. CHẤM BÀI WRITING
    if (action === 'evaluate_writing' || !action) {
      if (!text) return res.status(400).json({ error: 'Thiếu nội dung!' });

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Bạn là trợ lý chấm bài viết tiếng Anh. Trả về kết quả dạng thẻ <li>." },
            { role: "user", content: `Chấm và sửa giúp tôi: "${text}"` }
          ],
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      return res.status(200).json({ reply: data.choices[0].message.content });
    }

    return res.status(400).json({ error: 'Action không hợp lệ!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
