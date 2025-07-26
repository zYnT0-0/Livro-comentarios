// Firebase Config
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
const commentsRef = db.ref("comentarios");
const namesRef = db.ref("nomesUsados");
const onlineRef = db.ref("logados");
const bannedRef = db.ref("banidos");

const ADMIN_UID = "mIsJ6CcuSQdk8VkWayuekdMcn7L2";
const ADMIN_ICON_URL = 'adm-icon.png';

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const deleteBtn = document.getElementById("delete-account");
const userInfo = document.getElementById("user-info");
const userCount = document.getElementById("user-count");
const form = document.getElementById("comment-form");
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const commentsDiv = document.getElementById("comments");
const alertBox = document.getElementById("alert-box");

// Modal Elements
const customModal = document.getElementById("custom-modal");
const modalMessage = document.getElementById("modal-message");
const modalInput = document.getElementById("modal-input");
const modalTextarea = document.getElementById("modal-textarea");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// Reply Elements
const replyBox = document.getElementById("reply-box");
const replyMessageSpan = replyBox.querySelector(".reply-message");
const cancelReplyBtn = replyBox.querySelector(".cancel-reply-btn");

let replyToCommentId = null;
let replyToAuthorName = null;
let allUsersMap = {};
let currentLoggedInUserUid = null;
let currentLoggedInUserName = null;

// Theme Handling
const themeToggle = document.getElementById("theme-toggle");
const body = document.body;

function applyTheme(theme) {
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        if (themeToggle) themeToggle.textContent = 'Tema Claro';
    } else {
        body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        if (themeToggle) themeToggle.textContent = 'Tema Escuro';
    }
}
const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        if (body.classList.contains('dark-mode')) {
            applyTheme('light');
        } else {
            applyTheme('dark');
        }
    });
}

function showAlert(msg, isError = false) {
    alertBox.textContent = msg;
    alertBox.style.display = "block";
    alertBox.classList.toggle("error-alert", isError);
    setTimeout(() => alertBox.style.display = "none", 4000);
}

function showCustomPrompt(message, type = 'text', defaultValue = '') {
    return new Promise(resolve => {
        modalMessage.textContent = message;
        modalInput.style.display = 'none';
        modalTextarea.style.display = 'none';
        modalConfirmBtn.style.display = 'inline-block';
        modalCancelBtn.style.display = 'inline-block';

        if (type === 'text') {
            modalInput.value = defaultValue;
            modalInput.style.display = 'block';
            modalInput.focus();
        } else if (type === 'textarea') {
            modalTextarea.value = defaultValue;
            modalTextarea.style.display = 'block';
            modalTextarea.focus();
        }

        customModal.style.display = 'flex';

        const confirmHandler = () => {
            const value = type === 'text' ? modalInput.value : modalTextarea.value;
            customModal.style.display = 'none';
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            resolve(value);
        };

        const cancelHandler = () => {
            customModal.style.display = 'none';
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            resolve(null);
        };

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
    });
}

function showCustomAlert(message) {
    return new Promise(resolve => {
        modalMessage.textContent = message;
        modalInput.style.display = 'none';
        modalTextarea.style.display = 'none';
        modalCancelBtn.style.display = 'none';
        modalConfirmBtn.textContent = 'Ok';
        customModal.style.display = 'flex';

        const confirmHandler = () => {
            customModal.style.display = 'none';
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalConfirmBtn.textContent = 'Confirmar';
            resolve();
        };
        modalConfirmBtn.addEventListener('click', confirmHandler);
    });
}

// 🔄 Reload ao voltar para o site após 2 minutos
window.addEventListener("focus", () => {
    const lastVisit = sessionStorage.getItem("lastVisit");
    const now = Date.now();
    if (!lastVisit || now - lastVisit > 60 * 1000) location.reload();
    sessionStorage.setItem("lastVisit", now);
});

// New functions for reply
function startReply(commentId, authorName) {
    replyToCommentId = commentId;
    replyToAuthorName = authorName;
    replyMessageSpan.textContent = `Respondendo a ${authorName}`;
    replyBox.style.display = 'flex';
    messageInput.focus();
}

function cancelReply() {
    replyToCommentId = null;
    replyToAuthorName = null;
    replyBox.style.display = 'none';
    replyMessageSpan.textContent = '';
}

// Event listener for cancel reply button
cancelReplyBtn.addEventListener('click', cancelReply);

// Troca botão de registro/login
loginBtn.textContent = "Registrar";
loginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    auth.signInWithPopup(provider)
        .then(() => {
            window.location.reload(); // 🔁 Recarrega após login
        })
        .catch(error => {
            if (error.code === 'auth/popup-blocked') {
                window.parent.postMessage('auth/popup-blocked', '*');
            }

            showAlert(`Erro ao fazer login: ${error.message}`, true);
        });
});

logoutBtn.addEventListener("click", () => {
    const user = auth.currentUser;
    if (user) {
        onlineRef.child(user.uid).remove(); // Remove o status online
        auth.signOut().then(() => {
            location.reload(); // Recarrega a página após o logout
        }).catch(error => {
            showAlert(`Erro ao sair: ${error.message}`, true);
        });
    }
});

deleteBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
        showAlert("Nenhum usuário logado para apagar.", true);
        return;
    }
    // Impedir que o ADMIN_UID apague a própria conta pelo botão
    if (user.uid === ADMIN_UID) {
        showAlert("Não é possível apagar a conta de administrador através desta opção.", true);
        return;
    }

    const confirmDelete = await showCustomPrompt("Tem certeza que deseja apagar sua conta? Esta ação é irreversível.", "text", "sim");
    if (confirmDelete !== "sim") {
        showAlert("Operação cancelada.", true);
        return;
    }

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await user.reauthenticateWithPopup(provider);

        await commentsRef.orderByChild("uid").equalTo(user.uid).once("value", snapshot => {
            snapshot.forEach(child => child.ref.remove());
        });
        await namesRef.child(user.uid).remove();
        await onlineRef.child(user.uid).remove();

        await user.delete();

        showAlert("Conta apagada com sucesso. Você foi desconectado.");
        location.reload(); // Recarrega a página após apagar a conta
    } catch (error) {
        console.error("Erro ao apagar conta:", error);
        if (error.code === 'auth/requires-recent-login') {
            await showCustomAlert("Por favor, faça login novamente para apagar sua conta. (Requerido para operações de segurança)");
        } else if (error.code === 'auth/popup-closed-by-user') {
            showAlert("Reautenticação cancelada pelo usuário. Conta não apagada.", true);
        } else if (error.code === 'auth/cancelled-popup-request') {
            showAlert("Reautenticação cancelada: janela de pop-up já aberta ou bloqueada. Tente novamente.", true);
        } else {
            showAlert(`Erro ao apagar conta: ${error.message}`, true);
        }
    }
});

// Listener principal de autenticação
auth.onAuthStateChanged(async user => {
    currentLoggedInUserUid = user ? user.uid : null;
    currentLoggedInUserName = null; // Resetar nome

    if (user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        deleteBtn.style.display = "inline-block";
        nameInput.style.display = "none"; // Hide name input if logged in

        const ban = await bannedRef.child(user.uid).once("value");
        if (ban.exists()) {
            await showCustomAlert("Você foi banido e será desconectado.");
            auth.signOut(); // Desconecta o usuário banido
            return;
        }

        const nameSnap = await namesRef.child(user.uid).once("value");
        let nick;

        if (!nameSnap.exists()) {
            let tryName;
            let nameExists = true;
            while (nameExists) {
                tryName = await showCustomPrompt("Escolha um nome único:", "text");
                if (!tryName) {
                    auth.signOut(); // Se o usuário cancelar a escolha do nome, desloga
                    return;
                }
                const exists = await namesRef.orderByValue().equalTo(tryName).once("value");
                if (exists.exists()) {
                    await showCustomAlert("Nome já está em uso. Por favor, escolha outro.");
                } else {
                    nameExists = false;
                }
            }
            await namesRef.child(user.uid).set(tryName);
            nick = tryName;
            location.reload(); // Recarrega a página após registrar um novo nome
        } else {
            nick = nameSnap.val();
        }

        currentLoggedInUserName = nick; // Armazena o nome do usuário logado
        userInfo.innerHTML = `👤 Logado como: <strong>${nick}</strong>`;
        onlineRef.child(user.uid).set(true);
        onlineRef.child(user.uid).onDisconnect().remove();

    } else {
        loginBtn.textContent = "Registrar ou Fazer Login";
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        deleteBtn.style.display = "none";
        userInfo.innerHTML = "Faça login para comentar.";
        nameInput.style.display = "inline-block"; // Show name input if not logged in
    }

    renderAllComments();
});




form.addEventListener("submit", async e => {
    e.preventDefault();
    const user = auth.currentUser;
    let userName = nameInput.value.trim();

    if (!user && !userName) {
        showAlert("Por favor, forneça seu nome ou faça login para comentar.", true);
        return;
    }

    if (user) {
        const nickSnap = await namesRef.child(user.uid).once("value");
        userName = nickSnap.exists() ? nickSnap.val() : "Anônimo";
    }

    const text = messageInput.value.trim();
    if (!text) return;

    const commentData = {
        uid: user ? user.uid : null,
        name: userName,
        message: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    if (replyToCommentId && replyToAuthorName) {
        commentData.replyToId = replyToCommentId;
        commentData.replyToAuthor = replyToAuthorName;
    }

    try {
        await commentsRef.push(commentData);
        messageInput.value = "";
        cancelReply(); // Limpa o modo de resposta após enviar
        window.location.reload(); // 🔁 Reload após envio da mensagem // Limpa o modo de resposta após enviar
    } catch (error) {
        showAlert(`Erro ao enviar comentário: ${error.message}`, true);
    }
});

// Listener de comentários
commentsRef.on("value", async snapshot => {
    commentsDiv.innerHTML = "";
    const commentsArray = [];
    snapshot.forEach(child => {
        commentsArray.push({ key: child.key, ...child.val() });
    });

    commentsArray.sort((a, b) => a.timestamp - b.timestamp);

    // Using Promise.all to fetch original comments in parallel for performance
    const commentsWithReplyData = await Promise.all(commentsArray.map(async (c) => {
        let replyToHtml = '';
        let originalCommentAuthorUid = null; // Para verificar se o usuário logado foi o autor da mensagem original

        if (c.replyToId && c.replyToAuthor) {
            const originalCommentSnap = await commentsRef.child(c.replyToId).once("value");
            if (originalCommentSnap.exists()) {
                const originalComment = originalCommentSnap.val();
                originalCommentAuthorUid = originalComment.uid; // Pega o UID do autor da mensagem original
                // Take first 80 characters of the original message for snippet
                const originalMessageSnippet = originalComment.message.substring(0, 80) + (originalComment.message.length > 80 ? '...' : '');
                replyToHtml = `
                    <div class="comment-reply-block">
                        <span class="reply-block-author">${originalComment.name}</span>
                        <span class="reply-block-message">${originalMessageSnippet}</span>
                    </div>
                `;
            } else {
                replyToHtml = `
                    <div class="comment-reply-block comment-reply-deleted">
                        <span class="reply-block-message">[Mensagem original apagada]</span>
                    </div>
                `;
            }
        }
        return { ...c, replyToHtml: replyToHtml, originalCommentAuthorUid: originalCommentAuthorUid };
    }));

    // Renderiza cada comentário. Agora, passando o UID do usuário logado para renderMessage.
    for (const c of commentsWithReplyData) {
        const div = document.createElement("div");
        div.className = "comment";

        // NOVO: Adiciona classe para destaque de resposta *se for para o usuário logado*
        if (currentLoggedInUserUid && c.replyToId && c.originalCommentAuthorUid === currentLoggedInUserUid) {
            div.classList.add("is-reply-to-me");
        }

        if (currentLoggedInUserUid && currentLoggedInUserUid === c.uid) { // Usar currentLoggedInUserUid
            div.classList.add("own");
        }
        if (c.uid === ADMIN_UID) {
            div.classList.add("admin");
        }

        const date = new Date(c.timestamp);
        const dataFormatada = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} - ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

        // Lógica para adicionar o ícone do admin
        let adminIconHtml = '';
        if (c.uid === ADMIN_UID) {
            adminIconHtml = `<img src="${ADMIN_ICON_URL}" alt="Admin" class="admin-icon" title="Administrador">`;
        }

        div.innerHTML = `
            <div class="comment-header">
                ${adminIconHtml} <span class="comment-author">${c.name}</span>
                <span class="comment-timestamp">(${dataFormatada})</span>
            </div>
            ${c.replyToHtml} <div class="comment-message">${renderMessage(c.message, c.uid, currentLoggedInUserUid)}</div>
        `;

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "comment-actions";

        const replyBtn = document.createElement("button");
        replyBtn.textContent = "Responder";
        replyBtn.onclick = () => {
            startReply(c.key, c.name); // Use c.key (comment ID) and c.name for reply
        };
        actionsDiv.append(replyBtn);

        if (currentLoggedInUserUid && currentLoggedInUserUid === c.uid) { // Usar currentLoggedInUserUid
            const editBtn = document.createElement("button");
            editBtn.textContent = "Editar";
            editBtn.onclick = async () => {
                const novoTexto = await showCustomPrompt("Edite sua mensagem:", "textarea", c.message);
                if (novoTexto !== null) {
                    if (novoTexto.trim() !== "") {
                        commentsRef.child(c.key).update({ message: novoTexto });
                    } else {
                        showAlert("Mensagem não pode ser vazia.", true);
                    }
                }
            };

            const deleteOwnBtn = document.createElement("button");
            deleteOwnBtn.textContent = "Apagar Mensagem";
            deleteOwnBtn.onclick = async () => {
                const confirmDelete = await showCustomPrompt("Tem certeza que deseja apagar esta mensagem?", "text", "sim");
                if (confirmDelete === "sim") {
                    commentsRef.child(c.key).remove();
                    showAlert("Mensagem apagada.");
                } else {
                    showAlert("Operação cancelada.", true);
                }
            };
            actionsDiv.append(editBtn, deleteOwnBtn);
        }

        // Ação de admin para banir/apagar (apenas se o admin estiver logado e não for o próprio admin)
        if (currentLoggedInUserUid === ADMIN_UID && c.uid !== ADMIN_UID) {
            const adminBox = document.createElement("div");
            adminBox.className = "admin-buttons";

            const del = document.createElement("button");
            del.textContent = "🗑️ Apagar";
            del.onclick = async () => {
                const confirmDel = await showCustomPrompt("Tem certeza que deseja apagar esta mensagem?", "text", "sim");
                if (confirmDel === "sim") {
                    commentsRef.child(c.key).remove();
                    showAlert("Mensagem apagada pelo admin.");
                } else {
                    showAlert("Operação cancelada.", true);
                }
            };

            const ban = document.createElement("button");
            ban.textContent = "🚫 Banir Usuário";
            ban.onclick = async () => {
                const confirmBan = await showCustomPrompt(`Tem certeza que deseja banir ${c.name}? Isso também apagará os comentários dele.`, "text", "sim");
                if (confirmBan === "sim") {
                    bannedRef.child(c.uid).set(true);
                    await showCustomAlert(`${c.name} foi banido.`);
                    await commentsRef.orderByChild("uid").equalTo(c.uid).once("value", snapshot => {
                        snapshot.forEach(child => child.ref.remove());
                    });
                    onlineRef.child(c.uid).remove();
                } else {
                    showAlert("Operação cancelada.", true);
                }
            };
            // Note: Você tinha duas vezes os botões editBtn e deleteOwnBtn sendo adicionados aqui.
            // Removi a duplicação e adicionei apenas os botões de admin.
            adminBox.append(del, ban);
            actionsDiv.appendChild(adminBox);
        }

        if (actionsDiv.children.length > 0) {
            div.appendChild(actionsDiv);
        }

        commentsDiv.appendChild(div);
    }
});

// Carrega todos os nomes registrados no sistema (mantido para compatibilidade, mesmo sem menções ativas)
namesRef.on("value", async snap => {
    allUsersMap = {}; // Resetar mapa para garantir que esteja atualizado

    snap.forEach(child => {
        const uid = child.key;
        const name = child.val();
        allUsersMap[name.toLowerCase()] = { name: name, uid: uid };
    });

    renderAllComments();
});

function renderAllComments() {
    commentsRef.once("value");
}

// Função para aplicar markdown (menções removidas)
function renderMessage(text, authorUid, currentLoggedInUserUid) {
    if (!text) return "";
    let html = marked.parse(text);
    return html;
}

const mentionBox = document.getElementById("mention-suggestions");

// Removendo listener de menções se ele não for mais usado
if (messageInput && mentionBox) { // Adicionado verificação para garantir que os elementos existem
    messageInput.addEventListener("input", async (e) => {
        // Lógica de sugestão de menções removida para focar na solicitação do usuário
        // Oculta a caixa de sugestões
        mentionBox.style.display = "none";
    });

    document.addEventListener("click", (e) => {
        if (!mentionBox.contains(e.target)) {
            mentionBox.style.display = "none";
        }
    });
}
// 🔄 Reload automático ao voltar para a aba após mais de 2 minutos fora
window.addEventListener("focus", () => {
    const lastVisit = sessionStorage.getItem("lastVisit");
    const now = Date.now();

    if (!lastVisit || now - lastVisit > 2 * 60 * 1000) {
        location.reload();
    }

    sessionStorage.setItem("lastVisit", now);
});
                
