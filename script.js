// Firebase init
const firebaseConfig = {
  apiKey: "AIzaSyCmEEx1Z_QK7MblQnrezw5S7CXo1uzcCy4",
  authDomain: "comentarios-livro.firebaseapp.com",
  databaseURL: "https://comentarios-livro-default-rtdb.firebaseio.com",
  projectId: "comentarios-livro",
  storageBucket: "comentarios-livro.firebasestorage.app",
  messagingSenderId: "702096545512",
  appId: "1:702096545512:web:f7f305f0e579d246c41b5d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

const commentsRef = db.ref("comentarios");
const namesRef = db.ref("nomesUsados");
const onlineRef = db.ref("logados");
const bannedRef = db.ref("banidos");

const ADMIN_UID = "RTJkscPxu9MjMFL4RZSaILntfM13";

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const deleteBtn = document.getElementById("delete-account");
const userInfo = document.getElementById("user-info");
const userCount = document.getElementById("user-count");
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const commentsDiv = document.getElementById("comments");
const form = document.getElementById("comment-form");
const alertBox = document.getElementById("alert-box");

const modal = document.getElementById("custom-modal");
const modalMessage = document.getElementById("modal-message");
const modalInput = document.getElementById("modal-input");
const modalTextarea = document.getElementById("modal-textarea");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

let replyTo = null;

function showAlert(msg, isError = false) {
  alertBox.textContent = msg;
  alertBox.style.display = "block";
  alertBox.className = isError ? "error-alert" : "";
  setTimeout(() => alertBox.style.display = "none", 4000);
}

function showCustomPrompt(message, type = "text", defaultValue = "") {
  return new Promise(resolve => {
    modal.style.display = "flex";
    modalMessage.textContent = message;
    modalInput.style.display = "none";
    modalTextarea.style.display = "none";
    modalCancelBtn.style.display = "inline-block";

    if (type === "text") {
      modalInput.style.display = "block";
      modalInput.value = defaultValue;
      modalInput.focus();
    } else if (type === "textarea") {
      modalTextarea.style.display = "block";
      modalTextarea.value = defaultValue;
      modalTextarea.focus();
    }

    const confirmHandler = () => {
      modal.style.display = "none";
      modalConfirmBtn.removeEventListener("click", confirmHandler);
      modalCancelBtn.removeEventListener("click", cancelHandler);
      resolve(type === "text" ? modalInput.value : modalTextarea.value);
    };

    const cancelHandler = () => {
      modal.style.display = "none";
      modalConfirmBtn.removeEventListener("click", confirmHandler);
      modalCancelBtn.removeEventListener("click", cancelHandler);
      resolve(null);
    };

    modalConfirmBtn.addEventListener("click", confirmHandler);
    modalCancelBtn.addEventListener("click", cancelHandler);
  });
}

function showCustomAlert(msg) {
  return new Promise(resolve => {
    modal.style.display = "flex";
    modalMessage.textContent = msg;
    modalInput.style.display = "none";
    modalTextarea.style.display = "none";
    modalCancelBtn.style.display = "none";
    modalConfirmBtn.textContent = "OK";
    const handler = () => {
      modal.style.display = "none";
      modalConfirmBtn.removeEventListener("click", handler);
      modalConfirmBtn.textContent = "Confirmar";
      resolve();
    };
    modalConfirmBtn.addEventListener("click", handler);
  });
}

loginBtn.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  auth.signInWithPopup(provider);
});

logoutBtn.addEventListener("click", () => {
  const user = auth.currentUser;
  if (user) {
    onlineRef.child(user.uid).remove();
    auth.signOut().then(() => location.reload());
  }
});

deleteBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || user.uid === ADMIN_UID) return showAlert("Admin n\u00e3o pode apagar conta", true);
  const conf = await showCustomPrompt("Digite 'sim' para confirmar exclus\u00e3o", "text");
  if (conf !== "sim") return;
  const provider = new firebase.auth.GoogleAuthProvider();
  await user.reauthenticateWithPopup(provider);
  await commentsRef.orderByChild("uid").equalTo(user.uid).once("value", snap => snap.forEach(c => c.ref.remove()));
  await namesRef.child(user.uid).remove();
  await onlineRef.child(user.uid).remove();
  await user.delete();
  location.reload();
});

auth.onAuthStateChanged(async user => {
  if (user) {
    const banned = await bannedRef.child(user.uid).once("value");
    if (banned.exists()) {
      await showCustomAlert("Voc\u00ea foi banido.");
      return auth.signOut();
    }

    const nameSnap = await namesRef.child(user.uid).once("value");
    let nome = nameSnap.val();

    if (!nome) {
      while (true) {
        const tentativa = await showCustomPrompt("Escolha um nome \u00fanico:", "text");
        if (!tentativa) return auth.signOut();
        const exists = await namesRef.orderByValue().equalTo(tentativa).once("value");
        if (!exists.exists()) {
          await namesRef.child(user.uid).set(tentativa);
          nome = tentativa;
          break;
        }
        await showCustomAlert("Nome j\u00e1 em uso. Tente outro.");
      }
    }

    nameInput.style.display = "none";
    userInfo.innerHTML = `\ud83d\udc64 Logado como: <strong>${nome}</strong>`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    deleteBtn.style.display = "inline-block";
    onlineRef.child(user.uid).set(true);
    onlineRef.child(user.uid).onDisconnect().remove();
  } else {
    nameInput.style.display = "inline-block";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    deleteBtn.style.display = "none";
    userInfo.innerHTML = "Fa\u00e7a login para comentar.";
  }
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return showAlert("Fa\u00e7a login para comentar.", true);

  const msg = messageInput.value.trim();
  if (!msg) return;

  const nameSnap = await namesRef.child(user.uid).once("value");
  const nome = nameSnap.val() || "An\u00f4nimo";

  const comment = {
    uid: user.uid,
    name: nome,
    message: msg,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  if (replyTo) {
    comment.replyTo = replyTo;
    replyTo = null;
  }

  await commentsRef.push(comment);
  messageInput.value = "";
});

commentsRef.on("value", async snapshot => {
  commentsDiv.innerHTML = "";
  const user = auth.currentUser;
  const isAdmin = user && user.uid === ADMIN_UID;
  const data = [];

  snapshot.forEach(c => data.push({ key: c.key, ...c.val() }));
  data.sort((a, b) => a.timestamp - b.timestamp);

  for (const c of data) {
    const div = document.createElement("div");
    div.className = "comment";
    if (user?.uid === c.uid) div.classList.add("own");
    if (c.uid === ADMIN_UID) div.classList.add("admin");

    const date = new Date(c.timestamp);
    const hora = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth()+1).padStart(2, '0')}/${date.getFullYear()} - ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    const messageContent = document.createElement("div");
    messageContent.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${c.name}</span>
        <span class="comment-timestamp">(${hora})</span>
      </div>
      ${c.replyTo ? `<div style="margin-bottom:5px; padding: 6px; background: #2a2d31; border-left: 3px solid var(--accent); white-space: pre-wrap;"><em>${c.replyTo.name}:</em> ${c.replyTo.message}</div>` : ""}
      <div class="comment-message">${c.message}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "comment-actions";

    if (user) {
      const replyBtn = document.createElement("button");
      replyBtn.textContent = "Responder";
      replyBtn.onclick = () => {
        replyTo = { name: c.name, message: c.message };
        messageInput.focus();
        showAlert(`Respondendo a ${c.name}`);
      };
      actions.append(replyBtn);
    }

    if (user?.uid === c.uid) {
      const edit = document.createElement("button");
      edit.textContent = "Editar";
      edit.onclick = async () => {
        const novo = await showCustomPrompt("Edite:", "textarea", c.message);
        if (novo) commentsRef.child(c.key).update({ message: novo });
      };
      const apagar = document.createElement("button");
      apagar.textContent = "Apagar";
      apagar.onclick = async () => {
        const conf = await showCustomPrompt("Digite 'sim' para apagar:", "text");
        if (conf === "sim") commentsRef.child(c.key).remove();
      };
      actions.append(edit, apagar);
    }

    if (isAdmin && c.uid !== ADMIN_UID) {
      const del = document.createElement("button");
      del.textContent = "\ud83d\uddd1\ufe0f Apagar";
      del.onclick = () => commentsRef.child(c.key).remove();

      const ban = document.createElement("button");
      ban.textContent = "\ud83d\udeab Banir";
      ban.onclick = async () => {
        await bannedRef.child(c.uid).set(true);
        commentsRef.orderByChild("uid").equalTo(c.uid).once("value", snap => snap.forEach(ch => ch.ref.remove()));
        onlineRef.child(c.uid).remove();
        showAlert(`${c.name} foi banido.`);
      };
      const adminBox = document.createElement("div");
      adminBox.className = "admin-buttons";
      adminBox.append(del, ban);
      actions.append(adminBox);
    }

    div.append(messageContent, actions);
    commentsDiv.appendChild(div);
  }
});

onlineRef.on("value", snap => {
  userCount.textContent = `\ud83d\udc65 Usu\u00e1rios online: ${snap.numChildren()}`;
});
 
