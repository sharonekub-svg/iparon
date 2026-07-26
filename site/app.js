/*
 * שינון — הלוגיקה של אתר הנחיתה.
 * בלי תלויות: הכרטיסייה, הקוויז והשאלות הנפוצות הם התוכן האמיתי של המוצר,
 * ולכן הם עובדים באמת בדף ולא מוצגים כצילום מסך.
 */
(function () {
  'use strict';

  var CARDS = [
    { q: 'מהי יחידת הבסיס של מערכת העצבים?', a: 'הנוירון' },
    { q: 'מה תפקיד המיאלין?', a: 'מבודד את האקסון ומאיץ את הולכת האות' },
    { q: 'מהם שני חלקי מערכת העצבים?', a: 'מערכת העצבים המרכזית ומערכת העצבים ההיקפית' },
    { q: 'מה מעביר האקסון?', a: 'אותות חשמליים אל הסינפסה' },
  ];

  var QUIZ = [
    {
      q: 'איזה חלק של הנוירון מעביר את האות אל התא הבא?',
      options: ['דנדריט', 'אקסון', 'גרעין', 'ממברנה'],
      answer: 1,
    },
    {
      q: 'ממה מורכבים המוח וחוט השדרה?',
      options: [
        'מערכת העצבים ההיקפית',
        'הסינפסה',
        'מערכת העצבים המרכזית',
        'מערכת העצבים האוטונומית',
      ],
      answer: 2,
    },
    {
      q: 'מה תפקיד המיאלין?',
      options: [
        'מייצר נוירונים חדשים',
        'מעביר דם לתא',
        'מחבר בין שני חוטי שדרה',
        'מבודד את האקסון ומאיץ את ההולכה',
      ],
      answer: 3,
    },
  ];

  var FAQ = [
    {
      q: 'האם זה חינם?',
      a: 'כן. שינון חינמי בשלב הזה. בעתיד יתווספו תכונות בתשלום, אבל הבסיס יישאר פתוח.',
    },
    {
      q: 'האם זה עובד עם כתב יד?',
      a: 'כן. מצלמים דף כתוב ביד, והמערכת קוראת אותו כמו טקסט מודפס. היא לא ממירה את הדף לטקסט — היא רואה אותו.',
    },
    {
      q: 'האם זה מתאים לחומר של הבגרות?',
      a: 'כן. שינון מזהה מבנה של פרקי לימוד ומתאים את הסיכום והשאלות לרמת בגרות.',
    },
    {
      q: 'אילו סוגי קבצים אפשר להעלות?',
      a: 'PDF, תמונה, וצילום שצילמתם עכשיו במצלמה.',
    },
    {
      q: 'האם המערכת ממציאה תשובות?',
      a: 'המערכת עובדת רק מהחומר שהעליתם. אם משהו לא ברור בדף המקורי, היא מדלגת עליו במקום לנחש.',
    },
    {
      q: 'יש אפליקציה לטלפון?',
      a: 'כן, זה המוצר עצמו — אפליקציה לאייפון ולאנדרואיד. הדף הזה הוא רשימת ההמתנה אליה.',
    },
  ];

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  // ── רשימת המתנה ───────────────────────────────────────────────────
  // אין כאן backend. השליחה נעצרת ומציגה אישור, כדי שהדף לא יבטיח
  // הרשמה שלא קרתה. חיבור לספק דיוור נכנס כאן.
  each(document.querySelectorAll('[data-waitlist]'), function (form) {
    var wrap = form.parentNode;
    var done = wrap.querySelector('[data-waitlist-done]');
    var error = wrap.querySelector('[data-waitlist-error]');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = form.querySelector('input[type="email"]').value.trim();

      if (!EMAIL.test(value)) {
        error.hidden = false;
        return;
      }

      error.hidden = true;
      form.hidden = true;
      done.hidden = false;
    });
  });

  // ── כרטיסייה ──────────────────────────────────────────────────────
  var cardEl = document.querySelector('[data-card]');
  if (cardEl) {
    var cardTextEl = document.querySelector('[data-card-text]');
    var cardPosEl = document.querySelector('[data-card-pos]');
    var cardFlipEl = document.querySelector('[data-card-flip]');
    var cardNextEl = document.querySelector('[data-card-next]');
    var cardIndex = 0;
    var flipped = false;

    function renderCard() {
      var card = CARDS[cardIndex];
      cardTextEl.textContent = flipped ? card.a : card.q;
      cardPosEl.textContent = cardIndex + 1 + '/' + CARDS.length;
      cardFlipEl.textContent = flipped ? 'חזרה לשאלה' : 'הצג תשובה';
    }

    function flip() {
      flipped = !flipped;
      renderCard();
    }

    cardEl.addEventListener('click', flip);
    cardFlipEl.addEventListener('click', flip);
    cardNextEl.addEventListener('click', function () {
      cardIndex = (cardIndex + 1) % CARDS.length;
      flipped = false;
      renderCard();
    });

    renderCard();
  }

  // ── קוויז ─────────────────────────────────────────────────────────
  var quizEl = document.querySelector('[data-quiz]');
  if (quizEl) {
    var quizDoneEl = document.querySelector('[data-quiz-done]');
    var questionEl = document.querySelector('[data-quiz-question]');
    var optionsEl = document.querySelector('[data-quiz-options]');
    var posEl = document.querySelector('[data-quiz-pos]');
    var nextWrapEl = document.querySelector('[data-quiz-next-wrap]');
    var nextEl = document.querySelector('[data-quiz-next]');
    var scoreEl = document.querySelector('[data-quiz-score]');
    var restartEl = document.querySelector('[data-quiz-restart]');

    var quizIndex = 0;
    var score = 0;
    var answered = false;

    function renderQuiz() {
      var question = QUIZ[quizIndex];
      var isLast = quizIndex === QUIZ.length - 1;

      posEl.textContent = quizIndex + 1 + '/' + QUIZ.length;
      questionEl.textContent = question.q;
      nextWrapEl.hidden = true;
      nextEl.textContent = isLast ? 'לתוצאה' : 'השאלה הבאה';
      optionsEl.textContent = '';

      question.options.forEach(function (text, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-option';
        button.textContent = text;
        button.addEventListener('click', function () {
          if (answered) {
            return;
          }
          answered = true;
          if (index === question.answer) {
            score += 1;
          }

          each(optionsEl.children, function (option, optionIndex) {
            option.disabled = true;
            if (optionIndex === question.answer) {
              option.classList.add('is-correct');
            } else if (optionIndex === index) {
              option.classList.add('is-chosen');
            } else {
              option.classList.add('is-dimmed');
            }
          });

          nextWrapEl.hidden = false;
        });
        optionsEl.appendChild(button);
      });
    }

    nextEl.addEventListener('click', function () {
      if (quizIndex === QUIZ.length - 1) {
        scoreEl.textContent = score + ' מתוך ' + QUIZ.length;
        quizEl.hidden = true;
        quizDoneEl.hidden = false;
        return;
      }
      quizIndex += 1;
      answered = false;
      renderQuiz();
    });

    restartEl.addEventListener('click', function () {
      quizIndex = 0;
      score = 0;
      answered = false;
      quizDoneEl.hidden = true;
      quizEl.hidden = false;
      renderQuiz();
    });

    renderQuiz();
  }

  // ── שאלות נפוצות ──────────────────────────────────────────────────
  var faqEl = document.querySelector('[data-faq]');
  if (faqEl) {
    FAQ.forEach(function (item, index) {
      var wrap = document.createElement('div');
      wrap.className = 'faq-item';

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'faq-question';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'faq-answer-' + index);

      var label = document.createElement('span');
      label.textContent = item.q;

      var marker = document.createElement('span');
      marker.className = 'faq-marker';
      marker.textContent = '+';

      button.appendChild(label);
      button.appendChild(marker);

      var answer = document.createElement('p');
      answer.className = 'faq-answer';
      answer.id = 'faq-answer-' + index;
      answer.textContent = item.a;
      answer.hidden = true;

      button.addEventListener('click', function () {
        var open = answer.hidden;

        // אקורדיון: פתיחה של שאלה סוגרת את האחרות
        each(faqEl.querySelectorAll('.faq-answer'), function (other) {
          other.hidden = true;
        });
        each(faqEl.querySelectorAll('.faq-marker'), function (other) {
          other.textContent = '+';
        });
        each(faqEl.querySelectorAll('.faq-question'), function (other) {
          other.setAttribute('aria-expanded', 'false');
        });

        if (open) {
          answer.hidden = false;
          marker.textContent = '—';
          button.setAttribute('aria-expanded', 'true');
        }
      });

      wrap.appendChild(button);
      wrap.appendChild(answer);
      faqEl.appendChild(wrap);
    });
  }

  var yearEl = document.querySelector('[data-year]');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
