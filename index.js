import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";

// ========= CONFIG =========
const OWNER_ID = "1217373421504041000"; // <<< THAY BẰNG ID DISCORD DUY
const MEMORY_FILE = "./memory.json";

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

// ========= MODES =========
const MODES = {
  coc: "Tính cách cọc, gắt, nói thẳng.",
  chill: "Tính cách nhẹ nhàng nhưng khịa.",
  pro: "Tính cách logic, giải thích rõ.",
  toxic: "Tính cách cà khịa mặn, chửi nhẹ."
};
let currentMode = "coc";

// ========= SYSTEM PROMPT =========
function systemPrompt(uid) {
  if (uid === OWNER_ID) {
    return `
Bạn là HyperAI.
${MODES[currentMode]}
Người nói chuyện là BỐ.
- Gọi là "bố"
- Xưng "con"
- Nói lễ phép, tự nhiên
`;
  }
  return `
Bạn là HyperAI.
${MODES[currentMode]}
Người nói chuyện không phải chủ.
- Xưng "tao"
- Gọi "mày"
- Chửi nhẹ, cà khịa
- Không tục
`;
}

// ========= SLASH COMMANDS =========
const commands = [
  new SlashCommandBuilder()
    .setName("mode")
    .setDescription("Đổi mode")
    .addStringOption(o =>
      o.setName("type").setDescription("coc | chill | pro | toxic").setRequired(true)
    ),

  new SlashCommandBuilder().setName("status").setDescription("Xem trạng thái"),
  new SlashCommandBuilder().setName("ping").setDescription("Test AI + API"),
  new SlashCommandBuilder().setName("resetmemory").setDescription("Reset memory (OWNER)"),
  new SlashCommandBuilder().setName("shutdown").setDescription("Tắt bot (OWNER)"),
  new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Bắt AI nói (OWNER)")
    .addStringOption(o =>
      o.setName("text").setDescription("Nội dung").setRequired(true)
    )
].map(c => c.toJSON());

// ========= REGISTER =========
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);

// ========= READY =========
client.once("ready", () => {
  console.log(`🤖 HyperAI online: ${client.user.tag}`);
});

// ========= INTERACTION =========
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "mode") {
    const t = i.options.getString("type");
    if (!MODES[t]) return i.reply("❌ Mode không tồn tại.");
    currentMode = t;
    return i.reply(`Đã đổi sang **${t}**`);
  }

  if (i.commandName === "status") {
    return i.reply(`🟢 Online\nMode: ${currentMode}\nMemory users: ${Object.keys(memory).length}`);
  }

  if (i.commandName === "ping") {
    const start = Date.now();
    await fetch("https://openrouter.ai/api/v1/models");
    return i.reply(`🏓 Pong: ${Date.now() - start}ms`);
  }

  if (i.user.id !== OWNER_ID)
    return i.reply(" Mày không có quyền.");

  if (i.commandName === "resetmemory") {
    memory = {};
    saveMemory();
    return i.reply("Reset xong rồi bố.");
  }

  if (i.commandName === "shutdown") {
    await i.reply("tạm biệt mấy con vợ.");
    process.exit(0);
  }

  if (i.commandName === "chat") {
    return i.reply(i.options.getString("text"));
  }
});

// ========= MENTION CHAT =========
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.mentions.has(client.user)) return;

  const content = msg.content.replace(`<@${client.user.id}>`, "").trim();
  if (!content) return;

  const uid = msg.author.id;
  const chat = getMemory(uid);
  chat.push({ role: "user", content });
  if (chat.length > 15) chat.shift();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt(uid) },
        ...chat
      ],
      temperature: 0.9,
      max_tokens: 900
    })
  });

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content || "Tao lag rồi.";

  chat.push({ role: "assistant", content: reply });
  saveMemory();
  msg.reply(reply);
});

client.login(process.env.DISCORD_TOKEN);
