(function () {
  var scriptTag = document.currentScript;
  var businessId = scriptTag.getAttribute("data-business") || "demo";
  var accentColor = scriptTag.getAttribute("data-color") || "#4f46e5";
  var greeting = scriptTag.getAttribute("data-greeting") || "Ćao! Kako mogu da pomognem?";
  var apiBase = scriptTag.src.replace(/\/widget\.js.*$/, "");

  var history = [];
  var sending = false;

  var host = document.createElement("div");
  host.id = "ai-biz-widget-host";
  host.style.position = "fixed";
  host.style.bottom = "20px";
  host.style.right = "20px";
  host.style.zIndex = "2147483000";
  document.body.appendChild(host);

  var shadow = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent =
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}" +
    ".bubble{width:60px;height:60px;border-radius:50%;background:" + accentColor + ";color:#fff;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);font-size:26px;display:flex;align-items:center;justify-content:center;transition:transform .15s ease;}" +
    ".bubble:hover{transform:scale(1.06);}" +
    ".panel{display:none;flex-direction:column;width:340px;max-width:90vw;height:480px;max-height:75vh;background:#fff;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.25);overflow:hidden;position:absolute;bottom:72px;right:0;}" +
    ".panel.open{display:flex;}" +
    ".header{background:" + accentColor + ";color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;font-weight:600;}" +
    ".header button{background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;}" +
    ".messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f7f7f9;}" +
    ".msg{max-width:80%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.4;white-space:pre-wrap;}" +
    ".msg.user{align-self:flex-end;background:" + accentColor + ";color:#fff;border-bottom-right-radius:4px;}" +
    ".msg.bot{align-self:flex-start;background:#e9e9ee;color:#222;border-bottom-left-radius:4px;}" +
    ".msg.typing{align-self:flex-start;background:#e9e9ee;color:#888;font-style:italic;}" +
    ".inputRow{display:flex;border-top:1px solid #e5e5ea;padding:8px;gap:6px;background:#fff;}" +
    ".inputRow input{flex:1;border:1px solid #ddd;border-radius:20px;padding:9px 14px;font-size:14px;outline:none;}" +
    ".inputRow input:focus{border-color:" + accentColor + ";}" +
    ".inputRow button{background:" + accentColor + ";color:#fff;border:none;border-radius:20px;padding:0 16px;font-size:14px;cursor:pointer;}" +
    ".inputRow button:disabled{opacity:.5;cursor:default;}" +
    ".footer{text-align:center;font-size:10px;color:#aaa;padding:4px 0 6px;}";
  shadow.appendChild(style);

  var wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  shadow.appendChild(wrapper);

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "Otvori chat");
  bubble.textContent = "💬";
  wrapper.appendChild(bubble);

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML =
    '<div class="header"><span>Pitaj nas</span><button aria-label="Zatvori">×</button></div>' +
    '<div class="messages"></div>' +
    '<div class="inputRow"><input type="text" placeholder="Napiši poruku..." /><button>Pošalji</button></div>' +
    '<div class="footer">Powered by AI asistent</div>';
  wrapper.appendChild(panel);

  var messagesEl = panel.querySelector(".messages");
  var inputEl = panel.querySelector("input");
  var sendBtn = panel.querySelector(".inputRow button");
  var closeBtn = panel.querySelector(".header button");

  function addMessage(role, text) {
    var el = document.createElement("div");
    el.className = "msg " + role;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function toggle() {
    var isOpen = panel.classList.toggle("open");
    if (isOpen && messagesEl.children.length === 0) {
      addMessage("bot", greeting);
    }
    if (isOpen) inputEl.focus();
  }

  bubble.addEventListener("click", toggle);
  closeBtn.addEventListener("click", toggle);

  async function send() {
    var text = inputEl.value.trim();
    if (!text || sending) return;

    sending = true;
    sendBtn.disabled = true;
    inputEl.value = "";
    addMessage("user", text);
    var typingEl = addMessage("typing", "kuca...");

    try {
      var res = await fetch(apiBase + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: businessId, message: text, history: history }),
      });
      var data = await res.json();
      typingEl.remove();

      if (!res.ok) {
        addMessage("bot", "Izvini, trenutno imam tehnički problem. Pokušaj ponovo malo kasnije.");
      } else {
        addMessage("bot", data.reply);
        history.push({ role: "user", content: text });
        history.push({ role: "assistant", content: data.reply });
      }
    } catch (err) {
      typingEl.remove();
      addMessage("bot", "Nema konekcije sa serverom. Pokušaj ponovo.");
    } finally {
      sending = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener("click", send);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") send();
  });
})();
