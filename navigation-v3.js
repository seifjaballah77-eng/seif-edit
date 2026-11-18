(()=>{'use strict';
const root=document.querySelector('.tools-panel'),workspace=document.querySelector('.workspace');if(!root||!workspace)return;
const order=['media','text','audio','effects','transitions','filters','adjust','layers','templates','history'];
const map=new Map([...root.querySelectorAll('.tool')].map(b=>[b.dataset.tool,b]));
order.forEach(k=>{const b=map.get(k);if(b)root.append(b)});
const note=root.querySelector('.tool-note');if(note)note.remove();
const shortcuts=[
 {id:'nav-cut',label:'القص والترتيب',icon:'✂',target:'.timeline-head'},
 {id:'nav-properties',label:'خصائص المقطع',icon:'⚙',target:'.inspector'},
 {id:'nav-export',label:'تصدير',icon:'⇧',action:()=>$('exportBtn')?.click()}
];
function $(id){return document.getElementById(id)}
shortcuts.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='tool nav-shortcut';b.id=s.id;b.innerHTML='<i>'+s.icon+'</i><span>'+s.label+'</span>';b.addEventListener('click',()=>{if(s.action){s.action();return}const el=document.querySelector(s.target);el?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});root.querySelectorAll('.tool').forEach(x=>x.classList.remove('active'));b.classList.add('active')});root.append(b)});
const css=document.createElement('style');css.textContent=`
.workspace{grid-template-columns:250px minmax(0,1fr) 270px!important;grid-template-rows:auto minmax(0,1fr)}
.workspace>.tools-panel{grid-column:1/-1!important;grid-row:1!important;display:flex!important;flex-direction:row!important;align-items:center;gap:7px;padding:8px 12px!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap;scrollbar-width:thin;scrollbar-color:#80662a #20232a;border:1px solid var(--line);border-radius:12px;background:#17191e;position:sticky;top:0;z-index:35;overscroll-behavior-x:contain;touch-action:pan-x;cursor:grab;user-select:none}
.workspace>.tools-panel.dragging{cursor:grabbing;scroll-behavior:auto}
.workspace>.tools-panel .panel-heading{display:none!important}
.workspace>.tools-panel .tool{flex:0 0 auto!important;min-width:94px;min-height:48px;display:flex;flex-direction:row!important;justify-content:center;gap:8px;padding:8px 12px!important;border:1px solid transparent;border-radius:9px;white-space:nowrap}
.workspace>.tools-panel .tool i{font-size:17px}.workspace>.tools-panel .tool span{font-size:11px}
.workspace>.tools-panel .tool.active{background:#302918;border-color:#8b6c27;color:#ffd447}
.workspace>.tools-panel .nav-shortcut{border-color:#4a4e57;background:#22262e}
.workspace>.tools-panel .nav-shortcut:last-child{background:#4a3915;border-color:#9b792b;color:#ffd447}
.workspace>.asset-panel{grid-column:1;grid-row:2;min-width:0}
.workspace>.editor{grid-column:2;grid-row:2;min-width:0}
.workspace>.inspector{grid-column:3;grid-row:2;min-width:0}
@media(max-width:1100px){.workspace{grid-template-columns:220px minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr) auto}.workspace>.tools-panel{grid-column:1/-1!important;grid-row:1!important}.workspace>.asset-panel{grid-column:1;grid-row:2}.workspace>.editor{grid-column:2;grid-row:2}.workspace>.inspector{grid-column:1/-1;grid-row:3}}
@media(max-width:700px){.workspace{display:flex!important;flex-direction:column!important}.workspace>.tools-panel{order:0;position:sticky;top:0;z-index:40;width:100%;border-radius:0 0 12px 12px;padding:6px 8px!important;gap:5px}.workspace>.tools-panel .tool{min-width:82px;min-height:45px;padding:6px 9px!important}.workspace>.asset-panel{order:1}.workspace>.editor{order:2}.workspace>.inspector{order:3}.workspace>.tools-panel::-webkit-scrollbar{height:3px}}
`;document.head.append(css);
let down=false,startX=0,scroll=0,moved=false;
root.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;down=true;moved=false;startX=e.clientX;scroll=root.scrollLeft;root.classList.add('dragging');root.setPointerCapture?.(e.pointerId)});
root.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-startX;if(Math.abs(dx)>5)moved=true;if(moved){root.scrollLeft=scroll-dx;e.preventDefault()}});
const end=()=>{down=false;root.classList.remove('dragging');if(moved){root.dataset.dragged='1';setTimeout(()=>delete root.dataset.dragged,0)}};
root.addEventListener('pointerup',end);root.addEventListener('pointercancel',end);
root.addEventListener('click',e=>{if(root.dataset.dragged==='1'){e.preventDefault();e.stopImmediatePropagation()}},true);
root.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){root.scrollLeft+=e.deltaY;e.preventDefault()}},{passive:false});
root.querySelectorAll('.tool').forEach(b=>b.setAttribute('aria-label',b.textContent.trim()));
})();