/* User-triggered regenerative series. Separate from the ordinary topic pool. */
(function(){
  "use strict";
  var API = "https://blog-diagram-api.dlgur007.workers.dev/api/regenerative";
  var ORIGIN = "https://blog-diagram-api.dlgur007.workers.dev";
  var panel = document.getElementById("panel-regen");
  var list = document.getElementById("regenList");
  var status = document.getElementById("regenStatus");
  var next = document.getElementById("regenNextBtn");
  if(!panel || !list || !status || !next) return;
  var labels = {unwritten:"미작성", draft:"초안", reviewed:"검수완료", published:"발행완료"};
  var current = null;
  var opened = 0;
  var details = {};
  var timer = null;

  function el(tag, className, text){
    var node = document.createElement(tag);
    if(className) node.className = className;
    if(text != null) node.textContent = String(text);
    return node;
  }
  function safeFile(url){ return /^\/files\/regenerative\/[a-z0-9_-]+\/(?:image-[1-5]\.jpg|images\.zip)$/i.test(url || ""); }
  async function api(path, body){
    var response = await fetch(API + (path || ""), body === undefined
      ? {cache:"no-store"}
      : {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)});
    var value = await response.json().catch(function(){ return {}; });
    if(!response.ok) throw new Error(value.error && value.error.message || "연재 정보를 처리하지 못했습니다.");
    return value;
  }
  async function copy(value, button){
    try{
      await navigator.clipboard.writeText(value);
      var label = button.textContent;
      button.textContent = "복사됨";
      setTimeout(function(){button.textContent = label;}, 1800);
    } catch(e){ status.textContent = "복사하지 못했습니다. 본문을 길게 눌러 복사해 주세요."; }
  }
  function detailView(data){
    var result = data.result;
    var wrap = el("div", "regen-detail");
    wrap.appendChild(el("h3", "regen-detail-title", result.title));
    var actions = el("div", "regen-actions");
    var titleCopy = el("button", "btn ghost", "제목 복사");
    titleCopy.type = "button";
    titleCopy.addEventListener("click", function(){copy(result.title, titleCopy);});
    actions.appendChild(titleCopy);
    var bodyCopy = el("button", "btn ghost", "본문 복사");
    bodyCopy.type = "button";
    bodyCopy.addEventListener("click", function(){copy(result.body, bodyCopy);});
    actions.appendChild(bodyCopy);
    if(safeFile(result.zipUrl)){
      var zip = el("a", "btn ghost", "JPG 전체 ZIP 다운로드");
      zip.href = ORIGIN + result.zipUrl + "?download=1";
      actions.appendChild(zip);
    }
    wrap.appendChild(actions);
    wrap.appendChild(el("div", "regen-body", result.body));
    var files = el("div", "regen-files");
    (result.images || []).forEach(function(image){
      if(!safeFile(image.url)) return;
      var card = el("div", "regen-file");
      var preview = el("a");
      preview.href = ORIGIN + image.url;
      preview.target = "_blank";
      preview.rel = "noopener";
      var img = el("img");
      img.src = ORIGIN + image.url;
      img.alt = image.caption || "그림 " + image.number;
      preview.appendChild(img);
      card.appendChild(preview);
      card.appendChild(el("p", "", "그림 " + image.number + " · " + (image.caption || "")));
      var download = el("a", "btn ghost", "JPG 다운로드");
      download.href = ORIGIN + image.url + "?download=1";
      card.appendChild(download);
      files.appendChild(card);
    });
    wrap.appendChild(files);
    return wrap;
  }
  function render(index){
    current = index;
    list.replaceChildren();
    var active = index.active;
    if(active){
      status.textContent = (active.status === "error" ? "생성 중단: " : "") +
        (active.note || "진행 상태를 확인하는 중입니다.");
      status.classList.toggle("regen-error", active.status === "error");
    } else {
      status.textContent = "1편은 기존 작성 완료로 표시했습니다. 발행 여부는 직접 선택해 주세요.";
      status.classList.remove("regen-error");
    }
    var busy = active && (active.status === "pending" || active.status === "running");
    next.disabled = !!busy || !index.episodes.some(function(ep){return ep.status === "unwritten";});
    next.textContent = busy ? "선택한 2편 생성 중…" : "다음 2편 생성";
    index.episodes.forEach(function(ep){
      var card = el("article", "regen-card");
      var row = el("div", "regen-row");
      var title = el("h3", "regen-title");
      title.appendChild(el("span", "regen-num", String(ep.number).padStart(2,"0")));
      title.appendChild(document.createTextNode(ep.title));
      row.appendChild(title);
      var actions = el("div", "regen-actions");
      actions.appendChild(el("span", "badge " + (ep.status === "unwritten" ? "meta" : "good"), labels[ep.status] || ep.status));
      if(ep.resultKey){
        var view = el("button", "btn ghost", opened === ep.number ? "닫기" : "원고 보기");
        view.type = "button";
        view.addEventListener("click", function(){
          opened = opened === ep.number ? 0 : ep.number;
          if(opened && !details[ep.number]){
            status.textContent = ep.number + "편 원고를 불러오는 중입니다.";
            api("?number=" + ep.number).then(function(data){
              details[ep.number] = data;
              render(current);
            }).catch(function(error){status.textContent = error.message;});
          } else render(current);
        });
        actions.appendChild(view);
      }
      if(ep.resultKey || ep.number === 1){
        var select = el("select");
        select.setAttribute("aria-label", ep.number + "편 상태");
        (ep.resultKey ? ["draft","reviewed","published"] : ["reviewed","published"]).forEach(function(key){
          var option = el("option", "", labels[key]);
          option.value = key;
          option.selected = ep.status === key;
          select.appendChild(option);
        });
        select.disabled = !!busy && active.numbers.includes(ep.number);
        select.addEventListener("change", async function(){
          select.disabled = true;
          try{ render(await api("/status", {number:ep.number,status:select.value})); }
          catch(error){status.textContent = error.message; select.disabled = false;}
        });
        actions.appendChild(select);
      }
      var redo = el("button", "btn ghost", ep.status === "unwritten" ? "이 편 생성" : "재생성");
      redo.type = "button";
      redo.disabled = !!busy;
      redo.setAttribute("aria-label", ep.number + (ep.status === "unwritten" ? "편 생성" : "편 재생성"));
      redo.addEventListener("click", function(){generate({number:ep.number});});
      actions.appendChild(redo);
      row.appendChild(actions);
      card.appendChild(row);
      if(ep.number === 1 && !ep.resultKey)
        card.appendChild(el("p", "hint", "기존에 작성한 1편입니다. 원고 파일은 이 연재 저장소에 아직 등록되지 않았습니다."));
      if(opened === ep.number && details[ep.number]) card.appendChild(detailView(details[ep.number]));
      list.appendChild(card);
    });
    clearTimeout(timer);
    if(busy) timer = setTimeout(refresh, 15000);
  }
  async function refresh(){
    try{ render(await api()); }
    catch(error){ status.textContent = error.message; status.classList.add("regen-error"); }
  }
  async function generate(payload){
    next.disabled = true;
    status.textContent = "생성 요청을 저장하는 중입니다.";
    try{ render(await api("/generate", payload)); }
    catch(error){ status.textContent = error.message; status.classList.add("regen-error"); next.disabled = false; }
  }
  next.addEventListener("click", function(){generate({});});
  document.querySelector('[data-tab="regen"]').addEventListener("click", refresh);
})();
