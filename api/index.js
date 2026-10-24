const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const lockedIds = {}; 

// 🔐 20-Digit Permanent MSID (Aap yahan apni marzi ki 20-digit ID rakh sakte hain)
const MSID = "74920158362409185310"; 

// Backend Server se Authorization Check karne ki Function
async function checkBotActivation() {
  try {
    const response = await axios.get(`https://ahmad-bhai-codes-shop.vercel.app/f?id=${MSID}`);
    const data = typeof response.data === 'string' ? response.data.trim() : String(response.data);
    return data === 'F';
  } catch (err) {
    console.error("Activation Check Error:", err.message);
    return false; // Agar error aaye ya connection fail ho toh system block rahe
  }
}

module.exports = async (req, res) => {
  const { token } = req.query;

  // 1. WEBHOOK SETUP (Handles Rate Limits & Retries)
  if (token && req.method === 'GET') {
    try {
      const bot = new Telegraf(token);
      
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const webhookUrl = `${protocol}://${host}/api/index?token=${token}`;

      await bot.telegram.setWebhook(webhookUrl, {
        drop_pending_updates: true
      });

      return res.status(200).json({
        success: true,
        message: "✅ Webhook Successfully Set!",
        url: webhookUrl
      });

    } catch (err) {
      console.error("Webhook Setup Error:", err);

      if (err.response && err.response.error_code === 429) {
        const retryAfter = err.response.parameters?.retry_after || 1;
        return res.status(429).json({
          error: "Rate Limit Exceeded",
          message: `Telegram API is busy. Please retry after ${retryAfter} second(s).`,
          retry_after: retryAfter
        });
      }

      return res.status(500).json({
        error: "Webhook Failed",
        details: err.message
      });
    }
  }

  // 2. BOT HANDLING (POST Request)
  if (token && req.method === 'POST') {
    const bot = new Telegraf(token);

    // 🔥 GLOBAL SECURITY CHECK: Har command/text se pehle backend verify hoga
    const isAuthorized = await checkBotActivation();
    
    if (!isAuthorized) {
      try {
        const update = req.body;
        let chatId = null;
        if (update.message) {
          chatId = update.message.chat.id;
        } else if (update.callback_query) {
          chatId = update.callback_query.message.chat.id;
        }

                if (chatId) {
          await bot.telegram.sendMessage(chatId, `*Bot Not Found*\n\`${MSID}\`\n*@Magic_Scripts*\n*Contact To Unlock* 🔓`, { parse_mode: 'Markdown' });
        }
      } catch (e) {
        console.error("Error sending block message:", e.message);
      }
      return res.status(200).send("Bot Unauthorized");
    }

    // --- Start Command ---
    bot.start((ctx) => {
      const firstName = ctx.from.first_name || "Dear";
      ctx.replyWithMarkdown(`👋 *Hy Dear ${firstName}*\n\nPlease enter your Quotex Account ID (only numbers) to verify your registration and unlock VIP access.\n\n*REGISTRATION LINK*\n👇👇👇\nhttps://broker-qx.pro/?lid=1708208`);
    });

    // --- Account Command ---
    bot.command('account', (ctx) => {
      ctx.replyWithMarkdown(`*How to create Quotex account?*\n\n1st step: Withdraw all your funds.\n2nd step: Delete your old Quotex account.\n3rd step: Open this link:\nhttps://broker-qx.pro/?lid=1708208\n\n4th step: Select your country, enter your NEW email and secure password, agree to terms, and click Register.\n\n🎉 *Congratulations!* Your account is created. Now enter your Trader ID.`);
    });

    // --- Support Command ---
    bot.command('support', (ctx) => {
      ctx.replyWithMarkdown(`*OFFICIAL SUPPORT TEAM*`, 
        Markup.inlineKeyboard([
          Markup.button.url("📞 Contact Support", "https://t.me/SHKTI_QUOTEX_TRADER90")
        ])
      );
    });

    const parseAmount = (val) => {
      if (val === undefined || val === null) return 0.00;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0.00 : parsed;
    };

    // --- ID Verification Handler ---
    bot.on('text', async (ctx) => {
      const trader_id = ctx.message.text.trim();
      const isNumbersOnly = /^\d+$/.test(trader_id);
      const telegramId = ctx.from.id.toString();

      if (!isNumbersOnly) {
        return ctx.replyWithMarkdown("❌ *Not a valid ID. Please enter numbers only.*");
      }

      const alreadyUsedBy = lockedIds[trader_id];
      if (alreadyUsedBy && alreadyUsedBy !== telegramId) {
        return ctx.replyWithMarkdown("⚠️ *Access Denied!*\n\nThis ID is already registered with another user.");
      }

      await ctx.replyWithMarkdown(`🔍 *Verifying ID:* \`${trader_id}\`...`);

      try {
        const response = await axios({
          method: 'post',
          url: 'https://profile-tau-sage-32.vercel.app/api/postback',
          data: { checkId: trader_id },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 12000
        });

        const data = response.data;

        if (data && data.success && data.trader) {
          const t = data.trader;
          
          const depositAmount = parseAmount(t.total_deposit);
          const withdrawAmount = parseAmount(t.total_withdrawal);
          
          const region = t.country || "Unknown";
          const status = (t.status || "REGISTERED").toUpperCase();

          const isReg = t.is_registered || t.status === 'reg' ? "✅ Verified" : "⚠️ Pending";
          const isEmailConf = t.is_email_confirmed || t.status === 'conf' ? "✅ Confirmed" : "❌ Unconfirmed";
          const isFTD = t.is_ftd || depositAmount > 0 ? "✅ Yes" : "❌ No";

          const linkId = t.link_id || "N/A";
          const clickId = t.click_id || "N/A";
          const eventId = t.event_id || "N/A";
          const siteId = t.site_id || "N/A";
          const lastUpdated = t.last_updated ? new Date(t.last_updated).toLocaleString("en-US") : "N/A";

          const fullInfoText = `📊 *COMPLETE ACCOUNT PROFILE INFO*
━━━━━━━━━━━━━━━━━━
🆔 *Trader ID:* \`${t.uid || trader_id}\`
💰 *Total Deposit:* $${depositAmount.toFixed(2)}
💸 *Total Withdrawal:* $${withdrawAmount.toFixed(2)}
🌍 *Country / Region:* ${region}
📌 *Account Status:* ${status}

📋 *VERIFICATION STATUS*
• Registration: ${isReg}
• Email Status: ${isEmailConf}
• First Deposit (FTD): ${isFTD}

🔗 *TRACKING DATA*
• Link ID (LID): \`${linkId}\`
• Click ID (CID): \`${clickId}\`
• Event ID (EID): \`${eventId}\`
• Site ID (SID): \`${siteId}\`
⏱ *Last Updated:* \`${lastUpdated}\`
━━━━━━━━━━━━━━━━━━`;

          if (depositAmount >= 10) {
            lockedIds[trader_id] = telegramId;

            await ctx.replyWithMarkdown(`${fullInfoText}\n\n✨ *Status: Qualified for VIP Signals!*`);

            const channel_id = "-1003819333763"; 
            try {
              const inviteLinkObj = await bot.telegram.createChatInviteLink(channel_id, {
                member_limit: 1,
                name: `Member: ${t.uid || trader_id}`
              });

              const invite_link = inviteLinkObj.invite_link;
              const welcomeMsg = `🏆 *Congratulations!*\n\nYou have been granted access to our *VIP Signals Channel*.\n\n⚠️ *Note:* This link is for *one-time use only* and will expire once you join.`;
              
              await ctx.replyWithMarkdown(welcomeMsg, Markup.inlineKeyboard([
                Markup.button.url("🚀 JOIN VIP CHANNEL NOW", invite_link)
              ]));

            } catch (linkErr) {
              console.error("Link Gen Error:", linkErr?.response?.description || linkErr.message);
              ctx.replyWithMarkdown("⚠️ *Note:* Account verified, but failed to issue link.\n\n*Fix:* Make sure the Bot is added as an **Admin** in the channel with **'Invite Users via Link'** permission.");
            }

          } else {
            const depositWarning = `⚠️ *Deposit Required to Unlock VIP*

Your Trader ID is correctly registered under our link, but your deposit balance is *$${depositAmount.toFixed(2)}*.

👉 *Requirement:* Make a minimum deposit of *$10* to unlock the VIP Channel link.

After depositing, re-enter your ID here to get instant access!`;
            
            await ctx.replyWithMarkdown(`${fullInfoText}\n\n${depositWarning}`);
          }

        } else {
          const failMsg = `❌ *Account Not Found*

Your account is not registered under our official partner link.

👇 *Follow these steps to join VIP:*

1️⃣ Create a new Quotex account using this link:
https://broker-qx.pro/?lid=1708208

2️⃣ Deposit minimum *$10*.
3️⃣ Send your new Trader ID here for verification.`;
          ctx.replyWithMarkdown(failMsg, { disable_web_page_preview: true });
        }

      } catch (error) {
        if (error.response && error.response.status === 404) {
          const failMsg = `❌ *Account Not Found*

Your account is not registered under our official partner link.

👇 *Follow these steps to join VIP:*

1️⃣ Create a new Quotex account using this link:
https://broker-qx.pro/?lid=1708208

2️⃣ Deposit minimum *$10*.
3️⃣ Send your new Trader ID here for verification.`;
          return ctx.replyWithMarkdown(failMsg, { disable_web_page_preview: true });
        }

        console.error("API Fetch Error Details:", error.message);
        ctx.replyWithMarkdown(`⚠️ *System Error*\n\nUnable to connect to verification server.\n\n*Reason:* \`${error.message}\``);
      }
    });

    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error("Handle Update Error:", err);
      if (!res.headersSent) res.sendStatus(500);
    }
  } else {
    if (!res.headersSent) res.status(403).send("Invalid Request.");
  }
};
