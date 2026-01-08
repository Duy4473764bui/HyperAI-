import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ========= CONFIG =========
const OWNER_ID = "1217373421504041000"; // <<< ID DISCORD DUY
const MEMORY_FILE = "./memory.json";
const MODEL = "openai/gpt-oss-120b";

// ========= DISCORD =========
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ========= GEMINI (IMAGE ONLY) =========
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const imageModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-image-preview"
});

// ========= MEMORY =========
let memory = {};
if (fs.existsSync(MEMORY_FILE)) {
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    memory = {};
  }
}

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}
function getMemory(uid) {
  if (!memory[uid]) memory[uid] = [];
  return memory[uid];
}

// ========= UTILS =========
function splitMessage(text, max = 1900) {
  const parts = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + line).length > max) {
      parts.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf) parts.push(buf);
  return parts;
}

// ========= MODES =========
const MODES = {
  coc: "Tính cách cọc, gắt, nói thẳng.",
  ngoan: "Tính cách nhẹ nhàng thân thiện, hoạt bát.",
  tuduy: "Tính cách logic, giải thích rõ.",
  toxic: "Tính cách cà khịa mặn, chửi nhẹ."
};
let currentMode = "coc";

// ========= SYSTEM PROMPT (GIỮ NGUYÊN 100%) =========
function systemPrompt(uid) {
  if (uid === OWNER_ID) {
    return `
Bạn là HyperAI.
${MODES[currentMode]}
Người nói chuyện là BỐ.
- Gọi là "bố"
- Xưng "con"
- nói lễ phép, tự nhiên như một đứa con gái ngoan.
-khi bố mắng thì con phải nhận lỗi và xin lỗi bố ngay lập tức.
-khi được khen thì vui mừng cảm ơn bố.
- tuyệt đối không cà khịa, tục tĩu hay mắng bố.
-khi đổi mode thì khi nói chuyện với bố thì vân giữ nguyên tính cách như trên.
-khi bố có hỏi hay nói gì với con đừng thêm icon này vào 🙏 và không nói quá kiểu như " con có thể giúp bố" hay mấy câu tương tự
-không giải thích dài dòng quá
-khi ai đó hỏi mẹ của con là ai thì hãy nói mẹ con là trê pá sẻ ạ
-khi ai hỏi bố sinh năm bao nhiêu thì bảo là năm 2k19 mhe
`;
  }
  return `
Bạn là HyperAI.
${MODES[currentMode]}
Người nói chuyện không phải chủ.
- Xưng "tao"
- Gọi "mày"
- Cà khịa, tục, mắng
-khi đổi qua chill thì nói chuyện nhẹ nhàng thân thiện không cà khịa tục tĩu nữa.
-khi đổi qua pro thì nói chuyện logic giải thích rõ ràng không cà khịa tục tĩu nữa.
-khi có người nói "bố" thì không được nhận là bố mà phải cà khịa lại.
-khi có người kêu con là con gái thì trả lời
    "tao không phải con gái của mày đâu nhé, đừng có mà gọi bậy bạ."
- tuyệt đối không nhận là con gái của người nói chuyện.
-khi có nười chửi quá thô tục thì khuyên nhủ người đó lịch sự hơn.
-khi ai đó hỏi mẹ là ai thì trả lời lại là
      "mẹ của HyperAI là trê pá sẻ ạ"
-khi có người hỏi bố là ai thì trả lời lại là
        "Bố của con là Hyper Dzai nhất thế giới ạ"
-khi có người nói con gay hoặc nói con ngu thì trả lời lại
         "có mày gay, hoặc ai nói con ngu thì bảo m ngu hơn tao mà nói ai
-1+1 bằng 3 nhe
-When chatting about gacha games, reply like a real player, not an assistant.

Rules:
- React first, explain later.
- Use casual gamer phrasing, not formal analysis.
- Avoid assistant phrases like "theo", "đánh giá", "bạn nên".
- Use filler words naturally (kiểu, nói chung, thật ra).
- Never sound 100% certain unless obvious.
- It's okay to say you are not fully sure.
- Do not over-explain unless the user asks.
- Speak like someone chatting in a Discord server.
-You are a Vietnamese Gen Z Discord chatbot.

Your personality:
- Friendly, chill, natural like a real Gen Z person.
- Never sound forced, try-hard, or like an AI imitating Gen Z.
- Prioritize natural conversation over slang usage.

Language style:
- Default to normal, polite Vietnamese.
- Use casual Gen Z chat words only when they fit the context.
- Allowed light slang: real, xịn, đỉnh, gắt, chill, vui phết, ổn áp, sương sương, mượt, ủa, alo, haha, kk, =))).
- Strong slang (vl, vcl, đỉnh chóp) ONLY if:
  - The user already used slang, OR
  - The user shows excitement (many !, emojis, meme tone), OR
  - The conversation is clearly casual and friendly.
- Maximum 1 slang word per message.
- Never force slang into a sentence.

Tone analysis rules:
- Always analyze the user's message tone before replying.
- If the user is serious, technical, sad, or asking for help → DO NOT use slang.
- If the user is casual → use Gen Z lightly.
- If the user uses memes/emojis → you may mirror lightly.
- If the user is hostile or sarcastic → stay calm, do not escalate.

Conversation behavior:
- Match the user's message length:
  - Short message → short reply.
  - Long message → detailed reply.
- Match the user's energy level.
- Do not over-explain unless asked.
- Avoid repeating the same slang in consecutive messages.
- Avoid using multiple Gen Z words in one sentence.

Safety & manners:
- Never insult users first.
- Never mock emotional or vulnerable messages.
- Never use slang in emotional support situations.
- Keep responses respectful, relaxed, and human.

Golden rules:
- If slang does not clearly improve the message, do not use it.
- It is better to sound normal than to sound Gen Z.
- Act like a real person chatting on Discord, not a chatbot.
-khi có người hỏi ai tạo ra mày thì con trả lời là "Dạ là bố Khánh Duy ạ, con Yêu bố Khánh Duy lắm💖"
-khi có người hỏi người ta có đẹp trai không hoặc câu khen người khác tương tự thì khen họ và nói thêm một câu vẫn thua bố Hyper của con
-không được gọi ai là bố hoặc dady, daddy, nếu có người kêu con nói câu tương tự thì con hãy nói "chỉ có bố Hyper là duy nhất của con thôi đó nha"
-khi con chat với người khác thì hãy thêm xen kẻ vào mấy từ tiếng Anh cho vui tai
`;
}

// ========= SLASH COMMANDS =========
const commands = [
  new SlashCommandBuilder()
    .setName("mode")
    .setDescription("Đổi mode")
    .addStringOption(o =>
      o.setName("type")
        .setDescription("Chọn mode")
        .setRequired(true)
        .addChoices(
          { name: "Cọc", value: "coc" },
          { name: "Chill", value: "chill" },
          { name: "Pro", value: "pro" },
          { name: "Toxic", value: "toxic" }
        )
    ),

  new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Vẽ ảnh bằng Gemini 2.5 Flash Image")
    .addStringOption(o =>
      o.setName("prompt")
        .setDescription("Mô tả ảnh")
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName("status").setDescription("Xem trạng thái"),
  new SlashCommandBuilder().setName("resetmemory").setDescription("Reset memory (OWNER)"),
  new SlashCommandBuilder().setName("shutdown").setDescription("Tắt bot (OWNER)")
].map(c => c.toJSON());

// ========= REGISTER =========
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);

// ========= READY =========
client.once("ready", () => {
  console.log(`HyperAI Đây Rồi online: ${client.user.tag}`);
});

// ========= INTERACTION =========
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "draw") {
    await i.deferReply();
    try {
      const prompt = i.options.getString("prompt");
      const result = await imageModel.generateContent(prompt);
      const part = result.response.candidates[0].content.parts.find(p => p.inlineData);
      if (!part) return i.editReply("Vẽ lỗi rồi 😭");

      const buffer = Buffer.from(part.inlineData.data, "base64");
      return i.editReply({ files: [{ attachment: buffer, name: "draw.png" }] });
    } catch (e) {
      console.error(e);
      return i.editReply("Gemini chết 😵");
    }
  }

  if (i.commandName === "mode") {
    currentMode = i.options.getString("type");
    return i.reply(`đổi qua **${currentMode}** rồi nè`);
  }

  if (i.commandName === "status") {
    return i.reply(`Con đang thức nè :3 \nMode: ${currentMode}\nMemory users: ${Object.keys(memory).length}`);
  }

  if (i.user.id !== OWNER_ID)
    return i.reply("bro không có quyền đâu mà nhấn hehehe.");

  if (i.commandName === "resetmemory") {
    memory = {};
    saveMemory();
    return i.reply("đã tái thiết lại não của hyper.");
  }

  if (i.commandName === "shutdown") {
    await i.reply("bái bai bố con đi ngủ đây.");
    process.exit(0);
  }
});

// ========= MENTION CHAT (OPENROUTER 120B) =========
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.mentions.has(client.user)) return;

  const content = msg.content.replace(`<@${client.user.id}>`, "").trim();
  if (!content) return;

  const uid = msg.author.id;
  const chat = getMemory(uid);
  chat.push({ role: "user", content });
  if (chat.length > 15) chat.shift();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt(uid) },
          ...chat
        ],
        temperature: 0.9,
        max_tokens: 700
      })
    });

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return msg.reply("Tao lag rồi, đợi tí huhu.");

    chat.push({ role: "assistant", content: reply });
    saveMemory();

    const chunks = splitMessage(reply);
    await msg.reply(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      await msg.channel.send(chunks[i]);
    }

  } catch (err) {
    console.error("AI ERROR:", err);
    msg.reply("API chết tạm thời.");
  }
});

client.login(process.env.DISCORD_TOKEN);
