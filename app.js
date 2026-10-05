import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, push, onValue, remove } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBcJ6dP8LqxmJBD-XGvX4eP7Lz29J3LQYY",
  authDomain: "cricket-auction-a1fb5.firebaseapp.com",
  databaseURL: "https://cricket-auction-a1fb5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cricket-auction-a1fb5",
  storageBucket: "cricket-auction-a1fb5.firebasestorage.app",
  messagingSenderId: "809158799665",
  appId: "1:809158799665:web:73fd07d02647e5d7674010"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const TOURNAMENT = "main";
const ADMIN_EMAIL = ""; // Security is enforced by Firebase Rules.
const $ = id => document.getElementById(id);
let user = null, role = null, teamId = null, stopListeners = [];
let cache = { settings:{tournamentName:"Cricket Auction",totalPoints:1200,playersRequired:8,minimumBid:30}, teams:{}, sales:{}, auction:{} };

const path = p => ref(db, `tournaments/${TOURNAMENT}/${p}`);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const num = n => Math.max(0, Math.floor(Number(n)||0));

function clearListeners(){ stopListeners.forEach(fn=>fn()); stopListeners=[]; }
function listen(p, cb){ const r=ref(db,`tournaments/${TOURNAMENT}/${p}`); const off=onValue(r,s=>cb(s.val())); stopListeners.push(off); }
function setLoginMessage(m){ $("loginMessage").textContent=m||""; }
function show(id,on=true){ $(id).classList.toggle("hidden",!on); }

function reserve(t){ const slots=Math.max(0,cache.settings.playersRequired-(t.players?.length||0)); return slots*cache.settings.minimumBid; }
function maxBid(t){
  const bought=(t.players?.length||0);
  if(bought>=cache.settings.playersRequired) return 0;
  // User's requested first-bid cap: total - (minimum × all 8 required slots).
  // After a purchase, reserve only the slots still remaining.
  if(bought===0) return Math.max(0,cache.settings.totalPoints-cache.settings.minimumBid*cache.settings.playersRequired);
  const remaining=num(t.points);
  const slotsAfterPurchase=Math.max(0,cache.settings.playersRequired-(bought+1));
  return Math.max(0,remaining-cache.settings.minimumBid*slotsAfterPurchase);
}

function renderAdmin(){
  const s=cache.settings;
  $("appTitle").textContent=s.tournamentName||"Cricket Auction";
  $("totalPoints").value=s.totalPoints; $("playersRequired").value=s.playersRequired; $("minimumBid").value=s.minimumBid; $("tournamentName").value=s.tournamentName;
  const teams=Object.values(cache.teams||{});
  $("teamCount").textContent=`${teams.length} team${teams.length===1?"":"s"}`;
  $("winningTeam").innerHTML=teams.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")||`<option value="">Add a team first</option>`;
  $("adminTeams").innerHTML=teams.length?teams.map(t=>`<div class="team-row"><div><div class="team-name">${esc(t.name)}</div><div class="sub">${(t.players||[]).length}/${s.playersRequired} players · reserve ${reserve(t)} pts · code <b>${esc(t.accessCode||"")}</b></div></div><div class="team-actions"><div class="team-stat"><strong>${num(t.points)}</strong><div class="sub">Max bid ${maxBid(t)}</div></div><button class="danger delete-team" data-team-id="${esc(t.id)}" type="button">Delete</button></div></div>`).join(""): `<div class="empty">No teams yet.</div>`;
  document.querySelectorAll(".delete-team").forEach(btn=>btn.onclick=()=>deleteTeam(btn.dataset.teamId));
  const sales=Object.values(cache.sales||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  $("history").innerHTML=sales.length?sales.map(h=>`<div class="history-row"><div><strong>${esc(h.player)}</strong><div class="sub">${esc(h.teamName)}</div></div><div class="price">${num(h.price)} pts</div></div>`).join(""):`<div class="empty">No sales yet.</div>`;
}

function renderTeam(){
  const t=cache.teams?.[teamId];
  if(!t){ $("teamDashboard").innerHTML=`<div class="card empty">Your team is not available.</div>`; return; }
  const total=cache.settings.totalPoints, spent=total-num(t.points), pct=Math.min(100,Math.max(0,spent/Math.max(1,total)*100));
  const current=cache.auction?.currentPlayer;
  $("appTitle").textContent=cache.settings.tournamentName||"Cricket Auction";
  $("teamDashboard").innerHTML=`<div class="hero team-hero"><div class="eyebrow">TEAM LIMIT</div><h2>${esc(t.name)}</h2><div class="sub">Remaining points</div><div class="balance">${num(t.points)}</div><div class="metrics"><div class="metric"><span>MAX NEXT BID</span><b>${maxBid(t)}</b></div><div class="metric"><span>PLAYERS</span><b>${(t.players||[]).length}/${cache.settings.playersRequired}</b></div><div class="metric"><span>RESERVE NEEDED</span><b>${reserve(t)}</b></div></div><div class="progress"><div style="width:${pct}%"></div></div><div class="sub">${spent} points spent</div>${current?`<div class="current"><span>CURRENT PLAYER</span><b>${esc(current)}</b></div>`:""}</div><div class="card"><h2>Players Bought</h2>${(t.players||[]).length?`<ul class="player-list">${t.players.map((p,i)=>`<li><span>${i+1}. ${esc(p.name)}</span><strong>${num(p.price)} pts</strong></li>`).join("")}</ul>`:`<div class="empty">No players bought yet.</div>`}</div>`;
}

function startAdminListeners(){
  clearListeners();
  listen("settings",v=>{cache.settings=v||cache.settings;renderAdmin();});
  listen("teams",v=>{cache.teams=v||{};renderAdmin();});
  listen("sales",v=>{cache.sales=v||{};renderAdmin();});
  listen("auction",v=>{cache.auction=v||{};renderAdmin();});
}
function startTeamListeners(){
  clearListeners();
  listen("settings",v=>{cache.settings=v||cache.settings;renderTeam();});
  listen(`teams/${teamId}`,v=>{cache.teams={[teamId]:v};renderTeam();});
  listen("auction",v=>{cache.auction=v||{};renderTeam();});
}

async function adminLogin(){
  try{setLoginMessage("Signing in…");await signInWithEmailAndPassword(auth,$("adminEmail").value.trim(),$("adminPassword").value);role="admin";teamId=null;show("loginView",false);show("adminView",true);show("teamView",false);show("logoutBtn",true);startAdminListeners();setLoginMessage("");}
  catch(e){setLoginMessage(e.message.replace("Firebase:","").trim());}
}

async function teamLogin(){
  const code=$("teamCode").value.trim().toUpperCase(); if(!code)return setLoginMessage("Enter the team access code.");
  try{
    setLoginMessage("Joining team…");
    if(!auth.currentUser) await signInAnonymously(auth);
    const lookup=await get(ref(db,`teamAccess/${code}`));
    const foundId=lookup.val();
    if(!foundId) throw new Error("Invalid team access code.");
    const uid=auth.currentUser.uid;
    await set(ref(db,`teamMembers/${uid}`),{teamId:foundId,accessCode:code,createdAt:Date.now()});
    role="team";teamId=foundId;show("loginView",false);show("adminView",false);show("teamView",true);show("logoutBtn",true);startTeamListeners();setLoginMessage("");
  }catch(e){setLoginMessage(e.message.replace("Firebase:","").trim());}
}

async function saveSettings(){
  const settings={tournamentName:$("tournamentName").value.trim()||"Cricket Auction",totalPoints:num($("totalPoints").value),playersRequired:Math.max(1,num($("playersRequired").value)),minimumBid:Math.max(1,num($("minimumBid").value))};
  if(!settings.totalPoints)return $("adminMessage").textContent="Total points must be greater than zero.";
  await set(path("settings"),settings); $("adminMessage").textContent="Settings saved.";
}

function makeCode(){return Math.random().toString(36).slice(2,8).toUpperCase();}

function friendlyFirebaseError(e){
  const code=e?.code||"";
  const msg=String(e?.message||e||"");
  if(code.includes("PERMISSION_DENIED") || msg.toLowerCase().includes("permission_denied")) return "Permission denied. Your Firebase Rules are not allowing this admin account to write.";
  if(code.includes("NETWORK")) return "Network error. Check your internet connection.";
  return msg.replace(/^FirebaseError:\s*/i,"").trim() || "Unknown Firebase error";
}
async function addTeam(){
  const name=$("newTeamName").value.trim();
  const msg=$("adminMessage");
  if(!name){ msg.textContent="Enter a team name."; return; }
  if(!auth.currentUser){ msg.textContent="Admin is not signed in. Please log in again."; return; }
  if(auth.currentUser.isAnonymous){ msg.textContent="You are signed in anonymously. Please use the Admin login."; return; }
  try{
    msg.textContent="Adding team…";
    const teams=Object.values(cache.teams||{});
    if(teams.some(t=>String(t.name||"").toLowerCase()===name.toLowerCase())){
      msg.textContent="That team already exists."; return;
    }
    const id=`team_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    let accessCode=makeCode();
    // Avoid an accidental access-code collision.
    for(let i=0;i<5;i++){
      const existing=await get(ref(db,`teamAccess/${accessCode}`));
      if(!existing.exists()) break;
      accessCode=makeCode();
    }
    const team={id,name,points:num(cache.settings.totalPoints),players:[],accessCode};
    // One atomic update: either both records are written or neither is.
    await update(ref(db),{
      [`tournaments/${TOURNAMENT}/teams/${id}`]:team,
      [`teamAccess/${accessCode}`]:id
    });
    $("newTeamName").value="";
    msg.textContent=`✓ Team ${name} added. Access code: ${accessCode}`;
  }catch(e){
    console.error("Add team failed",e);
    msg.textContent=`Add Team failed: ${friendlyFirebaseError(e)}`;
    // Also surface the error at the top so it cannot be missed on mobile.
    setLoginMessage(`Admin error: ${friendlyFirebaseError(e)}`);
  }
}
async function deleteTeam(id){
  const team=cache.teams?.[id];
  if(!team){ $("adminMessage").textContent="Team not found."; return; }
  const players=team.players||[];
  const hasSales=Object.values(cache.sales||{}).some(s=>s.teamId===id);
  if(players.length || hasSales){
    $("adminMessage").textContent=`Cannot delete ${team.name}: this team already has auction activity.`;
    return;
  }
  const ok=confirm(`Delete team "${team.name}"? This will also disable its access code.`);
  if(!ok) return;
  try{
    $("adminMessage").textContent=`Deleting ${team.name}…`;
    await update(ref(db),{
      [`tournaments/${TOURNAMENT}/teams/${id}`]:null,
      [`teamAccess/${team.accessCode}`]:null
    });
    $("adminMessage").textContent=`✓ Team ${team.name} deleted.`;
  }catch(e){
    console.error("Delete team failed",e);
    $("adminMessage").textContent=`Delete Team failed: ${friendlyFirebaseError(e)}`;
  }
}

async function sellPlayer(){
  const player=$("currentPlayer").value.trim(), tid=$("winningTeam").value, team=cache.teams?.[tid], price=Math.floor(Number($("soldPrice").value));
  if(!player)return $("adminMessage").textContent="Enter the player name.";
  if(!team)return $("adminMessage").textContent="Add/select a winning team.";
  if(!Number.isFinite(price)||price<cache.settings.minimumBid)return $("adminMessage").textContent=`Minimum bid is ${cache.settings.minimumBid} points.`;
  if((team.players||[]).length>=cache.settings.playersRequired)return $("adminMessage").textContent="This team has completed its player quota.";
  const legal=maxBid(team); if(price>legal)return $("adminMessage").textContent=`${team.name}'s maximum legal bid is ${legal} points.`;
  const playerObj={name:player,price}; const saleRef=push(path("sales"));
  const newPlayers=[...(team.players||[]),playerObj];
  await update(path(`teams/${tid}`),{points:num(team.points)-price,players:newPlayers});
  await set(saleRef,{player,teamId:tid,teamName:team.name,price,createdAt:Date.now()});
  await set(path("auction/currentPlayer"),player);
  $("currentPlayer").value="";$("soldPrice").value="";$("adminMessage").textContent=`${player} sold to ${team.name} for ${price} points.`;
}

async function undo(){
  const sales=Object.entries(cache.sales||{}).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0)); const latest=sales[0]; if(!latest)return;
  const [saleId,h]=latest, team=cache.teams?.[h.teamId]; if(!team)return;
  const players=[...(team.players||[])]; const idx=players.findIndex((p,i)=>p.name===h.player&&p.price===h.price); if(idx>=0)players.splice(idx,1);
  await update(path(`teams/${h.teamId}`),{points:num(team.points)+num(h.price),players}); await remove(path(`sales/${saleId}`)); $("adminMessage").textContent=`Undid ${h.player}'s sale.`;
}

async function logout(){clearListeners();await signOut(auth);role=null;teamId=null;show("logoutBtn",false);show("loginView",true);show("adminView",false);show("teamView",false);}

$("adminLoginTab").onclick=()=>{show("adminLoginBox",true);show("teamLoginBox",false);$("adminLoginTab").classList.add("active");$("teamLoginTab").classList.remove("active");};
$("teamLoginTab").onclick=()=>{show("adminLoginBox",false);show("teamLoginBox",true);$("teamLoginTab").classList.remove("active");$("adminLoginTab").classList.remove("active");};
$("adminLogin").onclick=adminLogin; $("teamLogin").onclick=teamLogin; $("logoutBtn").onclick=logout;
$("saveSettings").onclick=saveSettings; $("addTeam").onclick=addTeam; $("sellPlayer").onclick=sellPlayer; $("undoSale").onclick=undo;

onAuthStateChanged(auth,(u)=>{
  user=u;
  if(u && role === "admin") { show("loginView",false); show("adminView",true); show("teamView",false); show("logoutBtn",true); }
});

// Seed settings once if empty. Rules must allow admin to do this after login.
(async()=>{try{const s=await get(path("settings"));if(!s.exists())await set(path("settings"),cache.settings);}catch{}})();
