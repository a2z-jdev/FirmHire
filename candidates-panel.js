(function () {
  var body = document.body;
  var openBtn = document.getElementById("fh-open-candidates");
  var closeBtn = document.getElementById("fh-close-candidates");
  var backdrop = document.getElementById("fh-candidates-backdrop");
  var panel = document.getElementById("fh-candidates-panel");
  var jobListEl = document.getElementById("fh-job-list");
  var jobCountEl = document.getElementById("fh-job-count");
  var jobEmptyEl = document.getElementById("fh-job-empty");
  var detailPopoverEl = document.getElementById("fh-job-detail-popover");
  var categoryMultiselectEl = document.getElementById("fh-category-multiselect");
  var msToggleEl = document.getElementById("fh-ms-toggle");
  var msLabelEl = document.getElementById("fh-ms-label");
  var msPanelEl = document.getElementById("fh-ms-panel");
  var msSearchEl = document.getElementById("fh-ms-search");
  var msOptionsEl = document.getElementById("fh-ms-options");
  var msClearEl = document.getElementById("fh-ms-clear");
  var msApplyEl = document.getElementById("fh-ms-apply");

  if (!openBtn || !panel || !jobListEl) return;

  var allJobs = [];
  var allCategories = [];
  var selectedCategories = new Set();
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
    if (source === "naukri") return "Naukri";
    if (source === "internshala") return "Internshala";
    return source || "Job board";
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
    if (jobCountEl) jobCountEl.textContent = message;
    if (jobEmptyEl) {
      jobEmptyEl.textContent = isEmpty ? message : "";
      jobEmptyEl.hidden = !isEmpty;
    }
  }

  function updateCategoryLabel() {
    if (!msLabelEl || !msToggleEl || !msClearEl) return;
    var count = selectedCategories.size;
    if (count === 0) {
      msLabelEl.textContent = "All Categories";
    } else if (count === 1) {
      msLabelEl.textContent = Array.from(selectedCategories)[0];
    } else {
      msLabelEl.textContent = count + " Categories Selected";
    }
    msToggleEl.classList.toggle("has-selection", count > 0);
    msClearEl.hidden = count === 0;
  }

  function renderCategoryOptions(filterText) {
    if (!msOptionsEl) return;
    var query = (filterText || "").trim().toLowerCase();
    var matches = allCategories.filter(function (cat) {
      return cat.toLowerCase().includes(query);
    });

    msOptionsEl.innerHTML = "";

    if (!matches.length) {
      msOptionsEl.innerHTML =
        '<p class="m-0 px-2 py-3 text-center text-xs text-slate-500">No categories found</p>';
      return;
    }

    matches.forEach(function (cat) {
      var option = document.createElement("label");
      option.className =
        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-blue-50" +
        (selectedCategories.has(cat) ? " bg-blue-50" : "");
      option.innerHTML =
        '<input type="checkbox" class="accent-blue-600" ' +
        (selectedCategories.has(cat) ? "checked" : "") +
        " /><span>" +
        escapeHtml(cat) +
        "</span>";

      var input = option.querySelector("input");
      input.addEventListener("change", function () {
        if (input.checked) selectedCategories.add(cat);
        else selectedCategories.delete(cat);
        option.classList.toggle("bg-blue-50", input.checked);
        updateCategoryLabel();
        applyFilter();
      });

      msOptionsEl.appendChild(option);
    });
  }

  function populateCategoryFilter(jobs) {
    var categories = new Set();
    jobs.forEach(function (job) {
      (job.category || []).forEach(function (cat) {
        if (cat) categories.add(cat);
      });
    });

    allCategories = Array.from(categories).sort(function (a, b) {
      return a.localeCompare(b);
    });

    Array.from(selectedCategories).forEach(function (sel) {
      if (!categories.has(sel)) selectedCategories.delete(sel);
    });

    renderCategoryOptions(msSearchEl ? msSearchEl.value : "");
    updateCategoryLabel();
  }

  function applyFilter() {
    var filtered = allJobs;
    if (selectedCategories.size > 0) {
      filtered = allJobs.filter(function (job) {
        return (job.category || []).some(function (cat) {
          return selectedCategories.has(cat);
        });
      });
    }
    renderJobs(filtered);
  }

  function openCategoryPanel() {
    if (!msPanelEl || !msToggleEl) return;
    msPanelEl.classList.remove("hidden");
    msPanelEl.classList.add("flex");
    msPanelEl.setAttribute("aria-hidden", "false");
    msToggleEl.setAttribute("aria-expanded", "true");
    renderCategoryOptions(msSearchEl ? msSearchEl.value : "");
    if (msSearchEl) msSearchEl.focus();
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

  function renderJobs(jobs) {
    hideJobDetailPopover(0);
    jobListEl.innerHTML = "";

    if (!jobs.length) {
      setStatus("No jobs match your filters", true);
      return;
    }

    setStatus(
      jobs.length + " opening" + (jobs.length === 1 ? "" : "s"),
      false
    );

    for (var i = 0; i < jobs.length; i++) {
      jobListEl.appendChild(renderJobCard(jobs[i]));
    }
  }

  async function loadJobs() {
    if (jobsLoaded || jobsLoading) return;
    jobsLoading = true;
    setStatus("Loading jobs…", false);
    jobListEl.innerHTML =
      '<p class="rounded-xl border border-slate-200 bg-white p-3.5 text-center text-sm text-slate-500 shadow-sm"><i class="fas fa-circle-notch fa-spin mr-1.5 text-blue-600"></i> Fetching openings…</p>';

    try {
      var res = await fetch(jobsApiUrl());
      if (!res.ok) throw new Error("Failed to fetch jobs (" + res.status + ")");
      var jobs = await res.json();
      if (!Array.isArray(jobs)) throw new Error("Unexpected jobs response");
      allJobs = jobs;
      jobsLoaded = true;
      populateCategoryFilter(allJobs);
      applyFilter();
    } catch (err) {
      console.error(err);
      allJobs = [];
      jobListEl.innerHTML = "";
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

  if (msSearchEl) {
    msSearchEl.addEventListener("input", function () {
      renderCategoryOptions(msSearchEl.value);
    });
  }

  if (msClearEl) {
    msClearEl.addEventListener("click", function () {
      selectedCategories.clear();
      renderCategoryOptions(msSearchEl ? msSearchEl.value : "");
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

  jobListEl.addEventListener("scroll", function () {
    if (popoverAnchor) positionDetailPopover(popoverAnchor);
  });

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
