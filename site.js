(function () {
  // Button shimmer — drives --btn-shimmer-pos on :root so every .btn stays in sync
  // regardless of when it was inserted into the DOM.
  (function () {
    var PERIOD = 5000; // ms for one full oscillation
    function step(timestamp) {
      var t = (timestamp % PERIOD) / PERIOD;
      // Sine wave: slow at edges (0%, 100%), fast through the middle
      var pos = ((1 - Math.cos(2 * Math.PI * t)) / 2 * 100).toFixed(2);
      document.documentElement.style.setProperty('--btn-shimmer-pos', pos + '% 0%');
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  })();

  function initNav(nav) {
    const navLinksWrap = nav.querySelector('.nav__links');
    const toggleBtn = nav.querySelector('.nav__toggle');
    const links = Array.from(nav.querySelectorAll('.nav__link'));
    if (!links.length) return;

    // Determine active link based on current path
    const current = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    let active = null;
    links.forEach((link) => {
      const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
      if (!active && (href === current || (current === '' && (href === '' || href === 'index.html')))) {
        active = link;
      }
    });
    if (!active) active = links[0];
    links.forEach((l) => {
      const isActive = l === active;
      l.classList.toggle('nav__link--active', isActive);
      if (isActive) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });

    const bubble = document.createElement('span');
    bubble.className = 'nav__bubble';
    (navLinksWrap || nav).appendChild(bubble);
    nav.classList.add('has-bubble');

    let activeLink = active;
    let animating = false;

    const setBubblePosition = (el) => {
      if (!el) return;
      const parentRect = bubble.parentElement ? bubble.parentElement.getBoundingClientRect() : nav.getBoundingClientRect();
      const linkRect = el.getBoundingClientRect();

      const left = Math.round(linkRect.left - parentRect.left);
      const top = Math.round(linkRect.top - parentRect.top);
      const width = Math.round(linkRect.width);
      const height = Math.round(linkRect.height);

      bubble.style.setProperty('--bubble-left', `${left}px`);
      bubble.style.setProperty('--bubble-top', `${top}px`);
      bubble.style.setProperty('--bubble-width', `${width}px`);
      bubble.style.setProperty('--bubble-height', `${height}px`);
    };

    if (activeLink) {
      setBubblePosition(activeLink);
      requestAnimationFrame(() => bubble.classList.add('is-visible'));
    }

    window.addEventListener('pageshow', () => {
      if (!activeLink) return;
      setBubblePosition(activeLink);
      bubble.classList.add('is-visible');
    });

    if (toggleBtn && navLinksWrap) {
      const closeMenu = () => {
        toggleBtn.setAttribute('aria-expanded', 'false');
        navLinksWrap.classList.remove('nav__links--open');
      };

      toggleBtn.addEventListener('click', () => {
        const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        const newState = !expanded;
        toggleBtn.setAttribute('aria-expanded', String(newState));
        navLinksWrap.classList.toggle('nav__links--open', newState);
        if (newState && activeLink) {
          setTimeout(() => setBubblePosition(activeLink), 10);
        }
      });

      links.forEach(link => {
        link.addEventListener('click', () => {
          if (window.matchMedia('(max-width: 720px)').matches) {
            closeMenu();
          }
        });
      });

      window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 720px)').matches) {
          toggleBtn.setAttribute('aria-expanded', 'false');
          navLinksWrap.classList.remove('nav__links--open');
        }
      });
    }

    const shrinkDuration = 160;
    const totalDuration = 460;

    const animateTo = (target, callback) => {
      if (!target || animating) {
        if (typeof callback === 'function') callback();
        return;
      }

      animating = true;
      nav.classList.add('is-animating');
      bubble.classList.add('is-shrinking');

      setTimeout(() => {
        setBubblePosition(target);
        activeLink = target;

        setTimeout(() => {
          bubble.classList.remove('is-shrinking');
        }, 40);
      }, shrinkDuration);

      setTimeout(() => {
        nav.classList.remove('is-animating');
        animating = false;
        if (typeof callback === 'function') callback();
      }, totalDuration);
    };

    const handleNavigation = (link) => {
      animateTo(link, () => {
        window.location.assign(link.href);
      });
    };

    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        if (
          link === activeLink ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        handleNavigation(link);
      });

      link.addEventListener('mouseenter', () => {
        if (animating) return;
        setBubblePosition(link);
      });
    });

    nav.addEventListener('mouseleave', () => {
      if (animating || !activeLink) return;
      setBubblePosition(activeLink);
    });

    nav.addEventListener('focusin', (event) => {
      const target = event.target;
      if (target && target.classList.contains('nav__link')) {
        setBubblePosition(target);
      }
    });

    nav.addEventListener('focusout', () => {
      if (!nav.contains(document.activeElement) && activeLink && !animating) {
        setBubblePosition(activeLink);
      }
    });

    window.addEventListener('resize', () => {
      if (animating || !activeLink) return;
      setBubblePosition(activeLink);
    });
  }

  function loadHeaderIfNeeded() {
    const existing = document.querySelector('.nav');
    if (existing) return Promise.resolve(existing);
    const placeholder = document.getElementById('site-nav');
    if (!placeholder) return Promise.resolve(null);
    if (window.__lightsmithHeaderLoading || window.__lightsmithHeaderLoaded) {
      return new Promise(function(resolve){
        var tries = 0;
        (function waitForNav(){
          var nav = document.querySelector('.nav');
          if (nav || tries++ > 200) return resolve(nav || null);
          setTimeout(waitForNav, 20);
        })();
      });
    }
    window.__lightsmithHeaderLoading = true;
    return fetch('header.html')
      .then((r) => r.ok ? r.text() : Promise.reject(new Error('Failed to load header')))
      .then((html) => {
        placeholder.innerHTML = html;
        window.__lightsmithHeaderLoaded = true;
        return placeholder.querySelector('.nav') || document.querySelector('.nav');
      })
      .catch(() => null);
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadHeaderIfNeeded().then(function (nav) {
      if (!nav) return;
      initNav(nav);
    });

    // === Contact Form Handler (Web3Forms) ===
    const contactForm = document.getElementById("contactForm");
    if (contactForm) {
      contactForm.addEventListener("submit", async function(e) {
        e.preventDefault();

        const statusEl = document.getElementById("contactFormStatus");
        if (statusEl) {
          statusEl.classList.remove("is-hidden");
          statusEl.style.color = "#555";
          statusEl.textContent = "Sending…";
        }

        const formData = new FormData(contactForm);
        formData.append("access_key", "87b146f7-8582-4af4-bd4b-0bb3a25283ac");
        formData.append("from_name", formData.get("name") || "Website Visitor");
        formData.append("subject", "New message from " + (formData.get("name") || "contact form"));

        try {
          const res = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData
          });
          const data = await res.json();

          if (data.success) {
            window.location.href = "/thank-you.html";
          } else {
            if (statusEl) {
              statusEl.textContent = "Error: " + (data.message || "Unknown error");
              statusEl.style.color = "red";
            }
          }
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = "Submission failed. Please try again or call us at 208-614-3414.";
            statusEl.style.color = "red";
          }
        }
      });
    }
  });
})();
