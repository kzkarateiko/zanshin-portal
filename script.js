const SUPABASE_URL = 'https://kyzitokbvroclkhtonns.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eml0b2tidnJvY2xraHRvbm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzYxNTksImV4cCI6MjA5MDAxMjE1OX0.xoFmiYEoegyPUti2AVzQ4ex7HXCi_PtqRisXdYbB6yo';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUserId = null; let isPresGlobal = false; let targetTimerDate = null; let globalTournaments = [];
let currentPollQuestion = ""; let currentPollOptions = [];

setInterval(() => {
    const el = document.getElementById('tournament-timer');
    if(el && targetTimerDate) {
        const distance = targetTimerDate - new Date().getTime();
        if (distance < 0) { el.innerText = "00:00:00:00"; return; }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        el.innerText = `${d.toString().padStart(2,'0')}:${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
}, 1000);

async function loadGlobalSettings() {
    const { data } = await supabaseClient.from('app_settings').select('*').eq('id', 1).single();
    if (data) {
        document.getElementById('timer-display-title').innerText = data.timer_title;
        targetTimerDate = new Date(data.timer_date).getTime();
        document.getElementById('timer-edit-title').value = data.timer_title;
        const dateObj = new Date(data.timer_date); dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
        document.getElementById('timer-edit-date').value = dateObj.toISOString().slice(0,16);
    }
}
async function saveTimer() {
    const title = document.getElementById('timer-edit-title').value.trim(); const d = document.getElementById('timer-edit-date').value;
    if(!title || !d) return alert("Введите название и дату!");
    await supabaseClient.from('app_settings').upsert({ id: 1, timer_title: title, timer_date: d });
    closeModal('modal-timer'); loadGlobalSettings();
}

const quotes = ["«Голову держи низко, глаза высоко, будь сдержан в словах.»", "«Победа над собой — величайшая из побед.»", "«Истинный путь постигается десятью тысячами дней тренировок.»"];
let qIdx = 0;
setInterval(() => { document.getElementById('daily-quote').style.opacity = 0; setTimeout(()=>{ document.getElementById('daily-quote').innerText = quotes[qIdx]; document.getElementById('daily-quote').style.opacity = 1; qIdx = (qIdx+1)%quotes.length; }, 400); }, 5000);

function showTab(t) { document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active')); document.getElementById('tab-'+t).classList.add('active'); let b = document.getElementById('btn-'+t); if(b) b.classList.add('active'); window.scrollTo({top:0, behavior:'smooth'}); }
function toggleForm(id) { const e = document.getElementById(id); e.style.display = e.style.display === 'none' ? 'block' : 'none'; }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function calculateAge(d) { return Math.abs(new Date(Date.now() - new Date(d).getTime()).getUTCFullYear() - 1970); }
async function uploadFile(inputId, path) { const file = document.getElementById(inputId).files[0]; if (!file) return null; const name = `${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`; const { error } = await supabaseClient.storage.from('zanshin-media').upload(`${path}/${name}`, file); if (error) return null; return { url: supabaseClient.storage.from('zanshin-media').getPublicUrl(`${path}/${name}`).data.publicUrl, name: file.name }; }

function previewAvatar(input) { if (input.files && input.files[0]) { var r = new FileReader(); r.onload = function(e) { document.getElementById('profile-avatar-preview').innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`; }; r.readAsDataURL(input.files[0]); } }
async function saveProfile() {
    document.getElementById('prof-loading').style.display='block';
    let aUrl = null; if(document.getElementById('prof-avatar-file').files.length > 0) { const iData = await uploadFile('prof-avatar-file', 'avatars'); if(iData) aUrl = iData.url; }
    const u = { id: currentUserId, full_name: document.getElementById('prof-name').value, dan: document.getElementById('prof-dan').value, phone: document.getElementById('prof-phone').value };
    if(aUrl) u.avatar_url = aUrl;
    await supabaseClient.from('profiles').upsert(u);
    const p = document.getElementById('prof-pwd').value; if(p) await supabaseClient.auth.updateUser({ password: p });
    document.getElementById('prof-loading').style.display='none'; alert("Профиль сохранен!"); loadProfile(currentUserId);
}

async function loadPoll() {
    const { data: appData } = await supabaseClient.from('app_settings').select('poll_question, poll_options').eq('id', 1).single();
    currentPollQuestion = appData?.poll_question || 'Где проведем Зимнюю Школу?';
    currentPollOptions = appData?.poll_options || [];
    document.getElementById('poll-question-text').innerText = currentPollQuestion;

    const { data: votes } = await supabaseClient.from('poll_votes').select('option_id, profile_id');
    let vMap = {}; currentPollOptions.forEach((_,i) => vMap[i] = 0);
    let total = 0; let userVotedIdx = -1;
    
    if(votes) {
        total = votes.length;
        votes.forEach(vote => { vMap[vote.option_id] = (vMap[vote.option_id] || 0) + 1; if(vote.profile_id === currentUserId) userVotedIdx = vote.option_id; });
    }
    
    const cont = document.getElementById('poll-container');
    if(userVotedIdx !== -1 || currentPollOptions.length === 0) {
        let h = '';
        currentPollOptions.forEach((opt, idx) => {
            let perc = total > 0 ? Math.round((vMap[idx]/total)*100) : 0;
            let isUserChoice = (idx === userVotedIdx) ? 'border-color: var(--primary-color); background: #fffcfc;' : '';
            h += `<div class="poll-option" style="cursor:default; ${isUserChoice}"><div class="poll-progress" style="width:${perc}%;"></div><div class="poll-text"><span>${opt}</span><span>${perc}%</span></div></div>`;
        });
        h += `<p style="font-size: 11px; color: #888; text-align: center; margin: 5px 0 0 0;">Всего голосов: ${total}</p>`;
        cont.innerHTML = h;
    } else {
        let h = '';
        currentPollOptions.forEach((opt, idx) => { h += `<button class="poll-option" onclick="castVote(${idx})">${opt}</button>`; });
        cont.innerHTML = h;
    }
}
async function castVote(optIdx) { if(!currentUserId) return; await supabaseClient.from('poll_votes').insert([{ profile_id: currentUserId, option_id: optIdx }]); loadPoll(); }
function openPollModal() { document.getElementById('poll-edit-q').value = currentPollQuestion; renderPollEditOptions(); openModal('modal-poll-edit'); }
function renderPollEditOptions() {
    let h = ''; currentPollOptions.forEach((opt, i) => { h += `<div style="display:flex; gap:10px; margin-bottom:10px;"><input type="text" class="form-control" value="${opt}" onchange="currentPollOptions[${i}]=this.value"><button class="btn-del" style="flex-shrink:0;" onclick="currentPollOptions.splice(${i},1); renderPollEditOptions()">✖</button></div>`; });
    document.getElementById('poll-edit-opts').innerHTML = h;
}
function addPollOption() { currentPollOptions.push('Новый вариант'); renderPollEditOptions(); }
async function savePollAdmin() {
    const q = document.getElementById('poll-edit-q').value;
    currentPollOptions = currentPollOptions.filter(x => x.trim() !== '');
    if(currentPollOptions.length < 2) return alert("Минимум 2 варианта!");
    await supabaseClient.from('app_settings').update({ poll_question: q, poll_options: currentPollOptions }).eq('id', 1);
    await supabaseClient.from('poll_votes').delete().not('profile_id', 'is', null);
    closeModal('modal-poll-edit'); alert("Опрос обновлен!"); loadPoll();
}

async function saveDocument() {
    const t = document.getElementById('doc-title').value.trim(); if (!t) return alert("Введите название!");
    const fileInput = document.getElementById('doc-file'); if (!fileInput.files || fileInput.files.length === 0) return alert("Выберите файл!");
    document.getElementById('doc-loading').style.display='block'; const file = await uploadFile('doc-file', 'documents');
    if(!file) { document.getElementById('doc-loading').style.display='none'; return; }
    await supabaseClient.from('documents').insert([{ title: t, description: document.getElementById('doc-desc').value.trim(), file_url: file.url, file_name: file.name }]);
    closeModal('modal-document'); document.getElementById('doc-loading').style.display='none'; loadDocuments();
}
async function deleteDocument(id) { if(confirm("Удалить навсегда?")) { await supabaseClient.from('documents').delete().eq('id', id); loadDocuments(); } }
async function loadDocuments() {
    const { data } = await supabaseClient.from('documents').select('*').order('created_at', { ascending: false }); let h = '';
    data?.forEach(d => { h += `<div style="background: #fdfafb; border: 1px solid #eee; padding: 15px; border-radius: 8px; border-left: 4px solid var(--primary-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;"><div style="flex: 1; min-width: 200px;"><h3 style="margin: 0 0 5px 0; color: var(--primary-dark); font-size: 15px;">${d.title}</h3><p style="margin: 0; font-size: 12px; color: var(--text-muted);">${d.description || ''}</p></div><div style="display: flex; gap: 10px; align-items: center;"><a href="${d.file_url}" target="_blank" class="btn-osu" style="text-decoration: none; padding: 6px 12px; font-size: 11px;">💾 Скачать</a>${isPresGlobal ? `<button class="btn-del" onclick="deleteDocument('${d.id}')">🗑</button>` : ''}</div></div>`; });
    document.getElementById('documents-list-container').innerHTML = h || '<p class="empty-card">Документов пока нет</p>';
}

async function saveNews() { const t = document.getElementById('news-title').value, c = document.getElementById('news-content').value; if (!t || !c) return alert("Заполните текст!"); document.getElementById('news-loading').style.display='block'; const img = await uploadFile('news-image', 'news_images'); const file = await uploadFile('news-file', 'news_files'); await supabaseClient.from('news').insert([{ title: t, content: c, image_url: img?.url, file_url: file?.url, file_name: file?.name }]); closeModal('modal-news'); document.getElementById('news-loading').style.display='none'; loadNewsAndEvents(); }
async function saveEvent() { const t = document.getElementById('ev-title').value, d = document.getElementById('ev-date').value; if (!t || !d) return alert("Обязательно укажите дату!"); document.getElementById('ev-loading').style.display='block'; const img = await uploadFile('ev-image', 'events_images'); const file = await uploadFile('ev-file', 'events_files'); await supabaseClient.from('events').insert([{ title: t, event_date: d, location: document.getElementById('ev-loc').value, description: document.getElementById('ev-desc').value, image_url: img?.url, file_url: file?.url, file_name: file?.name }]); closeModal('modal-event'); document.getElementById('ev-loading').style.display='none'; loadNewsAndEvents(); }
async function deleteNews(id) { if(confirm("Удалить?")) { await supabaseClient.from('news').delete().eq('id', id); loadNewsAndEvents(); } }
async function deleteEvent(id) { if(confirm("Удалить?")) { await supabaseClient.from('events').delete().eq('id', id); loadNewsAndEvents(); } }

async function loadNewsAndEvents() {
    const { data: evData } = await supabaseClient.from('events').select('*').order('event_date', { ascending: true });
    let evM='', evA='';
    const today = new Date(); today.setHours(0,0,0,0);
    let activeCount = 0;

    evData?.forEach((e) => {
        let imgHtml = e.image_url ? `<div class="feed-image-wrapper" onclick="window.open('${e.image_url}', '_blank')"><img src="${e.image_url}" class="feed-poster"></div>` : '';
        let h = `<div class="feed-item">${imgHtml}<div class="feed-content"><div class="feed-date">${e.event_date}</div><h3 class="feed-title">${e.title}</h3><p class="feed-desc">${e.description || ''}</p><div class="feed-meta"><span>📍 ${e.location||'-'}</span></div>${e.file_url?`<a href="${e.file_url}" target="_blank" class="file-btn">💾 Скачать</a>`:''}${isPresGlobal?`<div class="admin-actions" style="margin-top:10px;"><button class="btn-del" onclick="deleteEvent('${e.id}')">🗑 Удалить</button></div>`:''}</div></div>`;
        const eventDate = new Date(e.event_date);
        if (eventDate >= today) { if (activeCount < 3) { evM += h; activeCount++; } }
        evA += h;
    });
    document.getElementById('events-feed-container').innerHTML = evM || '<p class="empty-card">Предстоящих турниров пока нет</p>'; 
    document.getElementById('events-archive-container').innerHTML = evA || '<p class="empty-card">Архив пуст</p>';

    const { data: nData } = await supabaseClient.from('news').select('*').order('published_at', { ascending: false });
    let nM='', nA='';
    nData?.forEach((n, i) => {
        let imgHtml = n.image_url ? `<div class="feed-image-wrapper" onclick="window.open('${n.image_url}', '_blank')"><img src="${n.image_url}" class="feed-poster"></div>` : '';
        let h = `<div class="feed-item news-item">${imgHtml}<div class="feed-content"><div class="feed-date">${n.published_at}</div><h3 class="feed-title">${n.title}</h3><p class="feed-desc">${n.content || ''}</p>${n.file_url?`<a href="${n.file_url}" target="_blank" class="file-btn">💾 Скачать</a>`:''}${isPresGlobal?`<div class="admin-actions" style="margin-top:10px;"><button class="btn-del" onclick="deleteNews('${n.id}')">🗑 Удалить</button></div>`:''}</div></div>`;
        if(i<2) nM+=h; nA+=h;
    });
    document.getElementById('news-feed-container').innerHTML = nM || '<p class="empty-card">Новостей пока нет</p>'; document.getElementById('news-archive-container').innerHTML = nA || '<p class="empty-card">Архив пуст</p>';
}

async function loadCoachesDirectory() {
    const { data: profiles } = await supabaseClient.from('profiles').select('*');
    const { data: groups } = await supabaseClient.from('groups').select('*');
    const { data: results } = await supabaseClient.from('athlete_results').select('place, students(id, profile_id)');
    const { data: allStudents } = await supabaseClient.from('students').select('id, profile_id');
    if(!profiles) return;
    let html = '';
    
    profiles.forEach(coach => {
        let myDojos = groups ? groups.filter(g => g.profile_id === coach.id) : [];
        let myStudents = allStudents ? allStudents.filter(s => s.profile_id === coach.id) : [];
        let dojosDetails = '';
        myDojos.forEach(d => { dojosDetails += `<div style="font-size:12px; background:#f4f6f9; padding:8px; border-radius:6px; margin-bottom:8px; border:1px solid #eee;"><strong>📍 ${d.address_city}</strong>, ${d.address_raw}<br>👥 Группа: ${d.group_name} (${d.students_count || 0} чел.)</div>`; });
        if(!dojosDetails) dojosDetails = '<span style="color:#aaa; font-size:12px;">Нет данных о залах</span>';

        let gold = 0, silver = 0, bronze = 0; let championsSet = new Set();
        if (results) {
            results.forEach(r => {
                if (r.students && r.students.profile_id === coach.id) {
                    if(r.place == 1) { gold++; championsSet.add(r.students.id); }
                    if(r.place == 2) silver++;
                    if(r.place == 3) bronze++;
                }
            });
        }
        
        let avatar = coach.avatar_url ? `<img src="${coach.avatar_url}">` : `🥋`;
        html += `
        <div class="coach-card">
            <div class="coach-header">
                <div class="coach-avatar">${avatar}</div>
                <div class="coach-info"><h3>${coach.full_name || 'Инструктор'}</h3><div class="rank">${coach.dan || '- Кю/Дан'}</div></div>
            </div>
            <div class="coach-body">
                <div class="coach-stat-row"><strong>📞 Телефон:</strong> <span>${coach.phone || 'Не указан'}</span></div>
                <div class="coach-stat-row"><strong>👥 Учеников в базе:</strong> <span>${myStudents.length}</span></div>
                <div class="coach-stat-row"><strong>🏆 Чемпионов:</strong> <span>${championsSet.size} чел.</span></div>
                <div class="medals-box"><div class="medal-item"><span>🥇</span>${gold}</div><div class="medal-item"><span>🥈</span>${silver}</div><div class="medal-item"><span>🥉</span>${bronze}</div></div>
            </div>
        </div>`;
    });
    document.getElementById('coaches-directory-container').innerHTML = html || '<p class="empty-card">Список тренеров пуст</p>';
}

const ptsMatrix = { 'club':{1:1,2:0.5,3:0.2}, 'city':{1:3,2:2,3:1}, 'region':{1:5,2:3,3:2}, 'republic':{1:8,2:5,3:3}, 'international':{1:12,2:8,3:5}, 'asia':{1:18,2:12,3:8}, 'world':{1:25,2:18,3:12} };

async function loadTournamentsForPoints() {
    const { data } = await supabaseClient.from('tournaments').select('*').order('event_date', { ascending: false });
    globalTournaments = data || [];
    const sel = document.getElementById('pt-tournament-select');
    sel.innerHTML = '<option value="">-- Выберите турнир --</option>';
    globalTournaments.forEach(t => { sel.innerHTML += `<option value="${t.id}">${t.title} (${t.level})</option>`; });
    
    let h = '';
    globalTournaments.forEach(t => { 
        let actionBtns = `<button class="btn-osu" style="padding:4px 8px; font-size:10px; width:100%;" onclick="openApplyModal('${t.id}', '${t.title}')">Заявить бойцов</button>`;
        if(isPresGlobal) {
            actionBtns += `<button class="btn-link" style="padding:4px 8px; font-size:10px; margin-top:5px; width:100%;" onclick="viewApplications('${t.id}', '${t.title}')">Смотреть список</button>`;
            actionBtns += `<button class="btn-del" style="margin-top:5px; width:100%;" onclick="deleteTournament('${t.id}')">🗑 Удалить турнир</button>`;
        }
        h += `<tr><td><strong>${t.title}</strong></td><td>${t.level}</td><td>${t.event_date}</td><td>${actionBtns}</td></tr>`; 
    });
    document.getElementById('tournaments-table-body').innerHTML = h || '<tr><td colspan="4" style="text-align:center;">База турниров пуста</td></tr>';
}

async function deleteTournament(id) { if(confirm("Удалить турнир из базы?")) { await supabaseClient.from('tournaments').delete().eq('id', id); loadTournamentsForPoints(); } }
function autoSetLevel() { const id = document.getElementById('pt-tournament-select').value; const t = globalTournaments.find(x => x.id === id); if(t) { document.getElementById('pt-level').value = t.level; } }

async function saveNewTournament() {
    const t = document.getElementById('ct-title').value, l = document.getElementById('ct-level').value, d = document.getElementById('ct-date').value;
    if(!t || !d) return alert("Заполните все поля!");
    await supabaseClient.from('tournaments').insert([{title: t, level: l, event_date: d}]);
    document.getElementById('admin-btn-add-tour').style.display = 'inline-block';
    closeModal('modal-create-tournament'); loadTournamentsForPoints();
}

async function openApplyModal(tourId, tourTitle) {
    document.getElementById('apply-tour-title').innerText = tourTitle; document.getElementById('apply-tour-id').value = tourId;
    const { data: myStudents } = await supabaseClient.from('students').select('*').eq('profile_id', currentUserId).order('full_name');
    const { data: existingApps } = await supabaseClient.from('tournament_applications').select('student_id').eq('tournament_id', tourId).eq('profile_id', currentUserId);
    let appliedSet = new Set(); if(existingApps) existingApps.forEach(a => appliedSet.add(a.student_id));
    let h = '';
    if(myStudents && myStudents.length > 0) {
        myStudents.forEach(s => {
            let isChecked = appliedSet.has(s.id) ? 'checked' : '';
            h += `<label class="apply-student-row"><input type="checkbox" class="apply-checkbox" value="${s.id}" ${isChecked}><div class="apply-student-info"><strong>${s.full_name}</strong><span>${calculateAge(s.birth_date)} лет | ${s.current_weight?s.current_weight+' кг':'-'} | ${s.current_kyu}</span></div></label>`;
        });
    } else { h = '<p class="empty-card">У вас нет учеников в базе</p>'; }
    document.getElementById('apply-students-list').innerHTML = h; openModal('modal-apply');
}

async function saveApplication() {
    const tourId = document.getElementById('apply-tour-id').value; const checkboxes = document.querySelectorAll('.apply-checkbox');
    let selectedIds = []; checkboxes.forEach(cb => { if(cb.checked) selectedIds.push(cb.value); });
    await supabaseClient.from('tournament_applications').delete().eq('tournament_id', tourId).eq('profile_id', currentUserId);
    if(selectedIds.length > 0) {
        let inserts = selectedIds.map(sid => ({ tournament_id: tourId, student_id: sid, profile_id: currentUserId }));
        await supabaseClient.from('tournament_applications').insert(inserts);
    }
    closeModal('modal-apply'); alert("Заявка успешно отправлена!");
}

async function viewApplications(tourId, tourTitle) {
    document.getElementById('app-list-title').innerText = tourTitle;
    const { data: apps } = await supabaseClient.from('tournament_applications').select('*, students(*), profiles(full_name)').eq('tournament_id', tourId);
    let h = '';
    if(apps && apps.length > 0) {
        apps.forEach(a => {
            let s = a.students;
            if(s) { h += `<tr><td><strong>${s.full_name}</strong></td><td>${calculateAge(s.birth_date)}</td><td>${s.current_weight?s.current_weight+' кг':'-'}</td><td><span style="background:#333;color:#fff;padding:2px 6px;border-radius:6px;font-size:10px;">${s.current_kyu}</span></td><td>${a.profiles ? a.profiles.full_name : '-'}</td></tr>`; }
        });
    } else { h = '<tr><td colspan="5" style="text-align:center;">Заявок пока нет</td></tr>'; }
    document.getElementById('app-list-body').innerHTML = h; openModal('modal-app-list');
}

async function openPointsModal() { openModal('modal-points'); const s = document.getElementById('pt-student'); const { data } = await supabaseClient.from('students').select('id, full_name').order('full_name'); s.innerHTML='<option value="">-- Выберите ученика --</option>'; data?.forEach(x => s.innerHTML+=`<option value="${x.id}">${x.full_name}</option>`); loadTournamentsForPoints(); }
async function savePoints() { 
    const sid = document.getElementById('pt-student').value; const tourId = document.getElementById('pt-tournament-select').value;
    if(!sid || !tourId) return alert("Выберите ученика и турнир!"); 
    const selectedTour = globalTournaments.find(x => x.id === tourId); const level = selectedTour ? selectedTour.level : 'club'; const tourName = selectedTour ? selectedTour.title : 'Неизвестный турнир';
    const pts = ptsMatrix[level][document.getElementById('pt-place').value] || 0; 
    await supabaseClient.from('athlete_results').insert([{student_id: sid, tournament_name: tourName, place: document.getElementById('pt-place').value, points: pts}]); 
    closeModal('modal-points'); loadRankings(); loadCoachesDirectory();
}

async function deleteResult(id) { if(confirm("Сбросить баллы?")) { await supabaseClient.from('athlete_results').delete().eq('student_id', id); loadRankings(); loadCoachesDirectory(); } }

async function loadRankings() {
    const { data: profData } = await supabaseClient.from('profiles').select('id, full_name, avatar_url'); const trainersMap = {}; profData?.forEach(p => trainersMap[p.id] = { name: p.full_name, avatar: p.avatar_url });
    const { data } = await supabaseClient.from('athlete_results').select('points, student_id, students(full_name, profile_id)');
    const stScores = {}; const stIds = {}; const trScores = {};
    data?.forEach(r => { if(r.students) { stScores[r.students.full_name] = (stScores[r.students.full_name]||0)+r.points; stIds[r.students.full_name] = r.student_id; if(r.students.profile_id) trScores[r.students.profile_id] = (trScores[r.students.profile_id]||0)+r.points; } });

    const sortedSt = Object.entries(stScores).sort((a,b)=>b[1]-a[1]);
    let sHtml=''; for(let i=0; i<Math.min(3, sortedSt.length); i++) sHtml+=`<div class="list-item"><span class="rank-number ${i===0?'top-1':(i===1?'top-2':'top-3')}">${i+1}</span><div style="flex:1;font-size:13px;"><strong>${sortedSt[i][0]}</strong></div><span style="font-weight:bold;color:var(--primary-dark);font-size:13px;">${sortedSt[i][1]} б.</span></div>`;
    document.getElementById('short-ranking-container').innerHTML = sHtml || '<p style="text-align:center;font-size:12px;">Нет данных</p>';
    if(sortedSt.length>0) document.getElementById('best-fighter-name').innerText = sortedSt[0][0];

    let fHtml=''; if(isPresGlobal) document.getElementById('th-admin-rank').style.display='table-cell';
    sortedSt.forEach((x,i) => fHtml+=`<tr><td><strong>${i+1}</strong></td><td><strong>${x[0]}</strong></td><td><strong>${x[1]} б.</strong></td>${isPresGlobal?`<td><button class="btn-del" onclick="deleteResult('${stIds[x[0]]}')">🗑 Сброс</button></td>`:''}</tr>`);
    document.getElementById('full-ranking-body').innerHTML = fHtml;

    const sortedTr = Object.entries(trScores).sort((a,b)=>b[1]-a[1]);
    if(sortedTr.length > 0) {
        let topCoachId = sortedTr[0][0];
        document.getElementById('best-coach-name').innerText = trainersMap[topCoachId]?.name || 'Инструктор';
        if(trainersMap[topCoachId]?.avatar) document.getElementById('best-coach-avatar').innerHTML = `<img src="${trainersMap[topCoachId].avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }

    const { data: stAll } = await supabaseClient.from('students').select('profile_id'); const trStudCount = {}; stAll?.forEach(s => { if(s.profile_id) trStudCount[s.profile_id] = (trStudCount[s.profile_id]||0)+1; });
    const sortedTrCount = Object.entries(trStudCount).sort((a,b)=>b[1]-a[1]);
    let tcHtml=''; for(let i=0; i<Math.min(3, sortedTrCount.length); i++) tcHtml+=`<div class="list-item"><span class="rank-number ${i===0?'top-1':(i===1?'top-2':'top-3')}">${i+1}</span><div style="flex:1;font-size:13px;"><strong>${trainersMap[sortedTrCount[i][0]]?.name || 'Тренер'}</strong></div><span style="font-weight:bold;color:var(--text-muted);font-size:13px;">${sortedTrCount[i][1]} ч.</span></div>`;
    document.getElementById('coaches-students-container').innerHTML = tcHtml || '<p style="text-align:center;font-size:12px;">Нет данных</p>';
}

async function openStudentProfile(studentId) {
    const { data: student } = await supabaseClient.from('students').select('*, profiles(full_name), groups(address_city, group_name)').eq('id', studentId).single();
    if(!student) return;
    const { data: results } = await supabaseClient.from('athlete_results').select('*').eq('student_id', studentId);
    let gold = 0, silver = 0, bronze = 0, totalPts = 0;
    if(results) { results.forEach(r => { if(r.place == 1) gold++; if(r.place == 2) silver++; if(r.place == 3) bronze++; totalPts += r.points; }); }

    document.getElementById('bp-avatar').innerHTML = student.avatar_url ? `<img src="${student.avatar_url}" style="width:100%;height:100%;object-fit:cover;">` : '🥋';
    document.getElementById('bp-name').innerText = student.full_name;
    document.getElementById('bp-kyu').innerText = student.current_kyu;
    document.getElementById('bp-age').innerText = calculateAge(student.birth_date) + ' лет';
    document.getElementById('bp-weight').innerText = student.current_weight ? student.current_weight + ' кг' : '—';
    document.getElementById('bp-national').innerHTML = student.is_national_team ? '<span style="color:#27ae60;">В составе</span>' : 'Нет';
    document.getElementById('bp-exam').innerText = student.last_exam_date || 'Нет данных';
    document.getElementById('bp-coach').innerText = student.profiles ? student.profiles.full_name : 'Нет тренера';
    document.getElementById('bp-dojo').innerText = student.groups ? `${student.groups.address_city}, ${student.groups.group_name}` : 'Без зала';
    
    document.getElementById('bp-gold').innerText = gold; document.getElementById('bp-silver').innerText = silver; document.getElementById('bp-bronze').innerText = bronze; document.getElementById('bp-points').innerText = totalPts + ' б.';
    openModal('modal-student-profile');
}

function openExamModal(id, name, kyu) { document.getElementById('exam-student-id').value = id; document.getElementById('exam-student-name-header').innerText = `${name} (${kyu})`; document.getElementById('exam-date').value = new Date().toISOString().split('T')[0]; openModal('modal-exam'); }
async function saveExamResult() { const id = document.getElementById('exam-student-id').value; const newKyu = document.getElementById('exam-new-kyu').value; const date = document.getElementById('exam-date').value; if(!id || !newKyu || !date) return; await supabaseClient.from('students').update({ current_kyu: newKyu, last_exam_date: date }).eq('id', id); alert("✅ Пояс присвоен!"); closeModal('modal-exam'); loadExams(); loadStudents(); loadGlobalAdminData(); }
async function loadExams() {
    const { data } = await supabaseClient.from('students').select('*').eq('profile_id', currentUserId); let html = '';
    if(!data || data.length === 0) { document.getElementById('exams-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center;">У вас пока нет учеников</td></tr>'; return; }
    const today = new Date();
    data.forEach(s => {
        let daysPassed = 999; let lastExamText = 'Первый тест';
        if(s.last_exam_date) { const examDate = new Date(s.last_exam_date); daysPassed = Math.floor((today - examDate) / (1000 * 60 * 60 * 24)); lastExamText = `${daysPassed} дн.`; }
        const reqDays = 90; const isReady = daysPassed >= reqDays;
        const statusHtml = isReady ? `<span style="color: #27ae60; font-weight: bold;">✅ Допущен</span>` : `<span style="color: #e74c3c; font-weight: bold;">⏳ Ждать ${reqDays - daysPassed} дн.</span>`;
        const actionBtn = `<button class="btn-osu" style="padding: 6px 12px; font-size: 11px;" onclick="openExamModal('${s.id}', '${s.full_name}', '${s.current_kyu}')">Тест</button>`;
        html += `<tr><td><a class="data-link" onclick="openStudentProfile('${s.id}')">${s.full_name}</a></td><td>${s.current_kyu}</td><td>${lastExamText}</td><td>${statusHtml}</td><td>${actionBtn}</td></tr>`;
    });
    document.getElementById('exams-table-body').innerHTML = html;
}

async function deleteStudent(id) {
    if(confirm("Удалить ученика из базы безвозвратно?")) {
        await supabaseClient.from('students').delete().eq('id', id);
        alert("Ученик удален.");
        loadStudents(); loadGlobalAdminData();
    }
}

function addGroupRow() { const c=document.getElementById('groups-container'), r=document.createElement('div'); r.className='form-grid'; r.innerHTML=`<div><label class="form-label">Группа</label><input type="text" class="form-control group-name"></div><div><label class="form-label">Расписание</label><input type="text" class="form-control group-schedule"></div><div><label class="form-label">Учеников</label><input type="number" class="form-control group-count"></div>`; c.appendChild(r); }
async function saveDojo() { const city=document.getElementById('dojo-city').value, addr=document.getElementById('dojo-address').value; let gr=[]; for(let r of document.getElementById('groups-container').children){ let n=r.querySelector('.group-name').value; if(n) gr.push({profile_id:currentUserId, address_city:city, address_raw:addr, group_name:n, schedule:r.querySelector('.group-schedule').value, students_count:r.querySelector('.group-count').value||0}); } await supabaseClient.from('groups').insert(gr); toggleForm('dojo-form-container'); loadDojos(); loadGlobalAdminData(); }
async function loadDojos() { const { data } = await supabaseClient.from('groups').select('*').eq('profile_id', currentUserId); const sel=document.getElementById('st-group'); sel.innerHTML=''; data?.forEach(g => sel.innerHTML+=`<option value="${g.id}">${g.address_city}, ${g.group_name}</option>`); }
async function saveStudent() { await supabaseClient.from('students').insert([{ profile_id: currentUserId, group_id: document.getElementById('st-group').value, full_name: document.getElementById('st-name').value, birth_date: document.getElementById('st-dob').value, current_kyu: document.getElementById('st-kyu').value, current_weight: document.getElementById('st-weight').value || null, is_national_team: document.getElementById('st-national').checked }]); toggleForm('student-form-container'); loadStudents(); loadBirthdays(); loadExams(); loadCoachesDirectory(); loadGlobalAdminData(); }

async function loadStudents() {
    const { data } = await supabaseClient.from('students').select('*, groups(group_name)').eq('profile_id', currentUserId);
    let h=''; data?.forEach(s => h+=`<tr><td><a class="data-link" onclick="openStudentProfile('${s.id}')">${s.full_name}</a></td><td>${calculateAge(s.birth_date)} лет</td><td>${s.current_kyu}</td><td>${s.groups?s.groups.group_name:'-'}</td><td><button class="btn-del" onclick="deleteStudent('${s.id}')">🗑</button></td></tr>`); document.getElementById('students-table-body').innerHTML = h;
    
    const { count: totalSt } = await supabaseClient.from('students').select('*', { count: 'exact', head: true });
    const { count: totalGr } = await supabaseClient.from('groups').select('*', { count: 'exact', head: true });
    document.getElementById('dash-total-students').innerText = totalSt || 0;
    document.getElementById('dash-total-groups').innerText = totalGr || 0;

    const { data: tData } = await supabaseClient.from('students').select('*, profiles(full_name)').eq('is_national_team', true);
    let tH=''; tData?.forEach(t => tH+=`<tr><td><a class="data-link" onclick="openStudentProfile('${t.id}')">${t.full_name}</a></td><td>${calculateAge(t.birth_date)} лет</td><td>${t.current_weight?t.current_weight+' кг':'-'}</td><td><span style="background:var(--accent-gold);color:#000;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:bold;">${t.current_kyu}</span></td><td>${t.profiles?t.profiles.full_name:''}</td></tr>`); document.getElementById('national-team-body').innerHTML = tH || '<tr><td colspan="5">В сборной пока нет спортсменов.</td></tr>';
}

let globalStudentsExportData = []; 
async function loadGlobalAdminData() {
    if(!isPresGlobal) return;
    const { data: allDojos } = await supabaseClient.from('groups').select('*, profiles(full_name)');
    let dh = '';
    allDojos?.forEach(d => { dh += `<tr><td><strong>${d.address_city}</strong></td><td>${d.group_name} <br><span style="font-size:10px;color:#888;">${d.address_raw}</span></td><td>${d.schedule}</td><td>${d.profiles ? d.profiles.full_name : '-'}</td></tr>`; });
    document.getElementById('global-dojos-body').innerHTML = dh || '<tr><td colspan="4">Нет залов</td></tr>';

    const { data: allSt } = await supabaseClient.from('students').select('*, groups(group_name), profiles(full_name)');
    globalStudentsExportData = allSt || []; 
    
    let sh = '';
    allSt?.forEach(s => { sh += `<tr><td><a class="data-link" onclick="openStudentProfile('${s.id}')">${s.full_name}</a></td><td>${calculateAge(s.birth_date)} лет</td><td><span style="background:#333;color:#fff;padding:3px 8px;border-radius:10px;font-size:11px;">${s.current_kyu}</span></td><td>${s.groups ? s.groups.group_name : '-'}</td><td>${s.profiles ? s.profiles.full_name : '-'}</td></tr>`; });
    document.getElementById('global-students-body').innerHTML = sh || '<tr><td colspan="5">Нет учеников</td></tr>';
}

function exportToExcel() {
    if(globalStudentsExportData.length === 0) return alert("База пуста!");
    let csvContent = '\uFEFFФИО;Возраст;Вес;Кю/Дан;Филиал;Тренер\n'; 
    globalStudentsExportData.forEach(s => {
        let name = s.full_name || ''; let age = s.birth_date ? calculateAge(s.birth_date) : ''; let weight = s.current_weight || ''; let kyu = s.current_kyu || ''; let group = s.groups ? s.groups.group_name : ''; let coach = s.profiles ? s.profiles.full_name : '';
        csvContent += `${name};${age};${weight};${kyu};${group};${coach}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", "База_Федерации_KWF.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

async function loadBirthdays() {
    const today = new Date(); const curM = today.getMonth() + 1; const curD = today.getDate();
    const { data: st } = await supabaseClient.from('students').select('full_name, birth_date'); let stH = '';
    st?.forEach(s => { if(s.birth_date) { const d = new Date(s.birth_date); if(d.getMonth()+1 === curM) { const isT = (d.getDate() === curD); stH += `<div class="list-item" style="padding: 8px 0;"><div style="flex:1; font-size:13px;"><strong>${s.full_name}</strong></div><span style="font-size:11px; ${isT?'color:red;font-weight:bold;':'color:var(--text-muted);'}">${isT?'СЕГОДНЯ!':d.getDate()+' числа'} (${today.getFullYear() - d.getFullYear()} лет)</span></div>`; } } });
    document.getElementById('student-birthdays-container').innerHTML = stH || '<p style="font-size:12px; color:#888;">В этом месяце именинников нет.</p>';
    const { data: pr } = await supabaseClient.from('profiles').select('full_name, birth_date'); let prH = '';
    pr?.forEach(p => { if(p.birth_date) { const d = new Date(p.birth_date); if(d.getMonth()+1 === curM) { const isT = (d.getDate() === curD); prH += `<div class="list-item" style="padding: 8px 0;"><div style="flex:1; font-size:13px;"><strong>${p.full_name}</strong></div><span style="font-size:11px; ${isT?'color:red;font-weight:bold;':'color:var(--text-muted);'}">${isT?'СЕГОДНЯ!':d.getDate()+' числа'}</span></div>`; } } });
    document.getElementById('coach-birthdays-container').innerHTML = prH || '<p style="font-size:12px; color:#888;">В этом месяце именинников нет.</p>';
}

async function loadProfile(userId) {
    currentUserId = userId;
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
    if (data) {
        document.getElementById('profile-name').innerText = data.full_name; document.getElementById('prof-name').value = data.full_name;
        document.getElementById('prof-dan').value = data.dan || ''; document.getElementById('prof-phone').value = data.phone || '';
        if(data.avatar_url) { document.getElementById('sidebar-avatar').innerHTML = `<img src="${data.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`; document.getElementById('profile-avatar-preview').innerHTML = `<img src="${data.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`; }
        isPresGlobal = (data.budopassport_num === 'PRESIDENT'); document.getElementById('profile-rank').innerText = (data.dan || 'Пояс') + (isPresGlobal ? ' (Президент)' : '');
        
        if (isPresGlobal) { 
            document.getElementById('admin-btn-news').style.display='block'; document.getElementById('admin-btn-event').style.display='block'; document.getElementById('admin-btn-points').style.display='block'; document.getElementById('admin-btn-timer').style.display='block'; document.getElementById('admin-btn-doc').style.display='block'; document.getElementById('admin-btn-add-tour').style.display='inline-block'; document.getElementById('admin-btn-poll').style.display='inline-block'; document.getElementById('menu-title-admin').style.display='block'; document.getElementById('btn-admin-global').style.display='flex';
            loadGlobalAdminData(); 
        }
    }
    addGroupRow(); loadGlobalSettings(); loadDojos(); loadStudents(); loadNewsAndEvents(); loadRankings(); loadBirthdays(); loadExams(); loadPoll(); loadDocuments(); loadTournamentsForPoints(); loadCoachesDirectory();
}

async function login() { const { data, error } = await supabaseClient.auth.signInWithPassword({ email: document.getElementById('email').value.trim(), password: document.getElementById('password').value.trim() }); if (!error) { document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-content').style.display = 'block'; loadProfile(data.user.id); } else { document.getElementById('error-msg').style.display='block'; } }
async function logout() { await supabaseClient.auth.signOut(); location.reload(); }
async function checkSession() { const { data: { session } } = await supabaseClient.auth.getSession(); if (session) { document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-content').style.display = 'block'; loadProfile(session.user.id); } }
checkSession();
