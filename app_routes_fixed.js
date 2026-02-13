(() => {
  if (window.__TB_INITED__) return;
  window.__TB_INITED__ = true;

  // =========================
  // DOM
  // =========================
  const $ = (id) => document.getElementById(id);

  const btnNew = $("btnNew");
  const btnSpeak = $("btnSpeak");
  const btnMic = $("btnMic");
  const btnTranslate = $("btnTranslate");
  const btnShow = $("btnShow");
  const btnCheck = $("btnCheck");
  const btnSkip = $("btnSkip");
  const btnModalOk = $("btnModalOk");

  const targetText = $("targetText");
  const heardText = $("heardText");
  const feedback = $("feedback");
  const glossary = $("glossary");
  const statusEl = $("status");

  const statLevel = $("statLevel");
  const statScore = $("statScore");
  const statStreak = $("statStreak");

  const selMode = $("selMode");
  const selQType = $("selQType");
  const selTense = $("selTense");
  const selVoice = $("selVoice");
  const selRecLang = $("selRecLang");
  const chkAntiEcho = $("chkAntiEcho");

  const medalsEl = $("medals");
  const medalCount = $("medalCount");

  const modal = $("modal");
  const modalImg = $("modalImg");
  const modalText = $("modalText");

  // =========================
  // STATE
  // =========================
  const MAX_LEVEL = 100;

  let level = 1;
  let score = 0;
  let streak = 0;

  let currentTarget = "";
  let currentTokens = [];
  let unitCompleted = false;

  let ttsVoice = null;
  let ttsSpeaking = false;

  // Speech Recognition
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let sessionActive = false;

  // Medals
    const MEDAL_ROSTER = [
    { id:"zibra", name:"ZIBRA", img:"assets/medals/zibra.png" },
    { id:"patapim", name:"PATAPIM", img:"assets/medals/patapim.png" },
    { id:"gangster", name:"GANGSTER", img:"assets/medals/gangster.png" },
    { id:"shimpanzinni", name:"SHIMPANZINNI", img:"assets/medals/shimpanzinni.png" },
    { id:"lirili_larila", name:"LIRILI LARILA", img:"assets/medals/lirili_larila.png" },
    { id:"frigo_camelo", name:"FRIGO CAMELO", img:"assets/medals/frigo_camelo.png" },
    { id:"bulbito", name:"BULBITO", img:"assets/medals/bulbito.png" },
    { id:"bombardino", name:"BOMBARDINO", img:"assets/medals/bombardino.png" },
    { id:"balerina", name:"BALLERINA", img:"assets/medals/balerina.png" },
    { id:"burbaloni", name:"BURBALONI", img:"assets/medals/burbaloni.png" },
    { id:"trulimero", name:"TRULIMERO", img:"assets/medals/trulimero.png" },
    { id:"tralalero", name:"TRALALERO", img:"assets/medals/tralalero.png" },
    { id:"bananita", name:"BANANITA", img:"assets/medals/bananita.png" },
    { id:"havana", name:"HAVANA", img:"assets/medals/havana.png" },
    { id:"tung_tung", name:"TUNG-TUNG", img:"assets/medals/tung_tung.png" },
  ];

  const LS_UNLOCK = "tb_unlocked_v1";
  const unlocked = new Set(JSON.parse(localStorage.getItem(LS_UNLOCK) || "[]"));

  // =========================
  // DATA — simple but coherent
  // =========================
  const SUBJ = ["I","you","we","they","he","she"];
  const OBJ = ["my schedule","a new lesson","the plan","my English","this project","the meeting","the timeline"];
  const PLACES = ["in Bogotá","at home","at work","in class","with my team","online"];
  const TIMES = ["today","this week","in the morning","after class","right now","these days"];
  const REASONS = ["because it matters","because I want to improve","because it is important","because we have a deadline"];
  const CONTRAST = ["however, I stay calm","although it is hard, I continue","but I keep going"];
  const RESULTS = ["so I practice again","therefore I focus","so we finish the task"];
  const ADV = ["already","just","therefore","however","both","the same"];

  // very small ES glossary to avoid wrong full translations
  const ES = {
    i:"yo", you:"tú", we:"nosotros", they:"ellos", he:"él", she:"ella",
    a:"un/una", an:"un/una", the:"el/la/los/las",
    new:"nuevo", lesson:"lección", schedule:"cronograma", plan:"plan",
    english:"inglés", project:"proyecto", meeting:"reunión", timeline:"línea de tiempo",
    in:"en", at:"en", on:"en", with:"con", today:"hoy", week:"semana", morning:"mañana",
    because:"porque", important:"importante", however:"sin embargo", therefore:"por lo tanto",
    already:"ya", just:"acabo de", both:"ambos", same:"mismo",
    do:"hacer", does:"hace", did:"hizo", have:"he/has", has:"ha", will:"haré/hará"
  };

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function chance(p){ return Math.random() < p; }

  // =========================
  // TENSE ENGINE (basic)
  // =========================
  function buildBase(mode, qType, tense){
    const s = pick(SUBJ);
    const obj = pick(OBJ);
    const place = pick(PLACES);
    const time = pick(TIMES);

    if (tense === "present_simple"){
      if (mode === "questions"){
        if (qType === "wh"){
          const wh = pick(["What","Where","When","Why","How"]);
          return `${wh} do ${s.toLowerCase()} work on ${obj}?`;
        }
        return `Do ${s.toLowerCase()} work on ${obj}?`;
      }
      return `${s} work on ${obj} ${place} ${time}.`;
    }

    if (tense === "present_cont"){
      if (mode === "questions"){
        return `Are ${s.toLowerCase()} working on ${obj} ${place}?`;
      }
      return `${s} am/are/is working on ${obj} ${place} ${time}.`
        .replace("I am/are/is","I am").replace("you am/are/is","you are")
        .replace("we am/are/is","we are").replace("they am/are/is","they are")
        .replace("he am/are/is","he is").replace("she am/are/is","she is");
    }

    if (tense === "past_cont"){
      if (mode === "questions"){
        return `Were ${s.toLowerCase()} working on ${obj} ${place}?`
          .replace("were i","was I").replace("were he","was he").replace("were she","was she");
      }
      return `${s} was/were working on ${obj} ${place} ${time}.`
        .replace("I was/were","I was").replace("you was/were","you were")
        .replace("we was/were","we were").replace("they was/were","they were")
        .replace("he was/were","he was").replace("she was/were","she was");
    }

    if (tense === "present_perf"){
      if (mode === "questions"){
        return `Have ${s.toLowerCase()} improved ${obj}?`
          .replace("have he","Has he").replace("have she","Has she");
      }
      return `${s} have/has improved ${obj} already.`
        .replace("I have/has","I have").replace("you have/has","you have")
        .replace("we have/has","we have").replace("they have/has","they have")
        .replace("he have/has","he has").replace("she have/has","she has");
    }

    if (tense === "future_will"){
      if (mode === "questions"){
        return `Will ${s.toLowerCase()} work on ${obj} ${time}?`;
      }
      return `${s} will work on ${obj} ${place} ${time}.`;
    }

    if (tense === "conditional_0"){
      const cond = `If ${s.toLowerCase()} practice every day, ${s.toLowerCase()} improve.`;
      return (mode==="questions") ? `What happens if ${s.toLowerCase()} practice every day?` : cond;
    }

    if (tense === "conditional_1"){
      const cond = `If ${s.toLowerCase()} practice today, ${s.toLowerCase()} will improve.`;
      return (mode==="questions") ? `What will happen if ${s.toLowerCase()} practice today?` : cond;
    }

    if (tense === "conditional_2"){
      const cond = `If ${s.toLowerCase()} practiced more, ${s.toLowerCase()} would improve.`;
      return (mode==="questions") ? `What would happen if ${s.toLowerCase()} practiced more?` : cond;
    }

    if (tense === "modals"){
      const modal = pick(["can","should","must","might"]);
      if (mode==="questions"){
        return `What ${modal} ${s.toLowerCase()} do ${time}?`;
      }
      return `${s} ${modal} work on ${obj} ${place}.`;
    }

    return `${s} work on ${obj}.`;
  }

  // Build 100 levels: grow with connectors, keep length reasonable
  function buildLevels(base, mode){
    const lvls = [clean(base)];
    const adds = [
      () => pick(PLACES),
      () => pick(TIMES),
      () => `, ${pick(REASONS)}`,
      () => `, ${pick(CONTRAST)}`,
      () => `, ${pick(RESULTS)}`,
      () => `, ${pick(ADV)}`,
      () => `, from my perspective`,
      () => `, on the one hand, it helps`,
      () => `, on the other hand, it is hard`,
    ];

    function attach(sentence, add){
      if (mode === "questions"){
        if (sentence.endsWith("?")) return clean(sentence.slice(0,-1) + " " + add + "?");
        return clean(sentence + " " + add);
      }
      return clean(sentence + " " + add);
    }

    while (lvls.length < MAX_LEVEL){
      let s = lvls[lvls.length-1];

      // reset once so it doesn't become a monster sentence
      if (lvls.length === 55) s = lvls[0];

      // storytelling starter sometimes (statements only)
      if (mode !== "questions" && chance(0.18)){
        const starter = pick(["Then","After that","Suddenly","In the end"]);
        s = clean(`${starter}, ${s[0].toLowerCase()}${s.slice(1)}`);
      }

      s = attach(s, adds[lvls.length % adds.length]());
      lvls.push(s);
    }
    return lvls;
  }

  function clean(s){
    return String(s)
      .replace(/\s+/g," ")
      .replace(/\s+,/g,",")
      .replace(/am\/are\/is/g,"are")
      .trim();
  }

  function tokenize(s){
    return clean(s)
      .replace(/[\.,!?]/g,"")
      .toLowerCase()
      .split(" ")
      .filter(Boolean);
  }

  // =========================
  // UI helpers
  // =========================
  function setStatus(msg, tone="muted"){
    statusEl.innerHTML = msg;
    statusEl.style.color = tone==="ok" ? "var(--ok)" : tone==="warn" ? "var(--warn)" : "var(--muted)";
  }

  function renderStats(){
    statLevel.textContent = String(level);
    statScore.textContent = String(score);
    statStreak.textContent = String(streak);
  }

  function renderMedals(){
    medalCount.textContent = `${unlocked.size}/${MEDAL_ROSTER.length}`;
    medalsEl.innerHTML = "";
    MEDAL_ROSTER.forEach((m, idx) => {
      const div = document.createElement("div");
      div.className = "medal " + (unlocked.has(m.id) ? "unlocked" : "locked");
      div.dataset.medalId = m.id;
      const img = document.createElement("img");
      img.src = m.img;
      img.onerror = () => { img.src = 'assets/medals/frigo_camelo.png'; };
      img.alt = m.name;
      div.appendChild(img);
      medalsEl.appendChild(div);
    });
  }

  function openUnlockModal(medal){
    // Defensive: medal or image missing
    if (!medal) return;

    // Always set alt to avoid showing "medal"
    modalImg.alt = medal.name || "character";

    // Primary: embedded data URI
    modalImg.src = "";
    requestAnimationFrame(() => { modalImg.src = medal.img || ''; });

    // Fallback: copy from rendered medal grid
    modalImg.onerror = () => {
      const card = document.querySelector(`[data-medal-id="${medal.id}"]`);
      const img = card ? card.querySelector("img") : null;
      if (img && img.src) modalImg.src = img.src;
      modalImg.onerror = null;
    };

    modalText.textContent = `Awesome! You rescued: ${medal.name}. Keep going!`;
    modal.hidden = false;
    speak(`You are doing great. You won ${medal.name}.`);
  }

  function closeModal(){
    modal.hidden = true;
  }

  function tryUnlockAtUnitEnd(){
    // Only unlock when unit truly finished (level 100)
    if (!unitCompleted || level !== MAX_LEVEL) return;
    if (unlocked.size >= MEDAL_ROSTER.length) return;

    const medal = MEDAL_ROSTER[unlocked.size];
    unlocked.add(medal.id);
    localStorage.setItem(LS_UNLOCK, JSON.stringify([...unlocked]));
    renderMedals();
    openUnlockModal(medal);
  }

  // =========================
  // Speech: TTS
  // =========================
  function loadVoices(){
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    selVoice.innerHTML = "";
    voices
      .filter(v => /en/i.test(v.lang))
      .forEach((v, i) => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = `${v.name} — ${v.lang}`;
        selVoice.appendChild(opt);
      });

    // pick a default en voice
    const first = selVoice.options[0];
    if (first) selVoice.value = first.value;
    selectVoice();
  }

  function selectVoice(){
    const voices = speechSynthesis.getVoices();
    const name = selVoice.value;
    ttsVoice = voices.find(v => v.name === name) || null;
  }

  function speak(text){
    if (!window.speechSynthesis) return;
    if (!text) return;

    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = selRecLang.value || "en-US";
      if (ttsVoice) u.voice = ttsVoice;
      ttsSpeaking = true;
      u.onend = () => { ttsSpeaking=false; if (chkAntiEcho.checked) {/* no-op */} };
      u.onerror = () => { ttsSpeaking=false; };
      speechSynthesis.speak(u);
    }catch(e){}
  }

  // =========================
  // Speech: Recognition (no getUserMedia)
  // =========================
  function ensureRecognizer(){
    if (!SR){
      setStatus("Speech recognition is not supported in this browser.", "warn");
      return false;
    }
    if (recognizer) return true;

    recognizer = new SR();
    recognizer.lang = selRecLang.value || "en-US";
    recognizer.interimResults = false;
    recognizer.continuous = false;

    recognizer.onresult = (e) => {
      const t = (e.results && e.results[0] && e.results[0][0]) ? e.results[0][0].transcript : "";
      heardText.value = t;
      setStatus("Heard. Press Check.", "ok");
    };

    recognizer.onerror = (e) => {
      sessionActive = false;
      btnMic.textContent = "🎙️ Start mic";
      const err = (e && e.error) ? String(e.error) : "unknown";
      if (err === "not-allowed" || err === "service-not-allowed" || err === "permission-denied") {
        setStatus("Mic blocked. Allow microphone permission in the browser.", "warn");
        return;
      }
      setStatus(`Mic error: ${err}`, "warn");
    };

    recognizer.onend = () => {
      // When it ends, we stop. User can press Start again.
      if (sessionActive){
        sessionActive = false;
        btnMic.textContent = "🎙️ Start mic";
      }
    };

    return true;
  }

  function startMic(){
    if (!ensureRecognizer()) return;
    recognizer.lang = selRecLang.value || "en-US";

    if (chkAntiEcho.checked && ttsSpeaking){
      setStatus("Wait—voice is speaking.", "warn");
      return;
    }

    sessionActive = true;
    btnMic.textContent = "🛑 Stop mic";
    setStatus("Listening… speak now.", "muted");

    try{
      recognizer.start();
    }catch(err){
      sessionActive = false;
      btnMic.textContent = "🎙️ Start mic";
      setStatus("Mic start failed. Try again.", "warn");
    }
  }

  function stopMic(){
    sessionActive = false;
    btnMic.textContent = "🎙️ Start mic";
    try{ recognizer && recognizer.stop(); }catch(e){}
    setStatus("Stopped.", "muted");
  }

  // =========================
  // Translate (glossary)
  // =========================
  function showGlossary(){
    const words = tokenize(currentTarget);
    const uniq = [...new Set(words)].slice(0, 20);
    const lines = uniq.map(w => `${w} = ${ES[w] || "—"}`);
    glossary.innerHTML = `<b>ES glossary:</b><br>` + lines.join("<br>");
    glossary.hidden = false;
  }

  // =========================
  // Check & feedback
  // =========================
  function diffWords(expected, got){
    const e = tokenize(expected);
    const g = tokenize(got);
    const bad = new Set();

    // simple alignment by position
    const n = Math.max(e.length, g.length);
    for (let i=0;i<n;i++){
      if ((e[i]||"") !== (g[i]||"")){
        if (e[i]) bad.add(e[i]);
      }
    }
    return { e, g, bad:[...bad] };
  }

  function renderFeedback(expected, heard){
    const { bad } = diffWords(expected, heard);
    if (!heard.trim()){
      feedback.innerHTML = "—";
      return;
    }
    if (bad.length === 0){
      feedback.innerHTML = `<span style="color:var(--ok); font-weight:900;">Perfect!</span> ✅`;
      return;
    }
    const html = bad.map(w => `<span style="color:var(--warn); font-weight:900;">${w}</span>`).join(", ");
    feedback.innerHTML = `Practice these words: ${html}`;
  }

  function nextLevel(){
    level++;
    if (level > MAX_LEVEL){
      level = MAX_LEVEL;
      // unlock only when unit score reached 100 and not already completed
      if (!unitCompleted && Number.isFinite(score) && score >= MAX_LEVEL){
        unitCompleted = true;
        tryUnlockAtUnitEnd();
      }
    } else {
      currentTarget = levels[level-1];
      currentTokens = tokenize(currentTarget);
    }
    renderTarget();
    renderHud();
  }

  // =========================
  // Unit generation
  // =========================
  let levels = [];

  function newUnit(){
    // hard reset
    unitCompleted = false;
    modal.hidden = true;
    level = 1;
    score = 0;
    streak = 0;
    heardText.value = "";
    feedback.innerHTML = "—";
    glossary.hidden = true;

    const mode = selMode.value;
    const qType = selQType.value;
    const tense = selTense.value;

    const base = buildBase(mode, qType, tense);
    levels = buildLevels(base, mode);

    currentTarget = levels[0];
    currentTokens = tokenize(currentTarget);
    targetText.textContent = currentTarget;

    setStatus("New unit ready.", "ok");
    renderStats();
  }

  // =========================
  // Events
  // =========================
  btnNew.addEventListener("click", newUnit);

  btnSpeak.addEventListener("click", () => speak(currentTarget));

  btnMic.addEventListener("click", () => {
    if (sessionActive) stopMic();
    else startMic();
  });

  btnTranslate.addEventListener("click", () => {
    // glossary instead of unreliable full translation
    showGlossary();
  });

  btnShow.addEventListener("click", () => {
    heardText.value = currentTarget;
    setStatus("Answer shown.", "muted");
  });

  btnCheck.addEventListener("click", () => {
    const heard = heardText.value || "";
    renderFeedback(currentTarget, heard);

    const { bad } = diffWords(currentTarget, heard);
    if (heard.trim() && bad.length === 0){
      streak++;
      score += 10 + Math.min(streak*2, 10);
      setStatus("Nice! +score. Next level.", "ok");
      nextLevel();
    } else {
      streak = 0;
      setStatus("Not yet—fix the red words and try again.", "warn");
    }
    renderStats();
  });

  btnSkip.addEventListener("click", () => {
    streak = 0;
    setStatus("Skipped.", "muted");
    nextLevel();
  });

  selVoice.addEventListener("change", selectVoice);
  selRecLang.addEventListener("change", () => { if (recognizer) recognizer.lang = selRecLang.value; });

  btnModalOk.addEventListener("click", () => {
    closeModal();
    // after unlock, start a new unit
    if (unitCompleted){
      // Start next unit manually (keeps state stable)
      setStatus("Unit complete! Press New unit to continue.", "ok");
    }
  });

  // Voices load
  if (window.speechSynthesis){
    speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }

  // Init
  renderMedals();
  medalCount.textContent = `${unlocked.size}/${MEDAL_ROSTER.length}`;
  newUnit();
})();