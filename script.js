// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCmEEx1Z_QK7MblQnrezw5S7CXo1uzcCy4", // SUA CHAVE DE API
    authDomain: "comentarios-livro.firebaseapp.com", // SEU DOMÍNIO DE AUTENTICAÇÃO
    databaseURL: "https://comentarios-livro-default-rtdb.firebaseio.com", // SUA URL DO BANCO DE DADOS
    projectId: "comentarios-livro", // SEU ID DO PROJETO
    storageBucket: "comentarios-livro.appspot.com", // SEU BUCKET DE ARMAZENAMENTO
    messagingSenderId: "702096545512", // SEU ID DO REMETENTE
    appId: "1:702096545512:web:f7f305fe579d246c41b5d" // SEU ID DO APLICATIVO
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();
const commentsRef = database.ref('comments'); // Alterado de "comentarios" para "comments" para consistência
const usersRef = database.ref('users');
const bannedUsersRef = database.ref('bannedUsers');

// Referências do DOM
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const deleteAccountBtn = document.getElementById('delete-account');
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const commentForm = document.getElementById('comment-form');
const commentsDiv = document.getElementById('comments');
const userInfoP = document.getElementById('user-info');
const userCountP = document.getElementById('user-count');
const themeToggleBtn = document.getElementById('theme-toggle');
const replyBox = document.getElementById('reply-box');
const replyMessageSpan = replyBox.querySelector('.reply-message');
const cancelReplyBtn = replyBox.querySelector('.cancel-reply-btn');
const mentionSuggestionsUl = document.getElementById('mention-suggestions');

// Modal Personalizado
const customModal = document.getElementById('custom-modal');
const modalMessage = document.getElementById('modal-message');
const modalInput = document.getElementById('modal-input');
const modalTextarea = document.getElementById('modal-textarea');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// Alerta Personalizado
const alertBox = document.getElementById('alert-box');

// Variáveis globais
let currentUser = null;
let currentUserName = "Anônimo";
let isAdmin = false;
let replyingToCommentId = null; // Para armazenar o ID do comentário ao qual estamos respondendo
const ADMIN_UIDS = ["mIsJ6CcuSQdk8VkWayuekdMcn7L2"]; // SEU UID DO ADMINISTRADOR
const ADMIN_ICON_URL = 'adm-icon.png'; // Caminho para a imagem do ícone de administrador

// Função para mostrar alerta personalizado
function showAlert(message, isError = false) {
    alertBox.textContent = message;
    alertBox.classList.remove('error-alert');
    if (isError) {
        alertBox.classList.add('error-alert');
    }
    alertBox.style.display = 'block';
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 5000);
}

// Função para formatar timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Função para exibir o modal personalizado
function showCustomModal(message, showInput = false, inputType = 'text', confirmText = 'Confirmar', cancelText = 'Cancelar', prefill = '', isTextarea = false) {
    return new Promise(resolve => {
        modalMessage.textContent = message;
        modalInput.style.display = 'none';
        modalTextarea.style.display = 'none';
        modalInput.value = '';
        modalTextarea.value = '';
        modalCancelBtn.style.display = 'none'; // Esconde por padrão

        if (showInput) {
            if (isTextarea) {
                modalTextarea.style.display = 'block';
                modalTextarea.value = prefill;
            } else {
                modalInput.style.display = 'block';
                modalInput.type = inputType;
                modalInput.value = prefill;
            }
            modalCancelBtn.style.display = 'inline-block'; // Mostra botão cancelar para inputs
        }

        modalConfirmBtn.textContent = confirmText;
        modalCancelBtn.textContent = cancelText;

        customModal.style.display = 'flex';

        const confirmHandler = () => {
            customModal.style.display = 'none';
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            resolve(showInput ? (isTextarea ? modalTextarea.value : modalInput.value) : true);
        };

        const cancelHandler = () => {
            customModal.style.display = 'none';
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            resolve(false); // Retorna falso se cancelar
        };

        modalConfirmBtn.addEventListener('click', confirmHandler);
        modalCancelBtn.addEventListener('click', cancelHandler);
    });
}

// Função para alternar o tema (escuro/claro)
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    // Salvar preferência no localStorage
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

// Carregar preferência de tema ao iniciar
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || !savedTheme) { // Padrão é tema escuro
    document.body.classList.add('dark-mode');
} else {
    document.body.classList.remove('dark-mode');
}

themeToggleBtn.addEventListener('click', toggleTheme);

// Função para processar markdown
function processMarkdown(text) {
    return marked.parse(text);
}

// Função para renderizar um único comentário
async function renderComment(commentData, commentId) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    commentDiv.dataset.id = commentId; // Adiciona o ID do comentário ao dataset

    let authorName = commentData.userName || "Anônimo";
    let authorUid = commentData.userId;
    let isOwnComment = (currentUser && currentUser.uid === authorUid);
    let isAdminComment = ADMIN_UIDS.includes(authorUid);

    // Verifica se o comentário atual é uma resposta a um comentário do usuário logado
    let isReplyToMe = false;
    if (currentUser && commentData.replyTo && commentData.replyTo.commentId) {
        const originalCommentSnapshot = await database.ref(`comments/${commentData.replyTo.commentId}`).once('value');
        const originalComment = originalCommentSnapshot.val();
        if (originalComment && originalComment.userId === currentUser.uid) {
            isReplyToMe = true;
        }
    }
    if (isReplyToMe) {
        commentDiv.classList.add('is-reply-to-me');
    }

    if (isOwnComment) {
        commentDiv.classList.add('own');
    }
    if (isAdminComment) {
        commentDiv.classList.add('admin');
    }

    let replyBlockHtml = '';
    if (commentData.replyTo && commentData.replyTo.commentId) {
        const originalCommentSnapshot = await database.ref(`comments/${commentData.replyTo.commentId}`).once('value');
        const originalComment = originalCommentSnapshot.val();

        let replyAuthor = originalComment ? (originalComment.userName || "Anônimo") : "Comentário excluído";
        let replyMessageSnippet = originalComment ? (originalComment.message ? originalComment.message.substring(0, 50) + (originalComment.message.length > 50 ? '...' : '') : 'Mensagem sem conteúdo') : "Mensagem excluída";
        let deletedClass = originalComment ? '' : ' comment-reply-deleted';

        replyBlockHtml = `
            <div class="comment-reply-block${deletedClass}">
                <span class="reply-block-author">${replyAuthor}</span>
                <span class="reply-block-message">${replyMessageSnippet}</span>
            </div>
        `;
    }

    commentDiv.innerHTML = `
        ${replyBlockHtml}
        <div class="comment-header">
            ${isAdminComment ? `<img src="${ADMIN_ICON_URL}" alt="Admin Icon" class="admin-icon">` : ''}
            <span class="comment-author">${authorName}</span>
            <span class="comment-timestamp">${formatTimestamp(commentData.timestamp)}</span>
        </div>
        <div class="comment-message">${processMarkdown(commentData.message)}</div>
        <div class="comment-actions">
            <button class="reply-btn">Responder</button>
            ${isOwnComment || isAdmin ? `<button class="edit-btn">Editar</button>` : ''}
            ${isOwnComment || isAdmin ? `<button class="delete-btn">Apagar</button>` : ''}
            ${isAdmin && !isOwnComment ? `<button class="ban-btn">Banir</button>` : ''}
        </div>
    `;

    // Adicionar listeners para os botões dentro do comentário
    if (commentDiv.querySelector('.reply-btn')) {
        commentDiv.querySelector('.reply-btn').addEventListener('click', () => startReply(commentId, authorName, commentData.message));
    }
    if (commentDiv.querySelector('.edit-btn')) {
        commentDiv.querySelector('.edit-btn').addEventListener('click', () => editComment(commentId, commentData.message));
    }
    if (commentDiv.querySelector('.delete-btn')) {
        commentDiv.querySelector('.delete-btn').addEventListener('click', () => deleteComment(commentId, authorUid));
    }
    if (commentDiv.querySelector('.ban-btn')) {
        commentDiv.querySelector('.ban-btn').addEventListener('click', () => banUser(authorUid, authorName));
    }

    return commentDiv;
}

// Função centralizada para carregar e exibir comentários
async function loadAndDisplayComments() {
    // Adiciona o listener on("value") para real-time updates
    commentsRef.on("value", async snapshot => {
        commentsDiv.innerHTML = ""; // Limpa os comentários existentes

        const comments = [];
        snapshot.forEach(childSnapshot => {
            comments.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });

        // Ordena os comentários do mais antigo para o mais novo para renderização inicial
        // (Será exibido do mais novo para o mais antigo devido ao flex-direction-reverse no CSS)
        comments.sort((a, b) => a.timestamp - b.timestamp);

        for (const commentData of comments) {
            const commentElement = await renderComment(commentData, commentData.id);
            commentsDiv.appendChild(commentElement); // Adiciona ao final (será invertido pelo CSS)
        }
    });
}


// Gerenciamento de Autenticação
auth.onAuthStateChanged(async user => {
    currentUser = user;
    // Carregar informações do usuário logado
    if (user) {
        const userSnapshot = await usersRef.child(user.uid).once('value');
        const userData = userSnapshot.val();

        if (userData && userData.isBanned) {
            showAlert("Sua conta foi banida. Você não pode fazer login.", true);
            auth.signOut(); // Desloga o usuário banido
            return;
        }

        currentUserName = userData ? userData.name : user.email;
        nameInput.style.display = 'none';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        deleteAccountBtn.style.display = 'inline-block';
        isAdmin = ADMIN_UIDS.includes(user.uid);
        userInfoP.textContent = `Logado como: ${currentUserName}${isAdmin ? ' (Admin)' : ''}`;

        // NOVO: Recarregar comentários ao fazer login (para garantir permissões)
        loadAndDisplayComments(); 

    } else {
        currentUser = null;
        currentUserName = "Anônimo";
        isAdmin = false;
        nameInput.style.display = 'block';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        deleteAccountBtn.style.display = 'none';
        userInfoP.textContent = "Não logado";
        
        // NOVO: Recarregar comentários ao fazer logout (para garantir permissões como anônimo)
        loadAndDisplayComments();
    }
    updateUserCount();
});

// Registrar/Login (usando o mesmo botão)
loginBtn.addEventListener('click', async () => {
    const action = await showCustomModal('Deseja Registrar ou Fazer Login?', true, 'email', 'Próximo', 'Cancelar', '', false);
    if (!action) return;
    const email = action;
    if (!email) {
        showAlert('Email não pode ser vazio.', true);
        return;
    }

    const mode = await showCustomModal('Este email já está registrado? (SIM = Login, NÃO = Registrar)', false, 'text', 'SIM (Login)', 'NÃO (Registrar)', '', false);

    if (mode === true) { // Login
        const password = await showCustomModal('Digite sua senha para login:', true, 'password', 'Entrar', 'Cancelar', '', false);
        if (password === false) return;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            showAlert('Login realizado com sucesso!');
        } catch (error) {
            showAlert(`Erro ao fazer login: ${error.message}`, true);
        }
    } else if (mode === false) { // Registrar
        const name = await showCustomModal('Digite seu nome de usuário:', true, 'text', 'Próximo', 'Cancelar', '', false);
        if (name === false) return;
        if (!name) {
            showAlert('Nome de usuário não pode ser vazio.', true);
            return;
        }

        const password = await showCustomModal('Crie uma senha (min. 6 caracteres):', true, 'password', 'Registrar', 'Cancelar', '', false);
        if (password === false) return;

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await database.ref(`users/${userCredential.user.uid}`).set({ // Use database.ref() diretamente
                name: name,
                email: email,
                isBanned: false
            });
            showAlert('Conta registrada e login realizado com sucesso!');
        } catch (error) {
            showAlert(`Erro ao registrar: ${error.message}`, true);
        }
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showAlert('Logout realizado com sucesso!');
    } catch (error) {
        showAlert(`Erro ao fazer logout: ${error.message}`, true);
    }
});

// Apagar Conta
deleteAccountBtn.addEventListener('click', async () => {
    const confirm = await showCustomModal('Tem certeza que deseja apagar sua conta? Esta ação é irreversível.', false, 'text', 'Sim, Apagar', 'Não, Cancelar');
    if (confirm === true) {
        try {
            if (currentUser) {
                await database.ref(`users/${currentUser.uid}`).remove(); // Use database.ref() diretamente
                await currentUser.delete(); // Deleta a conta do Firebase Auth
                showAlert('Conta apagada com sucesso!');
            }
        } catch (error) {
            showAlert(`Erro ao apagar conta: ${error.message}. Por favor, faça login novamente e tente apagar.`, true);
        }
    }
});


// Atualizar contagem de usuários
function updateUserCount() {
    usersRef.once('value', snapshot => {
        let count = 0;
        snapshot.forEach(childSnapshot => {
            const userData = childSnapshot.val();
            if (!userData.isBanned) {
                count++;
            }
        });
        userCountP.textContent = `Usuários registrados: ${count}`;
    });
}

// Envio de Comentários
commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    let name = nameInput.value.trim();

    if (!message) {
        showAlert('A mensagem não pode ser vazia.', true);
        return;
    }

    let userId = null;
    if (currentUser) {
        userId = currentUser.uid;
        name = currentUserName; // Garante que o nome seja o do usuário logado
    } else {
        if (!name) {
            showAlert('Por favor, digite seu nome.', true);
            return;
        }
        userId = `anonymous_${Date.now()}`; // ID único para usuários anônimos
    }

    const bannedSnapshot = await bannedUsersRef.child(userId).once('value');
    if (bannedSnapshot.exists()) {
        showAlert("Você foi banido e não pode enviar comentários.", true);
        return;
    }
    if (currentUser) {
        const userAuthSnapshot = await usersRef.child(currentUser.uid).once('value');
        const userData = userAuthSnapshot.val();
        if (userData && userData.isBanned) {
            showAlert("Sua conta está banida. Você não pode enviar comentários.", true);
            return;
        }
    }


    const newComment = {
        userId: userId,
        userName: name,
        message: message,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        replyTo: replyingToCommentId ? { commentId: replyingToCommentId, userName: replyMessageSpan.dataset.replyAuthor, message: replyMessageSpan.dataset.replyMessageSnippet } : null
    };

    try {
        await commentsRef.push(newComment);
        messageInput.value = '';
        cancelReply(); // Limpa a caixa de resposta após o envio
        showAlert('Comentário enviado!');
    } catch (error) {
        showAlert(`Erro ao enviar comentário: ${error.message}`, true);
    }
});

// Iniciar Resposta
function startReply(commentId, author, messageSnippet) {
    replyingToCommentId = commentId;
    replyMessageSpan.textContent = `Respondendo a ${author}: "${messageSnippet.substring(0, 50)}${messageSnippet.length > 50 ? '...' : ''}"`;
    replyMessageSpan.dataset.replyAuthor = author; // Guarda nome do autor
    replyMessageSpan.dataset.replyMessageSnippet = messageSnippet; // Guarda snippet da mensagem
    replyBox.style.display = 'flex';
    messageInput.focus(); // Coloca o foco no campo de mensagem
}

// Cancelar Resposta
cancelReplyBtn.addEventListener('click', cancelReply);

function cancelReply() {
    replyingToCommentId = null;
    replyMessageSpan.textContent = '';
    replyBox.style.display = 'none';
    delete replyMessageSpan.dataset.replyAuthor;
    delete replyMessageSpan.dataset.replyMessageSnippet;
}

// Editar Comentário
async function editComment(commentId, currentMessage) {
    const newMessage = await showCustomModal('Editar comentário:', true, 'text', 'Salvar', 'Cancelar', currentMessage, true); // Usar textarea
    if (newMessage !== false && newMessage.trim() !== '' && newMessage !== currentMessage) {
        try {
            await commentsRef.child(commentId).update({ message: newMessage });
            showAlert('Comentário atualizado!');
        } catch (error) {
            showAlert(`Erro ao editar comentário: ${error.message}`, true);
        }
    } else if (newMessage.trim() === '') {
        showAlert('Comentário não pode ser vazio.', true);
    }
}

// Apagar Comentário
async function deleteComment(commentId, authorUid) {
    const confirmDelete = await showCustomModal('Tem certeza que deseja apagar este comentário?', false, 'text', 'Sim, Apagar', 'Não');
    if (confirmDelete === true) {
        try {
            await commentsRef.child(commentId).remove();
            showAlert('Comentário apagado!');
        }
        catch (error) {
            showAlert(`Erro ao apagar comentário: ${error.message}`, true);
        }
    }
}

// Banir Usuário
async function banUser(uid, name) {
    if (!isAdmin) {
        showAlert('Você não tem permissão para banir usuários.', true);
        return;
    }

    if (ADMIN_UIDS.includes(uid)) {
        showAlert('Você não pode banir um administrador.', true);
        return;
    }

    const confirmBan = await showCustomModal(`Tem certeza que deseja banir o usuário ${name}? Ele será deslogado e não poderá mais enviar comentários.`, false, 'text', 'Sim, Banir', 'Não');
    if (confirmBan === true) {
        try {
            await usersRef.child(uid).update({ isBanned: true });
            await bannedUsersRef.child(uid).set(true); // Adiciona ao nó de banidos
            // Tenta deslogar o usuário banido se ele estiver online (opcional, pode falhar se não estiver)
            if (firebase.auth().currentUser && firebase.auth().currentUser.uid === uid) {
                await firebase.auth().signOut();
            }
            showAlert(`${name} foi banido com sucesso.`);
        } catch (error) {
            showAlert(`Erro ao banir usuário: ${error.message}`, true);
        }
    }
}

// Autocompletar menções
messageInput.addEventListener('input', async () => {
    const text = messageInput.value;
    const atIndex = text.lastIndexOf('@');
    if (atIndex === -1 || atIndex === text.length - 1) {
        mentionSuggestionsUl.innerHTML = '';
        return;
    }

    const searchTerm = text.substring(atIndex + 1).toLowerCase();
    
    // Limpar sugestões antigas
    mentionSuggestionsUl.innerHTML = '';

    const usersSnapshot = await usersRef.once('value');
    usersSnapshot.forEach(userChild => {
        const userData = userChild.val();
        if (userData.name && userData.name.toLowerCase().startsWith(searchTerm) && userData.name !== currentUserName) {
            const li = document.createElement('li');
            li.textContent = `@${userData.name}`;
            li.addEventListener('click', () => {
                const beforeAt = text.substring(0, atIndex);
                messageInput.value = `${beforeAt}@${userData.name} `;
                mentionSuggestionsUl.innerHTML = '';
                messageInput.focus();
            });
            mentionSuggestionsUl.appendChild(li);
        }
    });

    if (mentionSuggestionsUl.children.length > 0) {
        mentionSuggestionsUl.style.display = 'block';
    } else {
        mentionSuggestionsUl.style.display = 'none';
    }
});

// Esconder sugestões de menção ao clicar fora
document.addEventListener('click', (e) => {
    if (!mentionSuggestionsUl.contains(e.target) && e.target !== messageInput) {
        mentionSuggestionsUl.style.display = 'none';
    }
});

// Inicialização (garante que os comentários são carregados na primeira vez)
// Removendo o listener commentsRef.on("value") daqui e movendo para dentro de onAuthStateChanged
// Isso garante que os comentários são carregados ou recarregados sempre que o estado de autenticação muda.
// commentsRef.on("value", async snapshot => { ... }); // LINHA REMOVIDA DAQUI
