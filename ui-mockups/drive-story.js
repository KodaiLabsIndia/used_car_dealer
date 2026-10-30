/* Scroll explores a sample journey. It never changes a car's business status. */
(() => {
  const story = document.getElementById('drive-story');
  if (!story) return;
  const scene = story.querySelector('.drive-scene');
  const car = document.getElementById('journey-car');
  const controls = document.getElementById('drive-stage-controls');
  const stages = [
    { label:'Inspect', kicker:'INSPECTION', title:'Look closer.<br>Know the car.', body:'A clear photo. A spoken note. Every check attached to the right car.' },
    { label:'Buy', kicker:'PURCHASE', title:'A good car.<br>A clear decision.', body:'Inspection findings, the agreed price, and handover documents come together before the purchase.' },
    { label:'Repair', kicker:'REFURBISHMENT', title:'Every fix.<br>Accounted for.', body:'The workshop, the person responsible, the part you’re waiting for. See what’s holding the car back.' },
    { label:'Ready', kicker:'FINAL CHECK', title:'Ready means<br>checked.', body:'Review the evidence, clear the remaining issues, and confirm the car is ready for its next owner.' },
    { label:'Deliver', kicker:'DELIVERY & WARRANTY', title:'Hand over.<br>Stay connected.', body:'The keys change hands. The car’s records, warranty commitments, and follow-ups stay connected.' },
  ];
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let active = -1;
  let frame = 0;
  let progress = 0;
  const clamp = value => Math.min(1, Math.max(0, value));
  const point = value => ({ x:60 + 880 * value, y:140 + 43 * Math.sin(2 * Math.PI * value) });
  const route = Array.from({length:121}, (_,index) => {
    const p = point(index / 120);
    return `${index ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ');
  ['road-shadow','road-surface','road-centre'].forEach(id => document.getElementById(id).setAttribute('d',route));
  document.getElementById('road-stops').innerHTML = stages.map((_,index) => {
    const p = point(index / 4);
    return `<circle cx="${p.x}" cy="${p.y}" r="7" />`;
  }).join('');
  controls.innerHTML = stages.map((stage,index) => `<button type="button" data-drive-stage="${index}" aria-pressed="false"><small>0${index+1}</small><span>${stage.label}</span></button>`).join('');
  const buttons = [...controls.querySelectorAll('button')];

  function show(value) {
    progress = clamp(value);
    const p = point(progress);
    const bounds = car.parentElement.getBoundingClientRect();
    const roadWidth = bounds.width || 1000;
    const roadHeight = bounds.height || 280;
    const angle = Math.atan2(86 * Math.PI * Math.cos(2 * Math.PI * progress) * roadHeight / 280, 880 * roadWidth / 1000) * 180 / Math.PI;
    car.style.left = `${p.x / 10}%`;
    car.style.top = `${p.y / 2.8}%`;
    car.style.transform = `translate(-50%, -50%) rotate(${angle - 90}deg)`;
    const next = Math.min(4, Math.round(progress * 4));
    if (next === active) return;
    active = next;
    const stage = stages[active];
    story.dataset.stage = String(active);
    document.getElementById('drive-stage-number').textContent = `0${active+1}`;
    document.getElementById('drive-stage-kicker').textContent = stage.kicker;
    document.getElementById('drive-stage-title').innerHTML = stage.title;
    document.getElementById('drive-stage-description').textContent = stage.body;
    buttons.forEach((button,index) => button.setAttribute('aria-pressed',String(index === active)));
    story.querySelectorAll('#road-stops circle').forEach((stop,index) => stop.classList.toggle('passed',index <= active));
  }

  function followScroll() {
    frame = 0;
    if (reducedMotion?.matches) return;
    const bounds = story.getBoundingClientRect();
    const distance = Math.max(1, story.offsetHeight - scene.offsetHeight);
    show((20 - bounds.top) / distance);
  }
  function queueScroll() {
    if (!frame) frame = requestAnimationFrame(followScroll);
  }
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-drive-stage]');
    if (button) show(Number(button.dataset.driveStage) / 4);
  });
  controls.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const button = event.target.closest('[data-drive-stage]');
    if (!button) return;
    event.preventDefault();
    const current = Number(button.dataset.driveStage);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 4 : Math.max(0, Math.min(4, current + (event.key === 'ArrowRight' ? 1 : -1)));
    show(next / 4);
    buttons[next].focus();
  });
  window.addEventListener('scroll', queueScroll, {passive:true});
  window.addEventListener('resize', () => { show(progress); });
  reducedMotion?.addEventListener?.('change', () => {
    story.dataset.motion = reducedMotion.matches ? 'manual' : 'scroll';
    story.querySelector('.scroll-cue').textContent = reducedMotion.matches ? 'CHOOSE A STOP' : 'SCROLL TO DRIVE ↓';
  });
  story.dataset.motion = reducedMotion?.matches ? 'manual' : 'scroll';
  if (reducedMotion?.matches) story.querySelector('.scroll-cue').textContent = 'CHOOSE A STOP';
  show(0);
})();
