// script.js (COMPLETO, corrigido)

// --- CONFIG FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCmEEx1Z_QK7MblQnrezw5S7CXo1uzcCy4",
  authDomain: "comentarios-livro.firebaseapp.com",
  databaseURL: "https://comentarios-livro-default-rtdb.firebaseio.com",
  projectId: "comentarios-livro",
  storageBucket: "comentarios-livro.appspot.com",
  messagingSenderId: "702096545512",
  appId: "1:702096545512:web:f7f305fe579d246c41b5d"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

const ADMIN_UID = "RTJkscPxu9MjMFL4RZSaILntfM13";

const commentsRef = db.ref("comentarios");
const namesRef = db.ref("nomesUsados");
const onlineRef = db.ref("logados");
const bannedRef = db.ref("banidos");

// --- ELEMENTOS HTML ---
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const deleteBtn = document.getElementById("delete-account");
const userInfo = document.getElementById("user-info");
const userCount = document.getElementById("user-count");
const form = document.getElementById("comment-form");
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const commentsDiv = document.getElementById("comments");
const mentionBox = document.getElementById("mention-suggestions");

// Modal
const customModal = document.getElementById("custom-modal");
const modalMessage = document.getElementById("modal-message");
const modalInput = document.getElementById("modal-input");
const modalTextarea = document.getElementById("modal-textarea");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const alertBox = document.getElementById("alert-box");

// Resposta
const replyBox = document.getElementById("reply-box");
const replyMessageSpan = replyBox.querySelector(".reply-message");
const cancelReplyBtn = replyBox.querySelector(".cancel-reply-btn");
let replyToCommentId = null;
let replyToAuthorName = null;

cancelReplyBtn.addEventListener("click", () => {
  replyToCommentId = null;
  replyToAuthorName = null;
  replyBox.style.display = "none";
  replyMessageSpan.textContent = "";
});

// --- ALERTAS ---
function showAlert(msg, isError = false) {
  alertBox.textContent = msg;
  alertBox.classList.toggle("error-alert", isError);
  alertBox.style.display = "block";
  setTimeout(() => (alertBox.style.display = "none"), 4000);
}

function showCustomPrompt(msg, type = "text", defaultValue = "") {
  return new Promise((resolve) => {
    modalMessage.textContent = msg;
    modalInput.style.display = type === "text" ? "block" : "none";
    modalTextarea.style.display = type === "textarea" ? "block" : "none";
    modalInput.value = defaultValue;
    modalTextarea.value = defaultValue;
    modalConfirmBtn.style.display = modalCancelBtn.style.display = "inline-block";
    customModal.style.display = "flex";

    const confirmHandler = () => {
      const value = type === "text" ? modalInput.value : modalTextarea.value;
      cleanup();
      resolve(value);
    };
    const cancelHandler = () => {
      cleanup();
      resolve(null);
    };
    function cleanup() {
      customModal.style.display = "none";
      modalConfirmBtn.removeEventListener("click", confirmHandler);
      modalCancelBtn.removeEventListener("click", cancelHandler);
    }
    modalConfirmBtn.addEventListener("click", confirmHandler);
    modalCancelBtn.addEventListener("click", cancelHandler);
  });
}

function showCustomAlert(msg) {
  return new Promise((resolve) => {
    modalMessage.textContent = msg;
    modalInput.style.display = modalTextarea.style.display = modalCancelBtn.style.display = "none";
    modalConfirmBtn.textContent = "OK";
    customModal.style.display = "flex";

    modalConfirmBtn.onclick = () => {
      customModal.style.display = "none";
      modalConfirmBtn.textContent = "Confirmar";
      resolve();
    };
  });
}

// --- MENCÕES ---
let onlineUsersMap = {};
function parseMentions(text) {
  return text.replace(/@([\w]+)/g, (match, username) => {
    if (onlineUsersMap[username]) {
      return `<span class="mention">@${username}</span>`;
    }
    return match;
  });
}

function renderMessage(text) {
  let html = marked.parse(text || "");
  html = html.replace(/@([\w]{1,20})/g, (match, username) => {
    if (onlineUsersMap[username]) {
      return `<span class="mention">@${username}</span>`;
    }
    return match;
  });
  return html;
}

// --- AUTENTICAÇÃO ---
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const ban = await bannedRef.child(user.uid).once("value");
    if (ban.exists()) {
      await showCustomAlert("Você foi banido e será desconectado.");
      return auth.signOut();
    }
    loginBtn.style.display = "none";
    logoutBtn.style.display = deleteBtn.style.display = "inline-block";
    nameInput.style.display = "none";
    const snap = await namesRef.child(user.uid).once("value");
    let nick = snap.exists() ? snap.val() : null;
    if (!nick) {
      let tryName, exists;
      do {
        tryName = await showCustomPrompt("Escolha um nome único:", "text");
        exists = await namesRef.orderByValue().equalTo(tryName).once("value");
        if (!exists.exists()) break;
        await showCustomAlert("Nome já em uso, tente outro.");
      } while (true);
      nick = tryName;
      await namesRef.child(user.uid).set(nick);
    }
    userInfo.innerHTML = `👤 Logado como: <strong>${nick}</strong>`;
    onlineRef.child(user.uid).set(true);
    onlineRef.child(user.uid).onDisconnect().remove();
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = deleteBtn.style.display = "none";
    userInfo.textContent = "Faça login para comentar.";
    nameInput.style.display = "block";
  }
});

loginBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  auth.signInWithPopup(provider).catch((e) => showAlert("Erro login: " + e.message, true));
};

logoutBtn.onclick = () => {
  const user = auth.currentUser;
  if (user) {
    onlineRef.child(user.uid).remove();
    auth.signOut();
  }
};

deleteBtn.onclick = async () => {
  const user = auth.currentUser;
  if (!user || user.uid === ADMIN_UID) return showAlert("Operação não permitida", true);
  const confirma = await showCustomPrompt("Digite 'sim' para confirmar exclusão da conta:", "text");
  if (confirma !== "sim") return;
  try {
    const prov = new firebase.auth.GoogleAuthProvider();
    await user.reauthenticateWithPopup(prov);
    await commentsRef.orderByChild("uid").equalTo(user.uid).once("value", (snap) => snap.forEach((c) => c.ref.remove()));
    await namesRef.child(user.uid).remove();
    await onlineRef.child(user.uid).remove();
    await user.delete();
    showAlert("Conta apagada com sucesso");
  } catch (e) {
    showAlert("Erro ao apagar: " + e.message, true);
  }
};

// --- COMENTÁRIOS ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  let nome = nameInput.value.trim();
  if (user) nome = (await namesRef.child(user.uid).once("value")).val();
  if (!nome) return showAlert("Insira um nome.", true);

  const texto = messageInput.value.trim();
  if (!texto) return;

  const data = {
    uid: user ? user.uid : null,
    name: nome,
    message: texto,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    replyToId: replyToCommentId || null,
    replyToAuthor: replyToAuthorName || null
  };

  await commentsRef.push(data);
  messageInput.value = "";
  replyBox.style.display = "none";
  replyToCommentId = replyToAuthorName = null;
});

// --- CARREGAMENTO ---
commentsRef.on("value", async (snap) => {
  const user = auth.currentUser;
  const isAdmin = user && user.uid === ADMIN_UID;
  const comments = [];

  snap.forEach((child) => comments.push({ key: child.key, ...child.val() }));
  comments.sort((a, b) => a.timestamp - b.timestamp);

  commentsDiv.innerHTML = "";

  for (const c of comments) {
    const div = document.createElement("div");
    div.className = "comment";
    if (user && user.uid === c.uid) div.classList.add("own");
    if (c.uid === ADMIN_UID) div.classList.add("admin");

    const date = new Date(c.timestamp);
    const dataFormatada = `${date.toLocaleDateString()} - ${date.toLocaleTimeString().slice(0, 5)}`;

    let replyToHtml = "";
    if (c.replyToId && c.replyToAuthor) {
      const originalSnap = await commentsRef.child(c.replyToId).once("value");
      replyToHtml = originalSnap.exists()
        ? `<div class='comment-reply-block'><span class='reply-block-author'>${c.replyToAuthor}</span><span class='reply-block-message'>${originalSnap.val().message.slice(0, 80)}</span></div>`
        : `<div class='comment-reply-block comment-reply-deleted'><span class='reply-block-message'>[Mensagem apagada]</span></div>`;
    }

    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${c.name}</span>
        <span class="comment-timestamp">(${dataFormatada})</span>
      </div>
      ${replyToHtml}
      <div class="comment-message">${renderMessage(c.message)}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "comment-actions";

    const replyBtn = document.createElement("button");
    replyBtn.textContent = "Responder";
    replyBtn.onclick = () => {
      replyToCommentId = c.key;
      replyToAuthorName = c.name;
      replyMessageSpan.textContent = `Respondendo a ${c.name}`;
      replyBox.style.display = "flex";
    };
    actions.appendChild(replyBtn);

    if (user && user.uid === c.uid) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Editar";
      editBtn.onclick = async () => {
        const novoTexto = await showCustomPrompt("Editar mensagem:", "textarea", c.message);
        if (novoTexto) commentsRef.child(c.key).update({ message: novoTexto });
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "Apagar";
      delBtn.onclick = async () => {
        const conf = await showCustomPrompt("Digite 'sim' para apagar:", "text");
        if (conf === "sim") commentsRef.child(c.key).remove();
      };

      actions.append(editBtn, delBtn);
    }

    if (isAdmin && c.uid !== ADMIN_UID) {
      const banBtn = document.createElement("button");
      banBtn.textContent = "🚫 Banir";
      banBtn.onclick = async () => {
        const conf = await showCustomPrompt(`Banir ${c.name}? Digite 'sim':`, "text");
        if (conf === "sim") {
          bannedRef.child(c.uid).set(true);
          await commentsRef.orderByChild("uid").equalTo(c.uid).once("value", (snap) => snap.forEach((c) => c.ref.remove()));
          onlineRef.child(c.uid).remove();
          showAlert(`${c.name} foi banido.`);
        }
      };
      actions.appendChild(banBtn);
    }

    if (actions.children.length > 0) div.appendChild(actions);
    commentsDiv.appendChild(div);
  }
});

// --- ONLINE USERS ---
onlineRef.on("value", async (snap) => {
  const users = snap.val() || {};
  userCount.textContent = `👥 Usuários online: ${Object.keys(users).length}`;
  onlineUsersMap = {};
  await Promise.all(Object.keys(users).map(async (uid) => {
    const nameSnap = await namesRef.child(uid).once("value");
    if (nameSnap.exists()) onlineUsersMap[nameSnap.val()] = uid;
  }));
});

// --- AUTOCOMPLETE MENÇÕES ---
messageInput.addEventListener("input", () => {
  const cursorPos = messageInput.selectionStart;
  const text = messageInput.value.slice(0, cursorPos);
  const match = text.match(/@([\w]*)$/);

  if (match) {
    const prefix = match[1].toLowerCase();
    const suggestions = Object.keys(onlineUsersMap).filter((n) => n.toLowerCase().startsWith(prefix));
    if (!suggestions.length) return (mentionBox.style.display = "none");
    mentionBox.innerHTML = suggestions.map((n) => `<li>${n}</li>`).join("");
    const rect = messageInput.getBoundingClientRect();
    mentionBox.style.top = `${rect.bottom + window.scrollY}px`;
    mentionBox.style.left = `${rect.left + window.scrollX}px`;
    mentionBox.style.width = `${rect.width}px`;
    mentionBox.style.display = "block";

    Array.from(mentionBox.children).forEach((li) => {
      li.onclick = () => {
        messageInput.value =
          messageInput.value.slice(0, cursorPos - match[1].length - 1) +
          `@${li.textContent} ` +
          messageInput.value.slice(cursorPos);
        messageInput.focus();
        mentionBox.style.display = "none";
      };
    });
  } else {
    mentionBox.style.display = "none";
  }
});

document.addEventListener("click", (e) => {
  if (!mentionBox.contains(e.target)) {
    mentionBox.style.display = "none";
  }
});
    
