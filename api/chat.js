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
      let diffInstruction = "";
      if (diff === 'easy') {
        diffInstruction = "Độ khó: Dễ. Dùng các câu đơn ngắn gọn, thì cơ bản, từ vựng thông dụng.";
      } else if (diff === 'medium') {
        diffInstruction = "Độ khó: Trung bình. Dùng câu ghép, mệnh đề quan hệ, thì phức tạp hơn.";
      } else if (diff === 'hard') {
        diffInstruction = "Độ khó: Khó. BẮT BUỘC dùng cấu trúc nâng cao như câu điều kiện, đảo ngữ, bị động nâng cao, cụm động từ phức tạp.";
      }

      const prompt = `Bạn là một giáo viên tiếng Anh. Hãy tạo ra đúng 5 câu hỏi tự luận tiếng Anh ở cấp độ ${level}.
${diffInstruction}
Yêu cầu: Dịch câu từ tiếng Việt sang tiếng Anh và sắp xếp/ghép từ thành câu hoàn chỉnh.

QUAN TRỌNG: Chỉ trả về một mảng JSON thuần túy gồm đúng 5 object với cấu trúc chính xác sau, KHÔNG dùng markdown, KHÔNG dùng dấu ngoặc kép lồng nhau bên trong giá trị chuỗi:
[
  {"q": "Noi dung cau hoi", "correct": "Dap an tieng Anh", "explanation": "Giai thich"}
]`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5 // Hạ nhiệt độ để AI tuân thủ cấu trúc JSON chuẩn xác hơn
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let rawContent = data.choices[0].message.content.trim();
      
      // Làm sạch chuỗi triệt để trước khi parse JSON
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      const firstBracket = rawContent.indexOf('[');
      const lastBracket = rawContent.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        rawContent = rawContent.substring(firstBracket, lastBracket + 1);
      }

      let parsedData;
      try {
        parsedData = JSON.parse(rawContent);
      } catch (err) {
        // Fallback nếu JSON lỗi cú pháp do AI sinh ký tự lạ
        console.error("JSON Parse Error:", err, rawContent);
        throw new Error("AI tạo định dạng lỗi, vui lòng bấm Bắt Đầu lại.");
      }

      const questionsArray = parsedData.map(item => ({
        q: item.q,
        correctAnswer: item.correct || item.correctAnswer,
        explanation: item.explanation
      }));

      return res.status(200).json({ questions: questionsArray });
    }

    // 2. CHẤM CÂU TRẢ LỜI
    if (action === 'check_answer') {
      const prompt = `Bạn là giám khảo tiếng Anh. 
Câu hỏi: "${text}"
Đáp án mẫu: "${correctAnswer}"
Học viên trả lời: "${userAnswer}"

Đánh giá đúng/sai (chấp nhận từ đồng nghĩa/biến thể hợp lý).
Trả về JSON thuần túy (không markdown):
{"isCorrect": true, "feedback": "Nhận xét ngắn gọn bằng tiếng Việt"}`;

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
      const firstBrace = rawContent.indexOf('{');
      const lastBrace = rawContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        rawContent = rawContent.substring(firstBrace, lastBrace + 1);
      }

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
