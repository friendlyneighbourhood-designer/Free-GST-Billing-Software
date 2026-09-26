import { supabase } from './lib/supabase';
import { getFinancialYearLabel } from './utils';

const TYPES = {
  bills:'bills', clients:'clients', products:'products', expenses:'expenses',
  purchases:'purchases', recurring:'recurring', receipts:'receipts',
  profiles:'profiles', templates:'templates'
};
const defaults = {
  invoiceNumberSettings:{format:'branded',brandPrefix:'',separator:'/',showFinYear:true,startNumber:1,padDigits:4},
  stockAlertSettings:{enabled:true,threshold:5},
};
async function userId() {
  const {data,error}=await supabase.auth.getUser();
  if(error) throw error;
  if(!data.user) throw new Error('Please sign in first.');
  return data.user.id;
}
async function all(type) {
  const uid=await userId();
  const {data,error}=await supabase.from('app_records').select('record_id,data').eq('user_id',uid).eq('record_type',type);
  if(error) throw error;
  return (data||[]).map(r=>({...(r.data||{}),id:(r.data&&r.data.id)||r.record_id}));
}
async function save(type,item,{overwrite=true}={}) {
  const uid=await userId();
  const id=String(item.id||crypto.randomUUID());
  const payload={user_id:uid,record_type:type,record_id:id,data:{...item,id},updated_at:new Date().toISOString()};
  const q=overwrite ? supabase.from('app_records').upsert(payload,{onConflict:'user_id,record_type,record_id'}) : supabase.from('app_records').insert(payload);
  const {error}=await q;
  if(error) throw error;
  item.id=id; return item;
}
async function remove(type,id) {
  const uid=await userId();
  const {data,error}=await supabase.from('app_records').delete().eq('user_id',uid).eq('record_type',type).eq('record_id',String(id)).select();
  if(error) throw error;
  return data;
}
async function metaGet(key) {
  const uid=await userId();
  const {data,error}=await supabase.from('app_meta').select('value').eq('user_id',uid).eq('key',key).maybeSingle();
  if(error) throw error;
  return data?.value ?? null;
}
async function metaSet(key,value) {
  const uid=await userId();
  const {error}=await supabase.from('app_meta').upsert({user_id:uid,key,value,updated_at:new Date().toISOString()},{onConflict:'user_id,key'});
  if(error) throw error;
  return {value};
}

export const getInvoiceNumberSettings=async()=>({...defaults.invoiceNumberSettings,...(await metaGet('invoiceNumberSettings')||{})});
export const saveInvoiceNumberSettings=s=>metaSet('invoiceNumberSettings',s);
export const getStockAlertSettings=async()=>({...defaults.stockAlertSettings,...(await metaGet('stockAlertSettings')||{})});
export const saveStockAlertSettings=s=>metaSet('stockAlertSettings',s);
export const getInvoiceDisplayOptions=()=>metaGet('invoiceDisplayOptions');
export const saveInvoiceDisplayOptions=s=>metaSet('invoiceDisplayOptions',s);
const REGION_KEY='gst_regionMode';
export const getRegionMode=()=>{try{return localStorage.getItem(REGION_KEY)||'both'}catch{return 'both'}};
export const setRegionMode=m=>{if(['india','international','both'].includes(m)){try{localStorage.setItem(REGION_KEY,m)}catch{};metaSet('regionMode',m).catch(()=>{})}};
const MODULES_KEY='gst_enabledModules';
export const getEnabledModules=()=>{try{const x=localStorage.getItem(MODULES_KEY);return x?JSON.parse(x):{}}catch{return {}}};
export const setEnabledModules=m=>{try{localStorage.setItem(MODULES_KEY,JSON.stringify(m||{}))}catch{};metaSet('enabledModules',m||{}).catch(()=>{})};

export const getNextInvoiceNumber=async(prefix='INV',{peek=false,explicitPrefix=false}={})=>{
  const settings=await getInvoiceNumberSettings();
  const pfx=explicitPrefix?prefix:(settings.brandPrefix||prefix);
  let next;
  if(peek){
    const current=Number(await metaGet('counter_'+prefix)) || ((settings.startNumber||1)-1);
    next=current+1;
  } else {
    const {data,error}=await supabase.rpc('increment_invoice_counter',{counter_key:'counter_'+prefix,start_number:Number(settings.startNumber||1)});
    if(error) throw error;
    next=Number(data);
  }
  if(settings.format==='random') return pfx+(settings.separator||'/')+Math.random().toString(36).substring(2,8).toUpperCase();
  const padded=String(next).padStart(settings.padDigits||4,'0');
  return settings.showFinYear ? pfx+(settings.separator||'/')+getFinancialYearLabel()+(settings.separator||'/')+padded : pfx+(settings.separator||'/')+padded;
};

export const saveBill=(b,o={})=>save(TYPES.bills,b,o);
export const getAllBills=()=>all(TYPES.bills);
export const deleteBill=id=>remove(TYPES.bills,id);
export const saveProfile=p=>metaSet('profile',p);
export const getProfile=()=>metaGet('profile');
export const saveClient=c=>save(TYPES.clients,c);
export const getAllClients=()=>all(TYPES.clients);
export const deleteClient=id=>remove(TYPES.clients,id);
export const saveTermsTemplate=t=>save(TYPES.templates,t);
export const getTermsTemplates=()=>all(TYPES.templates);
export const deleteTermsTemplate=id=>remove(TYPES.templates,id);
export const saveProduct=p=>save(TYPES.products,p);
export const getAllProducts=()=>all(TYPES.products);
export const deleteProduct=id=>remove(TYPES.products,id);
export const saveExpense=x=>save(TYPES.expenses,x);
export const getAllExpenses=()=>all(TYPES.expenses);
export const deleteExpense=id=>remove(TYPES.expenses,id);
export const savePurchase=x=>save(TYPES.purchases,x);
export const getAllPurchases=()=>all(TYPES.purchases);
export const deletePurchase=id=>remove(TYPES.purchases,id);
export const saveRecurring=x=>save(TYPES.recurring,x);
export const getAllRecurring=()=>all(TYPES.recurring);
export const deleteRecurring=id=>remove(TYPES.recurring,id);
export const saveReceipt=x=>save(TYPES.receipts,x);
export const getAllReceipts=()=>all(TYPES.receipts);
export const deleteReceipt=id=>remove(TYPES.receipts,id);
export const saveBusinessProfile=p=>save(TYPES.profiles,p);
export const getAllProfiles=()=>all(TYPES.profiles);
export const deleteBusinessProfile=id=>remove(TYPES.profiles,id);

export const generateRecurringNow=async id=>{
  const templates=await getAllRecurring(); const tpl=templates.find(x=>x.id===id);
  if(!tpl) throw new Error('Recurring template not found');
  const prefix=tpl.invoiceType==='proforma'?'EST':tpl.invoiceType==='credit-note'?'CN':tpl.invoiceType==='bill-of-supply'?'BOS':'INV';
  const invoiceNumber=await getNextInvoiceNumber(prefix);
  const invoiceDate=new Date().toISOString().slice(0,10);
  const bill={id:invoiceNumber,clientName:tpl.clientName,invoiceNumber,invoiceDate,invoiceType:tpl.invoiceType||'tax-invoice',currency:tpl.invoiceOptions?.currency||'INR',totalAmount:0,totalTaxAmount:0,status:'unpaid',paidAmount:0,payments:[],generatedFrom:tpl.id,autoGenerated:true,data:{...tpl,details:{...(tpl.details||{}),invoiceNumber,invoiceDate}}};
  await saveBill(bill,{overwrite:false});
  return {success:true,invoiceNumber};
};

export const getBackupsList=async()=>{const uid=await userId();const {data,error}=await supabase.from('app_backups').select('backup_date').eq('user_id',uid).order('backup_date',{ascending:false});if(error)throw error;return data||[]};
export const triggerBackup=async()=>{const payload=await exportAllData();const uid=await userId();const {error}=await supabase.from('app_backups').insert({user_id:uid,data:JSON.parse(payload)});if(error)throw error;return {success:true}};
export const restoreBackup=async date=>{const uid=await userId();const {data,error}=await supabase.from('app_backups').select('data').eq('user_id',uid).eq('backup_date',date).single();if(error)throw error;return importData(JSON.stringify(data.data))};
export const deleteBackup=async date=>{const uid=await userId();const {error}=await supabase.from('app_backups').delete().eq('user_id',uid).eq('backup_date',date);if(error)throw error};
export const getTrashedBills=async()=>{const uid=await userId();const {data,error}=await supabase.from('app_trash').select('data').eq('user_id',uid).eq('record_type','bills');if(error)throw error;return (data||[]).map(x=>x.data)};
export const restoreTrashedBill=async id=>{const uid=await userId();const {data,error}=await supabase.from('app_trash').select('data').eq('user_id',uid).eq('record_type','bills').eq('record_id',String(id)).single();if(error)throw error;await saveBill(data.data);await supabase.from('app_trash').delete().eq('user_id',uid).eq('record_type','bills').eq('record_id',String(id));return data.data};
export const purgeTrashedBill=async id=>{const uid=await userId();const {error}=await supabase.from('app_trash').delete().eq('user_id',uid).eq('record_type','bills').eq('record_id',String(id));if(error)throw error};

const LS_KEYS=['gst_customUnits','gst_regionMode','gst_enabledModules','gst_filing_status','gst_printSettings','gst_itrCalcInputs','gst_itrPresumptive','gst_itrAdvanceTax','gst_stockAlertSettings','freegstbill_invoiceOptions','freegstbill_theme','freegstbill_onboarded','freegstbill_dismissedUpdate','freegstbill_pwa_dismissed_at'];
const collectLS=()=>Object.fromEntries(LS_KEYS.map(k=>[k,localStorage.getItem(k)]).filter(([,v])=>v!==null));
export const exportAllData=async()=>{const [profile,profiles,bills,clients,products,expenses,purchases,recurring,receipts,termsTemplates]=await Promise.all([getProfile(),getAllProfiles(),getAllBills(),getAllClients(),getAllProducts(),getAllExpenses(),getAllPurchases(),getAllRecurring(),getAllReceipts(),getTermsTemplates()]);return JSON.stringify({exportedAt:new Date().toISOString(),version:'cloud',__freegstbill_backup:true,profile,profiles,bills,clients,products,expenses,purchases,recurring,receipts,termsTemplates,meta:{invoiceNumberSettings:await getInvoiceNumberSettings(),stockAlertSettings:await getStockAlertSettings()},localStorage:collectLS()},null,2)};
export const inspectBackup=s=>{const raw=typeof s==='string'?JSON.parse(s):s;return {valid:!!raw&&(raw.__freegstbill_backup||raw.bills||raw.profile),exportedAt:raw.exportedAt||null,version:raw.version||null,counts:Object.fromEntries(['profile','profiles','bills','clients','termsTemplates','products','expenses','purchases','recurring','receipts'].map(k=>[k,Array.isArray(raw[k])?raw[k].length:(raw[k]?1:0)])),raw}};
export const importData=async(s)=>{const raw=typeof s==='string'?JSON.parse(s):s;if(raw.profile)await saveProfile(raw.profile);for(const [key,type] of [['profiles','profiles'],['bills','bills'],['clients','clients'],['products','products'],['expenses','expenses'],['purchases','purchases'],['recurring','recurring'],['receipts','receipts'],['termsTemplates','templates']])for(const item of (raw[key]||[]))await save(type,item);if(raw.meta){if(raw.meta.invoiceNumberSettings)await saveInvoiceNumberSettings(raw.meta.invoiceNumberSettings);if(raw.meta.stockAlertSettings)await saveStockAlertSettings(raw.meta.stockAlertSettings)}for(const [k,v] of Object.entries(raw.localStorage||{}))try{localStorage.setItem(k,v)}catch{};return {success:true}};
export const runUpdateNow=async()=>({ok:false,error:'Online deployments update automatically when you push to GitHub.'});
