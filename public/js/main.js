const API_URL = '/api';

const UI = {
    setLoading: (btn, loading) => {
        if (!btn) return;
        btn.disabled = loading;
        if (loading) {
            btn.dataset.original = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        } else {
            btn.innerHTML = btn.dataset.original;
        }
    },
    notify: (message, type = 'success', fileUrl = null) => {
        const container = document.getElementById('result-toast-container') || document.body;
        const div = document.createElement('div');
        div.className = `glass-card p-3 mb-3 result-card border-${type} border-opacity-25 animate__animated animate__fadeInRight`;
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center text-white">
                <div>
                    <span class="text-${type === 'success' ? 'info' : type} fw-bold">Système :</span> ${message}
                    ${fileUrl ? `<br><a href="${fileUrl}" target="_blank" class="text-info small text-decoration-none"><i class="bi bi-eye me-1"></i>Voir le résultat</a>` : ''}
                </div>
                <button class="btn-close btn-close-white small" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        container.prepend(div);
        setTimeout(() => {
            div.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => div.remove(), 500);
        }, 8000);
    },
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.notify('Lien copié dans le presse-papier !', 'info');
        });
    }
};

const Auth = {
    async register() {
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        try {
            const r = await fetch(API_URL + '/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const res = await r.json();
            if (r.ok) alert('Compte créé ! Connectez-vous.');
            else alert(res.error);
        } catch (e) { alert(e.message); }
    },
    async login() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            const r = await fetch(API_URL + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const res = await r.json();
            if (r.ok) {
                localStorage.setItem('token', res.token);
                localStorage.setItem('user', JSON.stringify(res.user));
                window.location.href = '/dashboard';
            } else alert(res.error);
        } catch (e) { alert(e.message); }
    },
    async deleteAccount() {
        if (!confirm('Supprimer définitivement ?')) return;
        const r = await fetch(API_URL + '/auth/account', {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        if (r.ok) this.logout();
    },
    logout() {
        localStorage.clear();
        window.location.href = '/';
    },
    checkSession() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const path = window.location.pathname;

        if (!token && path !== '/') {
            window.location.href = '/';
            return;
        }

        if (token) {
            document.getElementById('main-nav').style.display = 'flex';
            document.getElementById('user-email').textContent = user.email;
            document.getElementById('btn-logout').style.display = 'inline-block';
            
            const perms = user.permissions;
            
            // Gestion de la visibilité des menus selon les permissions
            const menuVisibility = {
                'audio': perms.includes('CREATE_AUDIO'),
                'video': perms.includes('CREATE_VIDEO'),
                'compose': perms.includes('COMPOSE_AUDIO_VIDEO') || perms.includes('COMPOSE_AUDIO_IMAGE'),
                'admin': perms.includes('ADMIN')
            };

            Object.keys(menuVisibility).forEach(key => {
                const el = document.querySelector(`[data-nav="${key}"]`);
                if (el) el.style.display = menuVisibility[key] || perms.includes('ADMIN') ? 'block' : 'none';
            });

            // Sync active link
            document.querySelectorAll('.nav-link-custom').forEach(l => {
                if (l.getAttribute('href') === path) l.classList.add('active');
            });

            if (document.getElementById('permission-list')) {
                document.getElementById('permission-list').innerHTML = user.permissions.map(p => `<span class="badge badge-permission">${p}</span>`).join('');
                document.getElementById('api-key-val').textContent = user.apiKey;
            }
        }
    }
};

const Render = {
    async loadTemplates() {
        const gridImage = document.getElementById('template-grid-image');
        const gridVideo = document.getElementById('template-grid-video');
        if (!gridImage && !gridVideo) return;

        try {
            const r = await fetch(API_URL + '/render/templates', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            const templates = await r.json();

            if (gridImage) this._renderGrid(gridImage, templates.filter(t => t.type === 'image'));
            if (gridVideo) this._renderGrid(gridVideo, templates.filter(t => t.type === 'video'));
        } catch (e) { console.error(e); }
    },
    _renderGrid(container, templates) {
        container.innerHTML = templates.map(t => `
            <div class="col-md-4">
                <div class="glass-card p-3 h-100">
                    <div class="template-preview d-flex align-items-center justify-content-center bg-gradient">
                        <i class="bi bi-${t.type === 'video' ? 'play-btn' : 'image'} display-4 opacity-25"></i>
                    </div>
                    <h6 class="fw-bold mb-1">${t.name}</h6>
                    <p class="text-secondary small mb-3 text-truncate">${t.description}</p>
                    <button onclick="Render.useTemplate('${t.id}', '${t.type}')" class="btn btn-sm btn-outline-primary w-100 rounded-pill">Utiliser</button>
                </div>
            </div>
        `).join('');
    },
    async generateFromCustomHTML(type) {
        const html = document.getElementById(`custom-html-${type}`).value;
        const durationInput = document.getElementById(`custom-duration-video`);
        const duration = durationInput ? parseInt(durationInput.value) : 5;

        if (!html) return UI.notify('Veuillez saisir du code HTML', 'danger');

        UI.notify(`Génération ${type} personnalisée en cours...`, 'info');
        try {
            const r = await fetch(`${API_URL}/render/${type}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({ html, duration })
            });
            const res = await r.json();
            if (r.ok) {
                UI.notify('Génération terminée !', 'success', res.url);
                this.loadHistory(type, `history-${type}`);
            } else UI.notify(res.error, 'danger');
        } catch (e) { UI.notify(e.message, 'danger'); }
    },
    async useTemplate(id, type) {
        const endpoint = type === 'image' ? '/image' : '/video';
        UI.notify(`Génération ${type} en cours...`, 'info');
        try {
            const r = await fetch(API_URL + '/render' + endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({ 
                    templateId: id, 
                    variables: { 
                        quote: 'The journey is the reward.', 
                        author: 'SaaS Magic', 
                        text: 'Animated Template',
                        bgColor: '#0f172a',
                        textColor: '#f43f5e'
                    } 
                })
            });
            const res = await r.json();
            if (r.ok) {
                UI.notify('Terminé !', 'success', res.url);
                this.loadHistory(type, `history-${type}`);
            }
            else UI.notify(res.error, 'danger');
        } catch (e) { UI.notify(e.message, 'danger'); }
    },
    async magicIdea(type) {
        const promptInput = document.getElementById(`magic-prompt-${type}`);
        const promptValue = promptInput ? promptInput.value : '';

        UI.notify('Interrogation du moteur magique (n8n)...', 'info');
        try {
            const r = await fetch(API_URL + '/render/magic-idea', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({ type, prompt: promptValue })
            });
            const res = await r.json();
            if(!r.ok) throw new Error(res.detail || res.error);

            if (type === 'audio' && res.text) {
                // Injecter dans le textarea audio
                const el = document.getElementById('audio-text');
                if (el) { el.value = res.text; el.focus(); el.scrollIntoView({ behavior:'smooth' }); }
                UI.notify('✨ Script prêt ! Cliquez sur "Générer l\'Audio" pour lancer.', 'info');
            } else if (res.html) {
                // Injecter dans le textarea custom correspondant (image ou vidéo)
                const elId = type === 'image' ? 'custom-html-image' : 'custom-html-video';
                const el = document.getElementById(elId);
                if (el) { el.value = res.html; el.focus(); el.scrollIntoView({ behavior:'smooth' }); }
                UI.notify(`✨ HTML ${type} prêt ! Cliquez sur "Générer" pour lancer.`, 'info');
            }
        } catch (e) { UI.notify('Magic Error: ' + e.message, 'danger'); }
    },
    async generateAudio() {
        const text = document.getElementById('audio-text').value;
        const lang = document.getElementById('audio-lang').value;
        const btn = document.getElementById('btn-gen-audio');
        if (!text) return alert('Texte requis');

        UI.setLoading(btn, true);
        try {
            const r = await fetch(API_URL + '/render/audio', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token') 
                },
                body: JSON.stringify({ text, lang })
            });
            const res = await r.json();
            if (r.ok) {
                UI.notify('Audio généré !', 'success', res.url);
                this.loadHistory('audio', 'history-audio');
            }
            else UI.notify(res.error, 'danger');
        } catch (e) { UI.notify(e.message, 'danger'); }
        UI.setLoading(btn, false);
    },
    async loadFiles() {
        const vSelect = document.getElementById('compose-video');
        const aSelect = document.getElementById('compose-audio');
        if (!vSelect || !aSelect) return;

        try {
            const r = await fetch(API_URL + '/render/files', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            const files = await r.json();
            vSelect.innerHTML = files.filter(f => f.endsWith('.mp4')).map(f => `<option value="${f}">${f}</option>`).join('');
            aSelect.innerHTML = files.filter(f => f.endsWith('.mp3')).map(f => `<option value="${f}">${f}</option>`).join('');
        } catch (e) { console.error(e); }
    },
    async loadHistory(type, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Map type to dedicated endpoint
        const endpointMap = {
            'image': '/render/image/history',
            'audio': '/render/audio/history',
            'video': '/render/video/history',
            'compose': '/render/compose/history'
        };
        const endpoint = endpointMap[type] || `/render/history?type=${type}`;

        try {
            const r = await fetch(`${API_URL}${endpoint}`, {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            const history = await r.json();
            if (!Array.isArray(history)) {
                container.innerHTML = '<p class="text-secondary text-center py-4 small">Erreur de chargement.</p>';
                return;
            }
            container.innerHTML = history.map(item => {
                // Normalise les champs selon la table source
                const fileUrl = item.url || item.result_url;
                const desc = item.text || item.html || item.context || item.source_video || '';
                const itemType = type;

                // Largeur de colonne selon le type
                const colClass = itemType === 'image' ? 'col-md-4' : itemType === 'video' || itemType === 'compose' ? 'col-md-6' : 'col-12';

                let media = '';
                if (itemType === 'image' && fileUrl) {
                    media = `<img src="${fileUrl}" class="w-100 rounded-3 mb-0" style="height:160px; object-fit:cover; display:block;">`;
                } else if ((itemType === 'video' || itemType === 'compose') && fileUrl) {
                    media = `<video src="${fileUrl}" controls class="w-100 rounded-3 mb-0" style="height:160px; background:#000; display:block;"></video>`;
                } else if (itemType === 'audio' && fileUrl) {
                    media = `<audio src="${fileUrl}" controls class="w-100 mb-0"></audio>`;
                }

                return `
                <div class="${colClass}">
                    <div class="glass-card p-0 overflow-hidden h-100 d-flex flex-column">
                        ${media}
                        <div class="p-2 d-flex justify-content-between align-items-center border-top border-white border-opacity-5">
                            <span class="text-secondary text-truncate" style="font-size:0.7rem; max-width:140px;" title="${desc.replace(/<[^>]*>?/gm,'').substring(0,80)}">
                                ${desc ? desc.replace(/<[^>]*>?/gm, '').substring(0, 30) : '—'}
                            </span>
                            <div class="d-flex gap-1">
                                ${fileUrl ? `<a href="${fileUrl}" target="_blank" class="btn btn-sm btn-outline-light p-1 px-2" style="font-size:0.65rem;"><i class="bi bi-box-arrow-up-right"></i></a>` : ''}
                                ${fileUrl ? `<button onclick="UI.copyToClipboard('${window.location.origin}${fileUrl}')" class="btn btn-sm btn-outline-info p-1 px-2" style="font-size:0.65rem;"><i class="bi bi-link-45deg"></i></button>` : ''}
                            </div>
                        </div>
                        <div class="px-2 pb-2" style="font-size:0.65rem; color:#475569;">${new Date(item.created_at).toLocaleString()}</div>
                    </div>
                </div>`;
            }).join('') || '<div class="col-12"><p class="text-secondary text-center py-5 small">Aucune ressource créée pour le moment.</p></div>';
            }).join('') || '<p class="text-secondary text-center py-4 small">Aucune ressource créée pour le moment.</p>';
        } catch (e) { console.error(e); }
    },
    async compose() {
        const videoFile = document.getElementById('compose-video').value;
        const audioFile = document.getElementById('compose-audio').value;
        if (!videoFile || !audioFile) return alert('Sélectionnez les deux fichiers');

        UI.notify('Composition en cours...', 'info');
        try {
            const r = await fetch(API_URL + '/render/compose', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({ videoFile, audioFile })
            });
            const res = await r.json();
            if (r.ok) {
                UI.notify('Composition finie !', 'success', res.url);
                this.loadHistory('compose', 'history-compose');
            } else UI.notify(res.error, 'danger');
        } catch (e) { UI.notify(e.message, 'danger'); }
    }
};

const Admin = {
    async loadUsers() {
        const body = document.getElementById('user-table-body');
        if (!body) return;

        try {
            const r = await fetch(API_URL + '/admin/users', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            const users = await r.json();
            body.innerHTML = users.map(u => `
                <tr>
                    <td>${u.email}</td>
                    <td>${u.permissions.map(p => `<span class="badge border border-info text-info small me-1">${p}</span>`).join('')}</td>
                    <td><small class="text-secondary">${new Date(u.created_at).toLocaleDateString()}</small></td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteUser('${u.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (e) { console.error(e); }
    },
    async deleteUser(id) {
        if (!confirm('Supprimer cet utilisateur ?')) return;
        try {
            const r = await fetch(API_URL + '/admin/users/' + id, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (r.ok) this.loadUsers();
        } catch (e) { console.error(e); }
    }
};

// Ajout de la fonction de preview live dans l'objet Render
Render.refreshPreview = function(type) {
    const textarea = document.getElementById(`custom-html-${type}`);
    const iframe = document.getElementById(`preview-${type}`);
    if (!textarea || !iframe) return;

    const html = textarea.value;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html || '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#64748b;font-family:sans-serif;font-size:12px;">Aperçu ici...</div>');
    doc.close();
};

// Initialisation au chargement de la page
window.onload = () => {
    Auth.checkSession();
    
    const path = window.location.pathname;
    if (path === '/dashboard') {
        Render.loadTemplates();
        Render.loadHistory('image', 'history-image');

        // Preview live pour l'image
        const ta = document.getElementById('custom-html-image');
        if (ta) {
            ta.addEventListener('input', () => Render.refreshPreview('image'));
            Render.refreshPreview('image'); // état initial vide
        }
    }
    if (path === '/video') {
        Render.loadTemplates();
        Render.loadHistory('video', 'history-video');

        // Preview live pour la vidéo (avec debounce pour perf)
        const ta = document.getElementById('custom-html-video');
        if (ta) {
            let debounce;
            ta.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => Render.refreshPreview('video'), 400);
            });
            Render.refreshPreview('video');
        }
    }
    if (path === '/audio') { Render.loadHistory('audio', 'history-audio'); }
    if (path === '/compose') { Render.loadFiles(); Render.loadHistory('compose', 'history-compose'); }
    if (path === '/admin') Admin.loadUsers();
};

document.getElementById('btn-logout').onclick = () => Auth.logout();
