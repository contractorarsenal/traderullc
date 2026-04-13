const STORAGE_KEY = "traderu-llc-agreement";

const defaultState = {
  meta: {
    flowVersion: 1,
    started: false,
  },
  profile: {
    fullName: "",
    email: "",
    discordName: "",
    signature: "",
    signedDate: "",
  },
  documents: {
    terms: {
      read: false,
      readAt: "",
    },
    privacy: {
      read: false,
      readAt: "",
    },
    returns: {
      read: false,
      readAt: "",
    },
  },
  finalAgreement: {
    agreed: false,
    agreedAt: "",
  },
};

function cloneDefaults(value) {
  return JSON.parse(JSON.stringify(value));
}

function clearLegacyStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage access failures.
  }
}

function loadState() {
  try {
    clearLegacyStorage();
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return cloneDefaults(defaultState);
    }

    const parsed = JSON.parse(saved);
    return {
      ...cloneDefaults(defaultState),
      ...parsed,
      meta: {
        ...cloneDefaults(defaultState.meta),
        ...(parsed.meta || {}),
      },
      profile: {
        ...cloneDefaults(defaultState.profile),
        ...(parsed.profile || {}),
      },
      documents: {
        terms: {
          ...cloneDefaults(defaultState.documents.terms),
          ...(parsed.documents?.terms || {}),
        },
        privacy: {
          ...cloneDefaults(defaultState.documents.privacy),
          ...(parsed.documents?.privacy || {}),
        },
        returns: {
          ...cloneDefaults(defaultState.documents.returns),
          ...(parsed.documents?.returns || {}),
        },
      },
      finalAgreement: {
        ...cloneDefaults(defaultState.finalAgreement),
        ...(parsed.finalAgreement || {}),
      },
    };
  } catch (error) {
    return cloneDefaults(defaultState);
  }
}

function saveState(state) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function allDocumentsComplete(state) {
  return ["terms", "privacy", "returns"].every((key) => state.documents[key]?.read);
}

function resetWorkflow(state) {
  state.documents = cloneDefaults(defaultState.documents);
  state.finalAgreement = cloneDefaults(defaultState.finalAgreement);
  state.meta.started = true;
  saveState(state);
}

function requiredDocsForTarget(target) {
  if (target === "privacy") {
    return ["terms"];
  }

  if (target === "returns") {
    return ["terms", "privacy"];
  }

  if (target === "contact") {
    return ["terms", "privacy", "returns"];
  }

  return [];
}

function docsAreComplete(state, docs) {
  return docs.every((key) => state.documents[key]?.read);
}

function firstRequiredPage(state, target) {
  if (target !== "terms" && !state.meta.started) {
    return "terms.html";
  }

  const requiredDocs = requiredDocsForTarget(target);
  const firstMissing = requiredDocs.find((key) => !state.documents[key]?.read);
  return firstMissing ? `${firstMissing}.html` : null;
}

function markDocumentRead(state, docKey) {
  if (!state.documents[docKey]) {
    return;
  }

  if (!state.documents[docKey].read) {
    state.documents[docKey].read = true;
    state.documents[docKey].readAt = new Date().toISOString();
    saveState(state);
  }
}

function setFormMessage(node, message, type = "") {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.classList.remove("is-success", "is-error");

  if (type === "success") {
    node.classList.add("is-success");
  }

  if (type === "error") {
    node.classList.add("is-error");
  }
}

function updateStatusPills(state) {
  const mapping = {
    terms: state.documents.terms.read,
    privacy: state.documents.privacy.read,
    returns: state.documents.returns.read,
    final: state.finalAgreement.agreed,
  };

  Object.entries(mapping).forEach(([key, done]) => {
    const pills = document.querySelectorAll(`[data-status-pill="${key}"]`);
    pills.forEach((pill) => {
      pill.textContent = done ? "Complete" : "Pending";
      pill.classList.toggle("is-complete", done);
    });
  });
}

function initAnnouncementBar() {
  const timeframeNode = document.querySelector("[data-current-timeframe]");
  const monthNode = document.querySelector("[data-current-month]");
  const deadlineNode = document.querySelector("[data-deadline]");

  if (!timeframeNode || !monthNode || !deadlineNode) {
    return;
  }

  const today = new Date();
  const day = today.getDate();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const timeframe = day <= 10 ? "early" : day <= 20 ? "mid" : "late";
  const deadlineDate = new Date(today);
  deadlineDate.setDate(deadlineDate.getDate() + 60);

  const milestoneDay = deadlineDate.getDate() <= 10 ? 1 : deadlineDate.getDate() <= 20 ? 15 : 30;

  function ordinal(number) {
    if (number % 100 >= 11 && number % 100 <= 13) {
      return `${number}th`;
    }

    const remainder = number % 10;
    if (remainder === 1) {
      return `${number}st`;
    }
    if (remainder === 2) {
      return `${number}nd`;
    }
    if (remainder === 3) {
      return `${number}rd`;
    }

    return `${number}th`;
  }

  timeframeNode.textContent = timeframe;
  monthNode.textContent = months[today.getMonth()];
  deadlineNode.textContent = `${months[deadlineDate.getMonth()]} ${ordinal(milestoneDay)}`;
}

function initReadGatePages(state) {
  const documents = document.querySelectorAll("[data-reading-doc]");

  documents.forEach((content) => {
    const docKey = content.dataset.readingDoc;
    const readStatus = document.querySelector(`[data-read-status="${docKey}"]`);
    const continueButton = document.querySelector(`[data-read-continue="${docKey}"]`);

    if (!docKey || !state.documents[docKey]) {
      return;
    }

    function updateReadUI() {
      const unlocked = Boolean(state.documents[docKey]?.read);

      if (continueButton) {
        continueButton.disabled = !unlocked;
      }

      if (!readStatus) {
        return;
      }

      if (unlocked) {
        const nextLabel = continueButton?.dataset.nextLabel || "the next page";
        readStatus.textContent = `Reading complete. Continue to ${nextLabel}.`;
        readStatus.classList.add("is-success");
      } else {
        readStatus.textContent = "Scroll to the bottom of this page to unlock the continue button.";
        readStatus.classList.remove("is-success");
      }
    }

    function maybeUnlockReading() {
      if (state.documents[docKey]?.read) {
        updateReadUI();
        return;
      }

      const scrollBottom = window.scrollY + window.innerHeight;
      const pageBottom = document.documentElement.scrollHeight;
      const maxScroll = pageBottom - window.innerHeight;
      const canScroll = maxScroll > 40;
      const reachedBottom = scrollBottom >= pageBottom - 28;

      if ((canScroll && reachedBottom) || (!canScroll && content.scrollHeight <= window.innerHeight)) {
        markDocumentRead(state, docKey);
        updateReadUI();
        updateStatusPills(state);
        window.removeEventListener("scroll", maybeUnlockReading);
        window.removeEventListener("resize", maybeUnlockReading);
      }
    }

    updateReadUI();
    maybeUnlockReading();
    window.addEventListener("scroll", maybeUnlockReading, { passive: true });
    window.addEventListener("resize", maybeUnlockReading);

    if (continueButton) {
      continueButton.addEventListener("click", () => {
        if (continueButton.disabled) {
          return;
        }

        const nextHref = continueButton.dataset.nextHref;
        if (nextHref) {
          window.location.href = nextHref;
        }
      });
    }
  });
}

function initGatedNavigation(state) {
  const currentPage = document.body.dataset.page;
  const navLinks = document.querySelectorAll(".subpage-nav a[data-gate-target]");

  navLinks.forEach((link) => {
    const target = link.dataset.gateTarget;
    const unlocked = docsAreComplete(state, requiredDocsForTarget(target));
    const isCurrent = link.getAttribute("aria-current") === "page";

    if (!unlocked && !isCurrent) {
      link.setAttribute("aria-disabled", "true");
      link.title = "Finish the earlier pages first.";
    } else {
      link.removeAttribute("aria-disabled");
      link.removeAttribute("title");
    }

    link.addEventListener("click", (event) => {
      if (link.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
      }
    });
  });

  if (!currentPage) {
    return false;
  }

  const redirectTarget = firstRequiredPage(state, currentPage);
  if (redirectTarget) {
    window.location.replace(redirectTarget);
    return true;
  }

  return false;
}

function buildJoinMessage(state) {
  return [
    "The visitor confirmed they read the Terms, Privacy Policy, and Returns Policy.",
    "They understand the community rules, confidentiality expectations, and competing-community restriction.",
    `Terms complete: ${state.documents.terms.read ? "yes" : "no"}.`,
    `Privacy complete: ${state.documents.privacy.read ? "yes" : "no"}.`,
    `Returns complete: ${state.documents.returns.read ? "yes" : "no"}.`,
  ].join(" ");
}

function initFinalJoinPopup(state) {
  const openButton = document.querySelector("[data-open-join-form]");
  const gateStatus = document.querySelector("[data-final-gate-status]");
  const modal = document.querySelector("[data-join-modal]");
  const closeButtons = document.querySelectorAll("[data-close-join-modal]");
  const joinForm = document.querySelector("[data-join-form]");
  const submitStatus = document.querySelector("[data-join-submit-status]");
  const successBlock = document.querySelector("[data-join-success]");
  const successMessage = document.querySelector("[data-join-success-message]");
  let closeAfterSuccessTimer = 0;
  let autoOpened = false;
  let showingSuccess = false;

  if (!openButton || !gateStatus || !modal || !joinForm) {
    return;
  }

  const formName = joinForm.querySelector('[name="name"]');
  const formEmail = joinForm.querySelector('[name="email"]');
  const formDiscord = joinForm.querySelector('[name="discord_name"]');
  const formSignature = joinForm.querySelector('[name="signature"]');
  const formSignedDate = joinForm.querySelector('[name="signed_date"]');
  const hiddenTerms = joinForm.querySelector('[name="terms_completed"]');
  const hiddenPrivacy = joinForm.querySelector('[name="privacy_completed"]');
  const hiddenReturns = joinForm.querySelector('[name="returns_completed"]');
  const hiddenMessage = joinForm.querySelector('[name="message"]');
  const submitButton = joinForm.querySelector('button[type="submit"]');

  function populateJoinForm() {
    if (formName) {
      formName.value = "";
    }

    if (formEmail) {
      formEmail.value = "";
    }

    if (formDiscord) {
      formDiscord.value = "";
    }

    if (formSignature) {
      formSignature.value = "";
    }

    if (formSignedDate) {
      formSignedDate.value = todayValue();
    }

    if (hiddenTerms) {
      hiddenTerms.value = state.documents.terms.read ? "yes" : "no";
    }

    if (hiddenPrivacy) {
      hiddenPrivacy.value = state.documents.privacy.read ? "yes" : "no";
    }

    if (hiddenReturns) {
      hiddenReturns.value = state.documents.returns.read ? "yes" : "no";
    }

    if (hiddenMessage) {
      hiddenMessage.value = buildJoinMessage(state);
    }
  }

  function syncSuccessState() {
    if (joinForm) {
      joinForm.hidden = showingSuccess;
    }

    if (successBlock) {
      successBlock.hidden = !showingSuccess;
    }

    if (successMessage && showingSuccess) {
      successMessage.textContent = "Your confirmation was sent successfully. Go back to Discord and get started.";
    }
  }

  function updateGateUI() {
    const docsDone = allDocumentsComplete(state);

    openButton.textContent = "Open final form";
    openButton.disabled = !docsDone;

    if (!docsDone) {
      gateStatus.textContent = "Read Terms, Privacy, and Returns all the way through before opening the final form.";
      gateStatus.classList.remove("is-success");
      return;
    }

    gateStatus.textContent = "All required pages are complete. The final form is ready.";
    gateStatus.classList.add("is-success");
  }

  function openModal() {
    if (openButton.disabled) {
      return;
    }

    showingSuccess = false;
    populateJoinForm();
    syncSuccessState();
    setFormMessage(submitStatus, "");
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    showingSuccess = false;
    syncSuccessState();
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  updateGateUI();
  showingSuccess = false;
  syncSuccessState();

  if (allDocumentsComplete(state) && !state.finalAgreement.agreed && !autoOpened) {
    autoOpened = true;
    openModal();
  }

  openButton.addEventListener("click", openModal);
  closeButtons.forEach((button) => button.addEventListener("click", closeModal));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  joinForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!allDocumentsComplete(state)) {
      setFormMessage(submitStatus, "Read Terms, Privacy, and Returns before submitting the final form.", "error");
      updateGateUI();
      return;
    }

    if (!joinForm.reportValidity()) {
      setFormMessage(submitStatus, "Please complete every required field before submitting.", "error");
      return;
    }

    const data = new FormData(joinForm);
    state.profile.fullName = String(data.get("name") || "").trim();
    state.profile.email = String(data.get("email") || "").trim();
    state.profile.discordName = String(data.get("discord_name") || "").trim();
    state.profile.signature = String(data.get("signature") || "").trim();
    state.profile.signedDate = String(data.get("signed_date") || "").trim();

    data.set("terms_completed", state.documents.terms.read ? "yes" : "no");
    data.set("privacy_completed", state.documents.privacy.read ? "yes" : "no");
    data.set("returns_completed", state.documents.returns.read ? "yes" : "no");
    data.set("message", buildJoinMessage(state));

    if (submitButton) {
      submitButton.disabled = true;
    }

    setFormMessage(submitStatus, "Sending confirmation...", "");

    try {
      const response = await fetch(joinForm.action, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: data,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        throw new Error(result.message || "The form could not be submitted right now.");
      }

      state.finalAgreement.agreed = true;
      state.finalAgreement.agreedAt = new Date().toISOString();
      saveState(state);
      updateStatusPills(state);
      updateGateUI();
      showingSuccess = true;
      syncSuccessState();
      setFormMessage(submitStatus, "");
      window.clearTimeout(closeAfterSuccessTimer);
      closeAfterSuccessTimer = window.setTimeout(() => {
        closeModal();
      }, 2200);
    } catch (error) {
      setFormMessage(
        submitStatus,
        error instanceof Error ? error.message : "The form could not be submitted right now.",
        "error",
      );
    } finally {
      if (submitButton && !state.finalAgreement.agreed) {
        submitButton.disabled = false;
      }
    }
  });
}

function initHomeHeroShader() {
  const canvas = document.querySelector("[data-hero-canvas]");
  if (!canvas) {
    return;
  }

  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false });
  if (!gl) {
    return;
  }

  const vertexSource = `#version 300 es
  precision highp float;
  in vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  out vec4 O;
  uniform vec2 resolution;
  uniform float time;
  #define FC gl_FragCoord.xy
  #define T time
  #define R resolution

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float noise1(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), u);
  }

  float rectMask(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return 1.0 - smoothstep(0.0, 0.003, max(d.x, d.y));
  }

  float lineMask(float d, float w) {
    return 1.0 - smoothstep(w, w + 0.0025, abs(d));
  }

  float segMask(float x, float a, float b, float blur) {
    return smoothstep(a - blur, a + blur, x) * (1.0 - smoothstep(b - blur, b + blur, x));
  }

  vec3 bullishColor() { return vec3(0.16, 0.85, 0.58); }
  vec3 bearishColor() { return vec3(0.95, 0.36, 0.40); }

  float baseSeries(float idx) {
    float p = fract(idx / 52.0);
    float y = 0.0;

    if (p < 0.10) {
      float k = p / 0.10;
      y = mix(0.07, 0.18, k);
    } else if (p < 0.26) {
      float k = (p - 0.10) / 0.16;
      y = mix(0.18, 0.86, k) + sin(k * 10.0) * 0.05;
    } else if (p < 0.37) {
      float k = (p - 0.26) / 0.11;
      y = mix(0.86, 0.62, k) + sin(k * 18.0) * 0.08;
    } else if (p < 0.48) {
      float k = (p - 0.37) / 0.11;
      y = mix(0.62, 0.15, k);
    } else {
      float k = (p - 0.48) / 0.52;
      y = 0.14 + sin(k * 14.0) * 0.012 + sin(k * 31.0) * 0.006;
    }

    y += (noise1(idx * 0.73) - 0.5) * 0.028;
    return clamp(y, 0.05, 0.95);
  }

  void candleData(float idx, out float openY, out float closeY, out float lowY, out float highY) {
    openY = baseSeries(idx);
    closeY = baseSeries(idx + 1.0);

    float wickUp = 0.01 + noise1(idx * 1.91 + 7.0) * 0.06;
    float wickDn = 0.01 + noise1(idx * 2.17 + 13.0) * 0.05;
    float spike = step(0.92, noise1(idx * 0.37 + 21.0)) * 0.08;

    highY = min(max(openY, closeY) + wickUp + spike, 0.98);
    lowY = max(min(openY, closeY) - wickDn, 0.04);
  }

  void main() {
    vec2 uv = FC / R;
    vec3 col = vec3(0.105, 0.11, 0.125);

    vec2 cv = uv - 0.5;
    col *= 1.0 - dot(cv, cv) * 0.28;

    float gx = 1.0 - smoothstep(0.485, 0.5, abs(fract(uv.x * 9.0) - 0.5));
    float gy = 1.0 - smoothstep(0.485, 0.5, abs(fract(uv.y * 4.5) - 0.5));
    col += vec3(0.10) * (gx * 0.45 + gy * 0.45);

    float dashV = step(0.55, fract(uv.y * 22.0));
    float dashH = step(0.55, fract(uv.x * 34.0));
    float guideV = lineMask(uv.x - 0.57, 0.0015) * dashV;
    float guideH = lineMask(uv.y - 0.36, 0.0015) * dashH;
    col += vec3(0.72) * guideV * 0.7;
    col += vec3(0.72) * guideH * 0.7;

    float candleCount = 42.0;
    float scroll = T * 1.65;
    float xScaled = uv.x * candleCount + scroll;
    float idx = floor(xScaled);
    float fx = fract(xScaled);

    float openY, closeY, lowY, highY;
    candleData(idx, openY, closeY, lowY, highY);

    bool bull = closeY >= openY;
    vec3 candleCol = bull ? bullishColor() : bearishColor();

    float bodyTop = max(openY, closeY);
    float bodyBot = min(openY, closeY);
    float bodyMid = 0.5 * (bodyTop + bodyBot);
    float bodyHalf = max((bodyTop - bodyBot) * 0.5, 0.004);

    float wickX = lineMask(fx - 0.5, 0.018);
    float wickY = segMask(uv.y, lowY, highY, 0.0015);
    float wick = wickX * wickY;

    vec2 bodyP = vec2(fx - 0.5, uv.y - bodyMid);
    float body = rectMask(bodyP, vec2(0.28, bodyHalf));

    col += candleCol * wick * 1.0;
    col += candleCol * body * 1.35;

    float bodyGlow = rectMask(bodyP, vec2(0.34, bodyHalf + 0.006));
    col += candleCol * bodyGlow * 0.10;

    float vol = abs(closeY - openY) * 1.8 + (highY - lowY) * 0.35;
    float volH = clamp(vol * 0.18, 0.01, 0.11);
    float volBar = rectMask(vec2(fx - 0.5, uv.y - (0.02 + volH * 0.5)), vec2(0.30, volH * 0.5));
    col += candleCol * volBar * 0.35;

    float ro, rc, rl, rh;
    candleData(floor(scroll + candleCount - 1.0), ro, rc, rl, rh);
    float livePrice = rc;
    float dots = step(0.45, fract(uv.x * 180.0));
    float priceLine = lineMask(uv.y - livePrice, 0.0015) * dots;
    vec3 liveLineColor = rc >= ro
      ? bullishColor() * 1.15
      : bearishColor() * 1.15;
    col += liveLineColor * priceLine * 0.95;
    col += liveLineColor * lineMask(uv.y - livePrice, 0.004) * 0.10;

    float shimmer = sin(uv.x * 12.0 + T * 1.4) * 0.5 + 0.5;
    col *= 0.985 + shimmer * 0.015;

    O = vec4(col, 1.0);
  }`;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    return;
  }

  const program = gl.createProgram();
  if (!program) {
    return;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const position = gl.getAttribLocation(program, "position");
  const resolution = gl.getUniformLocation(program, "resolution");
  const time = gl.getUniformLocation(program, "time");

  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);

  function resize() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio, 1.5));
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(now) {
    resize();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, now * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    window.requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  window.requestAnimationFrame(render);
}

document.addEventListener("DOMContentLoaded", () => {
  const state = loadState();
  const currentPage = document.body.dataset.page;

  if (currentPage === "terms") {
    resetWorkflow(state);
  }

  if (initGatedNavigation(state)) {
    return;
  }
  initAnnouncementBar();
  initHomeHeroShader();
  updateStatusPills(state);
  initReadGatePages(state);
  initFinalJoinPopup(state);
});
