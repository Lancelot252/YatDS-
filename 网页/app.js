(() => {
  "use strict";

  const data = window.LECTURE_DATA;
  const article = document.querySelector("#article");
  const chapterNav = document.querySelector("#chapterNav");
  const pageRail = document.querySelector("#pageRail");
  const pager = document.querySelector("#pager");
  const overviewButton = document.querySelector("#overviewButton");
  const searchDialog = document.querySelector("#searchDialog");
  const searchInput = document.querySelector("#searchInput");
  const searchResults = document.querySelector("#searchResults");
  const menuButton = document.querySelector("#menuButton");
  const mobileMenuQuery = window.matchMedia("(max-width: 760px)");
  const flatSections = data.chapters.flatMap((chapter, chapterIndex) =>
    chapter.sections.map((section, sectionIndex) => ({ chapter, section, chapterIndex, sectionIndex }))
  );
  let current = { view: "overview", chapterIndex: 0, sectionIndex: 0 };
  let expandedChapter = 0;

  const icon = (direction) => `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="${direction === "left" ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6"}"/>
    </svg>`;

  function routeFor(chapterIndex, sectionIndex) {
    return `#chapter=${chapterIndex + 1}&section=${sectionIndex + 1}`;
  }

  function parseRoute() {
    const hash = location.hash.slice(1);
    if (!hash || hash === "overview") return { view: "overview", chapterIndex: 0, sectionIndex: 0 };
    const params = new URLSearchParams(hash);
    const chapterIndex = Math.max(0, Math.min(data.chapters.length - 1, Number(params.get("chapter")) - 1 || 0));
    const chapter = data.chapters[chapterIndex];
    const sectionIndex = Math.max(0, Math.min(chapter.sections.length - 1, Number(params.get("section")) - 1 || 0));
    return { view: "section", chapterIndex, sectionIndex };
  }

  function setRoute(chapterIndex, sectionIndex) {
    location.hash = routeFor(chapterIndex, sectionIndex);
  }

  function syncMenuButton() {
    const expanded = mobileMenuQuery.matches
      ? document.body.classList.contains("menu-open")
      : !document.body.classList.contains("sidebar-collapsed");
    menuButton.setAttribute("aria-expanded", String(expanded));
    menuButton.setAttribute("aria-label", expanded ? "收起目录" : "打开目录");
  }

  function closeMenu() {
    if (mobileMenuQuery.matches) document.body.classList.remove("menu-open");
    syncMenuButton();
  }

  function renderNav() {
    chapterNav.innerHTML = data.chapters.map((chapter, chapterIndex) => {
      const isOpen = expandedChapter === chapterIndex;
      const isCurrent = current.view === "section" && current.chapterIndex === chapterIndex;
      const sectionLinks = chapter.sections.map((section, sectionIndex) => `
        <button class="section-link ${isCurrent && current.sectionIndex === sectionIndex ? "active" : ""}"
          type="button" data-chapter="${chapterIndex}" data-section="${sectionIndex}">
          ${section.shortTitle}
        </button>`).join("");
      return `
        <section class="chapter-block ${isOpen ? "open" : ""} ${isCurrent ? "current" : ""}">
          <button class="chapter-button" type="button" data-expand="${chapterIndex}" aria-expanded="${isOpen}">
            <span class="chapter-number">${chapterIndex + 1}</span>
            <span>${chapter.title}</span>
            <svg class="chevron" aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 6 6-6 6"/></svg>
          </button>
          <div class="section-list">${sectionLinks}</div>
        </section>`;
    }).join("");

    overviewButton.classList.toggle("active", current.view === "overview");
  }

  function renderOverview() {
    document.title = "YatDS 人机协作课程讲义";
    article.innerHTML = `
      <header class="overview-hero">
        <h1>人机协作课程讲义</h1>
        <p>从理解编码 Agent 开始，逐步掌握提示词、上下文、工具、测试、审查、风险控制与多 Agent 协作。选择下方任一章节开始阅读。</p>
      </header>
      <div class="overview-list">
        ${data.chapters.map((chapter, index) => `
          <button class="overview-item" type="button" data-overview-chapter="${index}">
            <span class="chapter-number">${index + 1}</span>
            <span>
              <span class="overview-name">${chapter.title}</span><br />
              <span class="overview-count">${chapter.sections.length} 个内容页</span>
            </span>
            <svg class="overview-arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
          </button>`).join("")}
      </div>`;
    pageRail.innerHTML = "";
    pager.innerHTML = "";
    window.scrollTo(0, 0);
    renderNav();
  }

  function getFlatIndex(chapterIndex, sectionIndex) {
    return flatSections.findIndex(item => item.chapterIndex === chapterIndex && item.sectionIndex === sectionIndex);
  }

  function renderSection() {
    const chapter = data.chapters[current.chapterIndex];
    const section = chapter.sections[current.sectionIndex];
    const flatIndex = getFlatIndex(current.chapterIndex, current.sectionIndex);
    const previous = flatSections[flatIndex - 1];
    const next = flatSections[flatIndex + 1];

    document.title = `${section.shortTitle}｜${chapter.title}｜YatDS`;
    article.innerHTML = `
      <header class="article-header">
        <div class="breadcrumb">${chapter.title} <span>/</span> ${section.shortTitle}</div>
        <h1>${section.title}</h1>
      </header>
      <div class="article-body">${section.html}</div>`;

    article.querySelectorAll("pre").forEach(pre => {
      const button = document.createElement("button");
      button.className = "copy-code";
      button.type = "button";
      button.textContent = "复制";
      button.addEventListener("click", async () => {
        await navigator.clipboard.writeText(pre.querySelector("code")?.innerText || pre.innerText);
        button.textContent = "已复制";
        setTimeout(() => { button.textContent = "复制"; }, 1200);
      });
      pre.append(button);
    });

    const subheads = [...article.querySelectorAll(".article-body h2, .article-body h3")];
    pageRail.innerHTML = `
      <div class="rail-title">本页内容 <span>${current.sectionIndex + 1} / ${chapter.sections.length}</span></div>
      ${subheads.length ? subheads.map((heading, index) => {
        if (!heading.id) heading.id = `heading-${index + 1}`;
        return `<button class="rail-link" type="button" data-local-link="${heading.id}">${heading.textContent}</button>`;
      }).join("") : `<span class="rail-link active">${section.shortTitle}</span>`}
      <div class="page-progress" aria-hidden="true"><div class="page-progress-fill"></div></div>`;

    pager.innerHTML = `
      <button class="pager-link previous" type="button" ${previous ? "" : "disabled"} data-page-step="-1">
        ${icon("left")}
        <span class="pager-copy"><span class="pager-direction">上一节</span><span class="pager-label">${previous ? `${previous.chapter.title} / ${previous.section.shortTitle}` : ""}</span></span>
      </button>
      <span class="pager-count">${current.sectionIndex + 1} / ${chapter.sections.length}</span>
      <button class="pager-link next" type="button" ${next ? "" : "disabled"} data-page-step="1">
        <span class="pager-copy"><span class="pager-direction">下一节</span><span class="pager-label">${next ? `${next.chapter.title} / ${next.section.shortTitle}` : ""}</span></span>
        ${icon("right")}
      </button>`;

    window.scrollTo(0, 0);
    renderNav();
    requestAnimationFrame(updateProgress);
  }

  function render() {
    current = parseRoute();
    if (current.view === "section") {
      expandedChapter = current.chapterIndex;
      renderSection();
    } else {
      renderOverview();
    }
    closeMenu();
  }

  function movePage(step) {
    if (current.view !== "section") return;
    const index = getFlatIndex(current.chapterIndex, current.sectionIndex);
    const target = flatSections[index + step];
    if (target) setRoute(target.chapterIndex, target.sectionIndex);
  }

  function updateProgress() {
    const fill = document.querySelector(".page-progress-fill");
    if (!fill || current.view !== "section") return;
    const articleTop = article.offsetTop;
    const available = Math.max(1, article.scrollHeight - window.innerHeight + 140);
    const progress = Math.max(0, Math.min(100, ((window.scrollY - articleTop + 80) / available) * 100));
    fill.style.width = `${progress}%`;
  }

  function search(query) {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      searchResults.innerHTML = `<div class="search-empty">输入关键词，快速直达对应讲义页</div>`;
      return;
    }
    const matches = flatSections.filter(({ chapter, section }) =>
      `${chapter.title} ${section.title} ${section.text}`.toLocaleLowerCase().includes(normalized)
    ).slice(0, 30);
    searchResults.innerHTML = matches.length ? matches.map(item => `
      <button class="search-result" type="button" data-search-chapter="${item.chapterIndex}" data-search-section="${item.sectionIndex}">
        <strong>${item.section.shortTitle}</strong>
        <span>${item.chapter.title}</span>
      </button>`).join("") : `<div class="search-empty">没有找到“${escapeHtml(query)}”</div>`;
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  chapterNav.addEventListener("click", event => {
    const section = event.target.closest("[data-section]");
    const expand = event.target.closest("[data-expand]");
    if (section) {
      setRoute(Number(section.dataset.chapter), Number(section.dataset.section));
    } else if (expand) {
      const chapterIndex = Number(expand.dataset.expand);
      if (expandedChapter === chapterIndex) {
        expandedChapter = -1;
        renderNav();
      } else {
        expandedChapter = chapterIndex;
        renderNav();
      }
    }
  });

  article.addEventListener("click", event => {
    const item = event.target.closest("[data-overview-chapter]");
    if (item) setRoute(Number(item.dataset.overviewChapter), 0);
  });

  pager.addEventListener("click", event => {
    const button = event.target.closest("[data-page-step]");
    if (button) movePage(Number(button.dataset.pageStep));
  });

  pageRail.addEventListener("click", event => {
    const button = event.target.closest("[data-local-link]");
    if (!button) return;
    document.getElementById(button.dataset.localLink)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector("#homeButton").addEventListener("click", () => { location.hash = "overview"; });
  overviewButton.addEventListener("click", () => { location.hash = "overview"; });
  document.querySelector("#searchButton").addEventListener("click", () => {
    searchDialog.showModal();
    searchInput.focus();
    search("");
  });
  searchInput.addEventListener("input", () => search(searchInput.value));
  searchResults.addEventListener("click", event => {
    const result = event.target.closest("[data-search-section]");
    if (!result) return;
    searchDialog.close();
    setRoute(Number(result.dataset.searchChapter), Number(result.dataset.searchSection));
  });
  menuButton.addEventListener("click", () => {
    if (mobileMenuQuery.matches) {
      document.body.classList.toggle("menu-open");
    } else {
      document.body.classList.toggle("sidebar-collapsed");
    }
    syncMenuButton();
  });
  document.querySelector("#sidebarScrim").addEventListener("click", closeMenu);
  mobileMenuQuery.addEventListener("change", () => {
    document.body.classList.remove("menu-open");
    syncMenuButton();
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchDialog.showModal();
      searchInput.focus();
      search("");
    } else if (!searchDialog.open && event.key === "ArrowLeft" && !event.target.matches("input, textarea")) {
      movePage(-1);
    } else if (!searchDialog.open && event.key === "ArrowRight" && !event.target.matches("input, textarea")) {
      movePage(1);
    }
  });

  render();
})();
