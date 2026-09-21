(function(){
  "use strict";

  /* ---------------- helpers ---------------- */
  function esc(s){
    if(s===null||s===undefined) return "";
    return String(s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function fmtNum(n){ return (n||0).toLocaleString("en-IN"); }

  /* ---------------- theme buckets ---------------- */
  var STATUS_COLOR = {
    "Hot":        {fg:"#BE4620", bg:"var(--hot-soft)", key:"hot"},
    "Neutral":    {fg:"#6B7280", bg:"var(--neutral-soft)", key:"neutral"},
    "Cold":       {fg:"#33688A", bg:"var(--cold-soft)", key:"cold"},
    "Will take time": {fg:"#B9800B", bg:"var(--wait-soft)", key:"wait"}
  };
  function statusColor(s){
    return STATUS_COLOR[s] || {fg:"#8D8A80", bg:"var(--line-2)", key:"unk"};
  }

  var TYPE_COLOR = {
    "New": {fg:"#4C5FD5"},
    "Existing": {fg:"#0E7C6B"},
    "Top 51 Aspirational": {fg:"#AD802A"},
    "Top 50 Existing": {fg:"#0E7C6B"}
  };
  function typeColor(t){ return TYPE_COLOR[t] || {fg:"#8D8A80"}; }

  var ACTIVITY_COLORS = ["#4C5FD5","#0E7C6B","#B85C1F","#7A4FB0","#33688A","#B23A5C"];
  var activityColorCache = {};
  function activityColor(a){
    if(!a) return "#8D8A80";
    if(!activityColorCache[a]){
      var idx = Object.keys(activityColorCache).length % ACTIVITY_COLORS.length;
      activityColorCache[a] = ACTIVITY_COLORS[idx];
    }
    return activityColorCache[a];
  }
  function responseColor(r){
    if(/positive|interest/i.test(r)) return "var(--good)";
    if(/negative/i.test(r)) return "var(--hot)";
    if(/no response/i.test(r)) return "var(--ink-3)";
    if(/neutral/i.test(r)) return "var(--wait)";
    return "var(--ink-3)";
  }
  var PROGRAM_COLORS = {"PGDM":"#4C5FD5","PGDM (FS)":"#0E7C6B","PGDM (RM)":"#AD802A"};
  function programColor(p){ return PROGRAM_COLORS[p] || "#8D8A80"; }

  var SECTOR_RULES = [
    ["Technology / IT", "#4C5FD5", /it\b|itench|tech|software|digital|data|cyber|cloud|\bai\b|artificial intelligence/i],
    ["BFSI / Financial", "#0E7C6B", /bank|financ|nbfc|insur|invest|wealth|fintech|asset management/i],
    ["Manufacturing / Auto", "#B85C1F", /manufactur|automotive|steel|engineering|plastics|tyres|construction equipment|building material|packaging/i],
    ["Healthcare / Pharma", "#B23A5C", /health|pharma|medical|life science|diagnostic|biotech/i],
    ["Logistics / Supply Chain", "#33688A", /logistic|supply chain/i],
    ["Real Estate / Construction", "#8A6A4E", /real estate|construction|architecture|interior/i],
    ["Energy / Renewable", "#4C8C3A", /energy|renewable|solar|wind|electric/i],
    ["Consumer / Retail / FMCG", "#AD802A", /fmcg|retail|food|beverage|dairy|e-commerce|ecommerce/i],
    ["Telecom / Media", "#7A4FB0", /telecom|media|publishing/i],
    ["Defence / Aerospace", "#22314F", /defence|aerospace/i],
    ["Professional Services", "#5B7B7A", /consulting|staffing|recruitment|legal|\bhr\b/i]
  ];
  function sectorBucket(industry){
    if(!industry) return ["Other / Unspecified", "#8D8A80"];
    for(var i=0;i<SECTOR_RULES.length;i++){
      if(SECTOR_RULES[i][2].test(industry)) return [SECTOR_RULES[i][0], SECTOR_RULES[i][1]];
    }
    return ["Other / Unspecified", "#8D8A80"];
  }

  /* ---------------- date parsing ---------------- */
  var MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  function parseDMY(s){
    if(!s) return null;
    s = String(s).trim();
    // "1 Sep 2026" / "01 September 2026"
    var m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
    if(m){
      var mon = MONTHS[m[2].slice(0,3).toLowerCase()];
      if(mon!==undefined) return new Date(parseInt(m[3],10), mon, parseInt(m[1],10));
    }
    // "2026-09-01" (ISO, year first)
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(m){
      return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
    }
    // "01-09-2026" (day-month-year, dashes)
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if(m){
      return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));
    }
    // "01/09/2026" (day-month-year, slashes)
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m){
      return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));
    }
    return null;
  }
  function fmtDMY(d){
    var MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var day = ("0"+d.getDate()).slice(-2);
    return day+" "+MN[d.getMonth()]+" "+d.getFullYear();
  }
  var MN_FULL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function monthKey(dateStr){
    var d = parseDMY(dateStr);
    if(!d) return null;
    return MN_FULL[d.getMonth()]+" "+d.getFullYear();
  }
  function monthSortVal(key){
    var parts = key.split(" ");
    var idx = MN_FULL.indexOf(parts[0]);
    return parseInt(parts[1],10)*100 + idx;
  }

  /* ---------------- contact recency ---------------- */
  function daysBetween(d, now){
    return Math.floor((now.getTime() - d.getTime()) / (1000*60*60*24));
  }
  function getLastContact(record){
    var d1 = parseDMY(record["Last Conversation Date"]);
    var d2 = parseDMY(record["Last Outreach Log Date (auto)"]);
    var best = null;
    if(d1 && (!best || d1>best)) best = d1;
    if(d2 && (!best || d2>best)) best = d2;
    return best;
  }
  function recencyInfo(record, now){
    now = now || new Date();
    var d = getLastContact(record);
    if(!d) return {days:null, label:"Never contacted", tone:"hot"};
    var days = daysBetween(d, now);
    if(days > 30) return {days:days, label: fmtDMY(d) + " · " + days + " days ago", tone:"hot"};
    if(days >= 20) return {days:days, label: fmtDMY(d) + " · " + days + " days ago", tone:"wait"};
    return {days:days, label: fmtDMY(d) + " · " + days + " days ago", tone:"ok"};
  }
  function populateMonthFilter(selectId, records, dateField){
    var keys = {};
    records.forEach(function(r){
      var k = monthKey(r[dateField]);
      if(k) keys[k]=true;
    });
    var arr = Object.keys(keys).sort(function(a,b){ return monthSortVal(b)-monthSortVal(a); });
    var sel = document.getElementById(selectId);
    var current = sel.value;
    sel.innerHTML = '<option value="">All months</option>' + arr.map(function(k){
      return '<option value="'+esc(k)+'">'+esc(k)+'</option>';
    }).join("");
    if(arr.indexOf(current)!==-1) sel.value = current;
  }

  /* ---------------- state ---------------- */

  /* ---------------- state ---------------- */
  var LS_KEY = "madhvi_outreach_dashboard_cache_v1";
  var state = { data: null, source: "Live from Google Sheets", lastFetched: null };

  function loadCachedData(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(parsed && parsed.data) return parsed;
      }
    }catch(e){ /* storage unavailable */ }
    return null;
  }
  function saveCachedData(){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify({data: state.data, fetchedAt: state.lastFetched}));
    }catch(e){ /* ignore quota / privacy errors */ }
  }
  function computeSnapshotDate(){
    var best = null;
    function consider(v){
      var d = parseDMY(v);
      if(d && (!best || d>best)) best = d;
    }
    (state.data.companies.records||[]).forEach(function(r){ consider(r["Last Outreach Log Date (auto)"]); consider(r["Last Conversation Date"]); });
    (state.data.outreach.records||[]).forEach(function(r){ consider(r["Date"]); });
    (state.data.meetings.records||[]).forEach(function(r){ consider(r["Appointment Date"]); });
    return best ? fmtDMY(best) : "—";
  }

  /* ---------------- toast ---------------- */
  var toastTimer=null;
  function toast(msg){
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 3200);
  }

  /* ---------------- tabs ---------------- */
  function initTabs(){
    var btns = document.querySelectorAll(".tab-btn");
    btns.forEach(function(b){
      b.addEventListener("click", function(){
        btns.forEach(function(x){ x.classList.remove("active"); });
        b.classList.add("active");
        document.querySelectorAll(".panel").forEach(function(p){ p.classList.remove("active"); });
        document.getElementById("panel-"+b.dataset.tab).classList.add("active");
      });
    });
  }

  /* ---------------- overview render ---------------- */
  function renderOverview(){
    var companies = state.data.companies.records;
    var total = companies.length;
    var counts = {};
    companies.forEach(function(r){
      var s = (r["Status of Company"]||"").trim() || "Unspecified";
      counts[s] = (counts[s]||0)+1;
    });
    var hot = counts["Hot"]||0, wait = counts["Will take time"]||0;
    var meetingsHeld = state.data.meetings.records.filter(function(r){ return /conduct/i.test(r["Appointment Status"]||""); }).length;
    var now = new Date();
    var needsFollowup = companies.filter(function(r){ var ri = recencyInfo(r, now); return ri.tone==="hot"; }).length;

    var strip = document.getElementById("statStrip");
    strip.innerHTML = [
      stat(total, "Companies in book"),
      stat(hot, "Hot leads", "hot"),
      stat(needsFollowup, "Need follow-up (30+ days)", "hot"),
      stat(wait, "Will take time", "wait"),
      stat(meetingsHeld, "Meetings held", "good"),
      stat(state.data.outreach.records.length, "Outreach touchpoints logged")
    ].join("");

    function stat(n,l,cls){
      return '<div class="stat"><div class="num'+(cls?(' '+cls):'')+'">'+fmtNum(n)+'</div><div class="lbl">'+esc(l)+'</div></div>';
    }

    /* monthly chart */
    var months = (state.data.monthly.records||[]).filter(function(r){
      return (r["Outreach Touchpoints (auto)"]||0) > 0 || (r["Meetings Held (auto)"]||0) > 0 || (r["Offers Received (auto)"]||0) > 0;
    });
    if(months.length===0) months = (state.data.monthly.records||[]).slice(0,4);
    var maxVal = 1;
    months.forEach(function(m){
      maxVal = Math.max(maxVal, m["Outreach Touchpoints (auto)"]||0, m["Meetings Held (auto)"]||0);
    });
    var mc = document.getElementById("monthlyChart");
    mc.innerHTML = months.map(function(m){
      var t = m["Outreach Touchpoints (auto)"]||0, mt = m["Meetings Held (auto)"]||0;
      return '<div class="bar-row"><div class="m-label">'+esc(m["Month"])+'</div>'+
        '<div class="bar-track"><div class="bar-fill" style="width:'+(t/maxVal*100)+'%"></div></div>'+
        '<div class="bar-val">'+t+'</div></div>'+
        '<div class="bar-row"><div class="m-label"></div>'+
        '<div class="bar-track"><div class="bar-fill meet" style="width:'+(mt/maxVal*100)+'%"></div></div>'+
        '<div class="bar-val">'+mt+'</div></div>';
    }).join("") || '<div class="empty-state">No monthly activity yet</div>';

    /* status stack + list */
    var order = ["Hot","Will take time","Neutral","Cold","Unspecified"];
    order.forEach(function(k){ if(!(k in counts)) counts[k]=0; });
    var stack = document.getElementById("statusStack");
    stack.innerHTML = order.filter(function(k){return counts[k]>0;}).map(function(k){
      var c = statusColor(k==="Unspecified"?"":k);
      return '<div class="stack-seg" style="width:'+(counts[k]/total*100)+'%;background:'+c.fg+'"></div>';
    }).join("");
    document.getElementById("statusList").innerHTML = order.filter(function(k){return counts[k]>0;}).map(function(k){
      var c = statusColor(k==="Unspecified"?"":k);
      return '<li><span class="k"><i class="dot" style="background:'+c.fg+'"></i>'+esc(k)+'</span><span class="v">'+counts[k]+'</span></li>';
    }).join("");

    /* sector list */
    var sectorCounts = {};
    companies.forEach(function(r){
      var b = sectorBucket(r["Industry"]);
      sectorCounts[b[0]] = sectorCounts[b[0]] || {n:0,color:b[1]};
      sectorCounts[b[0]].n++;
    });
    var sectorArr = Object.keys(sectorCounts).map(function(k){ return {name:k, n:sectorCounts[k].n, color:sectorCounts[k].color}; });
    sectorArr.sort(function(a,b){ return b.n-a.n; });
    document.getElementById("sectorList").innerHTML = sectorArr.map(function(s){
      return '<li><span class="k"><i class="dot" style="background:'+s.color+'"></i>'+esc(s.name)+'</span><span class="v">'+s.n+'</span></li>';
    }).join("");

    /* type stack */
    var typeCounts = {};
    companies.forEach(function(r){
      var t = (r["New/Existing/Assigned/Top 51 Aspirational/Top 50 Existing"]||"Unspecified").trim() || "Unspecified";
      typeCounts[t] = (typeCounts[t]||0)+1;
    });
    var typeKeys = Object.keys(typeCounts).sort(function(a,b){return typeCounts[b]-typeCounts[a];});
    document.getElementById("typeStack").innerHTML = typeKeys.map(function(k){
      var c = typeColor(k);
      return '<div class="stack-seg" style="width:'+(typeCounts[k]/total*100)+'%;background:'+c.fg+'"></div>';
    }).join("");
    document.getElementById("typeList").innerHTML = typeKeys.map(function(k){
      var c = typeColor(k);
      return '<li><span class="k"><i class="dot" style="background:'+c.fg+'"></i>'+esc(k)+'</span><span class="v">'+typeCounts[k]+'</span></li>';
    }).join("");
  }

  function populateSelectFilter(selectId, records, field, allLabel){
    var vals = Array.from(new Set(records.map(function(r){ return (r[field]||"").toString().trim(); }).filter(Boolean)));
    vals.sort();
    var sel = document.getElementById(selectId);
    var current = sel.value;
    sel.innerHTML = '<option value="">'+esc(allLabel)+'</option>' + vals.map(function(v){
      return '<option value="'+esc(v)+'">'+esc(v)+'</option>';
    }).join("");
    if(vals.indexOf(current)!==-1) sel.value = current;
  }

  /* ---------------- companies render ---------------- */
  var coExpanded = {};
  function populateCoFilters(){
    var companies = state.data.companies.records;
    populateSelectFilter("coStatusFilter", companies, "Status of Company", "All statuses");
    populateSelectFilter("coTypeFilter", companies, "New/Existing/Assigned/Top 51 Aspirational/Top 50 Existing", "All types");
    populateSelectFilter("coLocationFilter", companies, "Location of the Company", "All locations");
    var sectors = Array.from(new Set(companies.map(function(r){return sectorBucket(r["Industry"])[0];}))).sort();
    var secSel = document.getElementById("coSectorFilter");
    var current = secSel.value;
    secSel.innerHTML = '<option value="">All sectors</option>' + sectors.map(function(s){return '<option value="'+esc(s)+'">'+esc(s)+'</option>';}).join("");
    if(sectors.indexOf(current)!==-1) secSel.value = current;
  }

  function renderCompanies(){
    var companies = state.data.companies.records;
    var q = (document.getElementById("coSearch").value||"").toLowerCase();
    var fStatus = document.getElementById("coStatusFilter").value;
    var fType = document.getElementById("coTypeFilter").value;
    var fSector = document.getElementById("coSectorFilter").value;
    var fLocation = document.getElementById("coLocationFilter").value;
    var fRecency = document.getElementById("coRecencyFilter").value;
    var now = new Date();

    var filtered = companies.filter(function(r){
      if(fStatus && (r["Status of Company"]||"").trim() !== fStatus) return false;
      if(fType && (r["New/Existing/Assigned/Top 51 Aspirational/Top 50 Existing"]||"").trim() !== fType) return false;
      if(fSector && sectorBucket(r["Industry"])[0] !== fSector) return false;
      if(fLocation && (r["Location of the Company"]||"").trim() !== fLocation) return false;
      if(fRecency){
        var ri = recencyInfo(r, now);
        if(fRecency==="never" && ri.days!==null) return false;
        if(fRecency==="overdue" && !(ri.days!==null && ri.days>30)) return false;
        if(fRecency==="soon" && !(ri.days!==null && ri.days>=20 && ri.days<=30)) return false;
        if(fRecency==="week" && !(ri.days!==null && ri.days<=7)) return false;
        if(fRecency==="month" && !(ri.days!==null && ri.days<=30)) return false;
      }
      if(q){
        var hay = [r["Company Name"], r["Industry"], r["Location of the Company"], r["Company Contact Person Name"], r["Company Contact Person Designation"], r["Company Contact Person (Email ID)"]].join(" ").toLowerCase();
        if(hay.indexOf(q)===-1) return false;
      }
      return true;
    });

    document.getElementById("coResultsCount").textContent = "Showing " + filtered.length + " of " + companies.length + " companies";
    document.getElementById("countCompanies").textContent = "("+companies.length+")";

    var list = document.getElementById("coList");
    if(filtered.length===0){
      list.innerHTML = '<div class="empty-state">No companies match these filters.</div>';
      return;
    }
    list.innerHTML = filtered.map(function(r, idx){
      var sc = statusColor(r["Status of Company"]);
      var tc = typeColor(r["New/Existing/Assigned/Top 51 Aspirational/Top 50 Existing"]);
      var sector = sectorBucket(r["Industry"]);
      var id = "co-"+idx+"-"+encodeURIComponent(r["Company Name"]||"").slice(0,24);
      var open = coExpanded[r["Company Name"]] ? " open" : "";
      var ri = recencyInfo(r, now);
      var warnColor = ri.tone==="hot" ? "var(--hot)" : (ri.tone==="wait" ? "var(--wait)" : "var(--ink-3)");
      var warnBg = ri.tone==="hot" ? "var(--hot-soft)" : (ri.tone==="wait" ? "var(--wait-soft)" : "var(--line-2)");
      return (
      '<div class="co-row" data-id="'+id+'">'+
        '<div class="co-bar" style="background:'+sc.fg+'"></div>'+
        '<div class="co-main">'+
          '<div class="co-top">'+
            '<div class="co-name">'+esc(r["Company Name"])+'</div>'+
            '<div class="badges">'+
              '<span class="pill" style="color:'+sc.fg+';background:'+sc.bg+'">'+esc(r["Status of Company"]||"Unspecified")+'</span>'+
              (r["New/Existing/Assigned/Top 51 Aspirational/Top 50 Existing"] ? '<span class="pill" style="color:'+tc.fg+';background:var(--line-2)">'+esc(r["New/Existing/Assigned/Top 51 Aspirational/Top 50 Existing"])+'</span>' : '')+
              '<span class="pill" style="color:'+sector[1]+';background:var(--line-2)">'+esc(sector[0])+'</span>'+
              (ri.tone!=="ok" ? '<span class="pill" style="color:'+warnColor+';background:'+warnBg+'">⚠ '+(ri.days===null?"Never contacted":ri.days+" days — action needed")+'</span>' : '')+
            '</div>'+
          '</div>'+
          '<div class="co-meta">'+esc(r["Industry"]||"Industry unspecified")+' · '+esc(r["Location of the Company"]||"Location unspecified")+(r["Expected Salary"]?(' · '+esc(r["Expected Salary"])):'')+'</div>'+
          (r["Company Contact Person Name"] ? '<div class="co-contact"><b>'+esc(r["Company Contact Person Name"])+'</b>'+(r["Company Contact Person Designation"]?(' — '+esc(r["Company Contact Person Designation"])):'')+'</div>' : '')+
          '<div class="co-contact" style="color:'+warnColor+';margin-top:4px;">Last contact: '+esc(ri.label)+'</div>'+
          (r["Next Planned Action"] ? '<div class="co-contact" style="color:var(--gold);margin-top:2px;">Next: '+esc(r["Next Planned Action"])+'</div>' : '')+
          '<div class="co-detail'+open+'">'+
            (r["Company Contact Person (Contact Number)"] || r["Company Contact Person (Email ID)"] ? '<div class="d-row"><b>Primary contact</b>'+esc(r["Company Contact Person (Contact Number)"]||"")+(r["Company Contact Person (Contact Number)"]&&r["Company Contact Person (Email ID)"]?' · ':'')+esc(r["Company Contact Person (Email ID)"]||"")+'</div>' : '')+
            (r["Secondary Contact Name"] ? '<div class="d-row"><b>Secondary contact</b>'+esc(r["Secondary Contact Name"])+(r["Secondary Contact Designation"]?(' — '+esc(r["Secondary Contact Designation"])):'')+' · '+esc(r["Secondary Contact Number"]||"")+' '+esc(r["Secondary Contact Email"]||"")+'</div>' : '')+
            (r["Complete Interaction History"] ? '<div class="d-row"><b>Interaction history</b>'+esc(r["Complete Interaction History"])+'</div>' : '')+
            '<div class="d-row"><b>Last conversation'+(r["Last Conversation Date"]?(' — '+esc(r["Last Conversation Date"])):'')+'</b>'+esc(r["Last Conversation Details"]||"No details logged yet")+'</div>'+
            '<div class="d-row"><b>Next planned action</b>'+esc(r["Next Planned Action"]||"No next action logged yet")+'</div>'+
          '</div>'+
          '<div class="expand-hint">'+(open?"Click to collapse":"Click to expand details")+'</div>'+
        '</div>'+
      '</div>');
    }).join("");

    list.querySelectorAll(".co-row").forEach(function(row, idx){
      row.addEventListener("click", function(){
        var name = filtered[idx]["Company Name"];
        coExpanded[name] = !coExpanded[name];
        renderCompanies();
      });
    });
  }

  /* ---------------- outreach render ---------------- */
  function renderOutreach(){
    var q = (document.getElementById("outSearch").value||"").toLowerCase();
    var fMonth = document.getElementById("outMonthFilter").value;
    var fActivity = document.getElementById("outActivityFilter").value;
    var fResponse = document.getElementById("outResponseFilter").value;
    var fStage = document.getElementById("outStageFilter").value;
    var rows = state.data.outreach.records.slice();
    rows.sort(function(a,b){
      var da = parseDMY(a["Date"]), db = parseDMY(b["Date"]);
      return (db?db.getTime():0) - (da?da.getTime():0);
    });
    rows = rows.filter(function(r){
      if(fMonth && monthKey(r["Date"]) !== fMonth) return false;
      if(fActivity && (r["Activity Type"]||"").trim() !== fActivity) return false;
      if(fResponse && (r["Response"]||"").trim() !== fResponse) return false;
      if(fStage && (r["Pipeline Stage"]||"").trim() !== fStage) return false;
      if(!q) return true;
      var hay = [r["Company Name"], r["SPOC"], r["Activity Type"], r["Purpose"], r["Discussion Summary"]].join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    document.getElementById("countOutreach").textContent = "("+state.data.outreach.records.length+")";
    document.getElementById("outResultsCount").textContent = "Showing " + rows.length + " of " + state.data.outreach.records.length + " entries" + (fMonth ? (" · " + fMonth) : "");
    var list = document.getElementById("outList");
    if(rows.length===0){ list.innerHTML = '<div class="empty-state">No outreach entries match.</div>'; return; }
    list.innerHTML = rows.map(function(r){
      return '<div class="entry">'+
        '<div class="date-col">'+esc(r["Date"]||"")+'</div>'+
        '<div class="body-col">'+
          '<div class="entry-top"><span class="entry-co">'+esc(r["Company Name"])+'</span>'+
            '<div class="badges">'+
              (r["Activity Type"] ? '<span class="pill" style="background:var(--line-2);color:'+activityColor(r["Activity Type"])+'">'+esc(r["Activity Type"])+'</span>' : '')+
              (r["Response"] ? '<span class="pill" style="background:var(--line-2);color:'+responseColor(r["Response"])+'">'+esc(r["Response"])+'</span>' : '')+
            '</div></div>'+
          '<div class="entry-spoc">'+esc(r["SPOC"]||"")+(r["Designation"]?(' — '+esc(r["Designation"])):'')+(r["Pipeline Stage"]?(' · '+esc(r["Pipeline Stage"])):'')+'</div>'+
          (r["Discussion Summary"] ? '<div class="entry-summary">'+esc(r["Discussion Summary"])+'</div>' : '')+
          (r["Next Action"] ? '<div class="entry-next">Next: '+esc(r["Next Action"])+(r["Next Action Date"]?(' · '+esc(r["Next Action Date"])):'')+'</div>' : '')+
        '</div>'+
      '</div>';
    }).join("");
  }

  /* ---------------- meetings render ---------------- */
  function renderMeetings(){
    var q = (document.getElementById("meetSearch").value||"").toLowerCase();
    var fMonth = document.getElementById("meetMonthFilter").value;
    var fStatus = document.getElementById("meetStatusFilter").value;
    var rows = state.data.meetings.records.slice();
    rows.sort(function(a,b){
      var da = parseDMY(a["Appointment Date"]), db = parseDMY(b["Appointment Date"]);
      return (db?db.getTime():0) - (da?da.getTime():0);
    });
    rows = rows.filter(function(r){
      if(fMonth && monthKey(r["Appointment Date"]) !== fMonth) return false;
      if(fStatus && (r["Appointment Status"]||"").trim() !== fStatus) return false;
      if(!q) return true;
      var hay = [r["Company Name"], r["SPOC Name and Designation"], r["Venue"], r["Meeting Summary"]].join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    document.getElementById("countMeetings").textContent = "("+state.data.meetings.records.length+")";
    document.getElementById("meetResultsCount").textContent = "Showing " + rows.length + " of " + state.data.meetings.records.length + " meetings" + (fMonth ? (" · " + fMonth) : "");
    var statColor = function(s){
      if(/conduct/i.test(s)) return "var(--good)";
      if(/schedul|planned|pending/i.test(s)) return "var(--wait)";
      if(/cancel/i.test(s)) return "var(--hot)";
      return "var(--ink-3)";
    };
    var list = document.getElementById("meetList");
    if(rows.length===0){ list.innerHTML = '<div class="empty-state">No meetings match.</div>'; return; }
    list.innerHTML = rows.map(function(r){
      return '<div class="entry">'+
        '<div class="date-col">'+esc(r["Appointment Date"]||"")+(r["Appointment time"]?('<br>'+esc(r["Appointment time"])):'')+'</div>'+
        '<div class="body-col">'+
          '<div class="entry-top"><span class="entry-co">'+esc(r["Company Name"])+'</span>'+
            '<span class="pill" style="background:var(--line-2);color:'+statColor(r["Appointment Status"]||"")+'">'+esc((r["Appointment Status"]||"").trim())+'</span></div>'+
          '<div class="entry-spoc">'+esc(r["SPOC Name and Designation"]||"")+(r["Venue"]?(' · '+esc(r["Venue"])):'')+'</div>'+
          (r["Meeting Summary"] ? '<div class="entry-summary">'+esc(r["Meeting Summary"])+'</div>' : '')+
        '</div>'+
      '</div>';
    }).join("");
  }

  /* ---------------- mentees render ---------------- */
  var menteeExpanded = {};
  function renderMentees(){
    var q = (document.getElementById("menteeSearch").value||"").toLowerCase();
    var fProgram = document.getElementById("menteeProgramFilter").value;
    var fOffer = document.getElementById("menteeOfferFilter").value;
    var rows = state.data.mentees.records.filter(function(r){
      if(fProgram && (r["Program"]||"").trim() !== fProgram) return false;
      if(fOffer && (r["Offer Received"]||"").trim() !== fOffer) return false;
      if(!q) return true;
      var hay = [r["Name"], r["Roll Number"], r["Program"]].join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    document.getElementById("countMentees").textContent = "("+state.data.mentees.records.length+")";
    document.getElementById("menteeResultsCount").textContent = "Showing " + rows.length + " of " + state.data.mentees.records.length + " mentees";
    var list = document.getElementById("menteeList");
    if(rows.length===0){ list.innerHTML = '<div class="empty-state">No mentees match.</div>'; return; }
    list.innerHTML = rows.map(function(r, idx){
      var offer = (r["Offer Received"]||"").trim();
      var offerColor = /yes/i.test(offer) ? "var(--good)" : "var(--ink-3)";
      var open = menteeExpanded[r["Name"]] ? " open" : "";
      var progressBits = [];
      if(r["Companies applied"]) progressBits.push(r["Companies applied"]+" applied");
      if(r["Shortlisted in"]) progressBits.push(r["Shortlisted in"]+" shortlisted");
      if(r["CTC"]) progressBits.push(r["CTC"]);
      return (
      '<div class="co-row" data-idx="'+idx+'">'+
        '<div class="co-bar" style="background:'+programColor(r["Program"])+'"></div>'+
        '<div class="co-main">'+
          '<div class="co-top">'+
            '<div class="co-name">'+esc(r["Name"])+'</div>'+
            '<div class="badges">'+
              '<span class="pill" style="background:var(--line-2);color:'+programColor(r["Program"])+'">'+esc(r["Program"]||"—")+'</span>'+
              (offer ? '<span class="pill" style="background:var(--line-2);color:'+offerColor+'">'+esc(offer)+'</span>' : '')+
              (r["Specialistaion"] ? '<span class="pill" style="background:var(--line-2);color:var(--ink-3)">'+esc(r["Specialistaion"])+'</span>' : '')+
            '</div>'+
          '</div>'+
          '<div class="co-meta">Roll no. '+esc(r["Roll Number"]||"—")+(progressBits.length?(' · '+progressBits.map(esc).join(' · ')):'')+'</div>'+
          '<div class="co-detail'+open+'">'+
            (r["Last meeting Date"] ? '<div class="d-row"><b>Last meeting date</b>'+esc(r["Last meeting Date"])+'</div>' : '')+
            (r["Last conversation Details"] ? '<div class="d-row"><b>Last conversation</b>'+esc(r["Last conversation Details"])+'</div>' : '')+
            (r["Strengths"] ? '<div class="d-row"><b>Strengths</b>'+esc(r["Strengths"])+'</div>' : '')+
            (r["Weeknesses"] ? '<div class="d-row"><b>Areas to work on</b>'+esc(r["Weeknesses"])+'</div>' : '')+
            (!r["Last conversation Details"] && !r["Strengths"] && !r["Weeknesses"] && !r["Last meeting Date"] ? '<div class="d-row" style="color:var(--ink-3);">No notes logged yet for this mentee.</div>' : '')+
          '</div>'+
          '<div class="expand-hint">'+(open?"Click to collapse":"Click to expand details")+'</div>'+
        '</div>'+
      '</div>');
    }).join("");
    list.querySelectorAll(".co-row").forEach(function(row, idx){
      row.addEventListener("click", function(){
        var name = rows[idx]["Name"];
        menteeExpanded[name] = !menteeExpanded[name];
        renderMentees();
      });
    });
  }

  /* ---------------- linkedin render ---------------- */
  var liPageSize = 60;
  var liShown = liPageSize;
  function renderLinkedin(reset){
    if(reset!==false) liShown = liPageSize;
    var q = (document.getElementById("liSearch").value||"").toLowerCase();
    var fMonth = document.getElementById("liMonthFilter").value;
    var fLocation = document.getElementById("liLocationFilter").value;
    var sortBy = document.getElementById("liSortFilter").value;
    var rows = (state.data.linkedin ? state.data.linkedin.records : []).slice();
    if(sortBy === "company"){
      rows.sort(function(a,b){ return (a["Company"]||"").localeCompare(b["Company"]||""); });
    } else if(sortBy === "position"){
      rows.sort(function(a,b){ return (a["Position"]||"").localeCompare(b["Position"]||""); });
    } else if(sortBy === "location"){
      rows.sort(function(a,b){ return (a["Location"]||"").localeCompare(b["Location"]||""); });
    } else {
      rows.sort(function(a,b){
        var da = parseDMY(a["Connected On"]), db = parseDMY(b["Connected On"]);
        return (db?db.getTime():0) - (da?da.getTime():0);
      });
    }
    rows = rows.filter(function(r){
      if(fMonth && monthKey(r["Connected On"]) !== fMonth) return false;
      if(fLocation && (r["Location"]||"").trim() !== fLocation) return false;
      if(!q) return true;
      var hay = [r["First Name"], r["Last Name"], r["Company"], r["Position"], r["Location"]].join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    var total = state.data.linkedin ? state.data.linkedin.records.length : 0;
    document.getElementById("countLinkedin").textContent = "("+total+")";
    document.getElementById("liResultsCount").textContent = "Showing " + Math.min(liShown, rows.length) + " of " + rows.length + " matching connections (" + total + " total)";
    var visible = rows.slice(0, liShown);
    var list = document.getElementById("liList");
    if(visible.length===0){ list.innerHTML = '<div class="empty-state">No connections match.</div>'; document.getElementById("liLoadMore").style.display="none"; return; }
    var now = new Date();
    list.innerHTML = visible.map(function(r){
      var d = parseDMY(r["Connected On"]);
      var recent = d && (now - d) < (1000*60*60*24*30);
      var name = ((r["First Name"]||"")+" "+(r["Last Name"]||"")).trim();
      var url = (r["URL"]||"").trim();
      var nameHtml = url ? '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;border-bottom:1px solid var(--gold);">'+esc(name)+'</a>' : esc(name);
      return '<div class="entry">'+
        '<div class="date-col"><span class="dot" style="background:'+(recent?"var(--good)":"var(--ink-3)")+';display:inline-block;margin-right:6px;"></span>'+esc(r["Connected On"]||"")+'</div>'+
        '<div class="body-col">'+
          '<div class="entry-top"><span class="entry-co">'+nameHtml+'</span></div>'+
          '<div class="entry-spoc">'+esc(r["Position"]||"")+(r["Company"]?(' · '+esc(r["Company"])):'')+(r["Location"]?(' · '+esc(r["Location"])):'')+'</div>'+
        '</div>'+
      '</div>';
    }).join("");
    var moreBtn = document.getElementById("liLoadMore");
    if(rows.length > liShown){ moreBtn.style.display="inline-flex"; } else { moreBtn.style.display="none"; }
  }

  /* ---------------- follow-ups / to-do ---------------- */
  function renderFollowups(){
    var companies = state.data.companies.records;
    var now = new Date();
    var overdue = [], dueSoon = [], openActions = [];
    companies.forEach(function(r){
      var ri = recencyInfo(r, now);
      var hasAction = (r["Next Planned Action"]||"").trim().length > 0;
      if(ri.tone==="hot"){
        overdue.push({r:r, ri:ri});
      } else if(ri.tone==="wait"){
        dueSoon.push({r:r, ri:ri});
      } else if(hasAction){
        openActions.push({r:r, ri:ri});
      }
    });
    overdue.sort(function(a,b){ var da=a.ri.days===null?999999:a.ri.days, db=b.ri.days===null?999999:b.ri.days; return db-da; });
    dueSoon.sort(function(a,b){ return b.ri.days-a.ri.days; });
    openActions.sort(function(a,b){ return a.ri.days-b.ri.days; });

    document.getElementById("todaysDate").textContent = fmtDMY(now);
    document.getElementById("countOverdue").textContent = overdue.length;
    document.getElementById("countDueSoon").textContent = dueSoon.length;
    document.getElementById("countOpenActions").textContent = openActions.length;
    var badge = document.getElementById("followupBadge");
    if(overdue.length>0){ badge.style.display="inline-block"; badge.textContent = overdue.length; }
    else { badge.style.display="none"; }

    function renderGroup(containerId, items, tone){
      var color = tone==="hot" ? "var(--hot)" : (tone==="wait" ? "var(--wait)" : "var(--gold)");
      var el = document.getElementById(containerId);
      if(items.length===0){ el.innerHTML = '<div class="empty-state">Nothing here — you\'re all caught up.</div>'; return; }
      el.innerHTML = items.map(function(item){
        var r = item.r, ri = item.ri;
        var contact = [r["Company Contact Person Name"], r["Company Contact Person Designation"]].filter(Boolean).join(" — ");
        var reach = [r["Company Contact Person (Contact Number)"], r["Company Contact Person (Email ID)"]].filter(Boolean).join(" · ");
        return '<div class="entry">'+
          '<div class="date-col" style="color:'+color+';font-weight:600;">'+(ri.days===null?"—":ri.days+" d")+'</div>'+
          '<div class="body-col">'+
            '<div class="entry-top"><span class="entry-co">'+esc(r["Company Name"])+'</span>'+
              '<span class="pill" style="background:var(--line-2);color:'+color+'">'+esc(ri.label)+'</span></div>'+
            (contact ? '<div class="entry-spoc">'+esc(contact)+(reach?(' · '+esc(reach)):'')+'</div>' : '')+
            '<div class="entry-next" style="color:'+(r["Next Planned Action"]?"var(--gold)":"var(--ink-3)")+';">'+(r["Next Planned Action"] ? esc(r["Next Planned Action"]) : "No next action logged — decide one and log it")+'</div>'+
          '</div>'+
        '</div>';
      }).join("");
    }
    renderGroup("overdueList", overdue, "hot");
    renderGroup("dueSoonList", dueSoon, "wait");
    renderGroup("openActionsList", openActions, "gold");
  }

  function renderAll(){
    document.getElementById("snapDate").textContent = computeSnapshotDate();
    document.getElementById("snapSource").textContent = state.source;
    renderOverview();
    populateCoFilters();
    renderCompanies();
    renderFollowups();
    populateMonthFilter("outMonthFilter", state.data.outreach.records, "Date");
    populateSelectFilter("outActivityFilter", state.data.outreach.records, "Activity Type", "All activity types");
    populateSelectFilter("outResponseFilter", state.data.outreach.records, "Response", "All responses");
    populateSelectFilter("outStageFilter", state.data.outreach.records, "Pipeline Stage", "All pipeline stages");
    renderOutreach();
    populateMonthFilter("meetMonthFilter", state.data.meetings.records, "Appointment Date");
    populateSelectFilter("meetStatusFilter", state.data.meetings.records, "Appointment Status", "All statuses");
    renderMeetings();
    populateSelectFilter("menteeProgramFilter", state.data.mentees.records, "Program", "All programs");
    populateSelectFilter("menteeOfferFilter", state.data.mentees.records, "Offer Received", "All offer status");
    renderMentees();
    if(state.data.linkedin){
      populateMonthFilter("liMonthFilter", state.data.linkedin.records, "Connected On");
      populateSelectFilter("liLocationFilter", state.data.linkedin.records, "Location", "All locations");
    }
    renderLinkedin(true);
  }


  /* ---------------- live data loading from Google Sheets ---------------- */
  var SHEET_TABS = {
    companies: "Company Master",
    outreach: "Outreach Log",
    meetings: "Meetings & Appointments",
    monthly: "Monthly Performance",
    mentees: "Mentees Status",
    linkedin: "LinkedIn Connections"
  };

  function aliasHeader(h){
    if(!h) return "";
    var s = String(h).trim().replace(/\s+/g, " ");
    if(/^Last Conversation Date/i.test(s)) return "Last Conversation Date";
    return s;
  }

  function parseSheetCSV(csvText){
    var parsed = Papa.parse(csvText, {header:true, skipEmptyLines:true});
    var fields = parsed.meta && parsed.meta.fields ? parsed.meta.fields : [];
    var renameMap = {};
    fields.forEach(function(f){ renameMap[f] = aliasHeader(f); });
    return parsed.data.map(function(row){
      var rec = {};
      fields.forEach(function(f){
        var key = renameMap[f];
        if(!key) return;
        var val = row[f];
        if(val===undefined || val===null) val = "";
        rec[key] = (typeof val === "string") ? val.trim() : val;
      });
      return rec;
    });
  }

  function fetchSheetCSV(tabName){
    var url = "/api/sheet?name=" + encodeURIComponent(tabName) + "&_t=" + Date.now();
    return fetch(url, {cache:"no-store"}).then(function(res){
      if(!res.ok){
        return res.text().then(function(t){ throw new Error(t || ("Failed to load " + tabName)); });
      }
      return res.text();
    });
  }

  function setRefreshBusy(busy){
    var btn = document.getElementById("refreshBtn");
    if(busy){ btn.classList.add("spinning"); btn.disabled = true; }
    else { btn.classList.remove("spinning"); btn.disabled = false; }
  }

  function loadAllData(isManualClick){
    setRefreshBusy(true);
    var errBanner = document.getElementById("errorBanner");
    errBanner.style.display = "none";
    var names = SHEET_TABS;
    var loadedTabs = [];
    function labeledFetch(label, tabName){
      return fetchSheetCSV(tabName).then(function(text){
        loadedTabs.push(label + ": OK (" + text.length + " chars)");
        return text;
      }).catch(function(err){
        loadedTabs.push(label + ": FAILED - " + (err && err.message ? err.message : String(err)));
        throw err;
      });
    }
    return Promise.all([
      labeledFetch("Company Master", names.companies),
      labeledFetch("Outreach Log", names.outreach),
      labeledFetch("Meetings", names.meetings),
      labeledFetch("Monthly Performance", names.monthly),
      labeledFetch("Mentees Status", names.mentees),
      labeledFetch("LinkedIn Connections", names.linkedin)
    ]).then(function(results){
      var companies = parseSheetCSV(results[0]).filter(function(r){ return r["Company Name"]; });
      var outreach = parseSheetCSV(results[1]).filter(function(r){ return r["Company Name"]; });
      var meetings = parseSheetCSV(results[2]).filter(function(r){ return r["Company Name"]; });
      var monthly = parseSheetCSV(results[3]).filter(function(r){ return r["Month"]; }).map(function(r){
        r["Outreach Touchpoints (auto)"] = Number(r["Outreach Touchpoints (auto)"]) || 0;
        r["Meetings Held (auto)"] = Number(r["Meetings Held (auto)"]) || 0;
        r["Offers Received (auto)"] = Number(r["Offers Received (auto)"]) || 0;
        return r;
      });
      var mentees = parseSheetCSV(results[4]).filter(function(r){ return r["Name"]; });
      var linkedin = parseSheetCSV(results[5]).filter(function(r){ return r["First Name"]; });

      if(companies.length===0){
        throw new Error("The 'Company Master' tab came back empty — check the sheet is shared as 'Anyone with the link – Viewer'.\n\nLoad log:\n" + loadedTabs.join("\n"));
      }

      state.data = {
        companies:{records:companies},
        outreach:{records:outreach},
        meetings:{records:meetings},
        monthly:{records:monthly},
        mentees:{records:mentees},
        linkedin:{records:linkedin}
      };
      state.source = "Live from Google Sheets";
      state.lastFetched = new Date();
      saveCachedData();
      renderAll();
      if(isManualClick) toast("Dashboard refreshed with the latest sheet data");
    }).catch(function(err){
      console.error(err);
      var msg = (err && err.message ? err.message : "Something went wrong.") + "\n\nLoad log:\n" + loadedTabs.join("\n");
      errBanner.textContent = "Couldn't load the dashboard:\n\n" + msg;
      errBanner.style.display = "block";
      toast("Couldn't refresh — see the message on the Overview tab");
    }).finally(function(){
      setRefreshBusy(false);
    });
  }
  function initFilters(){
    ["coSearch","coStatusFilter","coTypeFilter","coSectorFilter","coLocationFilter","coRecencyFilter"].forEach(function(id){
      document.getElementById(id).addEventListener("input", renderCompanies);
      document.getElementById(id).addEventListener("change", renderCompanies);
    });
    ["outSearch","outMonthFilter","outActivityFilter","outResponseFilter","outStageFilter"].forEach(function(id){
      document.getElementById(id).addEventListener("input", renderOutreach);
      document.getElementById(id).addEventListener("change", renderOutreach);
    });
    ["meetSearch","meetMonthFilter","meetStatusFilter"].forEach(function(id){
      document.getElementById(id).addEventListener("input", renderMeetings);
      document.getElementById(id).addEventListener("change", renderMeetings);
    });
    ["menteeSearch","menteeProgramFilter","menteeOfferFilter"].forEach(function(id){
      document.getElementById(id).addEventListener("input", renderMentees);
      document.getElementById(id).addEventListener("change", renderMentees);
    });
    ["liSearch","liMonthFilter","liLocationFilter","liSortFilter"].forEach(function(id){
      document.getElementById(id).addEventListener("input", function(){ renderLinkedin(true); });
      document.getElementById(id).addEventListener("change", function(){ renderLinkedin(true); });
    });
    document.getElementById("liLoadMore").addEventListener("click", function(){
      liShown += liPageSize;
      renderLinkedin(false);
    });
  }


  function initRefresh(){
    document.getElementById("refreshBtn").addEventListener("click", function(){
      loadAllData(true);
    });
  }

  document.addEventListener("DOMContentLoaded", function(){
    initTabs();
    initFilters();
    initRefresh();

    // Paint instantly from the last successful fetch (if any), then always
    // go fetch the live sheet right away so the page is never stuck showing
    // old data.
    var cached = loadCachedData();
    if(cached){
      state.data = cached.data;
      state.lastFetched = cached.fetchedAt ? new Date(cached.fetchedAt) : null;
      state.source = "Live from Google Sheets (cached)";
      renderAll();
    } else {
      document.getElementById("snapSource").textContent = "Loading live data…";
    }
    loadAllData(false);
  });
})();
