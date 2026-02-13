/* =========================================================
   Tense Builder — rebuild (stable)
   Fixes requested:
   ✅ 1) Dark dropdown (CSS: color-scheme + option bg)
   ✅ 2) Sentences start short and grow as you pass checks
   ✅ 3) Bigger tolerance (default 0.65 + LCS similarity)
   ========================================================= */

(() => {
  // -------------------------
  // DOM helpers
  // -------------------------
  const $ = (id) => document.getElementById(id);

  const el = {
    targetText: $("targetText"),
    targetHint: $("targetHint"),
    levelVal: $("levelVal"),
    scoreVal: $("scoreVal"),
    streakVal: $("streakVal"),
    tolVal: $("tolVal"),
    tolRange: $("tolRange"),
    tolLabel: $("tolLabel"),

    heardInput: $("heardInput"),
    wordFeedback: $("wordFeedback"),
    statusLine: $("statusLine"),

    speakBtn: $("speakBtn"),
    micBtn: $("micBtn"),
    translateBtn: $("translateBtn"),
    answerBtn: $("answerBtn"),
    checkBtn: $("checkBtn"),
    skipBtn: $("skipBtn"),
    newUnitBtn: $("newUnitBtn"),

    modeSel: $("modeSel"),
    qTypeSel: $("qTypeSel"),
    qTypeField: $("qTypeField"),
    tenseSel: $("tenseSel"),
    voiceSel: $("voiceSel"),
    recLangSel: $("recLangSel"),
    antiEchoChk: $("antiEchoChk"),

    medalsGrid: $("medalsGrid"),
    medalsCount: $("medalsCount"),

    modal: $("modal"),
    modalTitle: $("modalTitle"),
    modalImg: $("modalImg"),
    modalName: $("modalName"),
    modalMsg: $("modalMsg"),
    modalOk: $("modalOk"),
  };

  // -------------------------
  // State
  // -------------------------
  const LS_UNLOCKED = "tb_unlocked_v1";
  const LS_PROGRESS = "tb_progress_v1";

  const state = {
    level: 1,             // unit number
    score: 0,             // 0..99 (points inside unit)
    streak: 0,            // consecutive correct checks
    tol: 0.65,            // default bigger tolerance
    showTranslation: false,
    showAnswer: false,

    // current exercise (growing)
    ex: {
      segmentsEn: ["—"],
      segmentsEs: ["—"],
      fullEn: "—",
      fullEs: "—",
      idx: 0,
    },

    // mic
    recognition: null,
    micActive: false,
    micWasActiveBeforeTTS: false,

    // voices
    voices: [],
  };

  // -------------------------
  // Characters / medals
  // -------------------------
  const characters = [
    { id:"bombardino",   name:"Bombardino Crocodilo", file:"bombardino.png" },
    { id:"lirili_larila",name:"Lirili Larila",        file:"lirili_larila.png" },
    { id:"frigo_camelo", name:"Frigo Camelo",         file:"frigo_camelo.png" },
    { id:"ballerina",    name:"Ballerina Capuchina",  file:"ballerina.png" },
    { id:"tung_tung",    name:"Tung Tung Tung Sahur", file:"tung_tung.png" },

    { id:"tralalero",    name:"Tralalero",            file:"tralalero.png" },
    { id:"patapim",      name:"Patapim",              file:"patapim.png" },
    { id:"gangster",     name:"Gangster",             file:"gangster.png" },
    { id:"trulimero",    name:"Trulimero",            file:"trulimero.png" },
    { id:"havana",       name:"Havana",               file:"havana.png" },
    { id:"burbaloni",    name:"Burbaloni",            file:"burbaloni.png" },
    { id:"bulbito",      name:"Bulbito",              file:"bulbito.png" },
    { id:"zibra",        name:"Zibra",                file:"zibra.png" },
    { id:"bananita",     name:"Bananita",             file:"bananita.png" },
    { id:"shimpanzinni", name:"Shimpanzinni",         file:"shimpanzinni.png" },
  ];

  function assetUrl(rel){
    // robust relative path for GitHub Pages + local
    if (!rel) return "";
    const cleaned = rel.startsWith("./") ? rel : "./" + rel.replace(/^\/+/, "");
    return new URL(cleaned, document.baseURI).toString();
  }

  function getUnlockedIds(){
    try{
      const raw = localStorage.getItem(LS_UNLOCKED);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function setUnlockedIds(ids){
    localStorage.setItem(LS_UNLOCKED, JSON.stringify(ids));
  }

  function saveProgress(){
    localStorage.setItem(LS_PROGRESS, JSON.stringify({
      level: state.level,
      score: state.score,
      streak: state.streak
    }));
  }
  function loadProgress(){
    try{
      const raw = localStorage.getItem(LS_PROGRESS);
      if(!raw) return;
      const p = JSON.parse(raw);
      if (p && typeof p.level === "number") state.level = Math.max(1, Math.floor(p.level));
      if (p && typeof p.score === "number") state.score = Math.max(0, Math.min(99, Math.floor(p.score)));
      if (p && typeof p.streak === "number") state.streak = Math.max(0, Math.floor(p.streak));
    }catch(e){}
  }

  function renderMedals(){
    const unlocked = new Set(getUnlockedIds());
    el.medalsGrid.innerHTML = "";
    characters.forEach(ch => {
      const div = document.createElement("div");
      div.className = "medal" + (unlocked.has(ch.id) ? "" : " locked");
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = ch.name;
      img.src = assetUrl("assets/medals/" + ch.file);
      img.onerror = () => { img.alt = ch.name + " (missing image)"; };
      div.appendChild(img);

      if (!unlocked.has(ch.id)){
        const tag = document.createElement("div");
        tag.className = "lockTag";
        tag.innerHTML = '<span class="lockIcon">🔒</span><span>Locked</span>';
        div.appendChild(tag);
      }
      el.medalsGrid.appendChild(div);
    });
    const count = getUnlockedIds().length;
    el.medalsCount.textContent = count + "/" + characters.length;
  }

  function unlockNextCharacter(){
    const unlocked = new Set(getUnlockedIds());
    const next = characters.find(c => !unlocked.has(c.id));
    if (!next) return null;
    unlocked.add(next.id);
    setUnlockedIds([...unlocked]);
    renderMedals();
    return next;
  }

  // -------------------------
  // Text normalization + similarity
  // -------------------------
  const CONTRACTIONS = [
    ["can't","cannot"],
    ["won't","will not"],
    ["don't","do not"],
    ["doesn't","does not"],
    ["didn't","did not"],
    ["i'm","i am"],
    ["you're","you are"],
    ["he's","he is"],
    ["she's","she is"],
    ["it's","it is"],
    ["we're","we are"],
    ["they're","they are"],
    ["isn't","is not"],
    ["aren't","are not"],
    ["wasn't","was not"],
    ["weren't","were not"],
    ["i've","i have"],
    ["you've","you have"],
    ["we've","we have"],
    ["they've","they have"],
    ["i'll","i will"],
    ["you'll","you will"],
    ["we'll","we will"],
    ["they'll","they will"],
    ["gonna","going to"],
    ["wanna","want to"],
    ["gotta","got to"]
  ];

  function normalize(s){
    if(!s) return "";
    s = String(s).toLowerCase().trim();
    s = s.replace(/[’]/g, "'");
    for (const [a,b] of CONTRACTIONS){
      s = s.replaceAll(a, b);
    }
    // remove punctuation
    s = s.replace(/[^a-z0-9\s']/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s;
  }

  function tokens(s){
    s = normalize(s);
    if(!s) return [];
    return s.split(" ").filter(Boolean);
  }

  // LCS length (sequence order) for token arrays
  function lcsLen(a, b){
    const n=a.length, m=b.length;
    if(!n || !m) return 0;
    // DP with rolling arrays
    let prev = new Array(m+1).fill(0);
    let cur  = new Array(m+1).fill(0);
    for(let i=1;i<=n;i++){
      cur[0]=0;
      for(let j=1;j<=m;j++){
        cur[j] = (a[i-1]===b[j-1]) ? prev[j-1]+1 : Math.max(prev[j], cur[j-1]);
      }
      const tmp=prev; prev=cur; cur=tmp;
    }
    return prev[m];
  }

  function similarity(expected, heard){
    const a=tokens(expected);
    const b=tokens(heard);
    if(!a.length && !b.length) return 1;
    if(!a.length || !b.length) return 0;
    const l=lcsLen(a,b);
    // F1-like ratio, tolerant to extra/missing words
    return (2*l) / (a.length + b.length);
  }

  function diffMarkup(expected, heard){
    const a=tokens(expected);
    const b=tokens(heard);
    if(!a.length) return "<span class='wMuted'>—</span>";

    // mark expected words that are missing in heard (order-sensitive)
    let bi=0;
    const out=[];
    for (let i=0;i<a.length;i++){
      const w=a[i];
      // find w in b from bi onward
      let found=false;
      for(let j=bi;j<b.length;j++){
        if (b[j]===w){ found=true; bi=j+1; break; }
      }
      if (found) out.push("<span class='wOk'>"+escapeHtml(w)+"</span>");
      else out.push("<span class='wBad'>"+escapeHtml(w)+"</span>");
    }
    return out.join(" ");
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // -------------------------
  // Sentence generator (segments)
  // -------------------------
  const LEX = {
    S: [
      {en:"I", es:"Yo"},
      {en:"You", es:"Tú"},
      {en:"He", es:"Él"},
      {en:"She", es:"Ella"},
      {en:"We", es:"Nosotros"},
      {en:"They", es:"Ellos"},
    ],
    V: [
      {base:"work", past:"worked", pp:"worked", es:"trabajar"},
      {base:"study", past:"studied", pp:"studied", es:"estudiar"},
      {base:"practice", past:"practiced", pp:"practiced", es:"practicar"},
      {base:"create", past:"created", pp:"created", es:"crear"},
      {base:"build", past:"built", pp:"built", es:"construir"},
      {base:"learn", past:"learned", pp:"learned", es:"aprender"},
      {base:"watch", past:"watched", pp:"watched", es:"ver"},
      {base:"write", past:"wrote", pp:"written", es:"escribir"},
      {base:"draw", past:"drew", pp:"drawn", es:"dibujar"},
      {base:"animate", past:"animated", pp:"animated", es:"animar"},
      {base:"call", past:"called", pp:"called", es:"llamar"},
      {base:"help", past:"helped", pp:"helped", es:"ayudar"},
      {base:"fix", past:"fixed", pp:"fixed", es:"arreglar"},
      {base:"clean", past:"cleaned", pp:"cleaned", es:"limpiar"},
      {base:"plan", past:"planned", pp:"planned", es:"planear"},
      {base:"cook", past:"cooked", pp:"cooked", es:"cocinar"},
      {base:"drive", past:"drove", pp:"driven", es:"conducir"},
      {base:"meet", past:"met", pp:"met", es:"conocer"},
      {base:"choose", past:"chose", pp:"chosen", es:"elegir"},
      {base:"bring", past:"brought", pp:"brought", es:"traer"},
      {base:"make", past:"made", pp:"made", es:"hacer"},
      {base:"take", past:"took", pp:"taken", es:"tomar"},
      {base:"give", past:"gave", pp:"given", es:"dar"},
      {base:"find", past:"found", pp:"found", es:"encontrar"},
      {base:"say", past:"said", pp:"said", es:"decir"},
      {base:"tell", past:"told", pp:"told", es:"contar"},
    ],
    O: [
      {en:"on a new lesson", es:"en una nueva lección"},
      {en:"on this project", es:"en este proyecto"},
      {en:"English every day", es:"inglés todos los días"},
      {en:"a short sentence", es:"una frase corta"},
      {en:"a longer sentence", es:"una frase más larga"},
      {en:"my pronunciation", es:"mi pronunciación"},
      {en:"the timeline", es:"la línea de tiempo"},
      {en:"the animations", es:"las animaciones"},
      {en:"the script", es:"el script"},
      {en:"a new idea", es:"una nueva idea"},
    ],
    P: [
      {en:"at home", es:"en casa"},
      {en:"in the morning", es:"en la mañana"},
      {en:"after class", es:"después de clase"},
      {en:"with my team", es:"con mi equipo"},
      {en:"today", es:"hoy"},
      {en:"right now", es:"ahora mismo"},
      {en:"every week", es:"cada semana"},
    ],
    WH: [
      {en:"Why", es:"Por qué"},
      {en:"When", es:"Cuándo"},
      {en:"Where", es:"Dónde"},
      {en:"How", es:"Cómo"},
      {en:"What", es:"Qué"},
    ]
  };

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function joinParts(parts){
    // join with spaces, then fix punctuation spacing
    return parts.join(" ")
      .replace(/\s+,/g, ",")
      .replace(/\s+\./g, ".")
      .replace(/\s+\?/g, "?")
      .replace(/\s+!/g, "!")
      .replace(/\s+/g, " ")
      .trim();
  }

  function segmentsFromParts(partsEn, partsEs){
    const n = partsEn.length;
    const maxSeg = 10;

    const start = Math.min(2, n); // subject + (aux/verb)
    let cutPoints = [];

    if (n <= start) {
      cutPoints = [n];
    } else if (n <= maxSeg) {
      for (let i=start; i<=n; i++) cutPoints.push(i);
    } else {
      // distribute to maxSeg segments
      cutPoints.push(start);
      const remaining = n - start;
      const segsLeft = maxSeg - 1;
      for (let k=1; k<=segsLeft; k++){
        const b = start + Math.round((remaining * k) / segsLeft);
        cutPoints.push(b);
      }
      // ensure increasing & unique
      cutPoints = cutPoints.filter((v,i,a)=> i===0 || v>a[i-1]);
      if (cutPoints[cutPoints.length-1] !== n) cutPoints.push(n);
    }

    const segEn = cutPoints.map(b => joinParts(partsEn.slice(0,b)));
    const segEs = cutPoints.map(b => joinParts(partsEs.slice(0,b)));
    return { segEn, segEs, fullEn: joinParts(partsEn), fullEs: joinParts(partsEs) };
  }

  function makeExercise(){
    const mode = el.modeSel.value;
    const qType = el.qTypeSel.value;
    const tense = el.tenseSel.value;

    if (mode === "questions") return genQuestion(tense, qType);
    return genStatement(tense);
  }

  function genStatement(tenseKey){
    const S = pick(LEX.S);
    const V = pick(LEX.V);
    const O = pick(LEX.O);
    const P = pick(LEX.P);

    const partsEn = [];
    const partsEs = [];

    // Helpers
    const is3s = (S.en === "He" || S.en === "She");

    const v3s = () => {
      if (!is3s) return V.base;
      if (V.base.endsWith("y")) return V.base.slice(0,-1) + "ies";
      if (/(s|x|sh|ch|o)$/.test(V.base)) return V.base + "es";
      return V.base + "s";
    };

    if (tenseKey === "present_simple"){
      partsEn.push(S.en, v3s(), O.en, P.en, ".");
      partsEs.push(S.es, V.es, O.es, P.es, ".");
    }
    else if (tenseKey === "present_continuous"){
      const be = (S.en==="I")?"am":(is3s?"is":"are");
      partsEn.push(S.en, be, V.base+"ing", O.en, P.en, ".");
      partsEs.push(S.es, "estoy/está/están", V.es+"ndo", O.es, P.es, ".");
    }
    else if (tenseKey === "past_simple"){
      partsEn.push(S.en, V.past, O.en, P.en, ".");
      partsEs.push(S.es, "pasado", V.es, O.es, P.es, ".");
    }
    else if (tenseKey === "past_continuous"){
      const wasWere = (S.en==="I"||is3s)?"was":"were";
      partsEn.push(S.en, wasWere, V.base+"ing", O.en, P.en, ".");
      partsEs.push(S.es, "estaba/estaban", V.es+"ndo", O.es, P.es, ".");
    }
    else if (tenseKey === "present_perfect"){
      const have = (S.en==="He"||S.en==="She") ? "has" : "have";
      partsEn.push(S.en, have, V.pp, O.en, "already", ".");
      partsEs.push(S.es, "he/ha", V.es, O.es, "ya", ".");
    }
    else if (tenseKey === "future_will"){
      partsEn.push(S.en, "will", V.base, O.en, "tomorrow", ".");
      partsEs.push(S.es, "voy a", V.es, O.es, "mañana", ".");
    }
    else if (tenseKey === "modals"){
      const modal = pick([{en:"can", es:"puedo"}, {en:"should", es:"debería"}, {en:"must", es:"debo"}, {en:"might", es:"podría"}]);
      partsEn.push(S.en, modal.en, V.base, O.en, P.en, ".");
      partsEs.push(S.es, modal.es, V.es, O.es, P.es, ".");
    }
    else if (tenseKey === "conditional_0"){
      // If + present, present
      const S2 = pick(LEX.S);
      const V2 = pick(LEX.V);
      partsEn.push("If", S.en.toLowerCase(), v3s(), O.en, ",", S2.en.toLowerCase(), (S2.en==="He"||S2.en==="She")? (V2.base+"s") : V2.base, P.en, ".");
      partsEs.push("Si", S.es.toLowerCase(), V.es, O.es, ",", S2.es.toLowerCase(), V2.es, P.es, ".");
    }
    else if (tenseKey === "conditional_1"){
      // If + present, will + base
      const S2 = pick(LEX.S);
      const V2 = pick(LEX.V);
      partsEn.push("If", S.en.toLowerCase(), v3s(), O.en, ",", S2.en.toLowerCase(), "will", V2.base, P.en, ".");
      partsEs.push("Si", S.es.toLowerCase(), V.es, O.es, ",", S2.es.toLowerCase(), "voy a", V2.es, P.es, ".");
    }
    else if (tenseKey === "conditional_2"){
      // If + past, would + base
      const S2 = pick(LEX.S);
      const V2 = pick(LEX.V);
      partsEn.push("If", S.en.toLowerCase(), V.past, O.en, ",", S2.en.toLowerCase(), "would", V2.base, P.en, ".");
      partsEs.push("Si", S.es.toLowerCase(), "pasado", V.es, O.es, ",", S2.es.toLowerCase(), "haría", V2.es, P.es, ".");
    }
    else{
      partsEn.push(S.en, v3s(), O.en, ".");
      partsEs.push(S.es, V.es, O.es, ".");
    }

    return segmentsFromParts(partsEn, partsEs);
  }

  function genQuestion(tenseKey, qType){
    const S = pick(LEX.S);
    const V = pick(LEX.V);
    const O = pick(LEX.O);
    const P = pick(LEX.P);
    const WH = pick(LEX.WH);

    const is3s = (S.en === "He" || S.en === "She");

    const partsEn = [];
    const partsEs = [];

    // yes/no base (present)
    const doAux = is3s ? "Does" : "Do";

    if (qType === "wh"){
      if (tenseKey === "past_simple"){
        partsEn.push(WH.en, "did", S.en.toLowerCase(), V.base, O.en, P.en, "?");
        partsEs.push(WH.es, "hizo", S.es.toLowerCase(), V.es, O.es, P.es, "?");
      }else{
        partsEn.push(WH.en, doAux.toLowerCase(), S.en.toLowerCase(), V.base, O.en, P.en, "?");
        partsEs.push(WH.es, doAux.toLowerCase(), S.es.toLowerCase(), V.es, O.es, P.es, "?");
      }
    } else {
      if (tenseKey === "past_simple"){
        partsEn.push("Did", S.en.toLowerCase(), V.base, O.en, P.en, "?");
        partsEs.push("¿", S.es.toLowerCase(), "hizo", V.es, O.es, P.es, "?");
      } else if (tenseKey === "present_continuous"){
        const be = (S.en==="I")?"Am":(is3s?"Is":"Are");
        partsEn.push(be, S.en.toLowerCase(), V.base+"ing", O.en, P.en, "?");
        partsEs.push("¿", S.es.toLowerCase(), "estoy/está/están", V.es+"ndo", O.es, P.es, "?");
      } else if (tenseKey === "present_perfect"){
        const have = (S.en==="He"||S.en==="She") ? "Has" : "Have";
        partsEn.push(have, S.en.toLowerCase(), V.pp, O.en, "already", "?");
        partsEs.push("¿", S.es.toLowerCase(), "he/ha", V.es, O.es, "ya", "?");
      } else {
        partsEn.push(doAux, S.en.toLowerCase(), V.base, O.en, P.en, "?");
        partsEs.push("¿", doAux.toLowerCase(), S.es.toLowerCase(), V.es, O.es, P.es, "?");
      }
    }

    return segmentsFromParts(partsEn, partsEs);
  }

  // -------------------------
  // UI sync
  // -------------------------
  function currentTargetEn(){
    return state.ex.segmentsEn[Math.min(state.ex.idx, state.ex.segmentsEn.length-1)] || "—";
  }
  function currentTargetEs(){
    return state.ex.segmentsEs[Math.min(state.ex.idx, state.ex.segmentsEs.length-1)] || "—";
  }

  function syncUI(){
    el.levelVal.textContent = state.level;
    el.scoreVal.textContent = state.score;
    el.streakVal.textContent = state.streak;
    el.tolVal.textContent = state.tol.toFixed(2);

    const target = currentTargetEn();
    el.targetText.textContent = target;

    if (state.showTranslation){
      el.targetHint.innerHTML = "<span class='wMuted'>ES:</span> " + escapeHtml(currentTargetEs());
    } else if (state.showAnswer){
      el.targetHint.innerHTML = "<span class='wMuted'>Answer:</span> " + escapeHtml(state.ex.fullEn);
    } else {
      el.targetHint.innerHTML = "Say it, then press <b>Check</b>. (It grows as you pass.)";
    }
  }

  // -------------------------
  // Exercise flow
  // -------------------------
  function startNewExercise(){
    const ex = makeExercise();
    state.ex.segmentsEn = ex.segEn;
    state.ex.segmentsEs = ex.segEs;
    state.ex.fullEn = ex.fullEn;
    state.ex.fullEs = ex.fullEs;
    state.ex.idx = 0;
    state.showTranslation = false;
    state.showAnswer = false;

    el.heardInput.value = "";
    el.wordFeedback.innerHTML = "<span class='wMuted'>—</span>";
    el.statusLine.textContent = "New target. Start with the short version.";
    syncUI();
  }

  function advanceSegment(){
    state.ex.idx += 1;
    if (state.ex.idx >= state.ex.segmentsEn.length){
      // sentence completed
      state.streak += 1;
      el.statusLine.textContent = "Nice! Full sentence completed. New one…";
      startNewExercise();
      return;
    }
    el.statusLine.textContent = "Good. Now say the longer version.";
    syncUI();
  }

  function addPoint(){
    state.score += 1;
    if (state.score >= 100){
      // reward
      state.score = 0;
      state.level += 1;
      const won = unlockNextCharacter();
      if (won) showReward(won);
      else showReward({ name:"All characters", file:"bombardino.png", id:"all" }, true);

      saveProgress();
    } else {
      saveProgress();
    }
    syncUI();
  }

  // -------------------------
  // Modal reward
  // -------------------------
  function showReward(ch, allDone=false){
    el.modalTitle.textContent = "You rescued a character!";
    el.modalName.textContent = ch.name || "New character";
    const msg = allDone
      ? "Legendary! You unlocked everyone."
      : "Amazing! Keep going — you won " + (ch.name || "a character") + ".";
    el.modalMsg.textContent = msg;

    const imgFile = ch.file || "bombardino.png";
    el.modalImg.src = assetUrl("assets/medals/" + imgFile);

    el.modal.classList.remove("hidden");
    // speak reward
    speakText(msg);
  }

  function hideReward(){
    el.modal.classList.add("hidden");
  }

  // -------------------------
  // TTS
  // -------------------------
  function refreshVoices(){
    const list = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    state.voices = list || [];
    el.voiceSel.innerHTML = "";

    // prefer English voices
    const sorted = [...state.voices].sort((a,b) => {
      const aEn = (a.lang||"").startsWith("en") ? 0 : 1;
      const bEn = (b.lang||"").startsWith("en") ? 0 : 1;
      return aEn - bEn;
    });

    sorted.forEach((v, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = (v.name || "Voice") + " — " + (v.lang || "");
      el.voiceSel.appendChild(opt);
    });
  }

  function selectedVoice(){
    const list = [...state.voices];
    const idx = parseInt(el.voiceSel.value || "0", 10);
    // voiceSel is built from sorted list; rebuild same order
    const sorted = [...list].sort((a,b) => {
      const aEn = (a.lang||"").startsWith("en") ? 0 : 1;
      const bEn = (b.lang||"").startsWith("en") ? 0 : 1;
      return aEn - bEn;
    });
    return sorted[idx] || null;
  }

  function speakText(text){
    if (!window.speechSynthesis) return;
    const t = String(text || "").trim();
    if (!t) return;

    // anti-echo: stop mic while speaking
    if (el.antiEchoChk.checked && state.micActive){
      state.micWasActiveBeforeTTS = true;
      stopMic();
    } else {
      state.micWasActiveBeforeTTS = false;
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    const v = selectedVoice();
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.0;

    u.onend = () => {
      if (el.antiEchoChk.checked && state.micWasActiveBeforeTTS){
        startMic();
      }
    };

    window.speechSynthesis.speak(u);
  }

  // -------------------------
  // STT (SpeechRecognition)
  // -------------------------
  function setupRecognition(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (ev) => {
      let finalTxt = "";
      let interim = "";
      for (let i=ev.resultIndex; i<ev.results.length; i++){
        const r = ev.results[i];
        const txt = r[0] ? r[0].transcript : "";
        if (r.isFinal) finalTxt += txt + " ";
        else interim += txt + " ";
      }
      const out = (finalTxt || interim).trim();
      if (out) el.heardInput.value = out;
      el.statusLine.textContent = out ? "Heard: " + out : "Listening…";
    };

    rec.onerror = (ev) => {
      state.micActive = false;
      el.micBtn.textContent = "🎙️ Start mic";
      el.statusLine.textContent = "Mic error: " + (ev.error || "unknown");
    };

    rec.onend = () => {
      state.micActive = false;
      el.micBtn.textContent = "🎙️ Start mic";
      el.statusLine.textContent = "Mic stopped.";
    };

    state.recognition = rec;
  }

  function startMic(){
    if (!state.recognition){
      setupRecognition();
      if (!state.recognition){
        el.statusLine.textContent = "SpeechRecognition not supported in this browser.";
        return;
      }
    }
    try{
      state.recognition.lang = el.recLangSel.value || "en-US";
      state.recognition.start();
      state.micActive = true;
      el.micBtn.textContent = "🛑 Stop mic";
      el.statusLine.textContent = "Listening…";
    }catch(e){
      // Sometimes start() throws if called twice quickly
      el.statusLine.textContent = "Mic busy. Try again.";
      state.micActive = false;
      el.micBtn.textContent = "🎙️ Start mic";
    }
  }

  function stopMic(){
    try{ state.recognition && state.recognition.stop(); }catch(e){}
    state.micActive = false;
    el.micBtn.textContent = "🎙️ Start mic";
  }

  function toggleMic(){
    if (state.micActive) stopMic();
    else startMic();
  }

  // -------------------------
  // Check logic (with growing target)
  // -------------------------
  function doCheck(){
    const expected = currentTargetEn();
    const heard = el.heardInput.value || "";

    const sim = similarity(expected, heard);
    const ok = sim >= state.tol;

    // word feedback
    el.wordFeedback.innerHTML = diffMarkup(expected, heard) +
      "<div class='wMuted' style='margin-top:8px'>Similarity: <b>" + sim.toFixed(2) + "</b> (tol " + state.tol.toFixed(2) + ")</div>";

    if (ok){
      addPoint();
      advanceSegment();
      el.statusLine.textContent = "✅ Correct! +" + 1 + " pt";
    } else {
      state.streak = 0;
      el.statusLine.textContent = "❌ Almost. Try again (say it slower).";
      syncUI();
    }
  }

  function doSkip(){
    state.streak = 0;
    startNewExercise();
  }

  // -------------------------
  // Settings + toggles
  // -------------------------
  function setTol(val){
    const n = Math.max(0.55, Math.min(0.90, Number(val)));
    state.tol = n;
    el.tolRange.value = String(n);
    el.tolLabel.textContent = n.toFixed(2);
    syncUI();
  }

  function refreshModeUI(){
    const mode = el.modeSel.value;
    el.qTypeField.style.display = (mode === "questions") ? "" : "none";
    startNewExercise();
  }

  function newUnit(){
    // Just reset score inside unit (keeps unlocked medals)
    state.score = 0;
    state.streak = 0;
    saveProgress();
    el.statusLine.textContent = "New unit started.";
    startNewExercise();
    syncUI();
  }

  // -------------------------
  // Events
  // -------------------------
  el.checkBtn.addEventListener("click", doCheck);
  el.skipBtn.addEventListener("click", doSkip);
  el.micBtn.addEventListener("click", toggleMic);
  el.speakBtn.addEventListener("click", () => speakText(currentTargetEn()));
  el.translateBtn.addEventListener("click", () => {
    state.showTranslation = !state.showTranslation;
    state.showAnswer = false;
    syncUI();
  });
  el.answerBtn.addEventListener("click", () => {
    state.showAnswer = !state.showAnswer;
    state.showTranslation = false;
    syncUI();
  });
  el.newUnitBtn.addEventListener("click", newUnit);

  el.modeSel.addEventListener("change", refreshModeUI);
  el.qTypeSel.addEventListener("change", startNewExercise);
  el.tenseSel.addEventListener("change", startNewExercise);
  el.recLangSel.addEventListener("change", () => { if (state.micActive) { stopMic(); startMic(); }});
  el.tolRange.addEventListener("input", (e) => setTol(e.target.value));

  el.modalOk.addEventListener("click", hideReward);
  el.modal.querySelector(".modalBackdrop").addEventListener("click", hideReward);

  // keyboard help
  el.heardInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){
      e.preventDefault();
      doCheck();
    }
  });

  // -------------------------
  // Init
  // -------------------------
  function init(){
    loadProgress();
    setTol(state.tol);
    renderMedals();
    refreshModeUI();

    // voices may load async
    refreshVoices();
    if (window.speechSynthesis){
      window.speechSynthesis.onvoiceschanged = () => refreshVoices();
    }
    syncUI();
  }

  init();
})();
