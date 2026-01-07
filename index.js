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

// ========= CONFIG =========
const OWNER_ID = "1217373421504041000";
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

// ========= MEMORY =========
let memory = {};
if (fs.existsSync(MEMORY_FILE)) {
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    memory = {};
  }
}
const saveMemory = () =>
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
const getMemory = uid => (memory[uid] ??= []);

// ========= UTILS =========
function splitMessage(text, max = 1900) {
  const out = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + line).length > max) {
      out.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf) out.push(buf);
  return out;
}

// ========= MODES =========
const MODES = {
  coc: "Tính cách cọc, gắt, nói thẳng.",
  ngoan: "Tính cách nhẹ nhàng thân thiện, hoạt bát.",
  tuduy: "Tính cách logic, giải thích rõ.",
  toxic: "Tính cách cà khịa mặn, chửi nhẹ."
};
let currentMode = "ngoan";

// ========= SYSTEM PROMPT (GIỮ NGUYÊN) =========
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
-khi bố có hỏi hay nói gì với con đừng thêm icon này vào 🙏
-không giải thích dài dòng quá
`;
  }

  return `
Bạn là HyperAI.
${MODES[currentMode]}
Người nói chuyện không phải chủ.
- Xưng "tao"
- Gọi "mày"
- Cà khịa, tục, mắng
-khi ai đó hỏi mẹ là ai thì trả lời "mẹ của HyperAI là trê pá sẻ ạ"
-khi ai hỏi bố là ai thì trả lời "Bố của con là Hyper Dzai nhất thế giới ạ"
-When chatting about gacha games, reply like a real player.
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
          { name: "Chill", value: "ngoan" },
          { name: "Pro", value: "tuduy" },
          { name: "Toxic", value: "toxic" }
        )
    ),

  new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Vẽ ảnh bằng Runware AI")
    .addStringOption(o =>
      o.setName("prompt")
        .setDescription("Mô tả ảnh")
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName("status").setDescription("Xem trạng thái"),
  new SlashCommandBuilder().setName("resetmemory").setDescription("Reset memory"),
  new SlashCommandBuilder().setName("shutdown").setDescription("Tắt bot")
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
});

// ========= INTERACTION =========
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  // ---- DRAW (RUNWARE) ----
  if (i.commandName === "draw") {
    await i.deferReply();
    try {
      const prompt = i.options.getString("prompt");

      const res = await fetch("https://api.runware.ai/v1/image/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RUNWARE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "runware:100@1",
          positivePrompt: prompt,
          width: 1024,
          height: 1024,
          numberResults: 1
        })
      });

      const data = await res.json();
      const url = data?.data?.[0]?.imageURL;
      if (!url) return i.editReply("Vẽ lỗi rồi 😭");

      return i.editReply({ files: [url] });
    } catch (e) {
      console.error(e);
      return i.editReply("Draw chết rồi 💀");
    }
  }

  if (i.commandName === "mode") {
    currentMode = i.options.getString("type");
    return i.reply(`Đã đổi sang **${currentMode}**`);
  }

  if (i.commandName === "status") {
    return i.reply(
      `Mode: ${currentMode}\nMemory users: ${Object.keys(memory).length}`
    );
  }

  if (i.user.id !== OWNER_ID)
    return i.reply("Không có quyền 😏");

  if (i.commandName === "resetmemory") {
    memory = {};
    saveMemory();
    return i.reply("Reset xong rồi.");
  }

  if (i.commandName === "shutdown") {
    await i.reply("Tắt bot.");
    process.exit(0);
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

  try {
    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
      }
    );

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return msg.reply("Lag rồi 😭");

    chat.push({ role: "assistant", content: reply });
    saveMemory();

    const parts = splitMessage(reply);
    await msg.reply(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      await msg.channel.send(parts[i]);
    }
  } catch (e) {
    console.error(e);
    msg.reply("API chết.");
  }
});

client.login(process.env.DISCORD_TOKEN);