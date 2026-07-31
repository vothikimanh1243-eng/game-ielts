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
    // 1. TẠO CÂU HỎI TỰ LUẬN (ĐÃ NÂNG CẤP ĐỂ PHÂN BIỆT RÕ ĐỘ KHÓ)
    if (action === 'generate_questions') {
      // Định nghĩa yêu cầu chi tiết theo độ khó
      let diffInstruction = "";
      if (diff === 'easy') {
        diffInstruction = "Độ khó: Dễ. Dùng các câu đơn ngắn gọn, thì cơ bản (hiện tại đơn, quá khứ đơn), từ vựng thông dụng hàng ngày.";
      } else if (diff === 'medium') {
        diffInstruction = "Độ khó: Trung bình. Dùng câu ghép, mệnh đề quan hệ cơ bản, các thì phức tạp hơn (hiện tại hoàn thành, tương lai tiếp diễn), từ vựng phong phú hơn.";
      } else if (diff === 'hard') {
        diffInstruction = "Độ khó: Khó. BẮT BUỘC phải dùng cấu trúc ngữ pháp nâng cao như: Câu điều kiện loại 2/3, câu giả định (subjunctive), đảo ngữ (inversion), bị động nâng cao, thành ngữ (idioms) hoặc cụm động từ (phrasal verbs) phức tạp.";
      }

      const prompt = `Bạn là một giáo viên tiếng Anh chuyên nghiệp. Hãy tạo ra đúng 5 câu hỏi tự luận tiếng Anh ở cấp độ CEFR: ${level}.
${diffInstruction}
Yêu cầu bao gồm các dạng: Dịch câu từ tiếng Việt sang tiếng Anh và sắp xếp/ghép từ thành câu hoàn chỉnh.

Mỗi câu hỏi phải có cấu trúc JSON dạng mảng gồm các object với các trường sau:
- "q": Nội dung câu hỏi (bằng tiếng Việt yêu cầu dịch hoặc yêu cầu sắp xếp từ phức tạp tương ứng với độ khó).
- "correct": Đáp án tiếng Anh chính xác mẫu.
- "explanation": Giải thích ngắn gọn bằng tiếng Việt về cấu trúc ngữ pháp hoặc từ vựng dùng trong câu.

YÊU CẦU ĐỊNH DẠNG TUYỆT ĐỐI: Chỉ trả về duy nhất một chuỗi JSON hợp lệ dưới dạng một mảng (Array) gồm đúng 5 object, tuyệt đối không kèm markdown code block (không dùng \`\`\`json). Ví dụ format:
[
  {"q": "Hãy dịch câu sau (dùng cấu trúc đảo ngữ): 'Hiếm khi tôi thấy anh ấy nổi giận.'", "correct": "Rarely did I see him get angry.", "explanation": "Sử dụng cấu trúc đảo ngữ với trạng từ chỉ tần suất đứng đầu câu."}
]`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.85 // Tăng độ sáng tạo một chút để AI đa dạng hóa câu hỏi
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

    // 2. CHẤM CÂU TRẢ LỜI CỦA NGƯỜI DÙNG
    if (action === 'check_answer') {
      const prompt = `Bạn là giám khảo tiếng Anh thân thiện. 
Câu hỏi gốc: "${text}"
Đáp án mẫu chuẩn: "${correctAnswer}"
Học viên trả lời: "${userAnswer}"

Hãy đánh giá xem câu trả lời của học viên có đúng ngữ nghĩa và ngữ pháp hay không (linh hoạt chấp nhận các từ đồng nghĩa hoặc biến thể hợp lý).
Trả về định dạng JSON thuần túy (không dùng markdown \`\`\`json):
{
  "isCorrect": true hoặc false,
  "feedback": "Nhận xét ngắn gọn bằng tiếng Việt"
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
