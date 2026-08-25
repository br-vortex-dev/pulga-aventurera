(function(){
const App={msgs:[],tab:'chat',title:null,convId:null,isGenerating:false,_replyTimer:null};
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

App.init=function(){
  LizData.loadSavedConversations();LizData.loadUploadedFiles();
  this._brand();this._theme();this._toggle();this._tabs();this._chat();
  const authPromise=window.lizAuthReadyPromise;
  (authPromise||Promise.resolve(true)).then(ok=>{if(ok!==false)this._syncHistoryOnBoot();});
  const s=localStorage.getItem('liz-chat-theme')||'dark';
  document.documentElement.setAttribute('data-theme',s);
  const m=document.querySelector('meta[name="theme-color"]');
  if(m)m.setAttribute('content',s==='dark'?'#08060e':'#f8f4f0');
};

App._brand=function(){
  const c=LizConfig.crown;
  const hc=$('#hc');if(hc)hc.innerHTML=c;
  const ec=$('#ec');if(ec)ec.innerHTML=c;
};

App._theme=function(){
  const btn=$('#tb');
  this._setThemeIcon(localStorage.getItem('liz-chat-theme')||'dark');
  btn.addEventListener('click',()=>{
    const c=document.documentElement.getAttribute('data-theme')||'dark';
    const n=c==='dark'?'light':'dark';
    this._switchTheme(n);
  });
};

/* ---- Monta/persiste o interruptor e anima ícone + giro (igual desktop) ---- */
App._setThemeIcon=function(t){
  const btn=$('#tb');if(!btn)return;
  const thumb=btn.querySelector('.theme-toggle-thumb');
  if(!thumb){
    // Monta a estrutura UMA vez; a partir daí só trocamos ícone e transform
    btn.innerHTML='<span class="theme-toggle-track"><span class="theme-toggle-thumb"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span></span>';
  }
  const thumbEl=btn.querySelector('.theme-toggle-thumb');
  thumbEl.innerHTML=t==='dark'
    ?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    :'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  thumbEl.style.transform='translateX('+(t==='dark'?0:24)+'px) rotate('+(t==='dark'?0:180)+'deg)';
  thumbEl.style.background=t==='dark'?'#8b5cf6':'#f59e0b';
  btn.setAttribute('aria-label',t==='dark'?'Ativar tema claro':'Ativar tema escuro');
};

/* ---- Aplica estado do tema (data-theme + storage + barra + ícone) ---- */
App._setThemeState=function(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('liz-chat-theme',t);
  const m=document.querySelector('meta[name="theme-color"]');
  if(m)m.setAttribute('content',t==='dark'?'#08060e':'#f8f4f0');
  this._setThemeIcon(t);
};

/* ---- Troca de tema com transição (igual desktop: view transition ou morphing) ---- */
App._switchTheme=function(n){
  if(document.startViewTransition){
    document.startViewTransition(()=>this._setThemeState(n));
  }else{
    this._morphTheme();
    this._setThemeState(n);
  }
};

/* ---- Pulso do interruptor ao trocar tema (igual desktop) ---- */
App._morphTheme=function(){
  const root=document.documentElement;
  root.classList.remove('theme-morphing');
  void root.offsetWidth;
  root.classList.add('theme-morphing');
  setTimeout(()=>root.classList.remove('theme-morphing'),850);
};

App._toggle=function(){
  const btn=$('#crownToggle');const bar=$('.tools-bar');
  btn.addEventListener('click',()=>{
    const willCollapse=!bar.classList.contains('is-collapsed');
    if(willCollapse){
      bar.classList.remove('is-expanded');bar.classList.add('is-collapsed');
    }else{
      bar.classList.remove('is-collapsed');bar.classList.add('is-expanded');
    }
    btn.setAttribute('aria-label',willCollapse?'Mostrar menu':'Esconder menu');
  });
  // Começa minimizado
  bar.classList.remove('is-expanded');bar.classList.add('is-collapsed');
};

App._tabs=function(){
  const pills=$$('.tool-pill');
  // Modal close
  $('#modalClose')?.addEventListener('click',()=>this._closeModal());
  $('#modalOverlay')?.addEventListener('click',(e)=>{if(e.target===e.currentTarget)this._closeModal();});

  // Back
  $('#backBtn')?.addEventListener('click',function(){
    // Se o mural estiver aberto, fecha ele
    if(LizUI.mural.overlay&&LizUI.mural.overlay.classList.contains('is-open')){
      LizUI.mural.close();return;
    }
    document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('is-active'));
    document.getElementById('pChat')?.classList.add('is-active');
    $('.tools-bar').classList.remove('is-collapsed');$('.tools-bar').classList.add('is-expanded');
    $('#backBtn').style.display='none';$('#crownToggle').style.display='';$('#hSep').style.display='none';$('#hSub').textContent='';
    $('#ht').textContent='Liz';App.tab='chat';
    $$('.tool-pill').forEach(x=>x.classList.toggle('is-active',x.dataset.t==='chat'));
  });

  pills.forEach(p=>{
    p.addEventListener('click',()=>{
      const a=p.dataset.t;
      // Chat: mostra conversas se já estiver no chat
      if(a==='chat'&&this.tab==='chat'){this._showConvs();return;}
      if(a===this.tab)return;
      this.tab=a;
      pills.forEach(x=>x.classList.toggle('is-active',x===p));
      $$('.page').forEach(pg=>pg.classList.remove('is-active'));
      // Minimiza ferramentas ao entrar em outras seções
      if(a!=='chat'){$('.tools-bar').classList.add('is-collapsed');$('.tools-bar').classList.remove('is-expanded');
        $('#backBtn').style.display='';$('#crownToggle').style.display='none';
        $('#hSep').style.display='';$('#hSub').textContent={settings:'Ajustes'}[a]||'';}
      else{$('.tools-bar').classList.remove('is-collapsed');$('.tools-bar').classList.add('is-expanded');
        $('#backBtn').style.display='none';$('#crownToggle').style.display='';$('#hSep').style.display='none';$('#hSub').textContent='';}
      if(a==='newchat'){this._newChat();return;}
      if(a==='archive'){
        $('.tools-bar').classList.add('is-collapsed');$('.tools-bar').classList.remove('is-expanded');
        $('#backBtn').style.display='';$('#crownToggle').style.display='none';
        $('#hSep').style.display='';$('#hSub').textContent='Mural';
        LizUI.mural.onClose=function(){
          document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('is-active'));
          document.getElementById('pChat')?.classList.add('is-active');
          $('.tools-bar').classList.remove('is-collapsed');$('.tools-bar').classList.add('is-expanded');
          $('#backBtn').style.display='none';$('#crownToggle').style.display='';$('#hSep').style.display='none';$('#hSub').textContent='';
          $('#ht').textContent='Liz';App.tab='chat';
          $$('.tool-pill').forEach(x=>x.classList.toggle('is-active',x.dataset.t==='chat'));
        };
        LizUI.mural.open();return;
      }
      if(a==='chat'){document.getElementById('pChat')?.classList.add('is-active');$('#ht').textContent='Liz';return;}
      const map={settings:'pSettings'};
      const pid=map[a];if(pid){const pg=document.getElementById(pid);if(pg)pg.classList.add('is-active');}
      if(a==='settings')this._settings();
      $('#ht').textContent='Liz';
    });
  });
};

App._chat=function(){
  const form=$('#cf');const input=$('#ci');const send=$('#sb');
  const empty=$('#empty');const list=$('#ml');const content=$('#chatContent');

  form.addEventListener('submit',e=>{e.preventDefault();this._send();});
  list.addEventListener('click',e=>{
    const preview=e.target.closest('.ai-image-preview, .md-image');
    if(!preview)return;
    const img=preview.matches('img')?preview:preview.querySelector('img');
    if(img&&img.getAttribute('src'))this._previewImg(img.src,preview.dataset.fileName||img.alt||'Imagem');
  });
  input.addEventListener('input',()=>{this._updateSendBtn();});
  input.addEventListener('paste',e=>{
    const clipboard=e.clipboardData;
    if(!clipboard)return;
    const files=Array.from(clipboard.files||[]);
    if(!files.length&&clipboard.items){
      Array.from(clipboard.items).forEach(item=>{
        if(item.kind==='file'){const file=item.getAsFile();if(file)files.push(file);}
      });
    }
    if(files.length){
      e.preventDefault();
      this._attachFiles(files);
      this._toast(files.length===1?'Arquivo colado e anexado':files.length+' arquivos colados e anexados');
    }
  });
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this._send();}});

  // Anexar arquivo — abre o seletor e processa via _attachFiles
  $('#ab')?.addEventListener('click',()=>$('#fi')?.click());
  $('#fi')?.addEventListener('change',(e)=>{
    if(e.target.files&&e.target.files.length)this._attachFiles(e.target.files);
    e.target.value='';
  });

  $('#ch')?.querySelectorAll('.chip').forEach(c=>{
    c.addEventListener('click',()=>{
      const texts={code:'Me ajude com código: ',design:'Me ajude com design: ',errors:'Analise este erro: ',ideas:'Me dê ideias: '};
      input.value=texts[c.dataset.m]||'';input.focus();send.disabled=false;
    });
  });

  this._sendMsg=function(t){
    const wasEmpty=!this.msgs.length;
    this.msgs.push({role:'user',content:t,time:this._now()});
    if(wasEmpty){
      this.convId=null;
      this.title=LizData.autoTitleFromMessages(this.msgs)||t.slice(0,35);empty.classList.add('is-hidden');list.classList.remove('is-hidden');
      $('#hSub').textContent=this.title;this._render();
    }else this._append(this.msgs[this.msgs.length-1]);
    input.value='';this._scroll();
    this._beginReply(t);
  };

  this._reply=function(t){
    const l=t.toLowerCase();let r=LizData.replies.default[0];
    if(/(código|codigo|função|script|react|javascript|js)/.test(l))r=LizData.replies.code[0];
    else if(/(design|ui|visual|cor|css|estilo)/.test(l))r=LizData.replies.design[0];
    else if(/(erro|error|bug|falha)/.test(l))r=LizData.replies.error[0];
    else if(/(ideia|ideias|brainstorm|nome|sugest)/.test(l))r=LizData.replies.ideas[0];
    const m={role:'liz',content:r,demo:true,time:this._now()};
    this.msgs.push(m);this._append(m);this._save();
  };

  this._render=function(){list.innerHTML=this.msgs.map((m,i)=>this._html(m,i)).join('');};
  this._append=function(m){const d=document.createElement('div');d.innerHTML=this._html(m,this.msgs.length-1);list.appendChild(d.firstElementChild);this._scroll();};
  this._html=function(m,idx){
    const t=m.time?'<p class="msg-time">'+m.time+'</p>':'';const di=idx!==undefined?' data-i="'+idx+'"':'';
    if(m.file){const fileSrc=m.file.dataUrl||'';return'<div class="msg msg-user"'+di+'><div class="msg-bubble msg-bubble-user">'+(m.file.type?.startsWith('image/')?'<img src="'+this._e(fileSrc)+'" alt="'+this._e(m.file.name||'Imagem')+'" style="max-width:200px;border-radius:8px;display:block" loading="lazy">':'<span style="opacity:0.5;display:flex;gap:6px">'+LizConfig.icons.file+this._e(m.file.name)+'</span>')+'</div>'+t+'</div>';}
    if(m.role==='user'){return'<div class="msg msg-user"'+di+'><div class="msg-bubble msg-bubble-user"><div>'+this._e(m.content)+'</div></div>'+t+'</div>';}
    const demo=m.demo===true?'<span class="msg-demo-badge">Modo demonstração</span>':'';
    const images=this._aiImagesHTML(m.images);
    const webResults=this._webResultsHTML(m.webResults);
    return'<div class="msg msg-liz"'+di+'><div class="msg-avatar">'+LizConfig.crown+'</div><div><div class="msg-bubble msg-bubble-liz"><span class="msg-name">Liz</span>'+demo+'<div>'+this._md(m.content)+'</div>'+images+webResults+'</div>'+t+'</div></div>';
  };
  this._md=function(t){
    const tokens=[];const token=h=>{const mark='\\u0000LIZ_MOBILE_'+tokens.length+'\\u0000';tokens.push(h);return mark;};
    let s=String(t||'');
    s=s.replace(/```(\w+)?\n?([\s\S]*?)```/g,(_,lang,code)=>token('<pre style="margin:6px 0;padding:8px 10px;background:rgba(0,0,0,0.3);border-radius:8px;font-size:0.78rem;overflow-x:auto"><code>'+this._e(code)+'</code></pre>'));
    s=s.replace(/!\[([^\]]{0,160})\]\((https:\/\/[^\s)]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+)\)/gi,(match,alt,src)=>{
      const safe=this._safeImageUrl(src);return safe?token('<img class="md-image" src="'+this._e(safe)+'" alt="'+this._e(alt||'Imagem')+'" loading="lazy">'):match;
    });
    let h=this._e(s);h=h.replace(/`([^`\n]+)`/g,'<code style="background:rgba(139,92,246,0.1);padding:1px 5px;border-radius:4px;font-size:0.85em">$1</code>');h=h.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');h=h.replace(/\n/g,'<br>');tokens.forEach((value,i)=>{h=h.replace('\\u0000LIZ_MOBILE_'+i+'\\u0000',value);});return h;
  };
  this._e=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
  this._now=function(){return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});};
  this._scroll=function(){requestAnimationFrame(()=>{if(content)content.scrollTop=content.scrollHeight;});};
  this._save=function(){if(!this.msgs.length)return;this.title=this.title||'Nova conversa';this.convId=LizData.saveConversation(this.title,this.msgs,this.convId);};
  this._send=function(){if(this.isGenerating){this._stopReply();return;}const t=input.value.trim();if(t)this._sendMsg(t);};

  /* ---- Resposta compartilhada com o desktop ---- */
  this._beginReply=function(t){
    this.isGenerating=true;this._stopRequested=false;this._updateSendBtn();this._showTyping();
    this._replyPromise=(async()=>{
      let online=false;
      try{
        online=await LizAPI.checkBackend();
        LizData.isBackendOnline=online;
        if(online){
          const response=await LizAPI.sendMessage(this.backendConversationId||null,t,null,localStorage.getItem('liz-model')||'liz-3');
          if(this._stopRequested)return;
          const remoteId=response&&response.conversationId;
          if(remoteId){
            if(this.convId&&String(this.convId).startsWith('local_'))LizData.promoteConversationId(this.convId,remoteId);
            this.convId=remoteId;this.backendConversationId=remoteId;
          }
          const contentText=response?.assistantMessage?.content||response?.reply||'Sem resposta.';
          const m={role:'liz',content:contentText,demo:response?.demo===true,images:Array.isArray(response?.assistantMessage?.images)?response.assistantMessage.images:[],webResults:Array.isArray(response?.assistantMessage?.webResults)?response.assistantMessage.webResults:[],time:this._now()};
          this.msgs.push(m);this._append(m);this._save();
          this._hydrateRemoteFiles();
          return;
        }
      }catch(e){
        if(this._stopRequested)return;
        this._removeTyping();
        const m={role:'liz',content:'Não consegui falar com a IA agora. Tente novamente em alguns instantes.',time:this._now()};
        this.msgs.push(m);this._append(m);this._save();
        return;
      }
      if(!this._stopRequested){
        await new Promise(resolve=>setTimeout(resolve,400));
        if(!this._stopRequested)this._reply(t);
      }
    })().finally(()=>{this._removeTyping();this.isGenerating=false;this._updateSendBtn();});
  };
  this._stopReply=function(){
    this._stopRequested=true;
    if(this._replyTimer){clearTimeout(this._replyTimer);this._replyTimer=null;}
    this._removeTyping();this.isGenerating=false;this._updateSendBtn();
  };
  this._updateSendBtn=function(){
    if(!send)return;
    if(this.isGenerating){
      send.disabled=false;send.classList.add('is-stop');
      send.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';
      send.setAttribute('aria-label','Parar geração');
    }else{
      send.classList.remove('is-stop');
      send.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
      send.setAttribute('aria-label','Enviar');
      send.disabled=input.value.trim().length===0;
    }
  };
  this._showTyping=function(){
    this._removeTyping();
    const d=document.createElement('div');
    d.className='msg msg-liz';d.id='typingMsg';
    d.innerHTML='<div class="msg-avatar">'+LizConfig.crown+'</div><div><div class="msg-bubble msg-bubble-liz typing-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>';
    list.appendChild(d);this._scroll();
  };
  this._removeTyping=function(){const t=document.getElementById('typingMsg');if(t)t.remove();};
};

App._safeImageUrl=function(value){
  const raw=String(value||'').trim();
  if(/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(raw))return raw;
  try{const u=new URL(raw);return u.protocol==='https:'?u.toString():'';}catch(e){return '';}
};

App._aiImagesHTML=function(images){
  if(!Array.isArray(images))return '';
  return images.map(image=>{
    const src=this._safeImageUrl(image.url||image.src);
    const uploadId=typeof image.uploadId==='string'?image.uploadId:'';
    if(!src&&!uploadId)return '';
    const alt=this._e(image.alt||image.title||'Imagem da Liz');
    const title=this._e(image.title||'Imagem');
    const source=this._e(image.source||'Fonte');
    const creator=image.creator?' · '+this._e(image.creator):'';
    const license=image.license?' · '+this._e(image.license):'';
    const sourceUrl=this._safeImageUrl(image.sourceUrl);
    const link=sourceUrl?'<a class="ai-image-source-link" href="'+this._e(sourceUrl)+'" target="_blank" rel="noopener noreferrer">Abrir fonte</a>':'';
    return'<figure class="ai-image-card"'+(uploadId?' data-upload-id="'+this._e(uploadId)+'"':'')+'><div class="ai-image-preview" data-file-name="'+alt+'"><img src="'+this._e(src)+'" alt="'+alt+'" loading="lazy"><span class="ai-image-expand">⌕</span></div><figcaption><span class="ai-image-title">'+title+'</span><span class="ai-image-meta">'+source+creator+license+'</span>'+link+'</figcaption></figure>';
  }).join('');
};

App._webResultsHTML=function(results){
  if(!Array.isArray(results))return '';
  const cards=results.map(item=>{
    const url=this._safeLinkUrl(item.url);if(!url)return '';
    const title=this._e(item.title||'Resultado da busca');
    const description=this._e(item.description||'');
    const source=this._e(item.source||'Fonte consultada');
    const age=item.age?' · '+this._e(item.age):'';
    return'<a class="web-result-card" href="'+this._e(url)+'" target="_blank" rel="noopener noreferrer"><span class="web-result-title">'+title+'</span><span class="web-result-description">'+description+'</span><span class="web-result-source">'+source+age+'</span></a>';
  }).join('');
  return cards?'<section class="web-results" aria-label="Fontes consultadas"><div class="web-results-heading">Fontes consultadas</div><div class="web-results-list">'+cards+'</div></section>':'';
};

App._safeLinkUrl=function(value){
  try{const u=new URL(String(value||'').trim());return u.protocol==='https:'?u.toString():'';}catch(e){return '';}
};

/* ---- Histórico remoto compartilhado com o desktop ---- */
App._syncHistoryOnBoot=async function(){
  try{
    const ok=await LizData.syncWithBackend();
    if(!ok)return;
    // A lista inicial serve para o histórico; o detalhe completo é buscado
    // quando o usuário abre uma conversa remota.
  }catch(e){console.warn('[Liz Mobile] Sincronização inicial indisponível:',e.message);}
};

App._ensureRemoteConversation=async function(title){
  if(this.backendConversationId)return this.backendConversationId;
  if(this._remoteConversationPromise)return this._remoteConversationPromise;
  this._remoteConversationPromise=LizAPI.createConversation(title||this.title||'Nova conversa').then(res=>{
    if(!res?.id)throw new Error('Servidor não devolveu o ID da conversa');
    if(this.convId&&String(this.convId).startsWith('local_'))LizData.promoteConversationId(this.convId,res.id);
    this.convId=res.id;this.backendConversationId=res.id;
    return res.id;
  }).finally(()=>{this._remoteConversationPromise=null;});
  return this._remoteConversationPromise;
};

/* ---- Feedback tátil ---- */
App._buzz=function(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}};

/* ---- Tema (exposição para settings) ---- */
App._toggleTheme=function(){const c=document.documentElement.getAttribute('data-theme')||'dark';const n=c==='dark'?'light':'dark';this._switchTheme(n);};

/* ---- Modais da Liz (substituem prompt/confirm nativos) ---- */
App._inputModal=function(title,placeholder,okLabel,cb){
  const body='<div class="liz-modal-field"><input type="text" id="lizModalInput" placeholder="'+this._e(placeholder||'')+'" autocomplete="off" /></div>'+
    '<div class="liz-modal-actions"><button type="button" class="liz-modal-btn" id="lizModalCancel">Cancelar</button>'+
    '<button type="button" class="liz-modal-btn primary" id="lizModalOk">'+this._e(okLabel||'Criar')+'</button></div>';
  this._openModal(title,body);
  const inp=$('#lizModalInput');
  const ok=()=>{const v=inp?inp.value.trim():'';this._closeModal();if(v)cb(v);};
  if(inp){inp.focus();inp.addEventListener('keydown',(e)=>{if(e.key==='Enter'){e.preventDefault();ok();}});}
  const cancel=$('#lizModalCancel');if(cancel)cancel.addEventListener('click',()=>this._closeModal());
  const okBtn=$('#lizModalOk');if(okBtn)okBtn.addEventListener('click',ok);
};
App._confirmModal=function(title,message,okLabel,danger,cb){
  const body='<p class="liz-modal-msg">'+message+'</p>'+
    '<div class="liz-modal-actions"><button type="button" class="liz-modal-btn" id="lizModalCancel">Cancelar</button>'+
    '<button type="button" class="liz-modal-btn '+(danger?'danger':'primary')+'" id="lizModalOk">'+this._e(okLabel||'Confirmar')+'</button></div>';
  this._openModal(title,body);
  const cancel=$('#lizModalCancel');if(cancel)cancel.addEventListener('click',()=>this._closeModal());
  const okBtn=$('#lizModalOk');if(okBtn)okBtn.addEventListener('click',()=>{this._closeModal();cb();});
};

App._handleFiles=function(files){
  [...files].forEach(file=>{
    if(file.size>10*1024*1024){this._toast('Arquivo grande demais');return;}
    const r=new FileReader();
    r.onload=(e)=>{LizData.saveUploadedFile({name:file.name,size:file.size,type:file.type,dataUrl:e.target.result,convTitle:'Arquivos'});this._toast('Arquivo salvo!');};
    r.readAsDataURL(file);
  });
};

/* ---- Anexos no chat (mobile) ---- */
App._attachFiles=function(files){
  [...files].forEach((file)=>{
    if(file.size>10*1024*1024){this._toast('Arquivo muito grande (máx. 10 MB)');return;}
    const r=new FileReader();
    r.onload=async(e)=>{
      const dataUrl=e.target.result;
      const wasEmpty=!this.msgs.length;
      const msg={role:'user',content:'',file:{name:file.name,size:file.size,type:file.type,dataUrl},time:this._now()};
      this.msgs.push(msg);
      if(wasEmpty){
        this.title='Arquivo: '+file.name.slice(0,30);
        $('#empty')?.classList.add('is-hidden');
        $('#ml')?.classList.remove('is-hidden');
        const hSub=$('#hSub');if(hSub)hSub.textContent=this.title;
        this._render();
      }else{
        this._append(msg);
      }

      let upload=null;
      try{
        if(await LizAPI.checkBackend()){
          LizData.isBackendOnline=true;
          const conversationId=await this._ensureRemoteConversation(this.title);
          upload=await LizAPI.uploadFile(file,conversationId);
          if(upload?.id){
            msg.file.uploadId=upload.id;msg.file.url=upload.url;
            await LizAPI.addMessage(conversationId,{content:'',role:'user',file:{uploadId:upload.id,name:file.name,size:file.size,type:file.type}});
          }
        }
      }catch(err){
        console.warn('[Liz Mobile] Upload remoto falhou; usando cópia local:',err.message);
      }

      LizData.saveUploadedFile({name:file.name,size:file.size,type:file.type,dataUrl:upload?undefined:dataUrl,uploadId:upload?.id,url:upload?.url,convTitle:this.title||'Arquivos'});
      this._save();
      // Ainda não existe análise de imagem/arquivo neste fluxo, então o
      // aviso é persistido como resposta demonstrativa nos dois clientes.
      this._replyTimer=setTimeout(async()=>{
        const isImage=file.type&&file.type.startsWith('image/');
        const reply={role:'liz',content:isImage
          ?'Recebi sua imagem! Posso analisá-la ou ajudar com edições. O que você quer fazer?'
          :'Arquivo recebido! Posso ler o conteúdo, resumir ou extrair informações. Me diga o que precisa.',demo:true,time:this._now()};
        this.msgs.push(reply);
        this._append(reply);
        this._save();
        if(this.backendConversationId){
          LizAPI.addMessage(this.backendConversationId,{content:reply.content,role:'assistant',demo:true}).catch(()=>{});
        }
      },600+Math.random()*400);
    };
    r.readAsDataURL(file);
  });
};

App._previewImg=function(url,name){
  this._openModal(name||'Imagem','<img src="'+url+'" style="width:100%;border-radius:8px;display:block" />');
};

/* ---- Lista de Arquivos ---- */
App._archive=function(){
  const p=document.getElementById('pArchive');if(!p)return;
  LizData.loadUploadedFiles();
  const files=LizData.uploadedFiles;

  // Ícones
  const imgIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
  const fileIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

  function getType(f){
    if(f.type&&f.type.startsWith('image/'))return'image';
    return'file';
  }

  let h='<div style="padding:16px 14px 4px"><h2 style="font-size:1.1rem;font-weight:700">Arquivos</h2></div>';

  if(!files.length){
    h+='<div style="padding:40px 20px;text-align:center;color:var(--text-muted);font-size:0.85rem">'+
      'Nenhum arquivo guardado ainda.<br>Compartilhe arquivos no chat com a Liz.</div>';
  }else{
    h+='<div style="padding:4px 14px 20px;display:flex;flex-direction:column;gap:6px">';
    files.forEach(function(f,i){
      const type=getType(f);
      const name=f.name||'arquivo';
      const date=new Date(f.timestamp||Date.now()).toLocaleDateString('pt-BR');
      const icon=type==='image'?imgIcon:fileIcon;

      h+='<div class="af-item" data-id="'+this._e(f.id)+'" data-type="'+type+'" '+
        'style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);'+
        'background:var(--surface-glass);border:1px solid var(--border);cursor:pointer;transition:background var(--t-fast)">'+
        '<span style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;'+
        'flex-shrink:0;color:'+(type==='image'?'var(--brand-light)':'var(--text-muted)')+'">'+icon+'</span>'+
        '<div style="flex:1;min-width:0"><div style="font-size:0.85rem;font-weight:500;color:var(--text);'+
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+this._e(name)+'</div>'+
        '<div style="font-size:0.68rem;color:var(--text-muted)">'+date+'</div></div>'+
        (type==='image'?'<span style="font-size:0.6rem;color:var(--brand-light);background:rgba(139,92,246,0.1);padding:2px 8px;border-radius:4px">imagem</span>':'')+
        '</div>';
    }.bind(this));
    h+='</div>';
  }

  p.innerHTML=h;

  // Event delegation
  if(!p.dataset.delegated){p.dataset.delegated='1';
    p.addEventListener('click',function(e){
      const item=e.target.closest('.af-item');
      if(!item)return;
      const id=item.dataset.id;
      LizData.loadUploadedFiles();
      const file=LizData.uploadedFiles.find(function(f){return f.id===id;});
      if(!file)return;
      if(file.type&&file.type.startsWith('image/')){
        App._previewImg(file.dataUrl,file.name);
      }else{
        App._toast(file.name);
      }
    });
  }
};

App._settings=function(){
  const p=document.getElementById('pSettings');if(!p)return;
  p.innerHTML='<div style="padding:16px 14px 8px"><h2 style="font-size:1.1rem;font-weight:700">Ajustes</h2></div><div class="sl">'+
    '<button class="si" data-s="appearance"><span>'+LizConfig.icons.sun+'</span><span>Aparência</span><span>'+LizConfig.icons.continue+'</span></button>'+
    '<button class="si" data-s="notifications"><span>'+LizConfig.icons.chats+'</span><span>Notificações</span><span>'+LizConfig.icons.continue+'</span></button>'+
    '<button class="si" data-s="chat"><span>'+LizConfig.icons.sparkle+'</span><span>Chat</span><span>'+LizConfig.icons.continue+'</span></button>'+
    '<button class="si" data-s="history"><span>'+LizConfig.icons.folder+'</span><span>Histórico</span><span>'+LizConfig.icons.continue+'</span></button>'+
    '<button class="si" data-s="shortcuts"><span>'+LizConfig.icons.code+'</span><span>Atalhos</span><span>'+LizConfig.icons.continue+'</span></button>'+
    '<button class="si" data-s="memory"><span>'+LizConfig.icons.filesMenu+'</span><span>Memória</span><span>'+LizConfig.icons.continue+'</span></button>'+
    '<button class="si" data-s="about"><span>'+LizConfig.icons.code+'</span><span>Sobre</span></button>'+
    '<button class="si" data-s="desktop"><span>'+LizConfig.icons.continue+'</span><span>Usar versão desktop</span><span>'+LizConfig.icons.continue+'</span></button></div>';

  p.querySelectorAll('.si[data-s]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const s=btn.dataset.s;
           if(s==='appearance')this._set('Aparência','<div class="set-toggle"><span>Tema escuro</span><label><input type="checkbox"'+(document.documentElement.getAttribute("data-theme")==='dark'?'checked':'')+' onchange="App._toggleTheme()"/><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div><div class="set-toggle"><span>Tema claro</span><label><input type="checkbox"'+(document.documentElement.getAttribute("data-theme")==='light'?'checked':'')+' onchange="App._toggleTheme()"/><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div><div style="font-size:0.8rem;color:var(--text-muted);padding-top:4px">Alterna entre escuro e claro</div>');
      else if(s==='notifications')this._set('Notificações','<div class="set-toggle"><span>Notificações</span><label><input type="checkbox" checked/><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div><div class="set-toggle"><span>Som</span><label><input type="checkbox" checked/><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>');
      else if(s==='chat')this._set('Chat','<div class="set-toggle"><span>Sugestões iniciais</span><label><input type="checkbox" checked/><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div><div class="set-toggle"><span>Animações</span><label><input type="checkbox" checked/><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div><div class="set-toggle"><span>Brilho roxo</span><label><input type="checkbox" checked/><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>');
      else if(s==='history')this._set('Histórico','<div style="font-size:0.85rem;color:var(--text-sec)">'+LizData.savedConversations.length+' conversas salvas</div><div style="font-size:0.85rem;color:var(--text-sec);margin-top:6px">Arquivos: '+LizData.uploadedFiles.length+'</div>');
      else if(s==='shortcuts')this._set('Atalhos','<div style="font-size:0.85rem;color:var(--text-sec)"><kbd style="background:rgba(139,92,246,0.1);padding:2px 6px;border-radius:4px;font-size:0.8rem">Enter</kbd> Enviar<br><kbd style="background:rgba(139,92,246,0.1);padding:2px 6px;border-radius:4px;font-size:0.8rem">Shift+Enter</kbd> Nova linha<br><kbd style="background:rgba(139,92,246,0.1);padding:2px 6px;border-radius:4px;font-size:0.8rem">Esc</kbd> Fechar<br></div>');
      else if(s==='memory')this._set('Memória','<div style="font-size:0.85rem;color:var(--text-sec)">Cache do navegador</div>');
      else if(s==='desktop')window.location.href='../?view=desktop';
      else this._toast('Liz Mobile — Liz Ai Studios');
    });
  });
};

App._openModal=function(t,h){const m=$('#modalOverlay');if(!m)return;$('#modalTitle').textContent=t;$('#modalBody').innerHTML=h;m.classList.add('show');};
App._closeModal=function(){const m=$('#modalOverlay');if(m)m.classList.remove('show');};
App._set=function(t,html){this._openModal(t,html);};

App._showConvs=function(){
  const groups=LizData.getConversationGroups();
  let html='<div style="padding:4px 0 12px;font-size:0.9rem;font-weight:600;color:var(--text)">Conversas</div>';
  if(!groups.length||groups.every(g=>!g.items.length)){
    html+='<div style="padding:20px 0;color:var(--text-muted);font-size:0.85rem;text-align:center">Nenhuma conversa ainda</div>';
  }else{
    groups.forEach(g=>{
      html+='<div style="font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin:8px 0 4px">'+this._e(g.period)+'</div>';
      g.items.forEach(it=>{
        html+='<div class="conv-card" data-id="'+this._e(it.id)+'" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);text-align:left;margin-bottom:4px;font-size:0.85rem;cursor:pointer">'+
          '<span style="width:16px;height:16px;opacity:0.25;flex-shrink:0">'+LizConfig.icons.chats+'</span>'+
          '<div data-open style="flex:1;min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px">'+(it.pinned?'<span style="color:var(--brand-light);display:inline-flex;flex-shrink:0"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg></span>':'')+this._e(it.title)+'</div>'+
          '<div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(it.preview?this._e(it.preview):'')+'</div></div>'+
          '<div style="display:flex;gap:2px;flex-shrink:0">'+
            '<button class="cv-act" data-act="pin" data-id="'+this._e(it.id)+'" aria-label="'+(it.pinned?'Desfixar':'Fixar')+'" title="'+(it.pinned?'Desfixar':'Fixar')+'" style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:'+(it.pinned?'var(--brand-light)':'var(--text-muted)')+';opacity:'+(it.pinned?'1':'0.6')+'">'+(it.pinned?'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg>':'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg>')+'</button>'+
            '<button class="cv-act" data-act="rename" data-id="'+this._e(it.id)+'" aria-label="Renomear" title="Renomear" style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);opacity:0.6"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'+
            '<button class="cv-act" data-act="delete" data-id="'+this._e(it.id)+'" aria-label="Excluir" title="Excluir" style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);opacity:0.6"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'+
          '</div></div>';
      });
    });
  }
  this._openModal('Histórico',html);
  const modal=$('#modal');
  setTimeout(()=>{
    if(!modal)return;
    // Delegação: abrir, fixar, renomear, excluir
    modal.querySelectorAll('.conv-card').forEach(card=>{
      card.addEventListener('click',async(e)=>{
        const actBtn=e.target.closest('.cv-act');
        const id=card.dataset.id;
        if(actBtn){
          e.stopPropagation();
          const act=actBtn.dataset.act;
          if(act==='pin'){LizData.togglePinConversation(id);this._showConvs();}
          else if(act==='rename'){
            const conv=LizData.getConversationById(id);
            this._inputModal('Renomear conversa','Novo título','Salvar',(v)=>{
              if(LizData.renameConversation(id,v)){this._toast('Conversa renomeada');this._showConvs();}
            });
            const inp=$('#lizModalInput');if(inp&&conv)inp.value=conv.title;
          }
          else if(act==='delete'){
            this._confirmModal('Excluir conversa','Tem certeza que deseja excluir esta conversa? Essa ação não pode ser desfeita.','Excluir',true,()=>{
              LizData.deleteConversation(id);this._toast('Conversa excluída');this._showConvs();
            });
          }
          return;
        }
        // Clique normal → abre a conversa completa
        let s=LizData.getConversationById(id);
        if(!s)return;
        if(!String(id).startsWith('local_')&&LizData.isBackendOnline){
          try{
            const remote=await LizAPI.getConversation(id);
            s=LizAPI.mapConversationToFrontend(remote);
            const index=LizData.savedConversations.findIndex(c=>String(c.id)===String(id));
            if(index>=0){LizData.savedConversations[index]=s;LizData._persistToLocalStorage();}
          }catch(err){console.warn('[Liz Mobile] Não foi possível carregar a conversa completa:',err.message);}
        }
        if(s.messages&&s.messages.length){
          this.msgs=s.messages.map(m=>({...m}));
          this.title=s.title;
          this.convId=s.id;
          this.backendConversationId=String(s.id).startsWith('local_')?null:s.id;
          this._closeModal();
          $('#pChat .empty').classList.add('is-hidden');
          $('#pChat .msg-list').classList.remove('is-hidden');
          this._render();
          $('#hSub').textContent=s.title;
          this._hydrateRemoteFiles();
        }
      });
    });
  },100);
};

App._hydrateRemoteFiles=async function(){
  const pendingFiles=this.msgs.filter(m=>m.file?.uploadId&&!m.file.dataUrl);
  const pendingImages=[];
  this.msgs.forEach(m=>(m.images||[]).forEach(image=>{if(image.uploadId&&!image.url)pendingImages.push(image);}));
  if(!pendingFiles.length&&!pendingImages.length)return;
  await Promise.all([
    ...pendingFiles.map(async m=>{
      try{m.file.dataUrl=await LizAPI.getUploadDataUrl(m.file.uploadId);}catch(e){console.warn('[Liz Mobile] Anexo não carregado:',e.message);}
    }),
    ...pendingImages.map(async image=>{
      try{image.url=await LizAPI.getUploadDataUrl(image.uploadId);}catch(e){console.warn('[Liz Mobile] Imagem da IA não carregada:',e.message);}
    }),
  ]);
  this._render();
};

App._goChat=function(){
  document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('is-active'));
  document.getElementById('pChat')?.classList.add('is-active');
  const bar=$('.tools-bar');if(bar){bar.classList.remove('is-collapsed');bar.classList.add('is-expanded');}
  const bb=document.getElementById('backBtn');if(bb)bb.style.display='none';
  const ct=document.getElementById('crownToggle');if(ct)ct.style.display='';
  const hs=document.getElementById('hSep');if(hs)hs.style.display='none';
  const hu=document.getElementById('hSub');if(hu)hu.textContent='';
  const ht=document.getElementById('ht');if(ht)ht.textContent='Liz';
  $$('.tool-pill').forEach(pill=>pill.classList.toggle('is-active',pill.dataset.t==='chat'));
  App.tab='chat';
};

App._newChat=function(){
  if(this.isGenerating)this._stopReply();
  if(this.msgs.length>0)this._save();
  this.msgs=[];this.title=null;this.convId=null;this.backendConversationId=null;this._remoteConversationPromise=null;this._stopRequested=false;
  $('#ci').value='';$('#sb').disabled=true;
  $('#pChat .empty').classList.remove('is-hidden');$('#pChat .msg-list').classList.add('is-hidden');$('#pChat .msg-list').innerHTML='';
  $('#hSub').textContent='';
  // Volta pro chat
  const first=$('.tool-pill[data-t="chat"]');if(first)first.click();
};

App._toast=function(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(this._tt);this._tt=setTimeout(()=>t.classList.remove('show'),2000);};

window.App=App;
document.addEventListener('DOMContentLoaded',()=>App.init());
})();
