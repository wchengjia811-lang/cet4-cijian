const words=window.WORDS, byId=new Map(words.map(w=>[w.id,w]));
const key='cet4-study-v1', empty=()=>({records:{},saved:[],hard:{},days:{},reviews:0,prefs:{size:44,examples:true,ipa:true,dark:false,auto:false,reverse:false}});
let data=empty();try{data=JSON.parse(localStorage.getItem(key))||data}catch{}
const correctedIds={"class":"classic","pass":"passion","si":"silver","generou": "generous", "il": "trail", "constmct": "construct", "te": "territory", "termmal": "terminal", "necessi": "necessity", "uti": "utilize", "senes": "series", "fonune": "fortune", "vanety": "variety", "aggresslve": "aggressive", "eastem": "eastern", "intelli": "intelligent", "enomous": "enormous", "obj": "objection", "imagmary": "imaginary", "llldependence": "independence", "apologrze": "apologize", "gneve": "grieve", "grmd": "grind", "di": "dignity", "uncefiain": "uncertain", "jeiiy": "jelly", "remlnd": "remind", "expofi": "export", "reso": "resolve", "lnsurance": "insurance", "privi": "privilege", "prej": "prejudice"};
function migrateWordIds(state){
    for(const [oldId,newId] of Object.entries(correctedIds)){
        const oldRecord=state.records[oldId], newRecord=state.records[newId];
        if(oldRecord){
            if(!newRecord||oldRecord.due<newRecord.due)state.records[newId]=oldRecord;
            delete state.records[oldId];
        }
        if(state.hard[oldId]){
            state.hard[newId]=(state.hard[newId]||0)+state.hard[oldId];
            delete state.hard[oldId];
        }
    }
    state.saved=[...new Set(state.saved.map(id=>Object.hasOwn(correctedIds,id)?correctedIds[id]:id))];
    return state;
}
data=migrateWordIds(data);
const save=()=>localStorage.setItem(key,JSON.stringify(data));
const today=(d=new Date())=>[d.getFullYear(),d.getMonth()+1,d.getDate()].join('-');
const app=document.querySelector('#app'), nav=document.querySelector('#nav');
const tabs=['学习','词库','生词本','练习','统计','设置'];
let page='学习', scope='daily', queue=[], index=0, flipped=false,timer,query='', selected=new Set(),quiz=null,kind='spell';
const e=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,extra='')=>'<button data-action="'+action+'" '+extra+'>'+label+'</button>';
const due=w=>data.records[w.id]?.due<=Date.now();
const isNew=w=>!data.records[w.id];
function start(s){stopRecording();scope=s;queue=(s==='daily'?[...words.filter(due),...words.filter(isNew)]:s==='saved'?words.filter(w=>data.saved.includes(w.id)):words.filter(w=>data.hard[w.id]).sort((a,b)=>data.hard[b.id]-data.hard[a.id])).map(w=>w.id);index=0;flipped=false;page='学习';render()}
function move(n){stopRecording();index=Math.max(0,Math.min(queue.length-1,index+n));flipped=false;render()}
function rate(w,r){stopRecording();const prior=data.records[w.id], day=data.days[today()]??={new:0,review:0};day[prior?'review':'new']++;if(prior)data.reviews++;const streak=r===2?(prior?.streak||0)+1:0;const delay=[60000,3600000,86400000*Math.min(30,2**Math.min(5,streak-1))][r];data.records[w.id]={due:Date.now()+delay/(data.hard[w.id]?2:1),streak};save();queue.splice(index,1);if(index>=queue.length)index=Math.max(0,queue.length-1);flipped=false;render()}

const recording=new Audio();
let recordingRequest=0;
function stopRecording(){
    recordingRequest++;
    recording.pause();
}
function speechStatus(message){
    const status=document.querySelector('#speech-status');
    if(status)status.textContent=message;
}
async function speak(w){
    stopRecording();
    const request=recordingRequest;
    const id=w.id.trim().toLowerCase();
    if(!/^[a-z]+(?:[ -][a-z]+)*$/.test(id)){
        speechStatus('这条词暂缺本地发音录音。');
        return;
    }
    const localFormat=window.LOCAL_AUDIO?.[id];
    const format=['flac','ogg','wav'].includes(localFormat)?localFormat:'mp3';
    recording.src='audio/'+encodeURIComponent(id)+'.'+format;
    try{
        await recording.play();
        if(request===recordingRequest)speechStatus('');
    }catch{
        if(request===recordingRequest)speechStatus('这条词暂缺可播放的本地发音录音。');
    }
}
function toggle(w){data.saved=data.saved.includes(w.id)?data.saved.filter(id=>id!==w.id):[...data.saved,w.id];save();render()}
function download(name,value,type){const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const hint=()=>words.length?'当前没有可学习的单词。':'词库待录入。扫描文稿录入后即可开始学习。';
function study(){
    const w=byId.get(queue[index]), p=data.prefs, english=flipped===p.reverse;
    const newCount=words.filter(isNew).length, reviewCount=words.filter(due).length;
    const practiced=data.days[today()]||{new:0,review:0};
    const title={daily:'今日学习',saved:'生词复习',hard:'难词复习'}[scope];
    const controls='<div class="study-modes row">'+btn('今日学习','daily',scope==='daily'?'aria-current="true"':'')+btn('生词复习','saved',scope==='saved'?'aria-current="true"':'')+btn('难词复习','hard',scope==='hard'?'aria-current="true"':'')+btn(p.reverse?'中译英':'英译中','reverse','class="direction" aria-label="切换翻译方向"')+'</div>';
    const summary='<aside class="study-summary" aria-label="今日学习统计">'+[[practiced.new+practiced.review,'今日已学'],[reviewCount,'待复习'],[newCount,'新词']].map(([number,label])=>'<div><strong>'+number+'</strong><span>'+label+'</span></div>').join('')+'</aside>';
    if(!w)return '<div class="study-head"><h1>'+title+'</h1>'+summary+'</div>'+controls+'<section class="card empty-card">'+hint()+'</section>';
    const type=scope==='daily'?(isNew(w)?'新词':'复习词'):title;
    const showEnglish=english||flipped;
    return '<div class="study-head"><h1>'+title+'</h1>'+summary+'</div>'+controls+
        '<section class="card study-card"><div class="card-top"><span>'+type+' · 原稿 '+w.number+'</span><span>'+(index+1)+' / '+queue.length+'</span></div>'+
        '<div class="card-content"><strong style="font-size:'+p.size+'px">'+e(english?w.word:w.meaning)+'</strong>'+
        (english&&p.ipa&&w.ipa?'<div class="phonetic">'+e(w.ipa)+'</div>':'')+
        (flipped?'<div class="translation">'+e(w.pos)+' '+e(english?w.meaning:w.word)+'</div>':'')+
        (flipped&&p.examples&&w.example?'<p>'+e(w.example)+'</p>':'')+'</div>'+
        '<div class="card-bottom">'+
        (showEnglish?btn('♪ 听发音','speak','class="quiet"'):'<span></span>')+
        btn(flipped?'返回正面':'显示答案','flip',flipped?'class="quiet"':'class="primary reveal"')+
        btn(data.saved.includes(w.id)?'★ 已收藏':'☆ 收藏','toggle','class="quiet"')+
        '</div><p class="muted speech-status" id="speech-status" role="status"></p>'+'</section>'+
        (flipped?'<div class="rating">'+['不认识','模糊','认识'].map((x,i)=>btn(x,'rate'+i,'class="rating-'+i+'"')).join('')+'</div>':'')+
        '<div class="study-nav">'+btn('上一个','prev',index?'':'disabled')+btn('下一个','next',index<queue.length-1?'':'disabled')+'</div>';
}
function listing(){const saved=page==='生词本';return '<h1>'+page+'</h1>'+(!saved?'<p class="muted">收录 '+words.length+' 个原稿词条，覆盖 1–1500 号并保留原稿的重号词。</p>':'')+'<div class="row"><input id="search" type="search" value="'+e(query)+'" placeholder="搜索英文、中文或原稿编号" aria-label="搜索英文、中文或原稿编号">'+(saved?btn('复习生词','saved')+btn('删除已选','remove')+btn('导出 TXT','txt'):'')+'</div><section id="results"></section>'}
function results(){const q=query.trim().toLowerCase(), saved=page==='生词本';document.querySelector('#results').innerHTML=words.filter(w=>(!saved||data.saved.includes(w.id))&&(w.word.toLowerCase().includes(q)||w.meaning.includes(q)||String(w.number)===q)).map(w=>'<article>'+(saved?'<input type="checkbox" aria-label="选择 '+e(w.word)+'" data-select="'+e(w.id)+'" '+(selected.has(w.id)?'checked':'')+'>':'')+'<div><b>'+e(w.word)+'</b> <small>原稿 '+w.number+' · 扫描第 '+w.sourcePage+' 页</small> '+(data.prefs.ipa?e(w.ipa):'')+'<br>'+e(w.pos)+' '+e(w.meaning)+(data.prefs.examples&&w.example?'<br><small>'+e(w.example)+'</small>':'')+'</div>'+btn(saved?'移除':data.saved.includes(w.id)?'取消收藏':'收藏','toggle','data-id="'+e(w.id)+'"')+'</article>').join('')||hint()}
function fresh(){const meanings=[...new Set(words.map(w=>w.meaning))];if(!words.length||(kind==='choice'&&meanings.length<4)){quiz=null;return}const bag=words.flatMap(w=>Array(Math.min(6,1+(data.hard[w.id]||0))).fill(w));const w=bag[Math.floor(Math.random()*bag.length)];const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};quiz={w,options:shuffle([w.meaning,...shuffle(meanings.filter(m=>m!==w.meaning)).slice(0,3)]),feedback:''}}
function answer(value){if(quiz.feedback)return;const w=quiz.w,correct=kind==='spell'?w.word:w.meaning;const ok=value.trim().toLowerCase()===correct.trim().toLowerCase();if(!ok){data.hard[w.id]=(data.hard[w.id]||0)+1;const record=data.records[w.id];if(record)record.due=Math.min(record.due,Date.now()+60000);save()}quiz.feedback=ok?'回答正确':'已加入难词集';render();if(data.prefs.quizAudio)speak(w)}
function practice(){return '<h1>单词练习</h1><div class="row">'+btn('拼写练习','spell')+btn('四选一','choice')+btn('复习难词','hard')+'</div><label><input type="checkbox" data-pref="quizAudio" '+(data.prefs.quizAudio?'checked':'')+'> 提交答案后自动朗读</label><section>'+(!quiz?(words.length&&kind==='choice'?'四选一需要至少四种不同释义。':hint()):'<h2>'+e(kind==='spell'?quiz.w.meaning:quiz.w.word)+'</h2>'+(quiz.feedback?'<p role="status">'+e(quiz.feedback)+'</p><div class="answer"><strong>'+e(quiz.w.word)+'</strong> <span>'+e(quiz.w.pos)+' '+e(quiz.w.meaning)+'</span></div><div class="row">'+btn('听发音','quizspeak')+btn('下一题','quiznext','class="primary"')+'</div><p class="muted" id="speech-status" role="status"></p>':kind==='spell'?'<form id="spellform" class="row"><input name="answer" required autocomplete="off" aria-label="英文拼写" placeholder="输入英文"><button class="primary">提交答案</button></form>':'<div class="row">'+quiz.options.map((m,i)=>btn(e(m),'option'+i)).join('')+'</div>'))+'</section>'}
function stats(){const d=data.days[today()]||{new:0,review:0},n=Object.keys(data.records).filter(id=>byId.has(id)).length,p=words.length?Math.round(n/words.length*100):0;let date=new Date(),streak=0;if(!data.days[today(date)])date.setDate(date.getDate()-1);while(data.days[today(date)]){streak++;date.setDate(date.getDate()-1)}return '<h1>学习统计</h1><div class="grid">'+Object.entries({'今日新词':d.new,'今日复习':d.review,'今日学习总量':d.new+d.review,'累计已学':n,'累计复习次数':data.reviews,'生词数量':data.saved.length,'连续打卡天数':streak}).map(([k,v])=>'<section><strong>'+v+'</strong>'+k+'</section>').join('')+'</div><section><h2>词本完成度 '+p+'%</h2><progress max="100" value="'+p+'"></progress></section>'}
function settings(){return '<h1>设置</h1><section><h2>卡片显示</h2><p class="muted">发音文件随网页保存。已有真人录音，缺词用预先生成的美音补齐。</p>'+Object.entries({examples:'显示例句',ipa:'显示音标',auto:'五秒后自动翻卡',dark:'深色模式'}).map(([k,v])=>'<label><input type="checkbox" data-pref="'+k+'" '+(data.prefs[k]?'checked':'')+'> '+v+'</label>').join('')+'<label>卡片字号 <input aria-label="卡片字号" type="range" data-pref="size" min="20" max="68" value="'+data.prefs.size+'"> '+data.prefs.size+' px</label></section><section><h2>本地数据</h2><div class="row">'+btn('导出 JSON 备份','backup')+btn('导入 JSON 备份','restore')+btn('重置词本进度','reset')+btn('重置全部数据','wipe')+'</div><input hidden type="file" id="backup-file" accept=".json,application/json"><p class="muted">记录保存在当前浏览器，换设备可用 JSON 备份恢复。</p><p id="backup-status" role="status"></p></section>'}
function render(){clearTimeout(timer);document.body.classList.toggle('dark',data.prefs.dark);nav.innerHTML=tabs.map(t=>btn(t,'tab','data-page="'+t+'" aria-current="'+(t===page)+'"')).join('');app.innerHTML=({'学习':study,'词库':listing,'生词本':listing,'练习':practice,'统计':stats,'设置':settings}[page])();if(page==='词库'||page==='生词本')results();if(page==='学习'&&queue[index]&&!flipped&&data.prefs.auto)timer=setTimeout(()=>{flipped=true;render()},5000)}
function backupValid(x){const obj=v=>v&&typeof v==='object'&&!Array.isArray(v), count=v=>Number.isSafeInteger(v)&&v>=0;return obj(x)&&obj(x.records)&&Object.values(x.records).every(r=>obj(r)&&count(r.due)&&count(r.streak))&&Array.isArray(x.saved)&&x.saved.every(id=>typeof id==='string')&&obj(x.hard)&&Object.values(x.hard).every(count)&&obj(x.days)&&Object.values(x.days).every(d=>obj(d)&&count(d.new)&&count(d.review))&&count(x.reviews)&&obj(x.prefs)&&Object.entries(empty().prefs).every(([k,v])=>typeof x.prefs[k]===typeof v)&&count(x.prefs.size)&&x.prefs.size>=20&&x.prefs.size<=68}
document.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;const a=b.dataset.action,w=byId.get(b.dataset.id||queue[index]);if(b.id==='theme'){data.prefs.dark=!data.prefs.dark;save();render();return}if(!a)return;if(a==='quizspeak'&&quiz?.feedback){speak(quiz.w);return}if(a==='tab'){stopRecording();page=b.dataset.page;query='';selected.clear();if(page==='练习'&&!quiz)fresh();if(page==='学习'&&scope==='daily'&&!queue.length){start('daily');return}render();return}
if(['daily','saved','hard'].includes(a)){start(a);return}if(a==='prev'||a==='next'){move(a==='prev'?-1:1);return}if(a==='flip'){flipped=!flipped;render();return}if(a==='reverse'){data.prefs.reverse=!data.prefs.reverse;flipped=false;save();render();return}if(a==='speak'&&w){speak(w);return}if(a==='toggle'&&w){selected.delete(w.id);toggle(w);return}if(a.startsWith('rate')&&w&&flipped){rate(w,Number(a.slice(4)));return}if(['spell','choice','quiznext'].includes(a)){stopRecording();if(a!=='quiznext')kind=a;fresh();render();return}if(a.startsWith('option')&&quiz){answer(quiz.options[Number(a.slice(6))]);return}
if(a==='remove'){data.saved=data.saved.filter(id=>!selected.has(id));selected.clear();save();render()}if(a==='txt')download('生词本.txt',words.filter(w=>data.saved.includes(w.id)).map(w=>[w.word,w.ipa,w.pos,w.meaning,w.example].join('\t')).join('\n'),'text/plain;charset=utf-8');
if(a==='backup')download('四级词间备份.json',JSON.stringify(data,null,2),'application/json');if(a==='restore')document.querySelector('#backup-file').click();if(a==='reset'&&confirm('清空学习进度、统计和难词记录？')){const {prefs,saved}=data;const keep=confirm('是否保留生词本？确定保留，取消则清空。');data={...empty(),prefs,saved:keep?saved:[]};queue=[];quiz=null;save();render()}if(a==='wipe'&&confirm('清空所有学习记录、生词、难词和设置？此操作无法撤销。')){data=empty();queue=[];quiz=null;save();render()}});
app.addEventListener('submit',ev=>{if(ev.target.id!=='spellform')return;ev.preventDefault();answer(new FormData(ev.target).get('answer'))});
app.addEventListener('input',ev=>{if(ev.target.id==='search'){query=ev.target.value;results()}});
app.addEventListener('change',async ev=>{const t=ev.target;if(t.dataset.select){t.checked?selected.add(t.dataset.select):selected.delete(t.dataset.select)}if(t.dataset.pref){data.prefs[t.dataset.pref]=t.type==='range'?Number(t.value):t.tagName==='SELECT'?t.value:t.checked;save();render()}if(t.id==='backup-file'&&t.files[0]){try{const x=JSON.parse(await t.files[0].text());if(!backupValid(x))throw Error();if(!confirm('用备份覆盖当前浏览器中的学习记录和设置？'))return;data=migrateWordIds(x);queue=[];quiz=null;save();render();document.querySelector('#backup-status').textContent='备份已恢复。'}catch{document.querySelector('#backup-status').textContent='无法恢复，请选择本站导出的 JSON 备份。'}finally{t.value=''}}});
start('daily');



