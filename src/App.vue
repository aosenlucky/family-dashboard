<script setup>
import { ref,provide,onMounted,computed,watch } from 'vue';
import { useRoute } from 'vue-router';
import ConfigPanel from './components/ConfigPanel.vue';
import SettingsPanel from './features/family/SettingsPanel.vue';
import { useFamily } from './features/family/useFamily.js';
import { mergeChanges, safeQuietTime } from './features/family/model.js';
import { uploadPhotoFile } from './features/gallery/upload.js';
const route=useRoute(), state=useFamily();
const {familyData,familyRevision,wealthToken,isMasked,mode,status:syncStatus,busy:isSyncing,error:syncError,pending,conflict,hasCachedDraft,familyApi,reloadFamily,commitFamily,saveConfig,resolveConflict}=state;
const sections=[{path:'/life',label:'生活',icon:'sun-horizon'},{path:'/wealth',label:'理财',icon:'wallet'},{path:'/gallery',label:'画廊',icon:'images'},{path:'/travel',label:'旅行',icon:'compass'},{path:'/diary',label:'日记',icon:'notebook'}];
const preview=import.meta.env.VITE_PERSONAL_PREVIEW==='1';
const auth=ref({isLoggedIn:false,inputPin:'',errorMsg:'',isAuthenticating:false});
const showConfig=ref(false),showSettings=ref(false),configStart=ref('assets');
const showWealthAuth=ref(false),wealthInputPin=ref(''),wealthErrorMsg=ref(''),isVerifyingWealth=ref(false),isFetchingStocks=ref(false);
const toast=ref(''),toastAction=ref(null),currentMember=ref(localStorage.getItem('family-record-author')||'Aosen');
const conflictChoices=ref({}),resolving=ref(false),resolveError=ref('');let toastTimer,wealthTimer;
const confirmDiscard=ref(false);
watch(pending,()=>{confirmDiscard.value=false;});
function discardChanges(){if(!confirmDiscard.value){confirmDiscard.value=true;return;}state.discardPending();confirmDiscard.value=false;}
const isDemoMode=computed(()=>mode.value==='demo');
const unresolvedKeys=computed(()=>conflict.value?mergeChanges(conflict.value.base,conflict.value.draft,conflict.value.latest).conflicts:[]);
const labels={habits:'习惯花园',todos:'待办',goals:'梦想金库',dates:'温馨日历',photos:'画廊',moments:'那天小事',lifeLayout:'生活布局',appearance:'外观',books:'阅读',milestones:'成长',trash:'回收站',paymentChecks:'理财核对',coupons:'拾光小笺'};
function showNotification(msg){toast.value=String(msg).replace(/<[^>]*>/g,'');toastAction.value=null;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',6500);}
function setCurrentMember(name){currentMember.value=name;localStorage.setItem('family-record-author',name);}
function requestWealthUnlock(){showWealthAuth.value=true;wealthInputPin.value=preview?'local-wealth-preview':'';wealthErrorMsg.value='';}
function openConfig(tab='assets'){configStart.value=tab;showConfig.value=true;}
const formatCurrency=v=>isMasked.value?'¥ ***':new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(Number(v)||0);
const formatCurrencyInt=v=>isMasked.value?'¥ ***':new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',maximumFractionDigits:0}).format(Number(v)||0);
const formatCurrencyIntNoSymbol=v=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(Number(v)||0);
async function handleLogin(){auth.value.isAuthenticating=true;auth.value.errorMsg='';try {const r=await familyApi('/api/sync',{headers:{Authorization:auth.value.inputPin}});sessionStorage.setItem('family_auth_token',auth.value.inputPin);state.apply(r);auth.value.isLoggedIn=true;auth.value.inputPin='';}catch(e){auth.value.errorMsg=e.message;}finally{auth.value.isAuthenticating=false;}}
async function verifyWealthPassword(){isVerifyingWealth.value=true;try{const r=await familyApi('/api/wealth-auth',{method:'POST',body:JSON.stringify({password:wealthInputPin.value})});wealthToken.value=r.token;await reloadFamily();showWealthAuth.value=false;wealthInputPin.value='';clearTimeout(wealthTimer);wealthTimer=setTimeout(()=>{state.lockWealth();showNotification('理财查看已锁定，请重新验证。');},Math.max(1000,new Date(r.expiresAt).getTime()-Date.now())||900000);}catch(e){wealthErrorMsg.value=e.message;state.lockWealth();}finally{isVerifyingWealth.value=false;}}
async function trashItem(collection,id){const trashId=await state.trashItem(collection,id);showNotification('已放入回收站');toastAction.value=()=>state.restoreTrash(trashId).then(()=>showNotification('已撤销删除')).catch(e=>showNotification(e.message));}
let reminderTimer;const reminders=new Map();
async function triggerPushNotification(title,content){
 const prefs=familyData.value.notificationSettings||{};if(!prefs.enabled||isDemoMode.value)return;
 reminders.set(title,content);clearTimeout(reminderTimer);
 reminderTimer=setTimeout(async()=>{if(safeQuietTime(new Date(),prefs.quietStart,prefs.quietEnd)){showNotification('当前是免打扰时段，这次提醒未发送。');reminders.clear();return;}const lines=[...reminders].map(([t,c])=>`${t}：${c}`);reminders.clear();try{await familyApi('/api/sync',{method:'POST',body:JSON.stringify({action:'notify',title:'家庭提醒',content:lines.join('\n')})});}catch(e){showNotification('提醒未送达：'+e.message);}},8000);
}
async function fetchStocks(){if(preview||isMasked.value)return;isFetchingStocks.value=true;try{for(const stock of familyData.value.stocks){let symbol=String(stock.symbol||'').toLowerCase().trim(),query=stock.market==='US'?`us${symbol.toUpperCase()}`:/^\d{6}$/.test(symbol)?`${symbol.startsWith('6')?'sh':'sz'}${symbol}`:symbol;if(!/^[a-zA-Z0-9.]+$/.test(query))continue;await new Promise(resolve=>{const script=document.createElement('script');const finish=()=>{clearTimeout(timer);script.remove();resolve();};const timer=setTimeout(finish,7000);script.src=`https://qt.gtimg.cn/q=${query}`;script.onload=()=>{const parts=(window[`v_${query}`]||'').split('~');if(Number(parts[3])>0)stock.currentPrice=Number(parts[3]);finish();};script.onerror=finish;document.body.appendChild(script);});}}finally{isFetchingStocks.value=false;}}
async function finishConflict(){resolving.value=true;resolveError.value='';try{await resolveConflict(conflictChoices.value);conflictChoices.value={};}catch(e){resolveError.value=e.message;}finally{resolving.value=false;}}
function downloadConflict(){const blob=new Blob([JSON.stringify({local:conflict.value.draft,latest:conflict.value.latest},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='家庭修改冲突副本.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function logout(){state.lockWealth();sessionStorage.removeItem('family_auth_token');auth.value.isLoggedIn=false;showSettings.value=false;}
for(const [key,value] of Object.entries({familyData,familyRevision,wealthToken,isMasked,isDemoMode,familyApi,reloadFamily,commitFamily,saveConfig,currentMember,setCurrentMember,uploadPhotoFile,trashItem,restoreTrash:state.restoreTrash,showNotification,triggerPushNotification,requestWealthUnlock,openConfig,formatCurrency,formatCurrencyInt,formatCurrencyIntNoSymbol,fetchStocks,isFetchingStocks,getOwnerTagClass:owner=>owner==='Aosen'?'bg-blue-50 text-blue-600':owner==='小悦'?'bg-rose-50 text-rose-600':'bg-stone-100 text-stone-600'}))provide(key,value);
const lockWealth=state.lockWealth;provide('lockWealth',lockWealth);
provide('canRestoreFamily',computed(()=>!pending.value&&!conflict.value&&!isSyncing.value));
watch(isMasked,(locked)=>{if(locked)showConfig.value=false;});
watch(()=>route.path,()=>{document.title=`${(route.path==='/life/coupons'?'拾光小笺':sections.find(s=>s.path===route.path)?.label)||'生活'} · Aosen & 小悦`;});
onMounted(async()=>{if(preview&&!sessionStorage.getItem('family_auth_token'))sessionStorage.setItem('family_auth_token','local-family-preview');if(sessionStorage.getItem('family_auth_token')){try{await reloadFamily();auth.value.isLoggedIn=true;if(sessionStorage.getItem('family-shared-pending'))showNotification('有一份上次未保存的共享草稿，可在保存状态中恢复。');}catch(e){auth.value.errorMsg=e.message;}}});
</script>

<template>
 <div class="family-app" :class="{'personal-preview':preview}">
  <div v-if="toast" class="family-toast" role="status"><span>{{toast}}</span><button v-if="toastAction" @click="toastAction">撤销</button><button aria-label="关闭提示" @click="toast=''">×</button></div>
  <main v-if="!auth.isLoggedIn" class="family-login"><form class="family-dialog login-card" @submit.prevent="handleLogin"><span class="eyebrow">OUR LITTLE WORLD</span><h1>欢迎回家</h1><p>属于 Aosen 和小悦的日子，都在这里。</p><label>家庭密码<input v-model="auth.inputPin" type="password" autocomplete="current-password" required></label><p v-if="auth.errorMsg" class="form-error" role="alert">{{auth.errorMsg}}</p><button class="family-primary" :disabled="auth.isAuthenticating">{{auth.isAuthenticating?'正在开门…':'推开家门'}}</button></form></main>
  <template v-else>
   <header class="family-header"><router-link class="family-brand" to="/life"><span>SY</span><b>Aosen & 小悦<small>OUR FAMILY SPACE</small></b></router-link><nav aria-label="家庭网站主导航"><router-link v-for="s in sections" :key="s.path" :to="s.path" :class="{'router-link-active':s.path==='/life' && route.path.startsWith('/life/')}"><i class="ph" :class="`ph-${s.icon}`"></i><span>{{s.label}}</span></router-link></nav><button class="family-settings" aria-label="打开家庭设置" @click="showSettings=true"><i class="ph ph-sliders-horizontal"></i><span>设置</span></button></header>
   <div class="family-status" role="status"><span v-if="preview" class="preview-label">自用版预览 · 模拟数据</span><span :class="{'save-error':syncError}"><i class="ph" :class="isSyncing?'ph-spinner':'ph-cloud-check'"></i>{{syncStatus}}</span><button v-if="pending&&!conflict" @click="state.retryPending().catch(e=>showNotification(e.message))">重试保存</button><button v-if="pending" @click="discardChanges">{{confirmDiscard?'确认放弃这份草稿':'放弃未保存草稿'}}</button><button v-if="confirmDiscard" @click="confirmDiscard=false">保留</button><button v-if="!pending&&hasCachedDraft" @click="state.restoreDraft().catch(e=>showNotification(e.message))" title="找回上次会话未保存的共享草稿">草稿</button></div>
   <section v-if="conflict" class="family-conflict" role="alert"><h2>另一台设备也有更新</h2><p>两份内容都已保留。无冲突的修改会合并；同一栏目有不同修改时，请选择要保留的版本。</p><div v-for="key in unresolvedKeys" :key="key" class="conflict-row"><strong>{{labels[key]||key}}</strong><label><input v-model="conflictChoices[key]" type="radio" :name="key" value="local">本次修改</label><label><input v-model="conflictChoices[key]" type="radio" :name="key" value="remote">另一台设备</label><details><summary>查看两份内容</summary><div class="conflict-values"><pre>{{JSON.stringify(conflict.draft[key],null,2)}}</pre><pre>{{JSON.stringify(conflict.latest[key],null,2)}}</pre></div></details></div><div class="family-actions"><button @click="downloadConflict">下载两份副本</button><button class="family-primary" :disabled="resolving" @click="finishConflict">{{resolving?'保存中…':'按选择合并保存'}}</button></div><p class="form-error">{{resolveError}}</p></section>
   <section v-if="route.path==='/life'" class="family-cover" :class="familyData.appearance?.coverStyle||'photo'" :style="familyData.appearance?.coverUrl?{'--cover-image':`url('${familyData.appearance.coverUrl}')`}:{}"><div><span class="eyebrow">THE DAYS WE SHARE</span><h1>{{familyData.appearance?.title||'把平常日子，过成我们的故事。'}}</h1><p>一起照顾生活，也一起收藏值得记住的小事。</p></div><span class="cover-signature">Aosen & 小悦 · HOME</span></section>
   <router-view v-slot="{Component}"><keep-alive :max="6"><component :is="Component" /></keep-alive></router-view>
   <footer class="family-footer">Aosen & 小悦 <span>·</span> 平凡的日子，也值得珍藏。</footer>
   <SettingsPanel v-if="showSettings" @close="showSettings=false" @advanced="tab=>{showSettings=false;openConfig(tab)}" @logout="logout" />
   <ConfigPanel v-if="showConfig" :initial-tab="configStart" @close="showConfig=false" />
  </template>
  <div v-if="showWealthAuth" class="family-modal" @click.self="showWealthAuth=false"><form class="family-dialog" role="dialog" aria-modal="true" aria-label="理财验证" v-modal-focus @keydown.esc.stop.prevent="showWealthAuth=false" @submit.prevent="verifyWealthPassword"><button type="button" class="dialog-close" aria-label="关闭理财验证" @click="showWealthAuth=false">×</button><span class="eyebrow">PRIVATE FINANCES</span><h2>再打开一把小锁</h2><p>验证后才能读取理财数据；15 分钟后自动锁定。</p><label>理财密码<input v-model="wealthInputPin" type="password" autocomplete="current-password" required></label><p class="form-error">{{wealthErrorMsg}}</p><button class="family-primary" :disabled="isVerifyingWealth">{{isVerifyingWealth?'验证中…':'查看理财'}}</button></form></div>
 </div>
</template>
