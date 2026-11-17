(()=>{'use strict';
const $=id=>document.getElementById(id);
const state={assets:[],clips:[],selected:null,zoom:1,playing:false,history:[],future:[],extraTracks:0};
const video=$('previewVideo'),img=$('previewImage');
let currentProjectId=null,saveTimer=null,dbPromise=null,isRestoring=false;
function openProjectDB(){
 if(!('indexedDB'in window))return Promise.reject(new Error('IndexedDB غير مدعوم في هذا المتصفح'));
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('SeifVideoStudioProjects',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 return dbPromise;
}
function dbAction(mode,action,value){
 return openProjectDB().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction('projects',mode),store=tx.objectStore('projects');let req;if(action==='put')req=store.put(value);else if(action==='get')req=store.get(value);else if(action==='all')req=store.getAll();else if(action==='delete')req=store.delete(value);if(req){req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}else resolve()}));
}
function projectPayload(){
 return {id:currentProjectId||('project-'+Date.now()),name:currentProjectName(),updatedAt:Date.now(),clips:state.clips,selected:state.selected,zoom:state.zoom,extraTracks:state.extraTracks,aspect:$('aspectSelect').value,fps:$('fpsSelect').value,assets:state.assets.map(a=>({id:a.id,name:a.name,kind:a.kind,duration:a.duration,text:a.text,x:a.x,y:a.y,blob:a.file||a.blob||null}))};
}
let projectName='مشروع جديد';
function currentProjectName(){return projectName}
function scheduleSave(){if(isRestoring)return; if(!currentProjectId){currentProjectId='project-'+Date.now();projectName='مشروع '+new Date().toLocaleString('ar-TN')}$('saveState').textContent='● جارٍ الحفظ...';clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProject(false),700)}
async function saveProject(manual=true){
 clearTimeout(saveTimer);if(!currentProjectId){currentProjectId='project-'+Date.now();projectName='مشروع '+new Date().toLocaleString('ar-TN')}
 try{const p=projectPayload();await dbAction('readwrite','put',p);$('saveState').textContent='● محفوظ تلقائيًا';if(manual)toast('تم حفظ المشروع بنجاح');renderProjectHistory();return true}
 catch(err){$('saveState').textContent='● تعذّر الحفظ';if(manual)toast('تعذّر الحفظ المحلي: '+(err.message||'خطأ في التخزين'));return false}
}
async function renderProjectHistory(){
 const root=$('projectList');if(!root)return;root.innerHTML='';
 try{const projects=(await dbAction('readonly','all')).sort((a,b)=>b.updatedAt-a.updatedAt);if(!projects.length){root.innerHTML='<div class="project-empty">لا توجد مشاريع محفوظة بعد.<br>ابدأ مشروعك وسيُحفظ تلقائيًا.</div>';return}
 projects.forEach(p=>{const card=document.createElement('div');card.className='project-entry';const title=document.createElement('b');title.textContent=p.name||'مشروع دون اسم';const meta=document.createElement('small');meta.textContent=new Date(p.updatedAt).toLocaleString('ar-TN')+' • '+(p.assets||[]).length+' وسائط • '+(p.clips||[]).length+' مقاطع';const open=document.createElement('button');open.textContent='فتح المشروع';open.onclick=()=>loadProject(p.id);const del=document.createElement('button');del.className='remove-project';del.textContent='حذف';del.onclick=async()=>{if(confirm('حذف هذا المشروع نهائيًا من سجل هذا المتصفح؟')){await dbAction('readwrite','delete',p.id);if(currentProjectId===p.id)currentProjectId=null;renderProjectHistory()}};card.append(title,meta,open,del);root.append(card)})
 }catch(e){root.innerHTML='<div class="project-empty">التخزين المحلي غير متاح في هذا المتصفح.</div>'}
}
async function loadProject(id){
 try{const p=await dbAction('readonly','get',id);if(!p)return;isRestoring=true;video.pause();state.assets.forEach(a=>{if(a.url)URL.revokeObjectURL(a.url)});state.assets=(p.assets||[]).map(a=>{const blob=a.blob||null;return {...a,blob,file:blob,url:blob?URL.createObjectURL(blob):''}});state.clips=p.clips||[];state.selected=p.selected||null;state.zoom=p.zoom||1;state.extraTracks=p.extraTracks||0;currentProjectId=p.id;projectName=p.name||'مشروع محفوظ';$('aspectSelect').value=p.aspect||'16:9';$('fpsSelect').value=p.fps||'30 FPS';$('assetPanel').classList.remove('history-mode','templates-mode');document.querySelectorAll('.tool').forEach(x=>x.classList.toggle('active',x.dataset.tool==='media'));$('assetTitle').textContent='الوسائط';$('assetSubtitle').textContent='أضف الفيديوهات والصور إلى مشروعك';$('tracks').querySelectorAll('.track[data-extra="true"]').forEach(x=>x.remove());renderAssets();renderClips();selectClip(state.selected);const first=state.clips.find(c=>c.id===state.selected)||state.clips[0];if(first){const a=state.assets.find(x=>x.id===first.assetId);if(a&&a.url&&a.kind!=='audio')preview(a)}else{$('previewEmpty').style.display='flex';video.style.display='none';img.style.display='none'}$('saveState').textContent='● تم فتح المشروع';isRestoring=false;toast('تم فتح المشروع المحفوظ')}
 catch(e){isRestoring=false;toast('تعذّر فتح المشروع: '+e.message)}
}
function startNewProject(){if(state.assets.length||state.clips.length)saveProject(false);video.pause();state.assets.forEach(a=>a.url&&URL.revokeObjectURL(a.url));state.assets=[];state.clips=[];state.selected=null;state.zoom=1;state.history=[];state.future=[];currentProjectId=null;projectName='مشروع جديد';video.removeAttribute('src');video.load();video.style.display='none';img.style.display='none';$('previewEmpty').style.display='flex';$('timecode').textContent=time(0);$('duration').textContent=time(0);renderAssets();renderClips();selectClip(null);toast('بدأ مشروع جديد')}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject(true)}});
window.addEventListener('pagehide',()=>{if(currentProjectId){const p=projectPayload();dbAction('readwrite','put',p).catch(()=>{})}});

const templateData=[
{n:'زفاف ذهبي فاخر',c:'الأعراس',t:'video',d:'سينمائي • 16:9',q:'wedding'},
{n:'قصة حب العروسين',c:'الأعراس',t:'video',d:'رومانسي • 16:9',q:'wedding'},
{n:'دخول العروس',c:'الأعراس',t:'video',d:'درامي • 16:9',q:'wedding'},
{n:'دعوة زفاف أنيقة',c:'الأعراس',t:'video',d:'دعوة • 9:16',q:'wedding'},
{n:'فيلم يوم الزفاف',c:'الأعراس',t:'video',d:'ذكريات • 16:9',q:'wedding'},
{n:'زفاف أبيض ووردي',c:'الأعراس',t:'photo',d:'ألبوم صور • 1:1',q:'wedding'},
{n:'ألبوم العروسين',c:'الأعراس',t:'photo',d:'كولاج • 4:5',q:'wedding'},
{n:'لحظات كتب الكتاب',c:'الأعراس',t:'video',d:'هادئ • 9:16',q:'wedding'},
{n:'ذكريات الخطوبة',c:'الخطوبة والحب',t:'video',d:'رومانسي • 9:16',q:'engagement'},
{n:'طلب الزواج',c:'الخطوبة والحب',t:'photo',d:'صور • 1:1',q:'wedding'},
{n:'ذكرى الزواج',c:'الخطوبة والحب',t:'video',d:'عرض شرائح • 16:9',q:'anniversary'},
{n:'قصة حب سينمائية',c:'الخطوبة والحب',t:'video',d:'فيلم • 16:9',q:'wedding'},
{n:'عيد ميلاد مبهج',c:'أعياد الميلاد',t:'video',d:'احتفالي • 9:16',q:'birthday'},
{n:'ألبوم عيد الميلاد',c:'أعياد الميلاد',t:'photo',d:'صور • 1:1',q:'birthday'},
{n:'تخرج ذهبي',c:'التخرج',t:'video',d:'احتفالي • 16:9',q:'graduation'},
{n:'ذكريات العائلة',c:'العائلة',t:'photo',d:'ألبوم • 4:5',q:'family'},
{n:'رحلة ومغامرة',c:'السفر',t:'video',d:'سينمائي • 16:9',q:'travel'},
{n:'ملخص رحلة',c:'السفر',t:'photo',d:'كولاج • 1:1',q:'travel'},
{n:'إعلان منتج فاخر',c:'إعلانات',t:'video',d:'ترويجي • 9:16',q:'promo'},
{n:'عرض متجر',c:'إعلانات',t:'photo',d:'منتج • 1:1',q:'promo'},
{n:'Gaming Highlights',c:'الألعاب',t:'video',d:'حماسي • 16:9',q:'gaming'},
{n:'أنمي AMV',c:'الألعاب',t:'video',d:'إيقاعي • 9:16',q:'gaming'},
{n:'Lyrics متحرك',c:'الموسيقى',t:'video',d:'نصوص • 9:16',q:'music'},
{n:'ذكريات الأطفال',c:'العائلة',t:'photo',d:'ألبوم • 4:5',q:'family'}
];
let activeTemplateCat='الكل';
function renderTemplateLibrary(){
 const cats=['الكل','الأعراس','الخطوبة والحب','أعياد الميلاد','التخرج','العائلة','السفر','إعلانات','الألعاب','الموسيقى'];
 $('templateCats').innerHTML='';
 cats.forEach(c=>{const b=document.createElement('button');b.className='template-cat'+(activeTemplateCat===c?' active':'');b.textContent=c;b.onclick=()=>{activeTemplateCat=c;renderTemplateLibrary()};$('templateCats').append(b)});
 const term=($('templateSearch').value||'').trim().toLowerCase(),kind=$('templateType').value;
 const items=templateData.filter(x=>(activeTemplateCat==='الكل'||x.c===activeTemplateCat)&&(kind==='all'||x.t===kind)&&(!term||(x.n+' '+x.c+' '+x.d).toLowerCase().includes(term)));
 $('templateGrid').innerHTML='';
 items.forEach(x=>{const card=document.createElement('article');card.className='template-card';const art=document.createElement('div');art.className='template-art '+(x.t==='photo'?'photo':'');art.textContent=x.n;const info=document.createElement('div');info.className='template-info';const title=document.createElement('b');title.textContent=x.n;const meta=document.createElement('small');meta.textContent=(x.t==='photo'?'قالب صور':'قالب فيديو')+' • '+x.d;const a=document.createElement('a');a.className='template-open';a.target='_blank';a.rel='noopener';a.href='https://www.flexclip.com/template/?search='+encodeURIComponent(x.q);a.textContent='ابحث عن أمثلة مشابهة في FlexClip ↗';info.append(title,meta,a);card.append(art,info);$('templateGrid').append(card)});
 if(!items.length)$('templateGrid').textContent='لا توجد نتائج مطابقة.';
}

function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2300)}
function time(s){if(!Number.isFinite(s))s=0;const h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=Math.floor(s%60),ms=Math.floor(s%1*1000);return [h,m,sec].map(x=>String(x).padStart(2,'0')).join(':')+'.'+String(ms).padStart(3,'0')}
function snapshot(){state.history.push(JSON.stringify({clips:state.clips,selected:state.selected}));if(state.history.length>40)state.history.shift();state.future=[]}
function updateSave(){ $('saveState').textContent='● الحفظ التلقائي جاهز';}
function duration(a){return a.duration||5}
function seekBy(seconds){if(!Number.isFinite(video.duration))return;video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+seconds));$('timecode').textContent=time(video.currentTime)}
function renderOverlayElements(){const root=$('previewOverlay');root.innerHTML='';const t=video.currentTime||0;state.clips.filter(c=>c.track==='text'||c.track==='overlay').forEach(c=>{if(t<c.offset||t>c.offset+c.duration)return;const a=state.assets.find(x=>x.id===c.assetId);if(!a||!['text','sticker'].includes(a.kind))return;const el=document.createElement('div');el.className='canvas-item '+(a.kind==='sticker'?'canvas-sticker':'canvas-text');el.textContent=a.text||a.name;el.style.left=(a.x??50)+'%';el.style.top=(a.y??50)+'%';el.style.transform='translate(-50%,-50%)';el.onpointerdown=e=>{e.preventDefault();const rect=$('previewStage').getBoundingClientRect(),sx=e.clientX,sy=e.clientY,ox=a.x??50,oy=a.y??50;el.setPointerCapture(e.pointerId);const move=ev=>{a.x=Math.max(0,Math.min(100,ox+(ev.clientX-sx)/rect.width*100));a.y=Math.max(0,Math.min(100,oy+(ev.clientY-sy)/rect.height*100));el.style.left=a.x+'%';el.style.top=a.y+'%'};const end=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);scheduleSave()};el.addEventListener('pointermove',move);el.addEventListener('pointerup',end)};root.append(el)})}
function makeOverlayAsset(kind){const text=prompt(kind==='text'?'اكتب النص الذي تريد وضعه فوق الفيديو:':'اكتب رمزًا أو ملصقًا (مثال: ⭐ ❤️ 🔥):');if(!text)return;const a={id:String(Date.now()+Math.random()),name:kind==='text'?'نص: '+text.slice(0,18):'ملصق '+text.slice(0,12),kind,text,duration:5,x:50,y:50};state.assets.push(a);const c={id:String(Date.now()+Math.random()),assetId:a.id,start:0,offset:video.currentTime||0,duration:5,track:'text'};state.clips.push(c);state.selected=c.id;renderAssets();renderClips();selectClip(c.id);renderOverlayElements();scheduleSave();toast('أُضيف العنصر — اسحبه مباشرة داخل المعاينة')}
function enableTimelineDragging(el,c){el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const startX=e.clientX,originalOffset=c.offset,pxPerSecond=12*state.zoom;let targetLane=el.parentElement;el.classList.add('dragging');el.setPointerCapture(e.pointerId);const move=ev=>{const dx=ev.clientX-startX;el.style.right=Math.max(0,(originalOffset*pxPerSecond)-dx)+'px';const under=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.track-lane');if(under)targetLane=under};const end=ev=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.classList.remove('dragging');const dx=ev.clientX-startX;c.offset=Math.max(0,originalOffset-dx/pxPerSecond);if(targetLane?.dataset.track)c.track=targetLane.dataset.track;renderClips();scheduleSave();toast('تم نقل المقطع وتغيير موضعه')};el.addEventListener('pointermove',move);el.addEventListener('pointerup',end)})}
function enableAssetDrop(){document.querySelectorAll('.track-lane').forEach(lane=>{lane.ondragover=e=>{e.preventDefault();lane.classList.add('drop-target')};lane.ondragleave=()=>lane.classList.remove('drop-target');lane.ondrop=e=>{e.preventDefault();lane.classList.remove('drop-target');const id=e.dataTransfer.getData('text/asset-id'),a=state.assets.find(x=>x.id===id);if(!a)return;const rect=lane.getBoundingClientRect(),offset=Math.max(0,(rect.right-e.clientX)/(12*state.zoom));const c={id:String(Date.now()+Math.random()),assetId:a.id,start:0,offset,duration:duration(a),track:lane.dataset.track};snapshot();state.clips.push(c);state.selected=c.id;renderClips();selectClip(c.id);toast('أُسقط الملف في المسار المحدد')}})}
function renderAssets(){ $('mediaCount').textContent=state.assets.length;const root=$('assetList');root.innerHTML='';if(!state.assets.length){root.innerHTML='<div class="empty-assets">مكتبتك فارغة حاليًا<br><small>ابدأ بإضافة ملفاتك</small></div>';return}state.assets.forEach(a=>{const el=document.createElement('div');el.className='asset-card'+(state.selected===a.id?' selected':'');el.draggable=true;el.ondragstart=e=>e.dataTransfer.setData('text/asset-id',a.id);el.innerHTML='<div class="asset-thumb">'+(a.kind==='image'?'<img alt="">':a.kind==='video'?'<span>▶</span>':a.kind==='text'?'T':a.kind==='sticker'?'✦':'♫')+'</div><div class="asset-name"></div>';if(a.kind==='image')el.querySelector('img').src=a.url;el.querySelector('.asset-name').textContent=a.name;el.onclick=()=>addClip(a);root.append(el)})}
function addClip(a){snapshot();const c={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),assetId:a.id,start:0,offset:state.clips.filter(x=>x.track===a.kind).reduce((m,x)=>Math.max(m,x.start+x.duration),0),duration:duration(a),track:a.kind==='audio'?'audio':a.kind==='image'?'video':'video'};state.clips.push(c);state.selected=c.id;renderClips();selectClip(c.id);if(a.kind!=='audio')preview(a);toast('أُضيف المقطع إلى الخط الزمني')}
function preview(a){const src=a.url;if(a.kind==='video'){img.style.display='none';video.style.display='block';video.src=src;video.load();$('previewEmpty').style.display='none';video.onloadedmetadata=()=>{$('duration').textContent=time(video.duration);const c=state.clips.find(x=>x.assetId===a.id);if(c)c.duration=video.duration;renderClips()}}else if(a.kind==='image'){video.pause();video.style.display='none';img.src=src;img.style.display='block';$('previewEmpty').style.display='none';$('duration').textContent=time(5)}}
function renderClips(){scheduleSave();document.querySelectorAll('.track-lane').forEach(l=>l.innerHTML='');state.clips.forEach(c=>{let lane=document.querySelector('.track-lane[data-track="'+c.track+'"]');if(!lane)return;const a=state.assets.find(x=>x.id===c.assetId);if(!a)return;const el=document.createElement('div');el.className='clip '+(a.kind==='image'?'image':a.kind==='audio'?'audio':a.kind==='text'||a.kind==='sticker'?'text-clip':'')+(state.selected===c.id?' selected':'');el.style.right=(c.offset*12*state.zoom)+'px';el.style.width=Math.max(50,c.duration*12*state.zoom)+'px';el.textContent=a.name;el.onclick=()=>{selectClip(c.id);if(a.kind==='video'||a.kind==='image')preview(a)};enableTimelineDragging(el,c);lane.append(el)});$('zoomValue').textContent=Math.round(state.zoom*100)+'%';enableAssetDrop();renderOverlayElements()}
function selectClip(id){state.selected=id;const c=state.clips.find(x=>x.id===id);renderClips();if(!c){$('inspectorContent').innerHTML='<div class="inspector-empty"><span>✧</span><b>اختر مقطعًا</b></div>';return}const a=state.assets.find(x=>x.id===c.assetId);$('inspectorContent').innerHTML='<div class="prop-row"><label>اسم الملف</label><div>'+a.name.replace(/[<>&"]/g,'')+'</div></div><div class="prop-row"><label>مدة المقطع <b id="durVal">'+c.duration.toFixed(2)+' ث</b></label><input id="durRange" type="range" min=".2" max="'+Math.max(1,c.duration*2)+'" step=".1" value="'+c.duration+'"></div><div class="prop-row"><label>موضع المقطع <b id="posVal">'+c.offset.toFixed(2)+' ث</b></label><input id="posRange" type="range" min="0" max="120" step=".1" value="'+c.offset+'"></div><div class="prop-row"><label>الشفافية <b>100%</b></label><input type="range" min="0" max="100" value="100" disabled></div><small style="color:#777;font-size:9px">أدوات الخصائص المتقدمة ستضاف ضمن مراحل التطوير.</small>';$('durRange').oninput=e=>{c.duration=+e.target.value;$('durVal').textContent=c.duration.toFixed(2)+' ث';renderClips()};$('posRange').oninput=e=>{c.offset=+e.target.value;$('posVal').textContent=c.offset.toFixed(2)+' ث';renderClips()}}
$('mediaInput').onchange=e=>{[...e.target.files].forEach(f=>{const kind=f.type.startsWith('video/')?'video':f.type.startsWith('image/')?'image':f.type.startsWith('audio/')?'audio':null;if(!kind)return;const a={id:String(Date.now()+Math.random()),name:f.name,file:f,kind,url:URL.createObjectURL(f),duration:kind==='image'?5:0};if(kind==='video'){const v=document.createElement('video');v.preload='metadata';v.src=a.url;v.onloadedmetadata=()=>{a.duration=v.duration}}if(kind==='audio'){const au=new Audio();au.src=a.url;au.onloadedmetadata=()=>a.duration=au.duration}state.assets.push(a)});renderAssets();scheduleSave();toast('تم استيراد '+e.target.files.length+' ملف');e.target.value=''};
$('playBtn').onclick=()=>{if(video.style.display==='block'){if(video.paused){video.play();$('playBtn').textContent='Ⅱ'}else{video.pause();$('playBtn').textContent='▶'}}else toast('اختر مقطع فيديو للمعاينة')};
video.ontimeupdate=()=>{$('timecode').textContent=time(video.currentTime);$('playhead').style.right=(91+video.currentTime*12*state.zoom)+'px';$('bubblePlay').textContent=video.paused?'▶':'Ⅱ';renderOverlayElements()};
$('backBtn').onclick=()=>seekBy(-5);$('forwardBtn').onclick=()=>seekBy(5);$('bubbleBack').onclick=()=>seekBy(-5);$('bubbleForward').onclick=()=>seekBy(5);$('bubblePlay').onclick=()=>{if(video.paused)video.play().catch(()=>{});else video.pause();};
const bubble=$('floatingTransport'),stage=$('previewStage'),grip=$('bubbleGrip');let bubbleDrag=null;grip.addEventListener('pointerdown',e=>{e.preventDefault();const r=stage.getBoundingClientRect(),b=bubble.getBoundingClientRect();bubbleDrag={x:e.clientX,y:e.clientY,left:b.left-r.left,top:b.top-r.top};grip.setPointerCapture(e.pointerId)});grip.addEventListener('pointermove',e=>{if(!bubbleDrag)return;const r=stage.getBoundingClientRect();bubble.style.left=Math.max(0,Math.min(r.width-bubble.offsetWidth,bubbleDrag.left+e.clientX-bubbleDrag.x))+'px';bubble.style.top=Math.max(0,Math.min(r.height-bubble.offsetHeight,bubbleDrag.top+e.clientY-bubbleDrag.y))+'px';bubble.style.right='auto';bubble.style.bottom='auto'});grip.addEventListener('pointerup',()=>bubbleDrag=null);
$('splitBtn').onclick=()=>{const c=state.clips.find(x=>x.id===state.selected);if(!c){toast('اختر مقطعًا أولًا');return}const a=state.assets.find(x=>x.id===c.assetId);if(a.kind==='audio'){toast('تقسيم الصوت قيد التطوير');return}const t=video.currentTime;if(t<=c.start||t>=c.start+c.duration){toast('حرّك مؤشر التشغيل إلى داخل المقطع');return}snapshot();const second={...c,id:String(Date.now()),offset:c.offset+(t-c.start),start:t,duration:c.duration-(t-c.start)};c.duration=t-c.start;state.clips.push(second);state.selected=second.id;renderClips();selectClip(second.id);toast('تم تقسيم المقطع عند موضع التشغيل')};
$('deleteBtn').onclick=()=>{if(!state.selected){toast('اختر مقطعًا أولًا');return}snapshot();state.clips=state.clips.filter(c=>c.id!==state.selected);state.selected=null;renderClips();selectClip(null);toast('تم حذف المقطع من الخط الزمني')};
$('muteBtn').onclick=()=>{video.muted=!video.muted;$('muteBtn').querySelector('span').textContent=video.muted?'إلغاء الكتم':'كتم الصوت';toast(video.muted?'تم كتم الصوت':'تم تشغيل الصوت')};
$('fitBtn').onclick=()=>{video.style.objectFit=video.style.objectFit==='cover'?'contain':'cover';img.style.objectFit=img.style.objectFit==='cover'?'contain':'cover'};
$('fullscreenBtn').onclick=()=>{$('previewStage').requestFullscreen?.()};
$('zoomIn').onclick=()=>{state.zoom=Math.min(4,state.zoom+.2);renderClips()};$('zoomOut').onclick=()=>{state.zoom=Math.max(.4,state.zoom-.2);renderClips()};
$('addTrack').onclick=()=>{state.extraTracks++;const row=document.createElement('div');row.className='track';row.innerHTML='<div class="track-label">＋ <span>مسار '+state.extraTracks+'</span></div><div class="track-lane" data-track="extra'+state.extraTracks+'"></div>';$('tracks').append(row);scheduleSave();toast('تمت إضافة مسار جديد')};
$('addTextBtn').onclick=()=>makeOverlayAsset('text');$('addStickerBtn').onclick=()=>makeOverlayAsset('sticker');
$('exportBtn').onclick=()=>{if(!state.clips.length){toast('أضف مقطع فيديو أو صورة أولًا');return}$('exportDialog').hidden=false};
$('closeExportBtn').onclick=()=>{$('exportDialog').hidden=true};
$('flexclipOpenBtn').onclick=()=>{$('flexclipEmbed').hidden=false;$('flexclipFrame').src='https://www.flexclip.com/templates/'};
$('flexclipCloseBtn').onclick=()=>{$('flexclipEmbed').hidden=true};
async function exportTimeline(){
 const button=$('startExportBtn'),status=$('exportStatus'),progress=$('exportProgress'),bar=$('exportProgressBar');
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('التصدير غير مدعوم في هذا المتصفح. جرّب متصفحًا أحدث.');return}
 const [w,h]=$('exportQuality').value.split('x').map(Number),fps=+$('exportFps').value;
 const clips=state.clips.filter(c=>{const a=state.assets.find(x=>x.id===c.assetId);return a&&(a.kind==='video'||a.kind==='image')}).slice().sort((a,b)=>a.offset-b.offset);
 if(!clips.length){toast('لا توجد مقاطع فيديو أو صور قابلة للتصدير');return}
 const end=Math.max(...clips.map(c=>c.offset+c.duration));if(!Number.isFinite(end)||end<=0){toast('مدة المشروع غير صالحة');return}
 button.disabled=true;progress.hidden=false;bar.style.width='0%';status.textContent='جارٍ تجهيز الوسائط...';
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 const stream=canvas.captureStream(fps);let recorder;
 try{
  const media=[];
  for(const c of clips){const a=state.assets.find(x=>x.id===c.assetId);if(a.kind==='image'){const im=new Image();im.src=a.url;await new Promise((res,rej)=>{im.onload=res;im.onerror=rej});media.push({c,a,el:im})}else{const v=document.createElement('video');v.src=a.url;v.muted=true;v.playsInline=true;v.preload='auto';await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=rej});media.push({c,a,el:v})}}
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))||'';
  recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks=[];
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>reject(new Error('تعذّر تسجيل الفيديو'))});
  ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);recorder.start(500);
  let started=performance.now(),last=0,activeVideo=null;
  async function frame(){
   const elapsed=(performance.now()-started)/1000, t=Math.min(end,elapsed);
   ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
   const active=media.filter(m=>t>=m.c.offset&&t<m.c.offset+m.c.duration);
   if(active.length){const m=active[active.length-1],el=m.el;
    if(m.a.kind==='video'){
     if(activeVideo!==el){if(activeVideo)activeVideo.pause();activeVideo=el;try{await el.play()}catch(e){}}
     const target=(m.c.start||0)+(t-m.c.offset);if(Math.abs(el.currentTime-target)>.35){try{el.currentTime=Math.min(target,Math.max(0,(el.duration||target)-.05))}catch(e){}}
    }
    const ew=el.videoWidth||el.naturalWidth||w,eh=el.videoHeight||el.naturalHeight||h,scale=Math.min(w/ew,h/eh),dw=ew*scale,dh=eh*scale;
    try{ctx.drawImage(el,(w-dw)/2,(h-dh)/2,dw,dh)}catch(e){}
   }
   if(t-last>=.5){last=t;bar.style.width=Math.round(t/end*100)+'%';status.textContent='جارٍ التصدير: '+Math.round(t/end*100)+'%'}
   if(t>=end){if(activeVideo)activeVideo.pause();recorder.stop();return}
   requestAnimationFrame(frame)
  }
  await frame();await done;
  const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='SEIF-VIDEO-STUDIO-'+w+'x'+h+'.webm';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='اكتمل التصدير — تم تنزيل ملف WebM';bar.style.width='100%';toast('تم تنزيل الفيديو بنجاح');
 }catch(err){status.textContent='فشل التصدير: '+(err.message||'خطأ غير معروف');toast('تعذّر التصدير. جرّب دقة أقل أو متصفحًا أحدث')}
 finally{stream.getTracks().forEach(t=>t.stop());button.disabled=false}
}
$('startExportBtn').onclick=exportTimeline;
$('undoBtn').onclick=()=>{if(!state.history.length){toast('لا توجد خطوات للتراجع');return}state.future.push(JSON.stringify({clips:state.clips,selected:state.selected}));const s=JSON.parse(state.history.pop());state.clips=s.clips;state.selected=s.selected;renderClips();selectClip(state.selected);};
$('redoBtn').onclick=()=>{if(!state.future.length){toast('لا توجد خطوات للإعادة');return}state.history.push(JSON.stringify({clips:state.clips,selected:state.selected}));const s=JSON.parse(state.future.pop());state.clips=s.clips;state.selected=s.selected;renderClips();selectClip(state.selected)};
$('saveProjectBtn').onclick=()=>saveProject(true);$('newProjectBtn').onclick=startNewProject;
$('templateSearch').oninput=renderTemplateLibrary;$('templateType').onchange=renderTemplateLibrary;
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tool').forEach(x=>x.classList.remove('active'));b.classList.add('active');const labels={history:['سجل الأعمال','مشاريعك السابقة والحفظ التلقائي'],media:['الوسائط','أضف الفيديوهات والصور إلى مشروعك'],audio:['الصوت','إدارة الموسيقى والتعليق الصوتي'],text:['النصوص','عناوين وكتابة متحركة'],effects:['المؤثرات','مؤثرات بصرية وانتقالات حركية'],filters:['الفلاتر','أنماط لونية جاهزة'],transitions:['الانتقالات','انتقالات بين المشاهد'],adjust:['الألوان','تصحيح وتدرج لوني'],layers:['الطبقات','إدارة عناصر المشروع']};const x=b.dataset.tool==='templates'?['القوالب','مكتبة قوالب الفيديو والصور']:labels[b.dataset.tool];$('assetTitle').textContent=x[0];$('assetSubtitle').textContent=x[1];$('assetPanel').classList.toggle('templates-mode',b.dataset.tool==='templates');$('assetPanel').classList.toggle('history-mode',b.dataset.tool==='history');if(b.dataset.tool==='templates')renderTemplateLibrary();else if(b.dataset.tool==='history')renderProjectHistory();else if(b.dataset.tool!=='media')toast('قسم '+x[0]+' سيُفعّل بأدواته في التحديثات القادمة')});
$('aspectSelect').onchange=e=>{const [w,h]=e.target.value.split(':').map(Number);$('previewStage').style.aspectRatio=w+'/'+h;scheduleSave();toast('تم تغيير نسبة المعاينة')};
$('fpsSelect').onchange=()=>{scheduleSave();toast('تم تحديث إعداد معدل الإطارات للمشروع')};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
updateSave();renderProjectHistory();
})();