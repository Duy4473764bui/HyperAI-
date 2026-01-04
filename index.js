âpimport { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";

// ========= CONFIG =========
const OWNER_ID = "1217373421504041000";
const MEMORY_FILE = "./memory.json";
const MODEL = "openai/gpt-oss-120b";

// ⚠️ GUILD MODE
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
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
  chill: "Tính cách nhẹ nhàng thân thiện, hoạt bát.",
  pro: "Tính cách logic, giải thích rõ.",
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
-khi ai hỏi con mẹ con là ai thì hãy nói "mẹ con là trê pá sẻ ạ" nhé.
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
    .setName("ask")
    .setDescription("Hỏi HyperAI (ai cũng dùng được)")
    .addStringOption(o =>
      o.setName("question")
        .setDescription("Nhập câu hỏi")
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName("status").setDescription("Xem trạng thái"),
  new SlashCommandBuilder().setName("resetmemory").setDescription("Reset memory (OWNER)"),
  new SlashCommandBuilder().setName("shutdown").setDescription("Tắt bot (OWNER)")
].map(c => c.toJSON());

// ========= REGISTER (GUILD) =========
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
  { body: commands }
);

// ========= READY =========
client.once("ready", () => {
  console.log(`🤖 HyperAI online: ${client.user.tag}`);
});

// ========= INTERACTION =========
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  // ===== /ask (AI CŨ, LOGIC Y CHANG MENTION) =====
  if (i.commandName === "ask") {
    const content = i.options.getString("question");
    const uid = i.user.id;

    const chat = getMemory(uid);
    chat.push({ role: "user", content });
    if (chat.length > 15) chat.shift();

    await i.deferReply();

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
      const reply = data?.choices?.[0]?.message?.content || "Tao lag rồi.";

      chat.push({ role: "assistant", content: reply });
      saveMemory();

      const chunks = splitMessage(reply);
      await i.editReply(chunks[0]);
      for (let x = 1; x < chunks.length; x++) {
        await i.followUp(chunks[x]);
      }

    } catch (e) {
      console.error(e);
      i.editReply("API chết tạm thời.");
    }
    return;
  }

  // ===== MODE =====
  if (i.commandName === "mode") {
    currentMode = i.options.getString("type");
    return i.reply(`đổi qua **${currentMode}**`);
  }

  if (i.commandName === "status") {
    return i.reply(`🟢 Online\nMode: ${currentMode}\nMemory users: ${Object.keys(memory).length}`);
  }

  if (i.user.id !== OWNER_ID)
    return i.reply("bro không có quyền đâu mà nhấn hehehe.");

  if (i.commandName === "resetmemory") {
    memory = {};
    saveMemory();
    return i.reply("đã tái thiết lại não của hyper.");
  }

  if (i.commandName === "shutdown") {
    await i.reply("bái bai.");
    process.exit(0);
  }
});

// ========= MENTION CHAT (GIỮ NGUYÊN) =========
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
    if (!reply) return msg.reply("Tao lag rồi, hỏi lại đi.");

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
