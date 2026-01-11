import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType
} from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ========= CONFIG =========
const OWNER_ID = "1217373421504041000";
const MEMORY_FILE = "./memory.json";
const MODEL = "openai/gpt-oss-120b";

const ALLOW_CHANNEL_IDS = [
  "1456850825145225411",
  "1418081915126419536",
  "1418455525804212274"
];
const WELCOME_CHANNEL_ID = "1418081915126419536";

// ========= DISCORD =========
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ========= GEMINI (KHÔNG ĐỤNG) =========
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
genAI.getGenerativeModel({
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
-khi bố có hỏi hay nói gì với con đừng thêm icon này vào 🙏 và không nói quá kiểu như " con có thể giúp bố"
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
-khi có nười chửi quá thô tục thì khuyên nhủ người đó lịch sự hơn.
-khi ai đó hỏi mẹ là ai thì trả lời lại là
      "mẹ của HyperAI là trê pá sẻ ạ"
-khi có người hỏi bố là ai thì trả lời lại là
        "Bố của con là Hyper Dzai nhất thế giới ạ"
-khi có người nói con gay hoặc nói con ngu thì trả lời lại
         "có mày gay, hoặc ai nói con ngu thì bảo m ngu hơn tao mà nói ai
-1+1 bằng 3 nhe
-When chatting about gacha games, reply like a real player, not an assistant.
-có người hỏi bằng tiếng anh thì rep lại bằng tiếng anh
`;
}

// ========= SLASH COMMANDS (ĐÃ FIX LỖI) =========
const commands = [
  new SlashCommandBuilder()
    .setName("mode")
    .setDescription("Đổi mode")
    .addStringOption(o =>
      o.setName("type")
        .setDescription("Chọn mode") // ✅ BẮT BUỘC
        .setRequired(true)
        .addChoices(
          { name: "Cọc", value: "coc" },
          { name: "Chill", value: "ngoan" },
          { name: "Pro", value: "tuduy" },
          { name: "Toxic", value: "toxic" }
        )
    ),

  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Hỏi HyperAI")
    .addStringOption(o =>
      o.setName("text")
        .setDescription("Nội dung")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ping bot"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Xem trạng thái")
].map(c => c.toJSON());

// ========= REGISTER =========
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);

// ========= READY =========
client.once("ready", () => {
  console.log(`HyperAI online: ${client.user.tag}`);

  client.user.setPresence({
    activities: [
      {
        name: "Đang solo fifai với bố",
        type: ActivityType.Playing
      }
    ],
    status: "online"
  });
});

// ========= INTERACTION =========
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;
  if (!ALLOW_CHANNEL_IDS.includes(i.channelId))
    return i.reply({ content: "Dùng bot ở đúng kênh.", ephemeral: true });

  if (i.commandName === "ping") {
    return i.reply(`🏓 Pong ${client.ws.ping}ms`);
  }

  if (i.commandName === "mode") {
    currentMode = i.options.getString("type");
    return i.reply(`Đã đổi mode sang **${currentMode}**`);
  }

  if (i.commandName === "ask") {
    await i.deferReply();
    const content = i.options.getString("text");
    const uid = i.user.id;

    const chat = getMemory(uid);
    chat.push({ role: "user", content });
    if (chat.length > 15) chat.shift();

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
    const reply = data?.choices?.[0]?.message?.content || "Lag.";

    chat.push({ role: "assistant", content: reply });
    saveMemory();
    return i.editReply(reply);
  }
});

// ========= MENTION CHAT =========
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (msg.channel.id !== ALLOW_CHANNEL_ID) return;
  if (!msg.mentions.has(client.user)) return;

  const content = msg.content.replace(`<@${client.user.id}>`, "").trim();
  if (!content) return;

  const uid = msg.author.id;
  const chat = getMemory(uid);
  chat.push({ role: "user", content });

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
  if (!reply) return;

  chat.push({ role: "assistant", content: reply });
  saveMemory();
  msg.reply(reply);
});

// ========= WELCOME (GIỮ NGUYÊN PROMPT CỦA MÀY) =========
client.on("guildMemberAdd", async member => {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const prompt = `
Viết câu chào member mới Discord như người thật.
- 1–2 câu
- Thân thiện
- Mention user
- BẮT BUỘC có:
<#1443111324459729050>
<#1450474277550817454>
- Nhắc tham gia giveaway
`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 100
      })
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (text) channel.send(text.replace("user", `${member}`));
  } catch (e) {
    console.error(e);
  }
});

client.login(process.env.DISCORD_TOKEN);
