import {mkdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {previewTransaction} from './preview-store.js';
import {blankFamily} from '../src/features/family/model.js';
import {createVault} from '../src/features/diary/crypto.js';
import {newData} from '../src/features/diary/model.js';
import {accessProof,createCloudStorage} from '../src/features/diary/cloud.js';
import diary from './diary-sync.js';
export async function seedPersonalPreview(){
 const exists=await previewTransaction(s=>Boolean(s.records.main),{write:false});
 const seeded=await previewTransaction(s=>Boolean(s.personalPreviewSeedComplete),{write:false});if(seeded)return;
 const directory=join(process.env.PERSONAL_PREVIEW_DIR,'media');await mkdir(directory,{recursive:true});
 for(const name of ['lakeside','home','city','nesting'])await copyFile(resolve('preview/personal/assets',name+'.jpg'),join(directory,name+'.jpg'));
 const now=new Date(),date=offset=>{const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,12);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},image=name=>'/__preview/media/'+name+'.jpg';
 const main={...blankFamily(),_familyRevision:1,
  habits:[{id:'h1',name:'饭后一起散步',growthValue:12,lastWatered:date(-1),stage1Days:7,stage1Reward:'周末看一场电影',stage2Days:21,stage2Reward:'一起做顿大餐',stage3Days:100,stage3Reward:'海边短假'},{id:'h2',name:'睡前读十页书',growthValue:5,lastWatered:date(-2),stage1Days:7,stage1Reward:'买一本喜欢的书',stage2Days:21,stage2Reward:'逛一次书店',stage3Days:100,stage3Reward:'周末阅读小旅行'}],
  todos:[{id:'t1',text:'给阳台的植物浇水',dueDate:date(0),owner:'Aosen',completed:false,recurrence:{type:'after',days:3}},{id:'t2',text:'周末一起逛菜市场',dueDate:date(2),owner:'一起',completed:false,recurrence:{type:'weekly',weekday:6}},{id:'t3',text:'把最近的照片选进相册',dueDate:date(1),owner:'小悦',completed:false},{id:'t4',text:'给家里换上新鲜的花',completed:true,completedAt:date(-1)+'T12:00:00Z'}],
  goals:[{id:'g1',name:'我们的海边小假期',target:15000,current:6800},{id:'g2',name:'给家添一把舒服的椅子',target:3500,current:2400}],
  dates:[{id:'d1',name:'一起生活的纪念日',date:date(12),type:'anniversary'},{id:'d2',name:'周末家庭晚餐',date:date(3),type:'event'},{id:'d3',name:'小悦生日',date:'1996-09-01',type:'birthday'}],
  milestones:[{id:'m1',date:date(-15),title:'为小小的你准备一个角落',desc:'把柔软的小毯子叠好，放进第一件小衣服。家里又多了一份期待。',type:'成长记录',icon:'ph-baby',photos:[{url:image('nesting'),desc:'等你慢慢来到我们身边'}]}],
  books:[{id:'b1',bookId:'b1',title:'生活中的小美好',author:'家庭书架',desc:'给忙碌的日子留下一些空白。',note:'## 留给自己的话\n\n我们不需要把每一天都填满。一起散步、慢慢做饭，也是在认真生活。\n\n## 想试试的事\n\n周末留出一个下午，不安排任何事情。',coverStyle:'literary'}],
  moments:[{id:'s1',date:date(-1),text:'回家时，桌上有一碗温热的汤。什么都没说，但今天忽然就轻松了。',author:'小悦',photos:[{url:image('home')}],rememberedBy:['Aosen'],starred:true},{id:'s2',date:date(-4),text:'沿着湖边多走了一站路，刚好遇见了很好看的夕阳。',author:'Aosen',photos:[{url:image('lakeside')}],rememberedBy:['小悦'],starred:false},{id:'s3',date:date(-8),text:'一起挑的小衣服摆了一桌。开始期待那些还没到来的普通日子。',author:'小悦',photos:[{url:image('nesting')}],rememberedBy:[],starred:false}],
  photos:[{id:'p1',url:image('lakeside'),thumbnailUrl:image('lakeside'),date:date(-4),desc:'散步的终点，是一整片温柔的光',location:'湖边',type:'自然风景'},{id:'p2',url:image('home'),thumbnailUrl:image('home'),date:date(-1),desc:'家的样子，是餐桌上等着的晚饭',location:'我们的家',type:'日常记录'},{id:'p3',url:image('nesting'),thumbnailUrl:image('nesting'),date:date(-8),desc:'给未来的日子留一个小角落',location:'我们的家',type:'日常记录'},{id:'p4',url:image('city'),thumbnailUrl:image('city'),date:date(-35),desc:'周末不赶时间，只想一起走走',location:'旧街',type:'日常记录'},{id:'p5',url:image('lakeside'),thumbnailUrl:image('lakeside'),desc:'记不清是哪一天，但记得当时的风',location:'湖边',type:'自然风景'}],
  salaryBank:'工资账户',salaryDay:15,assets:[{id:'a1',owner:'共同',type:'cash',name:'家庭备用金',value:68000}],loans:[{id:'l1',owner:'共同',type:'房贷',bank:'还款账户',isAutoCalc:false,left:180000,monthly:2800,rate:3.1,day:Math.min(28,now.getDate()+2)}],transfers:[{id:'tr1',from:'工资账户',to:'还款账户',amount:2800,day:Math.min(28,now.getDate()+1),owner:'共同'}],appearance:{coverStyle:'photo'},lifeLayout:[{id:'habits',visible:true},{id:'todos',visible:true},{id:'goals',visible:true},{id:'dates',visible:true},{id:'reading',visible:true},{id:'milestones',visible:true}]
 };
 if(!exists)await previewTransaction(s=>{s.records.main={key:'main',value:main};return null;});
 const request=async(url,opts)=>{let status=200,payload;await diary({method:'POST',headers:Object.fromEntries(new Headers(opts.headers)),body:JSON.parse(opts.body)},{setHeader(){},status(n){status=n;return this},json(b){payload=b}});return Response.json(payload,{status});};
 const pass='preview-diary-2026',account='aosen',data=newData('Aosen');
 data.entries=[{id:'j1',date:date(-1),text:'今天下班回家的路上，买了她喜欢的面包。\n晚饭后没有着急收拾，我们坐着聊了很久。原来一整天最值得记住的，是这二十分钟。',photos:[],starred:true,createdAt:date(-1)+'T12:00:00Z',updatedAt:date(-1)+'T12:00:00Z'},{id:'j2',date:date(-3),text:'饭后去湖边散步。天慢慢暗下来，路灯一盏接一盏亮。\n想把这种不用急着说什么的感觉，保存久一点。',photos:[],createdAt:date(-3)+'T12:00:00Z',updatedAt:date(-3)+'T12:00:00Z'},{id:'j3',date:date(-7),text:'周末给阳台换了花盆。忙了半天，有一点累，但傍晚坐在那里喝水的时候，觉得很值得。',photos:[],createdAt:date(-7)+'T12:00:00Z',updatedAt:date(-7)+'T12:00:00Z'}];
 data.entries=data.entries.map(e=>({starred:false,resurface:true,deletedAt:null,versions:[],...e}));
 const vault=await createVault(pass,data),storage=createCloudStorage(account,await accessProof(account,pass),request,()=>process.env.SYSTEM_PASSWORD),recovery=await accessProof(account,vault.recovery,true);
 await storage.register(recovery);await storage.writeVault(vault.envelope,0,{recovery});
 await previewTransaction(s=>{s.personalPreviewSeedComplete=true;return null;});
}
