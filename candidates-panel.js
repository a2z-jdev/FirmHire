(function () {
  var body = document.body;
  var openBtn = document.getElementById("fh-open-candidates");
  var closeBtn = document.getElementById("fh-close-candidates");
  var backdrop = document.getElementById("fh-candidates-backdrop");
  var panel = document.getElementById("fh-candidates-panel");
  var jobCountEl = document.getElementById("fh-job-count");
  var jobEmptyEl = document.getElementById("fh-job-empty");
  var firmHireSectionEl = document.getElementById("fh-firmhire-section");
  var otherSectionEl = document.getElementById("fh-other-section");
  var jobsDividerEl = document.getElementById("fh-jobs-divider");
  var firmHireListEl = document.getElementById("fh-firmhire-list");
  var otherListEl = document.getElementById("fh-other-list");
  var firmHireCountEl = document.getElementById("fh-firmhire-count");
  var otherCountEl = document.getElementById("fh-other-count");
  var detailPopoverEl = document.getElementById("fh-job-detail-popover");
  var categoryMultiselectEl = document.getElementById("fh-category-multiselect");
  var msToggleEl = document.getElementById("fh-ms-toggle");
  var msLabelEl = document.getElementById("fh-ms-label");
  var msPanelEl = document.getElementById("fh-ms-panel");
  var msOptionsEl = document.getElementById("fh-ms-options");
  var msClearEl = document.getElementById("fh-ms-clear");
  var msApplyEl = document.getElementById("fh-ms-apply");
  var selectedCategoryEl = document.getElementById("fh-selected-category");

  if (!openBtn || !panel || !firmHireListEl || !otherListEl) return;

  var allJobs = [];
  var firmHireJobs = [];
  var otherJobs = [];
  var allCategories = [];
  var selectedCategory = null;
  var LEVEL_FRESHER = "Fresher";
  var LEVEL_MANAGER = "Manager";
  var jobsLoaded = false;
  var jobsLoading = false;
  var popoverHideTimer = null;
  var popoverAnchor = null;
  var popoverCardHovered = false;
  var popoverSelfHovered = false;

  var LOGO_COLORS = [
    "#2563eb", "#1d4ed8", "#3b82f6", "#60a5fa",
    "#16a34a", "#059669", "#7c3aed", "#9333ea",
  ];

  function jobsApiUrl() {
    return window.FIRMHIRE_JOBS_API || "https://stg-jobscrapper.myskillstree.com/api/jobs";
  }

  function firmHireJobsApiUrl() {
    return (
      window.FIRMHIRE_JDS_API ||
      "https://prd.beanstalk.myskillstree.com/skill/api/v1/skills/dynamic/JDS?filter=costCenter%3ACSORG-146197%7Cmstatus%3A!ARCHIVE%7CjdsType%3A!SEARCH&sortField=createdTime&sortOrder=desc"
    );
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function getInitials(company) {
    if (!company) return "?";
    var words = company.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return company.slice(0, 2).toUpperCase();
  }

  function getLogoColor(name) {
    var hash = 0;
    var str = name || "job";
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return LOGO_COLORS[Math.abs(hash) % LOGO_COLORS.length];
  }

  function truncate(text, max) {
    var value = String(text || "");
    if (value.length <= max) return value;
    return value.slice(0, max - 1) + "…";
  }

  function formatSourceLabel(source) {
    if (source === "firmhire") return "FirmHire";
    if (source === "naukri") return "Naukri";
    if (source === "internshala") return "Internshala";
    return source || "Job board";
  }

  function formatSalary(job) {
    if (job.hideSalary === "Yes") return null;
    var low = Number(job.salaryLow);
    var high = Number(job.salaryHigh);
    if ((!low && !high) || (low === 0 && high === 0)) return null;
    if (low && high) return low + " - " + high;
    return String(low || high);
  }

  function extractJdsJobs(payload) {
    var list = [];
    if (Array.isArray(payload)) list = payload;
    else if (payload && Array.isArray(payload.data)) list = payload.data;
    else if (payload && Array.isArray(payload.content)) list = payload.content;
    else if (payload && Array.isArray(payload.jobs)) list = payload.jobs;
    return list.filter(function (item) {
      return item && item.id && item.title;
    });
  }

  function normalizeFirmHireJob(job) {
    if (!job || !job.id || !job.title) return null;
    var category = job.jdCategoryName ? [job.jdCategoryName] : [];
    return {
      id: job.id,
      title: job.title,
      company: job.jdCompany || "FirmHire",
      location: job.jobLocation || "Remote",
      salary: formatSalary(job),
      experience: job.experienceLevel || job.experience || null,
      posted: null,
      source: "firmhire",
      skills: Array.isArray(job.skills) ? job.skills : [],
      category: category,
      link: job.shortURL || null,
    };
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase();
  }

  function parseYearRange(experience) {
    var text = normalizeText(experience);
    var range = text.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
    if (range) {
      return { min: Number(range[1]), max: Number(range[2]) };
    }
    var single = text.match(/^(\d+)\s*(?:yrs?|years?)?$/);
    if (single) {
      return { min: Number(single[1]), max: Number(single[1]) };
    }
    return null;
  }

  function isFresherJob(job) {
    var exp = normalizeText(job.experience);
    var title = normalizeText(job.title);
    if (/\bfresher\b/.test(exp) || /\bfresher\b/.test(title)) return true;
    if (/\bentry\s*level\b/.test(exp) || /\bentry\b/.test(exp)) return true;
    var range = parseYearRange(job.experience);
    return !!(range && range.min === 0 && range.max <= 1);
  }

  function isManagerJob(job) {
    var exp = normalizeText(job.experience);
    var title = normalizeText(job.title);
    if (/\bmanager\s*level\b/.test(exp) || /\bmanager\b/.test(exp)) return true;
    return /\bmanager\b/.test(title);
  }

  function isLevelFilter(value) {
    return value === LEVEL_FRESHER || value === LEVEL_MANAGER;
  }

  function jobMatchesFilter(job, filterValue) {
    if (!filterValue) return true;
    if (filterValue === LEVEL_FRESHER) return isFresherJob(job);
    if (filterValue === LEVEL_MANAGER) return isManagerJob(job);
    return (job.category || []).indexOf(filterValue) !== -1;
  }

  function filterByCategory(jobs) {
    if (!selectedCategory) return jobs.slice();
    return jobs.filter(function (job) {
      return jobMatchesFilter(job, selectedCategory);
    });
  }

  function renderSkillTags(skills) {
    if (!skills || !skills.length) {
      return '<span class="text-[10px] font-semibold text-slate-500">View details</span>';
    }
    var visible = skills.slice(0, 3);
    var remaining = skills.length - visible.length;
    var tags = visible
      .map(function (skill) {
        return (
          '<span class="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">' +
          escapeHtml(truncate(skill, 12)) +
          "</span>"
        );
      })
      .join("");
    if (remaining > 0) {
      tags +=
        '<span class="inline-flex items-center text-[10px] font-semibold text-slate-500">+' +
        remaining +
        " more</span>";
    }
    return tags;
  }

  function renderDetailRow(icon, label, value) {
    if (!value) return "";
    return (
      '<div class="flex items-start gap-2">' +
      '<span class="w-5 shrink-0 text-center text-sm leading-5" aria-hidden="true">' +
      icon +
      "</span>" +
      '<div class="flex min-w-0 flex-col gap-0.5">' +
      '<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">' +
      escapeHtml(label) +
      "</span>" +
      '<span class="break-words text-sm leading-snug text-slate-700">' +
      escapeHtml(value) +
      "</span>" +
      "</div></div>"
    );
  }

  function renderDetailSkills(skills) {
    if (!skills || !skills.length) {
      return '<p class="m-0 text-sm text-slate-400">No skills listed</p>';
    }
    return skills
      .map(function (skill) {
        return (
          '<span class="inline-block rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">' +
          escapeHtml(skill) +
          "</span>"
        );
      })
      .join("");
  }

  function renderJobDetailPopover(job) {
    var company = job.company || "Company";
    var logoColor = getLogoColor(company);
    var initials = getInitials(company);
    var sourceClass =
      job.source === "naukri"
        ? "bg-amber-100 text-amber-700"
        : job.source === "internshala"
          ? "bg-green-100 text-green-700"
          : "bg-blue-50 text-blue-600";
    var categories =
      job.category && job.category.length ? job.category.join(", ") : null;

    return (
      '<div class="mb-3.5 flex items-start gap-3 border-b border-slate-100 pb-3">' +
      '<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style="background:' +
      logoColor +
      '">' +
      escapeHtml(initials) +
      "</div>" +
      '<div class="min-w-0 flex-1">' +
      '<h3 class="mb-0.5 text-[15px] font-bold leading-snug text-slate-900">' +
      escapeHtml(job.title || "Untitled role") +
      "</h3>" +
      '<p class="m-0 text-sm text-slate-500">' +
      escapeHtml(company) +
      "</p>" +
      "</div>" +
      (job.source
        ? '<span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
          sourceClass +
          '">' +
          escapeHtml(formatSourceLabel(job.source)) +
          "</span>"
        : "") +
      "</div>" +
      '<div class="mb-3.5 grid gap-2">' +
      renderDetailRow("📍", "Location", job.location) +
      renderDetailRow("💼", "Experience", job.experience) +
      renderDetailRow("💰", "Salary", job.salary) +
      renderDetailRow("🕐", "Posted", job.posted) +
      renderDetailRow("🏷️", "Category", categories) +
      "</div>" +
      '<div>' +
      '<h4 class="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Skills required</h4>' +
      '<div class="flex flex-wrap gap-1.5">' +
      renderDetailSkills(job.skills) +
      "</div></div>"
    );
  }

  function positionDetailPopover(anchorEl) {
    if (!detailPopoverEl) return;
    var rect = anchorEl.getBoundingClientRect();
    var gap = 10;
    var margin = 16;
    var popoverWidth = detailPopoverEl.offsetWidth || 340;
    var popoverHeight = detailPopoverEl.offsetHeight || 320;

    detailPopoverEl.classList.remove(
      "popover-left",
      "popover-right",
      "popover-above"
    );

    // Prefer left of card (panel is on the right)
    var left = rect.left - popoverWidth - gap;
    var top = rect.top + rect.height / 2 - popoverHeight / 2;

    if (left >= margin) {
      detailPopoverEl.classList.add("popover-left");
    } else {
      left = Math.min(rect.right + gap, window.innerWidth - popoverWidth - margin);
      detailPopoverEl.classList.add("popover-right");
    }

    if (top + popoverHeight > window.innerHeight - margin) {
      top = window.innerHeight - popoverHeight - margin;
    }
    if (top < margin) top = margin;

    detailPopoverEl.style.top = top + "px";
    detailPopoverEl.style.left = left + "px";
  }

  function shouldKeepPopoverOpen() {
    return popoverCardHovered || popoverSelfHovered;
  }

  function scheduleHidePopover() {
    clearTimeout(popoverHideTimer);
    popoverHideTimer = setTimeout(function () {
      if (!shouldKeepPopoverOpen()) {
        hideJobDetailPopover(0);
      }
    }, 280);
  }

  function showJobDetailPopover(job, anchorEl) {
    if (!detailPopoverEl) return;
    clearTimeout(popoverHideTimer);
    popoverAnchor = anchorEl;
    detailPopoverEl.innerHTML = renderJobDetailPopover(job);
    detailPopoverEl.hidden = false;
    detailPopoverEl.setAttribute("aria-hidden", "false");

    requestAnimationFrame(function () {
      positionDetailPopover(anchorEl);
      detailPopoverEl.classList.add("visible");
    });
  }

  function hideJobDetailPopover(delay) {
    if (!detailPopoverEl) return;
    popoverCardHovered = false;
    popoverSelfHovered = false;
    clearTimeout(popoverHideTimer);

    function hideNow() {
      detailPopoverEl.classList.remove("visible");
      detailPopoverEl.hidden = true;
      detailPopoverEl.setAttribute("aria-hidden", "true");
      popoverAnchor = null;
    }

    if (delay === 0) {
      hideNow();
      return;
    }

    popoverHideTimer = setTimeout(hideNow, delay == null ? 280 : delay);
  }

  function bindJobDetailHover(card, job) {
    if (!detailPopoverEl) return;
    if (window.matchMedia("(hover: none), (max-width: 767px)").matches) return;

    card.addEventListener("mouseenter", function () {
      popoverCardHovered = true;
      showJobDetailPopover(job, card);
    });
    card.addEventListener("mouseleave", function () {
      popoverCardHovered = false;
      scheduleHidePopover();
    });
    card.addEventListener("focus", function () {
      popoverCardHovered = true;
      showJobDetailPopover(job, card);
    });
    card.addEventListener("blur", function () {
      popoverCardHovered = false;
      scheduleHidePopover();
    });
  }

  function openJobLink(job) {
    if (job && job.link) {
      window.open(job.link, "_blank", "noopener,noreferrer");
      return true;
    }
    return false;
  }

  function renderJobCard(job) {
    var hasLink = !!(job && job.link);
    var card = document.createElement(hasLink ? "a" : "button");
    card.className =
      "fh-job-card group flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left no-underline shadow-sm transition hover:-translate-x-0.5 hover:border-blue-200 hover:bg-blue-50/60 focus-visible:border-blue-200 focus-visible:bg-blue-50/60 focus-visible:outline-none" +
      (hasLink ? "" : " cursor-default opacity-70 hover:translate-x-0 hover:border-slate-100 hover:bg-white");

    if (hasLink) {
      card.href = job.link;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    } else {
      card.type = "button";
      card.setAttribute("aria-disabled", "true");
      card.addEventListener("click", function (e) {
        e.preventDefault();
      });
    }

    card.setAttribute(
      "aria-label",
      (job.title || "Job") + " at " + (job.company || "company")
    );

    var company = job.company || "Company";
    var location = job.location || "Remote";
    var logoColor = getLogoColor(company);
    var initials = getInitials(company);

    card.innerHTML =
      '<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm" style="background:' +
      logoColor +
      '">' +
      escapeHtml(initials) +
      "</div>" +
      '<div class="min-w-0 flex-1">' +
      '<h3 class="mb-0.5 text-sm font-bold leading-snug text-slate-900 transition group-hover:text-blue-600">' +
      escapeHtml(job.title || "Untitled role") +
      "</h3>" +
      '<p class="mb-1.5 truncate text-xs text-slate-500">' +
      escapeHtml(company) +
      " · " +
      escapeHtml(location) +
      "</p>" +
      '<div class="flex flex-wrap gap-1.5">' +
      renderSkillTags(job.skills) +
      "</div>" +
      "</div>";

    if (hasLink) {
      card.addEventListener("click", function (e) {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
          e.preventDefault();
          hideJobDetailPopover(0);
          openJobLink(job);
        }
      });
    }

    bindJobDetailHover(card, job);
    return card;
  }

  function setStatus(message, isEmpty) {
    if (jobCountEl) {
      jobCountEl.textContent = message || "";
      jobCountEl.hidden = !message;
      jobCountEl.classList.toggle("hidden", !message);
    }
    if (jobEmptyEl) {
      jobEmptyEl.textContent = isEmpty ? message : "";
      jobEmptyEl.hidden = !isEmpty;
    }
  }

  function setSectionVisibility(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.classList.toggle("hidden", !visible);
    if (el === jobsDividerEl) return;
    el.classList.toggle("flex", visible);
  }

  function openingsLabel(count) {
    return count + " opening" + (count === 1 ? "" : "s");
  }

  function clearJobLists() {
    firmHireListEl.innerHTML = "";
    otherListEl.innerHTML = "";
    setSectionVisibility(firmHireSectionEl, false);
    setSectionVisibility(otherSectionEl, false);
    setSectionVisibility(jobsDividerEl, false);
  }

  function updateCategoryLabel() {
    if (!msLabelEl || !msToggleEl || !msClearEl) return;
    if (!selectedCategory) {
      msLabelEl.textContent = "All Categories";
    } else {
      msLabelEl.textContent = selectedCategory;
    }
    msToggleEl.classList.toggle("has-selection", !!selectedCategory);
    msClearEl.hidden = !selectedCategory;

    if (selectedCategoryEl) {
      if (selectedCategory) {
        selectedCategoryEl.hidden = false;
        selectedCategoryEl.innerHTML =
          (isLevelFilter(selectedCategory) ? "Level: " : "Category: ") +
          '<span class="text-blue-600">' +
          escapeHtml(selectedCategory) +
          "</span>";
      } else {
        selectedCategoryEl.hidden = true;
        selectedCategoryEl.textContent = "";
      }
    }
  }

  function renderCategoryOptions() {
    if (!msOptionsEl) return;

    msOptionsEl.innerHTML = "";

    if (!allCategories.length) {
      msOptionsEl.innerHTML =
        '<p class="m-0 px-2 py-3 text-center text-xs text-slate-500">No categories found</p>';
      return;
    }

    allCategories.forEach(function (cat) {
      var isSelected = selectedCategory === cat;
      var option = document.createElement("label");
      option.className =
        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-blue-50" +
        (isSelected ? " bg-blue-50" : "");
      option.innerHTML =
        '<input type="checkbox" class="accent-blue-600" ' +
        (isSelected ? "checked" : "") +
        " /><span>" +
        escapeHtml(cat) +
        "</span>";

      var input = option.querySelector("input");
      input.addEventListener("change", function () {
        selectedCategory = input.checked ? cat : null;
        renderCategoryOptions();
        updateCategoryLabel();
        applyFilter();
      });

      msOptionsEl.appendChild(option);
    });
  }

  function populateCategoryFilter(jobs) {
    var categories = new Set();
    var hasFresher = false;
    var hasManager = false;

    jobs.forEach(function (job) {
      (job.category || []).forEach(function (cat) {
        if (cat && !isLevelFilter(cat)) categories.add(cat);
      });
      if (isFresherJob(job)) hasFresher = true;
      if (isManagerJob(job)) hasManager = true;
    });

    allCategories = [];
    if (hasFresher) allCategories.push(LEVEL_FRESHER);
    if (hasManager) allCategories.push(LEVEL_MANAGER);
    Array.from(categories)
      .sort(function (a, b) {
        return a.localeCompare(b);
      })
      .forEach(function (cat) {
        allCategories.push(cat);
      });

    if (selectedCategory && allCategories.indexOf(selectedCategory) === -1) {
      selectedCategory = null;
    }

    renderCategoryOptions();
    updateCategoryLabel();
  }

  function applyFilter() {
    renderJobSections(filterByCategory(firmHireJobs), filterByCategory(otherJobs));
  }

  function openCategoryPanel() {
    if (!msPanelEl || !msToggleEl) return;
    msPanelEl.classList.remove("hidden");
    msPanelEl.classList.add("flex");
    msPanelEl.setAttribute("aria-hidden", "false");
    msToggleEl.setAttribute("aria-expanded", "true");
    renderCategoryOptions();
  }

  function closeCategoryPanel() {
    if (!msPanelEl || !msToggleEl) return;
    msPanelEl.classList.add("hidden");
    msPanelEl.classList.remove("flex");
    msPanelEl.setAttribute("aria-hidden", "true");
    msToggleEl.setAttribute("aria-expanded", "false");
  }

  function isCategoryPanelOpen() {
    return msPanelEl && !msPanelEl.classList.contains("hidden");
  }

  function appendJobCards(listEl, jobs) {
    for (var i = 0; i < jobs.length; i++) {
      listEl.appendChild(renderJobCard(jobs[i]));
    }
  }

  function renderJobSections(firmJobs, sourceJobs) {
    hideJobDetailPopover(0);
    clearJobLists();

    var firmCount = firmJobs.length;
    var otherCount = sourceJobs.length;
    var total = firmCount + otherCount;
    var showBoth = firmCount > 0 && otherCount > 0;

    if (!total) {
      setStatus("No jobs match your filters", true);
      return;
    }

    setStatus("", false);

    if (firmCount > 0) {
      if (firmHireCountEl) {
        firmHireCountEl.textContent = "FirmHire Jobs · " + openingsLabel(firmCount);
      }
      appendJobCards(firmHireListEl, firmJobs);
      setSectionVisibility(firmHireSectionEl, true);
    }

    if (otherCount > 0) {
      if (otherCountEl) {
        otherCountEl.textContent = "Other Sources · " + openingsLabel(otherCount);
      }
      appendJobCards(otherListEl, sourceJobs);
      setSectionVisibility(otherSectionEl, true);
    }

    setSectionVisibility(jobsDividerEl, showBoth);

    if (firmHireSectionEl) {
      firmHireSectionEl.classList.toggle("flex-1", firmCount > 0 && !showBoth);
      firmHireSectionEl.classList.toggle("flex-none", showBoth);
      firmHireSectionEl.classList.toggle("max-h-[48%]", showBoth);
    }
  }

  async function fetchJson(url) {
    var res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch (" + res.status + "): " + url);
    return res.json();
  }

  async function loadJobs() {
    if (jobsLoaded || jobsLoading) return;
    jobsLoading = true;
    setStatus("Loading jobs…", false);
    clearJobLists();
    firmHireListEl.innerHTML =
      '<p class="rounded-xl border border-slate-200 bg-white p-3.5 text-center text-sm text-slate-500 shadow-sm"><i class="fas fa-circle-notch fa-spin mr-1.5 text-blue-600"></i> Fetching openings…</p>';
    setSectionVisibility(firmHireSectionEl, true);

    try {
      var results = await Promise.allSettled([
        fetchJson(firmHireJobsApiUrl()),
        fetchJson(jobsApiUrl()),
      ]);

      var firmResult = results[0];
      var otherResult = results[1];

      if (firmResult.status === "fulfilled") {
        firmHireJobs = extractJdsJobs(firmResult.value)
          .map(normalizeFirmHireJob)
          .filter(Boolean);
      } else {
        firmHireJobs = [];
        if (firmResult.status === "rejected") {
          console.error("FirmHire jobs failed:", firmResult.reason);
        }
      }

      if (otherResult.status === "fulfilled" && Array.isArray(otherResult.value)) {
        otherJobs = otherResult.value;
      } else {
        otherJobs = [];
        if (otherResult.status === "rejected") {
          console.error("Other source jobs failed:", otherResult.reason);
        }
      }

      allJobs = firmHireJobs.concat(otherJobs);
      jobsLoaded = true;

      if (!allJobs.length) {
        clearJobLists();
        setStatus(
          "Unable to load openings right now. Please try again later.",
          true
        );
        return;
      }

      populateCategoryFilter(allJobs);
      applyFilter();
    } catch (err) {
      console.error(err);
      firmHireJobs = [];
      otherJobs = [];
      allJobs = [];
      clearJobLists();
      setStatus(
        "Unable to load openings right now. Please try again later.",
        true
      );
    } finally {
      jobsLoading = false;
    }
  }

  function openPanel() {
    body.classList.add("fh-candidates-open");
    panel.setAttribute("aria-hidden", "false");
    openBtn.setAttribute("aria-expanded", "true");
    loadJobs();
  }

  function closePanel() {
    hideJobDetailPopover(0);
    closeCategoryPanel();
    body.classList.remove("fh-candidates-open");
    panel.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("aria-expanded", "false");
  }

  function togglePanel() {
    if (body.classList.contains("fh-candidates-open")) closePanel();
    else openPanel();
  }

  openBtn.addEventListener("click", togglePanel);
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  if (backdrop) backdrop.addEventListener("click", closePanel);

  if (msToggleEl) {
    msToggleEl.addEventListener("click", function () {
      if (isCategoryPanelOpen()) closeCategoryPanel();
      else openCategoryPanel();
    });
  }

  if (msClearEl) {
    msClearEl.addEventListener("click", function () {
      selectedCategory = null;
      renderCategoryOptions();
      updateCategoryLabel();
      applyFilter();
    });
  }

  if (msApplyEl) {
    msApplyEl.addEventListener("click", function () {
      closeCategoryPanel();
    });
  }

  document.addEventListener("click", function (e) {
    if (
      categoryMultiselectEl &&
      isCategoryPanelOpen() &&
      !categoryMultiselectEl.contains(e.target)
    ) {
      closeCategoryPanel();
    }
  });

  if (detailPopoverEl) {
    detailPopoverEl.addEventListener("mouseenter", function () {
      popoverSelfHovered = true;
      clearTimeout(popoverHideTimer);
    });
    detailPopoverEl.addEventListener("mouseleave", function () {
      popoverSelfHovered = false;
      scheduleHidePopover();
    });
  }

  function onJobListScroll() {
    if (popoverAnchor) positionDetailPopover(popoverAnchor);
  }

  firmHireListEl.addEventListener("scroll", onJobListScroll);
  otherListEl.addEventListener("scroll", onJobListScroll);

  window.addEventListener(
    "resize",
    function () {
      if (popoverAnchor) positionDetailPopover(popoverAnchor);
    },
    { passive: true }
  );

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (isCategoryPanelOpen()) {
      closeCategoryPanel();
      return;
    }
    if (body.classList.contains("fh-candidates-open")) {
      closePanel();
    }
  });
})();
